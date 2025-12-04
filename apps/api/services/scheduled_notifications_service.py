"""예약 알림 발송 서비스 — D-3/D-1 이벤트 자동 알림."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import TYPE_CHECKING, Literal, cast

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..crypto_utils import decrypt_str
from ..models import Event, PushSubscription, ScheduledNotificationLog
from ..repositories import notification_preferences as pref_repo
from ..repositories import notifications as subs_repo
from ..repositories import send_logs
from .notifications_service import PushProvider, SendResult

if TYPE_CHECKING:
    from collections.abc import Sequence

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))

DType = Literal["d-3", "d-1"]


@dataclass
class BatchConfig:
    """발송 배치 설정."""

    batch_size: int = 50
    batch_delay_seconds: float = 1.0
    max_retries: int = 3


async def find_events_due_for_notification(
    db: AsyncSession,
    *,
    target_date: date | None = None,
) -> dict[DType, list[Event]]:
    """D-3/D-1에 해당하는 이벤트 조회."""
    today = target_date or date.today()
    d3_date = today + timedelta(days=3)
    d1_date = today + timedelta(days=1)

    result: dict[DType, list[Event]] = {"d-3": [], "d-1": []}

    # D-3 이벤트 (3일 후 시작)
    d3_start = datetime.combine(d3_date, datetime.min.time(), tzinfo=KST)
    d3_end = d3_start + timedelta(days=1)
    stmt_d3 = select(Event).where(Event.starts_at >= d3_start, Event.starts_at < d3_end)
    events_d3 = (await db.execute(stmt_d3)).scalars().all()
    result["d-3"] = list(events_d3)

    # D-1 이벤트 (1일 후 시작)
    d1_start = datetime.combine(d1_date, datetime.min.time(), tzinfo=KST)
    d1_end = d1_start + timedelta(days=1)
    stmt_d1 = select(Event).where(Event.starts_at >= d1_start, Event.starts_at < d1_end)
    events_d1 = (await db.execute(stmt_d1)).scalars().all()
    result["d-1"] = list(events_d1)

    return result


async def is_already_sent(
    db: AsyncSession,
    *,
    event_id: int,
    d_type: DType,
) -> bool:
    """중복 발송 여부 확인."""
    stmt = select(ScheduledNotificationLog).where(
        ScheduledNotificationLog.event_id == event_id,
        ScheduledNotificationLog.d_type == d_type,
        ScheduledNotificationLog.status.in_(["completed", "in_progress"]),
    )
    result = await db.execute(stmt)
    return result.scalars().first() is not None


async def get_eligible_subscriptions(
    db: AsyncSession,
    *,
    topic: str = "event",
) -> Sequence[PushSubscription]:
    """토픽 기준으로 알림 수신 가능한 구독 목록 반환.

    로직:
    1. 활성 구독(revoked_at IS NULL) 조회
    2. member_id가 있는 경우, 해당 회원이 topic을 opt-out 했으면 제외
    3. member_id가 없는 경우(익명 구독), 기본 포함
    """
    all_subs = await subs_repo.list_active_subscriptions(db)
    opted_out = await pref_repo.get_opted_out_member_ids(db, topic=topic)

    eligible: list[PushSubscription] = []
    for sub in all_subs:
        member_id = getattr(sub, "member_id", None)
        if member_id is not None and member_id in opted_out:
            continue
        eligible.append(sub)

    return eligible


async def send_batch_notifications(
    db: AsyncSession,
    provider: PushProvider,
    *,
    subscriptions: Sequence[PushSubscription],
    payload: dict[str, str],
    config: BatchConfig | None = None,
) -> SendResult:
    """배치 단위로 알림 발송 (레이트리밋 준수)."""
    cfg = config or BatchConfig()
    accepted = 0
    failed = 0

    subs_list = list(subscriptions)
    for i in range(0, len(subs_list), cfg.batch_size):
        batch = subs_list[i : i + cfg.batch_size]

        for sub in batch:
            endpoint_plain = decrypt_str(cast(str, sub.endpoint))
            ok, status = await _send_with_retry(
                provider, sub, payload, max_retries=cfg.max_retries
            )

            if ok:
                accepted += 1
            else:
                failed += 1
                if status in (404, 410):
                    await subs_repo.remove_by_endpoint(db, endpoint=endpoint_plain)

            await send_logs.create_log(
                db, endpoint=endpoint_plain, ok=ok, status_code=status
            )

        # 배치 간 딜레이 (레이트리밋 준수)
        if i + cfg.batch_size < len(subs_list):
            await asyncio.sleep(cfg.batch_delay_seconds)

    return SendResult(accepted=accepted, failed=failed)


async def _send_with_retry(
    provider: PushProvider,
    sub: PushSubscription,
    payload: dict[str, str],
    *,
    max_retries: int = 3,
) -> tuple[bool, int | None]:
    """지수 백오프로 재시도."""
    status: int | None = None
    for attempt in range(max_retries + 1):
        ok, status = provider.send(sub, payload)

        if ok or status in (400, 404, 410):
            # 성공 또는 복구 불가능한 에러
            return ok, status

        if attempt < max_retries:
            delay = (2**attempt) * 0.5  # 0.5s, 1s, 2s
            await asyncio.sleep(delay)

    return False, status


async def create_notification_log(
    db: AsyncSession,
    *,
    event_id: int,
    d_type: DType,
    scheduled_at: datetime,
) -> ScheduledNotificationLog:
    """발송 로그 생성 (중복 방지용)."""
    log = ScheduledNotificationLog(
        event_id=event_id,
        d_type=d_type,
        scheduled_at=scheduled_at,
        status="pending",
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


async def update_notification_log(
    db: AsyncSession,
    log_id: int,
    *,
    status: str,
    accepted_count: int = 0,
    failed_count: int = 0,
) -> None:
    """발송 로그 상태 업데이트."""
    log = await db.get(ScheduledNotificationLog, log_id)
    if log:
        setattr(log, "status", status)
        setattr(log, "accepted_count", accepted_count)
        setattr(log, "failed_count", failed_count)
        if status == "completed":
            setattr(log, "sent_at", func.now())
        await db.commit()


async def list_scheduled_logs(
    db: AsyncSession,
    *,
    limit: int = 50,
) -> Sequence[ScheduledNotificationLog]:
    """예약 발송 로그 목록 조회."""
    stmt = (
        select(ScheduledNotificationLog)
        .order_by(ScheduledNotificationLog.scheduled_at.desc())
        .limit(min(max(limit, 1), 200))
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@dataclass
class ProcessResult:
    """이벤트 처리 결과."""

    event_id: int
    d_type: DType
    skipped: bool  # 중복 발송으로 스킵됨
    accepted: int
    failed: int


async def process_single_event(
    db: AsyncSession,
    provider: PushProvider,
    event: Event,
    d_type: DType,
) -> ProcessResult:
    """단일 이벤트 알림 처리 (스케줄러/수동 트리거 공용)."""
    event_id = cast(int, event.id)

    # 중복 발송 확인
    if await is_already_sent(db, event_id=event_id, d_type=d_type):
        logger.info(f"이미 발송됨: event_id={event_id}, d_type={d_type}")
        return ProcessResult(
            event_id=event_id, d_type=d_type, skipped=True, accepted=0, failed=0
        )

    # 발송 로그 생성 (in_progress 상태)
    log = await create_notification_log(
        db,
        event_id=event_id,
        d_type=d_type,
        scheduled_at=datetime.now(KST),
    )
    log_id = cast(int, log.id)
    await update_notification_log(db, log_id, status="in_progress")

    # 대상 구독자 조회
    subs = await get_eligible_subscriptions(db, topic="event")

    if not subs:
        logger.info(f"발송 대상 없음: event_id={event_id}")
        await update_notification_log(db, log_id, status="completed")
        return ProcessResult(
            event_id=event_id, d_type=d_type, skipped=False, accepted=0, failed=0
        )

    # 알림 페이로드 생성
    days_label = "3일" if d_type == "d-3" else "1일"
    event_title = cast(str, event.title)
    raw_location = cast("str | None", event.location)
    event_location = raw_location if raw_location else ""
    payload = {
        "title": f"[행사 알림] {event_title}",
        "body": f"{days_label} 후 행사가 있습니다. {event_location}",
        "url": f"/events/{event_id}",
    }

    # 배치 발송
    result = await send_batch_notifications(
        db, provider, subscriptions=subs, payload=payload
    )

    await update_notification_log(
        db,
        log_id,
        status="completed",
        accepted_count=result.accepted,
        failed_count=result.failed,
    )

    logger.info(
        f"발송 완료: event_id={event_id}, d_type={d_type}, "
        f"accepted={result.accepted}, failed={result.failed}"
    )

    return ProcessResult(
        event_id=event_id,
        d_type=d_type,
        skipped=False,
        accepted=result.accepted,
        failed=result.failed,
    )


@dataclass
class TriggerResult:
    """트리거 결과 요약."""

    total_events: int
    processed: int
    skipped: int
    total_accepted: int
    total_failed: int


async def trigger_scheduled_notifications(
    db: AsyncSession,
    provider: PushProvider,
    *,
    target_date: date | None = None,
) -> TriggerResult:
    """예약 알림 트리거 (스케줄러/수동 공용)."""
    events_by_dtype = await find_events_due_for_notification(
        db, target_date=target_date
    )

    total_events = sum(len(evts) for evts in events_by_dtype.values())
    processed = 0
    skipped = 0
    total_accepted = 0
    total_failed = 0

    for d_type, events in events_by_dtype.items():
        for event in events:
            result = await process_single_event(db, provider, event, d_type)
            if result.skipped:
                skipped += 1
            else:
                processed += 1
                total_accepted += result.accepted
                total_failed += result.failed

    return TriggerResult(
        total_events=total_events,
        processed=processed,
        skipped=skipped,
        total_accepted=total_accepted,
        total_failed=total_failed,
    )

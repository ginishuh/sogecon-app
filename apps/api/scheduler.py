"""APScheduler 기반 예약 알림 스케줄러."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import cast

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .db import AsyncSessionLocal
from .models import Event
from .services import scheduled_notifications_service as sched_svc
from .services.notifications_service import PyWebPushProvider

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))

# 모듈 상태 (global 문 대신 dict 사용)
_state: dict[str, AsyncIOScheduler | None] = {"scheduler": None}


async def process_scheduled_notifications() -> None:
    """D-3/D-1 이벤트 알림 처리 (매일 09:00 KST 실행)."""
    logger.info("예약 알림 처리 시작")

    async with AsyncSessionLocal() as db:
        provider = PyWebPushProvider()

        events_by_dtype = await sched_svc.find_events_due_for_notification(db)

        for d_type, events in events_by_dtype.items():
            for event in events:
                await _process_single_event(db, provider, event, d_type)

    logger.info("예약 알림 처리 완료")


async def _process_single_event(
    db: AsyncSession,
    provider: PyWebPushProvider,
    event: Event,
    d_type: sched_svc.DType,
) -> None:
    """단일 이벤트 알림 처리."""
    event_id = cast(int, event.id)

    # 중복 발송 확인
    if await sched_svc.is_already_sent(db, event_id=event_id, d_type=d_type):
        logger.info(f"이미 발송됨: event_id={event_id}, d_type={d_type}")
        return

    # 발송 로그 생성 (in_progress 상태)
    log = await sched_svc.create_notification_log(
        db,
        event_id=event_id,
        d_type=d_type,
        scheduled_at=datetime.now(KST),
    )
    log_id = cast(int, log.id)
    await sched_svc.update_notification_log(db, log_id, status="in_progress")

    try:
        # 대상 구독자 조회
        subs = await sched_svc.get_eligible_subscriptions(db, topic="event")

        if not subs:
            logger.info(f"발송 대상 없음: event_id={event_id}")
            await sched_svc.update_notification_log(db, log_id, status="completed")
            return

        # 알림 페이로드 생성
        days_label = "3일" if d_type == "d-3" else "1일"
        payload = {
            "title": f"[행사 알림] {event.title}",
            "body": f"{days_label} 후 행사가 있습니다. {event.location}",
            "url": f"/events/{event_id}",
        }

        # 배치 발송
        result = await sched_svc.send_batch_notifications(
            db, provider, subscriptions=subs, payload=payload
        )

        await sched_svc.update_notification_log(
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
    except Exception as exc:
        logger.exception(f"발송 실패: event_id={event_id}, error={exc}")
        await sched_svc.update_notification_log(db, log_id, status="failed")


def start_scheduler() -> None:
    """스케줄러 시작."""
    settings = get_settings()

    # 스케줄러 비활성화 옵션 확인
    if not getattr(settings, "scheduler_enabled", True):
        logger.info("스케줄러 비활성화됨 (SCHEDULER_ENABLED=false)")
        return

    scheduler = AsyncIOScheduler(timezone=KST)

    # 매일 09:00 KST에 실행
    scheduler.add_job(
        process_scheduled_notifications,
        trigger=CronTrigger(hour=9, minute=0),
        id="scheduled_notifications",
        name="D-3/D-1 이벤트 알림 발송",
        replace_existing=True,
    )

    scheduler.start()
    _state["scheduler"] = scheduler
    logger.info("스케줄러 시작됨 (매일 09:00 KST)")


def shutdown_scheduler() -> None:
    """스케줄러 종료."""
    scheduler = _state["scheduler"]
    if scheduler is not None:
        scheduler.shutdown(wait=False)
        _state["scheduler"] = None
        logger.info("스케줄러 종료됨")

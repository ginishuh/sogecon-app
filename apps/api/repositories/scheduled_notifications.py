from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import cast

from sqlalchemy import case, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import ScheduledNotificationDelivery, ScheduledNotificationLog


@dataclass(frozen=True)
class DeliveryClaim:
    """외부 Push 호출 전에 커밋된 구독별 claim."""

    id: int
    endpoint_hash: str


@dataclass(frozen=True)
class DeliveryResult:
    """구독별 외부 호출 결과."""

    claim: DeliveryClaim
    ok: bool
    status_code: int | None
    uncertain: bool = False


@dataclass(frozen=True)
class DeliveryCounts:
    accepted: int
    failed: int


def _clean_hashes(endpoint_hashes: Sequence[str]) -> list[str]:
    return list(dict.fromkeys(value for value in endpoint_hashes if value))


async def ensure_deliveries(
    db: AsyncSession,
    *,
    scheduled_log_id: int,
    endpoint_hashes: Sequence[str],
) -> None:
    """예약 로그에 구독별 delivery 행을 멱등적으로 준비한다."""
    hashes = _clean_hashes(endpoint_hashes)

    stale_stmt = update(ScheduledNotificationDelivery).where(
        ScheduledNotificationDelivery.scheduled_log_id == scheduled_log_id,
        ScheduledNotificationDelivery.status.in_(["pending", "failed"]),
    )
    if hashes:
        stale_stmt = stale_stmt.where(
            ~ScheduledNotificationDelivery.endpoint_hash.in_(hashes)
        )
    await db.execute(stale_stmt.values(status="abandoned", finished_at=func.now()))

    if not hashes:
        await db.commit()
        return

    values = [
        {
            "scheduled_log_id": scheduled_log_id,
            "endpoint_hash": endpoint_hash,
            "status": "pending",
            "attempts": 0,
        }
        for endpoint_hash in hashes
    ]
    stmt = pg_insert(ScheduledNotificationDelivery).values(values)
    stmt = stmt.on_conflict_do_nothing(
        index_elements=["scheduled_log_id", "endpoint_hash"]
    )
    await db.execute(stmt)
    await db.commit()


async def get_delivery_states(
    db: AsyncSession,
    *,
    scheduled_log_id: int,
    endpoint_hashes: Sequence[str],
) -> dict[str, str]:
    """요청한 endpoint의 현재 delivery 상태를 반환한다."""
    hashes = _clean_hashes(endpoint_hashes)
    if not hashes:
        return {}

    stmt = select(
        ScheduledNotificationDelivery.endpoint_hash,
        ScheduledNotificationDelivery.status,
    ).where(
        ScheduledNotificationDelivery.scheduled_log_id == scheduled_log_id,
        ScheduledNotificationDelivery.endpoint_hash.in_(hashes),
    )
    result = await db.execute(stmt)
    return {
        cast(str, row[0]): cast(str, row[1])
        for row in result.all()
        if row[0] is not None and row[1] is not None
    }


async def claim_deliveries(
    db: AsyncSession,
    *,
    scheduled_log_id: int,
    endpoint_hashes: Sequence[str],
) -> list[DeliveryClaim]:
    """pending/failed delivery를 잠그고 in_progress claim을 커밋한다."""
    hashes = _clean_hashes(endpoint_hashes)
    if not hashes:
        await db.commit()
        return []

    stmt = (
        select(ScheduledNotificationDelivery)
        .where(
            ScheduledNotificationDelivery.scheduled_log_id == scheduled_log_id,
            ScheduledNotificationDelivery.endpoint_hash.in_(hashes),
            ScheduledNotificationDelivery.status.in_(["pending", "failed"]),
        )
        .order_by(ScheduledNotificationDelivery.id)
        .with_for_update(skip_locked=True)
    )
    result = await db.execute(stmt)
    rows = list(result.scalars().all())
    claims = [
        DeliveryClaim(
            id=cast(int, row.id),
            endpoint_hash=cast(str, row.endpoint_hash),
        )
        for row in rows
    ]
    for row in rows:
        setattr(row, "status", "in_progress")
        setattr(row, "attempts", cast(int, row.attempts or 0) + 1)
        setattr(row, "claimed_at", func.now())
        setattr(row, "finished_at", None)
        setattr(row, "status_code", None)
    await db.commit()
    return claims


async def record_delivery_results(
    db: AsyncSession,
    *,
    results: Sequence[DeliveryResult],
) -> None:
    """구독별 결과를 한 번의 트랜잭션으로 저장한다."""
    for result in results:
        stmt = (
            update(ScheduledNotificationDelivery)
            .where(ScheduledNotificationDelivery.id == result.claim.id)
            .values(
                status=(
                    "unknown"
                    if result.uncertain
                    else ("completed" if result.ok else "failed")
                ),
                status_code=result.status_code,
                finished_at=func.now(),
            )
        )
        await db.execute(stmt)
    await db.commit()


async def get_delivery_counts(
    db: AsyncSession,
    *,
    scheduled_log_id: int,
) -> DeliveryCounts:
    """예약 로그의 구독별 결과를 DB에서 집계한다."""
    status = ScheduledNotificationDelivery.status
    unresolved = status.in_(["pending", "in_progress", "failed", "unknown"])
    stmt = select(
        func.coalesce(func.sum(case((status == "completed", 1), else_=0)), 0),
        func.coalesce(func.sum(case((unresolved, 1), else_=0)), 0),
    ).where(ScheduledNotificationDelivery.scheduled_log_id == scheduled_log_id)
    result = await db.execute(stmt)
    row = result.one()
    return DeliveryCounts(
        accepted=int(row[0] or 0),
        failed=int(row[1] or 0),
    )


async def _finalize_stale_log(
    db: AsyncSession,
    *,
    log_id: int,
) -> DeliveryCounts:
    await db.execute(
        update(ScheduledNotificationDelivery)
        .where(
            ScheduledNotificationDelivery.scheduled_log_id == log_id,
            ScheduledNotificationDelivery.status == "in_progress",
        )
        .values(status="unknown", status_code=None, finished_at=func.now())
    )
    counts = await get_delivery_counts(db, scheduled_log_id=log_id)
    await db.execute(
        update(ScheduledNotificationLog)
        .where(ScheduledNotificationLog.id == log_id)
        .values(
            status="failed",
            accepted_count=counts.accepted,
            failed_count=counts.failed,
            sent_at=None,
            updated_at=func.now(),
        )
    )
    return counts


async def reclaim_stale_log(
    db: AsyncSession,
    *,
    event_id: int,
    d_type: str,
    cutoff: datetime,
) -> int | None:
    """오래 멈춘 로그를 실패로 회수하고 claim을 unknown으로 고정한다."""
    stmt = (
        update(ScheduledNotificationLog)
        .where(
            ScheduledNotificationLog.event_id == event_id,
            ScheduledNotificationLog.d_type == d_type,
            ScheduledNotificationLog.status.in_(["pending", "in_progress"]),
            ScheduledNotificationLog.updated_at < cutoff,
        )
        .values(status="failed", updated_at=func.now())
        .returning(ScheduledNotificationLog.id)
    )
    result = await db.execute(stmt)
    log_id = result.scalar_one_or_none()
    if log_id is None:
        # SELECT/UPDATE가 연 트랜잭션을 rollback하면 호출자가 이미 로드한
        # Event가 expire되어 다음 ORM 접근이 불필요하게 깨질 수 있다.
        await db.commit()
        return None

    resolved_log_id = int(log_id)
    await _finalize_stale_log(db, log_id=resolved_log_id)
    await db.commit()
    return resolved_log_id


async def reclaim_stale_logs(
    db: AsyncSession,
    *,
    cutoff: datetime,
) -> int:
    """due 이벤트와 무관하게 오래된 예약 로그를 일괄 회수한다."""
    stmt = (
        select(ScheduledNotificationLog.id)
        .where(
            ScheduledNotificationLog.status.in_(["pending", "in_progress"]),
            ScheduledNotificationLog.updated_at < cutoff,
        )
        .order_by(ScheduledNotificationLog.id)
        .with_for_update(skip_locked=True)
    )
    result = await db.execute(stmt)
    log_ids = [int(log_id) for log_id in result.scalars().all()]
    if not log_ids:
        await db.commit()
        return 0

    for log_id in log_ids:
        await _finalize_stale_log(db, log_id=log_id)
    await db.commit()
    return len(log_ids)


async def mark_log_failed(
    db: AsyncSession,
    *,
    log_id: int,
    fallback_failed: int,
) -> DeliveryCounts:
    """현재 실행의 예약 로그를 실패로 확정한다."""
    await db.execute(
        update(ScheduledNotificationDelivery)
        .where(
            ScheduledNotificationDelivery.scheduled_log_id == log_id,
            ScheduledNotificationDelivery.status == "in_progress",
        )
        .values(status="unknown", status_code=None, finished_at=func.now())
    )
    counts = await get_delivery_counts(db, scheduled_log_id=log_id)
    if counts.accepted == 0 and counts.failed == 0 and fallback_failed > 0:
        counts = DeliveryCounts(accepted=0, failed=fallback_failed)

    await db.execute(
        update(ScheduledNotificationLog)
        .where(ScheduledNotificationLog.id == log_id)
        .values(
            status="failed",
            accepted_count=counts.accepted,
            failed_count=counts.failed,
            sent_at=None,
            updated_at=func.now(),
        )
    )
    await db.commit()
    return counts

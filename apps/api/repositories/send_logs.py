from __future__ import annotations

import hashlib
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from http import HTTPStatus

from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import case, func

from .. import models


def hash_endpoint(endpoint: str) -> tuple[str, str]:
    h = hashlib.sha256(endpoint.encode()).hexdigest()
    tail = endpoint[-16:]
    return h, tail


@dataclass(frozen=True)
class LogAggregates:
    accepted: int
    failed: int
    failed_404: int
    failed_410: int

    @property
    def failed_other(self) -> int:
        return self.failed - (self.failed_404 + self.failed_410)


@dataclass(frozen=True)
class SendLogItem:
    endpoint: str
    ok: bool
    status_code: int | None


async def create_log(
    db: AsyncSession, *, endpoint: str, ok: bool, status_code: int | None
) -> models.NotificationSendLog:
    endpoint_hash, endpoint_tail = hash_endpoint(endpoint)
    row = models.NotificationSendLog(
        ok=1 if ok else 0,
        status_code=status_code,
        endpoint_hash=endpoint_hash,
        endpoint_tail=endpoint_tail,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def create_logs_batch(
    db: AsyncSession, items: Sequence[SendLogItem]
) -> int:
    """발송 로그를 한 트랜잭션에 batch insert."""
    if not items:
        return 0
    rows: list[models.NotificationSendLog] = []
    for item in items:
        endpoint_hash, endpoint_tail = hash_endpoint(item.endpoint)
        rows.append(
            models.NotificationSendLog(
                ok=1 if item.ok else 0,
                status_code=item.status_code,
                endpoint_hash=endpoint_hash,
                endpoint_tail=endpoint_tail,
            )
        )
    db.add_all(rows)
    await db.commit()
    return len(rows)


async def list_recent(
    db: AsyncSession, *, limit: int = 50
) -> Sequence[models.NotificationSendLog]:
    stmt = (
        select(models.NotificationSendLog)
        .order_by(desc(models.NotificationSendLog.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def list_since(
    db: AsyncSession, *, cutoff: datetime
) -> Sequence[models.NotificationSendLog]:
    """Return logs created at or after the given cutoff.

    Uses a straight timestamp comparison to be dialect-agnostic (SQLite/Postgres).
    """
    stmt = (
        select(models.NotificationSendLog)
        .where(models.NotificationSendLog.created_at >= cutoff)
        .order_by(desc(models.NotificationSendLog.created_at))
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def aggregate_since(db: AsyncSession, *, cutoff: datetime) -> LogAggregates:
    """기간 내 발송 로그를 DB aggregate로 집계 (전건 ORM 로드 없음)."""
    ok_col = models.NotificationSendLog.ok
    sc_col = models.NotificationSendLog.status_code
    stmt = select(
        func.coalesce(func.sum(case((ok_col != 0, 1), else_=0)), 0),
        func.coalesce(func.sum(case((ok_col == 0, 1), else_=0)), 0),
        func.coalesce(
            func.sum(
                case(
                    (
                        (ok_col == 0) & (sc_col == int(HTTPStatus.NOT_FOUND)),
                        1,
                    ),
                    else_=0,
                )
            ),
            0,
        ),
        func.coalesce(
            func.sum(
                case(
                    (
                        (ok_col == 0) & (sc_col == int(HTTPStatus.GONE)),
                        1,
                    ),
                    else_=0,
                )
            ),
            0,
        ),
    ).where(models.NotificationSendLog.created_at >= cutoff)
    result = await db.execute(stmt)
    row = result.one()
    return LogAggregates(
        accepted=int(row[0] or 0),
        failed=int(row[1] or 0),
        failed_404=int(row[2] or 0),
        failed_410=int(row[3] or 0),
    )


async def prune_older_than_days(db: AsyncSession, *, days: int) -> int:
    cutoff = func.now() - func.make_interval(0, 0, 0, days)
    # PostgreSQL 전용 (make_interval 사용)
    count_stmt = select(func.count()).select_from(models.NotificationSendLog).where(
        models.NotificationSendLog.created_at < cutoff
    )
    count_result = await db.execute(count_stmt)
    count = int(count_result.scalar() or 0)

    delete_stmt = delete(models.NotificationSendLog).where(
        models.NotificationSendLog.created_at < cutoff
    )
    await db.execute(delete_stmt)
    await db.commit()
    return count

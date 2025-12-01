from __future__ import annotations

import hashlib
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from .. import models


def hash_endpoint(endpoint: str) -> tuple[str, str]:
    h = hashlib.sha256(endpoint.encode()).hexdigest()
    tail = endpoint[-16:]
    return h, tail


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

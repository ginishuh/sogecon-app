from __future__ import annotations

import hashlib
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import desc, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from .. import models


def hash_endpoint(endpoint: str) -> tuple[str, str]:
    h = hashlib.sha256(endpoint.encode()).hexdigest()
    tail = endpoint[-16:]
    return h, tail


def create_log(
    db: Session, *, endpoint: str, ok: bool, status_code: int | None
) -> models.NotificationSendLog:
    endpoint_hash, endpoint_tail = hash_endpoint(endpoint)
    row = models.NotificationSendLog(
        ok=1 if ok else 0,
        status_code=status_code,
        endpoint_hash=endpoint_hash,
        endpoint_tail=endpoint_tail,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_recent(
    db: Session, *, limit: int = 50
) -> Sequence[models.NotificationSendLog]:
    stmt = (
        select(models.NotificationSendLog)
        .order_by(desc(models.NotificationSendLog.created_at))
        .limit(limit)
    )
    return db.execute(stmt).scalars().all()


def list_since(
    db: Session, *, cutoff: datetime
) -> Sequence[models.NotificationSendLog]:
    """Return logs created at or after the given cutoff.

    Uses a straight timestamp comparison to be dialect-agnostic (SQLite/Postgres).
    """
    stmt = (
        select(models.NotificationSendLog)
        .where(models.NotificationSendLog.created_at >= cutoff)
        .order_by(desc(models.NotificationSendLog.created_at))
    )
    return db.execute(stmt).scalars().all()


def prune_older_than_days(db: Session, *, days: int) -> int:
    cutoff = func.now() - func.make_interval(0, 0, 0, days)
    # SQLite fallback: use datetime('now', '-N days') when dialect lacks make_interval
    try:
        q = db.query(models.NotificationSendLog).filter(
            models.NotificationSendLog.created_at < cutoff
        )
        count = q.count()
        q.delete()
        db.commit()
        return int(count)
    except (NotImplementedError, SQLAlchemyError):
        # Fallback for SQLite
        stmt = text(
            "DELETE FROM notification_send_logs "
            "WHERE created_at < datetime('now', :delta)"
        )
        res = db.execute(stmt, {"delta": f"-{days} days"})
        db.commit()
        # SQLAlchemy Result may not expose rowcount in all dialects; treat unknown as 0
        try:
            n = int(getattr(res, "rowcount", 0) or 0)
        except (TypeError, ValueError):
            n = 0
        return n

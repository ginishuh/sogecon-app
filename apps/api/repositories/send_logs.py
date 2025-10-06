from __future__ import annotations

import hashlib
from collections.abc import Sequence

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

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

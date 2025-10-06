from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models


def upsert_subscription(db: Session, data: dict) -> models.PushSubscription:
    endpoint = str(data.get("endpoint"))
    sub = (
        db.query(models.PushSubscription)
        .filter(models.PushSubscription.endpoint == endpoint)
        .first()
    )
    if sub is None:
        sub = models.PushSubscription(
            endpoint=endpoint,
            p256dh=str(data.get("p256dh")),
            auth=str(data.get("auth")),
            ua=(data.get("ua") if data.get("ua") is not None else None),
            member_id=(
                int(data["member_id"]) if data.get("member_id") is not None else None
            ),
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        return sub
    # update
    setattr(sub, "p256dh", str(data.get("p256dh")))
    setattr(sub, "auth", str(data.get("auth")))
    setattr(sub, "ua", (data.get("ua") if data.get("ua") is not None else None))
    if data.get("member_id") is not None:
        setattr(sub, "member_id", int(data["member_id"]))
    db.commit()
    db.refresh(sub)
    return sub


def delete_subscription(db: Session, *, endpoint: str) -> None:
    sub = (
        db.query(models.PushSubscription)
        .filter(models.PushSubscription.endpoint == endpoint)
        .first()
    )
    if sub is None:
        return
    db.delete(sub)
    db.commit()


def list_active_subscriptions(db: Session) -> Sequence[models.PushSubscription]:
    stmt = select(models.PushSubscription).where(
        models.PushSubscription.revoked_at.is_(None)
    )
    return db.execute(stmt).scalars().all()


def remove_by_endpoint(db: Session, *, endpoint: str) -> None:
    db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == endpoint
    ).delete()
    db.commit()

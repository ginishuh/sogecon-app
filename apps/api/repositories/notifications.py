from __future__ import annotations

import hashlib
from collections.abc import Sequence
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..crypto_utils import encrypt_str


class SubscriptionData(TypedDict, total=False):
    endpoint: str
    p256dh: str
    auth: str
    ua: str | None
    member_id: int | None


def _hash_endpoint(endpoint: str) -> str:
    return hashlib.sha256(endpoint.encode()).hexdigest()


async def upsert_subscription(
    db: AsyncSession, data: SubscriptionData
) -> models.PushSubscription:
    endpoint_plain = str(data.get("endpoint"))
    endpoint_hash = _hash_endpoint(endpoint_plain)
    endpoint = encrypt_str(endpoint_plain)

    stmt = select(models.PushSubscription).where(
        models.PushSubscription.endpoint_hash == endpoint_hash
    )
    result = await db.execute(stmt)
    sub = result.scalars().first()

    if sub is None:
        member_val = data.get("member_id")
        sub = models.PushSubscription(
            endpoint=endpoint,
            p256dh=str(data.get("p256dh")),
            auth=str(data.get("auth")),
            ua=(data.get("ua") if data.get("ua") is not None else None),
            member_id=(int(member_val) if member_val is not None else None),
            endpoint_hash=endpoint_hash,
        )
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
        return sub

    # update
    setattr(sub, "p256dh", str(data.get("p256dh")))
    setattr(sub, "auth", str(data.get("auth")))
    setattr(sub, "ua", (data.get("ua") if data.get("ua") is not None else None))
    member_val2 = data.get("member_id")
    if member_val2 is not None:
        setattr(sub, "member_id", int(member_val2))
    setattr(sub, "endpoint", endpoint)
    setattr(sub, "endpoint_hash", endpoint_hash)
    await db.commit()
    await db.refresh(sub)
    return sub


async def delete_subscription(db: AsyncSession, *, endpoint: str) -> None:
    h = _hash_endpoint(endpoint)
    stmt = select(models.PushSubscription).where(
        models.PushSubscription.endpoint_hash == h
    )
    result = await db.execute(stmt)
    sub = result.scalars().first()
    if sub is None:
        return
    await db.delete(sub)
    await db.commit()


async def list_active_subscriptions(
    db: AsyncSession,
) -> Sequence[models.PushSubscription]:
    stmt = select(models.PushSubscription).where(
        models.PushSubscription.revoked_at.is_(None)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def remove_by_endpoint(db: AsyncSession, *, endpoint: str) -> None:
    h = _hash_endpoint(endpoint)
    stmt = select(models.PushSubscription).where(
        models.PushSubscription.endpoint_hash == h
    )
    result = await db.execute(stmt)
    sub = result.scalars().first()
    if sub:
        await db.delete(sub)
        await db.commit()

from __future__ import annotations

import hashlib
from collections.abc import Sequence
from typing import TypedDict, cast

from sqlalchemy import CursorResult, delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..crypto_utils import encrypt_str


class SubscriptionData(TypedDict, total=False):
    endpoint: str
    p256dh: str
    auth: str
    ua: str | None
    member_id: int | None


class SubscriptionOwnershipError(Exception):
    """구독 행이 다른 회원 소유일 때 발생."""


def _hash_endpoint(endpoint: str) -> str:
    return hashlib.sha256(endpoint.encode()).hexdigest()


def hash_endpoint(endpoint: str) -> str:
    """공개 해시 헬퍼 (배치 삭제 등)."""
    return _hash_endpoint(endpoint)


def _as_member_id(raw: object) -> int | None:
    if raw is None:
        return None
    if isinstance(raw, int):
        return raw
    return int(str(raw))


async def upsert_subscription(
    db: AsyncSession,
    data: SubscriptionData,
    *,
    actor_member_id: int,
) -> models.PushSubscription:
    """endpoint_hash 기준 원자적 upsert.

    동시 INSERT는 ON CONFLICT로 직렬화한다. 충돌 후 WHERE로
    NULL/본인 소유만 갱신하고, 타인 소유면 OwnershipError.
    """
    endpoint_plain = str(data.get("endpoint"))
    endpoint_hash = _hash_endpoint(endpoint_plain)
    endpoint = encrypt_str(endpoint_plain)
    p256dh = encrypt_str(str(data.get("p256dh")))
    auth = encrypt_str(str(data.get("auth")))
    ua_val = data.get("ua") if data.get("ua") is not None else None
    actor = int(actor_member_id)

    insert_stmt = pg_insert(models.PushSubscription).values(
        endpoint=endpoint,
        p256dh=p256dh,
        auth=auth,
        ua=ua_val,
        member_id=actor,
        endpoint_hash=endpoint_hash,
    )
    stmt = insert_stmt.on_conflict_do_update(
        index_elements=["endpoint_hash"],
        set_={
            "endpoint": insert_stmt.excluded.endpoint,
            "p256dh": insert_stmt.excluded.p256dh,
            "auth": insert_stmt.excluded.auth,
            "ua": insert_stmt.excluded.ua,
            "member_id": insert_stmt.excluded.member_id,
        },
        where=(
            (models.PushSubscription.member_id.is_(None))
            | (models.PushSubscription.member_id == actor)
        ),
    ).returning(models.PushSubscription)

    result = await db.execute(stmt)
    sub = result.scalars().first()
    if sub is None:
        # 타인 소유로 UPDATE WHERE가 매칭되지 않음
        await db.rollback()
        raise SubscriptionOwnershipError()

    await db.commit()
    await db.refresh(sub)
    return sub


async def delete_subscription(
    db: AsyncSession, *, endpoint: str, actor_member_id: int
) -> None:
    h = _hash_endpoint(endpoint)
    stmt = select(models.PushSubscription).where(
        models.PushSubscription.endpoint_hash == h
    )
    result = await db.execute(stmt)
    sub = result.scalars().first()
    if sub is None:
        return
    owner = _as_member_id(sub.member_id)
    if owner is not None and owner != int(actor_member_id):
        raise SubscriptionOwnershipError()
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


async def count_active_subscriptions(db: AsyncSession) -> int:
    stmt = (
        select(func.count())
        .select_from(models.PushSubscription)
        .where(models.PushSubscription.revoked_at.is_(None))
    )
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


async def remove_by_endpoint(db: AsyncSession, *, endpoint: str) -> None:
    """시스템(404/410) 정리용 — 소유권 검사 없음."""
    h = _hash_endpoint(endpoint)
    await remove_by_endpoint_hashes(db, [h])


async def remove_by_endpoint_hashes(
    db: AsyncSession, hashes: Sequence[str], *, batch_size: int = 100
) -> int:
    """endpoint_hash 목록으로 구독 행을 bounded batch DELETE."""
    cleaned = [h for h in hashes if h]
    if not cleaned:
        return 0
    total = 0
    for i in range(0, len(cleaned), batch_size):
        chunk = list(cleaned[i : i + batch_size])
        stmt = delete(models.PushSubscription).where(
            models.PushSubscription.endpoint_hash.in_(chunk)
        )
        result = await db.execute(stmt)
        cursor = cast(CursorResult[object], result)
        total += int(cursor.rowcount or 0)
        await db.commit()
    return total

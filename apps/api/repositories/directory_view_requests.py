from __future__ import annotations

from collections.abc import Sequence
from typing import cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from .. import models
from ..models_directory_view import DirectoryViewRequest


async def get_by_id(
    db: AsyncSession, request_id: int
) -> DirectoryViewRequest | None:
    return await db.get(DirectoryViewRequest, request_id)


async def get_pair(
    db: AsyncSession, *, requester_id: int, target_id: int
) -> DirectoryViewRequest | None:
    stmt = select(DirectoryViewRequest).where(
        DirectoryViewRequest.requester_id == requester_id,
        DirectoryViewRequest.target_id == target_id,
    )
    return (await db.execute(stmt)).scalars().first()


async def create(
    db: AsyncSession, row: DirectoryViewRequest
) -> DirectoryViewRequest:
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def save(
    db: AsyncSession, row: DirectoryViewRequest
) -> DirectoryViewRequest:
    await db.commit()
    await db.refresh(row)
    return row


async def list_incoming_with_requester(
    db: AsyncSession, *, target_id: int, limit: int = 50
) -> Sequence[tuple[DirectoryViewRequest, models.Member]]:
    requester = aliased(models.Member)
    stmt = (
        select(DirectoryViewRequest, requester)
        .join(requester, requester.id == DirectoryViewRequest.requester_id)
        .where(DirectoryViewRequest.target_id == target_id)
        .order_by(
            DirectoryViewRequest.created_at.desc(),
            DirectoryViewRequest.id.desc(),
        )
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [(cast(DirectoryViewRequest, req), member) for req, member in rows]

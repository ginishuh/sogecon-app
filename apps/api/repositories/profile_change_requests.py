"""프로필 변경 요청 Repository."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from .. import models


async def create(
    db: AsyncSession,
    row: models.ProfileChangeRequest,
) -> models.ProfileChangeRequest:
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def get_by_id(
    db: AsyncSession,
    request_id: int,
) -> models.ProfileChangeRequest | None:
    stmt = select(models.ProfileChangeRequest).where(
        models.ProfileChangeRequest.id == request_id
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def get_pending_by_member_and_field(
    db: AsyncSession,
    member_id: int,
    field_name: str,
) -> models.ProfileChangeRequest | None:
    stmt = select(models.ProfileChangeRequest).where(
        and_(
            models.ProfileChangeRequest.member_id == member_id,
            models.ProfileChangeRequest.field_name == field_name,
            models.ProfileChangeRequest.status == "pending",
        )
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def list_with_total(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    status: str | None = None,
    member_id: int | None = None,
) -> tuple[Sequence[models.ProfileChangeRequest], int]:
    conditions: list[ColumnElement[bool]] = []
    if status is not None:
        conditions.append(models.ProfileChangeRequest.status == status)
    if member_id is not None:
        conditions.append(models.ProfileChangeRequest.member_id == member_id)

    stmt = (
        select(models.ProfileChangeRequest)
        .order_by(
            desc(models.ProfileChangeRequest.requested_at),
            desc(models.ProfileChangeRequest.id),
        )
        .offset(offset)
        .limit(limit)
    )
    if conditions:
        stmt = stmt.where(and_(*conditions))
    rows = (await db.execute(stmt)).scalars().all()

    count_stmt = select(func.count(models.ProfileChangeRequest.id))
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    total = int((await db.execute(count_stmt)).scalar_one())

    return rows, total


async def list_by_member(
    db: AsyncSession,
    member_id: int,
) -> Sequence[models.ProfileChangeRequest]:
    stmt = (
        select(models.ProfileChangeRequest)
        .where(models.ProfileChangeRequest.member_id == member_id)
        .order_by(
            desc(models.ProfileChangeRequest.requested_at),
            desc(models.ProfileChangeRequest.id),
        )
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def save(
    db: AsyncSession,
    row: models.ProfileChangeRequest,
) -> models.ProfileChangeRequest:
    await db.commit()
    await db.refresh(row)
    return row

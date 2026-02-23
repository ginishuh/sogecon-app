from __future__ import annotations

import hashlib
from collections.abc import Sequence

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from .. import models, schemas


def _build_conditions(
    filters: schemas.SignupRequestListFilters,
) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = []

    q = filters.get("q")
    if q:
        like = f"%{q.strip()}%"
        conditions.append(
            or_(
                models.SignupRequest.student_id.ilike(like),
                models.SignupRequest.name.ilike(like),
                models.SignupRequest.email.ilike(like),
            )
        )

    status = filters.get("status")
    if status is not None:
        conditions.append(models.SignupRequest.status == status)

    return conditions


async def create_signup_request(
    db: AsyncSession,
    payload: schemas.SignupRequestCreate,
) -> models.SignupRequest:
    row = models.SignupRequest(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def get_pending_by_student_id(
    db: AsyncSession,
    student_id: str,
) -> models.SignupRequest | None:
    stmt = select(models.SignupRequest).where(
        and_(
            models.SignupRequest.student_id == student_id,
            models.SignupRequest.status == "pending",
        )
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def get_signup_request_by_id(
    db: AsyncSession,
    signup_request_id: int,
) -> models.SignupRequest | None:
    stmt = select(models.SignupRequest).where(
        models.SignupRequest.id == signup_request_id
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def list_signup_requests_with_total(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    filters: schemas.SignupRequestListFilters | None = None,
) -> tuple[Sequence[models.SignupRequest], int]:
    f = filters or {}
    conditions = _build_conditions(f)

    stmt = (
        select(models.SignupRequest)
        .order_by(
            desc(models.SignupRequest.requested_at),
            desc(models.SignupRequest.id),
        )
        .offset(offset)
        .limit(limit)
    )
    if conditions:
        stmt = stmt.where(and_(*conditions))

    rows = (await db.execute(stmt)).scalars().all()

    count_stmt = select(func.count(models.SignupRequest.id))
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    total = int((await db.execute(count_stmt)).scalar_one())

    return rows, total


async def save_signup_request(
    db: AsyncSession,
    row: models.SignupRequest,
) -> models.SignupRequest:
    await db.commit()
    await db.refresh(row)
    return row


def hash_activation_token(token: str) -> tuple[str, str]:
    digest = hashlib.sha256(token.encode()).hexdigest()
    tail = token[-16:]
    return digest, tail


async def create_activation_issue_log(
    db: AsyncSession,
    *,
    signup_request_id: int,
    issued_type: schemas.SignupActivationIssueTypeLiteral,
    issued_by_student_id: str,
    token: str,
) -> models.SignupActivationIssueLog:
    token_hash, token_tail = hash_activation_token(token)
    row = models.SignupActivationIssueLog(
        signup_request_id=signup_request_id,
        issued_type=issued_type,
        issued_by_student_id=issued_by_student_id,
        token_hash=token_hash,
        token_tail=token_tail,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def list_activation_issue_logs(
    db: AsyncSession,
    *,
    signup_request_id: int,
    limit: int = 20,
) -> Sequence[models.SignupActivationIssueLog]:
    stmt = (
        select(models.SignupActivationIssueLog)
        .where(models.SignupActivationIssueLog.signup_request_id == signup_request_id)
        .order_by(
            desc(models.SignupActivationIssueLog.issued_at),
            desc(models.SignupActivationIssueLog.id),
        )
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()

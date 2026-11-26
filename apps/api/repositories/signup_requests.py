from __future__ import annotations

import hashlib
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from .. import models, schemas
from ..student_id_key import student_id_lock_name, student_id_match_clause
from . import escape_like


def _build_conditions(
    filters: schemas.SignupRequestListFilters,
) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = []

    q = filters.get("q")
    if q:
        qv = q.strip()
        if qv:
            like = f"%{escape_like(qv)}%"
            conditions.append(
                or_(
                    models.SignupRequest.student_id.ilike(like, escape="\\"),
                    models.SignupRequest.name.ilike(like, escape="\\"),
                    models.SignupRequest.email.ilike(like, escape="\\"),
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


async def add_signup_request(
    db: AsyncSession,
    row: models.SignupRequest,
) -> models.SignupRequest:
    """신청 행을 추가하고 flush한다(커밋은 호출한 서비스가 한다)."""
    db.add(row)
    await db.flush()
    return row


async def get_pending_by_student_key(
    db: AsyncSession,
    student_id: str,
) -> models.SignupRequest | None:
    """학번 키가 같은 대기 신청(표기만 다른 학번 포함)."""
    stmt = select(models.SignupRequest).where(
        and_(
            student_id_match_clause(models.SignupRequest.student_id, student_id),
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


async def get_signup_request_for_update(
    db: AsyncSession,
    signup_request_id: int,
) -> models.SignupRequest | None:
    """신청 행을 트랜잭션 끝까지 잠근다(동시 승인·반려 직렬화)."""
    stmt = (
        select(models.SignupRequest)
        .where(models.SignupRequest.id == signup_request_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def _advisory_xact_lock(db: AsyncSession, name: str) -> None:
    await db.execute(
        select(func.pg_advisory_xact_lock(func.hashtextextended(name, 0)))
    )


async def lock_student_key(db: AsyncSession, student_id: str) -> None:
    """같은 학번 키의 접수·승인을 커밋/롤백까지 직렬화한다.

    잠금 순서는 항상 신청 행 → 학번 키 → 이메일이다.
    """
    await _advisory_xact_lock(db, student_id_lock_name(student_id))


async def lock_email(db: AsyncSession, email: str) -> None:
    """대소문자를 무시한 같은 이메일의 승인을 직렬화한다(학번 키 잠금 다음)."""
    await _advisory_xact_lock(db, f"signup:email:{email.strip().lower()}")


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


@dataclass(frozen=True)
class ActivationIssueLogWrite:
    signup_request_id: int
    issued_type: schemas.SignupActivationIssueTypeLiteral
    issued_by_student_id: str
    token: str
    recipient_masked: str | None = None
    related_issue_id: int | None = None


async def create_activation_issue_log(
    db: AsyncSession,
    payload: ActivationIssueLogWrite,
    *,
    commit: bool = True,
) -> models.SignupActivationIssueLog:
    token_hash, token_tail = hash_activation_token(payload.token)
    row = models.SignupActivationIssueLog(
        signup_request_id=payload.signup_request_id,
        issued_type=payload.issued_type,
        issued_by_student_id=payload.issued_by_student_id,
        token_hash=token_hash,
        token_tail=token_tail,
        recipient_masked=payload.recipient_masked,
        related_issue_id=payload.related_issue_id,
    )
    db.add(row)
    if commit:
        await db.commit()
    else:
        await db.flush()
    await db.refresh(row)
    return row


async def find_latest_issue_log_id_for_token(
    db: AsyncSession,
    *,
    signup_request_id: int,
    token_hash: str,
) -> int | None:
    stmt = (
        select(models.SignupActivationIssueLog.id)
        .where(
            models.SignupActivationIssueLog.signup_request_id == signup_request_id,
            models.SignupActivationIssueLog.token_hash == token_hash,
            models.SignupActivationIssueLog.issued_type.in_(("approve", "reissue")),
        )
        .order_by(
            desc(models.SignupActivationIssueLog.issued_at),
            desc(models.SignupActivationIssueLog.id),
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


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

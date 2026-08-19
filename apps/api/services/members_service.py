from __future__ import annotations

import io
import time
from collections import OrderedDict
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Literal, Never, cast

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.datastructures import Headers

from .. import models, schemas
from ..errors import AlreadyExistsError, ApiError, ForbiddenError
from ..repositories import members as members_repo
from . import upload_service as upload_service_module
from .activation_service import create_member_activation_token
from .roles_service import (
    normalize_assignable_roles,
    parse_roles,
    serialize_roles,
)

_MEMBER_COUNT_CACHE_TTL = 30.0
_MEMBER_COUNT_CACHE_MAX = 64
_member_count_cache: OrderedDict[
    tuple[tuple[str, str], ...], tuple[float, int]
] = OrderedDict()


def _raise_member_conflict_from_integrity_error(exc: IntegrityError) -> Never:
    """members 유니크 제약 충돌을 안정적인 409 코드로 변환."""
    message = str(exc.orig).lower()
    if (
        "ix_members_phone" in message
        or "members.phone" in message
        or "key (phone)" in message
    ):
        raise AlreadyExistsError(
            code="member_phone_already_in_use",
            detail="Phone already in use",
        ) from exc
    if (
        "ix_members_email" in message
        or "members.email" in message
        or "key (email)" in message
    ):
        raise AlreadyExistsError(
            code="member_email_already_in_use",
            detail="Email already in use",
        ) from exc
    if (
        "ix_members_student_id" in message
        or "members.student_id" in message
        or "key (student_id)" in message
    ):
        raise AlreadyExistsError(
            code="member_exists",
            detail="Student ID already in use",
        ) from exc
    raise exc


async def list_members(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    filters: schemas.MemberListFilters | None = None,
    viewer_student_id: str | None = None,
) -> Sequence[models.Member]:
    return await members_repo.list_members(
        db, limit=limit, offset=offset, filters=filters,
        viewer_student_id=viewer_student_id,
    )


async def list_directory_members(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    filters: schemas.MemberListFilters,
    viewer_student_id: str,
) -> list[schemas.DirectoryMemberRead]:
    rows = await members_repo.list_directory_rows(
        db,
        limit=limit,
        offset=offset,
        filters=filters,
        viewer_student_id=viewer_student_id,
    )
    return [
        _to_directory_member(
            member,
            viewer_student_id=viewer_student_id,
            viewer_cohort=viewer_cohort,
            request_status=request_status,
        )
        for member, request_status, viewer_cohort in rows
    ]


async def count_members(
    db: AsyncSession, *, filters: schemas.MemberListFilters | None = None,
    viewer_student_id: str | None = None,
) -> int:
    # 조회자별 공개 범위는 즉시 반영되어야 하므로 짧은 캐시도 사용하지 않는다.
    # 관리자용 집계만 기존 필터 캐시를 유지한다.
    if viewer_student_id is not None:
        return await members_repo.count_members(
            db, filters=filters, viewer_student_id=viewer_student_id
        )

    def _normalize_value(value: object) -> str:
        if isinstance(value, bool):
            return "1" if value else "0"
        return str(value)

    key: tuple[tuple[str, str], ...]
    if not filters:
        key = tuple()
    else:
        items = [
            (k, _normalize_value(v))
            for k, v in filters.items()
            if v is not None
        ]
        items.sort()
        key = tuple(items)
    now = time.time()
    cached = _member_count_cache.get(key)
    if cached and (now - cached[0]) < _MEMBER_COUNT_CACHE_TTL:
        _member_count_cache.move_to_end(key, last=True)
        return cached[1]

    count = await members_repo.count_members(db, filters=filters)
    _member_count_cache[key] = (now, count)
    _member_count_cache.move_to_end(key, last=True)
    if len(_member_count_cache) > _MEMBER_COUNT_CACHE_MAX:
        _member_count_cache.popitem(last=False)
    return count


async def count_directory_members(
    db: AsyncSession,
    *,
    filters: schemas.MemberListFilters,
    viewer_student_id: str,
) -> int:
    return await count_members(
        db,
        filters=filters,
        viewer_student_id=viewer_student_id,
    )


async def get_member(db: AsyncSession, member_id: int) -> models.Member:
    return await members_repo.get_member(db, member_id)


async def get_directory_member(
    db: AsyncSession,
    *,
    member_id: int,
    viewer_student_id: str,
) -> schemas.DirectoryMemberRead:
    member, request_status, viewer_cohort = await members_repo.get_directory_member(
        db,
        member_id=member_id,
        viewer_student_id=viewer_student_id,
    )
    return _to_directory_member(
        member,
        viewer_student_id=viewer_student_id,
        viewer_cohort=viewer_cohort,
        request_status=request_status,
    )


def is_directory_details_visible(
    member: models.Member,
    *,
    viewer_student_id: str,
    viewer_cohort: int,
    request_status: str | None,
) -> bool:
    if cast(str, member.student_id) == viewer_student_id:
        return True
    if request_status == "accepted":
        return True
    visibility = cast(models.Visibility, member.visibility)
    if visibility is models.Visibility.ALL:
        return True
    member_cohort = cast(int, member.cohort)
    if visibility is models.Visibility.COHORT and member_cohort == viewer_cohort:
        return True
    return False


def _to_directory_member(
    member: models.Member,
    *,
    viewer_student_id: str,
    viewer_cohort: int,
    request_status: str | None,
) -> schemas.DirectoryMemberRead:
    is_self = cast(str, member.student_id) == viewer_student_id
    status = None if is_self else request_status
    visible = is_directory_details_visible(
        member,
        viewer_student_id=viewer_student_id,
        viewer_cohort=viewer_cohort,
        request_status=request_status,
    )
    if visible:
        dto = schemas.DirectoryMemberRead.model_validate(member)
        return dto.model_copy(
            update={"details_visible": True, "view_request": status}
        )
    visibility = member.visibility
    visibility_value = (
        visibility.value
        if isinstance(visibility, models.Visibility)
        else str(visibility)
    )
    request_value: Literal["pending", "accepted", "declined"] | None
    if status in ("pending", "accepted", "declined"):
        request_value = status
    else:
        request_value = None
    return schemas.DirectoryMemberRead(
        id=int(cast(int, member.id)),
        name=cast(str, member.name),
        cohort=cast(int, member.cohort),
        visibility=cast(schemas.VisibilityLiteral, visibility_value),
        details_visible=False,
        view_request=request_value,
    )


async def create_member(
    db: AsyncSession, payload: schemas.MemberCreate
) -> models.Member:
    # 이메일 중복 방지(사전 검사)
    stmt = select(models.Member).where(models.Member.email == payload.email)
    result = await db.execute(stmt)
    if result.scalars().first() is not None:
        raise AlreadyExistsError(code="member_exists", detail="Email already in use")
    phone = payload.phone.strip() if isinstance(payload.phone, str) else None
    normalized_phone = phone or None
    if isinstance(normalized_phone, str):
        stmt = select(models.Member.id).where(models.Member.phone == normalized_phone)
        phone_result = await db.execute(stmt)
        if phone_result.scalar_one_or_none() is not None:
            raise AlreadyExistsError(
                code="member_phone_already_in_use",
                detail="Phone already in use",
            )
    if normalized_phone != payload.phone:
        payload = payload.model_copy(update={"phone": normalized_phone})
    try:
        return await members_repo.create_member(db, payload)
    except IntegrityError as exc:
        await db.rollback()
        _raise_member_conflict_from_integrity_error(exc)


async def get_member_by_student_id(db: AsyncSession, student_id: str) -> models.Member:
    return await members_repo.get_member_by_student_id(db, student_id)


async def get_session_member(
    db: AsyncSession, *, member_id: int | None, student_id: str
) -> models.Member:
    if member_id is not None:
        return await get_member(db, member_id)
    return await get_member_by_student_id(db, student_id)


async def _ensure_not_deactivating_last_super_admin(
    db: AsyncSession,
    *,
    member: models.Member,
    next_status: object,
) -> None:
    """활성 마지막 super_admin을 비활성 상태로 바꾸지 못하게 막는다."""
    if not isinstance(next_status, str) or next_status == "active":
        return
    if str(member.status) != "active":
        return
    if parse_roles(member.roles).grade != "super_admin":
        return
    super_admin_count = await members_repo.count_active_members_with_role(
        db,
        role="super_admin",
        serialize_super_admin_changes=True,
    )
    if super_admin_count <= 1:
        raise ApiError(
            code="last_super_admin_forbidden",
            detail="Cannot deactivate the last super_admin",
            status=422,
        )


async def update_member_profile_admin(
    db: AsyncSession, *, member_id: int, data: schemas.AdminMemberUpdate
) -> models.Member:
    """관리자 회원 정보 수정 (roles 제외)."""
    raw_payload = data.model_dump(exclude_unset=True)
    if not raw_payload:
        return await members_repo.get_member(db, member_id)

    member = await members_repo.get_member(db, member_id)
    if "status" in raw_payload:
        await _ensure_not_deactivating_last_super_admin(
            db,
            member=member,
            next_status=raw_payload.get("status"),
        )

    sanitized_data: dict[str, object] = {
        key: value.strip() if isinstance(value, str) else value
        for key, value in raw_payload.items()
    }

    email_value = sanitized_data.get("email")
    if isinstance(email_value, str):
        normalized_email = email_value.strip().lower() or None
        sanitized_data["email"] = normalized_email
        if isinstance(normalized_email, str):
            stmt = select(models.Member.id).where(
                models.Member.email == normalized_email,
                models.Member.id != member_id,
            )
            result = await db.execute(stmt)
            if result.scalar_one_or_none() is not None:
                raise AlreadyExistsError(
                    code="member_email_already_in_use",
                    detail="Email already in use",
                )

    phone_value = sanitized_data.get("phone")
    if isinstance(phone_value, str):
        normalized_phone = phone_value.strip() or None
        sanitized_data["phone"] = normalized_phone
        if isinstance(normalized_phone, str):
            stmt = select(models.Member.id).where(
                models.Member.phone == normalized_phone,
                models.Member.id != member_id,
            )
            result = await db.execute(stmt)
            if result.scalar_one_or_none() is not None:
                raise AlreadyExistsError(
                    code="member_phone_already_in_use",
                    detail="Phone already in use",
                )

    await _require_directory_consent_to_open(
        db, member_id=member_id, visibility=sanitized_data.get("visibility")
    )
    sanitized = data.model_copy(update=sanitized_data)
    try:
        return await members_repo.update_member_profile_admin(
            db, member_id=member_id, data=sanitized
        )
    except IntegrityError as exc:
        await db.rollback()
        _raise_member_conflict_from_integrity_error(exc)


async def _require_directory_consent_to_open(
    db: AsyncSession, *, member_id: int, visibility: object
) -> None:
    if visibility not in ("all", "cohort"):
        return
    current = await members_repo.get_member(db, member_id)
    if cast(datetime | None, current.directory_consent_at) is None:
        raise ForbiddenError(
            code="directory_consent_required",
            detail="동문 수첩에 공개하려면 안내에 동의해 주세요.",
        )


async def update_member_profile(
    db: AsyncSession, *, member_id: int, data: schemas.MemberUpdate
) -> models.Member:
    raw_payload = data.model_dump(exclude_unset=True)
    if not raw_payload:
        return await members_repo.update_member_profile(
            db, member_id=member_id, data=data
        )
    sanitized_data: dict[str, object] = {
        key: value.strip() if isinstance(value, str) else value
        for key, value in raw_payload.items()
    }
    email_value = sanitized_data.get("email")
    if isinstance(email_value, str):
        normalized_email = email_value.strip().lower() or None
        sanitized_data["email"] = normalized_email
        if isinstance(normalized_email, str):
            stmt = select(models.Member.id).where(
                models.Member.email == normalized_email,
                models.Member.id != member_id,
            )
            result = await db.execute(stmt)
            if result.scalar_one_or_none() is not None:
                raise AlreadyExistsError(
                    code="member_email_already_in_use",
                    detail="Email already in use",
                )
    phone_value = sanitized_data.get("phone")
    if isinstance(phone_value, str):
        normalized_phone = phone_value.strip() or None
        sanitized_data["phone"] = normalized_phone
        if isinstance(normalized_phone, str):
            stmt = select(models.Member.id).where(
                models.Member.phone == normalized_phone,
                models.Member.id != member_id,
            )
            result = await db.execute(stmt)
            if result.scalar_one_or_none() is not None:
                raise AlreadyExistsError(
                    code="member_phone_already_in_use",
                    detail="Phone already in use",
                )
    await _require_directory_consent_to_open(
        db, member_id=member_id, visibility=sanitized_data.get("visibility")
    )
    sanitized = data.model_copy(update=sanitized_data)
    try:
        return await members_repo.update_member_profile(
            db, member_id=member_id, data=sanitized
        )
    except IntegrityError as exc:
        await db.rollback()
        _raise_member_conflict_from_integrity_error(exc)


async def update_member_avatar(
    db: AsyncSession,
    *,
    member_id: int,
    file_bytes: bytes,
    filename_hint: str | None = None,
) -> models.Member:
    """Legacy entry point — delegates to upload_service bounded pipeline."""
    upload = UploadFile(
        file=io.BytesIO(file_bytes),
        filename=filename_hint or "avatar.jpg",
        headers=Headers({"content-type": "image/jpeg"}),
    )
    return await upload_service_module.upload_member_avatar(
        db, member_id=member_id, upload=upload
    )


async def create_member_direct(
    db: AsyncSession,
    payload: schemas.DirectMemberCreatePayload,
) -> tuple[models.Member, str]:
    """관리자 직접 회원 생성 + 활성화 토큰 발급.

    Returns:
        (생성된 Member, 활성화 토큰 문자열) 튜플
    """
    stmt = select(models.Member).where(
        models.Member.student_id == payload.student_id
    )
    result = await db.execute(stmt)
    if result.scalars().first() is not None:
        raise AlreadyExistsError(
            code="member_exists",
            detail="Student ID already in use",
        )

    stmt = select(models.Member).where(models.Member.email == payload.email)
    result = await db.execute(stmt)
    if result.scalars().first() is not None:
        raise AlreadyExistsError(
            code="member_email_already_in_use",
            detail="Email already in use",
        )

    normalized_roles = normalize_assignable_roles(payload.roles)
    serialized_roles = serialize_roles(normalized_roles)

    # Member 생성
    member = models.Member(
        student_id=payload.student_id,
        email=str(payload.email),
        name=payload.name,
        cohort=payload.cohort,
        roles=serialized_roles,
        status="active",
        visibility=models.Visibility.PRIVATE,
    )
    db.add(member)
    await db.flush()

    # SignupRequest 레코드 생성 (activation_service가 signup_request_id 필요)
    signup_request = models.SignupRequest(
        student_id=payload.student_id,
        email=str(payload.email),
        name=payload.name,
        cohort=payload.cohort,
        status="approved",
    )
    db.add(signup_request)
    await db.flush()

    # 활성화 토큰 발급
    activation_token = create_member_activation_token(
        signup_request_id=cast(int, signup_request.id),
        student_id=payload.student_id,
        cohort=payload.cohort,
        name=payload.name,
    )

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        _raise_member_conflict_from_integrity_error(exc)

    await db.refresh(member)
    return member, activation_token


async def update_member_roles(
    db: AsyncSession,
    *,
    member_id: int,
    actor_student_id: str,
    roles: list[str],
) -> models.Member:
    """회원 역할 변경 (승격/강등).

    보호 로직:
    - 마지막 super_admin 제거 불가
    - self-demotion 불가
    """
    member = await members_repo.get_member(db, member_id)
    target_student_id = str(member.student_id)
    previous_roles_raw = str(member.roles)
    previous_profile = parse_roles(previous_roles_raw)
    normalized_roles = normalize_assignable_roles(roles)

    # self-demotion 방어
    if (
        target_student_id == actor_student_id
        and previous_profile.grade == "super_admin"
        and "super_admin" not in normalized_roles
    ):
        raise ApiError(
            code="self_demotion_forbidden",
            detail="Cannot remove super_admin from yourself",
            status=422,
        )

    # 마지막 super_admin 제거 방어
    if (
        previous_profile.grade == "super_admin"
        and "super_admin" not in normalized_roles
    ):
        super_admin_count = await members_repo.count_active_members_with_role(
            db,
            role="super_admin",
            serialize_super_admin_changes=True,
        )
        if super_admin_count <= 1:
            raise ApiError(
                code="last_super_admin_forbidden",
                detail="Cannot remove the last super_admin",
                status=422,
            )

    serialized = serialize_roles(normalized_roles)
    updated = await members_repo.update_member_roles(
        db, member=member, roles=serialized
    )
    return updated


async def submit_directory_consent(
    db: AsyncSession, *, member_id: int, visibility: schemas.VisibilityLiteral
) -> models.Member:
    now = datetime.now(UTC)
    return await members_repo.save_directory_consent(
        db,
        member_id=member_id,
        visibility=models.Visibility(visibility),
        consented_at=None if visibility == "private" else now,
        choice_at=now,
    )

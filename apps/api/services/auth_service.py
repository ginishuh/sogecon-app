"""인증 서비스 계층.

세션 파싱/정규화, 권한 확인, 로그인/로그아웃 로직을 담당한다.
라우터는 이 서비스의 함수를 호출하여 인증 관련 작업을 수행한다.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from http import HTTPStatus
from typing import Any, cast

from fastapi import Depends, HTTPException, Request
from slowapi import Limiter
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..config import get_settings
from ..db import get_db
from ..errors import ApiError, NotFoundError
from ..passwords import hash_password, verify_password
from ..ratelimit import consume_limit, get_client_ip_for_rate_limit
from ..repositories import auth as auth_repo
from ..repositories import members as members_repo
from ..repositories import signup_requests as signup_requests_repo
from .activation_service import (
    load_activation_payload,
    resolve_activation_member,
    resolve_activation_signup_request,
)
from .roles_service import ensure_member_role, has_permission, normalize_roles

# 로그인 레이트리밋 (slowapi)
limiter_login = Limiter(key_func=get_client_ip_for_rate_limit)


# ---- 세션 데이터 클래스 ----


@dataclass
class CurrentAdmin:
    """관리자 세션 정보."""
    id: int
    email: str
    student_id: str


@dataclass
class CurrentMember:
    """멤버 세션 정보."""
    student_id: str
    id: int | None = None


@dataclass
class CurrentUser:
    """통합 세션 정보."""
    student_id: str
    roles: list[str]
    id: int | None = None
    email: str | None = None


# ---- 세션 파싱/정규화 ----


def _get_user_session(req: Request) -> CurrentUser | None:
    """통합 user 세션 파싱."""
    raw: Any = req.session.get("user")
    data = cast("dict[str, object] | None", raw)
    if isinstance(data, dict):
        sid = data.get("student_id")
        roles = normalize_roles(data.get("roles"))
        mid = data.get("id")
        email = data.get("email")
        if isinstance(sid, str) and sid:
            _id = int(mid) if isinstance(mid, (int, str)) else None
            _email = email if isinstance(email, str) else None
            return CurrentUser(student_id=sid, roles=roles, id=_id, email=_email)
    return None


def _set_user_session(
    req: Request,
    *,
    student_id: str,
    roles: list[str],
    id: int | None = None,
    email: str | None = None,
) -> None:
    """통합 세션(user) 설정.

    모든 인증은 MemberAuth를 통하며, user 키에 통합 저장한다.
    """
    req.session["user"] = {
        "student_id": student_id,
        "roles": roles,
        "id": id,
        "email": email,
    }


def _clear_session(req: Request) -> None:
    """세션 키 제거 (레거시 키 포함)."""
    req.session.pop("user", None)
    # 레거시 세션 키도 정리 (기존 세션 무효화용)
    req.session.pop("member", None)
    req.session.pop("admin", None)


async def _refresh_user_session(
    db: AsyncSession,
    req: Request,
    user: CurrentUser,
) -> tuple[CurrentUser, models.Member]:
    """DB의 현재 회원·역할을 세션에 반영한다."""
    try:
        member = await members_repo.get_member_by_student_id(db, user.student_id)
    except NotFoundError:
        _clear_session(req)
        raise HTTPException(status_code=401, detail="unauthorized") from None
    if cast(str, member.status) != "active":
        _clear_session(req)
        raise HTTPException(status_code=401, detail="unauthorized")

    refreshed = CurrentUser(
        student_id=cast(str, member.student_id),
        roles=ensure_member_role(normalize_roles(member.roles)),
        id=cast(int, member.id),
        email=cast(str | None, member.email),
    )
    if refreshed != user:
        _set_user_session(
            req,
            student_id=refreshed.student_id,
            roles=refreshed.roles,
            id=refreshed.id,
            email=refreshed.email,
        )
    return refreshed, member


# ---- 권한 확인 의존성 ----


async def require_admin(
    req: Request,
    db: AsyncSession = Depends(get_db),
) -> CurrentAdmin:
    """관리자 권한 필요 의존성.

    통합 세션(`user`)에 roles 'admin' 또는 'super_admin'이 포함되어야 한다.
    """
    user = _get_user_session(req)
    if user is not None:
        user, _member = await _refresh_user_session(db, req, user)
        if "admin" not in user.roles and "super_admin" not in user.roles:
            raise HTTPException(status_code=403, detail="admin_required")
        email = user.email or user.student_id
        return CurrentAdmin(
            id=user.id if isinstance(user.id, int) else 0,
            email=email,
            student_id=user.student_id,
        )
    raise HTTPException(status_code=401, detail="unauthorized")


def require_permission(
    permission: str,
    *,
    allow_admin_fallback: bool = True,
) -> Callable[..., Awaitable[CurrentUser]]:
    return require_any_permission(
        (permission,), allow_admin_fallback=allow_admin_fallback
    )


def require_any_permission(
    permissions: Sequence[str],
    *,
    allow_admin_fallback: bool = True,
) -> Callable[..., Awaitable[CurrentUser]]:
    """기능권한 의존성 팩토리.

    - `super_admin`은 항상 통과.
    - roles에 지정된 permission 중 하나가 있으면 통과.
    - `allow_admin_fallback=True`이면 기존 `admin` 등급도 임시 통과.
    """

    required_permissions = tuple(permissions)
    if not required_permissions:
        raise ValueError("at least one permission is required")

    async def _dependency(
        req: Request,
        db: AsyncSession = Depends(get_db),
    ) -> CurrentUser:
        user = _get_user_session(req)
        if user is not None:
            user, _member = await _refresh_user_session(db, req, user)
            if any(
                has_permission(
                    user.roles,
                    permission,
                    allow_admin_fallback=allow_admin_fallback,
                )
                for permission in required_permissions
            ):
                return user
            raise HTTPException(status_code=403, detail="admin_permission_required")
        raise HTTPException(status_code=401, detail="unauthorized")

    return _dependency


async def require_super_admin(
    req: Request,
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    """super_admin 권한 필요 의존성."""
    user = _get_user_session(req)
    if user is not None:
        user, _member = await _refresh_user_session(db, req, user)
        if "super_admin" in user.roles:
            return user
        raise HTTPException(status_code=403, detail="super_admin_required")
    raise HTTPException(status_code=401, detail="unauthorized")


async def is_admin(db: AsyncSession, req: Request) -> bool:
    """현재 DB 상태 기준 관리자 여부를 반환한다.

    공개 경로에서 선택적으로 관리자 기능을 허용하는 용도이므로, 삭제·정지된
    세션은 제거한 뒤 익명 사용자와 동일하게 ``False``를 반환한다.
    """
    user = _get_user_session(req)
    if user is None:
        return False
    try:
        user, _member = await _refresh_user_session(db, req, user)
    except HTTPException as exc:
        if exc.status_code == HTTPStatus.UNAUTHORIZED:
            return False
        raise
    return "admin" in user.roles or "super_admin" in user.roles


async def require_member(
    req: Request,
    db: AsyncSession = Depends(get_db),
) -> CurrentMember:
    """멤버 권한 필요 의존성.

    통합 세션(`user`)에 roles 'member' 또는 'admin' 또는 'super_admin'이
    포함되면 통과.
    """
    user = _get_user_session(req)
    if user is not None:
        user, _member = await _refresh_user_session(db, req, user)
        if not (
            "member" in user.roles
            or "admin" in user.roles
            or "super_admin" in user.roles
        ):
            raise HTTPException(status_code=403, detail="member_required")
        return CurrentMember(
            student_id=user.student_id,
            id=user.id if isinstance(user.id, int) else None,
        )
    raise HTTPException(status_code=401, detail="unauthorized")


# ---- 로그인/로그아웃 서비스 ----


async def login_member(
    db: AsyncSession,
    request: Request,
    student_id: str,
    password: str,
    *,
    skip_rate_limit: bool = False,
) -> dict[str, str]:
    """멤버 로그인 처리.

    Args:
        skip_rate_limit: True면 레이트리밋 건너뜀 (상위 라우터에서 이미 차감한 경우)
    """
    if not skip_rate_limit:
        settings = get_settings()
        consume_limit(limiter_login, request, settings.rate_limit_login)

    member, creds = await auth_repo.get_member_with_auth_by_student_id(db, student_id)
    if member is None or creds is None:
        raise ApiError(code="login_failed", detail="login_failed", status=401)
    if not verify_password(password, cast(str, creds.password_hash)):
        raise ApiError(code="login_failed", detail="login_failed", status=401)
    if cast(str, member.status) == "pending":
        raise ApiError(
            code="member_pending_approval",
            detail="member_pending_approval",
            status=403,
        )
    if cast(str, member.status) != "active":
        raise ApiError(code="member_not_active", detail="member_not_active", status=403)

    roles = ensure_member_role(normalize_roles(member.roles))
    sid_raw: object = cast(object, member.student_id)
    if not (isinstance(sid_raw, str) and sid_raw):
        raise HTTPException(status_code=500, detail="invalid_member_student_id")

    _set_user_session(
        request,
        student_id=sid_raw,
        roles=roles,
        id=cast(int, member.id),
        email=cast(str | None, member.email),
    )
    return {"ok": "true"}


def logout(request: Request) -> None:
    """로그아웃 처리 (세션 제거)."""
    _clear_session(request)


async def activate_member(
    db: AsyncSession,
    request: Request,
    token: str,
    password: str,
) -> dict[str, str]:
    """멤버 활성화: 승인 기반 토큰 검증 후 비밀번호 설정."""
    settings = get_settings()
    consume_limit(limiter_login, request, settings.rate_limit_login)

    payload = load_activation_payload(token)
    row = await resolve_activation_signup_request(db, payload)
    member = await resolve_activation_member(db, payload.student_id)

    # 비밀번호 해시 생성 및 저장
    pwd_hash = hash_password(password)
    await auth_repo.create_or_update_member_auth(
        db,
        member_id=cast(int, member.id),
        student_id=cast(str, member.student_id),
        password_hash=pwd_hash,
    )
    setattr(row, "status", "activated")
    setattr(row, "activated_at", datetime.now(tz=UTC))
    await signup_requests_repo.save_signup_request(db, row)

    # 세션 로그인 처리
    _set_user_session(
        request,
        student_id=cast(str, member.student_id),
        roles=ensure_member_role(normalize_roles(cast(str, member.roles))),
        id=cast(int, member.id),
        email=cast(str | None, member.email),
    )
    return {"ok": "true"}


async def change_member_password(
    db: AsyncSession,
    request: Request,
    member: CurrentMember,
    current_password: str,
    new_password: str,
) -> dict[str, str]:
    """멤버 비밀번호 변경."""
    settings = get_settings()
    consume_limit(limiter_login, request, settings.rate_limit_login)

    auth_row = await auth_repo.get_member_auth_by_student_id(db, member.student_id)

    if auth_row is None:
        raise HTTPException(status_code=401, detail="unauthorized")
    if not verify_password(current_password, cast(str, auth_row.password_hash)):
        raise HTTPException(status_code=401, detail="login_failed")

    new_hash = hash_password(new_password)
    await auth_repo.update_member_auth_password(db, auth_row, new_hash)
    return {"ok": "true"}


async def get_member_email(
    db: AsyncSession,
    request: Request,
    member: CurrentMember,
) -> dict[str, str]:
    """멤버 이메일 조회 (세션에 없으면 DB에서 보강)."""
    u = _get_user_session(request)
    if u and isinstance(u.email, str):
        return {"email": u.email}

    member_row = await members_repo.get_member_by_student_id(db, member.student_id)
    email = member_row.email if member_row and isinstance(member_row.email, str) else ""
    return {"email": email}


async def get_session_info(
    db: AsyncSession,
    request: Request,
) -> dict[str, object]:
    """통합 세션 조회."""
    u = _get_user_session(request)
    if u:
        u, member = await _refresh_user_session(db, request, u)
        kind = (
            "admin"
            if ("admin" in u.roles or "super_admin" in u.roles)
            else "member"
        )
        email = u.email or (member.email if isinstance(member.email, str) else "")
        name = member.name if isinstance(member.name, str) else ""
        member_id = cast(int, member.id)
        return {
            "kind": kind,
            "student_id": u.student_id,
            "email": email or "",
            "name": name,
            "id": member_id,
            "roles": u.roles,
        }

    raise HTTPException(status_code=401, detail="unauthorized")

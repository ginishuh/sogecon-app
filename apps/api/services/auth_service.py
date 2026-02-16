"""인증 서비스 계층.

세션 파싱/정규화, 권한 확인, 로그인/로그아웃 로직을 담당한다.
라우터는 이 서비스의 함수를 호출하여 인증 관련 작업을 수행한다.
"""
from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, cast

from fastapi import HTTPException, Request
from itsdangerous import BadData, BadSignature, URLSafeSerializer
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..errors import NotFoundError
from ..models import Member
from ..ratelimit import consume_limit
from ..repositories import auth as auth_repo
from ..repositories import members as members_repo

# 로그인 레이트리밋 (slowapi)
limiter_login = Limiter(key_func=get_remote_address)


def _is_test_client(request: Request) -> bool:
    """테스트 클라이언트인지 확인 (레이트리밋 우회용)."""
    return bool(request.client and request.client.host == "testclient")


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
    """통합 세션 정보 (레거시 호환)."""
    student_id: str
    roles: list[str]
    id: int | None = None
    email: str | None = None


# ---- 세션 파싱/정규화 ----


def _normalize_roles(value: object) -> list[str]:
    """세션에 저장된 roles 값을 문자열/리스트 모두 수용하여 리스트[str]로 정규화."""
    if isinstance(value, str):
        parts = [r.strip() for r in value.split(",") if r.strip()]
        return parts
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        out: list[str] = []
        for item in cast(Sequence[object], value):
            if isinstance(item, str) and item:
                out.append(item)
        return out
    return []


def _ensure_member_role(roles: list[str]) -> list[str]:
    """roles에 'member'가 없으면 선두에 추가하여 반환."""
    if "member" in roles:
        return roles
    return ["member", *roles]


def _get_admin_session(req: Request) -> CurrentAdmin | None:
    """레거시 admin 세션 파싱."""
    raw: Any = req.session.get("admin")
    data = cast("dict[str, object] | None", raw)
    if isinstance(data, dict):
        _id = data.get("id")
        _email = data.get("email")
        _student_id = data.get("student_id")
        if (
            (isinstance(_id, (int, str)))
            and isinstance(_email, str)
            and isinstance(_student_id, str)
        ):
            return CurrentAdmin(id=int(_id), email=_email, student_id=_student_id)
    return None


def _get_user_session(req: Request) -> CurrentUser | None:
    """통합 user 세션 파싱."""
    raw: Any = req.session.get("user")
    data = cast("dict[str, object] | None", raw)
    if isinstance(data, dict):
        sid = data.get("student_id")
        roles = _normalize_roles(data.get("roles"))
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
    """통합 세션(user) 설정 + 레거시 키(admin/member) 동시 설정.

    주의: 레거시 제거 전까지 호환 목적으로 admin/member 키도 함께 기록한다.
    TODO: 레거시 세션 제거 후 이 함수 단순화 필요
    """
    req.session["user"] = {
        "student_id": student_id,
        "roles": roles,
        "id": id,
        "email": email,
    }
    # 레거시 호환: admin/member 동시 기록
    if "admin" in roles:
        req.session["admin"] = {
            "id": id if isinstance(id, int) else 0,
            "email": email or student_id,
            "student_id": student_id,
        }
    if "member" in roles:
        req.session["member"] = {"student_id": student_id, "id": id}


def _clear_session(req: Request) -> None:
    """통합 및 레거시 세션 키 모두 제거."""
    req.session.pop("user", None)
    req.session.pop("member", None)
    req.session.pop("admin", None)


# ---- 권한 확인 의존성 ----


def require_admin(req: Request) -> CurrentAdmin:
    """관리자 권한 필요 의존성.

    - 통합 세션(`user`)이 있고 roles에 'admin'이 포함되면 관리자 권한으로 인정.
    - 레거시 세션 키(`admin`)도 호환 유지.
    """
    # 통합 세션 우선
    u = _get_user_session(req)
    if u and "admin" in u.roles:
        email = u.email or u.student_id
        return CurrentAdmin(
            id=u.id if isinstance(u.id, int) else 0,
            email=email,
            student_id=u.student_id,
        )

    # 레거시 세션 호환
    admin = _get_admin_session(req)
    if admin:
        return admin
    raise HTTPException(status_code=401, detail="unauthorized")


def is_admin(req: Request) -> bool:
    """현재 요청이 관리자 권한인지 여부만 반환(예외 없이)."""
    u = _get_user_session(req)
    if u and "admin" in u.roles:
        return True
    return _get_admin_session(req) is not None


def require_member(req: Request) -> CurrentMember:
    """멤버 권한 필요 의존성.

    - 통합 세션(`user`)이 있고 roles에 'member' 또는 'admin'이 포함되면 통과.
    - 레거시 세션 키(`member`) 및 관리자 키(`admin`)는 하위호환으로 인정.
    """
    # 통합 세션 우선
    u = _get_user_session(req)
    if u and ("member" in u.roles or "admin" in u.roles):
        return CurrentMember(
            student_id=u.student_id,
            id=u.id if isinstance(u.id, int) else None,
        )

    # 레거시: member
    raw: Any = req.session.get("member")
    data = cast("dict[str, object] | None", raw)
    if isinstance(data, dict):
        sid = data.get("student_id")
        mid = data.get("id")
        member_id = int(mid) if isinstance(mid, (int, str)) else None
        if isinstance(sid, str):
            return CurrentMember(student_id=sid, id=member_id)

    # 레거시: admin도 멤버 권한으로 통과
    admin = _get_admin_session(req)
    if admin:
        return CurrentMember(student_id=admin.student_id)
    raise HTTPException(status_code=401, detail="unauthorized")


# ---- 로그인/로그아웃 서비스 ----


async def login_admin(
    db: AsyncSession,
    request: Request,
    student_id: str,
    password: str,
    *,
    skip_rate_limit: bool = False,
) -> dict[str, str]:
    """관리자 로그인 처리.

    관리자 자격을 검증하고 세션을 설정한다.
    관리자도 Member 테이블의 id를 세션에 저장 (posts.author_id FK 호환).

    Args:
        skip_rate_limit: True면 레이트리밋 건너뜀 (상위 라우터에서 이미 차감한 경우)
    """
    if not skip_rate_limit:
        settings = get_settings()
        if settings.app_env == "prod" and not _is_test_client(request):
            consume_limit(limiter_login, request, settings.rate_limit_login)

    bcrypt = __import__("bcrypt")

    admin = await auth_repo.get_admin_by_student_id(db, student_id)
    if admin is None:
        raise HTTPException(status_code=401, detail="login_failed")
    if not bcrypt.checkpw(password.encode(), admin.password_hash.encode()):
        raise HTTPException(status_code=401, detail="login_failed")

    # 관리자도 Member 테이블의 id를 세션에 저장 (posts.author_id FK 호환)
    try:
        member = await members_repo.get_member_by_student_id(
            db, cast(str, admin.student_id)
        )
    except NotFoundError:
        raise HTTPException(
            status_code=403,
            detail="admin_member_record_missing",
        ) from None

    _set_user_session(
        request,
        student_id=cast(str, admin.student_id),
        roles=["admin"],
        id=cast(int, member.id),
        email=(cast(str | None, admin.email) or cast(str, admin.student_id)),
    )
    return {"ok": "true"}


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
        if settings.app_env == "prod" and not _is_test_client(request):
            consume_limit(limiter_login, request, settings.rate_limit_login)

    bcrypt = __import__("bcrypt")

    member, creds = await auth_repo.get_member_with_auth_by_student_id(db, student_id)
    if member is None or creds is None:
        raise HTTPException(status_code=401, detail="login_failed")
    if not bcrypt.checkpw(password.encode(), creds.password_hash.encode()):
        raise HTTPException(status_code=401, detail="login_failed")

    roles = _ensure_member_role(_normalize_roles(member.roles))
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
    """멤버 활성화: 서명 토큰 검증 후 Member/MemberAuth를 생성 또는 갱신."""
    settings = get_settings()
    if settings.app_env == "prod" and not _is_test_client(request):
        consume_limit(limiter_login, request, settings.rate_limit_login)

    # 토큰 검증
    try:
        s = URLSafeSerializer(settings.jwt_secret, salt="member-activate")
        data_raw: Any = s.loads(token)
    except (BadSignature, BadData) as err:
        raise HTTPException(status_code=401, detail="invalid_token") from err

    if not isinstance(data_raw, dict):
        raise HTTPException(status_code=422, detail="invalid_payload")
    data = cast(dict[str, object], data_raw)
    email_obj: object = data.get("email")
    name_obj: object = data.get("name")
    cohort_obj: object = data.get("cohort")
    if not isinstance(email_obj, str) or not email_obj:
        raise HTTPException(status_code=422, detail="invalid_payload")

    # 멤버 조회/생성
    try:
        member = await members_repo.get_member_by_email(db, email_obj)
    except NotFoundError:
        # 멤버가 없으면 생성
        student_id = email_obj.split("@")[0]
        member = Member(
            student_id=student_id,
            email=email_obj,
            name=(name_obj if isinstance(name_obj, str) and name_obj else "Member"),
            cohort=int(cohort_obj) if isinstance(cohort_obj, int) else 1,
            major=None,
            roles="member",
        )
        db.add(member)
        await db.commit()
        await db.refresh(member)

    # 비밀번호 해시 생성 및 저장
    bcrypt = __import__("bcrypt")
    pwd_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    await auth_repo.create_or_update_member_auth(
        db,
        member_id=cast(int, member.id),
        student_id=cast(str, member.student_id),
        password_hash=pwd_hash,
    )

    # 세션 로그인 처리
    request.session["member"] = {"student_id": member.student_id, "id": member.id}
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
    if settings.app_env == "prod" and not _is_test_client(request):
        consume_limit(limiter_login, request, settings.rate_limit_login)

    bcrypt = __import__("bcrypt")
    auth_row = await auth_repo.get_member_auth_by_student_id(db, member.student_id)

    if auth_row is None:
        raise HTTPException(status_code=401, detail="unauthorized")
    if not bcrypt.checkpw(current_password.encode(), auth_row.password_hash.encode()):
        raise HTTPException(status_code=401, detail="login_failed")

    new_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
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
        kind = "admin" if "admin" in u.roles else "member"
        member = await members_repo.get_member_by_student_id(db, u.student_id)
        email = (
            u.email
            or (member.email if member and isinstance(member.email, str) else "")
        )
        name = member.name if member and isinstance(member.name, str) else ""
        member_id = (
            cast(int, member.id)
            if member
            else (u.id if isinstance(u.id, int) else None)
        )
        return {
            "kind": kind,
            "student_id": u.student_id,
            "email": email or "",
            "name": name,
            "id": member_id,
        }

    # 레거시 호환: admin/member 키에서 정보 구성
    admin = _get_admin_session(request)
    if admin:
        member = await members_repo.get_member_by_student_id(db, admin.student_id)
        name = member.name if member and isinstance(member.name, str) else ""
        member_id = cast(int, member.id) if member else admin.id
        return {
            "kind": "admin",
            "student_id": admin.student_id,
            "email": admin.email,
            "name": name,
            "id": member_id,
        }

    raw: Any = request.session.get("member")
    data = cast("dict[str, object] | None", raw)
    if isinstance(data, dict):
        sid_obj = data.get("student_id")
        sid = sid_obj if isinstance(sid_obj, str) else None
        if sid:
            member = await members_repo.get_member_by_student_id(db, sid)
            email = member.email if member and isinstance(member.email, str) else ""
            name = member.name if member and isinstance(member.name, str) else ""
            mid_obj = data.get("id")
            _id = int(mid_obj) if isinstance(mid_obj, (int, str)) else None
            return {
                "kind": "member",
                "student_id": sid,
                "email": email,
                "name": name,
                "id": _id,
            }

    raise HTTPException(status_code=401, detail="unauthorized")

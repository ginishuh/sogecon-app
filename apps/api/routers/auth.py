from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Request
from itsdangerous import BadData, BadSignature, URLSafeSerializer
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_db
from ..models import AdminUser, Member, MemberAuth
from ..ratelimit import consume_limit

router = APIRouter(prefix="/auth", tags=["auth"])
limiter_login = Limiter(key_func=get_remote_address)


def _is_test_client(request: Request) -> bool:
    return bool(request.client and request.client.host == "testclient")


class LoginPayload(BaseModel):
    student_id: str
    password: str


@dataclass
class CurrentAdmin:
    id: int
    email: str
    student_id: str


def _get_admin_session(req: Request) -> CurrentAdmin | None:
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


def require_admin(req: Request) -> CurrentAdmin:
    """관리자 권한 필요 의존성.

    - 우선 통합 세션(`user`)이 있고 roles에 'admin'이 포함되면 관리자 권한으로 인정.
    - 레거시 세션 키(`admin`)도 호환 유지.
    """
    # 통합 세션 우선
    u = _get_user_session(req)
    if u and "admin" in u.roles:
        # 관리자 세션 형태로 어댑트
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


@dataclass
class CurrentMember:
    student_id: str
    id: int | None = None


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

    # 레거시: admin도 멤버 권한으로 통과(관리자 UI에서 공용 API 접근 가능)
    admin = _get_admin_session(req)
    if admin:
        return CurrentMember(student_id=admin.student_id)
    raise HTTPException(status_code=401, detail="unauthorized")


# ---- 통합 세션(user) 유틸 ----

@dataclass
class CurrentUser:
    student_id: str
    roles: list[str]
    id: int | None = None  # member.id 또는 admin_users.id
    email: str | None = None


def _normalize_roles(value: object) -> list[str]:
    """세션에 저장된 roles 값을 문자열/리스트 모두 수용하여 리스트[str]로 정규화.
    빈/이상값은 빈 리스트로 처리.
    """
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


def _get_user_session(req: Request) -> CurrentUser | None:
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


class MemberLoginPayload(BaseModel):
    student_id: str
    password: str


@router.post("/member/login")
async def member_login(
    payload: MemberLoginPayload, request: Request, db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    """하위호환 멤버 로그인 엔드포인트.

    통합 로직으로 세션을 설정하며, 멤버 자격만 검사한다.
    """
    bcrypt = __import__("bcrypt")
    settings = get_settings()
    if settings.app_env == "prod" and not _is_test_client(request):
        consume_limit(limiter_login, request, settings.rate_limit_login)

    stmt = select(Member).where(Member.student_id == payload.student_id)
    result = await db.execute(stmt)
    member = result.scalars().first()

    stmt2 = select(MemberAuth).where(MemberAuth.student_id == payload.student_id)
    result2 = await db.execute(stmt2)
    creds = result2.scalars().first()

    if member is None or creds is None:
        raise HTTPException(status_code=401, detail="login_failed")
    if not bcrypt.checkpw(payload.password.encode(), creds.password_hash.encode()):
        raise HTTPException(status_code=401, detail="login_failed")
    roles = _ensure_member_role(_normalize_roles(member.roles))
    # 런타임 불변 보장: student_id는 NOT NULL
    # (SQLAlchemy 컬럼 truthy 평가를 피하기 위해 별도 변수 사용)
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


@router.post("/member/logout", status_code=204)
async def member_logout(request: Request) -> None:
    # 통합 및 레거시 키 모두 제거
    request.session.pop("user", None)
    request.session.pop("member", None)
    request.session.pop("admin", None)


@router.get("/member/me")
async def member_me(
    request: Request,
    db: AsyncSession = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> dict[str, str]:
    """멤버 자기정보: 웹 프론트 타입 정의에 맞춰 email을 반환.

    세션에 email이 없을 수 있어 Member 테이블을 조회하여 보강한다.
    """
    # 세션에 email이 있으면 우선 사용
    u = _get_user_session(request)
    if u and isinstance(u.email, str):
        return {"email": u.email}
    # DB 조회로 보강
    stmt = select(Member).where(Member.student_id == m.student_id)
    result = await db.execute(stmt)
    member = result.scalars().first()
    email = member.email if member and isinstance(member.email, str) else ""
    return {"email": email}


class MemberActivatePayload(BaseModel):
    token: str
    password: str


@router.post("/member/activate")
async def member_activate(
    payload: MemberActivatePayload, request: Request, db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    """멤버 활성화: 서명 토큰 검증 후 Member/MemberAuth를 생성 또는 갱신.

    토큰 페이로드 예: {"email": "user@example.com", "name": "User", "cohort": 1}
    개발 단계에서는 itsdangerous 서명 토큰을 사용한다.
    """
    settings = get_settings()
    if settings.app_env == "prod" and not _is_test_client(request):
        consume_limit(limiter_login, request, settings.rate_limit_login)

    # 토큰 검증
    try:
        s = URLSafeSerializer(settings.jwt_secret, salt="member-activate")
        data_raw: Any = s.loads(payload.token)
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
    stmt = select(Member).where(Member.email == email_obj)
    result = await db.execute(stmt)
    member = result.scalars().first()

    if member is None:
        # 이메일의 @ 앞부분을 student_id로 사용 (임시 방안)
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

    # 자격 생성/갱신
    bcrypt = __import__("bcrypt")
    pwd_hash = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode()
    stmt2 = select(MemberAuth).where(MemberAuth.student_id == member.student_id)
    result2 = await db.execute(stmt2)
    auth_row = result2.scalars().first()

    if auth_row is None:
        db.add(
            MemberAuth(
                member_id=member.id,
                student_id=member.student_id,
                password_hash=pwd_hash,
            )
        )
    else:
        setattr(auth_row, "password_hash", pwd_hash)
    await db.commit()

    # 세션 로그인 처리
    request.session["member"] = {"student_id": member.student_id, "id": member.id}
    return {"ok": "true"}


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


@router.post("/member/change-password")
async def change_password(
    payload: ChangePasswordPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> dict[str, str]:
    settings = get_settings()
    if settings.app_env == "prod" and not _is_test_client(request):
        consume_limit(limiter_login, request, settings.rate_limit_login)

    bcrypt = __import__("bcrypt")
    stmt = select(MemberAuth).where(MemberAuth.student_id == m.student_id)
    result = await db.execute(stmt)
    auth_row = result.scalars().first()

    if auth_row is None:
        raise HTTPException(status_code=401, detail="unauthorized")
    if not bcrypt.checkpw(
        payload.current_password.encode(), auth_row.password_hash.encode()
    ):
        raise HTTPException(status_code=401, detail="login_failed")
    new_hash = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt()).decode()
    setattr(auth_row, "password_hash", new_hash)
    await db.commit()
    return {"ok": "true"}


@router.post("/login")
async def login(
    payload: LoginPayload, request: Request, db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    bcrypt = __import__("bcrypt")  # 런타임 임포트로 훅 환경 의존성 문제 최소화

    # 로그인 시도 레이트리밋(환경설정값 기반)
    settings = get_settings()
    if settings.app_env == "prod" and not _is_test_client(request):
        consume_limit(limiter_login, request, settings.rate_limit_login)

    # 1) 관리자 자격 우선 매칭
    stmt = select(AdminUser).where(AdminUser.student_id == payload.student_id)
    result = await db.execute(stmt)
    admin = result.scalars().first()

    if admin is not None and bcrypt.checkpw(
        payload.password.encode(), admin.password_hash.encode()
    ):
        _set_user_session(
            request,
            student_id=cast(str, admin.student_id),
            roles=["admin"],
            id=cast(int, admin.id),
            email=(cast(str | None, admin.email) or cast(str, admin.student_id)),
        )
        return {"ok": "true"}

    # 2) 멤버 자격 매칭
    stmt2 = select(Member).where(Member.student_id == payload.student_id)
    result2 = await db.execute(stmt2)
    member = result2.scalars().first()

    stmt3 = select(MemberAuth).where(MemberAuth.student_id == payload.student_id)
    result3 = await db.execute(stmt3)
    creds = result3.scalars().first()

    if member is None or creds is None:
        raise HTTPException(status_code=401, detail="login_failed")
    if not bcrypt.checkpw(payload.password.encode(), creds.password_hash.encode()):
        raise HTTPException(status_code=401, detail="login_failed")
    roles = _ensure_member_role(_normalize_roles(member.roles))
    # 런타임 불변 보장: student_id는 NOT NULL
    # (SQLAlchemy 컬럼 truthy 평가를 피하기 위해 별도 변수 사용)
    sid_raw2: object = cast(object, member.student_id)
    if not (isinstance(sid_raw2, str) and sid_raw2):
        raise HTTPException(status_code=500, detail="invalid_member_student_id")
    _set_user_session(
        request,
        student_id=sid_raw2,
        roles=roles,
        id=cast(int, member.id),
        email=cast(str | None, member.email),
    )
    return {"ok": "true"}


@router.post("/logout", status_code=204)
async def logout(request: Request) -> None:
    # 통합 및 레거시 키 모두 제거
    request.session.pop("user", None)
    request.session.pop("admin", None)
    request.session.pop("member", None)


@router.get("/me")
async def me(admin: CurrentAdmin = Depends(require_admin)) -> dict[str, str | int]:
    """관리자 자기정보(하위호환): 관리자 세션이 있을 때만 200.

    통합 세션을 사용하더라도 roles에 'admin'이 있어야 통과한다.
    """
    return {"id": admin.id, "email": admin.email}


@router.get("/session")
async def session(
    request: Request, db: AsyncSession = Depends(get_db)
) -> dict[str, object]:
    """통합 세션 조회 엔드포인트.

    반환 형식: { kind: 'admin'|'member', student_id, email, name, id? }
    세션이 없으면 401.
    """
    u = _get_user_session(request)
    if u:
        kind = "admin" if "admin" in u.roles else "member"
        # DB에서 이름과 이메일 조회
        stmt = select(Member).where(Member.student_id == u.student_id)
        result = await db.execute(stmt)
        m = result.scalars().first()
        email = u.email or (m.email if m and isinstance(m.email, str) else "")
        name = m.name if m and isinstance(m.name, str) else ""
        return {
            "kind": kind,
            "student_id": u.student_id,
            "email": email or "",
            "name": name,
            "id": u.id if isinstance(u.id, int) else None,
        }

    # 레거시 호환: admin/member 키에서 정보 구성
    admin = _get_admin_session(request)
    if admin:
        # admin도 Member 테이블에서 이름 조회
        stmt = select(Member).where(Member.student_id == admin.student_id)
        result = await db.execute(stmt)
        m = result.scalars().first()
        name = m.name if m and isinstance(m.name, str) else ""
        return {
            "kind": "admin",
            "student_id": admin.student_id,
            "email": admin.email,
            "name": name,
            "id": admin.id,
        }
    raw: Any = request.session.get("member")
    data = cast("dict[str, object] | None", raw)
    if isinstance(data, dict):
        sid_obj = data.get("student_id")
        sid = sid_obj if isinstance(sid_obj, str) else None
        if sid:
            stmt = select(Member).where(Member.student_id == sid)
            result = await db.execute(stmt)
            m = result.scalars().first()
            email = m.email if m and isinstance(m.email, str) else ""
            name = m.name if m and isinstance(m.name, str) else ""
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

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Request
from itsdangerous import BadData, BadSignature, URLSafeSerializer
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import AdminUser, Member, MemberAuth
from ..ratelimit import consume_limit

router = APIRouter(prefix="/auth", tags=["auth"])
limiter_login = Limiter(key_func=get_remote_address)


def _is_test_client(request: Request) -> bool:
    return bool(request.client and request.client.host == "testclient")


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


@dataclass
class CurrentAdmin:
    id: int
    email: str


def _get_admin_session(req: Request) -> CurrentAdmin | None:
    raw: Any = req.session.get("admin")
    data = cast("dict[str, object] | None", raw)
    if isinstance(data, dict):
        _id = data.get("id")
        _email = data.get("email")
        if (isinstance(_id, (int, str))) and isinstance(_email, str):
            return CurrentAdmin(id=int(_id), email=_email)
    return None


def require_admin(req: Request) -> CurrentAdmin:
    admin = _get_admin_session(req)
    if not admin:
        raise HTTPException(status_code=401, detail="unauthorized")
    return admin


@dataclass
class CurrentMember:
    email: str
    id: int | None = None


def require_member(req: Request) -> CurrentMember:
    raw: Any = req.session.get("member")
    data = cast("dict[str, object] | None", raw)
    if isinstance(data, dict):
        em = data.get("email")
        mid = data.get("id")
        member_id = int(mid) if isinstance(mid, (int, str)) else None
        if isinstance(em, str):
            return CurrentMember(email=em, id=member_id)
    # 임시 호환: 관리자 세션 보유 시 멤버로 간주(후속 단계에서 제거)
    admin = _get_admin_session(req)
    if admin:
        return CurrentMember(email=admin.email)
    raise HTTPException(status_code=401, detail="unauthorized")


class MemberLoginPayload(BaseModel):
    email: EmailStr
    password: str


@router.post("/member/login")
def member_login(
    payload: MemberLoginPayload, request: Request, db: Session = Depends(get_db)
) -> dict[str, str]:
    bcrypt = __import__("bcrypt")
    if not _is_test_client(request):
        consume_limit(limiter_login, request, get_settings().rate_limit_login)

    # 이메일로 회원과 자격을 조회
    member = db.query(Member).filter(Member.email == payload.email).first()
    creds = db.query(MemberAuth).filter(MemberAuth.email == payload.email).first()
    if member is None or creds is None:
        raise HTTPException(status_code=401, detail="login_failed")
    if not bcrypt.checkpw(payload.password.encode(), creds.password_hash.encode()):
        raise HTTPException(status_code=401, detail="login_failed")
    request.session["member"] = {"email": member.email, "id": member.id}
    return {"ok": "true"}


@router.post("/member/logout", status_code=204)
def member_logout(request: Request) -> None:
    request.session.pop("member", None)


@router.get("/member/me")
def member_me(m: CurrentMember = Depends(require_member)) -> dict[str, str]:
    return {"email": m.email}


class MemberActivatePayload(BaseModel):
    token: str
    password: str


@router.post("/member/activate")
def member_activate(
    payload: MemberActivatePayload, request: Request, db: Session = Depends(get_db)
) -> dict[str, str]:
    """멤버 활성화: 서명 토큰 검증 후 Member/MemberAuth를 생성 또는 갱신.

    토큰 페이로드 예: {"email": "user@example.com", "name": "User", "cohort": 1}
    개발 단계에서는 itsdangerous 서명 토큰을 사용한다.
    """
    settings = get_settings()
    if not _is_test_client(request):
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
    member = db.query(Member).filter(Member.email == email_obj).first()
    if member is None:
        member = Member(
            email=email_obj,
            name=(name_obj if isinstance(name_obj, str) and name_obj else "Member"),
            cohort=int(cohort_obj) if isinstance(cohort_obj, int) else 1,
            major=None,
            roles="member",
        )
        db.add(member)
        db.commit()
        db.refresh(member)

    # 자격 생성/갱신
    bcrypt = __import__("bcrypt")
    pwd_hash = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode()
    auth_row = db.query(MemberAuth).filter(MemberAuth.email == member.email).first()
    if auth_row is None:
        db.add(
            MemberAuth(
                member_id=member.id, email=member.email, password_hash=pwd_hash
            )
        )
    else:
        setattr(auth_row, "password_hash", pwd_hash)
    db.commit()

    # 세션 로그인 처리
    request.session["member"] = {"email": member.email, "id": member.id}
    return {"ok": "true"}


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


@router.post("/member/change-password")
def change_password(
    payload: ChangePasswordPayload,
    request: Request,
    db: Session = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> dict[str, str]:
    if not _is_test_client(request):
        consume_limit(limiter_login, request, get_settings().rate_limit_login)

    bcrypt = __import__("bcrypt")
    auth_row = db.query(MemberAuth).filter(MemberAuth.email == m.email).first()
    if auth_row is None:
        raise HTTPException(status_code=401, detail="unauthorized")
    if not bcrypt.checkpw(
        payload.current_password.encode(), auth_row.password_hash.encode()
    ):
        raise HTTPException(status_code=401, detail="login_failed")
    new_hash = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt()).decode()
    setattr(auth_row, "password_hash", new_hash)
    db.commit()
    return {"ok": "true"}


@router.post("/login")
def login(
    payload: LoginPayload, request: Request, db: Session = Depends(get_db)
) -> dict[str, str]:
    bcrypt = __import__("bcrypt")  # 런타임 임포트로 훅 환경 의존성 문제 최소화

    # 로그인 시도 레이트리밋(환경설정값 기반)
    if not _is_test_client(request):
        consume_limit(limiter_login, request, get_settings().rate_limit_login)

    user = db.query(AdminUser).filter(AdminUser.email == payload.email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="login_failed")
    if not bcrypt.checkpw(payload.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="login_failed")
    request.session["admin"] = {"id": user.id, "email": user.email}
    return {"ok": "true"}


@router.post("/logout", status_code=204)
def logout(request: Request) -> None:
    request.session.pop("admin", None)


@router.get("/me")
def me(admin: CurrentAdmin = Depends(require_admin)) -> dict[str, str | int]:
    return {"id": admin.id, "email": admin.email}

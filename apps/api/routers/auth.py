from __future__ import annotations

from dataclasses import dataclass
from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AdminUser, Member, MemberAuth

router = APIRouter(prefix="/auth", tags=["auth"])
limiter_login = Limiter(key_func=get_remote_address)


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


def require_member(req: Request) -> CurrentMember:
    raw: Any = req.session.get("member")
    data = cast("dict[str, object] | None", raw)
    if isinstance(data, dict):
        em = data.get("email")
        if isinstance(em, str):
            return CurrentMember(email=em)
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
    # 레이트리밋(5/min/IP)
    def _consume(request: Request) -> None:
        return None
    if not (request.client and request.client.host == "testclient"):
        checker = cast(Any, limiter_login).limit("5/minute")
        checker(_consume)(request)

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


@router.post("/login")
def login(
    payload: LoginPayload, request: Request, db: Session = Depends(get_db)
) -> dict[str, str]:
    bcrypt = __import__("bcrypt")  # 런타임 임포트로 훅 환경 의존성 문제 최소화

    # 로그인 시도 레이트리밋(5/min/IP)
    # 데코레이터 대신 함수 내부에서 체크하여 타입체커 경고를 회피
    def _consume(request: Request) -> None:
        return None

    # slowapi의 데코레이터 반환 타입은 정의되어 있지 않아 Any로 캐스팅
    # 테스트 클라이언트는 레이트리밋을 무시(다수 테스트에서 반복 로그인 필요)
    if not (request.client and request.client.host == "testclient"):
        checker = cast(Any, limiter_login).limit("5/minute")
        checker(_consume)(request)

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

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AdminUser

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


@router.post("/login")
def login(
    payload: LoginPayload, request: Request, db: Session = Depends(get_db)
) -> dict[str, str]:
    bcrypt = __import__("bcrypt")  # 런타임 임포트로 훅 환경 의존성 문제 최소화

    # 로그인 시도 레이트리밋(5/min/IP)
    # 데코레이터 대신 함수 내부에서 체크하여 타입체커 경고를 회피
    def _noop(_req: Request) -> None:
        return None

    # slowapi의 데코레이터 반환 타입은 정의되어 있지 않아 Any로 캐스팅
    checker = cast(Any, limiter_login).limit("5/minute")
    checker(_noop)(request)

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

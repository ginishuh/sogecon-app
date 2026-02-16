"""인증 라우터.

계층 구조: router -> service -> repository
- 라우팅과 의존성 주입만 담당
- 비즈니스 로직은 services.auth_service에 위임
- 다른 모듈에서 사용하는 의존성(require_admin, require_member, is_admin)은
  service에서 재export하여 import 경로 유지
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..services.auth_service import (
    CurrentAdmin,
    CurrentMember,
    activate_member,
    change_member_password,
    get_member_email,
    get_session_info,
    login_admin,
    login_member,
    logout,
    require_admin,
    require_member,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ---- 요청 페이로드 ----


class LoginPayload(BaseModel):
    student_id: str
    password: str


class MemberLoginPayload(BaseModel):
    student_id: str
    password: str


class MemberActivatePayload(BaseModel):
    token: str
    password: str


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


# ---- 통합 로그인/로그아웃 ----


@router.post("/login")
async def login(
    payload: LoginPayload, request: Request, db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    """통합 로그인 (관리자 우선, 실패 시 멤버 시도)."""
    # 관리자 로그인 시도
    try:
        return await login_admin(db, request, payload.student_id, payload.password)
    except HTTPException:
        pass
    # 멤버 로그인 시도
    return await login_member(db, request, payload.student_id, payload.password)


@router.post("/logout", status_code=204)
async def logout_endpoint(request: Request) -> None:
    """로그아웃 (세션 제거)."""
    logout(request)


@router.get("/me")
async def me(admin: CurrentAdmin = Depends(require_admin)) -> dict[str, str | int]:
    """관리자 자기정보 (하위호환)."""
    return {"id": admin.id, "email": admin.email}


# ---- 멤버 전용 엔드포인트 ----


@router.post("/member/login")
async def member_login(
    payload: MemberLoginPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """멤버 로그인."""
    return await login_member(db, request, payload.student_id, payload.password)


@router.post("/member/logout", status_code=204)
async def member_logout(request: Request) -> None:
    """멤버 로그아웃."""
    logout(request)


@router.get("/member/me")
async def member_me(
    request: Request,
    db: AsyncSession = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> dict[str, str]:
    """멤버 이메일 조회."""
    return await get_member_email(db, request, m)


@router.post("/member/activate")
async def member_activate_endpoint(
    payload: MemberActivatePayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """멤버 활성화 (토큰 검증 후 계정 생성/비밀번호 설정)."""
    return await activate_member(db, request, payload.token, payload.password)


@router.post("/member/change-password")
async def change_password(
    payload: ChangePasswordPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    m: CurrentMember = Depends(require_member),
) -> dict[str, str]:
    """비밀번호 변경."""
    return await change_member_password(
        db, request, m, payload.current_password, payload.new_password
    )


# ---- 세션 조회 ----


@router.get("/session")
async def session(
    request: Request, db: AsyncSession = Depends(get_db)
) -> dict[str, object]:
    """통합 세션 조회 (kind, student_id, email, name, id 반환)."""
    return await get_session_info(db, request)

"""인증 관련 데이터 액세스 계층.

세션/권한 확인은 service 계층에서 처리하며, 이 모듈은 DB 조회/저장만 담당한다.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AdminUser, Member, MemberAuth


async def get_admin_by_student_id(
    db: AsyncSession, student_id: str
) -> AdminUser | None:
    """학번으로 관리자 계정 조회."""
    stmt = select(AdminUser).where(AdminUser.student_id == student_id)
    result = await db.execute(stmt)
    return result.scalars().first()


async def get_member_with_auth_by_student_id(
    db: AsyncSession, student_id: str
) -> tuple[Member | None, MemberAuth | None]:
    """학번으로 멤버와 인증 정보를 함께 조회."""
    stmt_member = select(Member).where(Member.student_id == student_id)
    result_member = await db.execute(stmt_member)
    member = result_member.scalars().first()

    stmt_auth = select(MemberAuth).where(MemberAuth.student_id == student_id)
    result_auth = await db.execute(stmt_auth)
    auth = result_auth.scalars().first()

    return member, auth


async def get_member_auth_by_student_id(
    db: AsyncSession, student_id: str
) -> MemberAuth | None:
    """학번으로 멤버 인증 정보 조회."""
    stmt = select(MemberAuth).where(MemberAuth.student_id == student_id)
    result = await db.execute(stmt)
    return result.scalars().first()


async def create_member_auth(
    db: AsyncSession,
    *,
    member_id: int,
    student_id: str,
    password_hash: str,
) -> MemberAuth:
    """새로운 멤버 인증 정보 생성."""
    auth = MemberAuth(
        member_id=member_id,
        student_id=student_id,
        password_hash=password_hash,
    )
    db.add(auth)
    await db.commit()
    return auth


async def update_member_auth_password(
    db: AsyncSession,
    auth: MemberAuth,
    password_hash: str,
) -> MemberAuth:
    """멤버 인증 정보의 비밀번호 업데이트."""
    setattr(auth, "password_hash", password_hash)
    await db.commit()
    return auth


async def create_or_update_member_auth(
    db: AsyncSession,
    *,
    member_id: int,
    student_id: str,
    password_hash: str,
) -> MemberAuth:
    """멤버 인증 정보 생성 또는 업데이트."""
    auth = await get_member_auth_by_student_id(db, student_id)
    if auth is None:
        return await create_member_auth(
            db,
            member_id=member_id,
            student_id=student_id,
            password_hash=password_hash,
        )
    return await update_member_auth_password(db, auth, password_hash)

#!/usr/bin/env python3
"""
개발 환경용 시드 데이터 생성 스크립트

관리자 bootstrap 계정만 생성/갱신합니다.
사용법:
    python -m apps.api.seed_data
"""

import asyncio
import os
import secrets
import sys
from pathlib import Path

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db import get_db_session
from apps.api.models import AdminUser, Member, MemberAuth, Visibility


def hash_password(password: str) -> str:
    """비밀번호 해시화"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


_seed_secret_cache: dict[str, str] = {}


def load_seed_secret(env_name: str) -> str:
    """개발 시드용 비밀값 로드 (없으면 임시 랜덤값 생성)."""
    configured = os.getenv(env_name)
    if configured:
        return configured

    cached = _seed_secret_cache.get(env_name)
    if cached:
        return cached

    generated = secrets.token_urlsafe(18)
    _seed_secret_cache[env_name] = generated
    return generated


async def create_admin_users(session: AsyncSession) -> None:
    """개발용 관리자 bootstrap 계정 생성/갱신."""
    admin_users = [
        {
            "student_id": "s47053",
            "email": "ginishuh@gmail.com",
            "phone": "01089656747",
            "env_var": "SEED_DEV_ADMIN_VALUE",
            "name": "관리자",
            "cohort": 2017,
            "roles": (
                "super_admin,admin,member,"
                "admin_roles,admin_posts,admin_events,"
                "admin_hero,admin_notifications,admin_signup,"
                "admin_profile"
            ),
        },
    ]

    for user_data in admin_users:
        secret = load_seed_secret(str(user_data["env_var"]))
        password_hash = hash_password(secret)

        stmt = select(AdminUser).where(AdminUser.student_id == user_data["student_id"])
        existing_admin = (await session.execute(stmt)).scalars().first()
        if existing_admin is None:
            session.add(
                AdminUser(
                    student_id=str(user_data["student_id"]),
                    email=str(user_data["email"]),
                    password_hash=password_hash,
                )
            )
            print(f"관리자 계정 생성: {user_data['student_id']} ({user_data['email']})")
        else:
            print(f"관리자 계정 이미 존재: {user_data['student_id']}")

        stmt = select(Member).where(Member.student_id == user_data["student_id"])
        existing_member = (await session.execute(stmt)).scalars().first()
        if existing_member is None:
            member = Member(
                student_id=str(user_data["student_id"]),
                email=str(user_data["email"]),
                phone=str(user_data["phone"]),
                name=str(user_data["name"]),
                cohort=int(user_data["cohort"]),
                roles=str(user_data["roles"]),
                status="active",
                visibility=Visibility.ALL,
            )
            session.add(member)
            await session.flush()
            member_id = member.id
            print("  → 회원 정보 생성")
        else:
            member_id = existing_member.id
            print("  → 회원 정보 이미 존재")

        stmt = select(MemberAuth).where(
            MemberAuth.student_id == user_data["student_id"]
        )
        existing_auth = (await session.execute(stmt)).scalars().first()
        if existing_auth is None:
            session.add(
                MemberAuth(
                    member_id=member_id,
                    student_id=str(user_data["student_id"]),
                    password_hash=password_hash,
                )
            )
            print("  → 인증 정보 생성")
        else:
            print("  → 인증 정보 이미 존재")

    await session.commit()


async def async_main() -> None:
    """비동기 메인 실행 함수"""
    print("🌱 시드 데이터 생성 시작")
    print("=" * 50)

    async with get_db_session() as session:
        await create_admin_users(session)

    print("=" * 50)
    print("✅ 시드 데이터 생성 완료")
    print("\n📋 생성된 계정 정보")
    print("🔧 관리자 bootstrap 계정: s47053 (ginishuh@gmail.com)")
    print("  - roles: super_admin,admin,member + 전체 admin 권한")
    print("  - 인증 비밀값: 환경변수 `SEED_DEV_ADMIN_VALUE`")


def main() -> None:
    """메인 실행 함수"""
    project_root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(project_root))

    try:
        asyncio.run(async_main())
    except (RuntimeError, ValueError, OSError) as exc:
        print(f"❌ 시드 데이터 생성 실패: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()

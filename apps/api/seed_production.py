#!/usr/bin/env python3
"""
운영 환경용 시드 데이터 생성 스크립트

관리자 bootstrap 계정만 생성/갱신합니다.
사용법:
    python -m apps.api.seed_production
"""

import asyncio
import os
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


def load_required_secret(env_name: str) -> str:
    """운영 시드 비밀값 로드 (미설정 시 실패)."""
    configured = os.getenv(env_name)
    if not configured:
        raise ValueError(f"필수 환경변수 누락: {env_name}")
    return configured


async def create_production_admins(session: AsyncSession) -> None:
    """운영 환경용 관리자 bootstrap 계정 생성/갱신."""
    print("🔧 운영 관리자 bootstrap 계정 생성 중...")

    admin_users = [
        {
            "student_id": "s47053",
            "email": "admin@sogecon.kr",
            "env_var": "SEED_PROD_ADMIN001_VALUE",
            "name": "최고 관리자",
            "cohort": 2000,
            "roles": "super_admin,admin,member",
        },
    ]

    for admin_data in admin_users:
        secret = load_required_secret(str(admin_data["env_var"]))
        password_hash = hash_password(secret)

        stmt = select(AdminUser).where(AdminUser.student_id == admin_data["student_id"])
        existing_admin = (await session.execute(stmt)).scalars().first()
        if existing_admin is None:
            session.add(
                AdminUser(
                    student_id=str(admin_data["student_id"]),
                    email=str(admin_data["email"]),
                    password_hash=password_hash,
                )
            )
            print(
                f"  ✅ 관리자 계정 생성: "
                f"{admin_data['student_id']} ({admin_data['email']})"
            )
        else:
            print(f"  ⚠️  관리자 계정 이미 존재: {admin_data['student_id']}")

        stmt = select(Member).where(Member.student_id == admin_data["student_id"])
        existing_member = (await session.execute(stmt)).scalars().first()
        if existing_member is None:
            member = Member(
                student_id=str(admin_data["student_id"]),
                email=str(admin_data["email"]),
                name=str(admin_data["name"]),
                cohort=int(admin_data["cohort"]),
                roles=str(admin_data["roles"]),
                status="active",
                visibility=Visibility.ALL,
            )
            session.add(member)
            await session.flush()
            member_id = member.id
            print("    → 회원 정보 생성")
        else:
            member_id = existing_member.id
            print("    → 회원 정보 이미 존재")

        stmt = select(MemberAuth).where(
            MemberAuth.student_id == admin_data["student_id"]
        )
        existing_auth = (await session.execute(stmt)).scalars().first()
        if existing_auth is None:
            session.add(
                MemberAuth(
                    member_id=member_id,
                    student_id=str(admin_data["student_id"]),
                    password_hash=password_hash,
                )
            )
            print("    → 인증 정보 생성")
        else:
            print("    → 인증 정보 이미 존재")

    await session.commit()


async def async_main() -> None:
    """비동기 메인 실행 함수"""
    print("🌱 운영 환경 시드 데이터 생성 시작")
    print("=" * 50)

    async with get_db_session() as session:
        await create_production_admins(session)

    print("=" * 50)
    print("✅ 운영 환경 시드 데이터 생성 완료")
    print("\n📋 생성된 운영 계정 정보")
    print("🔧 관리자 bootstrap 계정:")
    print("  - s47053 (super_admin,admin,member) / SEED_PROD_ADMIN001_VALUE")


def main() -> None:
    """메인 실행 함수"""
    project_root = Path(__file__).parent.parent.parent
    sys.path.insert(0, str(project_root))

    try:
        asyncio.run(async_main())
    except (RuntimeError, ValueError, OSError) as exc:
        print(f"❌ 시드 데이터 생성 실패: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()

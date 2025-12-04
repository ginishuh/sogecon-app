#!/usr/bin/env python3
"""
운영 환경용 시드 데이터 생성 스크립트

실제 운영에 사용할 초기 데이터를 생성합니다.
사용법:
    python -m apps.api.seed_production
"""

import asyncio
import sys
from pathlib import Path

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db import get_db_session
from apps.api.models import AdminUser, Member, MemberAuth, Visibility


def hash_password(password: str) -> str:
    """비밀번호 해시화"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


async def create_production_admins(session: AsyncSession) -> None:
    """운영 환경용 관리자 계정 생성"""
    print("🔧 운영 관리자 계정 생성 중...")

    # 실제 운영용 강력한 비밀번호
    admin_users = [
        {
            "student_id": "admin001",
            "email": "admin@sogecon.kr",
            "password": "Sogecon2025!@#",  # 강력한 비밀번호
            "description": "최고 관리자",
        },
        {
            "student_id": "admin002",
            "email": "master@sogecon.kr",
            "password": "Master2025!@#",
            "description": "마스터 관리자",
        },
    ]

    for admin_data in admin_users:
        # 기존 계정 확인
        stmt = select(AdminUser).where(AdminUser.student_id == admin_data["student_id"])
        result = await session.execute(stmt)
        existing = result.scalars().first()
        if existing:
            print(f"  ⚠️  관리자 계정 이미 존재: {admin_data['email']}")
            continue

        admin = AdminUser(
            student_id=admin_data["student_id"],
            email=admin_data["email"],
            password_hash=hash_password(admin_data["password"]),
        )
        session.add(admin)
        print(
            f"  ✅ 관리자 계정 생성: {admin_data['student_id']} ({admin_data['email']})"
        )

    await session.commit()


async def create_production_members(session: AsyncSession) -> None:
    """운영 환경용 동문회 초기 회원 생성"""
    print("👥 동문회 초기 회원 생성 중...")

    # 실제 동문회원 데이터 (예시)
    members = [
        {
            "student_id": "president2025",
            "email": "president@sogecon.kr",
            "name": "홍길동",
            "cohort": 1985,
            "major": "경제학",
            "roles": "member,alumni,president",
            "visibility": Visibility.ALL,
            "phone": "02-1234-5678",
            "company": "서강대학교 경제대학원",
            "department": "총동문회",
            "job_title": "회장",
            "industry": "교육/학술",
        },
        {
            "student_id": "vicepresident2025",
            "email": "vice-president@sogecon.kr",
            "name": "김철수",
            "cohort": 1987,
            "major": "국제통상",
            "roles": "member,alumni,vice-president",
            "visibility": Visibility.ALL,
            "phone": "02-9876-5432",
            "company": "무역투자협회",
            "department": "중동부",
            "job_title": "상무이사",
            "industry": "무역/투자",
        },
        {
            "student_id": "secretary2025",
            "email": "secretary@sogecon.kr",
            "name": "이영희",
            "cohort": 1990,
            "major": "재정학",
            "roles": "member,alumni,secretary",
            "visibility": Visibility.ALL,
            "phone": "02-5555-7777",
            "company": "기획재정부",
            "department": "기획조정팀",
            "job_title": "과장",
            "industry": "공공/정부",
        },
    ]

    for member_data in members:
        # 기존 회원 확인
        stmt = select(Member).where(Member.student_id == member_data["student_id"])
        result = await session.execute(stmt)
        existing = result.scalars().first()
        if existing:
            print(f"  ⚠️  회원 계정 이미 존재: {member_data['student_id']}")
            continue

        member = Member(**member_data)
        session.add(member)
        print(
            f"  ✅ 회원 계정 생성: {member_data['student_id']} ({member_data['name']})"
        )

    await session.commit()


async def create_production_member_auth(session: AsyncSession) -> None:
    """운영 환경용 회원 인증 정보 생성"""
    print("🔐 회원 인증 정보 생성 중...")

    # 간단한 비밀번호 (운영에서 변경 필요)
    member_auth_data = [
        {"student_id": "president2025", "password": "President123!"},
        {"student_id": "vicepresident2025", "password": "Vice123!"},
        {"student_id": "secretary2025", "password": "Secretary123!"},
    ]

    for auth_data in member_auth_data:
        # 회원 정보 확인
        stmt = select(Member).where(Member.student_id == auth_data["student_id"])
        result = await session.execute(stmt)
        member = result.scalars().first()
        if not member:
            print(f"  ⚠️  회원 정보 없음: {auth_data['student_id']}")
            continue

        # 기존 인증 정보 확인
        stmt = select(MemberAuth).where(
            MemberAuth.student_id == auth_data["student_id"]
        )
        result = await session.execute(stmt)
        existing = result.scalars().first()
        if existing:
            print(f"  ⚠️  인증 정보 이미 존재: {auth_data['student_id']}")
            continue

        member_auth = MemberAuth(
            member_id=member.id,
            student_id=auth_data["student_id"],
            password_hash=hash_password(auth_data["password"]),
        )
        session.add(member_auth)
        print(f"  ✅ 인증 정보 생성: {auth_data['student_id']}")

    await session.commit()


async def async_main() -> None:
    """비동기 메인 실행 함수"""
    print("🌱 운영 환경 시드 데이터 생성 시작")
    print("=" * 50)

    async with get_db_session() as session:
        # 운영 관리자 계정 생성
        await create_production_admins(session)

        # 동문회 초기 회원 생성
        await create_production_members(session)

        # 회원 인증 정보 생성
        await create_production_member_auth(session)

    print("=" * 50)
    print("✅ 운영 환경 시드 데이터 생성 완료")
    print("\n📋 생성된 운영 계정 정보:")
    print("🔧 관리자 계정:")
    print("  - admin001 (admin@sogecon.kr) / Sogecon2025!@#")
    print("  - admin002 (master@sogecon.kr) / Master2025!@#")
    print("\n👥 초기 회원 계정:")
    print("  - president2025 (홍길동 회장)")
    print("  - vicepresident2025 (김철수 부회장)")
    print("  - secretary2025 (이영희 총무)")
    print("\n⚠️  중요: 운영 전에 반드시 비밀번호를 변경하세요!")


def main() -> None:
    """메인 실행 함수"""
    # 프로젝트 루트를 Python 경로에 추가
    project_root = Path(__file__).parent.parent.parent
    sys.path.insert(0, str(project_root))

    try:
        asyncio.run(async_main())
    except (RuntimeError, ValueError, OSError) as e:
        print(f"❌ 시드 데이터 생성 실패: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

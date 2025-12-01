#!/usr/bin/env python3
"""
시드 데이터 생성 스크립트

운영자 계정과 테스트용 회원 데이터를 생성합니다.
사용법:
    python -m apps.api.seed_data
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


# 관리자 계정 생성
async def create_admin_users(session: AsyncSession) -> None:
    """개발용 관리자 계정 생성"""
    bcrypt = __import__("bcrypt")

    admin_users = [
        {
            "student_id": "s47053",
            "email": "ginishuh@gmail.com",
            "password": "admin1234",
        },
    ]

    for user_data in admin_users:
        # 이미 존재하는지 확인
        stmt = select(AdminUser).where(AdminUser.student_id == user_data["student_id"])
        result = await session.execute(stmt)
        existing = result.scalars().first()
        if existing:
            print(f"관리자 계정 {user_data['student_id']} 이미 존재함")
            continue

        # 비밀번호 해시
        password_hash = bcrypt.hashpw(
            user_data["password"].encode(), bcrypt.gensalt()
        ).decode()

        admin_user = AdminUser(
            student_id=user_data["student_id"],
            email=user_data["email"],
            password_hash=password_hash,
        )
        session.add(admin_user)
        print(f"관리자 계정 생성: {user_data['student_id']} ({user_data['email']})")


async def create_member_auth(session: AsyncSession) -> None:
    """회원 인증 정보 생성"""
    print("🔐 회원 인증 정보 생성 중...")

    member_auth_data = [
        {
            "student_id": "s47054",
            "password": "member1234"
        },
        {
            "student_id": "s47055",
            "password": "member1234"
        },
        {
            "student_id": "s47056",
            "password": "member1234"
        },
        {
            "student_id": "s47058",
            "password": "member1234"
        }
    ]

    for auth_data in member_auth_data:
        # 기존 인증 정보 확인
        stmt = select(Member).where(Member.student_id == auth_data["student_id"])
        result = await session.execute(stmt)
        member = result.scalars().first()
        if not member:
            print(f"  ⚠️  회원 정보 없음: {auth_data['student_id']}")
            continue

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
            password_hash=hash_password(auth_data["password"])
        )
        session.add(member_auth)
        print(f"  ✅ 인증 정보 생성: {auth_data['student_id']}")

    await session.commit()


async def create_members(session: AsyncSession) -> None:
    """일반 회원 계정 생성"""
    print("👥 일반 회원 계정 생성 중...")

    members = [
        {
            "student_id": "s47054",
            "email": "member1@segecon.app",
            "name": "김철수",
            "cohort": 2020,
            "major": "경제학",
            "roles": "member",
            "visibility": Visibility.ALL,
            "phone": "010-1234-5678",
            "company": "서강경제연구소",
            "department": "연구본부",
            "job_title": "연구원",
            "industry": "연구개발"
        },
        {
            "student_id": "s47055",
            "email": "member2@segecon.app",
            "name": "이영희",
            "cohort": 2019,
            "major": "응용경제학",
            "roles": "member",
            "visibility": Visibility.COHORT,
            "phone": "010-9876-5432",
            "company": "금융투자사",
            "department": "자산운용팀",
            "job_title": "애널리스트",
            "industry": "금융"
        },
        {
            "student_id": "s47056",
            "email": "member3@segecon.app",
            "name": "박지성",
            "cohort": 2021,
            "major": "국제통상",
            "roles": "member",
            "visibility": Visibility.PRIVATE,
            "phone": "010-5555-7777",
            "company": "무역회사",
            "department": "수출팀",
            "job_title": "매니저",
            "industry": "무역"
        },
        {
            "student_id": "s47058",
            "email": "alumni@segecon.app",
            "name": "최동원",
            "cohort": 2018,
            "major": "재정학",
            "roles": "member,alumni",
            "visibility": Visibility.ALL,
            "phone": "010-2222-3333",
            "company": "정부기관",
            "department": "예산팀",
            "job_title": "사무관",
            "industry": "공공"
        }
    ]

    for member_data in members:
        # 기존 회원 확인 (학번으로)
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


async def async_main() -> None:
    """비동기 메인 실행 함수"""
    print("🌱 시드 데이터 생성 시작")
    print("=" * 50)

    async with get_db_session() as session:
        # 운영자 계정 생성
        await create_admin_users(session)

        # 일반 회원 계정 생성
        await create_members(session)

        # 회원 인증 정보 생성
        await create_member_auth(session)

    print("=" * 50)
    print("✅ 시드 데이터 생성 완료")
    print("\n📋 생성된 계정 정보:")
    print("🔧 운영자 계정:")
    print("  - s47053 (ginishuh@gmail.com) / admin1234")
    print("\n👥 일반 회원 계정:")
    print("  - member1@segecon.app (김철수)")
    print("  - member2@segecon.app (이영희)")
    print("  - member3@segecon.app (박지성)")
    print("  - alumni@segecon.app (최동원)")


def main() -> None:
    """메인 실행 함수"""
    # 프로젝트 루트를 Python 경로에 추가
    project_root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(project_root))

    try:
        asyncio.run(async_main())
    except (RuntimeError, ValueError) as e:
        print(f"❌ 시드 데이터 생성 실패: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

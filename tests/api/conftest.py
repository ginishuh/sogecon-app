from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncGenerator, Generator
from http import HTTPStatus
from pathlib import Path

import httpx
import pytest
from bcrypt import gensalt, hashpw  # 테스트 전용(최상위 임포트)
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app


@pytest.fixture()
def client(tmp_path: Path) -> Generator[TestClient, None, None]:
    # 테스트 DB: PostgreSQL만 허용. 기본은 로컬 5434(appdb_test)
    test_db = os.environ.get("TEST_DB", "pg").lower()
    if test_db != "pg":
        raise RuntimeError("Tests require PostgreSQL. Set TEST_DB=pg.")

    candidate = os.environ.get("TEST_DB_URL") or os.environ.get("DATABASE_URL")
    if not candidate:
        candidate = "postgresql+psycopg://app:devpass@localhost:5434/appdb_test"

    if not candidate.lower().startswith("postgresql+psycopg://"):
        raise RuntimeError("TEST_DB_URL/DATABASE_URL must be postgresql+psycopg:// ...")

    url = make_url(candidate)
    db_name = (url.database or "").lower()
    if "test" not in db_name and os.environ.get("TEST_DB_FORCE") != "1":
        msg = (
            "Refusing to run tests on non-test database. "
            "Use TEST_DB_URL pointing to a dedicated DB (name contains 'test') "
            "or set TEST_DB_FORCE=1."
        )
        raise RuntimeError(msg)
    engine_url = candidate

    # Async 엔진 및 세션 팩토리
    async_engine = create_async_engine(engine_url, pool_pre_ping=True)
    TestingAsyncSessionLocal = async_sessionmaker(
        bind=async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    # 동기 엔진으로 테이블 생성 (metadata.create_all은 동기만 지원)
    sync_engine = create_engine(engine_url)
    # PostgreSQL ENUM 타입은 create_all 과정에서 누락될 수 있어 선행 생성합니다.
    models.Member.__table__.c.visibility.type.create(
        bind=sync_engine, checkfirst=True
    )
    models.RSVP.__table__.c.status.type.create(bind=sync_engine, checkfirst=True)
    models.Base.metadata.create_all(bind=sync_engine)

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with TestingAsyncSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c

    # cleanup
    app.dependency_overrides.pop(get_db, None)
    models.Base.metadata.drop_all(bind=sync_engine)
    models.RSVP.__table__.c.status.type.drop(bind=sync_engine, checkfirst=True)
    models.Member.__table__.c.visibility.type.drop(bind=sync_engine, checkfirst=True)
    sync_engine.dispose()
    asyncio.run(async_engine.dispose())


async def _seed_admin(session: AsyncSession) -> None:
    """관리자 계정 시드 (AdminUser + Member 레코드 필요)"""
    pwd = hashpw(b"__seed__", gensalt()).decode()

    # AdminUser 생성
    stmt = select(models.AdminUser).where(
        models.AdminUser.student_id == "__seed__admin"
    )
    result = await session.execute(stmt)
    if result.scalars().first() is None:
        admin = models.AdminUser(
            student_id="__seed__admin",
            password_hash=pwd,
            email="admin@test.example.com",
        )
        session.add(admin)

    # 관리자도 Member 레코드 필요 (posts.author_id FK 호환)
    stmt = select(models.Member).where(models.Member.student_id == "__seed__admin")
    result = await session.execute(stmt)
    if result.scalars().first() is None:
        member = models.Member(
            student_id="__seed__admin",
            email="admin@test.example.com",
            name="Admin",
            cohort=1,
            major=None,
            roles="admin,member",
        )
        session.add(member)

    await session.commit()


async def _seed_member(session: AsyncSession) -> None:
    """멤버 계정 시드"""
    # create member if not exists
    stmt = select(models.Member).where(models.Member.student_id == "member001")
    result = await session.execute(stmt)
    m = result.scalars().first()
    if m is None:
        m = models.Member(
            student_id="member001",
            email="member@example.com",
            name="Member",
            cohort=1,
            major=None,
            roles="member",
        )
        session.add(m)
        await session.commit()
        await session.refresh(m)
    pwd = hashpw(b"memberpass", gensalt()).decode()
    stmt = select(models.MemberAuth).where(
        models.MemberAuth.student_id == m.student_id
    )
    result = await session.execute(stmt)
    auth_row = result.scalars().first()
    if auth_row is None:
        session.add(
            models.MemberAuth(
                member_id=m.id, student_id=m.student_id, password_hash=pwd
            )
        )
        await session.commit()


@pytest.fixture()
def admin_login(client: TestClient) -> TestClient:
    """관리자 계정 시드 후 로그인한 클라이언트를 반환."""
    # 기존 세션에서 바로 시도
    res = client.post(
        "/auth/login", json={"student_id": "__seed__admin", "password": "__seed__"}
    )
    if res.status_code == HTTPStatus.OK:
        return client

    # 세션 팩토리로 직접 시드
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found for admin seeding")

    async def _run_seed() -> None:
        async for session in override():
            await _seed_admin(session)
            break

    asyncio.run(_run_seed())

    client.post(
        "/auth/login", json={"student_id": "__seed__admin", "password": "__seed__"}
    )
    return client


@pytest.fixture()
def member_login(client: TestClient) -> TestClient:
    """일반 멤버 계정 시드 후 로그인한 클라이언트를 반환."""
    # 시도: 기존 세션으로 바로 로그인
    rc = client.post(
        "/auth/member/login",
        json={"student_id": "member001", "password": "memberpass"},
    )
    if rc.status_code == HTTPStatus.OK:
        return client

    # 시드: Member + MemberAuth
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found for member seeding")

    async def _run_seed() -> None:
        async for session in override():
            await _seed_member(session)
            break

    asyncio.run(_run_seed())

    client.post(
        "/auth/member/login",
        json={"student_id": "member001", "password": "memberpass"},
    )
    return client


def _get_test_db_url() -> str:
    """테스트 DB URL 반환 (공통 로직)"""
    test_db = os.environ.get("TEST_DB", "pg").lower()
    if test_db != "pg":
        raise RuntimeError("Tests require PostgreSQL. Set TEST_DB=pg.")

    candidate = os.environ.get("TEST_DB_URL") or os.environ.get("DATABASE_URL")
    if not candidate:
        candidate = "postgresql+psycopg://app:devpass@localhost:5434/appdb_test"

    if not candidate.lower().startswith("postgresql+psycopg://"):
        raise RuntimeError("TEST_DB_URL/DATABASE_URL must be postgresql+psycopg://")

    url = make_url(candidate)
    db_name = (url.database or "").lower()
    if "test" not in db_name and os.environ.get("TEST_DB_FORCE") != "1":
        msg = (
            "Refusing to run tests on non-test database. "
            "Use TEST_DB_URL pointing to a dedicated DB (name contains 'test') "
            "or set TEST_DB_FORCE=1."
        )
        raise RuntimeError(msg)
    return candidate


@pytest.fixture()
async def async_client(
    tmp_path: Path,
) -> AsyncGenerator[httpx.AsyncClient, None]:
    """
    async 테스트용 httpx.AsyncClient fixture.
    lifespan 이벤트와 async 의존성 주입 경로를 제대로 검증합니다.
    """
    engine_url = _get_test_db_url()

    async_engine = create_async_engine(engine_url, pool_pre_ping=True)
    TestingAsyncSessionLocal = async_sessionmaker(
        bind=async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    sync_engine = create_engine(engine_url)
    models.Base.metadata.create_all(bind=sync_engine)

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with TestingAsyncSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = httpx.ASGITransport(app=app)  # type: ignore[arg-type]
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as ac:
        yield ac

    app.dependency_overrides.pop(get_db, None)
    models.Base.metadata.drop_all(bind=sync_engine)
    sync_engine.dispose()
    await async_engine.dispose()

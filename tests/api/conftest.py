from __future__ import annotations

import os
from collections.abc import Generator
from http import HTTPStatus
from pathlib import Path

import pytest
from bcrypt import gensalt, hashpw  # 테스트 전용(최상위 임포트)
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app


@pytest.fixture()
def client(tmp_path: Path) -> Generator[TestClient, None, None]:
    # 테스트 DB 선택: 기본은 SQLite, TEST_DB=pg이면 TEST_DB_URL/DATABASE_URL 사용
    test_db = os.environ.get("TEST_DB", "sqlite").lower()
    engine_url: str
    engine_kwargs: dict = {"future": True}

    if test_db == "pg":
        candidate = os.environ.get("TEST_DB_URL") or os.environ.get("DATABASE_URL")
        if not candidate or not candidate.startswith("postgresql"):
            # 안전 폴백: 설정이 없으면 SQLite 사용
            db_path = tmp_path / "test.sqlite3"
            engine_url = f"sqlite:///{db_path}"
            engine_kwargs["connect_args"] = {"check_same_thread": False}
        else:
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
    else:
        db_path = tmp_path / "test.sqlite3"
        engine_url = f"sqlite:///{db_path}"
        engine_kwargs["connect_args"] = {"check_same_thread": False}

    engine = create_engine(engine_url, **engine_kwargs)
    TestingSessionLocal = sessionmaker(
        bind=engine, autoflush=False, autocommit=False, future=True
    )

    models.Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c

    # cleanup
    app.dependency_overrides.pop(get_db, None)
    models.Base.metadata.drop_all(bind=engine)


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
    gen = override()
    db: Session = next(gen)
    try:
        pwd = hashpw(b"__seed__", gensalt()).decode()
        admin = models.AdminUser(student_id="__seed__admin", password_hash=pwd)
        db.add(admin)
        db.commit()
    finally:
        db.close()
        try:
            gen.close()
        except Exception:
            pass

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
    gen = override()
    db: Session = next(gen)
    try:
        # create member if not exists
        m = (
            db.query(models.Member)
            .filter(models.Member.student_id == "member001")
            .first()
        )
        if m is None:
            m = models.Member(
                student_id="member001",
                email="member@example.com",
                name="Member",
                cohort=1,
                major=None,
                roles="member",
            )
            db.add(m)
            db.commit()
            db.refresh(m)
        pwd = hashpw(b"memberpass", gensalt()).decode()
        auth_row = (
            db.query(models.MemberAuth)
            .filter(models.MemberAuth.student_id == m.student_id)
            .first()
        )
        if auth_row is None:
            db.add(
                models.MemberAuth(
                    member_id=m.id, student_id=m.student_id, password_hash=pwd
                )
            )
            db.commit()
    finally:
        db.close()
        try:
            gen.close()
        except Exception:
            pass

    client.post(
        "/auth/member/login",
        json={"student_id": "member001", "password": "memberpass"},
    )
    return client

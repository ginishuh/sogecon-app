from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

import pytest
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

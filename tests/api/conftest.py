from __future__ import annotations

import sys
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# Ensure project root on sys.path
ROOT = Path(__file__).resolve().parents[2]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from apps.api import models  # noqa: E402
from apps.api.db import get_db  # noqa: E402
from apps.api.main import app  # noqa: E402


@pytest.fixture()
def client(tmp_path: Path) -> Generator[TestClient, None, None]:
    db_path = tmp_path / "test.sqlite3"
    engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}, future=True
    )
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

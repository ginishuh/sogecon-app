from __future__ import annotations

import os
from collections.abc import Generator

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from apps.api import models


@pytest.fixture()
def sync_db() -> Generator[Session, None, None]:
    candidate = os.environ.get("TEST_DB_URL") or os.environ.get("DATABASE_URL")
    if not candidate:
        candidate = "postgresql+psycopg://app:devpass@localhost:5434/appdb_test"

    engine = create_engine(candidate, pool_pre_ping=True)
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
    models.Member.__table__.c.visibility.type.create(bind=engine, checkfirst=True)
    models.RSVP.__table__.c.status.type.create(bind=engine, checkfirst=True)
    models.Base.metadata.create_all(bind=engine)

    factory = sessionmaker(bind=engine)
    session = factory()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()

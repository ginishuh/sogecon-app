from __future__ import annotations

from http import HTTPStatus

from fastapi.testclient import TestClient

from apps.api.db import get_db
from apps.api.main import app
from apps.api.repositories import send_logs as logs_repo


def test_prune_logs_admin(admin_login: TestClient) -> None:
    client = admin_login
    # seed 2 logs (one will be considered old via raw insert with SQLite fallback)
    override = app.dependency_overrides.get(get_db)
    assert override is not None
    gen = override()
    db = next(gen)
    try:
        logs_repo.create_log(db, endpoint="https://x/1", ok=True, status_code=201)
        logs_repo.create_log(db, endpoint="https://x/2", ok=False, status_code=410)
    finally:
        db.close()
        try:
            gen.close()
        except Exception:
            pass

    res = client.post(
        "/notifications/admin/notifications/prune-logs",
        json={"older_than_days": 0},
    )
    assert res.status_code in (HTTPStatus.OK, HTTPStatus.CREATED, HTTPStatus.ACCEPTED)
    data = res.json()
    assert "deleted" in data

from __future__ import annotations

import base64
import os
from http import HTTPStatus

from fastapi.testclient import TestClient

from apps.api import models
from apps.api.config import get_settings, reset_settings_cache
from apps.api.crypto_utils import encrypt_str
from apps.api.db import get_db
from apps.api.main import app
from apps.api.repositories import notifications as subs_repo
from apps.api.repositories import send_logs as logs_repo


def test_subscription_encrypted_at_rest_and_logged_plain_tail(
    admin_login: TestClient,
) -> None:
    # Enable encryption via env
    os.environ["PUSH_ENCRYPT_AT_REST"] = "true"
    os.environ["PUSH_KEK"] = base64.b64encode(os.urandom(32)).decode()
    try:
        # reload settings
        reset_settings_cache()
        s = get_settings()
        assert s.push_encrypt_at_rest is True
        assert encrypt_str("x").startswith("enc:v1:")

        # Seed one subscription directly
        override = app.dependency_overrides.get(get_db)
        assert override is not None
        gen = override()
        db = next(gen)
        endpoint = "https://example.com/encrypted/1"
        try:
            subs_repo.upsert_subscription(
                db,
                {
                    "endpoint": endpoint,
                    "p256dh": "p",
                    "auth": "a",
                },
            )
            PS = models.PushSubscription
            row = db.query(PS).first()
            assert row is not None
        finally:
            db.close()
            try:
                gen.close()
            except Exception:
                pass

        # Call test send (admin)
        res = admin_login.post(
            "/notifications/admin/notifications/test",
            json={"title": "t", "body": "b"},
        )
        assert res.status_code in (HTTPStatus.ACCEPTED, HTTPStatus.OK)

        # encryption doesn't affect the log tail computation (uses plaintext)
        override2 = app.dependency_overrides.get(get_db)
        assert override2 is not None
        gen2 = override2()
        db2 = next(gen2)
        try:
            logs = logs_repo.list_recent(db2, limit=1)
            assert logs and logs[0].endpoint_tail == endpoint[-16:]
        finally:
            db2.close()
            try:
                gen2.close()
            except Exception:
                pass
    finally:
        # cleanup env & reload
        os.environ.pop("PUSH_ENCRYPT_AT_REST", None)
        os.environ.pop("PUSH_KEK", None)
        reset_settings_cache()

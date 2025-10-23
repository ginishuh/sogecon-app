from __future__ import annotations

from http import HTTPStatus

from fastapi.testclient import TestClient


def test_stats_range_param(admin_login: TestClient) -> None:
    client = admin_login
    for r in ("24h", "7d", "30d"):
        res = client.get(f"/notifications/admin/notifications/stats?range={r}")
        assert res.status_code == HTTPStatus.OK
        data = res.json()
        assert data.get("range") == r

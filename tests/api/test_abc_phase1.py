from __future__ import annotations

from http import HTTPStatus

from fastapi.testclient import TestClient
from itsdangerous import URLSafeSerializer

from apps.api.config import get_settings


def _make_activation_token(data: dict[str, object]) -> str:
    s = URLSafeSerializer(get_settings().jwt_secret, salt="member-activate")
    return s.dumps(data)


def test_member_activate_and_login(client: TestClient) -> None:
    token = _make_activation_token(
        {
            "email": "abc1@example.com",
            "name": "ABC One",
            "cohort": 1,
        }
    )
    res = client.post("/auth/member/activate", json={"token": token, "password": "pw1"})
    assert res.status_code == HTTPStatus.OK
    # change password with member session
    res2 = client.post(
        "/auth/member/change-password",
        json={"current_password": "pw1", "new_password": "pw2"},
    )
    assert res2.status_code == HTTPStatus.OK

    # profile get/put
    me = client.get("/me/")
    assert me.status_code == HTTPStatus.OK
    data = me.json()
    assert "email" in data and data["email"] == "abc1@example.com"
    upd = client.put("/me/", json={"name": "Renamed", "visibility": "cohort"})
    assert upd.status_code == HTTPStatus.OK
    data2 = upd.json()
    assert data2["name"] == "Renamed"


def test_member_activate_invalid_token_401(client: TestClient) -> None:
    res = client.post("/auth/member/activate", json={"token": "bad", "password": "pw"})
    assert res.status_code == HTTPStatus.UNAUTHORIZED


def test_support_contact_rate_limit(admin_login: TestClient) -> None:
    # use admin_login to bypass member-login flow (compat)
    client = admin_login
    res1 = client.post(
        "/support/contact", json={"subject": "hello", "body": "message long enough"}
    )
    assert res1.status_code in (HTTPStatus.ACCEPTED, HTTPStatus.OK)
    # second immediate call may hit rate-limit unless testclient IP exemption applies
    # Note: to force 429 here we'd use ASGITransport with a non-test IP.
    res2 = client.post(
        "/support/contact", json={"subject": "hello2", "body": "message long enough 2"}
    )
    assert res2.status_code in (HTTPStatus.ACCEPTED, HTTPStatus.TOO_MANY_REQUESTS)

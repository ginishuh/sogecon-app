from __future__ import annotations

from http import HTTPStatus

from fastapi.testclient import TestClient


def test_new_member_directory_stays_locked_until_consent(
    admin_login: TestClient,
) -> None:
    signup = admin_login.post(
        "/auth/member/signup",
        json={
            "student_id": "consent001",
            "email": "consent001@example.com",
            "name": "동의대상",
            "cohort": 3,
            "phone": "010-4000-5000",
        },
    )
    assert signup.status_code == HTTPStatus.CREATED
    signup_id = signup.json()["id"]
    approve = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")
    assert approve.status_code == HTTPStatus.OK
    token = approve.json()["activation_token"]

    activated = admin_login.post(
        "/auth/member/activate", json={"token": token, "password": "consent-pass"}
    )
    assert activated.status_code == HTTPStatus.OK

    session = admin_login.get("/auth/session")
    assert session.status_code == HTTPStatus.OK
    assert session.json()["directory_consent_at"] is None

    me = admin_login.get("/me/")
    assert me.status_code == HTTPStatus.OK
    member_id = me.json()["id"]
    assert me.json()["visibility"] == "private"
    assert me.json()["directory_consent_at"] is None

    admin_login.post("/auth/logout")
    admin = admin_login.post(
        "/auth/login",
        json={"student_id": "__seed__admin", "password": "__seed__"},
    )
    assert admin.status_code == HTTPStatus.OK
    locked = admin_login.get(f"/members/{member_id}")
    assert locked.status_code == HTTPStatus.OK
    assert locked.json()["details_visible"] is False
    assert locked.json()["email"] is None

    member = admin_login.post(
        "/auth/login",
        json={"student_id": "consent001", "password": "consent-pass"},
    )
    assert member.status_code == HTTPStatus.OK
    opened = admin_login.post("/me/directory-consent", json={"visibility": "all"})
    assert opened.status_code == HTTPStatus.OK
    assert opened.json()["visibility"] == "all"
    assert opened.json()["directory_consent_at"] is not None

    admin_login.post("/auth/logout")
    admin_login.post(
        "/auth/login",
        json={"student_id": "__seed__admin", "password": "__seed__"},
    )
    visible = admin_login.get(f"/members/{member_id}")
    assert visible.status_code == HTTPStatus.OK
    assert visible.json()["details_visible"] is True
    assert visible.json()["email"] == "consent001@example.com"

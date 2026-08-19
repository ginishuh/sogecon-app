from __future__ import annotations

from http import HTTPStatus

from fastapi.testclient import TestClient

from tests.api.problem_assertions import assert_problem_code


def _activate_member(
    admin_login: TestClient, *, student_id: str, email: str, phone: str
) -> int:
    signup = admin_login.post(
        "/auth/member/signup",
        json={
            "student_id": student_id,
            "email": email,
            "name": "동의대상",
            "cohort": 3,
            "phone": phone,
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
    me = admin_login.get("/me/")
    assert me.status_code == HTTPStatus.OK
    return int(me.json()["id"])


def test_new_member_directory_stays_locked_until_consent(
    admin_login: TestClient,
) -> None:
    member_id = _activate_member(
        admin_login,
        student_id="consent001",
        email="consent001@example.com",
        phone="010-4000-5000",
    )
    session = admin_login.get("/auth/session")
    assert session.status_code == HTTPStatus.OK
    assert session.json()["directory_consent_at"] is None
    assert session.json()["directory_choice_at"] is None

    me = admin_login.get("/me/")
    assert me.status_code == HTTPStatus.OK
    assert me.json()["visibility"] == "private"
    assert me.json()["directory_consent_at"] is None
    assert me.json()["directory_choice_at"] is None

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
    assert opened.json()["directory_choice_at"] is not None

    admin_login.post("/auth/logout")
    admin_login.post(
        "/auth/login",
        json={"student_id": "__seed__admin", "password": "__seed__"},
    )
    visible = admin_login.get(f"/members/{member_id}")
    assert visible.status_code == HTTPStatus.OK
    assert visible.json()["details_visible"] is True
    assert visible.json()["email"] == "consent001@example.com"


def test_private_choice_does_not_allow_opening_without_consent(
    admin_login: TestClient,
) -> None:
    member_id = _activate_member(
        admin_login,
        student_id="consent002",
        email="consent002@example.com",
        phone="010-4000-5001",
    )
    declined = admin_login.post(
        "/me/directory-consent", json={"visibility": "private"}
    )
    assert declined.status_code == HTTPStatus.OK
    assert declined.json()["visibility"] == "private"
    assert declined.json()["directory_consent_at"] is None
    assert declined.json()["directory_choice_at"] is not None

    blocked = admin_login.put("/me/", json={"visibility": "all"})
    assert blocked.status_code == HTTPStatus.FORBIDDEN
    assert_problem_code(blocked.json(), "directory_consent_required")

    admin_login.post("/auth/logout")
    admin = admin_login.post(
        "/auth/login",
        json={"student_id": "__seed__admin", "password": "__seed__"},
    )
    assert admin.status_code == HTTPStatus.OK
    admin_open = admin_login.patch(
        f"/admin/members/{member_id}", json={"visibility": "all"}
    )
    assert admin_open.status_code == HTTPStatus.FORBIDDEN
    assert_problem_code(admin_open.json(), "directory_consent_required")

    member = admin_login.post(
        "/auth/login",
        json={"student_id": "consent002", "password": "consent-pass"},
    )
    assert member.status_code == HTTPStatus.OK
    opened = admin_login.post("/me/directory-consent", json={"visibility": "all"})
    assert opened.status_code == HTTPStatus.OK
    assert opened.json()["directory_consent_at"] is not None

    locked = admin_login.put("/me/", json={"visibility": "private"})
    assert locked.status_code == HTTPStatus.OK
    assert locked.json()["visibility"] == "private"
    assert locked.json()["directory_consent_at"] is None

    blocked_again = admin_login.put("/me/", json={"visibility": "cohort"})
    assert blocked_again.status_code == HTTPStatus.FORBIDDEN
    assert_problem_code(blocked_again.json(), "directory_consent_required")

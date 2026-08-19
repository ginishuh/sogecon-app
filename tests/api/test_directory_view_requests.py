from __future__ import annotations

from http import HTTPStatus

from fastapi.testclient import TestClient

from apps.api import models
from tests.api.test_directory import _set_visibility


def test_directory_view_request_grants_details(
    admin_login: TestClient, member_login: TestClient
) -> None:
    client = member_login
    admin = client.post(
        "/auth/login",
        json={"student_id": "__seed__admin", "password": "__seed__"},
    )
    assert admin.status_code == HTTPStatus.OK
    target_id = _set_visibility("member001", models.Visibility.PRIVATE)

    stub = client.get(f"/members/{target_id}")
    assert stub.status_code == HTTPStatus.OK
    body = stub.json()
    assert body["details_visible"] is False
    assert body["email"] is None
    assert body["name"] == "Member"

    created = client.post(f"/members/{target_id}/view-requests")
    assert created.status_code == HTTPStatus.CREATED
    assert created.json()["status"] == "pending"

    duplicate = client.post(f"/members/{target_id}/view-requests")
    assert duplicate.status_code == HTTPStatus.CONFLICT
    assert duplicate.json()["code"] == "view_request_already_pending"

    member = client.post(
        "/auth/member/login",
        json={"student_id": "member001", "password": "memberpass"},
    )
    assert member.status_code == HTTPStatus.OK
    inbox = client.get("/me/view-requests")
    assert inbox.status_code == HTTPStatus.OK
    rows = inbox.json()
    assert len(rows) == 1
    assert rows[0]["requester_name"] == "Admin"
    request_id = rows[0]["id"]

    accepted = client.post(f"/me/view-requests/{request_id}/accept")
    assert accepted.status_code == HTTPStatus.OK
    assert accepted.json()["status"] == "accepted"

    again = client.post(
        "/auth/login",
        json={"student_id": "__seed__admin", "password": "__seed__"},
    )
    assert again.status_code == HTTPStatus.OK
    opened = client.get(f"/members/{target_id}")
    assert opened.status_code == HTTPStatus.OK
    opened_body = opened.json()
    assert opened_body["details_visible"] is True
    assert opened_body["email"] == "member@example.com"
    assert opened_body["view_request"] == "accepted"


def test_directory_view_request_self_rejected(member_login: TestClient) -> None:
    me = member_login.get("/me/")
    assert me.status_code == HTTPStatus.OK
    member_id = me.json()["id"]
    response = member_login.post(f"/members/{member_id}/view-requests")
    assert response.status_code == HTTPStatus.FORBIDDEN
    assert response.json()["code"] == "view_request_self_not_allowed"

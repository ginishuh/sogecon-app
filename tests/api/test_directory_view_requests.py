from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from http import HTTPStatus

from fastapi.testclient import TestClient

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app
from apps.api.models_directory_view import DirectoryViewRequest
from tests.api.test_directory import _set_visibility


def _login_admin(client: TestClient) -> None:
    admin = client.post(
        "/auth/login",
        json={"student_id": "__seed__admin", "password": "__seed__"},
    )
    assert admin.status_code == HTTPStatus.OK


def _login_member(client: TestClient) -> None:
    member = client.post(
        "/auth/member/login",
        json={"student_id": "member001", "password": "memberpass"},
    )
    assert member.status_code == HTTPStatus.OK


def _backdate_created_at(request_id: int) -> None:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _update() -> None:
        async for db in override():
            row = await db.get(DirectoryViewRequest, request_id)
            if row is None:
                raise RuntimeError("view request not found")
            setattr(row, "created_at", datetime(2020, 1, 1, tzinfo=UTC))
            await db.commit()
            return
        raise RuntimeError("database session not available")

    asyncio.run(_update())


def _seed_pending_view_requests(target_id: int, count: int) -> None:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _insert() -> None:
        async for db in override():
            for index in range(count):
                member = models.Member(
                    student_id=f"pend{index:03d}",
                    email=f"pend{index:03d}@example.com",
                    name=f"대기{index:03d}",
                    cohort=2,
                    roles="member",
                    status="active",
                    visibility=models.Visibility.ALL,
                )
                db.add(member)
                await db.flush()
                db.add(
                    DirectoryViewRequest(
                        requester_id=member.id,
                        target_id=target_id,
                        status="pending",
                    )
                )
            await db.commit()
            return
        raise RuntimeError("database session not available")

    asyncio.run(_insert())


def _request_and_accept(client: TestClient, target_id: int) -> int:
    _login_admin(client)
    created = client.post(f"/members/{target_id}/view-requests")
    assert created.status_code == HTTPStatus.CREATED
    request_id = int(created.json()["id"])
    _login_member(client)
    accepted = client.post(f"/me/view-requests/{request_id}/accept")
    assert accepted.status_code == HTTPStatus.OK
    assert accepted.json()["status"] == "accepted"
    return int(request_id)


def test_directory_view_request_grants_details(
    admin_login: TestClient, member_login: TestClient
) -> None:
    client = member_login
    target_id = _set_visibility("member001", models.Visibility.PRIVATE)
    request_id = _request_and_accept(client, target_id)

    _login_admin(client)
    opened = client.get(f"/members/{target_id}")
    assert opened.status_code == HTTPStatus.OK
    opened_body = opened.json()
    assert opened_body["details_visible"] is True
    assert opened_body["email"] == "member@example.com"
    assert opened_body["view_request"] == "accepted"

    _login_member(client)
    revoked = client.post(f"/me/view-requests/{request_id}/revoke")
    assert revoked.status_code == HTTPStatus.OK
    assert revoked.json()["status"] == "revoked"
    inbox = client.get("/me/view-requests")
    assert inbox.json() == []

    _login_admin(client)
    locked = client.get(f"/members/{target_id}")
    assert locked.status_code == HTTPStatus.OK
    assert locked.json()["details_visible"] is False
    assert locked.json()["email"] is None
    assert locked.json()["view_request"] == "revoked"


def test_private_visibility_keeps_individual_grant(
    admin_login: TestClient,
    member_login: TestClient,
) -> None:
    client = member_login
    target_id = _set_visibility("member001", models.Visibility.PRIVATE)
    request_id = _request_and_accept(client, target_id)

    _login_member(client)
    opened_scope = client.put("/me/", json={"visibility": "all"})
    assert opened_scope.status_code == HTTPStatus.OK
    locked_again = client.put("/me/", json={"visibility": "private"})
    assert locked_again.status_code == HTTPStatus.OK
    assert locked_again.json()["visibility"] == "private"
    assert locked_again.json()["directory_consent_at"] is None

    inbox = client.get("/me/view-requests")
    assert inbox.status_code == HTTPStatus.OK
    assert inbox.json()[0]["id"] == request_id
    assert inbox.json()[0]["status"] == "accepted"

    _login_admin(client)
    still_open = client.get(f"/members/{target_id}")
    assert still_open.status_code == HTTPStatus.OK
    assert still_open.json()["details_visible"] is True
    assert still_open.json()["view_request"] == "accepted"


def test_declined_view_request_can_be_renewed(
    admin_login: TestClient, member_login: TestClient
) -> None:
    client = member_login
    target_id = _set_visibility("member001", models.Visibility.PRIVATE)
    _login_admin(client)
    created = client.post(f"/members/{target_id}/view-requests")
    assert created.status_code == HTTPStatus.CREATED
    request_id = created.json()["id"]

    _login_member(client)
    declined = client.post(f"/me/view-requests/{request_id}/decline")
    assert declined.status_code == HTTPStatus.OK
    assert client.get("/me/view-requests").json() == []
    _backdate_created_at(request_id)

    _login_admin(client)
    renewed = client.post(f"/members/{target_id}/view-requests")
    assert renewed.status_code == HTTPStatus.CREATED
    assert renewed.json()["status"] == "pending"
    assert renewed.json()["id"] == request_id
    assert renewed.json()["created_at"].startswith("2020") is False
    assert renewed.json()["decided_at"] is None

    _login_member(client)
    inbox = client.get("/me/view-requests")
    assert inbox.json()[0]["status"] == "pending"


def test_revoked_view_request_can_be_renewed(
    admin_login: TestClient, member_login: TestClient
) -> None:
    client = member_login
    target_id = _set_visibility("member001", models.Visibility.PRIVATE)
    request_id = _request_and_accept(client, target_id)
    _login_member(client)
    revoked = client.post(f"/me/view-requests/{request_id}/revoke")
    assert revoked.status_code == HTTPStatus.OK

    _login_admin(client)
    renewed = client.post(f"/members/{target_id}/view-requests")
    assert renewed.status_code == HTTPStatus.CREATED
    assert renewed.json()["status"] == "pending"


def test_revoke_requires_accepted_grant(
    admin_login: TestClient, member_login: TestClient
) -> None:
    client = member_login
    target_id = _set_visibility("member001", models.Visibility.PRIVATE)
    _login_admin(client)
    created = client.post(f"/members/{target_id}/view-requests")
    request_id = created.json()["id"]
    _login_member(client)
    response = client.post(f"/me/view-requests/{request_id}/revoke")
    assert response.status_code == HTTPStatus.CONFLICT
    assert response.json()["code"] == "view_request_not_accepted"


def test_inbox_keeps_accepted_grant_when_pending_hits_limit(
    admin_login: TestClient, member_login: TestClient
) -> None:
    client = member_login
    target_id = _set_visibility("member001", models.Visibility.PRIVATE)
    request_id = _request_and_accept(client, target_id)
    _seed_pending_view_requests(target_id, 50)

    _login_member(client)
    inbox = client.get("/me/view-requests")
    assert inbox.status_code == HTTPStatus.OK
    rows = inbox.json()
    accepted = [row for row in rows if row["id"] == request_id]
    assert len(accepted) == 1
    assert accepted[0]["status"] == "accepted"
    assert sum(1 for row in rows if row["status"] == "pending") == 50
    assert rows[-1]["id"] == request_id

    revoked = client.post(f"/me/view-requests/{request_id}/revoke")
    assert revoked.status_code == HTTPStatus.OK
    assert revoked.json()["status"] == "revoked"


def test_directory_view_request_self_rejected(member_login: TestClient) -> None:
    me = member_login.get("/me/")
    assert me.status_code == HTTPStatus.OK
    member_id = me.json()["id"]
    response = member_login.post(f"/members/{member_id}/view-requests")
    assert response.status_code == HTTPStatus.FORBIDDEN
    assert response.json()["code"] == "view_request_self_not_allowed"


def test_directory_view_request_duplicate_pending(
    admin_login: TestClient, member_login: TestClient
) -> None:
    client = member_login
    target_id = _set_visibility("member001", models.Visibility.PRIVATE)
    _login_admin(client)
    created = client.post(f"/members/{target_id}/view-requests")
    assert created.status_code == HTTPStatus.CREATED
    duplicate = client.post(f"/members/{target_id}/view-requests")
    assert duplicate.status_code == HTTPStatus.CONFLICT
    assert duplicate.json()["code"] == "view_request_already_pending"

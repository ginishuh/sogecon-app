"""관리자 행사 관리 API 테스트 (목록, 수정, 삭제)."""

from __future__ import annotations

from datetime import datetime, timedelta
from http import HTTPStatus

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def anyio_backend() -> str:
    return "asyncio"


def _event_payload(title: str = "테스트 행사") -> dict:
    now = datetime.utcnow()
    starts = now + timedelta(days=1)
    ends = starts + timedelta(hours=2)
    return {
        "title": title,
        "location": "테스트홀",
        "capacity": 50,
        "starts_at": starts.isoformat(),
        "ends_at": ends.isoformat(),
    }


def _create_event(admin_login: TestClient, title: str = "테스트 행사") -> dict:
    payload = _event_payload(title)
    res = admin_login.post("/events/", json=payload)
    assert res.status_code == HTTPStatus.CREATED
    return res.json()


class TestAdminEventList:
    """관리자 행사 목록 API."""

    def test_admin_can_list_events(self, admin_login: TestClient) -> None:
        _create_event(admin_login, "행사 A")
        _create_event(admin_login, "행사 B")

        res = admin_login.get("/admin/events/")

        assert res.status_code == HTTPStatus.OK
        body = res.json()
        assert "items" in body and isinstance(body["items"], list)
        assert "total" in body and body["total"] >= 2

    def test_member_cannot_list_admin_events(self, admin_login: TestClient) -> None:
        _create_event(admin_login)
        admin_login.post("/auth/logout")
        admin_login.post(
            "/auth/member/login",
            json={"student_id": "member001", "password": "memberpass"},
        )

        res = admin_login.get("/admin/events/")
        assert res.status_code == HTTPStatus.UNAUTHORIZED


class TestAdminEventUpdate:
    """행사 수정 API."""

    def test_admin_can_update_event(self, admin_login: TestClient) -> None:
        evt = _create_event(admin_login)
        evt_id = evt["id"]

        res = admin_login.patch(
            f"/admin/events/{evt_id}",
            json={"title": "수정된 행사", "capacity": 120, "location": "대강당"},
        )

        assert res.status_code == HTTPStatus.OK
        body = res.json()
        assert body["title"] == "수정된 행사"
        assert body["capacity"] == 120
        assert body["location"] == "대강당"

    def test_update_requires_admin(self, admin_login: TestClient) -> None:
        evt = _create_event(admin_login)
        evt_id = evt["id"]

        admin_login.post("/auth/logout")
        admin_login.post(
            "/auth/member/login",
            json={"student_id": "member001", "password": "memberpass"},
        )

        res = admin_login.patch(f"/admin/events/{evt_id}", json={"title": "회원 수정"})
        assert res.status_code == HTTPStatus.UNAUTHORIZED

    def test_update_nonexistent_event(self, admin_login: TestClient) -> None:
        res = admin_login.patch("/admin/events/999999", json={"title": "없음"})
        assert res.status_code == HTTPStatus.NOT_FOUND


class TestAdminEventDelete:
    """행사 삭제 API."""

    def test_admin_can_delete_event(self, admin_login: TestClient) -> None:
        evt = _create_event(admin_login)
        evt_id = evt["id"]

        res = admin_login.delete(f"/admin/events/{evt_id}")
        assert res.status_code == HTTPStatus.NO_CONTENT

        res = admin_login.get(f"/events/{evt_id}")
        assert res.status_code == HTTPStatus.NOT_FOUND

    def test_delete_requires_admin(self, admin_login: TestClient) -> None:
        evt = _create_event(admin_login)
        evt_id = evt["id"]

        admin_login.post("/auth/logout")
        admin_login.post(
            "/auth/member/login",
            json={"student_id": "member001", "password": "memberpass"},
        )

        res = admin_login.delete(f"/admin/events/{evt_id}")
        assert res.status_code == HTTPStatus.UNAUTHORIZED

    def test_delete_nonexistent_event(self, admin_login: TestClient) -> None:
        res = admin_login.delete("/admin/events/999999")
        assert res.status_code == HTTPStatus.NOT_FOUND

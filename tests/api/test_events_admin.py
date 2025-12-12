"""관리자 행사 관리 API 테스트 (목록, 수정, 삭제)."""

from __future__ import annotations

from datetime import datetime, timedelta
from http import HTTPStatus

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def anyio_backend() -> str:
    return "asyncio"


def _event_payload(
    title: str = "테스트 행사",
    *,
    starts_at: datetime | None = None,
    ends_at: datetime | None = None,
) -> dict:
    now = datetime.now(datetime.UTC)
    starts = starts_at or (now + timedelta(days=1))
    ends = ends_at or (starts + timedelta(hours=2))
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
        assert body["items"][0]["rsvp_counts"] == {
            "going": 0,
            "waitlist": 0,
            "cancel": 0,
        }

    def test_admin_list_filters_by_title_and_status(
        self, admin_login: TestClient
    ) -> None:
        now = datetime.now(datetime.UTC)
        _create_event(
            admin_login,
            "미래 행사",
        )
        ongoing = _event_payload(
            "진행 행사",
            starts_at=now - timedelta(hours=1),
            ends_at=now + timedelta(hours=1),
        )
        ended = _event_payload(
            "종료 행사",
            starts_at=now - timedelta(days=2),
            ends_at=now - timedelta(days=1),
        )
        admin_login.post("/events/", json=ongoing)
        admin_login.post("/events/", json=ended)

        res = admin_login.get("/admin/events/?q=진행&status=ongoing")
        assert res.status_code == HTTPStatus.OK
        items = res.json()["items"]
        assert len(items) == 1
        assert items[0]["title"] == "진행 행사"

        res = admin_login.get("/admin/events/?status=ended")
        assert res.status_code == HTTPStatus.OK
        assert any(evt["title"] == "종료 행사" for evt in res.json()["items"])

    def test_admin_list_filters_by_date_range(self, admin_login: TestClient) -> None:
        base = datetime(2030, 1, 1, 9, 0, tzinfo=datetime.UTC)
        inside = _event_payload(
            "범위 안",
            starts_at=base,
            ends_at=base + timedelta(hours=2),
        )
        outside = _event_payload(
            "범위 밖",
            starts_at=base + timedelta(days=10),
            ends_at=base + timedelta(days=10, hours=2),
        )
        admin_login.post("/events/", json=inside)
        admin_login.post("/events/", json=outside)

        date_from = (base - timedelta(days=1)).isoformat()
        date_to = (base + timedelta(days=1)).isoformat()
        res = admin_login.get(
            f"/admin/events/?date_from={date_from}&date_to={date_to}"
        )
        assert res.status_code == HTTPStatus.OK
        titles = [evt["title"] for evt in res.json()["items"]]
        assert "범위 안" in titles
        assert "범위 밖" not in titles

    def test_admin_list_includes_rsvp_counts(self, admin_login: TestClient) -> None:
        event = _create_event(admin_login, "집계 테스트")
        e_id = event["id"]

        m1 = admin_login.post(
            "/members/",
            json={
                "student_id": "rc1",
                "email": "rc1@example.com",
                "name": "RC1",
                "cohort": 2025,
            },
        ).json()
        m2 = admin_login.post(
            "/members/",
            json={
                "student_id": "rc2",
                "email": "rc2@example.com",
                "name": "RC2",
                "cohort": 2025,
            },
        ).json()
        m3 = admin_login.post(
            "/members/",
            json={
                "student_id": "rc3",
                "email": "rc3@example.com",
                "name": "RC3",
                "cohort": 2025,
            },
        ).json()

        assert (
            admin_login.post(
                f"/events/{e_id}/rsvp",
                json={"member_id": m1["id"], "status": "going"},
            ).status_code
            == HTTPStatus.CREATED
        )
        assert (
            admin_login.post(
                f"/events/{e_id}/rsvp",
                json={"member_id": m2["id"], "status": "waitlist"},
            ).status_code
            == HTTPStatus.CREATED
        )
        assert (
            admin_login.post(
                f"/events/{e_id}/rsvp",
                json={"member_id": m3["id"], "status": "cancel"},
            ).status_code
            == HTTPStatus.CREATED
        )

        res = admin_login.get("/admin/events/?q=집계")
        assert res.status_code == HTTPStatus.OK
        item = res.json()["items"][0]
        assert item["rsvp_counts"] == {"going": 1, "waitlist": 1, "cancel": 1}

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

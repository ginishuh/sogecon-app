from __future__ import annotations

from http import HTTPStatus

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from apps.api.repositories import members as members_repo


def _create_member(
    client: TestClient,
    *,
    student_id: str,
    email: str,
    name: str,
    cohort: int,
) -> dict[str, object]:
    res = client.post(
        "/admin/members/",
        json={
            "student_id": student_id,
            "email": email,
            "name": name,
            "cohort": cohort,
            "roles": ["member"],
        },
    )
    assert res.status_code == HTTPStatus.CREATED
    return res.json()["member"]


def test_member_not_found_returns_problem_details(member_login: TestClient) -> None:
    res = member_login.get("/members/999999")
    assert res.status_code == HTTPStatus.NOT_FOUND
    data = res.json()
    assert data["status"] == HTTPStatus.NOT_FOUND
    assert data["code"] == "member_not_found"
    assert "detail" in data


def test_member_create_conflict_code(admin_login: TestClient) -> None:
    client = admin_login
    payload = {
        "student_id": "user001",
        "email": "user@example.com",
        "name": "User",
        "cohort": 2025,
        "roles": ["member"],
    }
    res1 = client.post("/admin/members/", json=payload)
    assert res1.status_code == HTTPStatus.CREATED

    res2 = client.post("/admin/members/", json=payload)
    assert res2.status_code == HTTPStatus.CONFLICT
    data = res2.json()
    assert data["status"] == HTTPStatus.CONFLICT
    assert data["code"] == "member_exists"


def test_member_create_email_conflict_code(admin_login: TestClient) -> None:
    client = admin_login
    first_payload = {
        "student_id": "phone001",
        "email": "phone001@example.com",
        "name": "Phone A",
        "cohort": 2025,
        "roles": ["member"],
    }
    second_payload = {
        "student_id": "phone002",
        "email": "phone001@example.com",
        "name": "Phone B",
        "cohort": 2025,
        "roles": ["member"],
    }
    res1 = client.post("/admin/members/", json=first_payload)
    assert res1.status_code == HTTPStatus.CREATED

    res2 = client.post("/admin/members/", json=second_payload)
    assert res2.status_code == HTTPStatus.CONFLICT
    data = res2.json()
    assert data["status"] == HTTPStatus.CONFLICT
    assert data["code"] == "member_exists"


def test_member_create_phone_integrity_error_maps_to_409(
    admin_login: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _raise_integrity_error(*_: object, **__: object) -> object:
        raise IntegrityError(
            "INSERT INTO members ...",
            {},
            Exception(
                'duplicate key value violates unique constraint "ix_members_phone"'
            ),
        )

    monkeypatch.setattr(members_repo, "create_member", _raise_integrity_error)
    # /members POST가 제거되어 더 이상 members_repo.create_member를 타지 않는다.
    # 회귀 방지 목적의 무의미한 테스트가 되지 않도록 404를 확인한다.
    res = admin_login.post(
        "/members/",
        json={
            "student_id": "phone_race_001",
            "email": "phone_race_001@example.com",
            "name": "Race",
            "cohort": 2025,
            "phone": "010-4444-4444",
        },
    )
    assert res.status_code == HTTPStatus.METHOD_NOT_ALLOWED


def test_post_not_found_returns_problem_details(client: TestClient) -> None:
    res = client.get("/posts/999999")
    assert res.status_code == HTTPStatus.NOT_FOUND
    data = res.json()
    assert data["status"] == HTTPStatus.NOT_FOUND
    assert data["code"] == "post_not_found"


def test_event_not_found_returns_problem_details(client: TestClient) -> None:
    res = client.get("/events/999999")
    assert res.status_code == HTTPStatus.NOT_FOUND
    data = res.json()
    assert data["status"] == HTTPStatus.NOT_FOUND
    assert data["code"] == "event_not_found"


def test_rsvp_not_found_returns_problem_details(admin_login: TestClient) -> None:
    client = admin_login
    # 선행: 회원/이벤트 생성
    m = _create_member(
        client,
        student_id="rsvp001",
        email="rsvp@example.com",
        name="RSVP",
        cohort=2025,
    )
    e = client.post(
        "/events/",
        json={
            "title": "Study",
            "starts_at": "2030-01-01T10:00:00Z",
            "ends_at": "2030-01-01T12:00:00Z",
            "location": "Seoul",
            "capacity": 10,
        },
    ).json()

    res = client.get(f"/rsvps/{m['id']}/{e['id']}")
    assert res.status_code == HTTPStatus.NOT_FOUND
    data = res.json()
    assert data["status"] == HTTPStatus.NOT_FOUND
    assert data["code"] == "rsvp_not_found"


def test_rsvp_create_conflict_code(admin_login: TestClient) -> None:
    client = admin_login
    # 선행: 회원/이벤트 생성
    m = _create_member(
        client,
        student_id="dup001",
        email="dup@example.com",
        name="Dup",
        cohort=2025,
    )
    e = client.post(
        "/events/",
        json={
            "title": "Meetup",
            "starts_at": "2030-01-02T10:00:00Z",
            "ends_at": "2030-01-02T12:00:00Z",
            "location": "Seoul",
            "capacity": 10,
        },
    ).json()

    payload = {"member_id": m["id"], "event_id": e["id"], "status": "going"}
    res1 = client.post("/rsvps/", json=payload)
    assert res1.status_code == HTTPStatus.CREATED

    res2 = client.post("/rsvps/", json=payload)
    assert res2.status_code == HTTPStatus.CONFLICT
    data = res2.json()
    assert data["status"] == HTTPStatus.CONFLICT
    assert data["code"] == "rsvp_exists"


def test_events_rsvp_upsert_create_and_update(admin_login: TestClient) -> None:
    client = admin_login
    # 선행: 회원/이벤트 생성
    m = _create_member(
        client,
        student_id="upsert001",
        email="upsert@example.com",
        name="Up Ser",
        cohort=2025,
    )
    e = client.post(
        "/events/",
        json={
            "title": "Workshop",
            "starts_at": "2030-02-01T10:00:00Z",
            "ends_at": "2030-02-01T12:00:00Z",
            "location": "Seoul",
            "capacity": 10,
        },
    ).json()

    # 생성(create)
    res_create = client.post(
        f"/events/{e['id']}/rsvp", json={"member_id": m["id"], "status": "going"}
    )
    assert res_create.status_code == HTTPStatus.CREATED
    assert res_create.json()["status"] == "going"

    # 갱신(update)
    res_update = client.post(
        f"/events/{e['id']}/rsvp", json={"member_id": m["id"], "status": "waitlist"}
    )
    assert res_update.status_code == HTTPStatus.CREATED  # 라우터가 201로 고정 반환
    assert res_update.json()["status"] == "waitlist"


def test_events_rsvp_invalid_enum_422(admin_login: TestClient) -> None:
    client = admin_login
    # 선행: 회원/이벤트 생성
    m = _create_member(
        client,
        student_id="enum001",
        email="enum@example.com",
        name="Enum",
        cohort=2025,
    )
    e = client.post(
        "/events/",
        json={
            "title": "Seminar",
            "starts_at": "2030-03-01T10:00:00Z",
            "ends_at": "2030-03-01T12:00:00Z",
            "location": "Seoul",
            "capacity": 10,
        },
    ).json()

    res = client.post(
        f"/events/{e['id']}/rsvp", json={"member_id": m["id"], "status": "invalid"}
    )
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

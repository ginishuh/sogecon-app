from __future__ import annotations

from http import HTTPStatus

from fastapi.testclient import TestClient


def test_member_not_found_returns_problem_details(client: TestClient) -> None:
    res = client.get("/members/999999")
    assert res.status_code == HTTPStatus.NOT_FOUND
    data = res.json()
    assert data["status"] == HTTPStatus.NOT_FOUND
    assert data["code"] == "member_not_found"
    assert "detail" in data


def test_member_create_conflict_code(admin_login: TestClient) -> None:
    client = admin_login
    payload = {"email": "user@example.com", "name": "User", "cohort": 2025}
    res1 = client.post("/members/", json=payload)
    assert res1.status_code == HTTPStatus.CREATED

    res2 = client.post("/members/", json=payload)
    assert res2.status_code == HTTPStatus.CONFLICT
    data = res2.json()
    assert data["status"] == HTTPStatus.CONFLICT
    assert data["code"] == "member_exists"


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


def test_rsvp_not_found_returns_problem_details(client: TestClient) -> None:
    # 선행: 회원/이벤트 생성
    m = client.post(
        "/members/",
        json={"email": "rsvp@example.com", "name": "RSVP", "cohort": 2025},
    ).json()
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


def test_rsvp_create_conflict_code(client: TestClient) -> None:
    # 선행: 회원/이벤트 생성
    m = client.post(
        "/members/",
        json={"email": "dup@example.com", "name": "Dup", "cohort": 2025},
    ).json()
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


def test_events_rsvp_upsert_create_and_update(client: TestClient) -> None:
    # 선행: 회원/이벤트 생성
    m = client.post(
        "/members/",
        json={"email": "upsert@example.com", "name": "Up Ser", "cohort": 2025},
    ).json()
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


def test_events_rsvp_invalid_enum_422(client: TestClient) -> None:
    # 선행: 회원/이벤트 생성
    m = client.post(
        "/members/",
        json={"email": "enum@example.com", "name": "Enum", "cohort": 2025},
    ).json()
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

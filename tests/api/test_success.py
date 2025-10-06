from __future__ import annotations

from http import HTTPStatus

from fastapi.testclient import TestClient


def test_create_post_and_get(client: TestClient) -> None:
    m = client.post(
        "/members/",
        json={"email": "author@example.com", "name": "Author", "cohort": 2025},
    ).json()
    p = client.post(
        "/posts/",
        json={
            "author_id": m["id"],
            "title": "Hello",
            "content": "World",
            "published_at": None,
        },
    ).json()
    res = client.get(f"/posts/{p['id']}")
    assert res.status_code == HTTPStatus.OK
    data = res.json()
    assert data["id"] == p["id"]
    assert data["title"] == "Hello"


def test_create_event_and_get(client: TestClient) -> None:
    e = client.post(
        "/events/",
        json={
            "title": "Small",
            "starts_at": "2030-01-01T09:00:00Z",
            "ends_at": "2030-01-01T10:00:00Z",
            "location": "Seoul",
            "capacity": 1,
        },
    ).json()
    res = client.get(f"/events/{e['id']}")
    assert res.status_code == HTTPStatus.OK
    assert res.json()["title"] == "Small"


def test_rsvp_capacity_v1_enforces_waitlist(client: TestClient) -> None:
    # capacity 1인 이벤트에 2명이 going을 시도하면 2번째는 waitlist
    e = client.post(
        "/events/",
        json={
            "title": "Cap1",
            "starts_at": "2030-04-01T09:00:00Z",
            "ends_at": "2030-04-01T10:00:00Z",
            "location": "Seoul",
            "capacity": 1,
        },
    ).json()
    m1 = client.post(
        "/members/",
        json={"email": "a@example.com", "name": "A", "cohort": 2025},
    ).json()
    m2 = client.post(
        "/members/",
        json={"email": "b@example.com", "name": "B", "cohort": 2025},
    ).json()

    r1 = client.post(
        f"/events/{e['id']}/rsvp", json={"member_id": m1["id"], "status": "going"}
    )
    assert r1.status_code == HTTPStatus.CREATED
    assert r1.json()["status"] == "going"

    r2 = client.post(
        f"/events/{e['id']}/rsvp", json={"member_id": m2["id"], "status": "going"}
    )
    assert r2.status_code == HTTPStatus.CREATED
    assert r2.json()["status"] == "waitlist"

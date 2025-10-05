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


def test_member_create_conflict_code(client: TestClient) -> None:
    payload = {"email": "user@example.com", "name": "User", "cohort": 2025}
    res1 = client.post("/members/", json=payload)
    assert res1.status_code == HTTPStatus.CREATED

    res2 = client.post("/members/", json=payload)
    assert res2.status_code == HTTPStatus.CONFLICT
    data = res2.json()
    assert data["status"] == HTTPStatus.CONFLICT
    assert data["code"] == "member_exists"

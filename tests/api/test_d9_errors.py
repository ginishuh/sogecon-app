from __future__ import annotations

from http import HTTPStatus

from fastapi.testclient import TestClient


def test_http_exception_returns_problem_details(member_login: TestClient) -> None:
    res = member_login.get("/admin/signup-requests")
    assert res.status_code == HTTPStatus.FORBIDDEN
    data = res.json()
    assert data["status"] == HTTPStatus.FORBIDDEN
    assert data["code"] == "admin_permission_required"
    assert data["detail"] == "admin_permission_required"
    assert "type" in data


def test_validation_error_returns_problem_details_shape(
    admin_login: TestClient,
) -> None:
    e = admin_login.post(
        "/events/",
        json={
            "title": "Seminar",
            "starts_at": "2030-03-01T10:00:00Z",
            "ends_at": "2030-03-01T12:00:00Z",
            "location": "Seoul",
            "capacity": 10,
        },
    ).json()

    res = admin_login.post(f"/events/{e['id']}/rsvp", json={"status": "invalid"})
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    data = res.json()
    assert data["status"] == HTTPStatus.UNPROCESSABLE_ENTITY
    assert data["code"] == "validation_error"
    assert isinstance(data["detail"], list)

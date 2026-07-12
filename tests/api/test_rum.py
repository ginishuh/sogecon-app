from http import HTTPStatus
from typing import cast

from fastapi.testclient import TestClient
from httpx import Response


def test_ingest_web_vital_v5_payload(client: TestClient) -> None:
    payload = {
        "name": "LCP",
        "id": "v5-1",
        "value": 1234.56,
        "delta": 1234.56,
        "rating": "good",
        "path": "/events",
        "navType": "back-forward-cache",
        "device": "mobile",
        "commit": "test-commit",
        "ts": 1_783_813_000_000,
    }

    response = cast(Response, client.post("/rum/vitals", json=payload))

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {"ok": "1"}
    assert "email" not in payload
    assert "student_id" not in payload


def test_ingest_web_vital_rejects_unknown_metric(client: TestClient) -> None:
    response = cast(
        Response,
        client.post(
            "/rum/vitals",
            json={
                "name": "FID",
                "id": "legacy",
                "value": 1,
                "rating": "good",
                "navType": "navigate",
            },
        ),
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

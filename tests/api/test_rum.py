from http import HTTPStatus
from typing import cast

from fastapi.testclient import TestClient
from httpx import Response
from pytest import LogCaptureFixture


def test_ingest_web_vital_v5_payload(
    client: TestClient, caplog: LogCaptureFixture
) -> None:
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
        "email": "private@example.com",
        "student_id": "private-student-id",
    }

    response = cast(Response, client.post("/rum/vitals", json=payload))

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {"ok": "1"}
    assert "private@example.com" not in caplog.text
    assert "private-student-id" not in caplog.text


def test_ingest_web_vital_accepts_legacy_navigation_type(client: TestClient) -> None:
    response = cast(
        Response,
        client.post(
            "/rum/vitals",
            json={
                "name": "LCP",
                "id": "v4-legacy",
                "value": 1,
                "navType": "back_forward",
            },
        ),
    )

    assert response.status_code == HTTPStatus.OK


def test_ingest_web_vital_accepts_omitted_v5_fields(client: TestClient) -> None:
    response = cast(
        Response,
        client.post(
            "/rum/vitals",
            json={"name": "TTFB", "id": "v4-optional", "value": 1},
        ),
    )

    assert response.status_code == HTTPStatus.OK


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


def test_ingest_web_vital_rejects_unknown_rating_and_navigation(
    client: TestClient,
) -> None:
    for field, value in (("rating", "average"), ("navType", "unknown")):
        response = cast(
            Response,
            client.post(
                "/rum/vitals",
                json={
                    "name": "LCP",
                    "id": f"invalid-{field}",
                    "value": 1,
                    field: value,
                },
            ),
        )

        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

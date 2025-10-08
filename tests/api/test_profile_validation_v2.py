from __future__ import annotations

from http import HTTPStatus

import pytest
from fastapi.testclient import TestClient


def test_me_update_requires_auth(client: TestClient) -> None:
    res = client.put("/me/", json={"phone": "010-1234-5678"})
    assert res.status_code == HTTPStatus.UNAUTHORIZED


def test_me_update_accepts_trimmed_phone(member_login: TestClient) -> None:
    res = member_login.put("/me/", json={"phone": " 010-1234-5678 "})
    assert res.status_code == HTTPStatus.OK
    assert res.json()["phone"] == "010-1234-5678"


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"phone": "abc12345"}, "phone"),
        ({"phone": "123456"}, "phone"),
        ({"company_phone": "123456789012345678901"}, "company_phone"),
        ({"department": ""}, "department"),
        ({"department": "x" * 81}, "department"),
        ({"job_title": "y" * 81}, "job_title"),
        ({"addr_personal": "z" * 201}, "addr_personal"),
        ({"addr_company": "z" * 201}, "addr_company"),
        ({"industry": ""}, "industry"),
        ({"industry": "i" * 61}, "industry"),
    ],
)
def test_me_update_invalid_payload_returns_422(
    member_login: TestClient, payload: dict[str, str], field: str
) -> None:
    res = member_login.put("/me/", json=payload)
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    body = res.json()
    assert isinstance(body["detail"], list)
    assert any(field in entry.get("loc", []) for entry in body["detail"])

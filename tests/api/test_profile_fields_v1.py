from __future__ import annotations

from http import HTTPStatus

from fastapi.testclient import TestClient


def test_me_profile_has_new_fields_defaults(member_login: TestClient) -> None:
    res = member_login.get("/me/")
    assert res.status_code == HTTPStatus.OK
    data = res.json()
    # 신규 필드 존재 및 기본 None
    for k in (
        "company",
        "department",
        "job_title",
        "company_phone",
        "addr_personal",
        "addr_company",
        "industry",
        "avatar_url",
    ):
        assert k in data
        assert data[k] is None


def test_me_update_new_fields_roundtrip(member_login: TestClient) -> None:
    payload = {
        "company": "Acme Corp",
        "department": "R&D",
        "job_title": "Engineer",
        "company_phone": "02-1234-5678",
        "addr_personal": "Seoul, KR",
        "addr_company": "Mapo-gu, Seoul, KR",
        "industry": "Manufacturing",
    }
    res = member_login.put("/me/", json=payload)
    assert res.status_code == HTTPStatus.OK
    data = res.json()
    for k, v in payload.items():
        assert data.get(k) == v

    res2 = member_login.get("/me/")
    assert res2.status_code == HTTPStatus.OK
    data2 = res2.json()
    for k, v in payload.items():
        assert data2.get(k) == v

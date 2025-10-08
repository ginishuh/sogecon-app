from __future__ import annotations

from http import HTTPStatus

from fastapi.testclient import TestClient

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app


def _seed_members(n: int = 5) -> None:
    override = app.dependency_overrides.get(get_db)
    assert override is not None
    gen = override()
    db = next(gen)
    try:
        # clear existing for deterministic results
        db.query(models.Member).delete()
        # seed
        payloads = [
            dict(
                email="a@example.com",
                name="Alice",
                cohort=1,
                major="Economics",
                company="Acme",
                industry="Manufacturing",
                addr_personal="Seoul",
                addr_company="Seoul",
            ),
            dict(
                email="b@example.com",
                name="Bob",
                cohort=1,
                major="Business",
                company="Beta",
                industry="Finance",
                addr_personal="Busan",
                addr_company="Seoul",
            ),
            dict(
                email="c@example.com",
                name="Charlie",
                cohort=2,
                major="Economics",
                company="Acme",
                industry="Finance",
                addr_personal="Incheon",
                addr_company="Incheon",
            ),
            dict(
                email="d@example.com",
                name="Dana",
                cohort=2,
                major="Law",
                company="Delta",
                industry="Manufacturing",
                addr_personal="Daegu",
                addr_company="Busan",
            ),
            dict(
                email="e@example.com",
                name="Eve",
                cohort=3,
                major="Economics",
                company="Echo",
                industry="IT",
                addr_personal="Seoul",
                addr_company="Seoul",
            ),
        ]
        for p in payloads:
            db.add(models.Member(**p, roles="member"))
        db.commit()
    finally:
        db.close()
        try:
            gen.close()
        except Exception:
            pass


def test_filter_by_industry_and_company_and_region(client: TestClient) -> None:
    _seed_members()

    # industry=Finance → expected two (c, b)
    r1 = client.get("/members/count", params={"industry": "Finance"})
    assert r1.status_code == HTTPStatus.OK
    finance_expected = 2
    assert r1.json()["count"] == finance_expected

    # company=Acme → expected two (a, c)
    r2 = client.get("/members/count", params={"company": "Acme"})
    assert r2.status_code == HTTPStatus.OK
    acme_expected = 2
    assert r2.json()["count"] == acme_expected

    # region=Seoul → in personal or company address (a, e, b)
    r3 = client.get("/members/count", params={"region": "Seoul"})
    assert r3.status_code == HTTPStatus.OK
    seoul_expected = 3
    assert r3.json()["count"] == seoul_expected

    # combo: industry=Manufacturing & region=Seoul → only 'a'
    r4 = client.get(
        "/members/count", params={"industry": "Manufacturing", "region": "Seoul"}
    )
    assert r4.status_code == HTTPStatus.OK
    assert r4.json()["count"] == 1

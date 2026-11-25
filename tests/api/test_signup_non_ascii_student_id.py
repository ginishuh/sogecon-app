"""학번을 기억하지 못해 한글 등으로 적은 가입 신청(운영 실제 사례) 회귀 테스트.

ASCII가 아닌 학번은 변형 매칭 없이 원문(앞뒤 공백 제거) 완전 일치로만 비교한다.
PostgreSQL `lower`와 Python `lower`가 다른 문자가 비교에 끼어들지 않아야 한다.
"""

from __future__ import annotations

from http import HTTPStatus
from typing import cast

import pytest
from fastapi.testclient import TestClient
from pytest import MonkeyPatch
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.student_id_key import student_id_lock_name
from tests.api.signup_helpers import (
    configure_smtp,
    run_in_test_session,
    seed_member,
    signup,
)

_KELVIN = chr(0x212A)  # KELVIN SIGN: Python lower → "k", ASCII 아님


def _member_status(student_id: str) -> str | None:
    out: dict[str, str | None] = {}

    async def _load(session: AsyncSession) -> None:
        out["s"] = cast(
            str | None,
            (
                await session.execute(
                    select(models.Member.status).where(
                        models.Member.student_id == student_id
                    )
                )
            ).scalar_one_or_none(),
        )

    run_in_test_session(_load)
    return out["s"]


@pytest.mark.parametrize(
    ("raw", "stored"),
    [
        ("기억안남", "기억안남"),
        ("기억안나요 ㅠㅠ", "기억안나요 ㅠㅠ"),
        (" 경제대학원 2020 ", "경제대학원 2020"),
    ],
)
def test_non_ascii_student_id_signup_and_approval_work(
    admin_login: TestClient, monkeypatch: MonkeyPatch, raw: str, stored: str
) -> None:
    sent = configure_smtp(monkeypatch)

    res = signup(admin_login, student_id=raw, email="forgot@test.example.com")

    assert res.status_code == HTTPStatus.CREATED, res.text
    assert res.json()["student_id"] == stored
    approve = admin_login.post(f"/admin/signup-requests/{res.json()['id']}/approve")
    assert approve.status_code == HTTPStatus.OK, approve.text
    assert approve.json()["activation_email"]["status"] == "sent"
    assert [m["To"] for m in sent] == ["forgot@test.example.com"]
    assert _member_status(stored) == "active"


@pytest.mark.parametrize("raw", ["기억안남", "  기억안남 "])
def test_non_ascii_student_id_conflicts_with_exact_active_member(
    client: TestClient, raw: str
) -> None:
    seed_member(student_id="기억안남", email="forgot-old@test.example.com")

    res = signup(client, student_id=raw, email="forgot-new@test.example.com")

    assert res.status_code == HTTPStatus.CONFLICT
    assert res.json()["code"] == "member_already_active"


def test_non_ascii_student_id_has_no_variant_matching(client: TestClient) -> None:
    """한글 원문은 `s` 제거·대소문자 변형으로 묶지 않는다."""
    seed_member(student_id="s기억안남", email="s-forgot@test.example.com")

    res = signup(client, student_id="기억안남", email="forgot2@test.example.com")

    assert res.status_code == HTTPStatus.CREATED


@pytest.mark.parametrize(
    ("existing", "requested"),
    [
        ("i61041", "İ61041"),  # 비ASCII 입력 → 완전 일치만
        ("k61041", f"{_KELVIN}61041"),  # Python lower면 'k61041'이 되는 입력
        (f"{_KELVIN}61042", "k61042"),  # 비ASCII 저장값은 ASCII 키 비교에서 제외
        ("İ61043", "i61043"),
    ],
)
def test_lowercase_differences_never_join_ascii_and_non_ascii_ids(
    client: TestClient, existing: str, requested: str
) -> None:
    seed_member(
        student_id=existing, email=f"{existing.encode().hex()}@test.example.com"
    )

    res = signup(client, student_id=requested, email="lower@test.example.com")

    assert res.status_code == HTTPStatus.CREATED, res.text


def test_exact_non_ascii_member_still_conflicts(client: TestClient) -> None:
    seed_member(student_id="İ61044", email="dotted@test.example.com")

    res = signup(client, student_id="İ61044", email="dotted2@test.example.com")

    assert res.status_code == HTTPStatus.CONFLICT
    assert res.json()["code"] == "member_already_active"


def test_lock_name_uses_key_for_ascii_and_raw_text_otherwise() -> None:
    assert student_id_lock_name(" S61041") == student_id_lock_name("61041")
    assert student_id_lock_name("기억안남") == student_id_lock_name(" 기억안남 ")
    assert student_id_lock_name("기억안남") != student_id_lock_name("s기억안남")
    assert student_id_lock_name("İ61041") != student_id_lock_name("i61041")

"""가입 승인 보안·견고성 회귀 테스트.

- 기존 계정(비밀번호·운영 역할·정지/반려)을 일반 가입 승인으로 넘겨주지 않는다.
- 저장된 학번에도 같은 학번 키 규칙을 적용한다(공백, `ss` 접두).
- 승인 커밋 이후의 어떤 발송 실패도 승인 응답을 500으로 바꾸지 않는다.
- UNIQUE 위반이 아닌 IntegrityError는 409로 숨기지 않는다.
"""

from __future__ import annotations

from email.message import EmailMessage
from http import HTTPStatus
from typing import cast

import pytest
from fastapi.testclient import TestClient
from pytest import MonkeyPatch
from sqlalchemy import literal, select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.services import email_service, signup_approval_service, signup_service
from apps.api.student_id_key import student_id_key, student_id_key_sql
from tests.api.signup_helpers import (
    configure_smtp,
    db_state,
    run_in_test_session,
    seed_member,
    signup,
    signup_id_of,
)


def _member_snapshot(student_id: str) -> tuple[str | None, str, str]:
    out: dict[str, tuple[str | None, str, str]] = {}

    async def _load(session: AsyncSession) -> None:
        member = (
            await session.execute(
                select(models.Member).where(models.Member.student_id == student_id)
            )
        ).scalar_one()
        out["m"] = (
            cast(str | None, member.email),
            cast(str, member.status),
            cast(str, member.roles),
        )

    run_in_test_session(_load)
    return out["m"]


def _set_roles(student_id: str, roles: str) -> None:
    async def _update(session: AsyncSession) -> None:
        member = (
            await session.execute(
                select(models.Member).where(models.Member.student_id == student_id)
            )
        ).scalar_one()
        setattr(member, "roles", roles)
        await session.commit()

    run_in_test_session(_update)


# --- 1. 기존 계정 재사용 제한 -------------------------------------------------


@pytest.mark.parametrize(
    ("status", "with_password", "roles"),
    [
        ("suspended", True, "member,admin,admin_signup"),
        ("suspended", False, "member"),
        ("rejected", False, "member"),
        ("pending", True, "member"),
        ("pending", False, "member,admin"),
    ],
)
def test_approve_refuses_to_hand_over_existing_account(
    admin_login: TestClient,
    monkeypatch: MonkeyPatch,
    status: str,
    with_password: bool,
    roles: str,
) -> None:
    sent = configure_smtp(monkeypatch)
    seed_member(
        student_id="s63001",
        email="owner63001@test.example.com",
        status=status,
        with_password=with_password,
    )
    _set_roles("s63001", roles)
    signup_id = signup_id_of(
        admin_login, student_id="s63001", email="newcomer63001@test.example.com"
    )

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert res.status_code == HTTPStatus.CONFLICT
    body = res.json()
    assert body["code"] == "signup_member_account_exists"
    assert "s63001" in body["detail"]
    assert "owner63001" not in body["detail"]
    assert sent == []
    assert db_state(signup_id) == ("pending", ["s63001"])
    assert _member_snapshot("s63001") == ("owner63001@test.example.com", status, roles)


def test_approve_refuses_preregistered_member_with_different_email(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    """사전 등록 행의 프로필을 다른 주소 수신인에게 넘기지 않는다."""
    sent = configure_smtp(monkeypatch)
    seed_member(
        student_id="s63002",
        email="old63002@test.example.com",
        status="pending",
        with_password=False,
    )
    signup_id = signup_id_of(
        admin_login, student_id="s63002", email="new63002@test.example.com"
    )

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert res.status_code == HTTPStatus.CONFLICT
    body = res.json()
    assert body["code"] == "signup_member_email_mismatch"
    assert "s63002" in body["detail"]
    assert "63002@" not in body["detail"]
    assert sent == []
    assert db_state(signup_id) == ("pending", ["s63002"])
    assert _member_snapshot("s63002") == (
        "old63002@test.example.com",
        "pending",
        "member",
    )


@pytest.mark.parametrize(
    ("stored", "requested", "expected_email"),
    [
        (" Same63006@Test.example.com ", "same63006@test.example.com",
         " Same63006@Test.example.com "),
        (None, "fill63006@test.example.com", "fill63006@test.example.com"),
        ("", "blank63006@test.example.com", "blank63006@test.example.com"),
    ],
)
def test_approve_reuses_preregistered_member_with_same_or_empty_email(
    admin_login: TestClient,
    monkeypatch: MonkeyPatch,
    stored: str | None,
    requested: str,
    expected_email: str,
) -> None:
    sent = configure_smtp(monkeypatch)
    seed_member(
        student_id="s63006", email=stored, status="pending", with_password=False
    )
    signup_id = signup_id_of(admin_login, student_id="s63006", email=requested)

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert res.status_code == HTTPStatus.OK, res.text
    # 안내 메일은 회원에 저장된 주소(앞뒤 공백 제외)로 간다.
    assert res.json()["activation_email"]["sent_to"] == expected_email.strip()
    assert [m["To"] for m in sent] == [expected_email.strip()]
    assert db_state(signup_id) == ("approved", ["s63006"])
    assert _member_snapshot("s63006") == (expected_email, "active", "member")


# --- 4. 저장 값에도 같은 학번 키 ---------------------------------------------


_KEY_SAMPLES = [
    "S90041",
    "90041",
    " s 90041\t",
    "ss70001",
    "Ss70001",
    "s",
    "",
    "__seed__admin",
    "SX-12",
    "12s3",
]


def test_student_id_key_sql_matches_python_key(client: TestClient) -> None:
    del client  # 테스트 DB 준비용
    out: dict[str, list[str]] = {}

    async def _eval(session: AsyncSession) -> None:
        values: list[str] = []
        for sample in _KEY_SAMPLES:
            result = await session.execute(
                select(student_id_key_sql(literal(sample)))
            )
            values.append(cast(str, result.scalar_one()))
        out["sql"] = values

    run_in_test_session(_eval)
    assert out["sql"] == [student_id_key(sample) for sample in _KEY_SAMPLES]


def test_signup_matches_stored_student_id_with_whitespace(client: TestClient) -> None:
    seed_member(student_id=" S70011 ", email="ws70011@test.example.com")

    res = signup(client, student_id="s70011", email="other70011@test.example.com")

    assert res.status_code == HTTPStatus.CONFLICT
    assert res.json()["code"] == "member_already_active"


def test_signup_does_not_strip_two_leading_s(client: TestClient) -> None:
    """`ss70012`의 키는 `s70012`이므로 저장값 `s70012`(키 `70012`)와 다르다."""
    seed_member(student_id="s70012", email="s70012@test.example.com")

    res = signup(client, student_id="ss70012", email="ss70012@test.example.com")

    assert res.status_code == HTTPStatus.CREATED


# --- 5. 커밋 이후 예외 격리 ---------------------------------------------------


def test_approve_survives_unexpected_error_while_building_mail(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    configure_smtp(monkeypatch)

    def broken_builder(**_kwargs: object) -> EmailMessage:
        raise ValueError("template broken")

    monkeypatch.setattr(email_service, "build_activation_message", broken_builder)
    signup_id = signup_id_of(
        admin_login, student_id="s63003", email="s63003@test.example.com"
    )

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert res.status_code == HTTPStatus.OK
    body = res.json()
    assert body["request"]["status"] == "approved"
    assert body["activation_token"]
    assert body["activation_email"] == {
        "status": "failed",
        "sent_to": None,
        "error_code": "email_send_failed",
    }
    assert db_state(signup_id) == ("approved", ["s63003"])


def test_approve_survives_db_failure_after_commit(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    configure_smtp(monkeypatch)

    async def db_down(*_args: object, **_kwargs: object) -> None:
        raise OperationalError("SELECT 1", {}, Exception("connection lost"))

    monkeypatch.setattr(signup_service, "resolve_activation_signup_request", db_down)
    signup_id = signup_id_of(
        admin_login, student_id="s63004", email="s63004@test.example.com"
    )

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert res.status_code == HTTPStatus.OK
    body = res.json()
    assert body["activation_email"]["status"] == "failed"
    assert body["activation_issue"]["issued_type"] == "approve"
    assert db_state(signup_id) == ("approved", ["s63004"])


# --- 7. UNIQUE 위반만 409 ----------------------------------------------------


class _ForeignKeyViolation(Exception):
    sqlstate = "23503"


def test_approve_does_not_mask_non_unique_integrity_error(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    async def fk_violation(*_args: object, **_kwargs: object) -> None:
        raise IntegrityError("INSERT ...", {}, _ForeignKeyViolation())

    monkeypatch.setattr(signup_approval_service, "issue_activation_token", fk_violation)
    signup_id = signup_id_of(
        admin_login, student_id="s63005", email="s63005@test.example.com"
    )

    with pytest.raises(IntegrityError):
        admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert db_state(signup_id) == ("pending", [])

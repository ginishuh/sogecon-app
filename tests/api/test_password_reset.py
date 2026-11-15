from __future__ import annotations

import asyncio
import re
from email.message import EmailMessage
from http import HTTPStatus

import httpx
import pytest
from fastapi.testclient import TestClient
from pytest import MonkeyPatch
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.config import reset_settings_cache
from apps.api.db import get_db
from apps.api.main import app
from apps.api.passwords import hash_password
from apps.api.repositories import auth as auth_repo
from apps.api.services import email_service, password_reset_service
from apps.api.services.activation_service import create_member_activation_token
from tests.api.problem_assertions import assert_problem_code

REQUEST = "/auth/member/password-reset/request"
CONFIRM = "/auth/member/password-reset/confirm"
MATCHING = {"student_id": "member001", "email": "member@example.com"}
_TOKEN_RE = re.compile(r"/reset-password#token=([A-Za-z0-9_\-.]+)")


def _configure_smtp(monkeypatch: MonkeyPatch) -> list[EmailMessage]:
    monkeypatch.setenv("SMTP_USERNAME", "office@test.example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "not-a-real-app-password")
    monkeypatch.setenv("SMTP_FROM_EMAIL", "office@test.example.com")
    monkeypatch.setenv("PUBLIC_SITE_URL", "https://sogangeconomics.com")
    reset_settings_cache()
    sent: list[EmailMessage] = []

    def fake_deliver(message: EmailMessage, settings: object = None) -> None:
        sent.append(message)

    monkeypatch.setattr(email_service, "deliver_message", fake_deliver)
    return sent


@pytest.fixture()
def member_client(member_login: TestClient) -> TestClient:
    """member001 / member@example.com / memberpass 시드 후 로그아웃 상태."""
    member_login.post("/auth/logout")
    return member_login


def _token_from(message: EmailMessage) -> str:
    body = message.get_body(preferencelist=("plain",))
    assert body is not None
    match = _TOKEN_RE.search(body.get_content())
    assert match is not None
    return match.group(1)


def _login(client: TestClient, password: str) -> int:
    return client.post(
        "/auth/member/login",
        json={"student_id": "member001", "password": password},
    ).status_code


def _set_member_status(status: str) -> None:
    override = app.dependency_overrides[get_db]

    async def _run() -> None:
        async for session in override():
            stmt = select(models.Member).where(models.Member.student_id == "member001")
            member = (await session.execute(stmt)).scalar_one()
            member.status = status
            await session.commit()
            break

    asyncio.run(_run())


def test_reset_flow_sets_new_password_and_token_is_single_use(
    member_client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    sent = _configure_smtp(monkeypatch)

    res = member_client.post(
        REQUEST, json={"student_id": " member001 ", "email": "Member@Example.com "}
    )
    assert res.status_code == HTTPStatus.ACCEPTED
    assert res.json() == {"ok": "true"}
    assert len(sent) == 1
    assert sent[0]["To"] == "member@example.com"
    token = _token_from(sent[0])
    html_body = sent[0].get_body(preferencelist=("html",))
    assert html_body is not None
    assert "새 비밀번호 만들기" in html_body.get_content()
    # 토큰은 서버·프록시 로그에 남지 않도록 쿼리가 아닌 fragment로만 전달한다.
    plain_body = sent[0].get_body(preferencelist=("plain",))
    assert plain_body is not None
    for content in (plain_body.get_content(), html_body.get_content()):
        assert "?token=" not in content
        assert f"https://sogangeconomics.com/reset-password#token={token}" in content

    confirm = member_client.post(
        CONFIRM, json={"token": token, "password": "brand-new-pass"}
    )
    assert confirm.status_code == HTTPStatus.OK
    # 재설정 후에는 로그인 상태가 아니다.
    assert member_client.get("/auth/session").status_code == HTTPStatus.UNAUTHORIZED
    assert _login(member_client, "memberpass") == HTTPStatus.UNAUTHORIZED
    assert _login(member_client, "brand-new-pass") == HTTPStatus.OK

    reuse = member_client.post(
        CONFIRM, json={"token": token, "password": "another-pass-1"}
    )
    assert reuse.status_code == HTTPStatus.BAD_REQUEST
    assert_problem_code(reuse.json(), "invalid_or_expired_reset_token")
    assert _login(member_client, "brand-new-pass") == HTTPStatus.OK


@pytest.mark.parametrize(
    "payload",
    [
        {"student_id": "member001", "email": "someone-else@example.com"},
        {"student_id": "no-such-member", "email": "member@example.com"},
    ],
)
def test_mismatched_request_looks_identical_and_sends_nothing(
    member_client: TestClient, monkeypatch: MonkeyPatch, payload: dict[str, str]
) -> None:
    sent = _configure_smtp(monkeypatch)

    res = member_client.post(REQUEST, json=payload)

    assert res.status_code == HTTPStatus.ACCEPTED
    assert res.json() == {"ok": "true"}
    assert sent == []


def test_inactive_member_gets_no_mail_and_cannot_use_issued_token(
    member_client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    sent = _configure_smtp(monkeypatch)
    member_client.post(REQUEST, json=MATCHING)
    token = _token_from(sent[0])

    _set_member_status("suspended")
    again = member_client.post(
        REQUEST, json=MATCHING
    )
    assert again.status_code == HTTPStatus.ACCEPTED
    assert len(sent) == 1

    confirm = member_client.post(
        CONFIRM, json={"token": token, "password": "brand-new-pass"}
    )
    assert confirm.status_code == HTTPStatus.FORBIDDEN
    assert_problem_code(confirm.json(), "member_not_active")


def test_password_change_after_issue_invalidates_reset_link(
    member_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    sent = _configure_smtp(monkeypatch)
    member_login.post(REQUEST, json=MATCHING)
    token = _token_from(sent[0])

    changed = member_login.post(
        "/auth/member/change-password",
        json={"current_password": "memberpass", "new_password": "changed-pass-1"},
    )
    assert changed.status_code == HTTPStatus.OK

    res = member_login.post(
        CONFIRM, json={"token": token, "password": "brand-new-pass"}
    )
    assert res.status_code == HTTPStatus.BAD_REQUEST
    assert_problem_code(res.json(), "invalid_or_expired_reset_token")


def test_expired_or_tampered_token_is_rejected(
    member_client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    sent = _configure_smtp(monkeypatch)
    member_client.post(REQUEST, json=MATCHING)
    token = _token_from(sent[0])

    tampered = member_client.post(
        CONFIRM, json={"token": token[:-2] + "xx", "password": "brand-new-pass"}
    )
    assert tampered.status_code == HTTPStatus.BAD_REQUEST
    assert_problem_code(tampered.json(), "invalid_or_expired_reset_token")

    monkeypatch.setattr(
        password_reset_service, "PASSWORD_RESET_TOKEN_MAX_AGE_SECONDS", -1
    )
    expired = member_client.post(
        CONFIRM, json={"token": token, "password": "brand-new-pass"}
    )
    assert expired.status_code == HTTPStatus.BAD_REQUEST
    assert_problem_code(expired.json(), "invalid_or_expired_reset_token")
    assert _login(member_client, "memberpass") == HTTPStatus.OK


def test_activation_token_cannot_be_used_as_reset_token(
    member_client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    activation = create_member_activation_token(
        signup_request_id=1, student_id="member001", cohort=1, name="Member"
    )
    res = member_client.post(
        CONFIRM, json={"token": activation, "password": "brand-new-pass"}
    )
    assert res.status_code == HTTPStatus.BAD_REQUEST
    assert_problem_code(res.json(), "invalid_or_expired_reset_token")


def test_confirm_rejects_password_over_72_utf8_bytes(client: TestClient) -> None:
    res = client.post(CONFIRM, json={"token": "not-used", "password": "한" * 25})
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_request_without_smtp_reports_unavailable_without_account_lookup(
    member_client: TestClient,
) -> None:
    res = member_client.post(
        REQUEST, json={"student_id": "no-such-member", "email": "x@example.com"}
    )
    assert res.status_code == HTTPStatus.CONFLICT
    assert_problem_code(res.json(), "email_not_configured")


@pytest.mark.usefixtures("enable_rate_limit")
def test_request_is_rate_limited_per_client(
    member_client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    monkeypatch.setenv("RATE_LIMIT_PASSWORD_RESET", "2/hour")
    sent = _configure_smtp(monkeypatch)
    payload = MATCHING

    assert member_client.post(REQUEST, json=payload).status_code == HTTPStatus.ACCEPTED
    assert member_client.post(REQUEST, json=payload).status_code == HTTPStatus.ACCEPTED
    limited = member_client.post(REQUEST, json=payload)
    assert limited.status_code == HTTPStatus.TOO_MANY_REQUESTS
    assert len(sent) == 2


def test_non_ascii_email_does_not_reveal_account(
    member_client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    sent = _configure_smtp(monkeypatch)

    for student_id in ("member001", "no-such-member"):
        res = member_client.post(
            REQUEST, json={"student_id": student_id, "email": "한@example.com"}
        )
        assert res.status_code == HTTPStatus.ACCEPTED
        assert res.json() == {"ok": "true"}
    assert sent == []


async def test_concurrent_confirms_with_same_token_only_one_succeeds(
    async_client: httpx.AsyncClient, monkeypatch: MonkeyPatch
) -> None:
    override = app.dependency_overrides[get_db]
    async for session in override():
        member = models.Member(
            student_id="race001",
            email="race@example.com",
            name="Race",
            cohort=1,
            roles="member",
            visibility=models.Visibility.PRIVATE,
        )
        session.add(member)
        await session.commit()
        await session.refresh(member)
        old_hash = hash_password("old-pass-123")
        session.add(
            models.MemberAuth(
                member_id=member.id, student_id="race001", password_hash=old_hash
            )
        )
        await session.commit()
        break
    token = password_reset_service.create_password_reset_token(
        student_id="race001", password_hash=old_hash
    )

    # 두 요청이 모두 기존 해시를 읽은 뒤에야 진행하도록 맞춰 경합을 재현한다.
    original_lookup = auth_repo.get_member_with_auth_by_student_id
    arrived = 0
    both_read = asyncio.Event()

    async def lookup_then_wait(
        db: AsyncSession, student_id: str
    ) -> tuple[models.Member | None, models.MemberAuth | None]:
        nonlocal arrived
        result = await original_lookup(db, student_id)
        arrived += 1
        if arrived >= 2:
            both_read.set()
        await asyncio.wait_for(both_read.wait(), timeout=5)
        return result

    monkeypatch.setattr(
        auth_repo, "get_member_with_auth_by_student_id", lookup_then_wait
    )

    results = await asyncio.gather(
        async_client.post(CONFIRM, json={"token": token, "password": "winner-pass-1"}),
        async_client.post(CONFIRM, json={"token": token, "password": "winner-pass-2"}),
    )

    codes = sorted(res.status_code for res in results)
    assert codes == [HTTPStatus.OK, HTTPStatus.BAD_REQUEST]

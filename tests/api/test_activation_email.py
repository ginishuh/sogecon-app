from __future__ import annotations

import smtplib
from email.message import EmailMessage
from http import HTTPStatus

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from pytest import MonkeyPatch
from sqlalchemy.exc import SQLAlchemyError

from apps.api.config import Settings, reset_settings_cache
from apps.api.errors import BadGatewayError
from apps.api.main import app
from apps.api.services import email_service, signup_service
from tests.api.problem_assertions import assert_problem_code

_PG = "postgresql+psycopg://app:devpass@localhost:5433/appdb"
_STRONG_JWT = "activation-mail-test-jwt-secret-32chars"


@pytest.fixture()
def anyio_backend() -> str:
    return "asyncio"


def _must_not_send(*_args: object, **_kwargs: object) -> None:
    raise AssertionError("must not send")


def _configure_smtp(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("SMTP_USERNAME", "office@test.example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "not-a-real-app-password")
    monkeypatch.setenv("SMTP_FROM_EMAIL", "office@test.example.com")
    monkeypatch.setenv("SMTP_FROM_NAME", "서강대 경제대학원 총동문회")
    monkeypatch.setenv("PUBLIC_SITE_URL", "https://sogangeconomics.com")
    reset_settings_cache()


def _create_approved_signup(
    admin_login: TestClient,
    *,
    student_id: str = "s116801",
    email: str = "s116801@test.example.com",
    phone: str = "010-2801-0001",
) -> tuple[int, str, str, int]:
    create_res = admin_login.post(
        "/auth/member/signup",
        json={
            "student_id": student_id,
            "email": email,
            "name": "메일대상",
            "cohort": 2024,
            "phone": phone,
        },
    )
    assert create_res.status_code == HTTPStatus.CREATED
    signup_id = create_res.json()["id"]
    approve_res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")
    assert approve_res.status_code == HTTPStatus.OK
    body = approve_res.json()
    token = body["activation_token"]
    issue_id = body["activation_issue"]["id"]
    assert isinstance(token, str)
    return signup_id, token, email, issue_id


def test_send_activation_email_success(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    _configure_smtp(monkeypatch)
    sent: list[EmailMessage] = []

    def fake_deliver(message: EmailMessage, settings: object = None) -> None:
        sent.append(message)

    monkeypatch.setattr(email_service, "deliver_message", fake_deliver)
    signup_id, token, email, issue_id = _create_approved_signup(admin_login)

    res = admin_login.post(
        f"/admin/signup-requests/{signup_id}/send-activation-email",
        json={"activation_token": token},
    )
    assert res.status_code == HTTPStatus.OK
    assert res.json() == {"sent_to": email}
    assert len(sent) == 1
    body = sent[0].get_body(preferencelist=("plain",))
    assert body is not None
    text = body.get_content()
    assert "가입이 승인되었습니다" in text
    assert "https://sogangeconomics.com/activate?token=" in text
    assert token in text
    assert "메일대상" in text
    html_body = sent[0].get_body(preferencelist=("html",))
    assert html_body is not None
    html_text = html_body.get_content()
    assert token in html_text
    assert "비밀번호 만들기" in html_text
    assert f'cid:{email_service.ACTIVATION_HERO_CID}' in html_text
    assert sent[0]["To"] == email
    image_parts = [
        part
        for part in sent[0].walk()
        if part.get_content_type() == "image/jpeg"
    ]
    assert len(image_parts) == 1
    assert email_service.ACTIVATION_HERO_CID in (image_parts[0]["Content-ID"] or "")
    logs = admin_login.get(
        f"/admin/signup-requests/{signup_id}/activation-token-logs"
    )
    assert logs.status_code == HTTPStatus.OK
    send_item = next(
        item for item in logs.json()["items"] if item["issued_type"] == "send"
    )
    assert send_item["issued_by_student_id"] == "__seed__admin"
    assert send_item["recipient_masked"] == "s***@test.example.com"
    assert send_item["related_issue_id"] == issue_id
    assert token not in str(send_item)


def test_send_activation_email_succeeds_when_audit_write_fails(
    admin_login: TestClient, monkeypatch: MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    _configure_smtp(monkeypatch)
    sent: list[EmailMessage] = []

    def fake_deliver(message: EmailMessage, settings: object = None) -> None:
        sent.append(message)

    monkeypatch.setattr(email_service, "deliver_message", fake_deliver)
    signup_id, token, email, _issue_id = _create_approved_signup(admin_login)

    async def fail_audit(*_args: object, **_kwargs: object) -> None:
        raise SQLAlchemyError("audit write failed")

    monkeypatch.setattr(
        signup_service.signup_requests_repo,
        "create_activation_issue_log",
        fail_audit,
    )
    with caplog.at_level("ERROR"):
        res = admin_login.post(
            f"/admin/signup-requests/{signup_id}/send-activation-email",
            json={"activation_token": token},
        )
    assert res.status_code == HTTPStatus.OK
    assert res.json() == {"sent_to": email}
    assert len(sent) == 1
    logs = admin_login.get(
        f"/admin/signup-requests/{signup_id}/activation-token-logs"
    )
    assert logs.status_code == HTTPStatus.OK
    assert all(item["issued_type"] != "send" for item in logs.json()["items"])
    assert "activation_email_audit_failed" in caplog.text
    assert token not in caplog.text
    assert email not in caplog.text


def test_send_activation_email_not_configured(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    monkeypatch.setattr(email_service, "deliver_message", _must_not_send)
    signup_id, token, _email, _issue_id = _create_approved_signup(admin_login)
    res = admin_login.post(
        f"/admin/signup-requests/{signup_id}/send-activation-email",
        json={"activation_token": token},
    )
    assert res.status_code == HTTPStatus.CONFLICT
    assert_problem_code(res.json(), "email_not_configured")


def test_send_activation_email_invalid_token(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    _configure_smtp(monkeypatch)
    monkeypatch.setattr(email_service, "deliver_message", lambda *_a, **_k: None)
    signup_id, _token, _email, _issue_id = _create_approved_signup(admin_login)
    res = admin_login.post(
        f"/admin/signup-requests/{signup_id}/send-activation-email",
        json={"activation_token": "not-a-valid-token"},
    )
    assert res.status_code == HTTPStatus.UNAUTHORIZED
    assert_problem_code(res.json(), "invalid_or_expired_activation_token")


def test_send_activation_email_rejects_other_request_token(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    _configure_smtp(monkeypatch)
    monkeypatch.setattr(email_service, "deliver_message", _must_not_send)
    first_id, first_token, _email, _issue_id = _create_approved_signup(admin_login)
    create_res = admin_login.post(
        "/auth/member/signup",
        json={
            "student_id": "s116802",
            "email": "s116802@test.example.com",
            "name": "다른대상",
            "cohort": 2024,
            "phone": "010-2801-0002",
        },
    )
    assert create_res.status_code == HTTPStatus.CREATED
    second_id = create_res.json()["id"]
    approve_res = admin_login.post(f"/admin/signup-requests/{second_id}/approve")
    assert approve_res.status_code == HTTPStatus.OK
    assert first_id != second_id

    res = admin_login.post(
        f"/admin/signup-requests/{second_id}/send-activation-email",
        json={"activation_token": first_token},
    )
    assert res.status_code == HTTPStatus.UNAUTHORIZED
    assert_problem_code(res.json(), "invalid_or_expired_activation_token")


def test_send_activation_email_forbidden_for_member(
    admin_login: TestClient, member_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    _configure_smtp(monkeypatch)
    relogin = admin_login.post(
        "/auth/login",
        json={"student_id": "__seed__admin", "password": "__seed__"},
    )
    assert relogin.status_code == HTTPStatus.OK
    signup_id, token, _email, _issue_id = _create_approved_signup(admin_login)
    member_res = member_login.post(
        "/auth/member/login",
        json={"student_id": "member001", "password": "memberpass"},
    )
    assert member_res.status_code == HTTPStatus.OK
    res = member_login.post(
        f"/admin/signup-requests/{signup_id}/send-activation-email",
        json={"activation_token": token},
    )
    assert res.status_code == HTTPStatus.FORBIDDEN
    assert_problem_code(res.json(), "admin_permission_required")


def test_smtp_password_strips_spaces() -> None:
    settings = Settings.model_validate(
        {
            "DATABASE_URL": "postgresql+psycopg://app:devpass@localhost:5433/appdb",
            "SMTP_PASSWORD": "abcd efgh ijkl mnop",
        }
    )
    assert settings.smtp_password == "abcdefghijklmnop"


def test_build_activation_url_encodes_token() -> None:
    url = email_service.build_activation_url(
        "a+b=c", site_url="https://sogangeconomics.com/"
    )
    assert url == "https://sogangeconomics.com/activate?token=a%2Bb%3Dc"


def test_build_activation_html_escapes_name_and_embeds_hero() -> None:
    html_text = email_service.build_activation_html(
        name='<script>alert(1)</script>',
        student_id="s1",
        activation_url="https://sogangeconomics.com/activate?token=abc",
        from_name="서강대 경제대학원 총동문회",
    )
    assert "<script>" not in html_text
    assert "&lt;script&gt;" in html_text
    assert "비밀번호 만들기" in html_text
    assert f'cid:{email_service.ACTIVATION_HERO_CID}' in html_text
    assert email_service.ACTIVATION_HERO_PATH.is_file()


def test_send_activation_email_smtp_failure_is_bad_gateway(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    _configure_smtp(monkeypatch)

    def boom(*_args: object, **_kwargs: object) -> None:
        raise BadGatewayError(code="email_send_failed")

    monkeypatch.setattr(email_service, "deliver_message", boom)
    signup_id, token, _email, _issue_id = _create_approved_signup(admin_login)
    res = admin_login.post(
        f"/admin/signup-requests/{signup_id}/send-activation-email",
        json={"activation_token": token},
    )
    assert res.status_code == HTTPStatus.BAD_GATEWAY
    assert_problem_code(res.json(), "email_send_failed")
    logs = admin_login.get(
        f"/admin/signup-requests/{signup_id}/activation-token-logs"
    )
    assert logs.status_code == HTTPStatus.OK
    assert all(item["issued_type"] != "send" for item in logs.json()["items"])


def test_deliver_message_maps_smtp_error_to_bad_gateway(
    monkeypatch: MonkeyPatch,
) -> None:
    _configure_smtp(monkeypatch)

    class _FailingSMTP:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            return None

        def __enter__(self) -> _FailingSMTP:
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def ehlo(self) -> None:
            return None

        def starttls(self, *, context: object) -> None:
            return None

        def login(self, *_args: object, **_kwargs: object) -> None:
            raise smtplib.SMTPAuthenticationError(535, b"bad")

        def send_message(self, *_args: object, **_kwargs: object) -> None:
            return None

    monkeypatch.setattr(email_service.smtplib, "SMTP", _FailingSMTP)
    message = EmailMessage()
    message["From"] = "office@test.example.com"
    message["To"] = "user@test.example.com"
    with pytest.raises(BadGatewayError) as exc:
        email_service.deliver_message(message)
    assert exc.value.code == "email_send_failed"
    assert exc.value.status == HTTPStatus.BAD_GATEWAY


@pytest.mark.anyio("asyncio")
async def test_send_activation_email_rate_limit_shared_across_ids(
    admin_login: TestClient,
    enable_rate_limit: None,
    monkeypatch: MonkeyPatch,
) -> None:
    monkeypatch.setenv("RATE_LIMIT_ACTIVATION_EMAIL", "3/minute")
    _configure_smtp(monkeypatch)
    monkeypatch.setattr(email_service, "deliver_message", lambda *_a, **_k: None)
    transport = httpx.ASGITransport(app=app, client=("9.9.9.9", 9001))
    async with httpx.AsyncClient(transport=transport, base_url="http://local") as hc:
        login = await hc.post(
            "/auth/login",
            json={"student_id": "__seed__admin", "password": "__seed__"},
        )
        assert login.status_code == HTTPStatus.OK
        statuses: list[int] = []
        for index in range(4):
            create_res = await hc.post(
                "/auth/member/signup",
                json={
                    "student_id": f"s11681{index}",
                    "email": f"s11681{index}@test.example.com",
                    "name": "메일대상",
                    "cohort": 2024,
                    "phone": f"010-2801-001{index}",
                },
            )
            assert create_res.status_code == HTTPStatus.CREATED
            signup_id = create_res.json()["id"]
            approve_res = await hc.post(
                f"/admin/signup-requests/{signup_id}/approve"
            )
            assert approve_res.status_code == HTTPStatus.OK
            token = approve_res.json()["activation_token"]
            send_res = await hc.post(
                f"/admin/signup-requests/{signup_id}/send-activation-email",
                json={"activation_token": token},
            )
            statuses.append(send_res.status_code)
    assert statuses[:3] == [HTTPStatus.OK, HTTPStatus.OK, HTTPStatus.OK]
    assert statuses[-1] == HTTPStatus.TOO_MANY_REQUESTS


def test_mask_email_address_keeps_domain() -> None:
    assert email_service.mask_email_address("ginishuh@naver.com") == "g***@naver.com"
    assert email_service.mask_email_address("a@b.co") == "a***@b.co"
    assert email_service.mask_email_address("not-an-email") == "***"


def test_empty_public_site_url_defaults_to_localhost() -> None:
    settings = Settings.model_validate(
        {
            "DATABASE_URL": _PG,
            "PUBLIC_SITE_URL": "",
        }
    )
    assert settings.public_site_url == "http://localhost:3000"


def test_prod_rejects_empty_or_local_public_site_url() -> None:
    base = {
        "DATABASE_URL": _PG,
        "APP_ENV": "prod",
        "JWT_SECRET": _STRONG_JWT,
    }
    with pytest.raises(ValidationError):
        Settings.model_validate({**base, "PUBLIC_SITE_URL": ""})
    with pytest.raises(ValidationError):
        Settings.model_validate(
            {**base, "PUBLIC_SITE_URL": "http://localhost:3000"}
        )


def test_prod_rejects_smtp_without_tls() -> None:
    with pytest.raises(ValidationError):
        Settings.model_validate(
            {
                "DATABASE_URL": _PG,
                "APP_ENV": "prod",
                "JWT_SECRET": _STRONG_JWT,
                "PUBLIC_SITE_URL": "https://sogangeconomics.com",
                "SMTP_USERNAME": "office@test.example.com",
                "SMTP_PASSWORD": "secret",
                "SMTP_USE_TLS": False,
            }
        )

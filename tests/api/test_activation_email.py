from __future__ import annotations

from email.message import EmailMessage
from http import HTTPStatus

from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from apps.api.config import Settings, reset_settings_cache
from apps.api.services import email_service
from tests.api.problem_assertions import assert_problem_code


def _must_not_send(*_args: object, **_kwargs: object) -> None:
    raise AssertionError("must not send")


def _configure_smtp(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("SMTP_USERNAME", "office@test.example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "not-a-real-app-password")
    monkeypatch.setenv("SMTP_FROM_EMAIL", "office@test.example.com")
    monkeypatch.setenv("SMTP_FROM_NAME", "서강대 경제대학원 총동문회")
    monkeypatch.setenv("PUBLIC_SITE_URL", "https://sogangeconomics.com")
    reset_settings_cache()


def _create_approved_signup(admin_login: TestClient) -> tuple[int, str, str]:
    create_res = admin_login.post(
        "/auth/member/signup",
        json={
            "student_id": "s116801",
            "email": "s116801@test.example.com",
            "name": "메일대상",
            "cohort": 2024,
            "phone": "010-2801-0001",
        },
    )
    assert create_res.status_code == HTTPStatus.CREATED
    signup_id = create_res.json()["id"]
    approve_res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")
    assert approve_res.status_code == HTTPStatus.OK
    token = approve_res.json()["activation_token"]
    assert isinstance(token, str)
    return signup_id, token, "s116801@test.example.com"


def test_send_activation_email_success(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    _configure_smtp(monkeypatch)
    sent: list[EmailMessage] = []

    def fake_deliver(message: EmailMessage, settings: object = None) -> None:
        sent.append(message)

    monkeypatch.setattr(email_service, "deliver_message", fake_deliver)
    signup_id, token, email = _create_approved_signup(admin_login)

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


def test_send_activation_email_not_configured(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    monkeypatch.setattr(email_service, "deliver_message", _must_not_send)
    signup_id, token, _email = _create_approved_signup(admin_login)
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
    signup_id, _token, _email = _create_approved_signup(admin_login)
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
    first_id, first_token, _email = _create_approved_signup(admin_login)
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
    signup_id, token, _email = _create_approved_signup(admin_login)
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

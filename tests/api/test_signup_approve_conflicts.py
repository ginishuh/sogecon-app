"""가입 신청·승인의 학번 표기 변형 충돌과 승인 안내 메일 자동 발송 회귀 테스트.

운영에서 이미 가입한 회원이 학번 표기만 바꿔(`S90041` ↔ `90041`) 다시 신청한
건을 승인하면 `members.email` UNIQUE 위반으로 500이 났고, 승인 API가 메일을
보내지 않아 연속 승인한 신청자에게 안내 메일이 한 통도 가지 않았다.
"""

from __future__ import annotations

from email.message import EmailMessage
from http import HTTPStatus

import pytest
from fastapi.testclient import TestClient
from itsdangerous import URLSafeTimedSerializer
from pytest import MonkeyPatch
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.config import get_settings
from apps.api.db import get_db
from apps.api.errors import BadGatewayError
from apps.api.main import app
from apps.api.services import email_service, signup_approval_service
from apps.api.services.activation_service import ACTIVATION_SIGNER_NAMESPACE
from tests.api.signup_helpers import (
    configure_smtp,
    db_state,
    run_in_test_session,
    seed_member,
    signup,
    signup_id_of,
)

# --- 공개 신청 접수 ---------------------------------------------------------


@pytest.mark.parametrize(
    ("requested", "existing"),
    [
        ("S90041", "90041"),
        ("63015", "S63015"),
        ("67012", "s67012"),
        ("s61031", "S61031"),
        (" S60023 ", "s60023"),
    ],
)
def test_signup_rejects_student_id_variant_of_active_member(
    client: TestClient, requested: str, existing: str
) -> None:
    seed_member(student_id=existing, email=f"{existing.lower()}@test.example.com")

    res = signup(client, student_id=requested, email="other@test.example.com")

    assert res.status_code == HTTPStatus.CONFLICT
    assert res.json()["code"] == "member_already_active"


def test_signup_after_approval_without_password_returns_activation_pending(
    admin_login: TestClient,
) -> None:
    signup_id = signup_id_of(
        admin_login, student_id="s60111", email="s60111@test.example.com"
    )
    approve = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")
    assert approve.status_code == HTTPStatus.OK

    for variant in ("s60111", "S60111", "60111"):
        again = signup(
            admin_login, student_id=variant, email="s60111@test.example.com"
        )
        assert again.status_code == HTTPStatus.CONFLICT
        body = again.json()
        assert body["code"] == "member_activation_pending"
        assert "email" not in body["detail"].lower()


def test_signup_rejects_pending_duplicate_by_student_key(client: TestClient) -> None:
    first = signup(client, student_id="s70001", email="a70001@test.example.com")
    assert first.status_code == HTTPStatus.CREATED

    second = signup(client, student_id="S70001", email="b70001@test.example.com")
    assert second.status_code == HTTPStatus.CONFLICT
    assert second.json()["code"] == "signup_already_pending"


def test_signup_accepts_email_used_by_other_member(client: TestClient) -> None:
    """공개 접수는 이메일 등록 여부를 드러내지 않는다(학번 키가 다르면 접수)."""
    seed_member(student_id="s47041", email="Shared47@test.example.com")

    res = signup(client, student_id="s47042", email="shared47@test.example.com")

    assert res.status_code == HTTPStatus.CREATED


# --- 관리자 승인 ------------------------------------------------------------


def test_approve_rejects_email_used_by_other_member_with_409(
    admin_login: TestClient,
) -> None:
    seed_member(student_id="s65056", email="Dup65@test.example.com")
    signup_id = signup_id_of(
        admin_login, student_id="650383", email="dup65@test.example.com"
    )

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert res.status_code == HTTPStatus.CONFLICT
    body = res.json()
    assert body["code"] == "signup_email_in_use"
    assert "s65056" in body["detail"]
    assert "dup65" not in body["detail"].lower()
    status, members = db_state(signup_id)
    assert status == "pending"
    assert "650383" not in members


def test_approve_rejects_student_id_variant_of_active_member_with_409(
    admin_login: TestClient,
) -> None:
    """운영 재현: 대기 신청 `S90049`, 같은 이메일의 활성 회원 `90049`."""
    signup_id = signup_id_of(
        admin_login, student_id="S90049", email="same90049@test.example.com"
    )
    seed_member(student_id="90049", email="same90049@test.example.com")

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert res.status_code == HTTPStatus.CONFLICT
    body = res.json()
    assert body["code"] == "signup_member_exists"
    assert "90049" in body["detail"]
    status, members = db_state(signup_id)
    assert status == "pending"
    assert members == ["90049"]


def test_approve_rejects_student_id_variant_of_inactive_member_with_409(
    admin_login: TestClient,
) -> None:
    signup_id = signup_id_of(
        admin_login, student_id="s61077", email="s61077@test.example.com"
    )
    seed_member(
        student_id="S61077",
        email="old61077@test.example.com",
        status="pending",
        with_password=False,
    )

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert res.status_code == HTTPStatus.CONFLICT
    body = res.json()
    assert body["code"] == "signup_member_student_id_variant"
    assert "S61077" in body["detail"]
    status, members = db_state(signup_id)
    assert status == "pending"
    assert members == ["S61077"]


def test_approve_converts_unique_violation_race_to_409(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    """사전 확인 직후 다른 요청이 같은 이메일을 차지한 경쟁 상태를 흉내 낸다."""
    signup_id = signup_id_of(
        admin_login, student_id="s61099", email="race61099@test.example.com"
    )

    override = app.dependency_overrides[get_db]

    async def _no_conflict_seen(*_args: object, **_kwargs: object) -> None:
        async for other in override():
            other.add(
                models.Member(
                    student_id="s99999",
                    email="race61099@test.example.com",
                    name="동시가입",
                    cohort=20,
                    roles="member",
                    status="active",
                )
            )
            await other.commit()
            break

    monkeypatch.setattr(
        signup_approval_service.members_repo,
        "find_member_by_email_ci",
        _no_conflict_seen,
    )

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert res.status_code == HTTPStatus.CONFLICT
    assert res.json()["code"] == "signup_approve_conflict"
    status, members = db_state(signup_id)
    assert status == "pending"
    assert members == []


def test_approve_reactivates_exact_inactive_member_keeping_own_email(
    admin_login: TestClient,
) -> None:
    """정확히 같은 학번의 비활성 회원은 기존처럼 갱신·활성화한다."""
    seed_member(
        student_id="s61088",
        email="S61088@test.example.com",
        status="pending",
        with_password=False,
    )
    signup_id = signup_id_of(
        admin_login, student_id="s61088", email="s61088@test.example.com"
    )

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert res.status_code == HTTPStatus.OK, res.text
    status, members = db_state(signup_id)
    assert status == "approved"
    assert members == ["s61088"]


# --- 승인 안내 메일 자동 발송 ------------------------------------------------


def test_approve_sends_activation_email_and_records_send(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    sent = configure_smtp(monkeypatch)
    signup_id = signup_id_of(
        admin_login, student_id="s62001", email="s62001@test.example.com"
    )

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert res.status_code == HTTPStatus.OK
    body = res.json()
    assert body["activation_email"] == {
        "status": "sent",
        "sent_to": "s62001@test.example.com",
        "error_code": None,
    }
    assert len(sent) == 1
    assert sent[0]["To"] == "s62001@test.example.com"
    text = sent[0].get_body(preferencelist=("plain",))
    assert text is not None
    assert body["activation_token"] in text.get_content()

    logs = admin_login.get(
        f"/admin/signup-requests/{signup_id}/activation-token-logs"
    ).json()["items"]
    send_logs = [item for item in logs if item["issued_type"] == "send"]
    assert len(send_logs) == 1
    assert send_logs[0]["related_issue_id"] == body["activation_issue"]["id"]
    assert send_logs[0]["recipient_masked"] == "s***@test.example.com"


def test_approve_keeps_approval_when_email_not_configured(
    admin_login: TestClient,
) -> None:
    signup_id = signup_id_of(
        admin_login, student_id="s62002", email="s62002@test.example.com"
    )

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert res.status_code == HTTPStatus.OK
    body = res.json()
    assert body["request"]["status"] == "approved"
    assert body["activation_email"] == {
        "status": "failed",
        "sent_to": None,
        "error_code": "email_not_configured",
    }
    status, members = db_state(signup_id)
    assert status == "approved"
    assert members == ["s62002"]
    logs = admin_login.get(
        f"/admin/signup-requests/{signup_id}/activation-token-logs"
    ).json()["items"]
    assert [item["issued_type"] for item in logs] == ["approve"]


def test_approve_keeps_approval_when_smtp_delivery_fails(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    configure_smtp(monkeypatch)

    def failing_deliver(message: EmailMessage, settings: object = None) -> None:
        raise BadGatewayError(code="email_send_failed")

    monkeypatch.setattr(email_service, "deliver_message", failing_deliver)
    signup_id = signup_id_of(
        admin_login, student_id="s62003", email="s62003@test.example.com"
    )

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert res.status_code == HTTPStatus.OK
    body = res.json()
    assert body["activation_email"]["status"] == "failed"
    assert body["activation_email"]["error_code"] == "email_send_failed"
    status, _members = db_state(signup_id)
    assert status == "approved"

    # 같은 토큰으로 수동 재발송 경로는 그대로 동작한다.
    sent = configure_smtp(monkeypatch)
    retry = admin_login.post(
        f"/admin/signup-requests/{signup_id}/send-activation-email",
        json={"activation_token": body["activation_token"]},
    )
    assert retry.status_code == HTTPStatus.OK
    assert len(sent) == 1


def test_reissue_sends_new_link_to_applicant(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    sent = configure_smtp(monkeypatch)
    signup_id = signup_id_of(
        admin_login, student_id="s62004", email="s62004@test.example.com"
    )
    approve = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")
    assert approve.status_code == HTTPStatus.OK
    assert len(sent) == 1

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/reissue-token")

    assert res.status_code == HTTPStatus.OK, res.text
    body = res.json()
    assert body["activation_email"] == {
        "status": "sent",
        "sent_to": "s62004@test.example.com",
        "error_code": None,
    }
    assert [m["To"] for m in sent] == ["s62004@test.example.com"] * 2
    # 메일의 링크는 재발급 응답으로 돌려준 토큰이다.
    assert body["activation_token"] in _all_text(sent[1])


def test_reissue_keeps_new_token_when_email_fails(admin_login: TestClient) -> None:
    """SMTP 미설정 등으로 발송에 실패해도 재발급은 완료되고 수동 전달이 가능하다."""
    signup_id = signup_id_of(
        admin_login, student_id="s62005", email="s62005@test.example.com"
    )
    approve = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")
    assert approve.status_code == HTTPStatus.OK

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/reissue-token")

    assert res.status_code == HTTPStatus.OK, res.text
    body = res.json()
    assert body["activation_email"]["status"] == "failed"
    assert body["activation_email"]["error_code"] == "email_not_configured"
    assert body["activation_issue"]["issued_type"] == "reissue"
    logs = admin_login.get(
        f"/admin/signup-requests/{signup_id}/activation-token-logs"
    ).json()["items"]
    assert [item["issued_type"] for item in logs] == ["reissue", "approve"]


def _approved_signup(admin_login: TestClient, student_id: str) -> tuple[int, str]:
    signup_id = signup_id_of(
        admin_login, student_id=student_id, email=f"old-{student_id}@test.example.com"
    )
    approve = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")
    assert approve.status_code == HTTPStatus.OK, approve.text
    return signup_id, approve.json()["activation_token"]


def _member_id(student_id: str) -> int:
    out: dict[str, int] = {}

    async def _load(session: AsyncSession) -> None:
        out["id"] = int(
            (
                await session.execute(
                    select(models.Member.id).where(
                        models.Member.student_id == student_id
                    )
                )
            ).scalar_one()
        )

    run_in_test_session(_load)
    return out["id"]


def test_reissue_after_admin_corrects_member_email_sends_only_to_new_address(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    """신청서의 주소가 틀려(남의 주소 등) 관리자가 회원 이메일을 고친 뒤 재발급."""
    sent = configure_smtp(monkeypatch)
    signup_id, old_token = _approved_signup(admin_login, "s62010")
    fixed = admin_login.patch(
        f"/admin/members/{_member_id('s62010')}",
        json={"email": "fixed-s62010@test.example.com"},
    )
    assert fixed.status_code == HTTPStatus.OK, fixed.text
    del sent[:]

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/reissue-token")

    assert res.status_code == HTTPStatus.OK, res.text
    body = res.json()
    assert body["activation_email"]["sent_to"] == "fixed-s62010@test.example.com"
    assert body["activation_context"]["email"] == "fixed-s62010@test.example.com"
    assert [m["To"] for m in sent] == ["fixed-s62010@test.example.com"]

    # 주소를 고치기 전에 발급한 링크는 다시 보낼 수도, 활성화에 쓸 수도 없다.
    resend_old = admin_login.post(
        f"/admin/signup-requests/{signup_id}/send-activation-email",
        json={"activation_token": old_token},
    )
    assert resend_old.status_code == HTTPStatus.CONFLICT, resend_old.text
    assert resend_old.json()["code"] == "activation_link_outdated"
    assert len(sent) == 1
    activate_old = admin_login.post(
        "/auth/member/activate",
        json={"token": old_token, "password": "stolen-pass-1"},
    )
    assert activate_old.status_code == HTTPStatus.UNAUTHORIZED, activate_old.text

    # 고친 주소로 간 새 링크는 다시 보낼 수 있고 활성화된다.
    resend_new = admin_login.post(
        f"/admin/signup-requests/{signup_id}/send-activation-email",
        json={"activation_token": body["activation_token"]},
    )
    assert resend_new.status_code == HTTPStatus.OK, resend_new.text
    assert [m["To"] for m in sent] == ["fixed-s62010@test.example.com"] * 2
    activate_new = admin_login.post(
        "/auth/member/activate",
        json={"token": body["activation_token"], "password": "owner-pass-1"},
    )
    assert activate_new.status_code == HTTPStatus.OK, activate_new.text


def test_email_correction_alone_invalidates_link_sent_to_old_address(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    """재발급을 하지 않아도, 주소를 고친 순간 옛 주소로 나간 링크는 죽는다."""
    configure_smtp(monkeypatch)
    _signup_id, old_token = _approved_signup(admin_login, "s62012")
    _update_member("s62012", email="fixed-s62012@test.example.com")

    res = admin_login.post(
        "/auth/member/activate",
        json={"token": old_token, "password": "stolen-pass-2"},
    )

    assert res.status_code == HTTPStatus.UNAUTHORIZED, res.text
    assert not _has_password("s62012")


def test_link_survives_case_only_rewrite_of_member_email(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    configure_smtp(monkeypatch)
    _signup_id, token = _approved_signup(admin_login, "s62013")
    _update_member("s62013", email=" OLD-s62013@Test.example.com ")

    res = admin_login.post(
        "/auth/member/activate", json={"token": token, "password": "owner-pass-2"}
    )

    assert res.status_code == HTTPStatus.OK, res.text


def test_link_issued_by_previous_version_follows_request_email(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    """지문이 없는 이전 버전 토큰은 신청서 주소로만 나갔다. 주소가 바뀌면 거절한다."""
    configure_smtp(monkeypatch)
    signup_id, _token = _approved_signup(admin_login, "s62014")
    legacy = URLSafeTimedSerializer(
        get_settings().jwt_secret, salt=ACTIVATION_SIGNER_NAMESPACE
    ).dumps(
        {
            "signup_request_id": signup_id,
            "student_id": "s62014",
            "cohort": 20,
            "name": "재신청자",
        }
    )
    _update_member("s62014", email="fixed-s62014@test.example.com")
    rejected = admin_login.post(
        "/auth/member/activate", json={"token": legacy, "password": "stolen-pass-3"}
    )
    assert rejected.status_code == HTTPStatus.UNAUTHORIZED, rejected.text

    _update_member("s62014", email="old-s62014@test.example.com")
    accepted = admin_login.post(
        "/auth/member/activate", json={"token": legacy, "password": "owner-pass-3"}
    )
    assert accepted.status_code == HTTPStatus.OK, accepted.text


def _has_password(student_id: str) -> bool:
    out: dict[str, bool] = {}

    async def _load(session: AsyncSession) -> None:
        out["has"] = (
            await session.execute(
                select(models.MemberAuth.id).where(
                    models.MemberAuth.student_id == student_id
                )
            )
        ).first() is not None

    run_in_test_session(_load)
    return out["has"]


def _update_member(student_id: str, **values: str | None) -> None:
    async def _update(session: AsyncSession) -> None:
        await session.execute(
            update(models.Member)
            .where(models.Member.student_id == student_id)
            .values(**values)
        )
        await session.commit()

    run_in_test_session(_update)


@pytest.mark.parametrize(
    ("member_values", "error_code"),
    [
        ({"status": "suspended"}, "member_not_active"),
        ({"email": None}, "email_recipient_missing"),
    ],
)
def test_reissue_does_not_send_when_member_cannot_receive(
    admin_login: TestClient,
    monkeypatch: MonkeyPatch,
    member_values: dict[str, str | None],
    error_code: str,
) -> None:
    sent = configure_smtp(monkeypatch)
    signup_id, _token = _approved_signup(admin_login, "s62011")
    _update_member("s62011", **member_values)
    del sent[:]

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/reissue-token")

    assert res.status_code == HTTPStatus.OK, res.text
    assert res.json()["activation_email"] == {
        "status": "failed",
        "sent_to": None,
        "error_code": error_code,
    }
    # 보낼 수 없을 때 화면에 옛 신청서 주소를 수신 주소로 보이지 않는다.
    assert res.json()["activation_context"]["email"] == ""
    assert sent == []


def _all_text(message: EmailMessage) -> str:
    return "\n".join(
        part.get_content()
        for part in message.walk()
        if part.get_content_maintype() == "text"
    )

"""저장 값 앞뒤에 공백이 남은 기존 회원과 공백뿐인 학번에 대한 회귀 테스트.

이전 버전은 입력을 그대로 저장했고 기존 자료를 고치지 않으므로, 비교할 때
저장 값에도 입력과 같은 앞뒤 공백 처리를 적용해야 한다.
"""

from __future__ import annotations

from http import HTTPStatus

import pytest
from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from tests.api.signup_helpers import (
    configure_smtp,
    db_state,
    seed_member,
    signup,
    signup_id_of,
)


def test_approve_rejects_email_of_member_stored_with_surrounding_whitespace(
    admin_login: TestClient, monkeypatch: MonkeyPatch
) -> None:
    sent = configure_smtp(monkeypatch)
    seed_member(student_id="61201", email=" Sample@Test.example.com ")
    signup_id = signup_id_of(
        admin_login, student_id="61202", email="sample@test.example.com"
    )

    res = admin_login.post(f"/admin/signup-requests/{signup_id}/approve")

    assert res.status_code == HTTPStatus.CONFLICT, res.text
    assert res.json()["code"] == "signup_email_in_use"
    status, _ = db_state(signup_id)
    assert status == "pending"
    assert sent == []


@pytest.mark.parametrize(
    ("stored", "requested"),
    [
        (" 기억안남 ", "기억안남"),  # 비ASCII 원문 앞뒤 공백
        (" S61203 ", "61203"),  # ASCII 변형 + 앞뒤 공백
    ],
)
def test_signup_matches_member_stored_with_surrounding_whitespace(
    client: TestClient, stored: str, requested: str
) -> None:
    seed_member(student_id=stored, email="stored-space@test.example.com")

    res = signup(client, student_id=requested, email="other-space@test.example.com")

    assert res.status_code == HTTPStatus.CONFLICT, res.text
    assert res.json()["code"] == "member_already_active"


@pytest.mark.parametrize("blank", ["   ", "\t", ""])
def test_signup_rejects_blank_student_id(client: TestClient, blank: str) -> None:
    res = signup(client, student_id=blank, email="blank-id@test.example.com")

    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY, res.text
    assert res.json()["code"] == "student_id_required"

    # 같은 사람이 학번을 적어 다시 내면 접수된다(빈 신청이 남아 막지 않음).
    retry = signup(client, student_id="61204", email="blank-id@test.example.com")
    assert retry.status_code == HTTPStatus.CREATED, retry.text

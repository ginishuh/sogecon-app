from __future__ import annotations

import pytest
from pydantic import ValidationError

from apps.api.passwords import hash_password, verify_password
from apps.api.routers.auth import (
    ChangePasswordPayload,
    LoginPayload,
    MemberActivatePayload,
)

LEGACY_PASSWORD = "legacy-password-운영"
LEGACY_BCRYPT_4_HASH = (
    "$2b$12$zVYuyuib/I0jLZcq3V7Cq.9xiN6P0ZZffpBsxL4UvDq0/A79GJH0a"
)


@pytest.mark.parametrize("password", ["a" * 72, "한" * 24])
def test_hash_password_accepts_72_utf8_bytes(password: str) -> None:
    password_hash = hash_password(password)

    assert verify_password(password, password_hash)


@pytest.mark.parametrize("password", ["a" * 73, "한" * 25])
def test_hash_password_rejects_more_than_72_utf8_bytes(password: str) -> None:
    with pytest.raises(ValueError, match="UTF-8 기준 72바이트"):
        hash_password(password)


def test_verify_password_accepts_existing_bcrypt_4_hash() -> None:
    assert verify_password(LEGACY_PASSWORD, LEGACY_BCRYPT_4_HASH)


def test_verify_password_preserves_legacy_truncation_for_existing_members() -> None:
    password_prefix = "a" * 72
    password_hash = hash_password(password_prefix)

    assert verify_password(f"{password_prefix}legacy-suffix", password_hash)


def test_verify_password_rejects_malformed_hash() -> None:
    assert not verify_password("password", "not-a-bcrypt-hash")


@pytest.mark.parametrize(
    ("payload_type", "payload"),
    [
        (MemberActivatePayload, {"token": "token", "password": "한" * 25}),
        (
            ChangePasswordPayload,
            {"current_password": "current", "new_password": "a" * 73},
        ),
    ],
)
def test_new_password_payload_rejects_more_than_72_utf8_bytes(
    payload_type: type[MemberActivatePayload] | type[ChangePasswordPayload],
    payload: dict[str, str],
) -> None:
    with pytest.raises(ValidationError, match="UTF-8 기준 72바이트"):
        payload_type.model_validate(payload)


def test_login_payload_keeps_legacy_long_password_compatibility() -> None:
    payload = LoginPayload(student_id="legacy", password="a" * 73)

    assert len(payload.password.encode("utf-8")) == 73

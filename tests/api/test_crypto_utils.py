from __future__ import annotations

import base64
import os

import pytest
from pydantic import ValidationError

from apps.api.config import Settings, reset_settings_cache
from apps.api.crypto_utils import CryptoError, decrypt_str, encrypt_str

_PG = "postgresql+psycopg://app:devpass@localhost:5434/appdb_test"


def test_decrypt_raises_on_key_mismatch() -> None:
    os.environ["PUSH_ENCRYPT_AT_REST"] = "true"
    os.environ["PUSH_KEK"] = base64.b64encode(os.urandom(32)).decode()
    reset_settings_cache()
    ct = encrypt_str("hello")
    assert ct.startswith("enc:v1:")

    os.environ["PUSH_KEK"] = base64.b64encode(os.urandom(32)).decode()
    reset_settings_cache()

    with pytest.raises(CryptoError):
        decrypt_str(ct)

    os.environ.pop("PUSH_ENCRYPT_AT_REST", None)
    os.environ.pop("PUSH_KEK", None)
    reset_settings_cache()


def test_decrypt_plaintext_without_prefix() -> None:
    os.environ.pop("PUSH_ENCRYPT_AT_REST", None)
    os.environ.pop("PUSH_KEK", None)
    reset_settings_cache()
    assert decrypt_str("plain-endpoint") == "plain-endpoint"


def test_encrypt_roundtrip() -> None:
    os.environ["PUSH_ENCRYPT_AT_REST"] = "true"
    os.environ["PUSH_KEK"] = base64.b64encode(os.urandom(32)).decode()
    reset_settings_cache()
    try:
        ct = encrypt_str("roundtrip-value")
        assert ct.startswith("enc:v1:")
        assert decrypt_str(ct) == "roundtrip-value"
    finally:
        os.environ.pop("PUSH_ENCRYPT_AT_REST", None)
        os.environ.pop("PUSH_KEK", None)
        reset_settings_cache()


def test_settings_reject_encrypt_without_valid_kek(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", _PG)
    monkeypatch.setenv("PUSH_ENCRYPT_AT_REST", "true")
    monkeypatch.setenv("PUSH_KEK", "not-valid-base64!!!")
    with pytest.raises(ValidationError):
        Settings()

    monkeypatch.setenv("PUSH_KEK", base64.b64encode(b"short").decode())
    with pytest.raises(ValidationError):
        Settings()

    monkeypatch.setenv("PUSH_KEK", "")
    with pytest.raises(ValidationError):
        Settings()

from __future__ import annotations

import base64
import binascii
import os
from dataclasses import dataclass
from typing import Final

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import Settings, get_settings

PREFIX: Final = "enc:v1:"
_AES_KEY_LENS: Final = frozenset({16, 24, 32})


class CryptoError(Exception):
    """at-rest 암·복호화 실패 (평문 위장 반환 금지)."""


@dataclass(frozen=True)
class CryptoConfig:
    enabled: bool
    key: bytes | None


def decode_push_kek(raw: str) -> bytes:
    """PUSH_KEK base64 → AES 키 바이트. 형식이 틀리면 ValueError."""
    try:
        key = base64.b64decode((raw or "").strip(), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("PUSH_KEK must be valid base64") from exc
    if len(key) not in _AES_KEY_LENS:
        raise ValueError(
            f"PUSH_KEK decoded length must be 16, 24, or 32 bytes (got {len(key)})"
        )
    return key


def is_push_encryption_effective(settings: Settings | None = None) -> bool:
    """PUSH_ENCRYPT_AT_REST가 켜져 있고 KEK가 유효한지."""
    s = settings if settings is not None else get_settings()
    if not s.push_encrypt_at_rest:
        return False
    try:
        decode_push_kek(s.push_kek)
    except ValueError:
        return False
    return True


def _cfg() -> CryptoConfig:
    s = get_settings()
    if not s.push_encrypt_at_rest:
        return CryptoConfig(False, None)
    try:
        key = decode_push_kek(s.push_kek)
    except ValueError as exc:
        raise CryptoError("push encryption enabled but PUSH_KEK is invalid") from exc
    return CryptoConfig(True, key)


def encrypt_str(p: str) -> str:
    cfg = _cfg()
    if not cfg.enabled:
        return p
    if cfg.key is None:
        raise CryptoError("push encryption enabled but key is missing")
    aes = AESGCM(cfg.key)
    nonce = os.urandom(12)
    ct = aes.encrypt(nonce, p.encode("utf-8"), None)
    blob = base64.b64encode(nonce + ct).decode("ascii")
    return PREFIX + blob


def decrypt_str(c: str) -> str:
    if not c.startswith(PREFIX):
        # 접두 없음 = 평문(기존 데이터 호환)
        return c
    cfg = _cfg()
    if not cfg.enabled or cfg.key is None:
        raise CryptoError(
            "encrypted value present but push encryption is not effective"
        )
    try:
        data = base64.b64decode(c[len(PREFIX) :])
        nonce, ct = data[:12], data[12:]
        aes = AESGCM(cfg.key)
        pt = aes.decrypt(nonce, ct, None)
        return pt.decode("utf-8")
    except (
        InvalidTag,
        ValueError,
        binascii.Error,
        TypeError,
        UnicodeDecodeError,
    ) as exc:
        raise CryptoError("failed to decrypt push subscription field") from exc

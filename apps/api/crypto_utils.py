from __future__ import annotations

import base64
import os
from dataclasses import dataclass
from typing import Final

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import get_settings

PREFIX: Final = "enc:v1:"


@dataclass
class CryptoConfig:
    enabled: bool
    key: bytes | None


def _cfg() -> CryptoConfig:
    s = get_settings()
    if not s.push_encrypt_at_rest:
        return CryptoConfig(False, None)
    try:
        key = base64.b64decode(s.push_kek)
    except Exception:
        key = b""
    if len(key) not in (16, 24, 32):  # AES-128/192/256
        return CryptoConfig(False, None)
    return CryptoConfig(True, key)


def encrypt_str(p: str) -> str:
    cfg = _cfg()
    if not cfg.enabled or cfg.key is None:
        return p
    aes = AESGCM(cfg.key)
    nonce = os.urandom(12)
    ct = aes.encrypt(nonce, p.encode("utf-8"), None)
    blob = base64.b64encode(nonce + ct).decode("ascii")
    return PREFIX + blob


def decrypt_str(c: str) -> str:
    if not c.startswith(PREFIX):
        return c
    cfg = _cfg()
    if not cfg.enabled or cfg.key is None:
        # cannot decrypt; treat as plaintext to fail fast downstream
        return c
    try:
        data = base64.b64decode(c[len(PREFIX) :])
        nonce, ct = data[:12], data[12:]
        aes = AESGCM(cfg.key)
        pt = aes.decrypt(nonce, ct, None)
        return pt.decode("utf-8")
    except (InvalidTag, ValueError):
        # 키 불일치/손상 등으로 복호화 실패: 원문 그대로 반환하여
        # 상위 로직이 안전하게 실패하도록 함(크래시 방지)
        return c
    except Exception:
        return c

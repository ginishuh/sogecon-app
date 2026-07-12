"""bcrypt 비밀번호 해시·검증 정책."""

from __future__ import annotations

import bcrypt

BCRYPT_MAX_PASSWORD_BYTES = 72
BCRYPT_LENGTH_ERROR_MESSAGE = "비밀번호는 UTF-8 기준 72바이트 이하여야 합니다."


def encode_password_for_hash(password: str) -> bytes:
    """신규 해시용 비밀번호를 인코딩하고 bcrypt 길이 정책을 검증합니다."""
    encoded = password.encode("utf-8")
    if len(encoded) > BCRYPT_MAX_PASSWORD_BYTES:
        raise ValueError(BCRYPT_LENGTH_ERROR_MESSAGE)
    return encoded


def validate_password_for_hash(password: str) -> str:
    """Pydantic 요청 검증에서 사용하는 신규 비밀번호 검증기입니다."""
    encode_password_for_hash(password)
    return password


def hash_password(password: str) -> str:
    """길이 검증을 통과한 신규 비밀번호를 bcrypt로 해시합니다."""
    encoded = encode_password_for_hash(password)
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """기존 bcrypt 4의 72바이트 절삭 검증 의미를 보존합니다."""
    encoded = password.encode("utf-8")[:BCRYPT_MAX_PASSWORD_BYTES]
    try:
        return bcrypt.checkpw(encoded, password_hash.encode("utf-8"))
    except ValueError:
        return False

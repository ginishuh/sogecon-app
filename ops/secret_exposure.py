"""Legacy vs current secret comparison without printing secret values."""

from __future__ import annotations

import base64
import binascii
import secrets
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Final

_LEGACY_SECRET_KEYS: Final = (
    "JWT_SECRET",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "PUSH_KEK",
    "DATABASE_URL",
    "SEED_PROD_ADMIN001_VALUE",
)


class CompareStatus(StrEnum):
    MATCH = "MATCH"
    DIFFERENT = "DIFFERENT"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True)
class SecretComparison:
    name: str
    status: CompareStatus


_QUOTED_VALUE_MIN_LEN = 2


def parse_dotenv(text: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if (
            len(value) >= _QUOTED_VALUE_MIN_LEN
            and value[0] == value[-1]
            and value[0] in {"'", '"'}
        ):
            value = value[1:-1]
        values[key] = value
    return values


def load_dotenv_file(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    return parse_dotenv(path.read_text(encoding="utf-8"))


def _normalize_jwt(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _decode_kek_bytes(value: str | None) -> bytes | None:
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None
    try:
        decoded = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError):
        return None
    if len(decoded) not in (16, 24, 32):
        return None
    return decoded


def _normalize_vapid(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _compare_normalized_text(
    name: str,
    legacy: str | None,
    current: str | None,
) -> SecretComparison:
    legacy_norm = (legacy or "").strip()
    current_norm = (current or "").strip()
    if not legacy_norm or not current_norm:
        return SecretComparison(name, CompareStatus.UNKNOWN)
    status = (
        CompareStatus.MATCH
        if secrets.compare_digest(legacy_norm, current_norm)
        else CompareStatus.DIFFERENT
    )
    return SecretComparison(name, status)


def compare_secret_values(
    name: str,
    legacy: str | None,
    current: str | None,
) -> SecretComparison:
    if name == "JWT_SECRET":
        return _compare_normalized_text(
            name,
            _normalize_jwt(legacy),
            _normalize_jwt(current),
        )

    if name == "PUSH_KEK":
        legacy_bytes = _decode_kek_bytes(legacy)
        current_bytes = _decode_kek_bytes(current)
        if legacy_bytes is None or current_bytes is None:
            return SecretComparison(name, CompareStatus.UNKNOWN)
        status = (
            CompareStatus.MATCH
            if secrets.compare_digest(legacy_bytes, current_bytes)
            else CompareStatus.DIFFERENT
        )
        return SecretComparison(name, status)

    if name in {"VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"}:
        return _compare_normalized_text(
            name, _normalize_vapid(legacy), _normalize_vapid(current)
        )

    return _compare_normalized_text(name, legacy, current)


def compare_vapid_keypair(
    legacy: dict[str, str],
    current: dict[str, str],
) -> SecretComparison:
    public = compare_secret_values(
        "VAPID_PUBLIC_KEY",
        legacy.get("VAPID_PUBLIC_KEY"),
        current.get("VAPID_PUBLIC_KEY"),
    )
    private = compare_secret_values(
        "VAPID_PRIVATE_KEY",
        legacy.get("VAPID_PRIVATE_KEY"),
        current.get("VAPID_PRIVATE_KEY"),
    )
    if CompareStatus.UNKNOWN in {public.status, private.status}:
        return SecretComparison("VAPID_KEYPAIR", CompareStatus.UNKNOWN)
    if (
        public.status == CompareStatus.MATCH
        and private.status == CompareStatus.MATCH
    ):
        return SecretComparison("VAPID_KEYPAIR", CompareStatus.MATCH)
    return SecretComparison("VAPID_KEYPAIR", CompareStatus.DIFFERENT)


def compare_legacy_env(
    legacy: dict[str, str],
    current: dict[str, str],
    *,
    extra_keys: tuple[str, ...] = (),
) -> list[SecretComparison]:
    names = sorted(
        {
            *(
                key
                for key in _LEGACY_SECRET_KEYS
                if key in legacy or key in current
            ),
            *(
                key
                for key in extra_keys
                if key in legacy or key in current
            ),
        }
    )
    results: list[SecretComparison] = []
    for name in names:
        if name in {"VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"}:
            continue
        results.append(
            compare_secret_values(name, legacy.get(name), current.get(name))
        )
    if (
        "VAPID_PUBLIC_KEY" in legacy
        or "VAPID_PRIVATE_KEY" in legacy
        or "VAPID_PUBLIC_KEY" in current
        or "VAPID_PRIVATE_KEY" in current
    ):
        results.append(compare_vapid_keypair(legacy, current))
    return results


def inventory_env_names(values: dict[str, str]) -> list[str]:
    return sorted(values.keys())

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal, cast

ADMIN_PERMISSION_TOKENS = frozenset(
    {
        "admin_posts",
        "admin_events",
        "admin_hero",
        "admin_notifications",
        "admin_signup",
        "admin_roles",
        "admin_profile",
    }
)
ALLOWED_ROLE_TOKENS = frozenset(
    {"member", "admin", "super_admin", *ADMIN_PERMISSION_TOKENS}
)


RoleGradeLiteral = Literal["member", "admin", "super_admin"]


@dataclass(frozen=True)
class RoleProfile:
    grade: RoleGradeLiteral
    permissions: set[str]


def _dedupe_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def normalize_roles(value: object) -> list[str]:
    if isinstance(value, str):
        raw = [part.strip().lower() for part in value.split(",") if part.strip()]
        return _dedupe_preserve_order(raw)

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        roles: list[str] = []
        for item in cast(Sequence[object], value):
            if isinstance(item, str) and item.strip():
                roles.append(item.strip().lower())
        return _dedupe_preserve_order(roles)

    return []


def ensure_member_role(roles: list[str]) -> list[str]:
    if "member" in roles:
        return roles
    return ["member", *roles]


def parse_roles(raw_roles: object) -> RoleProfile:
    roles = normalize_roles(raw_roles)
    tokens = set(roles)

    grade: RoleGradeLiteral
    if "super_admin" in tokens:
        grade = "super_admin"
    elif "admin" in tokens:
        grade = "admin"
    else:
        grade = "member"

    permissions = {token for token in tokens if token in ADMIN_PERMISSION_TOKENS}
    return RoleProfile(grade=grade, permissions=permissions)


def normalize_assignable_roles(value: object) -> list[str]:
    roles = normalize_roles(value)
    filtered = [role for role in roles if role in ALLOWED_ROLE_TOKENS]
    return ensure_member_role(filtered)


def serialize_roles(roles: list[str]) -> str:
    return ",".join(_dedupe_preserve_order(roles))


def has_permission(
    raw_roles: object,
    permission: str,
    *,
    allow_admin_fallback: bool = True,
) -> bool:
    profile = parse_roles(raw_roles)

    if profile.grade == "super_admin":
        return True

    if permission in profile.permissions:
        return True

    if allow_admin_fallback and profile.grade == "admin":
        return True

    return False

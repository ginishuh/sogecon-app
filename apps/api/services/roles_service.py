from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import cast


@dataclass(frozen=True)
class RoleProfile:
    grade: str
    permissions: set[str]


def normalize_roles(value: object) -> list[str]:
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        roles: list[str] = []
        for item in cast(Sequence[object], value):
            if isinstance(item, str) and item.strip():
                roles.append(item.strip())
        return roles

    return []


def ensure_member_role(roles: list[str]) -> list[str]:
    if "member" in roles:
        return roles
    return ["member", *roles]


def parse_roles(raw_roles: object) -> RoleProfile:
    roles = normalize_roles(raw_roles)
    tokens = set(roles)

    if "super_admin" in tokens:
        grade = "super_admin"
    elif "admin" in tokens:
        grade = "admin"
    else:
        grade = "member"

    permissions = {token for token in tokens if token.startswith("admin_")}
    return RoleProfile(grade=grade, permissions=permissions)


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

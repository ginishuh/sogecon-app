#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from typing import TypedDict, cast

import yaml

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / ".github/dependabot.yml"
CONFIG_VERSION = 2
PR_LIMIT = 5
ECOSYSTEMS = {"npm", "pip", "github-actions"}


GroupConfig = TypedDict(
    "GroupConfig",
    {
        "applies-to": str,
        "dependency-type": str,
        "update-types": list[str],
    },
    total=False,
)


class ScheduleConfig(TypedDict, total=False):
    interval: str


UpdateConfig = TypedDict(
    "UpdateConfig",
    {
        "package-ecosystem": str,
        "directory": str,
        "schedule": ScheduleConfig,
        "open-pull-requests-limit": int,
        "groups": dict[str, GroupConfig],
    },
    total=False,
)


class DependabotConfig(TypedDict, total=False):
    version: int
    updates: list[UpdateConfig]


EXPECTED_DIRECTORIES = {
    "npm": "/",
    "pip": "/apps/api",
    "github-actions": "/",
}
EXPECTED_GROUPS: dict[str, dict[str, tuple[str, str | None]]] = {
    "npm": {
        "web-production-minor-patch": ("version-updates", "production"),
        "web-development-minor-patch": ("version-updates", "development"),
        "web-security-minor-patch": ("security-updates", None),
    },
    "pip": {
        "api-runtime-minor-patch": ("version-updates", "production"),
        "api-development-minor-patch": ("version-updates", "development"),
        "api-security-minor-patch": ("security-updates", None),
    },
    "github-actions": {
        "actions-minor-patch": ("version-updates", None),
        "actions-security-minor-patch": ("security-updates", None),
    },
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"[dependabot-config] {message}")


def main() -> int:
    raw = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    require(isinstance(raw, dict), "루트는 mapping이어야 합니다")
    data = cast(DependabotConfig, raw)
    require(data.get("version") == CONFIG_VERSION, "version은 2여야 합니다")
    updates = data.get("updates")
    if not isinstance(updates, list):
        raise SystemExit("[dependabot-config] updates는 목록이어야 합니다")
    by_ecosystem = {
        item.get("package-ecosystem", ""): item
        for item in updates
    }
    require(set(by_ecosystem) == ECOSYSTEMS, "세 ecosystem이 필요합니다")
    manifests = {
        "npm": ROOT / "pnpm-workspace.yaml",
        "pip": ROOT / "apps/api/requirements.txt",
        "github-actions": ROOT / ".github/workflows",
    }
    for ecosystem, manifest in manifests.items():
        item = by_ecosystem[ecosystem]
        require(manifest.exists(), f"{ecosystem} manifest 경로가 없습니다")
        require(
            item.get("directory") == EXPECTED_DIRECTORIES[ecosystem],
            f"{ecosystem} directory가 올바르지 않습니다",
        )
        require(
            item.get("schedule", {}).get("interval") == "monthly",
            f"{ecosystem}은 monthly여야 합니다",
        )
        require(
            item.get("open-pull-requests-limit") == PR_LIMIT,
            f"{ecosystem} PR 상한은 5여야 합니다",
        )
        groups = item.get("groups")
        if not isinstance(groups, dict) or not groups:
            raise SystemExit(
                f"[dependabot-config] {ecosystem} groups가 필요합니다"
            )
        expected_groups = EXPECTED_GROUPS[ecosystem]
        require(
            set(groups) == set(expected_groups),
            f"{ecosystem} group 구성이 올바르지 않습니다",
        )
        for name, group in groups.items():
            expected_applies_to, expected_dependency_type = expected_groups[name]
            require(
                group.get("applies-to") == expected_applies_to,
                f"{name} applies-to가 올바르지 않습니다",
            )
            require(
                group.get("dependency-type") == expected_dependency_type,
                f"{name} dependency-type이 올바르지 않습니다",
            )
            update_types = group.get("update-types")
            require(
                isinstance(update_types, list)
                and set(update_types) == {"minor", "patch"},
                f"{name} update-types는 minor/patch만 허용합니다",
            )
            if not isinstance(update_types, list):
                raise SystemExit(
                    f"[dependabot-config] {name} update-types가 필요합니다"
                )
            require(
                "major" not in update_types,
                f"{name}은 major를 그룹화하면 안 됩니다",
            )
    print("[dependabot-config] OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

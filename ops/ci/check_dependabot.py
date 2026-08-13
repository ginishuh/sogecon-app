#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from typing import TypedDict, cast

import yaml

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / ".github/dependabot.yml"
CONFIG_VERSION = 2
PR_LIMIT = 5
ECOSYSTEMS = {"npm", "pip", "github-actions", "docker", "docker-compose"}


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
    "docker": "/infra",
    "docker-compose": "/",
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
    "docker": {
        "docker-minor-patch": ("version-updates", None),
        "docker-security-minor-patch": ("security-updates", None),
    },
    "docker-compose": {
        "compose-minor-patch": ("version-updates", None),
        "compose-security-minor-patch": ("security-updates", None),
    },
}


def _check_group(
    name: str,
    group: GroupConfig,
    expected: tuple[str, str | None],
) -> list[str]:
    problems: list[str] = []
    expected_applies_to, expected_dependency_type = expected
    if group.get("applies-to") != expected_applies_to:
        problems.append(f"{name} applies-to가 올바르지 않습니다")
    if group.get("dependency-type") != expected_dependency_type:
        problems.append(f"{name} dependency-type이 올바르지 않습니다")
    update_types = group.get("update-types")
    allowed = {"minor", "patch"}
    if not (isinstance(update_types, list) and set(update_types) == allowed):
        problems.append(f"{name} update-types는 minor/patch만 허용합니다")
    elif "major" in update_types:
        problems.append(f"{name}은 major를 그룹화하면 안 됩니다")
    return problems


def _check_ecosystem(
    ecosystem: str,
    item: UpdateConfig,
    manifest: Path,
) -> list[str]:
    problems: list[str] = []
    if not manifest.exists():
        problems.append(f"{ecosystem} manifest 경로가 없습니다")
    if item.get("directory") != EXPECTED_DIRECTORIES[ecosystem]:
        problems.append(f"{ecosystem} directory가 올바르지 않습니다")
    if item.get("schedule", {}).get("interval") != "monthly":
        problems.append(f"{ecosystem}은 monthly여야 합니다")
    if item.get("open-pull-requests-limit") != PR_LIMIT:
        problems.append(f"{ecosystem} PR 상한은 5여야 합니다")
    groups = item.get("groups")
    if not isinstance(groups, dict) or not groups:
        problems.append(f"{ecosystem} groups가 필요합니다")
        return problems
    expected_groups = EXPECTED_GROUPS[ecosystem]
    if set(groups) != set(expected_groups):
        problems.append(f"{ecosystem} group 구성이 올바르지 않습니다")
    for name, group in groups.items():
        expected = expected_groups.get(name)
        if expected is None:
            continue
        problems.extend(_check_group(name, group, expected))
    return problems


def evaluate(config_path: Path, root: Path) -> list[str]:
    problems: list[str] = []
    raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        return ["루트는 mapping이어야 합니다"]
    data = cast(DependabotConfig, raw)
    if data.get("version") != CONFIG_VERSION:
        problems.append("version은 2여야 합니다")
    updates = data.get("updates")
    if not isinstance(updates, list):
        problems.append("updates는 목록이어야 합니다")
        return problems

    ecosystems = [item.get("package-ecosystem", "") for item in updates]
    if len(ecosystems) != len(set(ecosystems)):
        problems.append("ecosystem은 directory당 하나만 허용합니다")
    by_ecosystem = {item.get("package-ecosystem", ""): item for item in updates}
    if set(by_ecosystem) != ECOSYSTEMS:
        actual = sorted(by_ecosystem)
        expected = sorted(ECOSYSTEMS)
        problems.append(f"ecosystem 집합이 올바르지 않습니다: {actual} != {expected}")
    manifests = {
        "npm": root / "pnpm-workspace.yaml",
        "pip": root / "apps/api/requirements.txt",
        "github-actions": root / ".github/workflows",
        "docker": root / "infra",
        "docker-compose": root / "compose.yaml",
    }
    for ecosystem, manifest in manifests.items():
        item = by_ecosystem.get(ecosystem)
        if item is None:
            continue
        problems.extend(_check_ecosystem(ecosystem, item, manifest))
    return problems


def main() -> int:
    problems = evaluate(CONFIG, ROOT)
    if problems:
        raise SystemExit("[dependabot-config] " + "\n".join(problems))
    print("[dependabot-config] OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

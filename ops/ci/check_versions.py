#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

PIN_SCOPE_RE = re.compile(
    r"^\s*<!--\s*pins:\s*([a-z0-9_.-]+/[a-zA-Z0-9_.-]+)\s*-->\s*$"
)
PIN_LINE_RE = re.compile(
    r"^-\s+(\S+?)(?::\s+|==)(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.]+)?)(?:\s+.*)?$"
)
EXACT_NPM_RE = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.]+)?$")
REQ_PIN_RE = re.compile(r"^([A-Za-z0-9_.\[\]-]+)==(\S+)\s*$")

EXPECTED_ENGINES = {"node": "24.12.0", "pnpm": ">=10.17.1 <11"}


def fail(msg: str) -> None:
    print(f"[version-lock] {msg}")
    sys.exit(1)


def exact_npm_version(value: object) -> str | None:
    if not isinstance(value, str) or not EXACT_NPM_RE.fullmatch(value):
        return None
    return value


def collect_npm_section_pins(
    data: dict[str, object], source: str, section: str
) -> dict[str, str]:
    pins: dict[str, str] = {}
    raw = data.get(section, {})
    if not isinstance(raw, dict):
        return pins
    for name, version in raw.items():
        exact = exact_npm_version(version)
        if exact is None:
            continue
        pins[f"{source}/{section}/{name}"] = exact
    return pins


def collect_manifest_pins(root: Path) -> dict[str, str]:
    pins: dict[str, str] = {}

    web = json.loads((root / "apps/web/package.json").read_text(encoding="utf-8"))
    pins.update(collect_npm_section_pins(web, "web", "dependencies"))
    pins.update(collect_npm_section_pins(web, "web", "devDependencies"))

    workspace = json.loads((root / "package.json").read_text(encoding="utf-8"))
    pins.update(collect_npm_section_pins(workspace, "root", "devDependencies"))
    pnpm = workspace.get("pnpm")
    if isinstance(pnpm, dict):
        overrides = pnpm.get("overrides", {})
        if isinstance(overrides, dict):
            for name, version in overrides.items():
                exact = exact_npm_version(version)
                if exact is None:
                    continue
                pins[f"root/pnpm.overrides/{name}"] = exact

    schemas = json.loads(
        (root / "packages/schemas/package.json").read_text(encoding="utf-8")
    )
    pins.update(collect_npm_section_pins(schemas, "schemas", "devDependencies"))

    for filename, section in (
        ("requirements.txt", "requirements"),
        ("requirements-dev.txt", "requirements-dev"),
    ):
        req_path = root / "apps/api" / filename
        for line in req_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            match = REQ_PIN_RE.fullmatch(stripped)
            if match is None:
                fail(f"apps/api/{filename} must use exact == pins: {stripped}")
            pins[f"api/{section}/{match.group(1)}"] = match.group(2)
    return pins


def parse_doc_pins(text: str) -> dict[str, str]:
    pins: dict[str, str] = {}
    scope: str | None = None
    for raw_line in text.splitlines():
        scope_match = PIN_SCOPE_RE.search(raw_line)
        if scope_match:
            scope = scope_match.group(1)
            continue
        pin_match = PIN_LINE_RE.match(raw_line)
        if pin_match is None or scope is None:
            continue
        name, version = pin_match.group(1), pin_match.group(2)
        key = f"{scope}/{name}"
        if key in pins:
            fail(f"docs/versions.md duplicate pin {key}")
        pins[key] = version
    return pins


def compare_pins(doc_pins: dict[str, str], manifest_pins: dict[str, str]) -> list[str]:
    problems: list[str] = []
    doc_keys = set(doc_pins)
    manifest_keys = set(manifest_pins)
    for key in sorted(doc_keys - manifest_keys):
        problems.append(f"docs/versions.md has pin {key} missing from manifest")
    for key in sorted(manifest_keys - doc_keys):
        problems.append(f"manifest pin {key} is missing from docs/versions.md")
    for key in sorted(doc_keys & manifest_keys):
        if doc_pins[key] != manifest_pins[key]:
            problems.append(
                f"{key} docs={doc_pins[key]!r} manifest={manifest_pins[key]!r}"
            )
    return problems


def check_engine_policy(root: Path) -> list[str]:
    problems: list[str] = []
    for pkg_path, label in (
        (root / "apps/web/package.json", "apps/web/package.json"),
        (root / "package.json", "package.json"),
    ):
        data = json.loads(pkg_path.read_text(encoding="utf-8"))
        if data.get("packageManager") is not None:
            problems.append(
                f"{label} packageManager should be omitted "
                "(pnpm version is managed via engines range)"
            )

    web = json.loads((root / "apps/web/package.json").read_text(encoding="utf-8"))
    engines = web.get("engines")
    if not isinstance(engines, dict):
        problems.append(
            "apps/web/package.json engines missing (expected node/pnpm pins)"
        )
        return problems
    for key, expected in EXPECTED_ENGINES.items():
        actual = engines.get(key)
        if actual != expected:
            problems.append(
                f"apps/web/package.json engines.{key} "
                f"should be {expected!r} but is {actual!r}"
            )
    return problems


def evaluate(root: Path) -> list[str]:
    problems = check_engine_policy(root)
    doc_path = root / "docs" / "versions.md"
    if not doc_path.is_file():
        return [*problems, "docs/versions.md is missing"]
    problems.extend(
        compare_pins(
            parse_doc_pins(doc_path.read_text(encoding="utf-8")),
            collect_manifest_pins(root),
        )
    )
    return problems


def main() -> int:
    problems = evaluate(ROOT)
    if problems:
        fail("\n".join(problems))
    print("[version-lock] OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

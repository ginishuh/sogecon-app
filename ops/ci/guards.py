#!/usr/bin/env python3
"""
Repo guards: enforce agent base policies in CI and hooks.

Checks:
- Ban suppression comments (eslint-disable, ts-nocheck/ignore,
  pyright: ignore, type: ignore, noqa). Allowed exception: E402 only in
  apps/api/migrations/env.py.
- Enforce max 600 lines per source file.

Exit non-zero on violations; print a concise report.
"""
from __future__ import annotations

import re
import sys
from collections.abc import Iterable
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

CODE_GLOBS = [
    "apps/**/*.py",
    "apps/**/*.ts",
    "apps/**/*.tsx",
    "packages/**/*.ts",
    "packages/**/*.tsx",
    "ops/**/*.py",
]

# Patterns to ban (regex, case-sensitive)
BAN_PATTERNS = {
    r"\/\/\s*@ts-ignore": "ts-ignore is forbidden",
    r"\/\/\s*@ts-nocheck": "ts-nocheck is forbidden",
    r"eslint-disable": "eslint-disable is forbidden",
    r"#\s*type:\s*ignore": "type: ignore is forbidden",
    r"#\s*pyright:\s*ignore": "pyright: ignore is forbidden",
    r"#\s*noqa(?!: E402$)": "noqa is forbidden (except env.py E402)",
}

MAX_LINES = 600

ALLOWED_NOQA_FILES = {
    ROOT / "apps/api/migrations/env.py": {"E402"},
}

EXCLUDE_DIRS = {
    ROOT / "apps/api/migrations/versions",
    ROOT / ".venv",
    ROOT / "node_modules",
    ROOT / "apps/web/.next",
    ROOT / "packages/schemas",  # Generated OpenAPI types
}

# Exclude this guard script from scanning to avoid false positives
EXCLUDE_FILES = {ROOT / "ops/ci/guards.py"}


def iter_code_files() -> Iterable[Path]:
    for glob in CODE_GLOBS:
        for p in ROOT.glob(glob):
            if any(str(p).startswith(str(d)) for d in EXCLUDE_DIRS):
                continue
            if p.is_file() and p not in EXCLUDE_FILES:
                yield p


def check_banned_comments(path: Path) -> list[str]:
    violations: list[str] = []
    text = path.read_text(encoding="utf-8", errors="ignore")
    # Special-case allowed noqa in env.py E402 only
    if path in ALLOWED_NOQA_FILES:
        allowed = ALLOWED_NOQA_FILES[path]
        # remove allowed noqa occurrences from text for matching
        text = re.sub(r"#\s*noqa:\s*({})\b".format("|".join(allowed)), "", text)

    for pattern, msg in BAN_PATTERNS.items():
        if re.search(pattern, text):
            violations.append(f"{path}: {msg}")
    return violations


def check_max_lines(path: Path) -> list[str]:
    # Skip generated migration versions
    for ex in EXCLUDE_DIRS:
        if str(path).startswith(str(ex)):
            return []
    try:
        lines = sum(1 for _ in path.open("r", encoding="utf-8", errors="ignore"))
    except Exception:
        return []
    if lines > MAX_LINES:
        return [f"{path}: exceeds {MAX_LINES} lines ({lines})"]
    return []


def main() -> int:
    all_violations: list[str] = []
    for path in iter_code_files():
        all_violations.extend(check_banned_comments(path))
        all_violations.extend(check_max_lines(path))

    if all_violations:
        print(
            "[repo-guards] Policy violations detected:\n"
            + "\n".join(sorted(all_violations))
        )
        return 1
    print("[repo-guards] OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

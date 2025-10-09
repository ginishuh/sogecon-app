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

# Patterns to ban (regex). For Python broad-except, we allow inline noqa BLE001/E722.
BAN_PATTERNS = {
    r"\/\/\s*@ts-ignore": "ts-ignore is forbidden",
    r"\/\/\s*@ts-nocheck": "ts-nocheck is forbidden",
    r"eslint-disable": "eslint-disable is forbidden",
    r"#\s*type:\s*ignore": "type: ignore is forbidden",
    r"#\s*pyright:\s*ignore": "pyright: ignore is forbidden",
    r"#\s*noqa(?!: E402$)": "noqa is forbidden (except env.py E402)",
}

# Broad-except patterns (python only)
PY_BROAD_EXCEPT = [
    (
        r"except\s+Exception\s*:\s*$",
        "Broad 'except Exception' is forbidden (use specific exceptions)",
    ),
    (r"except\s+BaseException\s*:\s*$", "Broad 'except BaseException' is forbidden"),
    (r"except\s*:\s*$", "Bare 'except' is forbidden"),
]

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
EXCLUDE_FILES = {ROOT / "ops/ci/guards.py", ROOT / "apps/web/next-env.d.ts"}


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
        text = re.sub(r"#\s*noqa:\s*({})\b".format("|".join(allowed)), "", text)

    # Simple whole-file scans for suppression comments
    for pattern, msg in BAN_PATTERNS.items():
        if re.search(pattern, text):
            violations.append(f"{path}: {msg}")

    # Line-by-line scan for broad excepts with inline noqa allowance
    if path.suffix == ".py":
        for lineno, line in enumerate(text.splitlines(), start=1):
            # allow explicit inline waivers for BLE001/E722 on the same line
            if re.search(r"#\s*noqa:\s*(?:.*\bBLE001\b|.*\bE722\b)", line):
                continue
            for pattern, msg in PY_BROAD_EXCEPT:
                if re.search(pattern, line):
                    violations.append(f"{path}:{lineno}: {msg}")
    return violations


def check_max_lines(path: Path) -> list[str]:
    # Skip generated migration versions
    for ex in EXCLUDE_DIRS:
        if str(path).startswith(str(ex)):
            return []
    try:
        lines = sum(1 for _ in path.open("r", encoding="utf-8", errors="ignore"))
    except OSError:
        return []
    if lines > MAX_LINES:
        return [f"{path}: exceeds {MAX_LINES} lines ({lines})"]
    return []


def check_ts_any(path: Path) -> list[str]:
    """Detect explicit `any` usage in TS/TSX (excluding .d.ts).

    ESLint already enforces this, but this guard provides a fast pre-push hint.
    We skip generated/definition files and allow inline rationale via
    `// eslint-disable-next-line @typescript-eslint/no-explicit-any` is NOT allowed
    by policy; use proper typing instead.
    """
    if path.suffix not in {".ts", ".tsx"}:
        return []
    if path.name.endswith(".d.ts"):
        return []
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []
    violations: list[str] = []
    patterns = [
        (r":\s*any\b", ": any annotation is forbidden"),
        (r"\bas\s+any\b", "as any cast is forbidden"),
        (r"<\s*any\s*>", "angle-bracket any cast is forbidden"),
        (r"\bany\s*\[\s*\]", "any[] is forbidden"),
        (r"\bArray\s*<\s*any\s*>", "Array<any> is forbidden"),
        (r"\bRecord\s*<[^>]*,\s*any\s*>", "Record<..., any> is forbidden"),
    ]
    for lineno, line in enumerate(text.splitlines(), start=1):
        # allow occurrences in comments that explicitly state a removal plan
        if re.search(r"@ts-expect-error", line):
            # ts-expect-error doesn't justify explicit any; still warn on any tokens
            pass
        # ignore lines that are pure comments
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("/*"):
            # keep scanning; we still want to catch prohibited disables elsewhere
            pass
        for rgx, msg in patterns:
            if re.search(rgx, line):
                violations.append(f"{path}:{lineno}: {msg}")
    return violations


def main() -> int:
    all_violations: list[str] = []
    for path in iter_code_files():
        all_violations.extend(check_banned_comments(path))
        all_violations.extend(check_max_lines(path))
        all_violations.extend(check_ts_any(path))

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

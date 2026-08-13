#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

USES_RE = re.compile(r"^(\s*)(?:-\s+)?uses:\s*(.+?)\s*(?:#.*)?$")
LOCAL_RE = re.compile(r"^\./")
PINNED_RE = re.compile(
    r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*@[0-9a-f]{40}$"
)


def evaluate(root: Path) -> list[str]:
    problems: list[str] = []
    workflow_dir = root / ".github" / "workflows"
    if not workflow_dir.is_dir():
        return ["`.github/workflows`가 없습니다"]
    for path in sorted(workflow_dir.glob("*.yml")):
        for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            match = USES_RE.match(raw)
            if match is None:
                continue
            value = match.group(2).strip()
            if LOCAL_RE.match(value):
                continue
            if PINNED_RE.fullmatch(value):
                continue
            problems.append(
                f"{path.relative_to(root)}:{lineno} uses {value!r} "
                "must be owner/repo[/path]@<40-hex-sha>"
            )
    return problems


def main() -> int:
    problems = evaluate(ROOT)
    if problems:
        raise SystemExit("[action-pins] " + "\n".join(problems))
    print("[action-pins] OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

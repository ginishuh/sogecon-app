#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

USES_RE = re.compile(
    r"^(\s*)(?:-\s+)?uses:\s*(\S+?)(?:\s+#\s*(\S.*?))?\s*$"
)
LOCAL_RE = re.compile(r"^\./")
PINNED_RE = re.compile(
    r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*@[0-9a-f]{40}$"
)
VERSION_COMMENT_RE = re.compile(r"^v[0-9][0-9A-Za-z.+-]*$")


def workflow_files(workflow_dir: Path) -> list[Path]:
    return sorted(
        {*workflow_dir.glob("*.yml"), *workflow_dir.glob("*.yaml")},
        key=lambda path: path.name,
    )


def evaluate(root: Path) -> list[str]:
    problems: list[str] = []
    workflow_dir = root / ".github" / "workflows"
    if not workflow_dir.is_dir():
        return ["`.github/workflows`가 없습니다"]
    for path in workflow_files(workflow_dir):
        for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            match = USES_RE.match(raw)
            if match is None:
                continue
            value = match.group(2).strip()
            comment = (match.group(3) or "").strip()
            if LOCAL_RE.match(value):
                continue
            rel = path.relative_to(root)
            if not PINNED_RE.fullmatch(value):
                problems.append(
                    f"{rel}:{lineno} uses {value!r} "
                    "must be owner/repo[/path]@<40-hex-sha>"
                )
                continue
            if not VERSION_COMMENT_RE.fullmatch(comment):
                problems.append(
                    f"{rel}:{lineno} uses {value!r} "
                    "must include same-line '# vX.Y.Z' comment"
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

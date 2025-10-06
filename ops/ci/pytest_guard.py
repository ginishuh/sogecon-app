#!/usr/bin/env python3
"""
Pytest Guard: API 변경이 포함된 PR에서 테스트 수집(≥1)을 보장.

동작 요약
- PR 기준 브랜치(기본: origin/main)과의 변경 파일을 비교해 `apps/api/` 또는
  `tests/api/` 변경이 있을 때만 가드를 실행합니다.
- `pytest --collect-only -q`를 실행하고, pytest 종료코드로 수집 여부를 판정합니다.
  - 수집 0건(ExitCode.NO_TESTS_COLLECTED=5) → 실패 처리
  - 성공(0) → 통과
  - 그 외(2 등) → pytest 자체 오류로 간주하고 그대로 실패 처리

환경 변수
- GITHUB_BASE_REF: GitHub Actions PR 이벤트에서 제공되는 기준 브랜치 이름
  (예: 'main'). 없으면 'main'으로 가정.

주의
- 억지 우회를 피하기 위해 linter/typing suppression은 사용하지 않습니다.
"""
from __future__ import annotations

import os
import subprocess
import sys


def _run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, text=True, capture_output=True, check=False)


def _changed_files(base_branch: str) -> list[str]:
    # CI의 shallow clone을 고려하여 기준 브랜치를 fetch
    _run(["git", "fetch", "--no-tags", "--depth=1", "origin", base_branch])
    diff = _run(["git", "diff", "--name-only", f"origin/{base_branch}...HEAD"])
    if diff.returncode != 0 or not diff.stdout.strip():
        # 폴백: 최신 커밋만 비교
        base = _run(["git", "rev-parse", "HEAD~1"]).stdout.strip() or "HEAD"
        diff = _run(["git", "diff", "--name-only", f"{base}..HEAD"])
    return [line.strip() for line in diff.stdout.splitlines() if line.strip()]


def _should_guard(files: list[str]) -> bool:
    for f in files:
        if f.startswith("apps/api/") or f.startswith("tests/api/"):
            return True
    return False


def main() -> int:
    base_branch = os.environ.get("GITHUB_BASE_REF", "main")
    files = _changed_files(base_branch)
    if not _should_guard(files):
        print("[pytest-guard] Skipped (no API-related changes detected)")
        return 0

    print("[pytest-guard] Running: pytest --collect-only -q")
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q"],
        text=True,
        check=False,
    )
    if proc.returncode == 0:
        print("[pytest-guard] OK: tests collected")
        return 0
    NO_TESTS_COLLECTED = 5  # pytest.ExitCode.NO_TESTS_COLLECTED
    if proc.returncode == NO_TESTS_COLLECTED:
        print(
            "[pytest-guard] Failed: no tests collected.\n"
            "- API 변경이 포함된 PR은 최소 1개의 테스트가 수집되어야 합니다.\n"
            "- 샘플 위치: tests/api/test_errors.py\n"
        )
        return 1

    print(f"[pytest-guard] Pytest returned non-zero exit code: {proc.returncode}")
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())

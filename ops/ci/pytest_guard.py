#!/usr/bin/env python3
"""
Pytest Guard: API production code 변경 시 테스트 동반 변경과 수집 가능성을 보장.

동작 요약
- PR 기준 브랜치(기본: origin/main)와의 변경 파일을 비교한다.
- `apps/api/` production Python 변경이 있으면 같은 PR에 `tests/**/*.py` 변경이
  함께 있어야 한다. 기존 suite 수집만으로는 우회할 수 없다.
- coupling 검증 후 `pytest --collect-only -q`로 최소 1개 테스트 수집을 확인한다.

환경 변수
- GITHUB_BASE_REF: GitHub Actions PR 이벤트에서 제공되는 기준 브랜치 이름
  (예: 'main'). 없으면 'main'으로 가정.
"""
from __future__ import annotations

import os
import subprocess
import sys

API_EXEMPT_PREFIXES = (
    "apps/api/migrations/",
    "apps/api/stubs/",
)


def is_guarded_api_change(path: str) -> bool:
    if not path.startswith("apps/api/") or not path.endswith(".py"):
        return False
    return not any(path.startswith(prefix) for prefix in API_EXEMPT_PREFIXES)


def has_test_coupling(changed_files: list[str]) -> bool:
    return any(
        path.startswith("tests/") and path.endswith(".py") for path in changed_files
    )


def evaluate_coupling(changed_files: list[str]) -> tuple[list[str], str | None]:
    api_changes = [path for path in changed_files if is_guarded_api_change(path)]
    if not api_changes:
        return [], None
    if has_test_coupling(changed_files):
        return api_changes, None
    message = (
        "[pytest-guard] Failed: API production code changed without test updates.\n"
        "- 동일 PR에 tests/**/*.py 변경이 함께 있어야 합니다.\n"
        "- 변경된 API 파일:\n"
        + "\n".join(f"  - {path}" for path in api_changes)
    )
    return api_changes, message


def run_collect_guard() -> int:
    print("[pytest-guard] Running: pytest --collect-only -q")
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q"],
        text=True,
        check=False,
    )
    if proc.returncode == 0:
        print("[pytest-guard] OK: tests collected")
        return 0
    no_tests_collected = 5  # pytest.ExitCode.NO_TESTS_COLLECTED
    if proc.returncode == no_tests_collected:
        print(
            "[pytest-guard] Failed: no tests collected.\n"
            "- API 변경이 포함된 PR은 최소 1개의 테스트가 수집되어야 합니다.\n"
            "- 샘플 위치: tests/api/test_errors.py\n"
        )
        return 1

    print(f"[pytest-guard] Pytest returned non-zero exit code: {proc.returncode}")
    return proc.returncode


def _run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, text=True, capture_output=True, check=False)


def changed_files(base_branch: str) -> list[str]:
    _run(["git", "fetch", "--no-tags", "--depth=1", "origin", base_branch])
    diff = _run(["git", "diff", "--name-only", f"origin/{base_branch}...HEAD"])
    if diff.returncode != 0 or not diff.stdout.strip():
        base = _run(["git", "rev-parse", "HEAD~1"]).stdout.strip() or "HEAD"
        diff = _run(["git", "diff", "--name-only", f"{base}..HEAD"])
    return [line.strip() for line in diff.stdout.splitlines() if line.strip()]


def main() -> int:
    base_branch = os.environ.get("GITHUB_BASE_REF", "main")
    files = changed_files(base_branch)
    api_changes, coupling_error = evaluate_coupling(files)
    if not api_changes:
        print("[pytest-guard] Skipped (no API production changes detected)")
        return 0
    if coupling_error is not None:
        print(coupling_error)
        return 1
    return run_collect_guard()


if __name__ == "__main__":
    raise SystemExit(main())

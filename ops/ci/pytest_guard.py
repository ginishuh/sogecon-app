#!/usr/bin/env python3
"""
Pytest Guard: API production code 변경 시 관련 테스트 동반 변경을 보장.

동작 요약
- PR 기준 브랜치(기본: origin/main)와의 변경 파일을 비교한다.
- `apps/api/` production Python 변경마다, 같은 PR의 `tests/**/*.py` 변경 중
  **해당 API 모듈을 실제로 다루는** 파일이 최소 1개 있어야 한다.
  무관한 테스트 파일만 추가하는 우회는 허용하지 않는다.
- coupling 검증 후 `pytest --collect-only -q`로 최소 1개 테스트 수집을 확인한다.

환경 변수
- GITHUB_BASE_REF: GitHub Actions PR 이벤트에서 제공되는 기준 브랜치 이름
  (예: 'main'). 없으면 'main'으로 가정.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

API_EXEMPT_PREFIXES = (
    "apps/api/migrations/",
    "apps/api/stubs/",
)

_MIN_MODULE_DEPTH = 2

ROOT = Path(__file__).resolve().parents[2]

# apps/api/ 최상위 모듈은 integration test가 main import만으로는 커버로 인정하지 않는다.
_TOP_LEVEL_API_FILES: dict[str, tuple[str, ...]] = {
    "main": ("test_d9_errors", "test_errors", "test_success"),
    "problem_details": ("test_d9_errors", "test_errors", "problem_assertions"),
    "error_messages": ("test_d9_errors", "test_errors", "problem_assertions"),
    "scheduler": ("test_scheduler",),
    "config": ("test_scheduler", "test_d2_proxy"),
}


def is_guarded_api_change(path: str) -> bool:
    if not path.startswith("apps/api/") or not path.endswith(".py"):
        return False
    return not any(path.startswith(prefix) for prefix in API_EXEMPT_PREFIXES)


def _api_relative_path(api_path: str) -> str:
    return api_path.removeprefix("apps/api/").removesuffix(".py")


def _basename_keys(api_path: str) -> set[str]:
    rel = _api_relative_path(api_path)
    parts = rel.split("/")
    name = parts[-1]
    keys = {name, rel.replace("/", "_"), rel.replace("/", ".")}
    if name.endswith("_service"):
        keys.add(name[: -len("_service")])
    if len(parts) >= _MIN_MODULE_DEPTH and parts[0] in {
        "routers",
        "repositories",
        "services",
    }:
        keys.add(parts[1])
        if parts[1].endswith("s") and parts[0] == "repositories":
            keys.add(parts[1][:-1])
    return {key for key in keys if key}


def _test_path_tokens(test_path: str) -> set[str]:
    stem = Path(test_path).stem
    tokens = {stem}
    if stem.startswith("test_"):
        tokens.add(stem.removeprefix("test_"))
    return tokens


def _filename_covers_api(test_path: str, api_path: str) -> bool:
    rel = _api_relative_path(api_path)
    if "/" not in rel:
        allowed = _TOP_LEVEL_API_FILES.get(rel)
        if allowed is not None:
            stem = Path(test_path).stem
            return any(hint in stem for hint in allowed)

    test_tokens = _test_path_tokens(test_path)
    for key in _basename_keys(api_path):
        bare = key.replace("_service", "")
        for token in test_tokens:
            if bare and (bare in token or token in bare):
                return True
            if key in token or token in key:
                return True
    return False


def _content_covers_api(test_contents: str, api_path: str) -> bool:
    rel = _api_relative_path(api_path)
    dotted = f"apps.api.{rel.replace('/', '.')}"
    if dotted in test_contents:
        return True

    if "/" not in rel:
        if rel in _TOP_LEVEL_API_FILES:
            return False
        pattern = re.compile(rf"\bapps\.api\.{re.escape(rel)}\b")
        return pattern.search(test_contents) is not None

    # services/comments_service.py → patch/import 대상 문자열
    tail = rel.split("/")[-1]
    if tail in test_contents and f"apps.api.{rel.split('/')[0]}" in test_contents:
        return True
    return False


@lru_cache(maxsize=256)
def _read_test_file(test_path: str) -> str:
    path = ROOT / test_path
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


def test_change_covers_api(test_path: str, api_path: str) -> bool:
    if not (test_path.startswith("tests/") and test_path.endswith(".py")):
        return False
    if _filename_covers_api(test_path, api_path):
        return True
    return _content_covers_api(_read_test_file(test_path), api_path)


def changed_test_files(changed_files: list[str]) -> list[str]:
    return [
        path
        for path in changed_files
        if path.startswith("tests/") and path.endswith(".py")
    ]


def uncovered_api_changes(
    api_changes: list[str], test_changes: list[str]
) -> list[str]:
    uncovered: list[str] = []
    for api_path in api_changes:
        if any(
            test_change_covers_api(test_path, api_path)
            for test_path in test_changes
        ):
            continue
        uncovered.append(api_path)
    return uncovered


def evaluate_coupling(changed_files: list[str]) -> tuple[list[str], str | None]:
    api_changes = [path for path in changed_files if is_guarded_api_change(path)]
    if not api_changes:
        return [], None

    test_changes = changed_test_files(changed_files)
    if not test_changes:
        message = (
            "[pytest-guard] Failed: API production code changed without test updates.\n"
            "- 동일 PR에 관련 tests/**/*.py 변경이 함께 있어야 합니다.\n"
            "- 변경된 API 파일:\n"
            + "\n".join(f"  - {path}" for path in api_changes)
        )
        return api_changes, message

    uncovered = uncovered_api_changes(api_changes, test_changes)
    if uncovered:
        message = (
            "[pytest-guard] Failed: API changes are not covered by the changed tests.\n"
            "- 무관한 tests/**/*.py만 추가하는 우회는 허용하지 않습니다.\n"
            "- 각 API 변경에 대응하는 테스트 파일(이름·import/patch)이 필요합니다.\n"
            "- 커버되지 않은 API 파일:\n"
            + "\n".join(f"  - {path}" for path in uncovered)
            + "\n- 변경된 테스트 파일:\n"
            + "\n".join(f"  - {path}" for path in test_changes)
        )
        return api_changes, message

    return api_changes, None


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

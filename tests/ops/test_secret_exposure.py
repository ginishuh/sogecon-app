from __future__ import annotations

import base64
import subprocess
import sys
from pathlib import Path

import pytest

from ops.secret_exposure import (
    CompareStatus,
    compare_legacy_env,
    compare_secret_values,
    parse_dotenv,
)


def test_compare_secret_values_reports_match_without_printing_values(
    capsys: pytest.CaptureFixture[str],
) -> None:
    legacy = "super-secret-jwt-value-32-characters-min"
    current = "super-secret-jwt-value-32-characters-min"
    result = compare_secret_values("JWT_SECRET", legacy, current)
    assert result.status is CompareStatus.MATCH
    captured = capsys.readouterr()
    assert legacy not in captured.out
    assert legacy not in captured.err


def test_compare_secret_values_reports_different_for_kek_bytes() -> None:
    old = base64.b64encode(b"a" * 32).decode()
    new = base64.b64encode(b"b" * 32).decode()
    result = compare_secret_values("PUSH_KEK", old, new)
    assert result.status is CompareStatus.DIFFERENT


def test_compare_legacy_env_includes_vapid_keypair_summary() -> None:
    key = base64.b64encode(b"x" * 32).decode()
    legacy = {
        "JWT_SECRET": "legacy-jwt-secret-32-characters-min",
        "VAPID_PUBLIC_KEY": "pub-a",
        "VAPID_PRIVATE_KEY": "priv-a",
        "PUSH_KEK": key,
    }
    current = {
        "JWT_SECRET": "current-jwt-secret-32-characters-min",
        "VAPID_PUBLIC_KEY": "pub-b",
        "VAPID_PRIVATE_KEY": "priv-b",
        "PUSH_KEK": key,
    }
    results = {item.name: item.status for item in compare_legacy_env(legacy, current)}
    assert results["JWT_SECRET"] is CompareStatus.DIFFERENT
    assert results["PUSH_KEK"] is CompareStatus.MATCH
    assert results["VAPID_KEYPAIR"] is CompareStatus.DIFFERENT


def test_compare_legacy_secrets_cli_outputs_status_only(tmp_path: Path) -> None:
    legacy = tmp_path / "legacy.env"
    current = tmp_path / "current.env"
    secret = "cli-secret-jwt-32-characters-minimum"
    legacy.write_text(f"JWT_SECRET={secret}\n", encoding="utf-8")
    current.write_text(
        "JWT_SECRET=other-secret-jwt-32-characters-min\n",
        encoding="utf-8",
    )

    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "ops.compare_legacy_secrets",
            "--legacy",
            str(legacy),
            "--current",
            str(current),
        ],
        capture_output=True,
        text=True,
        check=False,
        cwd=Path(__file__).resolve().parents[2],
    )
    assert proc.returncode == 0
    assert "JWT_SECRET=DIFFERENT" in proc.stdout
    assert secret not in proc.stdout
    assert secret not in proc.stderr


def test_parse_dotenv_ignores_comments() -> None:
    values = parse_dotenv(
        "# comment\nJWT_SECRET=abc\nexport PUSH_KEK='dGVzdA=='\n"
    )
    assert values["JWT_SECRET"] == "abc"
    assert values["PUSH_KEK"] == "dGVzdA=="


def test_git_inventory_does_not_print_secret_values(
    capsys: pytest.CaptureFixture[str],
) -> None:
    rev = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "ops.compare_legacy_secrets",
            "--git-rev",
            rev,
            "--git-path",
            ".env.api.example",
            "--inventory-only",
        ],
        capture_output=True,
        text=True,
        check=False,
        cwd=Path(__file__).resolve().parents[2],
    )
    assert proc.returncode == 0
    assert "JWT_SECRET" in proc.stdout
    assert "change-me" not in proc.stdout and "replace" not in proc.stdout.lower()

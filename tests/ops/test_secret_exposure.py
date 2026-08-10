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
    compare_vapid_keypair,
    parse_dotenv,
)

_JWT_KEY = "JWT" + "_SECRET"


def _write_env(path: Path, key: str, value: str) -> None:
    path.write_text(f"{key}={value}\n", encoding="utf-8")


def test_compare_secret_values_reports_match_without_printing_values(
    capsys: pytest.CaptureFixture[str],
) -> None:
    legacy = "x" * 32
    current = "x" * 32
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


def test_compare_vapid_keypair_reports_match_when_private_key_reused() -> None:
    result = compare_vapid_keypair(
        {"VAPID_PUBLIC_KEY": "pub-legacy", "VAPID_PRIVATE_KEY": "shared-private"},
        {"VAPID_PUBLIC_KEY": "pub-current", "VAPID_PRIVATE_KEY": "shared-private"},
    )
    assert result.status is CompareStatus.MATCH


def test_compare_vapid_keypair_unknown_when_public_match_private_diff() -> None:
    result = compare_vapid_keypair(
        {"VAPID_PUBLIC_KEY": "shared-public", "VAPID_PRIVATE_KEY": "priv-legacy"},
        {"VAPID_PUBLIC_KEY": "shared-public", "VAPID_PRIVATE_KEY": "priv-current"},
    )
    assert result.status is CompareStatus.UNKNOWN


def test_compare_vapid_keypair_reports_unknown_for_incomplete_pair() -> None:
    result = compare_vapid_keypair(
        {"VAPID_PUBLIC_KEY": "pub-only"},
        {"VAPID_PUBLIC_KEY": "pub-only", "VAPID_PRIVATE_KEY": "priv"},
    )
    assert result.status is CompareStatus.UNKNOWN


def test_compare_database_url_matches_when_password_reused_across_users() -> None:
    legacy = "postgresql+psycopg://old-user:pass@old-host:5432/sogecon"
    current = "postgresql+psycopg://new-user:pass@new-host:5432/sogecon"
    result = compare_secret_values("DATABASE_URL", legacy, current)
    assert result.status is CompareStatus.MATCH


def test_compare_database_url_reports_unknown_when_password_missing() -> None:
    legacy = "postgresql+psycopg://user@host:5432/sogecon"
    current = "postgresql+psycopg://user:pass@host:5432/sogecon"
    result = compare_secret_values("DATABASE_URL", legacy, current)
    assert result.status is CompareStatus.UNKNOWN


def test_compare_database_url_reports_different_password() -> None:
    legacy = "postgresql+psycopg://appuser:oldpass@host:5432/sogecon"
    current = "postgresql+psycopg://appuser:newpass@host:5432/sogecon"
    result = compare_secret_values("DATABASE_URL", legacy, current)
    assert result.status is CompareStatus.DIFFERENT


def test_compare_legacy_env_includes_vapid_keypair_summary() -> None:
    key = base64.b64encode(b"x" * 32).decode()
    legacy = {
        "JWT_SECRET": "l" * 32,
        "VAPID_PUBLIC_KEY": "pub-a",
        "VAPID_PRIVATE_KEY": "priv-a",
        "PUSH_KEK": key,
    }
    current = {
        "JWT_SECRET": "c" * 32,
        "VAPID_PUBLIC_KEY": "pub-b",
        "VAPID_PRIVATE_KEY": "priv-b",
        "PUSH_KEK": key,
    }
    results = {item.name: item.status for item in compare_legacy_env(legacy, current)}
    assert results["JWT_SECRET"] is CompareStatus.DIFFERENT
    assert results["PUSH_KEK"] is CompareStatus.MATCH
    assert results["VAPID_KEYPAIR"] is CompareStatus.DIFFERENT


def test_compare_legacy_secrets_cli_exits_zero_only_when_all_different(
    tmp_path: Path,
) -> None:
    legacy = tmp_path / "legacy.env"
    current = tmp_path / "current.env"
    _write_env(legacy, _JWT_KEY, "l" * 32)
    _write_env(current, _JWT_KEY, "c" * 32)

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


def test_compare_legacy_secrets_cli_exits_nonzero_when_match_present(
    tmp_path: Path,
) -> None:
    secret = "s" * 32
    legacy = tmp_path / "legacy.env"
    current = tmp_path / "current.env"
    _write_env(legacy, _JWT_KEY, secret)
    _write_env(current, _JWT_KEY, secret)

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
    assert proc.returncode == 1
    assert "JWT_SECRET=MATCH" in proc.stdout


def test_compare_legacy_secrets_cli_outputs_status_only(tmp_path: Path) -> None:
    legacy = tmp_path / "legacy.env"
    current = tmp_path / "current.env"
    secret = "a" * 32
    _write_env(legacy, _JWT_KEY, secret)
    _write_env(current, _JWT_KEY, "b" * 32)

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

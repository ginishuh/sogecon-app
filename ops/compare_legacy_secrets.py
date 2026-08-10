"""Compare legacy and current env secrets without printing values."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from ops.secret_exposure import (
    compare_legacy_env,
    inventory_env_names,
    load_dotenv_file,
    parse_dotenv,
)


def _load_git_file(rev: str, path: str) -> str:
    proc = subprocess.run(
        ["git", "show", f"{rev}:{path}"],
        check=False,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"git show {rev}:{path} failed")
    return proc.stdout


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compare legacy and current secrets (MATCH/DIFFERENT/UNKNOWN only)"
    )
    parser.add_argument("--legacy", type=Path, help="Legacy dotenv file path")
    parser.add_argument("--current", type=Path, help="Current dotenv file path")
    parser.add_argument("--git-rev", help="Git revision containing legacy file")
    parser.add_argument("--git-path", help="Legacy file path inside git revision")
    parser.add_argument(
        "--inventory-only",
        action="store_true",
        help="Print env var names from legacy source only",
    )
    args = parser.parse_args()

    if args.git_rev and args.git_path:
        legacy_values = parse_dotenv(_load_git_file(args.git_rev, args.git_path))
    elif args.legacy:
        legacy_values = load_dotenv_file(args.legacy)
    else:
        print(
            "legacy source required: --legacy or --git-rev/--git-path",
            file=sys.stderr,
        )
        return 2

    if args.inventory_only:
        for name in inventory_env_names(legacy_values):
            print(name)
        return 0

    if not args.current:
        print("--current is required unless --inventory-only", file=sys.stderr)
        return 2

    current_values = load_dotenv_file(args.current)
    for item in compare_legacy_env(legacy_values, current_values):
        print(f"{item.name}={item.status.value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

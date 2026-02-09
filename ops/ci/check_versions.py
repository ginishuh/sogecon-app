#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def fail(msg: str) -> None:
    print(f"[version-lock] {msg}")
    sys.exit(1)


def check_package_json() -> None:
    # apps/web specific deps pins
    pkg_path = ROOT / "apps/web/package.json"
    data = json.loads(pkg_path.read_text(encoding="utf-8"))
    problems: list[str] = []

    expected_deps = {
        "dependencies": {
            "next": "15.5.10",
            "react": "19.2.3",
            "react-dom": "19.2.3",
        },
        "devDependencies": {
            "eslint": "9.36.0",
            "eslint-config-next": "15.5.2",
            "@typescript-eslint/eslint-plugin": "8.44.1",
            "@typescript-eslint/parser": "8.44.1",
            "eslint-plugin-import": "2.32.0",
            "eslint-import-resolver-typescript": "3.10.1",
            "eslint-plugin-promise": "7.2.1",
            "typescript": "5.8.3",
            "autoprefixer": "10.4.21",
            "postcss": "8.5.6",
            "tailwindcss": "3.4.13",
        },
    }

    for section, expected in expected_deps.items():
        actual: dict[str, str] = data.get(section, {})
        for name, ver in expected.items():
            if actual.get(name) != ver:
                got = actual.get(name)
                sec = section
                nm = name
                v = repr(ver)
                g = repr(got)
                msg = (
                    f"apps/web/package.json {sec}.{nm} should be {v} but is {g}"
                )
                problems.append(msg)

    # Engines guidance to keep local runtime consistent
    engines = data.get("engines", {})
    expected_engines = {"node": "24.12.0", "pnpm": ">=10.17.1 <11"}
    if not engines:
        problems.append(
            "apps/web/package.json engines missing (expected node/pnpm pins)"
        )
    else:
        for k, v in expected_engines.items():
            if engines.get(k) != v:
                got = engines.get(k)
                problems.append(
                    f"apps/web/package.json engines.{k} should be {v!r} but is {got!r}"
                )

    # packageManager pin
    pm = data.get("packageManager")
    if pm is not None:
        msg = (
            "apps/web/package.json packageManager should be omitted "
            "(pnpm version is managed via engines range)"
        )
        problems.append(msg)

    if problems:
        fail("\n".join(problems))


def check_workspace_package_manager() -> None:
    root_pkg = ROOT / "package.json"
    data = json.loads(root_pkg.read_text(encoding="utf-8"))
    if data.get("packageManager") is not None:
        fail(
            "package.json packageManager should be omitted "
            "(pnpm version is managed via engines range)"
        )


def normalize_req_line(line: str) -> str:
    return line.strip()


def check_requirements() -> None:
    problems: list[str] = []
    req_txt = (
        ROOT / "apps/api/requirements.txt"
    ).read_text(encoding="utf-8").splitlines()
    req_dev = (
        ROOT / "apps/api/requirements-dev.txt"
    ).read_text(encoding="utf-8").splitlines()

    expected_req = {
        "apps/api/requirements.txt": [
            "fastapi==0.123.5",
            "uvicorn[standard]==0.37.0",
            "sqlalchemy==2.0.43",
            "psycopg[binary]==3.2.10",
            "alembic==1.16.5",
            "pydantic-settings==2.11.0",
            "python-multipart==0.0.20",
            "slowapi==0.1.9",
        ],
        "apps/api/requirements-dev.txt": [
            "ruff==0.13.2",
            "pyright==1.1.404",
            "pytest==8.4.2",
        ],
    }


    def assert_contains(
        path: str, content_lines: list[str], expected_lines: list[str]
    ) -> None:
        normalized = {
            normalize_req_line(line)
            for line in content_lines
            if line.strip() and not line.strip().startswith("#")
        }
        for exp in expected_lines:
            if exp not in normalized:
                problems.append(f"{path} must contain exact line: {exp}")

    assert_contains(
        "apps/api/requirements.txt",
        req_txt,
        expected_req["apps/api/requirements.txt"],
    )
    assert_contains(
        "apps/api/requirements-dev.txt",
        req_dev,
        expected_req["apps/api/requirements-dev.txt"],
    )

    if problems:
        fail("\n".join(problems))


def main() -> int:
    check_workspace_package_manager()
    check_package_json()
    check_requirements()
    print("[version-lock] OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

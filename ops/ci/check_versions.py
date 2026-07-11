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
            "@tanstack/react-query": "5.101.2",
            "next": "16.2.10",
            "react": "19.2.7",
            "react-dom": "19.2.7",
        },
        "devDependencies": {
            "@eslint/eslintrc": "3.3.6",
            "@next/bundle-analyzer": "16.2.10",
            "@testing-library/jest-dom": "6.9.1",
            "@testing-library/react": "16.3.2",
            "@types/node": "24.13.3",
            "@types/react": "19.2.17",
            "eslint": "9.39.5",
            "eslint-config-next": "15.5.20",
            "@typescript-eslint/eslint-plugin": "8.63.0",
            "@typescript-eslint/parser": "8.63.0",
            "eslint-plugin-import": "2.32.0",
            "eslint-import-resolver-typescript": "3.10.1",
            "eslint-plugin-promise": "7.3.0",
            "typescript": "5.9.3",
            "autoprefixer": "10.5.2",
            "axe-core": "4.12.1",
            "baseline-browser-mapping": "2.10.42",
            "postcss": "8.5.16",
            "puppeteer": "24.43.1",
            "tailwindcss": "3.4.19",
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

    expected_dev_dependencies = {
        "@commitlint/cli": "20.1.0",
        "png-to-ico": "3.0.2",
        "sharp": "0.35.3",
    }
    actual_dev_dependencies: dict[str, str] = data.get("devDependencies", {})
    for name, version in expected_dev_dependencies.items():
        if actual_dev_dependencies.get(name) != version:
            fail(
                f"package.json devDependencies.{name} should be "
                f"{version!r} but is {actual_dev_dependencies.get(name)!r}"
            )

    expected_overrides = {
        "vite": "6.4.3",
        "js-yaml": "4.2.0",
        "postcss": "8.5.16",
    }
    overrides = data.get("pnpm", {}).get("overrides", {})
    if overrides != expected_overrides:
        fail(
            "package.json pnpm.overrides should contain only the documented "
            f"security pins {expected_overrides!r}, but is {overrides!r}"
        )


def check_schemas_package() -> None:
    pkg_path = ROOT / "packages/schemas/package.json"
    data = json.loads(pkg_path.read_text(encoding="utf-8"))
    expected = "7.13.0"
    actual = data.get("devDependencies", {}).get("openapi-typescript")
    if actual != expected:
        fail(
            "packages/schemas/package.json "
            f"devDependencies.openapi-typescript should be {expected!r} "
            f"but is {actual!r}"
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
            "fastapi==0.139.0",
            "uvicorn[standard]==0.51.0",
            "sqlalchemy==2.0.51",
            "psycopg[binary]==3.3.4",
            "alembic==1.18.5",
            "pydantic-settings==2.14.2",
            "python-multipart==0.0.32",
            "slowapi==0.1.10",
            "bcrypt==4.2.0",
            "itsdangerous==2.2.0",
            "email-validator==2.3.0",
            "pywebpush==2.3.0",
            "cryptography==49.0.0",
            "Pillow==12.3.0",
            "sentry-sdk[starlette]==2.64.0",
            "apscheduler==3.11.3",
        ],
        "apps/api/requirements-dev.txt": [
            "ruff==0.15.21",
            "pyright==1.1.411",
            "pytest==9.1.1",
            "pytest-asyncio==1.4.0",
            "httpx==0.27.2",
            "bandit==1.9.4",
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
    check_schemas_package()
    check_package_json()
    check_requirements()
    print("[version-lock] OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

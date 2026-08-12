"""Router 계층이 repository·ORM에 직접 접근하지 않도록 AST 검사."""

from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTERS_DIR = ROOT / "apps/api/routers"


def _is_forbidden_repo_module(module: str | None) -> bool:
    if not module:
        return False
    return module.endswith("repositories") or ".repositories." in module


def _is_forbidden_models_module(module: str | None) -> bool:
    if not module:
        return False
    return module in {"..models", "apps.api.models"} or module.endswith(".models")


def check_router_file(path: Path) -> list[str]:
    violations: list[str] = []
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if _is_forbidden_repo_module(node.module):
                violations.append(
                    f"{path}:{node.lineno}: router must not import repositories"
                )
            if _is_forbidden_models_module(node.module):
                violations.append(
                    f"{path}:{node.lineno}: router must not import models"
                )
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr == "refresh" and isinstance(node.func.value, ast.Name):
                if node.func.value.id == "db":
                    violations.append(
                        f"{path}:{node.lineno}: router must not call db.refresh"
                    )
    return violations


def check_router_layer() -> list[str]:
    if not ROUTERS_DIR.is_dir():
        return [f"{ROUTERS_DIR}: routers directory is missing"]
    violations: list[str] = []
    for path in sorted(ROUTERS_DIR.glob("*.py")):
        if path.name == "__init__.py":
            continue
        violations.extend(check_router_file(path))
    return violations


def main() -> int:
    violations = check_router_layer()
    if violations:
        print(
            "[router-layer-guard] Violations detected:\n"
            + "\n".join(sorted(violations))
        )
        return 1
    print("[router-layer-guard] OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

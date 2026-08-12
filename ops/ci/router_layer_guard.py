"""Router 계층이 repository·ORM에 직접 접근하지 않도록 AST 검사."""

from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTERS_DIR = ROOT / "apps/api/routers"

_FORBIDDEN_DB_ATTRS = frozenset(
    {"execute", "commit", "rollback", "delete", "flush", "merge", "add", "refresh"}
)


def _module_mentions_repositories(module: str | None, *, level: int = 0) -> bool:
    if not module:
        return False
    if module == "repositories" or module.startswith("repositories."):
        return level >= 1
    return module.endswith("repositories") or ".repositories." in module


def _import_from_mentions_models(node: ast.ImportFrom) -> bool:
    module = node.module
    if module and (
        module == "models"
        or module.endswith(".models")
        or module in {"apps.api.models"}
    ):
        if module == "models":
            return node.level >= 1
        return True
    return any(alias.name == "models" for alias in node.names)


def _import_mentions_repositories(node: ast.Import) -> bool:
    return any("repositories" in alias.name for alias in node.names)


def check_router_file(path: Path) -> list[str]:
    violations: list[str] = []
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if _module_mentions_repositories(node.module, level=node.level):
                violations.append(
                    f"{path}:{node.lineno}: router must not import repositories"
                )
            if _import_from_mentions_models(node):
                violations.append(
                    f"{path}:{node.lineno}: router must not import models"
                )
        if isinstance(node, ast.Import) and _import_mentions_repositories(node):
            violations.append(
                f"{path}:{node.lineno}: router must not import repositories"
            )
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if isinstance(node.func.value, ast.Name) and node.func.value.id == "db":
                if node.func.attr in _FORBIDDEN_DB_ATTRS:
                    violations.append(
                        f"{path}:{node.lineno}: router must not call db."
                        f"{node.func.attr}"
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

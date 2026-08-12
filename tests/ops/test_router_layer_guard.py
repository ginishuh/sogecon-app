from __future__ import annotations

from pathlib import Path

from ops.ci.router_layer_guard import check_router_file, check_router_layer


def test_router_layer_guard_passes_current_routers() -> None:
    violations = check_router_layer()
    assert violations == []


def test_router_layer_guard_detects_repo_import_from(tmp_path: Path) -> None:
    bad_router = tmp_path / "bad_from.py"
    bad_router.write_text(
        "from ..repositories import posts as posts_repo\n",
        encoding="utf-8",
    )
    violations = check_router_file(bad_router)
    assert any("repositories" in item for item in violations)


def test_router_layer_guard_detects_repo_submodule_import(tmp_path: Path) -> None:
    bad_router = tmp_path / "bad_submodule.py"
    bad_router.write_text(
        "from ..repositories.posts import get_post\n",
        encoding="utf-8",
    )
    violations = check_router_file(bad_router)
    assert any("repositories" in item for item in violations)


def test_router_layer_guard_detects_repo_import_statement(tmp_path: Path) -> None:
    bad_router = tmp_path / "bad_import.py"
    bad_router.write_text(
        "import apps.api.repositories.posts as posts_repo\n",
        encoding="utf-8",
    )
    violations = check_router_file(bad_router)
    assert any("repositories" in item for item in violations)


def test_router_layer_guard_detects_models_import(tmp_path: Path) -> None:
    bad_router = tmp_path / "bad_models.py"
    bad_router.write_text(
        "from ..models import Member\n",
        encoding="utf-8",
    )
    violations = check_router_file(bad_router)
    assert any("models" in item for item in violations)


def test_router_layer_guard_detects_db_execute(tmp_path: Path) -> None:
    bad_router = tmp_path / "bad_db.py"
    bad_router.write_text(
        "async def handler(db):\n    await db.execute('select 1')\n",
        encoding="utf-8",
    )
    violations = check_router_file(bad_router)
    assert any("db.execute" in item for item in violations)

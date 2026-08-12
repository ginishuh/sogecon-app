from __future__ import annotations

from pathlib import Path

from ops.ci.router_layer_guard import check_router_file, check_router_layer


def test_router_layer_guard_passes_current_routers() -> None:
    violations = check_router_layer()
    assert violations == []


def test_router_layer_guard_detects_repo_import(tmp_path: Path) -> None:
    bad_router = tmp_path / "bad.py"
    bad_router.write_text(
        "from ..repositories import posts as posts_repo\n",
        encoding="utf-8",
    )
    violations = check_router_file(bad_router)
    assert any("repositories" in item for item in violations)

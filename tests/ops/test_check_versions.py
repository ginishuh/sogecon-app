from __future__ import annotations

import json
import shutil
from pathlib import Path

from ops.ci import check_versions

REPO = Path(__file__).resolve().parents[2]
TREE_FILES = (
    "apps/web/package.json",
    "package.json",
    "packages/schemas/package.json",
    "apps/api/requirements.txt",
    "apps/api/requirements-dev.txt",
    "docs/versions.md",
)


def _copy_tree(tmp_path: Path) -> Path:
    for rel in TREE_FILES:
        dest = tmp_path / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(REPO / rel, dest)
    return tmp_path


def test_repo_exact_pins_match_manifest() -> None:
    assert check_versions.evaluate(REPO) == []


def test_doc_version_drift_fails(tmp_path: Path) -> None:
    root = _copy_tree(tmp_path)
    doc = root / "docs" / "versions.md"
    doc.write_text(
        doc.read_text(encoding="utf-8").replace(
            "- next: 16.2.11",
            "- next: 16.2.10",
            1,
        ),
        encoding="utf-8",
    )
    problems = check_versions.evaluate(root)
    assert problems
    assert any("web/dependencies/next" in item for item in problems)


def test_manifest_version_drift_fails(tmp_path: Path) -> None:
    root = _copy_tree(tmp_path)
    pkg_path = root / "apps/web/package.json"
    data = json.loads(pkg_path.read_text(encoding="utf-8"))
    data["dependencies"]["next"] = "16.2.10"
    pkg_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    problems = check_versions.evaluate(root)
    assert problems
    assert any("web/dependencies/next" in item for item in problems)


def test_doc_pin_removed_fails(tmp_path: Path) -> None:
    root = _copy_tree(tmp_path)
    doc = root / "docs" / "versions.md"
    doc.write_text(
        doc.read_text(encoding="utf-8").replace(
            "- @types/react-dom: 19.2.3\n",
            "",
            1,
        ),
        encoding="utf-8",
    )
    problems = check_versions.evaluate(root)
    assert problems
    assert any("web/devDependencies/@types/react-dom" in item for item in problems)


def test_manifest_only_pin_fails(tmp_path: Path) -> None:
    root = _copy_tree(tmp_path)
    pkg_path = root / "apps/web/package.json"
    data = json.loads(pkg_path.read_text(encoding="utf-8"))
    data["dependencies"]["left-pad"] = "1.3.0"
    pkg_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    problems = check_versions.evaluate(root)
    assert problems
    assert any("web/dependencies/left-pad" in item for item in problems)

from __future__ import annotations

import shutil
from pathlib import Path

import yaml

from ops.ci import check_action_pins, check_dependabot

REPO = Path(__file__).resolve().parents[2]


def test_repo_dependabot_config_ok() -> None:
    assert check_dependabot.evaluate(check_dependabot.CONFIG, REPO) == []


def test_compose_registered_as_docker_fails(tmp_path: Path) -> None:
    dest = tmp_path / "dependabot.yml"
    shutil.copy(REPO / ".github/dependabot.yml", dest)
    data = yaml.safe_load(dest.read_text(encoding="utf-8"))
    for item in data["updates"]:
        if item.get("package-ecosystem") == "docker":
            item["directory"] = "/"
            break
    dest.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
    problems = check_dependabot.evaluate(dest, REPO)
    assert problems
    assert any("docker directory" in item for item in problems)


def test_repo_action_pins_ok() -> None:
    assert check_action_pins.evaluate(REPO) == []


def test_mutable_action_ref_fails(tmp_path: Path) -> None:
    workflow = tmp_path / ".github" / "workflows" / "ci.yml"
    workflow.parent.mkdir(parents=True, exist_ok=True)
    workflow.write_text(
        "jobs:\n  x:\n    steps:\n      - uses: owner/action@main\n",
        encoding="utf-8",
    )
    problems = check_action_pins.evaluate(tmp_path)
    assert problems
    assert any("owner/action@main" in item for item in problems)

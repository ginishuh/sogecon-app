from pathlib import Path

import pytest

from ops.ci import guards


@pytest.mark.parametrize(
    "declaration",
    (
        "continue-on-error: true",
        "continue-on-error: ${{ true }}",
        "continue-on-error: false",
        '"continue-on-error": true',
        "'continue-on-error': true",
    ),
)
def test_e2e_workflow_rejects_soft_fail_key(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, declaration: str
) -> None:
    workflow = tmp_path / "e2e.yml"
    workflow.write_text(f"jobs:\n  e2e:\n    {declaration}\n", encoding="utf-8")
    protection = tmp_path / "apply-protection.sh"
    protection.write_text('{ "context": "e2e" }\n', encoding="utf-8")
    monkeypatch.setattr(guards, "E2E_WORKFLOW", workflow)
    monkeypatch.setattr(guards, "BRANCH_PROTECTION_SCRIPT", protection)

    assert guards.check_workflow_policies() == [
        f"{workflow}: E2E must remain a hard gate"
    ]


def test_branch_protection_requires_e2e_context(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    workflow = tmp_path / "e2e.yml"
    workflow.write_text("jobs:\n  e2e:\n    steps: []\n", encoding="utf-8")
    protection = tmp_path / "apply-protection.sh"
    protection.write_text('{ "context": "web" }\n', encoding="utf-8")
    monkeypatch.setattr(guards, "E2E_WORKFLOW", workflow)
    monkeypatch.setattr(guards, "BRANCH_PROTECTION_SCRIPT", protection)

    assert guards.check_workflow_policies() == [
        f"{protection}: e2e must remain a required check"
    ]

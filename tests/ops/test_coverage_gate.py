from __future__ import annotations

import json
from pathlib import Path

from ops.ci import coverage_gate


def test_check_api_coverage_fails_below_baseline(tmp_path: Path) -> None:
    report = tmp_path / "api.json"
    report.write_text(
        json.dumps({"totals": {"percent_covered": 70.0}}),
        encoding="utf-8",
    )
    baseline = {"api": {"line_percent_min": 75.0}}
    violations = coverage_gate.check_api_coverage(report, baseline)
    assert violations
    assert "below baseline" in violations[0]


def test_check_web_coverage_passes_at_baseline(tmp_path: Path) -> None:
    summary = tmp_path / "summary.json"
    summary.write_text(
        json.dumps({"total": {"lines": {"pct": 57.5}}}),
        encoding="utf-8",
    )
    baseline = {"web": {"lines_percent_min": 57.0}}
    assert coverage_gate.check_web_coverage(summary, baseline) == []

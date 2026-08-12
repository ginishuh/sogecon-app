#!/usr/bin/env python3
"""Coverage baseline gate for API (pytest-cov JSON) and Web (vitest v8 summary)."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASELINE_PATH = Path(__file__).with_name("coverage_baseline.json")


def _load_baseline() -> dict[str, object]:
    return json.loads(BASELINE_PATH.read_text(encoding="utf-8"))


def check_api_coverage(report_path: Path, baseline: dict[str, object]) -> list[str]:
    violations: list[str] = []
    api_cfg = baseline.get("api")
    if not isinstance(api_cfg, dict):
        violations.append("coverage baseline: missing api section")
    else:
        min_pct = api_cfg.get("line_percent_min")
        if not isinstance(min_pct, (int, float)):
            violations.append("coverage baseline: api.line_percent_min must be numeric")
        elif not report_path.is_file():
            violations.append(f"API coverage report not found: {report_path}")
        else:
            data = json.loads(report_path.read_text(encoding="utf-8"))
            totals = data.get("totals")
            if not isinstance(totals, dict):
                violations.append(f"API coverage report missing totals: {report_path}")
            else:
                covered = totals.get("percent_covered")
                if not isinstance(covered, (int, float)):
                    violations.append(
                        f"API coverage report missing percent_covered: {report_path}"
                    )
                elif float(covered) + 1e-9 < float(min_pct):
                    violations.append(
                        "API line coverage "
                        f"{covered:.2f}% is below baseline {float(min_pct):.2f}%"
                    )
                else:
                    print(
                        f"[coverage-gate] API line coverage OK: "
                        f"{covered:.2f}% (min {min_pct}%)"
                    )
    return violations


def check_web_coverage(summary_path: Path, baseline: dict[str, object]) -> list[str]:
    violations: list[str] = []
    web_cfg = baseline.get("web")
    if not isinstance(web_cfg, dict):
        violations.append("coverage baseline: missing web section")
    else:
        min_pct = web_cfg.get("lines_percent_min")
        if not isinstance(min_pct, (int, float)):
            violations.append(
                "coverage baseline: web.lines_percent_min must be numeric"
            )
        elif not summary_path.is_file():
            violations.append(f"Web coverage summary not found: {summary_path}")
        else:
            data = json.loads(summary_path.read_text(encoding="utf-8"))
            total = data.get("total")
            if not isinstance(total, dict):
                violations.append(f"Web coverage summary missing total: {summary_path}")
            else:
                lines = total.get("lines")
                if not isinstance(lines, dict):
                    violations.append(
                        f"Web coverage summary missing total.lines: {summary_path}"
                    )
                else:
                    pct = lines.get("pct")
                    if not isinstance(pct, (int, float)):
                        violations.append(
                            "Web coverage summary missing total.lines.pct: "
                            f"{summary_path}"
                        )
                    elif float(pct) + 1e-9 < float(min_pct):
                        violations.append(
                            "Web line coverage "
                            f"{pct:.2f}% is below baseline {float(min_pct):.2f}%"
                        )
                    else:
                        print(
                            f"[coverage-gate] Web line coverage OK: "
                            f"{pct:.2f}% (min {min_pct}%)"
                        )
    return violations


def run_api_pytest_cov(report_path: Path) -> int:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "-q",
        "--cov=apps/api",
        f"--cov-report=json:{report_path}",
    ]
    print("[coverage-gate] Running:", " ".join(cmd))
    proc = subprocess.run(cmd, cwd=ROOT, check=False)
    return proc.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="Enforce coverage baselines")
    parser.add_argument(
        "--api-report",
        type=Path,
        default=ROOT / "coverage" / "api-coverage.json",
        help="pytest-cov JSON report path",
    )
    parser.add_argument(
        "--web-summary",
        type=Path,
        default=ROOT / "apps/web/coverage/coverage-summary.json",
        help="vitest v8 json-summary path",
    )
    parser.add_argument(
        "--run-api-pytest",
        action="store_true",
        help="Run pytest with coverage before checking API baseline",
    )
    parser.add_argument("--api-only", action="store_true")
    parser.add_argument("--web-only", action="store_true")
    args = parser.parse_args()

    baseline = _load_baseline()
    violations: list[str] = []

    check_api = not args.web_only
    check_web = not args.api_only

    if check_api and args.run_api_pytest:
        code = run_api_pytest_cov(args.api_report)
        if code != 0:
            return code

    if check_api:
        violations.extend(check_api_coverage(args.api_report, baseline))
    if check_web:
        violations.extend(check_web_coverage(args.web_summary, baseline))

    if violations:
        print("[coverage-gate] FAIL\n" + "\n".join(violations))
        return 1

    print("[coverage-gate] OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

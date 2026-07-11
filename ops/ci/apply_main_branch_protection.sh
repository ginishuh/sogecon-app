#!/usr/bin/env bash
# main 브랜치 ruleset — required status checks (GitHub UI 대체용)
# 사용: GITHUB_TOKEN 또는 gh auth 필요. 실패 시 docs/ci_quality_gates.md 수동 절차 따름.
set -euo pipefail

REPO="${1:-ginishuh/sogecon-app}"

payload="$(cat <<'JSON'
{
  "name": "main-quality-gates",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "repo-guards" },
          { "context": "python" },
          { "context": "contract" },
          { "context": "web" },
          { "context": "secrets-scan" },
          { "context": "semgrep" }
        ]
      }
    }
  ]
}
JSON
)"

if ! command -v gh >/dev/null 2>&1; then
  echo "[branch-protection] gh CLI required" >&2
  exit 1
fi

echo "[branch-protection] applying ruleset to $REPO (main)"
gh api "repos/${REPO}/rulesets" -X POST --input - <<<"$payload"
echo "[branch-protection] done — verify in GitHub Settings → Rules"

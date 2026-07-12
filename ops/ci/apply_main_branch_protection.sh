#!/usr/bin/env bash
# main 브랜치 ruleset upsert — required status checks (GitHub UI 대체용)
# 사용: gh auth 필요. 기존 `main-quality-gates`가 있으면 PUT, 없으면 POST.
# 실패 시 docs/ci_quality_gates.md 수동 절차를 따른다.
set -euo pipefail

REPO="${1:-ginishuh/sogecon-app}"
RULESET_NAME="main-quality-gates"

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
          { "context": "e2e" },
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

echo "[branch-protection] looking up ruleset '${RULESET_NAME}' on ${REPO}"
existing_id="$(
  gh api "repos/${REPO}/rulesets" --paginate \
    --jq ".[] | select(.name==\"${RULESET_NAME}\") | .id" \
    | head -n 1
)"

if [[ -n "${existing_id}" ]]; then
  echo "[branch-protection] updating ruleset id=${existing_id} (PUT)"
  result="$(gh api "repos/${REPO}/rulesets/${existing_id}" -X PUT --input - <<<"${payload}")"
else
  echo "[branch-protection] creating ruleset (POST)"
  result="$(gh api "repos/${REPO}/rulesets" -X POST --input - <<<"${payload}")"
fi

echo "${result}" | jq -r '
  "id=\(.id) name=\(.name) enforcement=\(.enforcement)",
  (.rules[] | select(.type=="required_status_checks") |
    "required checks: " + ([.parameters.required_status_checks[].context] | join(", ")))
'
echo "[branch-protection] done — verify in GitHub Settings → Rules"

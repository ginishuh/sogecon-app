#!/usr/bin/env bash
# Git 훅 스모크 테스트 — 실제 커밋 없이 규칙 로직 검증
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

pass() { echo "[test-githooks] OK: $*"; }
fail() { echo "[test-githooks] FAIL: $*" >&2; exit 1; }

# commitlog 패턴
pattern='^Log:[[:space:]]*[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2} \| [^|]+ \| [^|]+ \| [^|]+ \| .+'
bad_msg=$'feat(web): no log line\n'
if echo "$bad_msg" | grep -Eq "$pattern"; then
  fail "missing Log line should not match"
fi
pass "commitlog guard pattern rejects missing Log"

good_msg=$'feat(web): ok\n\nLog: 2026-07-11 15:00 | test | feat | summary | file.ts\n'
if ! echo "$good_msg" | grep -Eq "$pattern"; then
  fail "valid Log line should match"
fi
pass "commitlog guard pattern accepts valid Log"

# pre-commit docs-only
files=("docs/dev_log_260711.md" "README.md")
doc_only=true
for file in "${files[@]}"; do
  if [[ "$file" =~ ^docs/ ]] || [[ "$file" =~ \.(md|MD|txt|adoc|rst)$ ]] || [[ "$file" == README.md ]]; then
    continue
  fi
  doc_only=false
  break
done
[ "$doc_only" = true ] || fail "docs-only detection"
pass "pre-commit docs-only detection"

files=("apps/web/foo.ts")
doc_only=true
for file in "${files[@]}"; do
  if [[ "$file" =~ ^docs/ ]] || [[ "$file" =~ \.(md|MD|txt|adoc|rst)$ ]]; then
    continue
  fi
  doc_only=false
  break
done
[ "$doc_only" = false ] || fail "code change should not be docs-only"
pass "pre-commit detects code changes"

# pre-push upstream fallback branch exists
if grep -q 'git rev-parse --abbrev-ref --symbolic-full-name @{u}' .githooks/pre-push; then
  pass "pre-push upstream check present"
else
  fail "pre-push missing upstream check"
fi

echo "[test-githooks] all checks passed"

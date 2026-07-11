#!/usr/bin/env bash
# Git 훅 통합 테스트 — 임시 스테이징 후 실제 .githooks exit code 검증
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

HOOKS="$ROOT/.githooks"
FIXTURE_DIR="ops/ci/fixtures/hooks"
FIXTURE_PY="$FIXTURE_DIR/sample.py"
FIXTURE_WEB="__tests__/nonce.test.ts"
MSG_DIR=""

ensure_fixtures() {
  mkdir -p "$FIXTURE_DIR"
  cat >"$FIXTURE_PY" <<'PY'
# 훅 통합 테스트용 최소 Python 파일 (Ruff 통과)


def hook_fixture() -> str:
    return "ok"
PY
}

pass() { echo "[test-githooks] OK: $*"; }
fail() { echo "[test-githooks] FAIL: $*" >&2; exit 1; }
note() { echo "[test-githooks] NOTE: $*"; }

ms_now() { date +%s%3N; }

STASHED=0
STAGED_BACKUP=""

restore_git_state() {
  if [ -n "$STAGED_BACKUP" ]; then
    git reset HEAD -- . >/dev/null 2>&1 || true
    git checkout -- . >/dev/null 2>&1 || true
  fi
  if [ -n "$MSG_DIR" ] && [ -d "$MSG_DIR" ]; then
    rm -rf "$MSG_DIR"
  fi
  if [ "$STASHED" -eq 1 ]; then
    git stash pop -q >/dev/null 2>&1 || git stash drop -q >/dev/null 2>&1 || true
  fi
}

trap restore_git_state EXIT

prepare_repo() {
  if [ -n "$(git status --porcelain)" ]; then
    git stash push -u -m "test-githooks-autostash" -q
    STASHED=1
  fi
  STAGED_BACKUP=1
  MSG_DIR="$(mktemp -d)"
}

run_commit_msg() {
  local msg_file="$1"
  shift
  (cd "$ROOT" && "$HOOKS/commit-msg" "$msg_file" "$@")
}

run_pre_commit() {
  (cd "$ROOT" && "$HOOKS/pre-commit" "$@")
}

run_pre_push() {
  (cd "$ROOT" && "$HOOKS/pre-push" "$@")
}

expect_fail() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    fail "$label should fail"
  fi
  pass "$label fails as expected"
}

expect_ok() {
  local label="$1"
  shift
  if ! "$@" >/dev/null 2>&1; then
    fail "$label should pass"
  fi
  pass "$label passes"
}

prepare_repo
ensure_fixtures

# --- commit-msg: pnpm 누락 ---
msg_no_pnpm="$MSG_DIR/no-pnpm.txt"
echo "feat(api): subject" >"$msg_no_pnpm"
expect_fail "commit-msg without pnpm" \
  env PATH="/usr/bin:/bin" HOME="$HOME" run_commit_msg "$msg_no_pnpm"

# --- commit-msg: Log 줄 누락 (코드 스테이징) ---
printf '\n' >>"$FIXTURE_PY"
git add "$FIXTURE_PY"
if [ -z "$(git diff --cached --name-only -- "$FIXTURE_PY")" ]; then
  fail "fixture must be staged for commit-msg Log test"
fi
msg_no_log="$MSG_DIR/no-log.txt"
cat >"$msg_no_log" <<'EOF'
feat(api): subject without log
EOF
if command -v pnpm >/dev/null 2>&1 && [ -f "$ROOT/node_modules/.bin/commitlint" ]; then
  expect_fail "commit-msg missing Log line" run_commit_msg "$msg_no_log"
else
  note "skip commit-msg missing Log (pnpm/commitlint unavailable in runner)"
fi
git checkout -- "$FIXTURE_PY"
git reset HEAD -- "$FIXTURE_PY" >/dev/null

# --- commit-msg: 문서 전용은 Log 없이 통과 ---
git add docs/dev_log_TEMPLATE.md
msg_doc="$MSG_DIR/doc-only.txt"
cat >"$msg_doc" <<'EOF'
docs: template only
EOF
expect_ok "commit-msg doc-only without Log" run_commit_msg "$msg_doc"
git reset HEAD -- docs/dev_log_TEMPLATE.md >/dev/null

# --- pre-commit: python3 누락 ---
git add "$FIXTURE_PY"
expect_fail "pre-commit without python3" \
  env PATH="/usr/bin:/bin" HOME="$HOME" run_pre_commit
git reset HEAD -- "$FIXTURE_PY" >/dev/null

# --- pre-commit: ruff 누락 ---
git add "$FIXTURE_PY"
expect_fail "pre-commit without ruff" \
  env PATH="/usr/bin:/bin:$(dirname "$(command -v python3)")" HOME="$HOME" run_pre_commit
git reset HEAD -- "$FIXTURE_PY" >/dev/null

# --- pre-commit: pnpm 누락 (web 스테이징) ---
git add "apps/web/$FIXTURE_WEB"
expect_fail "pre-commit without pnpm (web staged)" \
  env PATH="/usr/bin:/bin:$(dirname "$(command -v python3)")" HOME="$HOME" run_pre_commit
git reset HEAD -- "apps/web/$FIXTURE_WEB" >/dev/null

# --- pre-commit: 문서 전용 빠른 통과 + 시간 측정 ---
git add docs/dev_log_TEMPLATE.md
t0="$(ms_now)"
expect_ok "pre-commit docs-only" run_pre_commit
t1="$(ms_now)"
note "timing pre-commit docs-only: $((t1 - t0))ms (goal ≤15s)"

git reset HEAD -- docs/dev_log_TEMPLATE.md >/dev/null

# --- pre-commit: 공백 경로 ---
SPACE_DIR="ops/ci/fixtures/hooks/space dir"
SPACE_FILE="$SPACE_DIR/sample space.py"
mkdir -p "$SPACE_DIR"
printf '%s\n' 'def spaced() -> str:' '    return "ok"' >"$SPACE_FILE"
git add "$SPACE_FILE"
t0="$(ms_now)"
if [ -x "$ROOT/.venv/bin/ruff" ] && command -v pnpm >/dev/null 2>&1; then
  expect_ok "pre-commit staged path with spaces" run_pre_commit
  t1="$(ms_now)"
  note "timing pre-commit python+spaces path: $((t1 - t0))ms"
else
  note "skip spaced-path pre-commit full run (venv ruff or pnpm missing)"
fi
git reset HEAD -- "$SPACE_FILE" >/dev/null
rm -rf "$SPACE_DIR"

# --- pre-push: upstream 없음 + 문서만 히스토리 → 통과 (orphan worktree) ---
orphan_branch="hook-orphan-$$"
wt="$(mktemp -d)"
if git worktree add -b "$orphan_branch" "$wt" --orphan >/dev/null 2>&1; then
  (
    cd "$wt"
    git config user.email "ci-hook-test@example.com"
    git config user.name "CI Hook Test"
    git config core.hooksPath .githooks
    mkdir -p docs
    cp "$ROOT/docs/dev_log_TEMPLATE.md" docs/dev_log_260711.md
    git add docs/dev_log_260711.md
    git commit -m "$(cat <<'EOF'
docs(docs): orphan worktree for hook test

Log: 2026-07-11 15:30 | test | docs | orphan hook fixture | docs/dev_log_260711.md
EOF
)" -q
    expect_ok "pre-push without upstream (docs-only history)" "$HOOKS/pre-push"
  )
  git worktree remove --force "$wt" >/dev/null 2>&1 || rm -rf "$wt"
  git branch -D "$orphan_branch" >/dev/null 2>&1 || true
else
  note "skip pre-push orphan worktree test (worktree add failed)"
fi

# --- pre-push: 비문서 변경인데 dev_log 없으면 실패 (orphan worktree) ---
code_branch="hook-code-$$"
code_wt="$(mktemp -d)"
if git worktree add -b "$code_branch" "$code_wt" --orphan >/dev/null 2>&1; then
  (
    cd "$code_wt"
    git config user.email "ci-hook-test@example.com"
    git config user.name "CI Hook Test"
    git config core.hooksPath .githooks
    mkdir -p ops/ci/fixtures/hooks
    cp "$ROOT/ops/ci/fixtures/hooks/sample.py" ops/ci/fixtures/hooks/sample.py
    printf '\n' >>ops/ci/fixtures/hooks/sample.py
    git add ops/ci/fixtures/hooks/sample.py
    git commit -m "$(cat <<'EOF'
feat(api): code only without dev log file

Log: 2026-07-11 15:31 | test | feat | hook negative case | ops/ci/fixtures/hooks/sample.py
EOF
)" -q
    if "$HOOKS/pre-push" >/dev/null 2>&1; then
      echo "[test-githooks] FAIL: pre-push without dev_log for code change should fail" >&2
      exit 1
    fi
    echo "[test-githooks] OK: pre-push without dev_log for code change fails as expected"
  )
  git worktree remove --force "$code_wt" >/dev/null 2>&1 || rm -rf "$code_wt"
  git branch -D "$code_branch" >/dev/null 2>&1 || true
else
  note "skip pre-push dev_log negative test (worktree add failed)"
fi

echo "[test-githooks] all integration checks passed"

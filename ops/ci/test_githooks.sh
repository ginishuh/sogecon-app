#!/usr/bin/env bash
# Git 훅 통합 테스트 — 실제 .githooks/* 실행 후 exit code 검증
# 주의: env PATH=... <shell함수> 형태는 127(명령 미발견) false positive를 만든다.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

HOOKS="$ROOT/.githooks"
BASH_BIN="$(command -v bash)"
FIXTURE_DIR="ops/ci/fixtures/hooks"
FIXTURE_PY="$FIXTURE_DIR/sample.py"
FIXTURE_WEB="apps/web/__tests__/nonce.test.ts"
MSG_DIR=""
EMPTY_BIN=""
HIDDEN_RUFF=""
WORKTREES=()
WORKTREE_BRANCHES=()

pass() { echo "[test-githooks] OK: $*"; }
fail() { echo "[test-githooks] FAIL: $*" >&2; exit 1; }
note() { echo "[test-githooks] NOTE: $*"; }

ms_now() { date +%s%3N; }

STASHED=0
STAGED_BACKUP=""

restore_hidden_ruff() {
  if [ -n "$HIDDEN_RUFF" ] && [ -e "$HIDDEN_RUFF" ]; then
    mv "$HIDDEN_RUFF" "$ROOT/.venv/bin/ruff"
    HIDDEN_RUFF=""
  fi
}

cleanup_worktrees() {
  local wt branch
  for wt in "${WORKTREES[@]+"${WORKTREES[@]}"}"; do
    git -C "$ROOT" worktree remove --force "$wt" >/dev/null 2>&1 || rm -rf "$wt"
  done
  for branch in "${WORKTREE_BRANCHES[@]+"${WORKTREE_BRANCHES[@]}"}"; do
    git -C "$ROOT" branch -D "$branch" >/dev/null 2>&1 || true
  done
  WORKTREES=()
  WORKTREE_BRANCHES=()
}

restore_git_state() {
  restore_hidden_ruff
  cleanup_worktrees
  if [ -n "$STAGED_BACKUP" ]; then
    git reset HEAD -- . >/dev/null 2>&1 || true
    git checkout -- . >/dev/null 2>&1 || true
    # 테스트용 미추적 fixture 정리
    rm -rf "$FIXTURE_DIR/space dir" \
      "$FIXTURE_DIR/sample_renamed.py" \
      "$FIXTURE_DIR/_delete_me.py" \
      "$ROOT/docs/_hook_test_doc.md" 2>/dev/null || true
  fi
  if [ -n "$MSG_DIR" ] && [ -d "$MSG_DIR" ]; then
    rm -rf "$MSG_DIR"
  fi
  if [ -n "$EMPTY_BIN" ] && [ -d "$EMPTY_BIN" ]; then
    rm -rf "$EMPTY_BIN"
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
  EMPTY_BIN="$(mktemp -d)"
  # python3만 제거하고 git은 유지 (git 미발견 시 staged 조회 실패→빈 목록→exit 0 false positive)
  ln -sf "$(command -v git)" "$EMPTY_BIN/git"
}

# 기대 실패: 127(명령 미발견)은 통과로 인정하지 않음. 훅([hooks])이 실제 실행된 non-zero만 OK.
expect_fail() {
  local label="$1"
  shift
  local out ec
  set +e
  out="$("$@" 2>&1)"
  ec=$?
  set -e
  if [ "$ec" -eq 0 ]; then
    fail "$label should fail (got exit 0). output: $out"
  fi
  if [ "$ec" -eq 127 ]; then
    fail "$label got exit 127 (command not found) — hook did not run. output: $out"
  fi
  if ! printf '%s\n' "$out" | grep -q '\[hooks\]'; then
    fail "$label failed without [hooks] marker (ec=$ec). output: $out"
  fi
  pass "$label fails as expected (ec=$ec)"
}

expect_ok() {
  local label="$1"
  shift
  local out ec
  set +e
  out="$("$@" 2>&1)"
  ec=$?
  set -e
  if [ "$ec" -ne 0 ]; then
    fail "$label should pass (ec=$ec). output: $out"
  fi
  pass "$label passes"
}

assert_staged_names() {
  local label="$1"
  shift
  local staged
  staged="$(git diff --cached --name-only -- "$@")"
  if [ -z "$staged" ]; then
    fail "$label: expected staged paths, got empty cached diff ($*)"
  fi
}

# tracked/untracked 모두 실제 내용 변경 후 stage (변경 없는 git add 금지)
stage_modify() {
  local file="$1"
  local marker="${2:-hook-test-$$}"
  mkdir -p "$(dirname "$file")"
  if [ -f "$file" ]; then
    printf '\n# %s\n' "$marker" >>"$file"
  else
    printf '# %s\n' "$marker" >"$file"
  fi
  git add -- "$file"
  assert_staged_names "stage_modify $file" "$file"
}

stage_write_py() {
  local file="$1"
  mkdir -p "$(dirname "$file")"
  cat >"$file" <<'PY'
# 훅 통합 테스트용 최소 Python 파일 (Ruff 통과)


def hook_fixture() -> str:
    return "ok"
PY
  # tracked와 동일 내용이면 diff가 비므로 마커를 추가한다.
  if git cat-file -e "HEAD:$file" 2>/dev/null; then
    if git diff --quiet -- "$file" 2>/dev/null; then
      printf '\n# hook-test-mark-%s\n' "$$" >>"$file"
    fi
  fi
  git add -- "$file"
  assert_staged_names "stage_write_py $file" "$file"
}

hide_venv_ruff() {
  if [ -x "$ROOT/.venv/bin/ruff" ]; then
    HIDDEN_RUFF="$ROOT/.venv/bin/.ruff.hidden_by_test_$$"
    mv "$ROOT/.venv/bin/ruff" "$HIDDEN_RUFF"
  fi
}

add_orphan_worktree() {
  local branch="$1"
  local wt="$2"
  if ! git worktree add -b "$branch" "$wt" --orphan >/dev/null 2>&1; then
    fail "git worktree add --orphan failed for $branch at $wt"
  fi
  WORKTREES+=("$wt")
  WORKTREE_BRANCHES+=("$branch")
  (
    cd "$wt"
    git config user.email "ci-hook-test@example.com"
    git config user.name "CI Hook Test"
    git config core.hooksPath .githooks
  )
}

require_pnpm_commitlint() {
  if ! command -v pnpm >/dev/null 2>&1; then
    fail "pnpm required for hook integration tests (CI repo-guards installs it)"
  fi
  if [ ! -f "$ROOT/node_modules/.bin/commitlint" ]; then
    fail "@commitlint/cli required — run: pnpm install"
  fi
}

require_ruff() {
  if [ -x "$ROOT/.venv/bin/ruff" ] || [ -n "$HIDDEN_RUFF" ]; then
    return
  fi
  if command -v ruff >/dev/null 2>&1; then
    return
  fi
  fail "ruff required for spaced/rename pre-commit tests — run: make venv && make api-install (or pip install ruff)"
}

prepare_repo
require_pnpm_commitlint

# --- commit-msg: pnpm 누락 (제한 PATH로 훅 직접 실행) ---
msg_no_pnpm="$MSG_DIR/no-pnpm.txt"
echo "feat(api): subject" >"$msg_no_pnpm"
expect_fail "commit-msg without pnpm" \
  env PATH="/usr/bin:/bin" HOME="$HOME" "$BASH_BIN" "$HOOKS/commit-msg" "$msg_no_pnpm"

# --- commit-msg: Log 줄 누락 (코드 실제 수정 후 스테이징) ---
stage_write_py "$FIXTURE_PY"
msg_no_log="$MSG_DIR/no-log.txt"
cat >"$msg_no_log" <<'EOF'
feat(api): subject without log
EOF
expect_fail "commit-msg missing Log line" \
  env PATH="$PATH" HOME="$HOME" "$BASH_BIN" "$HOOKS/commit-msg" "$msg_no_log"
git checkout -- "$FIXTURE_PY" 2>/dev/null || true
git reset HEAD -- "$FIXTURE_PY" >/dev/null

# --- commit-msg: 문서 전용은 Log 없이 통과 (문서 실제 수정) ---
stage_modify "docs/_hook_test_doc.md" "doc-only-$$"
msg_doc="$MSG_DIR/doc-only.txt"
cat >"$msg_doc" <<'EOF'
docs: template only
EOF
expect_ok "commit-msg doc-only without Log" \
  env PATH="$PATH" HOME="$HOME" "$BASH_BIN" "$HOOKS/commit-msg" "$msg_doc"
git reset HEAD -- "docs/_hook_test_doc.md" >/dev/null
rm -f "docs/_hook_test_doc.md"

# --- pre-commit: python3 누락 (빈 PATH — /usr/bin/python3 회피) ---
stage_write_py "$FIXTURE_PY"
expect_fail "pre-commit without python3" \
  env -u VIRTUAL_ENV PATH="$EMPTY_BIN" HOME="$HOME" "$BASH_BIN" "$HOOKS/pre-commit"
git checkout -- "$FIXTURE_PY" 2>/dev/null || true
git reset HEAD -- "$FIXTURE_PY" >/dev/null

# --- pre-commit: ruff 누락 (python3는 유지, .venv ruff 숨김) ---
stage_write_py "$FIXTURE_PY"
hide_venv_ruff
expect_fail "pre-commit without ruff" \
  env -u VIRTUAL_ENV PATH="/usr/bin:/bin" HOME="$HOME" "$BASH_BIN" "$HOOKS/pre-commit"
restore_hidden_ruff
git checkout -- "$FIXTURE_PY" 2>/dev/null || true
git reset HEAD -- "$FIXTURE_PY" >/dev/null

# --- pre-commit: pnpm 누락 (web 파일 실제 수정) ---
stage_modify "$FIXTURE_WEB" "web-hook-test-$$"
expect_fail "pre-commit without pnpm (web staged)" \
  env -u VIRTUAL_ENV PATH="/usr/bin:/bin" HOME="$HOME" "$BASH_BIN" "$HOOKS/pre-commit"
git checkout -- "$FIXTURE_WEB" 2>/dev/null || true
git reset HEAD -- "$FIXTURE_WEB" >/dev/null

# --- pre-commit: 문서 전용 빠른 통과 + 시간 측정 ---
stage_modify "docs/_hook_test_doc.md" "docs-precommit-$$"
t0="$(ms_now)"
expect_ok "pre-commit docs-only" \
  env PATH="$PATH" HOME="$HOME" "$BASH_BIN" "$HOOKS/pre-commit"
t1="$(ms_now)"
DOC_ONLY_MS=$((t1 - t0))
note "timing pre-commit docs-only: ${DOC_ONLY_MS}ms (goal ≤15s)"
git reset HEAD -- "docs/_hook_test_doc.md" >/dev/null
rm -f "docs/_hook_test_doc.md"

# --- pre-commit: 공백 포함 경로 ---
require_ruff
SPACE_DIR="$FIXTURE_DIR/space dir"
SPACE_FILE="$SPACE_DIR/sample space.py"
mkdir -p "$SPACE_DIR"
cat >"$SPACE_FILE" <<'PY'
def spaced() -> str:
    return "ok"
PY
git add -- "$SPACE_FILE"
assert_staged_names "spaced path" "$SPACE_FILE"
t0="$(ms_now)"
expect_ok "pre-commit staged path with spaces" \
  env -u VIRTUAL_ENV PATH="$PATH" HOME="$HOME" "$BASH_BIN" "$HOOKS/pre-commit"
t1="$(ms_now)"
SPACE_MS=$((t1 - t0))
note "timing pre-commit python+spaces path: ${SPACE_MS}ms"
git reset HEAD -- "$SPACE_FILE" >/dev/null
rm -rf "$SPACE_DIR"

# --- pre-commit: rename (실제 git mv + staged diff) ---
stage_write_py "$FIXTURE_PY"
RENAMED="$FIXTURE_DIR/sample_renamed.py"
git mv -- "$FIXTURE_PY" "$RENAMED"
assert_staged_names "rename" "$RENAMED"
expect_ok "pre-commit staged rename" \
  env -u VIRTUAL_ENV PATH="$PATH" HOME="$HOME" "$BASH_BIN" "$HOOKS/pre-commit"
git mv -- "$RENAMED" "$FIXTURE_PY"
git checkout -- "$FIXTURE_PY" 2>/dev/null || true
git reset HEAD -- "$FIXTURE_PY" >/dev/null

# --- pre-commit: 삭제 (staged D 보장; 훅 diff-filter는 D 제외 → 정상 통과) ---
stage_write_py "$FIXTURE_PY"
# 커밋된 tracked 삭제를 위해 동일 경로를 HEAD 기준으로 되돌린 뒤 rm
git checkout HEAD -- "$FIXTURE_PY"
git rm -f -- "$FIXTURE_PY" >/dev/null
if [ -z "$(git diff --cached --name-only --diff-filter=D -- "$FIXTURE_PY")" ]; then
  fail "delete fixture must appear as staged deletion"
fi
expect_ok "pre-commit staged delete" \
  env -u VIRTUAL_ENV PATH="$PATH" HOME="$HOME" "$BASH_BIN" "$HOOKS/pre-commit"
git checkout HEAD -- "$FIXTURE_PY"
git reset HEAD -- "$FIXTURE_PY" >/dev/null 2>&1 || true

# --- pre-push: upstream 없음 + 문서만 → 통과 ---
orphan_branch="hook-orphan-$$"
wt="$(mktemp -d)"
add_orphan_worktree "$orphan_branch" "$wt"
(
  cd "$wt"
  mkdir -p docs
  cp "$ROOT/docs/dev_log_TEMPLATE.md" docs/dev_log_260711.md
  printf '\n- Notes: orphan hook fixture %s\n' "$$" >>docs/dev_log_260711.md
  git add docs/dev_log_260711.md
  git commit -m "$(cat <<'EOF'
docs(docs): orphan worktree for hook test

Log: 2026-07-11 17:55 | test | docs | orphan hook fixture | docs/dev_log_260711.md
EOF
)" -q
  # upstream 없는 초기 히스토리에서 훅 직접 실행
  expect_ok "pre-push without upstream (docs-only history)" \
    env PATH="$PATH" HOME="$HOME" "$BASH_BIN" "$HOOKS/pre-push"
)

# --- pre-push: 코드 변경 + dev_log 없음 → 실패 ---
code_branch="hook-code-$$"
code_wt="$(mktemp -d)"
add_orphan_worktree "$code_branch" "$code_wt"
(
  cd "$code_wt"
  mkdir -p ops/ci/fixtures/hooks
  cat >ops/ci/fixtures/hooks/sample.py <<'PY'
def hook_fixture() -> str:
    return "ok"
PY
  git add ops/ci/fixtures/hooks/sample.py
  git commit -m "$(cat <<'EOF'
feat(api): code only without dev log file

Log: 2026-07-11 17:55 | test | feat | hook negative case | ops/ci/fixtures/hooks/sample.py
EOF
)" -q
  expect_fail "pre-push without dev_log for code change" \
    env PATH="$PATH" HOME="$HOME" "$BASH_BIN" "$HOOKS/pre-push"
)

# --- pre-push: pyright 누락 (orphan worktree, 시스템 python만) ---
py_branch="hook-pyright-$$"
py_wt="$(mktemp -d)"
add_orphan_worktree "$py_branch" "$py_wt"
(
  cd "$py_wt"
  mkdir -p ops/ci/fixtures/hooks docs
  cat >ops/ci/fixtures/hooks/sample.py <<'PY'
def hook_fixture() -> str:
    return "ok"
PY
  cp "$ROOT/docs/dev_log_TEMPLATE.md" docs/dev_log_260711.md
  printf '\n- Notes: pyright-missing fixture\n' >>docs/dev_log_260711.md
  git add ops/ci/fixtures/hooks/sample.py docs/dev_log_260711.md
  git commit -m "$(cat <<'EOF'
feat(api): pyright missing negative case

Log: 2026-07-11 17:55 | test | feat | pyright missing | ops/ci/fixtures/hooks/sample.py,docs/dev_log_260711.md
EOF
)" -q
  # worktree에 .venv 없음 + PATH를 시스템만 → resolve_python_bin은 /usr/bin/python3, pyright 모듈 없음
  expect_fail "pre-push without pyright" \
    env -u VIRTUAL_ENV PATH="/usr/bin:/bin" HOME="$HOME" "$BASH_BIN" "$HOOKS/pre-push"
)

cleanup_worktrees

echo "[test-githooks] timing summary: docs-only=${DOC_ONLY_MS}ms spaces=${SPACE_MS}ms"
echo "[test-githooks] all integration checks passed"

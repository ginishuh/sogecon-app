#!/usr/bin/env bash
set -euo pipefail

# Sogecon Web — Next.js standalone 배포 스크립트
# - 릴리스 디렉터리 구조: /opt/sogecon/web/releases/<ts>
# - 심볼릭 링크: /opt/sogecon/web/current → 최신 릴리스
# - 기본 RELEASE_BASE 는 /opt/sogecon/web 입니다. 레포 내부로 두려면
#   RELEASE_BASE=/srv/sogecon-app/.releases/web 와 같이 지정하고 systemd 유닛도 동일 경로로 변경하세요.
# - 전개 대상: .next/standalone/*, .next/static, public

RELEASE_BASE=${RELEASE_BASE:-/opt/sogecon/web}
SERVICE_NAME=${SERVICE_NAME:-sogecon-web}
# CI 환경에서는 전개 원본(staging) 경로를 반드시 명시적으로 전달해야 합니다.
if [ -n "${CI:-}" ]; then
  : "${REPO_ROOT:?REPO_ROOT must be set in CI (standalone staging root)}"
else
  REPO_ROOT=${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}
fi

WEB_DIR="$REPO_ROOT/apps/web"
STANDALONE_DIR="$WEB_DIR/.next/standalone"
STATIC_DIR="$WEB_DIR/.next/static"
PUBLIC_DIR="$WEB_DIR/public"

timestamp() { date +%Y%m%d%H%M%S; }

info() { echo "[info] $*"; }
warn() { echo "[warn] $*" >&2; }
die() { echo "[error] $*" >&2; exit 1; }

if [ ! -f "$STANDALONE_DIR/apps/web/server.js" ]; then
  die "standalone 산출물이 없습니다. 먼저 'pnpm -C apps/web build'로 빌드를 생성하세요."
fi

if [ ! -d "$STATIC_DIR" ]; then
  die "정적 자원(.next/static)이 없습니다. Next 빌드가 올바르게 생성되었는지 확인하세요."
fi

if [ ! -d "$PUBLIC_DIR" ]; then
  die "public 디렉터리를 찾을 수 없습니다: $PUBLIC_DIR"
fi

REL_DIR="$RELEASE_BASE/releases/$(timestamp)"
info "릴리스 디렉터리 생성: $REL_DIR"
mkdir -p "$REL_DIR"

# 1) standalone 트리 복사 (node_modules 번들 포함)
info "standalone → $REL_DIR 복사"
rsync -a --delete "$STANDALONE_DIR/" "$REL_DIR/"

# 2) .next/static 을 앱 경로 하위에 복사(경로 일치 필요)
info ".next/static → $REL_DIR/apps/web/.next/static 복사"
mkdir -p "$REL_DIR/apps/web/.next"
rsync -a --delete "$STATIC_DIR/" "$REL_DIR/apps/web/.next/static/"

# 3) public 복사
info "public → $REL_DIR/apps/web/public 복사"
rsync -a --delete "$PUBLIC_DIR/" "$REL_DIR/apps/web/public/"

# 4) 심볼릭 링크 전환 (원자적)
ln -sfn "$REL_DIR" "$RELEASE_BASE/current"
info "심볼릭 링크 업데이트: $RELEASE_BASE/current → $REL_DIR"

# 5) systemd 재시작
if command -v systemctl >/dev/null 2>&1; then
  info "systemd 데몬 리로드 및 서비스 재시작: $SERVICE_NAME"
  # NOPASSWD sudoers 필요. 문서: docs/agent_runbook_vps.md 참조.
  if sudo -n true 2>/dev/null; then
    sudo systemctl daemon-reload || true
    sudo systemctl restart "$SERVICE_NAME"
    sleep 1
    sudo systemctl --no-pager --full status "$SERVICE_NAME" | sed -n '1,20p' || true
  else
    warn "sudo 비밀번호가 필요합니다. sudoers NOPASSWD를 구성하거나 수동으로 재시작하세요."
    systemctl --no-pager --full status "$SERVICE_NAME" 2>/dev/null || true
  fi
else
  warn "systemctl을 찾지 못했습니다. 서비스는 수동으로 재시작하세요: $SERVICE_NAME"
fi

# 6) 헬스 체크(선택)
if command -v curl >/dev/null 2>&1; then
  info "헬스 체크 http://127.0.0.1:3000/ (최대 30s)"
  for i in $(seq 1 30); do
    code=$(curl -sf -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ || true)
    if [ "$code" = "200" ]; then
      info "OK (200)"
      exit 0
    fi
    sleep 1
  done
  warn "헬스 체크 실패(30초). Nginx/서비스 로그를 확인하세요."
fi

exit 0

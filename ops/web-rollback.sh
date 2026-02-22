#!/usr/bin/env bash
set -euo pipefail

# Sogecon Web — 롤백 스크립트
# 최신 이전 릴리스로 symlink(current)를 전환하고 서비스를 재시작합니다.

RELEASE_BASE=${RELEASE_BASE:-/srv/www/sogecon}
SERVICE_NAME=${SERVICE_NAME:-sogecon-web}

info() { echo "[info] $*"; }
warn() { echo "[warn] $*" >&2; }
die() { echo "[error] $*" >&2; exit 1; }

rel_dir="$RELEASE_BASE/releases"
[ -d "$rel_dir" ] || die "릴리스 디렉터리가 없습니다: $rel_dir"

mapfile -t rels < <(ls -1 "$rel_dir" | sort -r)
if [ ${#rels[@]} -lt 2 ]; then
  die "롤백할 이전 릴리스가 없습니다. (현재 릴리스만 존재)"
fi

current_target=$(readlink -f "$RELEASE_BASE/current" 2>/dev/null | sed 's:/*$::' || true)
prev=""
for r in "${rels[@]}"; do
  path="$rel_dir/$r"
  [ "$path" = "$current_target" ] && continue
  prev="$path"
  break
done

[ -n "$prev" ] || die "이전 릴리스를 찾지 못했습니다."

ln -sfn "$prev" "$RELEASE_BASE/current"
info "current → $prev 로 전환 완료"

if command -v systemctl >/dev/null 2>&1; then
  if sudo -n true 2>/dev/null; then
    sudo systemctl restart "$SERVICE_NAME"
    sleep 1
    sudo systemctl --no-pager --full status "$SERVICE_NAME" | sed -n '1,20p' || true
  else
    warn "sudo 비밀번호가 필요합니다. sudoers NOPASSWD를 구성하거나 수동으로 재시작하세요."
    info "롤백 완료. 서비스 재시작: sudo systemctl restart $SERVICE_NAME"
  fi
else
  info "systemctl이 없어 서비스 재시작을 건너뜁니다. 수동으로 재시작하세요: $SERVICE_NAME"
fi

exit 0

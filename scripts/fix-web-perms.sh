#!/usr/bin/env bash
set -euo pipefail
# Fix ownership of bind-mounted build artifacts without sudo, using a throwaway container

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

TARGETS=(
  node_modules
  .pnpm-store
  apps/web/.next
  apps/web/node_modules
  packages/schemas/node_modules
  # 업로드 볼륨(컨테이너에서 작성된 파일 소유권 복구)
  uploads
)

UID_NUM=${UID:-$(id -u)}
GID_NUM=${GID:-$(id -g)}

for T in "${TARGETS[@]}"; do
  if [ -e "$T" ]; then
    echo "[fix-perms] chown -R $UID_NUM:$GID_NUM $T"
    docker run --rm -v "$PWD/$T:/d" alpine:3.20 sh -lc "chown -R $UID_NUM:$GID_NUM /d || true" >/dev/null
  fi
done

echo "[fix-perms] done"

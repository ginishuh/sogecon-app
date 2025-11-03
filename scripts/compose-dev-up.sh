#!/usr/bin/env bash
set -euo pipefail

# Dev-only convenience launcher for local compose. Includes a prod guard.
# Usage: ./scripts/compose-dev-up.sh [extra compose args]

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

is_server_prod() {
  # Heuristics to detect a production-like server
  # 1) .env.api exists AND APP_ENV=prod
  if [[ -f .env.api ]] && grep -Eq '^\s*APP_ENV\s*=\s*prod\s*$' .env.api; then
    return 0
  fi
  # 2) Running containers with prod names
  if docker ps --format '{{.Names}}' | grep -Eq '^(alumni-api|alumni-web)$'; then
    return 0
  fi
  # 3) Dedicated network used in prod
if docker network ls --format '{{.Name}}' | grep -Eq '^sogecon_net$'; then
  return 0
fi
  return 1
}

if is_server_prod; then
  echo "[guard] Detected production-like environment. Refusing to run compose dev." >&2
  echo "        Use ops/cloud-start.sh for prod, or run this only on local machines." >&2
  echo "        If this is a false positive, remove .env.api(APP_ENV=prod) and stop prod containers." >&2
  exit 1
fi

echo "[dev] Starting local dev containers (profile=dev)"
# Host UID/GID propagation so bind-mounted files are not owned by root
export UID=${UID:-$(id -u)}
export GID=${GID:-$(id -g)}
echo "[dev] Using UID:GID=${UID}:${GID}"
exec docker compose --profile dev up -d "$@"

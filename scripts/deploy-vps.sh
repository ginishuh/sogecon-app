#!/usr/bin/env bash
set -euo pipefail

# Deploy alumni api/web containers on a VPS.
# - Prereqs: docker, images in a registry (e.g., GHCR), valid docker login
# - Defaults assume repo cloned under /srv/segecon and images under ghcr.io/ginishuh/sogecon-app
#
# Usage:
#   bash scripts/deploy-vps.sh -t <tag> [--prefix ghcr.io/org/repo] [--env .env.api] [--web-env .env.web] \
#       [--skip-migrate] [--uploads /var/lib/segecon/uploads] [--api-health URL] [--web-health URL]

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

IMAGE_PREFIX_DEFAULT="ghcr.io/ginishuh/sogecon-app"
TAG=""
IMAGE_PREFIX="${IMAGE_PREFIX_DEFAULT}"
ENV_FILE=".env.api"
WEB_ENV_FILE=".env.web"
UPLOADS_DIR="/var/lib/segecon/uploads"
DO_MIGRATE=1
API_HEALTH=""
WEB_HEALTH=""
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-60}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--tag)
      TAG="$2"; shift 2;;
    -p|--prefix)
      IMAGE_PREFIX="$2"; shift 2;;
    -e|--env)
      ENV_FILE="$2"; shift 2;;
    -w|--web-env)
      WEB_ENV_FILE="$2"; shift 2;;
    --uploads)
      UPLOADS_DIR="$2"; shift 2;;
    --skip-migrate)
      DO_MIGRATE=0; shift 1;;
    --api-health)
      API_HEALTH="$2"; shift 2;;
    --web-health)
      WEB_HEALTH="$2"; shift 2;;
    -h|--help)
      sed -n '1,40p' "$0"; exit 0;;
    *)
      echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

if [[ -z "$TAG" ]]; then
  echo "-t|--tag <tag> is required (e.g., a commit SHA)" >&2
  exit 1
fi

API_IMAGE="${IMAGE_PREFIX}/alumni-api:${TAG}"
WEB_IMAGE="${IMAGE_PREFIX}/alumni-web:${TAG}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required on the VPS" >&2
  exit 1
fi

echo "[deploy] Using images:" "$API_IMAGE" "|" "$WEB_IMAGE"

echo "[deploy] Pull images"
docker pull "$API_IMAGE"
docker pull "$WEB_IMAGE"

if [[ "$DO_MIGRATE" -eq 1 ]]; then
  echo "[deploy] Run DB migration"
  ENV_FILE="$ENV_FILE" API_IMAGE="$API_IMAGE" bash "$ROOT_DIR/ops/cloud-migrate.sh"
fi

echo "[deploy] Restart containers"
API_IMAGE="$API_IMAGE" WEB_IMAGE="$WEB_IMAGE" \
  API_ENV_FILE="$ENV_FILE" WEB_ENV_FILE="$WEB_ENV_FILE" \
  UPLOADS_DIR="$UPLOADS_DIR" \
  bash "$ROOT_DIR/ops/cloud-start.sh"

health() {
  local url="$1"; local name="$2"
  if [[ -z "$url" ]]; then return 0; fi
  echo "[health] $name → $url"
  for i in $(seq 1 "$HEALTH_TIMEOUT"); do
    code=$(curl -fsS -o /dev/null -w "%{http_code}" "$url" || true)
    if [[ "$code" == "200" ]]; then
      echo "[health] $name OK(200)"; return 0
    fi
    sleep 1
  done
  echo "[health] $name failed; last code=$code" >&2
  return 1
}

set +e
RC=0
health "$API_HEALTH" "api" || RC=1
health "$WEB_HEALTH" "web" || RC=1
set -e

if [[ $RC -ne 0 ]]; then
  echo "[deploy] One or more health checks failed. Consider rolling back to a previous tag." >&2
  exit 1
fi

echo "[deploy] Done"

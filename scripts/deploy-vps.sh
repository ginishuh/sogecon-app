#!/usr/bin/env bash
set -euo pipefail

# Deploy alumni api/web containers on a VPS.
# - 기본 모드: VPS에서 로컬 이미지를 빌드한 뒤 배포
# - 선택 모드: --pull-images 지정 시 외부 레지스트리 이미지를 pull하여 배포
#
# Usage:
#   bash scripts/deploy-vps.sh -t <tag> [--prefix local/sogecon] [--local-build|--pull-images] \
#       [--env .env.api] [--web-env .env.web] \
#       [--web-api-base https://api.example.com] \
#       [--skip-migrate] [--seed-admin] [--uploads /var/lib/sogecon/uploads] \
#       [--network sogecon_net] [--api-health URL] [--web-health URL]

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

IMAGE_PREFIX_DEFAULT="local/sogecon"
TAG=""
IMAGE_PREFIX="${IMAGE_PREFIX_DEFAULT}"
ENV_FILE=".env.api"
WEB_ENV_FILE=".env.web"
UPLOADS_DIR="/var/lib/sogecon/uploads"
NET_NAME="sogecon_net"
DO_MIGRATE=1
DO_SEED_ADMIN=0
API_HEALTH=""
WEB_HEALTH=""
WEB_API_BASE=""
WEB_API_BASE_OVERRIDE=0
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-60}
PULL_IMAGES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--tag)
      TAG="$2"; shift 2;;
    -p|--prefix)
      IMAGE_PREFIX="$2"; shift 2;;
    --pull-images)
      PULL_IMAGES=1; shift 1;;
    --local-build)
      PULL_IMAGES=0; shift 1;;
    -e|--env)
      ENV_FILE="$2"; shift 2;;
    -w|--web-env)
      WEB_ENV_FILE="$2"; shift 2;;
    --web-api-base)
      WEB_API_BASE="$2"; WEB_API_BASE_OVERRIDE=1; shift 2;;
    --uploads)
      UPLOADS_DIR="$2"; shift 2;;
    --network)
      NET_NAME="$2"; shift 2;;
    --skip-migrate)
      DO_MIGRATE=0; shift 1;;
    --seed-admin)
      DO_SEED_ADMIN=1; shift 1;;
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

if [[ ! "${HEALTH_TIMEOUT}" =~ ^[0-9]+$ || "${HEALTH_TIMEOUT}" =~ ^0+$ ]]; then
  echo "HEALTH_TIMEOUT must be a positive integer number of seconds." >&2
  exit 1
fi

extract_web_api_base() {
  local line key value
  [[ -f "$WEB_ENV_FILE" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    line=${line%$'\r'}
    if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]]; then
      key=${BASH_REMATCH[2]}
      [[ "$key" == NEXT_PUBLIC_WEB_API_BASE ]] || continue
      value=${BASH_REMATCH[3]}
      value="${value#"${value%%[![:space:]]*}"}"
      value="${value%"${value##*[![:space:]]}"}"
      case "${value}" in
        \"*\") value=${value:1:${#value}-2} ;;
        \'*\') value=${value:1:${#value}-2} ;;
      esac
      WEB_API_BASE="$value"
    fi
  done <"$WEB_ENV_FILE"
}

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

if [[ "$PULL_IMAGES" -eq 1 ]]; then
  echo "[deploy] Pull images from registry"
  docker pull "$API_IMAGE"
  docker pull "$WEB_IMAGE"
else
  echo "[deploy] Build images on VPS (no registry)"
  if [[ "$WEB_API_BASE_OVERRIDE" -eq 0 ]]; then
    extract_web_api_base
  fi
  if [[ -z "$WEB_API_BASE" ]]; then
    echo "NEXT_PUBLIC_WEB_API_BASE is required for local Web image build; set it in ${WEB_ENV_FILE} or pass --web-api-base <https-url>." >&2
    exit 1
  fi
  IMAGE_TAG="$TAG" IMAGE_PREFIX="$IMAGE_PREFIX" \
    NEXT_PUBLIC_WEB_API_BASE="$WEB_API_BASE" PUSH_IMAGES=0 \
    bash "$ROOT_DIR/ops/cloud-build.sh"
fi

if [[ -n "$NET_NAME" ]]; then
  echo "[deploy] Ensure network: $NET_NAME"
  docker network inspect "$NET_NAME" >/dev/null 2>&1 || docker network create "$NET_NAME"
fi

if [[ "$DO_MIGRATE" -eq 1 ]]; then
  echo "[deploy] Run DB migration"
  ENV_FILE="$ENV_FILE" API_IMAGE="$API_IMAGE" DOCKER_NETWORK="$NET_NAME" bash "$ROOT_DIR/ops/cloud-migrate.sh"
fi

if [[ "$DO_SEED_ADMIN" -eq 1 ]]; then
  echo "[deploy] Run admin bootstrap seed"
  ENV_FILE="$ENV_FILE" API_IMAGE="$API_IMAGE" DOCKER_NETWORK="$NET_NAME" bash "$ROOT_DIR/ops/cloud-seed-admin.sh"
fi

echo "[deploy] Restart containers"
API_IMAGE="$API_IMAGE" WEB_IMAGE="$WEB_IMAGE" \
  API_ENV_FILE="$ENV_FILE" WEB_ENV_FILE="$WEB_ENV_FILE" \
  DOCKER_NETWORK="$NET_NAME" \
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

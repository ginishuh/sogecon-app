#!/usr/bin/env bash
set -euo pipefail

# 컨테이너 시작/재시작 스크립트.
# 환경변수
#   API_IMAGE         : API 컨테이너 이미지 이름 (필수)
#   WEB_IMAGE         : Web 컨테이너 이미지 이름 (필수)
#   API_ENV_FILE      : API에서 사용할 env 파일 경로
#   WEB_ENV_FILE      : Web에서 사용할 env 파일 경로
#   API_CONTAINER     : API 컨테이너 이름 (기본 alumni-api)
#   WEB_CONTAINER     : Web 컨테이너 이름 (기본 alumni-web)
#   API_PORT          : 호스트에서 노출할 API 포트 (기본 3001, 127.0.0.1에 바인딩)
#   WEB_PORT          : 호스트에서 노출할 Web 포트 (기본 3000, 127.0.0.1에 바인딩)
#   UPLOADS_DIR       : API 업로드 볼륨 호스트 경로 (기본 /var/lib/segecon/uploads)
#   DOCKER_NETWORK    : 사용할 Docker 네트워크 이름 (기본 bridge)
#   RELEASE           : 서비스 버전 정보 (기본 현재 시간)

if ! command -v docker >/dev/null 2>&1; then
  echo "docker 명령이 필요합니다." >&2
  exit 1
fi

if [[ -z "${API_IMAGE:-}" || -z "${WEB_IMAGE:-}" ]]; then
  echo "API_IMAGE과 WEB_IMAGE를 모두 지정해야 합니다." >&2
  exit 1
fi

API_CONTAINER=${API_CONTAINER:-alumni-api}
WEB_CONTAINER=${WEB_CONTAINER:-alumni-web}
API_PORT=${API_PORT:-3001}
WEB_PORT=${WEB_PORT:-3000}
UPLOADS_DIR=${UPLOADS_DIR:-/var/lib/segecon/uploads}
DOCKER_NETWORK=${DOCKER_NETWORK:-bridge}
RELEASE=${RELEASE:-$(date +%Y%m%d%H%M%S)}

mkdir -p "${UPLOADS_DIR}"
# 컨테이너 비루트 유저(apiuser/webuser, 통상 UID 1000)에 맞춰 소유권을 시도
chown 1000:1000 "${UPLOADS_DIR}" 2>/dev/null || echo "[warn] uploads ownership not changed (insufficient permission)"

stop_container() {
  local name=$1
  if docker ps -a --format '{{.Names}}' | grep -Fxq "${name}"; then
    echo "기존 컨테이너 ${name} 중지"
    docker stop "${name}" >/dev/null
    docker rm "${name}" >/dev/null
  fi
}

run_api() {
  local args=(--detach --restart unless-stopped --name "${API_CONTAINER}")
  args+=(--network "${DOCKER_NETWORK}")
  args+=(--publish "127.0.0.1:${API_PORT}:3001")
  args+=(-e "APP_ENV=${APP_ENV:-prod}")
  args+=(-e "RELEASE=${RELEASE}")
  if [[ -n "${API_ENV_FILE:-}" ]]; then
    if [[ ! -f "${API_ENV_FILE}" ]]; then
      echo "API_ENV_FILE 경로(${API_ENV_FILE})가 존재하지 않습니다." >&2
      exit 1
    fi
    args+=(--env-file "${API_ENV_FILE}")
  fi
  if [[ -n "${DATABASE_URL:-}" ]]; then
    args+=(-e "DATABASE_URL=${DATABASE_URL}")
  fi
  args+=(--volume "${UPLOADS_DIR}:/app/uploads")

  docker run "${args[@]}" "${API_IMAGE}"
}

run_web() {
  local args=(--detach --restart unless-stopped --name "${WEB_CONTAINER}")
  args+=(--network "${DOCKER_NETWORK}")
  args+=(--publish "127.0.0.1:${WEB_PORT}:3000")
  args+=(-e "NODE_ENV=production")
  args+=(-e "RELEASE=${RELEASE}")
  if [[ -n "${WEB_ENV_FILE:-}" ]]; then
    if [[ ! -f "${WEB_ENV_FILE}" ]]; then
      echo "WEB_ENV_FILE 경로(${WEB_ENV_FILE})가 존재하지 않습니다." >&2
      exit 1
    fi
    args+=(--env-file "${WEB_ENV_FILE}")
  fi
  docker run "${args[@]}" "${WEB_IMAGE}"
}

stop_container "${API_CONTAINER}"
run_api

stop_container "${WEB_CONTAINER}"
run_web

echo "API(${API_CONTAINER})와 Web(${WEB_CONTAINER}) 컨테이너를 재기동했습니다."

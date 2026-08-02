#!/usr/bin/env bash
set -euo pipefail

# Container start/restart entrypoint. Preflight is deliberately completed
# before either existing service is stopped.
#
# Required: API_IMAGE, WEB_IMAGE
# Optional: API_ENV_FILE, WEB_ENV_FILE, API_CONTAINER, WEB_CONTAINER,
# API_PORT, WEB_PORT, UPLOADS_DIR, DOCKER_NETWORK(default: sogecon_net), RELEASE

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
UPLOADS_DIR=${UPLOADS_DIR:-/var/lib/sogecon/uploads}
DOCKER_NETWORK=${DOCKER_NETWORK:-sogecon_net}
RELEASE=${RELEASE:-$(date +%Y%m%d%H%M%S)}

API_MEMORY=${API_MEMORY:-768m}
API_CPUS=${API_CPUS:-1.0}
API_PIDS_LIMIT=${API_PIDS_LIMIT:-256}
WEB_MEMORY=${WEB_MEMORY:-512m}
WEB_CPUS=${WEB_CPUS:-1.0}
WEB_PIDS_LIMIT=${WEB_PIDS_LIMIT:-256}
CONTAINER_LOG_MAX_SIZE=${CONTAINER_LOG_MAX_SIZE:-10m}
CONTAINER_LOG_MAX_FILE=${CONTAINER_LOG_MAX_FILE:-5}
HEALTH_INTERVAL=${HEALTH_INTERVAL:-10s}
CONTAINER_HEALTH_TIMEOUT=${CONTAINER_HEALTH_TIMEOUT:-5s}
HEALTH_RETRIES=${HEALTH_RETRIES:-9}
HEALTH_START_PERIOD=${HEALTH_START_PERIOD:-15s}
HEALTH_WAIT_TIMEOUT=${HEALTH_WAIT_TIMEOUT:-120}

if ! [[ "${HEALTH_WAIT_TIMEOUT}" =~ ^[0-9]+$ ]] || (( HEALTH_WAIT_TIMEOUT < 1 )); then
  echo "HEALTH_WAIT_TIMEOUT은 1 이상의 초여야 합니다." >&2
  exit 1
fi

validate_env_file() {
  local label=$1
  local path=$2
  if [[ ! -f "${path}" ]]; then
    echo "${label} 경로(${path})가 존재하지 않습니다." >&2
    exit 1
  fi
}

# Do not inspect container configuration or print env-file contents here.
# Image/env/network preflight must finish before any stop/rm operation.
docker image inspect "${API_IMAGE}" >/dev/null
docker image inspect "${WEB_IMAGE}" >/dev/null
if [[ -n "${API_ENV_FILE:-}" ]]; then
  validate_env_file API_ENV_FILE "${API_ENV_FILE}"
fi
if [[ -n "${WEB_ENV_FILE:-}" ]]; then
  validate_env_file WEB_ENV_FILE "${WEB_ENV_FILE}"
fi
docker network inspect "${DOCKER_NETWORK}" >/dev/null

mkdir -p "${UPLOADS_DIR}"
chown 1000:1000 "${UPLOADS_DIR}" 2>/dev/null || echo "[warn] uploads ownership not changed (insufficient permission)"

stop_container() {
  local name=$1
  if docker ps -a --format '{{.Names}}' | grep -Fxq "${name}"; then
    echo "기존 컨테이너 ${name} 중지"
    docker stop "${name}" >/dev/null
    docker rm "${name}" >/dev/null
  fi
}

redact_known_secrets() {
  local text=$1
  local env_file line key value

  if [[ -n "${DATABASE_URL:-}" ]]; then
    text=${text//"${DATABASE_URL}"/***}
  fi

  for env_file in "${API_ENV_FILE:-}" "${WEB_ENV_FILE:-}"; do
    [[ -n "${env_file}" && -f "${env_file}" ]] || continue
    while IFS= read -r line || [[ -n "${line}" ]]; do
      [[ "${line}" == *=* && "${line}" != \#* ]] || continue
      key=${line%%=*}
      value=${line#*=}
      value=${value%$'\r'}
      case "${value}" in
        \"*\") value=${value:1:${#value}-2} ;;
        \'*\') value=${value:1:${#value}-2} ;;
      esac
      case "${key}" in
        *SECRET*|*PASSWORD*|*TOKEN*|*PRIVATE*|*KEY*|DATABASE_URL)
          [[ -n "${value}" ]] && text=${text//"${value}"/***}
          ;;
      esac
    done <"${env_file}"
  done

  printf '%s\n' "${text}"
}

report_health_failure() {
  local name=$1
  local status health logs
  status=$(docker inspect --format '{{.State.Status}}' "${name}" 2>/dev/null || printf 'unknown')
  health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "${name}" 2>/dev/null || printf 'missing')
  echo "[health] ${name} failed: status=${status} health=${health}" >&2
  logs=$(docker logs --tail 40 "${name}" 2>&1 || true)
  if [[ -n "${logs}" ]]; then
    echo "[health] ${name} recent logs (max 40 lines):" >&2
    redact_known_secrets "${logs}" >&2
  fi
}

wait_for_healthy() {
  local name=$1
  local elapsed=0 status health
  while (( elapsed < HEALTH_WAIT_TIMEOUT )); do
    status=$(docker inspect --format '{{.State.Status}}' "${name}" 2>/dev/null || printf 'unknown')
    health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "${name}" 2>/dev/null || printf 'missing')
    if [[ "${status}" == "running" && "${health}" == "healthy" ]]; then
      echo "[health] ${name}: healthy"
      return 0
    fi
    if [[ "${status}" == "exited" || "${status}" == "dead" || "${status}" == "unknown" || "${health}" == "missing" || "${health}" == "unhealthy" || "${health}" == "unknown" ]]; then
      report_health_failure "${name}"
      return 1
    fi
    sleep 1
    ((elapsed += 1))
  done

  report_health_failure "${name}"
  echo "[health] ${name} did not become healthy within ${HEALTH_WAIT_TIMEOUT}s." >&2
  return 1
}

run_api() {
  local args=(
    --detach
    --restart unless-stopped
    --name "${API_CONTAINER}"
    --network "${DOCKER_NETWORK}"
    --publish "127.0.0.1:${API_PORT}:3001"
    --memory "${API_MEMORY}"
    --cpus "${API_CPUS}"
    --pids-limit "${API_PIDS_LIMIT}"
    --log-driver json-file
    --log-opt "max-size=${CONTAINER_LOG_MAX_SIZE}"
    --log-opt "max-file=${CONTAINER_LOG_MAX_FILE}"
    --security-opt no-new-privileges=true
    --cap-drop ALL
    --health-interval "${HEALTH_INTERVAL}"
    --health-timeout "${CONTAINER_HEALTH_TIMEOUT}"
    --health-retries "${HEALTH_RETRIES}"
    --health-start-period "${HEALTH_START_PERIOD}"
  )
  args+=(-e "APP_ENV=${APP_ENV:-prod}" -e "RELEASE=${RELEASE}")
  if [[ -n "${API_ENV_FILE:-}" ]]; then
    args+=(--env-file "${API_ENV_FILE}")
  fi
  if [[ -n "${DATABASE_URL:-}" ]]; then
    args+=(-e "DATABASE_URL=${DATABASE_URL}")
  fi
  args+=(--volume "${UPLOADS_DIR}:/app/uploads")
  docker run "${args[@]}" "${API_IMAGE}"
}

run_web() {
  local args=(
    --detach
    --restart unless-stopped
    --name "${WEB_CONTAINER}"
    --network "${DOCKER_NETWORK}"
    --publish "127.0.0.1:${WEB_PORT}:3000"
    --memory "${WEB_MEMORY}"
    --cpus "${WEB_CPUS}"
    --pids-limit "${WEB_PIDS_LIMIT}"
    --log-driver json-file
    --log-opt "max-size=${CONTAINER_LOG_MAX_SIZE}"
    --log-opt "max-file=${CONTAINER_LOG_MAX_FILE}"
    --security-opt no-new-privileges=true
    --cap-drop ALL
    --health-interval "${HEALTH_INTERVAL}"
    --health-timeout "${CONTAINER_HEALTH_TIMEOUT}"
    --health-retries "${HEALTH_RETRIES}"
    --health-start-period "${HEALTH_START_PERIOD}"
  )
  args+=(-e "NODE_ENV=production" -e "RELEASE=${RELEASE}")
  if [[ -n "${WEB_ENV_FILE:-}" ]]; then
    args+=(--env-file "${WEB_ENV_FILE}")
  fi
  docker run "${args[@]}" "${WEB_IMAGE}"
}

stop_container "${API_CONTAINER}"
run_api
wait_for_healthy "${API_CONTAINER}"

stop_container "${WEB_CONTAINER}"
run_web
wait_for_healthy "${WEB_CONTAINER}"

echo "API(${API_CONTAINER})와 Web(${WEB_CONTAINER}) 컨테이너가 모두 healthy입니다."

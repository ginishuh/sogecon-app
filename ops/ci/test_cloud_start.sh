#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/ops/cloud-start.sh"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

[[ "$(stat -c '%a' "$SCRIPT")" == 755 ]]

export FAKE_DOCKER_LOG="$TMP_DIR/docker.log"
export FAKE_DOCKER_MODE=success
unset HEALTH_TIMEOUT CONTAINER_HEALTH_TIMEOUT

docker() {
  local command=${1:-}
  shift || true
  case "${command}" in
    image)
      if [[ "${FAKE_DOCKER_MODE}" == missing-image && "${*}" == *"${FAKE_DOCKER_MISSING_IMAGE}"* ]]; then
        return 1
      fi
      printf 'image %s\n' "$*" >>"${FAKE_DOCKER_LOG}"
      ;;
    network)
      printf 'network %s\n' "$*" >>"${FAKE_DOCKER_LOG}"
      ;;
    ps)
      printf '%s\n' "${FAKE_DOCKER_EXISTING_CONTAINERS:-}"
      ;;
    run)
      printf 'run %s\n' "$*" >>"${FAKE_DOCKER_LOG}"
      ;;
    stop|rm)
      printf '%s %s\n' "${command}" "$*" >>"${FAKE_DOCKER_LOG}"
      ;;
    inspect)
      local format=${2:-}
      local name=${3:-}
      printf 'inspect %s %s\n' "${name}" "${format}" >>"${FAKE_DOCKER_LOG}"
      if [[ "${format}" == *'.State.Status'* ]]; then
        if [[ "${FAKE_DOCKER_MODE}" == exited ]]; then
          printf 'exited\n'
        else
          printf 'running\n'
        fi
      elif [[ "${format}" == *'.State.Health.Status'* ]]; then
        case "${FAKE_DOCKER_MODE}" in
          missing-health) printf 'missing\n' ;;
          unhealthy) printf 'unhealthy\n' ;;
          starting) printf 'starting\n' ;;
          *) printf 'healthy\n' ;;
        esac
      fi
      ;;
    logs)
      printf 'DATABASE_URL=postgresql://app:supersecret@db:5432/appdb\n' >&2
      ;;
    *)
      printf 'unexpected docker command: %s %s\n' "${command}" "$*" >&2
      return 1
      ;;
  esac
}
export -f docker

make_env_files() {
  printf '%s\n' "DATABASE_URL='postgresql://app:supersecret@db:5432/appdb'" >"$TMP_DIR/api.env"
  printf '%s\n' 'NEXT_PUBLIC_WEB_API_BASE=https://api.example.com' >"$TMP_DIR/web.env"
}

run_start() {
  API_IMAGE=api-test \
  WEB_IMAGE=web-test \
  API_CONTAINER=d6-api \
  WEB_CONTAINER=d6-web \
  API_ENV_FILE="${API_ENV_OVERRIDE:-$TMP_DIR/api.env}" \
  WEB_ENV_FILE="${WEB_ENV_OVERRIDE:-$TMP_DIR/web.env}" \
  UPLOADS_DIR="$TMP_DIR/uploads" \
  DOCKER_NETWORK=d6-network \
  HEALTH_WAIT_TIMEOUT=2 \
  bash "$SCRIPT"
}

make_env_files
run_start >"$TMP_DIR/success.out" 2>&1
grep -qF -- '--memory 768m' "$FAKE_DOCKER_LOG"
grep -qF -- '--cpus 1.0' "$FAKE_DOCKER_LOG"
grep -qF -- '--pids-limit 256' "$FAKE_DOCKER_LOG"
grep -qF -- '--log-driver json-file' "$FAKE_DOCKER_LOG"
grep -qF -- '--log-opt max-size=10m' "$FAKE_DOCKER_LOG"
grep -qF -- '--log-opt max-file=5' "$FAKE_DOCKER_LOG"
grep -qF -- '--security-opt no-new-privileges=true' "$FAKE_DOCKER_LOG"
grep -qF -- '--cap-drop ALL' "$FAKE_DOCKER_LOG"
grep -qF -- '--publish 127.0.0.1:3001:3001' "$FAKE_DOCKER_LOG"
grep -qF -- '--publish 127.0.0.1:3000:3000' "$FAKE_DOCKER_LOG"
grep -qF -- '--restart unless-stopped' "$FAKE_DOCKER_LOG"
grep -qF -- '--volume '"$TMP_DIR"'/uploads:/app/uploads' "$FAKE_DOCKER_LOG"

# The deploy wrapper owns integer curl wait seconds; cloud-start must not
# reinterpret the inherited name as a Docker health duration.
export HEALTH_TIMEOUT=120
: >"$FAKE_DOCKER_LOG"
run_start >"$TMP_DIR/inherited-health-timeout.out" 2>&1
grep -qF -- '--health-timeout 5s' "$FAKE_DOCKER_LOG"
! grep -qF -- '--health-timeout 120' "$FAKE_DOCKER_LOG"
export CONTAINER_HEALTH_TIMEOUT=17s
: >"$FAKE_DOCKER_LOG"
run_start >"$TMP_DIR/container-health-timeout.out" 2>&1
grep -qF -- '--health-timeout 17s' "$FAKE_DOCKER_LOG"
unset HEALTH_TIMEOUT CONTAINER_HEALTH_TIMEOUT

api_run_line=$(grep 'run .*--name d6-api' "$FAKE_DOCKER_LOG")
web_run_line=$(grep 'run .*--name d6-web' "$FAKE_DOCKER_LOG")
for run_line in "$api_run_line" "$web_run_line"; do
  for shared_guard in \
    '--restart unless-stopped' \
    '--log-driver json-file' \
    '--log-opt max-size=10m' \
    '--log-opt max-file=5' \
    '--security-opt no-new-privileges=true' \
    '--cap-drop ALL' \
    '--health-interval 10s' \
    '--health-timeout 17s' \
    '--health-retries 9' \
    '--health-start-period 15s'; do
    grep -qF -- "$shared_guard" <<<"$run_line"
  done
done
grep -qF -- '--memory 768m' <<<"$api_run_line"
grep -qF -- '--cpus 1.0' <<<"$api_run_line"
grep -qF -- '--pids-limit 256' <<<"$api_run_line"
grep -qF -- '--memory 512m' <<<"$web_run_line"
grep -qF -- '--cpus 1.0' <<<"$web_run_line"
grep -qF -- '--pids-limit 256' <<<"$web_run_line"
grep -qF -- '--publish 127.0.0.1:3001:3001' <<<"$api_run_line"
grep -qF -- '--publish 127.0.0.1:3000:3000' <<<"$web_run_line"
grep -qF -- '--volume '"$TMP_DIR"'/uploads:/app/uploads' <<<"$api_run_line"
api_run_number=$(grep -n 'run .*--name d6-api' "$FAKE_DOCKER_LOG" | cut -d: -f1)
web_run_number=$(grep -n 'run .*--name d6-web' "$FAKE_DOCKER_LOG" | cut -d: -f1)
api_healthy_line=$(grep -n 'inspect d6-api .*Health.Status' "$FAKE_DOCKER_LOG" | tail -1 | cut -d: -f1)
(( api_run_number < api_healthy_line && api_healthy_line < web_run_number ))
grep -qF 'API(d6-api)와 Web(d6-web) 컨테이너가 모두 healthy입니다.' "$TMP_DIR/success.out"

# Image/env preflight happens before an existing container can be stopped.
export FAKE_DOCKER_MODE=missing-image
export FAKE_DOCKER_MISSING_IMAGE=api-test
export FAKE_DOCKER_EXISTING_CONTAINERS=d6-api
: >"$FAKE_DOCKER_LOG"
if run_start >"$TMP_DIR/missing-image.out" 2>&1; then
  echo 'missing image unexpectedly passed' >&2
  exit 1
fi
! grep -qE '^(stop|rm) ' "$FAKE_DOCKER_LOG"

# Supplied env-file preflight also fails before an existing container is stopped.
export FAKE_DOCKER_MODE=success
unset FAKE_DOCKER_MISSING_IMAGE
export FAKE_DOCKER_EXISTING_CONTAINERS=d6-api
export API_ENV_OVERRIDE="$TMP_DIR/missing-api.env"
: >"$FAKE_DOCKER_LOG"
if run_start >"$TMP_DIR/missing-env.out" 2>&1; then
  echo 'missing env file unexpectedly passed' >&2
  exit 1
fi
grep -qF 'API_ENV_FILE' "$TMP_DIR/missing-env.out"
! grep -qE '^(stop|rm) ' "$FAKE_DOCKER_LOG"
unset API_ENV_OVERRIDE FAKE_DOCKER_EXISTING_CONTAINERS

for mode in missing-health unhealthy; do
  export FAKE_DOCKER_MODE=$mode
  unset FAKE_DOCKER_EXISTING_CONTAINERS
  : >"$FAKE_DOCKER_LOG"
  if run_start >"$TMP_DIR/${mode}.out" 2>&1; then
    echo "${mode} unexpectedly passed" >&2
    exit 1
  fi
  grep -qF 'recent logs (max 40 lines)' "$TMP_DIR/${mode}.out"
  ! grep -qF 'supersecret' "$TMP_DIR/${mode}.out"
  grep -qF '***' "$TMP_DIR/${mode}.out"
done

echo 'cloud-start command contract: PASS'

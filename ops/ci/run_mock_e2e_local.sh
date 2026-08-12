#!/usr/bin/env bash
# Local mock regression E2E (CI-parity). Optional env: apps/web/e2e/env.example
set -euo pipefail
cd "$(dirname "$0")/../.."

MOCK_PORT="${E2E_MOCK_API_PORT:-3001}"
API_BASE="${NEXT_PUBLIC_WEB_API_BASE:-http://127.0.0.1:${MOCK_PORT}}"
CONTROL_URL="${E2E_MOCK_API_CONTROL_URL:-${API_BASE}}"

pkill -f 'mock-api-server.mjs' 2>/dev/null || true
pkill -f 'next start -p 3000' 2>/dev/null || true
fuser -k 3000/tcp "${MOCK_PORT}"/tcp 2>/dev/null || true
sleep 2

MOCK_PID=""
WEB_PID=""
cleanup() {
  if [ -n "${WEB_PID}" ]; then kill "${WEB_PID}" 2>/dev/null || true; wait "${WEB_PID}" 2>/dev/null || true; fi
  if [ -n "${MOCK_PID}" ]; then kill "${MOCK_PID}" 2>/dev/null || true; wait "${MOCK_PID}" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

export WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:3000}"
export NEXT_PUBLIC_WEB_API_BASE="${API_BASE}"
export WEB_BUILD_ALLOW_INSECURE_LOCAL_API="${WEB_BUILD_ALLOW_INSECURE_LOCAL_API:-1}"
export E2E_MOCK_API_CONTROL_URL="${CONTROL_URL}"
export E2E_MOCK_API_PORT="${MOCK_PORT}"

echo "[e2e] api=${NEXT_PUBLIC_WEB_API_BASE} web=${WEB_BASE_URL}"

echo "[e2e] build"
pnpm -C apps/web build

echo "[e2e] mock :${MOCK_PORT}"
node apps/web/e2e/mock-api-server.mjs > /tmp/mock-api.log 2>&1 &
MOCK_PID=$!
sleep 1
kill -0 "${MOCK_PID}"
curl -fsS "${NEXT_PUBLIC_WEB_API_BASE}/healthz" | grep -q '"ok":true'

echo "[e2e] web"
pnpm -C apps/web start > /tmp/web-start.log 2>&1 &
WEB_PID=$!
for _ in $(seq 1 60); do
  curl -fsS "${WEB_BASE_URL}/" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "${WEB_BASE_URL}/" >/dev/null

echo "[e2e] tests"
PUPPETEER_EXECUTABLE_PATH="${PUPPETEER_EXECUTABLE_PATH:-/usr/bin/google-chrome-stable}" \
  pnpm -C apps/web e2e

#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

FAKE_BIN="$TMP_DIR/bin"
mkdir -p "$FAKE_BIN"
cat >"$FAKE_BIN/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

command=${1:-}
shift || true
case "$command" in
  build)
    printf 'build %s\n' "$*" >>"$FAKE_DOCKER_LOG"
    ;;
  image|network)
    printf '%s %s\n' "$command" "$*" >>"$FAKE_DOCKER_LOG"
    ;;
  ps)
    ;;
  run)
    printf 'run %s\n' "$*" >>"$FAKE_DOCKER_LOG"
    ;;
  inspect)
    format=${2:-}
    printf 'inspect %s %s\n' "${3:-}" "$format" >>"$FAKE_DOCKER_LOG"
    if [[ "$format" == *'.State.Status'* ]]; then
      printf 'running\n'
    elif [[ "$format" == *'.State.Health.Status'* ]]; then
      printf 'healthy\n'
    fi
    ;;
  logs)
    ;;
  *)
    printf 'unexpected docker command: %s %s\n' "$command" "$*" >&2
    exit 1
    ;;
esac
EOF
chmod 755 "$FAKE_BIN/docker"

API_ENV="$TMP_DIR/api.env"
WEB_ENV="$TMP_DIR/web.env"
MISSING_WEB_ENV="$TMP_DIR/missing-web.env"
MARKER="$TMP_DIR/should-not-exist"
printf '%s\n' 'DATABASE_URL=postgresql://app:devpass@db:5432/appdb' >"$API_ENV"
cat >"$WEB_ENV" <<EOF
RUN_MARKER=\$(touch "$MARKER")
NEXT_PUBLIC_WEB_API_BASE=https://api.example.com
NEXT_PUBLIC_SITE_URL=https://www.example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=test-public-vapid-key
NEXT_PUBLIC_ANALYTICS_ID=G-D6TEST
NEXT_PUBLIC_ENABLE_SW=1
NEXT_PUBLIC_RELAX_CSP=1
NEXT_PUBLIC_IMAGE_DOMAINS=cdn.example.com
EOF
printf '%s\n' 'NEXT_PUBLIC_SITE_URL=https://www.example.com' >"$MISSING_WEB_ENV"

export FAKE_DOCKER_LOG="$TMP_DIR/docker.log"
export PATH="$FAKE_BIN:$PATH"

PNPM_VERSION=10.17.1 \
  bash "$ROOT/scripts/deploy-vps.sh" \
  --tag d6-contract \
  --local-build \
  --skip-migrate \
  --env "$API_ENV" \
  --web-env "$WEB_ENV" \
  --uploads "$TMP_DIR/uploads"

grep -qF -- 'build --build-arg NEXT_PUBLIC_WEB_API_BASE=https://api.example.com' "$FAKE_DOCKER_LOG"
grep -qF -- '--build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=test-public-vapid-key' "$FAKE_DOCKER_LOG"
grep -qF -- '--build-arg NEXT_PUBLIC_SITE_URL=https://www.example.com' "$FAKE_DOCKER_LOG"
grep -qF -- '--build-arg NEXT_PUBLIC_ANALYTICS_ID=G-D6TEST' "$FAKE_DOCKER_LOG"
grep -qF -- '--build-arg NEXT_PUBLIC_ENABLE_SW=1' "$FAKE_DOCKER_LOG"
grep -qF -- '--build-arg NEXT_PUBLIC_RELAX_CSP=1' "$FAKE_DOCKER_LOG"
grep -qF -- '--build-arg NEXT_PUBLIC_IMAGE_DOMAINS=cdn.example.com' "$FAKE_DOCKER_LOG"
grep -qF -- 'network inspect sogecon_net' "$FAKE_DOCKER_LOG"
grep -qF -- '--network sogecon_net' "$FAKE_DOCKER_LOG"
[[ ! -e "$MARKER" ]]

# An explicit API-base override wins only for that one key. Other allowlisted
# public build values continue to come from the safely parsed file.
: >"$FAKE_DOCKER_LOG"
PNPM_VERSION=10.17.1 \
  bash "$ROOT/scripts/deploy-vps.sh" \
  --tag d6-contract-override \
  --local-build \
  --skip-migrate \
  --env "$API_ENV" \
  --web-env "$WEB_ENV" \
  --web-api-base https://override.example.com \
  --uploads "$TMP_DIR/override-uploads"
grep -qF -- 'build --build-arg NEXT_PUBLIC_WEB_API_BASE=https://override.example.com' "$FAKE_DOCKER_LOG"
grep -qF -- '--build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=test-public-vapid-key' "$FAKE_DOCKER_LOG"
[[ ! -e "$MARKER" ]]

: >"$FAKE_DOCKER_LOG"
if PNPM_VERSION=10.17.1 \
  bash "$ROOT/scripts/deploy-vps.sh" \
  --tag d6-contract-missing \
  --local-build \
  --skip-migrate \
  --env "$API_ENV" \
  --web-env "$MISSING_WEB_ENV" \
  --uploads "$TMP_DIR/missing-uploads" \
  --network d6-contract-network >"$TMP_DIR/missing.out" 2>&1; then
  echo 'missing NEXT_PUBLIC_WEB_API_BASE unexpectedly passed' >&2
  exit 1
fi
grep -qF 'NEXT_PUBLIC_WEB_API_BASE is required for local Web image build' "$TMP_DIR/missing.out"
! grep -qF 'build ' "$FAKE_DOCKER_LOG"

if HEALTH_TIMEOUT=5s \
  bash "$ROOT/scripts/deploy-vps.sh" \
  --tag d6-contract-invalid-timeout \
  --pull-images \
  --skip-migrate \
  --env "$API_ENV" \
  --web-env "$WEB_ENV" \
  --uploads "$TMP_DIR/invalid-timeout-uploads" \
  --network d6-contract-network >"$TMP_DIR/invalid-timeout.out" 2>&1; then
  echo 'non-integer HEALTH_TIMEOUT unexpectedly passed' >&2
  exit 1
fi
grep -qF 'HEALTH_TIMEOUT must be a positive integer' "$TMP_DIR/invalid-timeout.out"

echo 'deploy-vps command contract: PASS'

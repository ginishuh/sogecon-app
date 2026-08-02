#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
capture_file=$(mktemp)
output_file=$(mktemp)
trap 'rm -f "$capture_file" "$output_file"' EXIT
export capture_file

docker() {
  printf '%s\n' "$@" >"$capture_file"
}
export -f docker

secret_url='postgresql+psycopg://app:secret@postgres:5432/appdb'
custom_command='alembic -c apps/api/alembic.ini upgrade head --tag d5 review'

API_IMAGE=d5-contract-api \
DATABASE_URL="$secret_url" \
DOCKER_NETWORK=d5-contract-network \
ALEMBIC_CMD="$custom_command" \
bash "$ROOT/ops/cloud-migrate.sh" >"$output_file"

mapfile -t docker_args <"$capture_file"
[[ "${docker_args[0]}" == "run" ]]
[[ "${docker_args[1]}" == "--rm" ]]
[[ "${docker_args[2]}" == "--entrypoint" ]]
[[ "${docker_args[3]}" == "/bin/sh" ]]
[[ "${docker_args[4]}" == "--network" ]]
[[ "${docker_args[5]}" == "d5-contract-network" ]]
[[ "${docker_args[6]}" == "-e" ]]
[[ "${docker_args[7]}" == "DATABASE_URL=$secret_url" ]]
[[ "${docker_args[8]}" == "d5-contract-api" ]]
[[ "${docker_args[9]}" == "-lc" ]]
[[ "${docker_args[10]}" == "$custom_command" ]]
! grep -F "$secret_url" "$output_file"

echo "cloud-migrate command contract: PASS"

#!/usr/bin/env bash
set -euo pipefail

# 운영 관리자 bootstrap 시드 실행 스크립트.
# 환경변수
#   API_IMAGE      : 시드 실행에 사용할 API 이미지 (필수)
#   ENV_FILE       : 시드 환경변수 파일 (필수, 예: .env.api)
#   DOCKER_NETWORK : 동일 네트워크에서 실행할 경우 지정 (예: sogecon_net)
#   SEED_CMD       : 커스텀 시드 커맨드 (기본: python -m apps.api.seed_production)

if [[ -z "${API_IMAGE:-}" ]]; then
  echo "API_IMAGE 변수를 지정해야 합니다." >&2
  exit 1
fi

if [[ -z "${ENV_FILE:-}" ]]; then
  echo "ENV_FILE 변수를 지정해야 합니다. (예: .env.api)" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ENV_FILE 경로(${ENV_FILE})가 존재하지 않습니다." >&2
  exit 1
fi

SEED_CMD=${SEED_CMD:-"python -m apps.api.seed_production"}
DOCKER_ARGS=(--rm --env-file "${ENV_FILE}")

if [[ -n "${DOCKER_NETWORK:-}" ]]; then
  DOCKER_ARGS+=(--network "${DOCKER_NETWORK}")
fi

echo "[seed-admin] image=${API_IMAGE} env=${ENV_FILE} network=${DOCKER_NETWORK:-<none>}"
docker run "${DOCKER_ARGS[@]}" \
  "${API_IMAGE}" \
  bash -lc "${SEED_CMD}"

echo "운영 관리자 bootstrap 시드 완료"

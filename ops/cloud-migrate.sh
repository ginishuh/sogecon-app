#!/usr/bin/env bash
set -euo pipefail

# DB 마이그레이션 전용 스크립트.
# 환경변수
#   API_IMAGE      : 마이그레이션을 수행할 API 이미지 (필수)
#   ENV_FILE       : Alembic 실행에 사용할 환경변수 파일 (기본 deploy/api.env)
#   ALEMBIC_CMD    : 커스텀 Alembic 커맨드 (기본 upgrade head)
#   DOCKER_NETWORK : 동일 네트워크에서 실행할 경우 지정 (예: segecon_net)

if [[ -z "${API_IMAGE:-}" ]]; then
  echo "API_IMAGE 변수를 지정해야 합니다." >&2
  exit 1
fi

ALEMBIC_CMD=${ALEMBIC_CMD:-"alembic -c apps/api/alembic.ini upgrade head"}

DOCKER_ARGS=(--rm)

# 동일 네트워크가 필요하면 명시적으로 연결
if [[ -n "${DOCKER_NETWORK:-}" ]]; then
  DOCKER_ARGS+=(--network "${DOCKER_NETWORK}")
fi

if [[ -n "${ENV_FILE:-}" ]]; then
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "ENV_FILE 경로(${ENV_FILE})가 존재하지 않습니다." >&2
    exit 1
  fi
  DOCKER_ARGS+=(--env-file "${ENV_FILE}")
fi

if [[ -z "${ENV_FILE:-}" && -z "${DATABASE_URL:-}" ]]; then
  echo "ENV_FILE 또는 DATABASE_URL 중 하나는 제공되어야 합니다." >&2
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  DOCKER_ARGS+=(-e "DATABASE_URL=${DATABASE_URL}")
fi

echo "[migrate] image=${API_IMAGE} env=${ENV_FILE:-<none>} network=${DOCKER_NETWORK:-<none>}"
docker run "${DOCKER_ARGS[@]}" \
  "${API_IMAGE}" \
  bash -lc "${ALEMBIC_CMD}"

echo "Alembic 마이그레이션 완료"

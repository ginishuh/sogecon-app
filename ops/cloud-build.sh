#!/usr/bin/env bash
set -euo pipefail

# Docker 이미지 빌드 진입점.
# 환경변수
#   IMAGE_TAG        : 빌드 결과에 사용할 태그 (기본은 현재 Git SHA)
#   IMAGE_PREFIX     : 이미지 저장소/이름 접두사 (기본 local/segecon)
#   API_IMAGE        : API 이미지 전체 이름을 직접 지정하고 싶은 경우
#   WEB_IMAGE        : Web 이미지 전체 이름을 직접 지정하고 싶은 경우
#   PUSH_IMAGES      : 1이면 빌드 후 docker push 수행
#   NEXT_PUBLIC_*    : 웹 빌드 시 주입할 Next.js 공개 환경변수

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "${ROOT_DIR}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker 명령이 필요합니다." >&2
  exit 1
fi

if [[ -z "${IMAGE_TAG:-}" ]]; then
  if command -v git >/dev/null 2>&1; then
    IMAGE_TAG=$(git rev-parse --short HEAD)
  else
    IMAGE_TAG=$(date +%Y%m%d%H%M%S)
  fi
fi

IMAGE_PREFIX=${IMAGE_PREFIX:-local/segecon}
API_IMAGE=${API_IMAGE:-${IMAGE_PREFIX}/alumni-api:${IMAGE_TAG}}
WEB_IMAGE=${WEB_IMAGE:-${IMAGE_PREFIX}/alumni-web:${IMAGE_TAG}}

echo "API  이미지: ${API_IMAGE}"
echo "Web  이미지: ${WEB_IMAGE}"

docker build \
  -f infra/api.Dockerfile \
  -t "${API_IMAGE}" \
  .

WEB_BUILD_ARGS=()
for arg in \
  NEXT_PUBLIC_WEB_API_BASE \
  NEXT_PUBLIC_SITE_URL \
  NEXT_PUBLIC_VAPID_PUBLIC_KEY \
  NEXT_PUBLIC_ANALYTICS_ID \
  NEXT_PUBLIC_ENABLE_SW \
  NEXT_PUBLIC_RELAX_CSP \
  NEXT_PUBLIC_IMAGE_DOMAINS
do
  value=${!arg-}
  if [[ -n "${value}" ]]; then
    WEB_BUILD_ARGS+=(--build-arg "${arg}=${value}")
  fi
done

docker build \
  "${WEB_BUILD_ARGS[@]}" \
  -f infra/web.Dockerfile \
  -t "${WEB_IMAGE}" \
  .

if [[ "${PUSH_IMAGES:-0}" == "1" ]]; then
  echo "docker push 실행"
  docker push "${API_IMAGE}"
  docker push "${WEB_IMAGE}"
fi

echo "빌드 완료"

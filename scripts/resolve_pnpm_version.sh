#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "${ROOT_DIR}"

# 수동 지정이 있으면 그대로 사용
if [[ -n "${PNPM_VERSION:-}" ]]; then
  echo "${PNPM_VERSION}"
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node가 필요합니다." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm이 필요합니다." >&2
  exit 1
fi

range=$(node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync('apps/web/package.json','utf8'));const r=data.engines&&data.engines.pnpm;if(!r){process.exit(2);}console.log(r);")
if [[ -z "${range}" ]]; then
  echo "apps/web/package.json engines.pnpm이 비어 있습니다." >&2
  exit 1
fi

if [[ "${range}" =~ ([0-9]+) ]]; then
  major="${BASH_REMATCH[1]}"
else
  echo "pnpm 엔진 범위에서 메이저 버전을 추출하지 못했습니다: ${range}" >&2
  exit 1
fi

tag="${PNPM_TAG:-latest-${major}}"
set +e
version=$(npm view "pnpm@${tag}" version 2>&1)
status=$?
set -e
if [[ $status -ne 0 || -z "${version}" ]]; then
  echo "pnpm ${tag} 버전을 조회하지 못했습니다. PNPM_VERSION을 수동 지정하세요." >&2
  echo "${version}" >&2
  exit 1
fi

echo "${version}"

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

node_err_file=$(mktemp)
set +e
range=$(node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync('apps/web/package.json','utf8'));const r=data.engines&&data.engines.pnpm;if(!r){process.exit(2);}console.log(r);" 2> "${node_err_file}")
status=$?
set -e
node_err_msg=""
if [[ -s "${node_err_file}" ]]; then
  node_err_msg=$(cat "${node_err_file}")
fi
rm -f "${node_err_file}"
if [[ $status -ne 0 ]]; then
  if [[ $status -eq 2 ]]; then
    echo "apps/web/package.json engines.pnpm이 없습니다." >&2
  else
    echo "apps/web/package.json engines.pnpm 읽기에 실패했습니다." >&2
    if [[ -n "${node_err_msg}" ]]; then
      echo "${node_err_msg}" >&2
    fi
  fi
  exit 1
fi
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
npm_err_file=$(mktemp)
set +e
version=$(npm view "pnpm@${tag}" version 2> "${npm_err_file}")
status=$?
set -e
npm_err_msg=""
if [[ -s "${npm_err_file}" ]]; then
  npm_err_msg=$(cat "${npm_err_file}")
fi
rm -f "${npm_err_file}"
if [[ $status -ne 0 || -z "${version}" ]]; then
  echo "pnpm ${tag} 버전을 조회하지 못했습니다. PNPM_VERSION을 수동 지정하세요." >&2
  if [[ -n "${npm_err_msg}" ]]; then
    echo "${npm_err_msg}" >&2
  fi
  exit 1
fi

echo "${version}"

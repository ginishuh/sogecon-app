#!/bin/sh
set -eu

# TRUSTED_PROXY_IPS → uvicorn --forwarded-allow-ips
# 비어 있으면 127.0.0.1만 허용. '*'는 사용하지 않는다.
_raw="${TRUSTED_PROXY_IPS:-}"
_allow=""

# '*' 등이 pathname expansion 되지 않도록 noglob
set -f
_old_ifs=$IFS
IFS=,
# shellcheck disable=SC2086
for part in ${_raw}; do
  trimmed=$(printf '%s' "$part" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  [ -z "$trimmed" ] && continue
  [ "$trimmed" = "*" ] && continue
  if [ -z "$_allow" ]; then
    _allow="$trimmed"
  else
    _allow="${_allow},${trimmed}"
  fi
done
IFS=$_old_ifs
set +f

if [ -z "$_allow" ]; then
  _allow="127.0.0.1"
fi

exec uvicorn apps.api.main:app \
  --host 0.0.0.0 \
  --port 3001 \
  --proxy-headers \
  --forwarded-allow-ips "$_allow"

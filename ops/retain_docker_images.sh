#!/usr/bin/env bash
set -euo pipefail
# Retain only the most recent N images per repository prefix.
# Default: prefix=ghcr.io/ginishuh/sogecon-app/ keep=2
PREFIX=${PREFIX:-ghcr.io/ginishuh/sogecon-app/}
KEEP=${KEEP:-2}
DRY_RUN=${DRY_RUN:-}

# collect images for prefix, sorted by repo then createdAt desc
mapfile -t rows < <(docker images --format '{{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}' \
  | awk -F '\t' -v p="$PREFIX" '$1 ~ "^"p {print}' \
  | sort -t $'\t' -k1,1 -k4,4r)

current_repo=""
count=0
ids_to_delete=()
used_set=$(mktemp)
docker ps -a --format '{{.Image}}' | sort -u > "$used_set" || true

for line in "${rows[@]}"; do
  repo=$(awk -F '\t' '{print $1}' <<<"$line")
  tag=$(awk -F '\t' '{print $2}' <<<"$line")
  id=$(awk -F '\t' '{print $3}' <<<"$line")
  if [[ "$repo" != "$current_repo" ]]; then
    current_repo="$repo"
    count=0
  fi
  ((count++))
  if (( count <= KEEP )); then
    continue
  fi
  if grep -qx "$repo:$tag" "$used_set" 2>/dev/null; then
    echo "[skip] in-use by container: $repo:$tag ($id)"
    continue
  fi
  ids_to_delete+=("$id")
  echo "[mark] delete $repo:$tag ($id)"
done

rm -f "$used_set"

if (( ${#ids_to_delete[@]} > 0 )); then
  if [[ -n "$DRY_RUN" ]]; then
    echo "[dry-run] would delete: ${ids_to_delete[*]}"
  else
    docker rmi -f "${ids_to_delete[@]}" || true
  fi
else
  echo "[retain] nothing to delete for prefix=$PREFIX"
fi

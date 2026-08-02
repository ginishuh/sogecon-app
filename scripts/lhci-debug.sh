#!/usr/bin/env bash
set -euo pipefail

# LHCI NO_FCP reproduction helper
# Usage: scripts/lhci-debug.sh [mobile|desktop] [url]
# Requires: node, pnpm (workspace), lhci (installed by action or npx)

ROOT_DIR=/home/ginis
FORM_FACTOR=mobile
URL=http://localhost:3000/

export NEXT_PUBLIC_RELAX_CSP=1
export NEXT_PUBLIC_ENABLE_SW=0
export NEXT_PUBLIC_WEB_API_BASE=http://localhost:3000

# Start server if not running
if ! curl -sSf http://localhost:3000 >/dev/null 2>&1; then
  echo Starting
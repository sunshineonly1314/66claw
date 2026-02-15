#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${OPENCLAWCN_IMAGE:-openclawcn:local}"
CONFIG_DIR="${OPENCLAWCN_CONFIG_DIR:-$HOME/.openclawcn}"
WORKSPACE_DIR="${OPENCLAWCN_WORKSPACE_DIR:-$HOME/clawd}"
PROFILE_FILE="${OPENCLAWCN_PROFILE_FILE:-$HOME/.profile}"

PROFILE_MOUNT=()
if [[ -f "$PROFILE_FILE" ]]; then
  PROFILE_MOUNT=(-v "$PROFILE_FILE":/home/node/.profile:ro)
fi

echo "==> Build image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" -f "$ROOT_DIR/Dockerfile" "$ROOT_DIR"

echo "==> Run live model tests (profile keys)"
docker run --rm -t \
  --entrypoint bash \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e HOME=/home/node \
  -e "NODE_OPTIONS=--disable-warning=ExperimentalWarning --disable-warning=DEP0040 --disable-warning=DEP0060" \
  -e OPENCLAWCN_LIVE_TEST=1 \
  -e OPENCLAWCN_LIVE_MODELS="${OPENCLAWCN_LIVE_MODELS:-all}" \
  -e OPENCLAWCN_LIVE_PROVIDERS="${OPENCLAWCN_LIVE_PROVIDERS:-}" \
  -e OPENCLAWCN_LIVE_MODEL_TIMEOUT_MS="${OPENCLAWCN_LIVE_MODEL_TIMEOUT_MS:-}" \
  -e OPENCLAWCN_LIVE_REQUIRE_PROFILE_KEYS="${OPENCLAWCN_LIVE_REQUIRE_PROFILE_KEYS:-}" \
  -v "$CONFIG_DIR":/home/node/.openclawcn \
  -v "$WORKSPACE_DIR":/home/node/clawd \
  "${PROFILE_MOUNT[@]}" \
  "$IMAGE_NAME" \
  -lc "set -euo pipefail; [ -f \"$HOME/.profile\" ] && source \"$HOME/.profile\" || true; cd /app && pnpm test:live"

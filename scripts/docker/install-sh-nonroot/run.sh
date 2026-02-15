#!/usr/bin/env bash
set -euo pipefail

INSTALL_URL="${OPENCLAWCN_INSTALL_URL:-https://openclawcn.com/install.sh}"

echo "==> Pre-flight: ensure git absent"
if command -v git >/dev/null; then
  echo "git is present unexpectedly" >&2
  exit 1
fi

echo "==> Run installer (non-root user)"
curl -fsSL "$INSTALL_URL" | bash

# Ensure PATH picks up user npm prefix
export PATH="$HOME/.npm-global/bin:$PATH"

echo "==> Verify git installed"
command -v git >/dev/null

echo "==> Verify openclawcn installed"
EXPECTED_VERSION="${OPENCLAWCN_INSTALL_EXPECT_VERSION:-}"
if [[ -n "$EXPECTED_VERSION" ]]; then
  LATEST_VERSION="$EXPECTED_VERSION"
else
  LATEST_VERSION="$(npm view openclawcn version)"
fi
CMD_PATH="$(command -v openclawcn || true)"
if [[ -z "$CMD_PATH" && -x "$HOME/.npm-global/bin/openclawcn" ]]; then
  CMD_PATH="$HOME/.npm-global/bin/openclawcn"
fi
if [[ -z "$CMD_PATH" ]]; then
  echo "openclawcn not on PATH" >&2
  exit 1
fi
INSTALLED_VERSION="$("$CMD_PATH" --version 2>/dev/null | head -n 1 | tr -d '\r')"

echo "installed=$INSTALLED_VERSION expected=$LATEST_VERSION"
if [[ "$INSTALLED_VERSION" != "$LATEST_VERSION" ]]; then
  echo "ERROR: expected openclawcn@$LATEST_VERSION, got @$INSTALLED_VERSION" >&2
  exit 1
fi

echo "==> Sanity: CLI runs"
"$CMD_PATH" --help >/dev/null

echo "OK"

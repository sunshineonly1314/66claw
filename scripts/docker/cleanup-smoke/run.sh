#!/usr/bin/env bash
set -euo pipefail

cd /repo

export OPENCLAWCN_STATE_DIR="/tmp/openclawcn-test"
export OPENCLAWCN_CONFIG_PATH="${OPENCLAWCN_STATE_DIR}/openclawcn.json"

echo "==> Seed state"
mkdir -p "${OPENCLAWCN_STATE_DIR}/credentials"
mkdir -p "${OPENCLAWCN_STATE_DIR}/agents/main/sessions"
echo '{}' >"${OPENCLAWCN_CONFIG_PATH}"
echo 'creds' >"${OPENCLAWCN_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${OPENCLAWCN_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm openclawcn reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${OPENCLAWCN_CONFIG_PATH}"
test ! -d "${OPENCLAWCN_STATE_DIR}/credentials"
test ! -d "${OPENCLAWCN_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${OPENCLAWCN_STATE_DIR}/credentials"
echo '{}' >"${OPENCLAWCN_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm openclawcn uninstall --state --yes --non-interactive

test ! -d "${OPENCLAWCN_STATE_DIR}"

echo "OK"

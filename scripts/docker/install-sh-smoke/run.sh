#!/usr/bin/env bash
set -euo pipefail

INSTALL_URL="${OPENCLAWCN_INSTALL_URL:-https://openclawcn.com/install.sh}"
SMOKE_PREVIOUS_VERSION="${OPENCLAWCN_INSTALL_SMOKE_PREVIOUS:-}"
SKIP_PREVIOUS="${OPENCLAWCN_INSTALL_SMOKE_SKIP_PREVIOUS:-0}"

echo "==> Resolve npm versions"
if [[ -n "$SMOKE_PREVIOUS_VERSION" ]]; then
  LATEST_VERSION="$(npm view openclawcn version)"
  PREVIOUS_VERSION="$SMOKE_PREVIOUS_VERSION"
else
  VERSIONS_JSON="$(npm view openclawcn versions --json)"
  versions_line="$(node - <<'NODE'
const raw = process.env.VERSIONS_JSON || "[]";
let versions;
try {
  versions = JSON.parse(raw);
} catch {
  versions = raw ? [raw] : [];
}
if (!Array.isArray(versions)) {
  versions = [versions];
}
if (versions.length === 0) {
  process.exit(1);
}
const latest = versions[versions.length - 1];
const previous = versions.length >= 2 ? versions[versions.length - 2] : latest;
process.stdout.write(`${latest} ${previous}`);
NODE
)"
  LATEST_VERSION="${versions_line%% *}"
  PREVIOUS_VERSION="${versions_line#* }"
fi

if [[ -n "${OPENCLAWCN_INSTALL_LATEST_OUT:-}" ]]; then
  printf "%s" "$LATEST_VERSION" > "$OPENCLAWCN_INSTALL_LATEST_OUT"
fi

echo "latest=$LATEST_VERSION previous=$PREVIOUS_VERSION"

if [[ "$SKIP_PREVIOUS" == "1" ]]; then
  echo "==> Skip preinstall previous (OPENCLAWCN_INSTALL_SMOKE_SKIP_PREVIOUS=1)"
else
  echo "==> Preinstall previous (forces installer upgrade path)"
  npm install -g "openclawcn@${PREVIOUS_VERSION}"
fi

echo "==> Run official installer one-liner"
curl -fsSL "$INSTALL_URL" | bash

echo "==> Verify installed version"
INSTALLED_VERSION="$(openclawcn --version 2>/dev/null | head -n 1 | tr -d '\r')"
echo "installed=$INSTALLED_VERSION expected=$LATEST_VERSION"

if [[ "$INSTALLED_VERSION" != "$LATEST_VERSION" ]]; then
  echo "ERROR: expected openclawcn@$LATEST_VERSION, got openclawcn@$INSTALLED_VERSION" >&2
  exit 1
fi

echo "==> Sanity: CLI runs"
openclawcn --help >/dev/null

echo "OK"

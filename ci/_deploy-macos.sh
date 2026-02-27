#!/usr/bin/env bash
# One-shot script to run release-deploy on Mac Mini for Tauri DMG
set -e
cd /Users/kevinsun/cicd-workspace/openclawcn

# Load environment
source ~/.zprofile 2>/dev/null || true
export PATH="/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin:$PATH"

VERSION=$(node -p "require('./package.json').version")
echo "Deploying version: $VERSION"

DMG_DIR="apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg"
ls -lh "$DMG_DIR"/*.dmg

if [ -z "$DEPLOY_SERVER" ] || [ -z "$DEPLOY_DOMAIN" ]; then
  echo "ERROR: DEPLOY_SERVER and DEPLOY_DOMAIN env vars must be set."
  exit 1
fi

pnpm tsx scripts/release-deploy.ts \
  --version "$VERSION" \
  --cache-dir /Users/kevinsun/cicd-workspace/openclawcn/.release-cache \
  --platform macos \
  --server "$DEPLOY_SERVER" --domain "$DEPLOY_DOMAIN" \
  --installers "$DMG_DIR"

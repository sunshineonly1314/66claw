#!/bin/bash
set -euo pipefail

export PATH="/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
set +e
source "$HOME/.cargo/env" 2>/dev/null
for f in ~/.zprofile ~/.profile; do [ -f "$f" ] && source "$f" 2>/dev/null; done
set -e
export PATH="/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin:$PATH"

WORKSPACE="/Users/kevinsun/cicd-workspace/openclawcn"
ARCH="universal"

cd "$WORKSPACE"

# Ensure git uses HTTPS for all github.com access
git config --global url."https://github.com/".insteadOf "git+ssh://git@github.com/"
git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
git config --global url."https://github.com/".insteadOf "git://github.com/"
git config --global url."https://github.com/".insteadOf "git@github.com:"
git config --global url."https://github.com/".insteadOf "git+https://github.com/"
echo "Git insteadOf configured"

echo "Node: $(node --version)"
echo "pnpm: $(pnpm --version)"
echo "Cargo: $(cargo --version)"
echo ""

# Check if node_modules exists, if not, install
if [[ ! -d "node_modules" ]]; then
  echo "Installing dependencies..."
  pnpm install --no-frozen-lockfile 2>&1
fi

# Clean dist/ and Tauri target from previous failed build
echo "Cleaning previous build artifacts..."
rm -rf dist/ 2>/dev/null || true
rm -rf apps/desktop/src-tauri/target/ 2>/dev/null || true
# Resources dir may have read-only files from npm install; fix permissions first
chmod -R u+w apps/desktop/src-tauri/resources/ 2>/dev/null || true
rm -rf apps/desktop/src-tauri/resources/ 2>/dev/null || true

# Restore extension source files (bytecode compilation replaces .js with CJS stubs)
echo "Restoring extension source files to clean state..."
git checkout -- extensions/ 2>/dev/null || true

echo ""
echo "Starting full desktop build..."
echo "  This runs: tsdown -> CN encryption -> UI -> prepare-resources -> Tauri build"
echo ""

chmod +x scripts/desktop/build.sh
bash scripts/desktop/build.sh --arch "$ARCH"

# Verify results
echo ""
echo "=== VERIFICATION ==="
TAURI_TARGET="universal-apple-darwin"
DMG_DIR="apps/desktop/src-tauri/target/$TAURI_TARGET/release/bundle/dmg"
DMG_FILE=$(find "$DMG_DIR" -name "*.dmg" 2>/dev/null | head -1)

JSC_COUNT=$(find dist -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
echo "Bytecode .jsc files: $JSC_COUNT"

for bc_dir in dist/dispatch dist/license dist/security dist/memory; do
  BC=$(find "$bc_dir" -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
  echo "  $bc_dir: $BC .jsc"
done

echo "UI: $(test -f dist/control-ui/index.html && echo 'OK' || echo 'MISSING')"

for cn_ext in openclawwechat agent-team orchestrator memory-core dingtalk feishu; do
  EXT_JS=$(find "extensions/$cn_ext" -name "*.js" 2>/dev/null | wc -l | tr -d ' ')
  echo "  extensions/$cn_ext: $EXT_JS .js"
done

if [[ -n "$DMG_FILE" ]] && [[ -f "$DMG_FILE" ]]; then
  echo ""
  echo "DMG: $DMG_FILE"
  echo "Size: $(du -m "$DMG_FILE" | cut -f1)MB"
  echo "SHA256: $(shasum -a 256 "$DMG_FILE" | cut -d' ' -f1)"
  echo ""
  echo "BUILD SUCCESS!"
else
  echo ""
  echo "NO DMG FOUND!"
  ls -la "$DMG_DIR/" 2>/dev/null || echo "DMG dir not found"
  echo "BUILD FAILED"
  exit 1
fi

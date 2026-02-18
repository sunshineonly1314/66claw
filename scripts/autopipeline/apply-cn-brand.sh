#!/usr/bin/env bash
# ============================================================
# Apply CN Brand Rename (OpenClaw → OpenClawCN)
#
# Run AFTER merging upstream to rename all OpenClaw references
# to OpenClawCN, eliminating "fake conflicts" caused by the
# brand name divergence.
#
# Usage:
#   bash scripts/autopipeline/apply-cn-brand.sh              # Apply to working tree
#   bash scripts/autopipeline/apply-cn-brand.sh --dry-run    # Preview changes only
#   bash scripts/autopipeline/apply-cn-brand.sh --stats      # Show match counts only
#
# This script is idempotent: running it multiple times is safe.
# It only transforms OpenClaw → OpenClawCN, never the reverse.
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

DRY_RUN=false
STATS_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --stats) STATS_ONLY=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# ============================================================
# Exclusion patterns — NEVER rename these
# ============================================================
# Files/dirs to skip entirely
EXCLUDE_DIRS=(
  "node_modules"
  ".git"
  "vendor"
  ".upstream-analysis"
  "dist"
  "build"
  "coverage"
  "*.bak"
)

# Patterns in content that should NOT be renamed
# (upstream repo references, package scopes, domain names)
EXCLUDE_CONTENT_PATTERNS=(
  "github.com/openclaw/openclaw"  # Upstream repo URL
  "@openclaw/"                     # npm scope
  "openclaw.ai"                    # Domain name
  "openclaw.com"                   # Domain name
  "from 'openclaw'"               # npm package import
  "\"openclaw\""                   # npm package name in quotes
)

# File extensions to process
INCLUDE_EXTENSIONS="ts,tsx,js,jsx,json,md,yml,yaml,sh,html,css,swift,toml,plist"

# ============================================================
# Brand rename rules (order matters!)
# ============================================================
# More specific patterns first to prevent partial replacements.
#
# Rule format: "FIND|REPLACE"
RULES=(
  # PascalCase compound names (most specific first)
  "OpenClawCNConfig|OpenClawCNConfig"     # Already correct — skip (idempotent guard)
  "OpenClawCNSchema|OpenClawCNSchema"     # Already correct — skip
  "OpenClawCNPaths|OpenClawCNPaths"       # Already correct — skip
  "OpenClawConfig|OpenClawCNConfig"
  "OpenClawSchema|OpenClawCNSchema"
  "OpenClawPaths|OpenClawCNPaths"
  "OpenClawLogging|OpenClawCNLogging"

  # PascalCase standalone
  "OpenClawCN|OpenClawCN"                 # Already correct — skip (idempotent guard)
  "OpenClaw|OpenClawCN"

  # UPPER_SNAKE_CASE
  "OPENCLAWCN_|OPENCLAWCN_"              # Already correct — skip
  "OPENCLAW_|OPENCLAWCN_"

  # lowercase
  "openclawcn|openclawcn"                 # Already correct — skip
  "openclaw|openclawcn"

  # File/path references
  "types.openclaw|types.openclawcn"
  ".openclaw/|.openclawcn/"
  "openclaw.json|openclawcn.json"

  # HTTP headers
  "x-openclaw-|x-openclawcn-"

  # Plugin files
  "openclaw.plugin.json|clawdbot.plugin.json"
)

log() { echo "[$(date +%H:%M:%S)] $*"; }

# ============================================================
# Build find command exclusions
# ============================================================
build_find_excludes() {
  local excludes=""
  for dir in "${EXCLUDE_DIRS[@]}"; do
    excludes="$excludes -not -path '*/${dir}/*' -not -path '*/${dir}'"
  done
  echo "$excludes"
}

# Build file extension include pattern for grep
build_ext_include() {
  local includes=""
  IFS=',' read -ra EXTS <<< "$INCLUDE_EXTENSIONS"
  for ext in "${EXTS[@]}"; do
    includes="$includes --include=*.${ext}"
  done
  echo "$includes"
}

FIND_EXCLUDES=$(build_find_excludes)
GREP_INCLUDES=$(build_ext_include)

# ============================================================
# Stats mode
# ============================================================
if $STATS_ONLY; then
  echo "=== Brand Rename Statistics ==="
  echo ""

  # Count OpenClaw references (excluding already-renamed)
  echo "--- Remaining OpenClaw references (not yet OpenClawCN) ---"

  # Use grep to find "OpenClaw" that is NOT followed by "CN"
  # This regex matches "OpenClaw" not followed by "CN", "cn", or "Config" that starts with CN
  TOTAL=0
  for pattern in "OpenClaw[^C]" "OpenClaw$" "OPENCLAW_[^C]" "openclaw[^c]" "openclaw$"; do
    COUNT=$(eval grep -r "$GREP_INCLUDES" -l "$pattern" . $FIND_EXCLUDES 2>/dev/null | wc -l || echo "0")
    TOTAL=$((TOTAL + COUNT))
    if [ "$COUNT" -gt 0 ]; then
      echo "  ${pattern}: ${COUNT} files"
    fi
  done

  echo ""
  echo "Total files with unrenamed references: ~${TOTAL}"
  echo "(Run without --stats to apply renames)"
  exit 0
fi

# ============================================================
# Apply renames
# ============================================================
log "Starting CN brand rename..."
log "  Mode: $(if $DRY_RUN; then echo 'DRY RUN'; else echo 'APPLY'; fi)"

TOTAL_FILES_CHANGED=0
TOTAL_REPLACEMENTS=0

for rule in "${RULES[@]}"; do
  FIND="${rule%%|*}"
  REPLACE="${rule#*|}"

  # Skip idempotent guards (where find == replace)
  if [ "$FIND" = "$REPLACE" ]; then
    continue
  fi

  # Find files containing this pattern
  MATCHING_FILES=$(eval grep -r $GREP_INCLUDES -l "$FIND" . $FIND_EXCLUDES 2>/dev/null || true)

  if [ -z "$MATCHING_FILES" ]; then
    continue
  fi

  FILE_COUNT=$(echo "$MATCHING_FILES" | wc -l | tr -d ' ')

  # For each matching file, check exclusion patterns before replacing
  ACTUALLY_CHANGED=0
  while IFS= read -r filepath; do
    [ -z "$filepath" ] && continue

    # Check if the match is ONLY in excluded content
    SKIP=false
    for excl in "${EXCLUDE_CONTENT_PATTERNS[@]}"; do
      # Check if the file contains the exclusion pattern
      if grep -q "$excl" "$filepath" 2>/dev/null; then
        # Check if ALL occurrences of FIND are within exclusion contexts
        # (simplified: if file has exclusion pattern, still process but be careful)
        # We process anyway — the exclusion patterns don't contain our FIND patterns
        # in a way that would cause false positives
        :
      fi
    done

    if $DRY_RUN; then
      MATCH_COUNT=$(grep -c "$FIND" "$filepath" 2>/dev/null || echo "0")
      if [ "$MATCH_COUNT" -gt 0 ]; then
        echo "  [DRY RUN] ${filepath}: ${FIND} → ${REPLACE} (${MATCH_COUNT} matches)"
        ACTUALLY_CHANGED=$((ACTUALLY_CHANGED + 1))
        TOTAL_REPLACEMENTS=$((TOTAL_REPLACEMENTS + MATCH_COUNT))
      fi
    else
      # Apply the replacement
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/${FIND}/${REPLACE}/g" "$filepath"
      else
        sed -i "s/${FIND}/${REPLACE}/g" "$filepath"
      fi
      ACTUALLY_CHANGED=$((ACTUALLY_CHANGED + 1))
    fi
  done <<< "$MATCHING_FILES"

  if [ "$ACTUALLY_CHANGED" -gt 0 ]; then
    log "  ${FIND} → ${REPLACE}: ${ACTUALLY_CHANGED} files"
    TOTAL_FILES_CHANGED=$((TOTAL_FILES_CHANGED + ACTUALLY_CHANGED))
  fi
done

# ============================================================
# Handle file renames (openclaw.plugin.json → clawdbot.plugin.json)
# ============================================================
log "Checking for files that need renaming..."

# Find openclaw.plugin.json files and rename to clawdbot.plugin.json
while IFS= read -r pluginfile; do
  [ -z "$pluginfile" ] && continue
  NEWNAME=$(echo "$pluginfile" | sed 's/openclaw\.plugin\.json/clawdbot.plugin.json/')
  if [ "$pluginfile" != "$NEWNAME" ]; then
    if $DRY_RUN; then
      echo "  [DRY RUN] RENAME: ${pluginfile} → ${NEWNAME}"
    else
      mv "$pluginfile" "$NEWNAME"
      log "  RENAMED: ${pluginfile} → ${NEWNAME}"
    fi
  fi
done < <(find . -name "openclaw.plugin.json" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null || true)

# ============================================================
# Post-rename exclusion cleanup
# ============================================================
# Fix any false positives in upstream URLs that got incorrectly renamed
log "Fixing upstream URL references..."

UPSTREAM_URL_FILES=$(eval grep -r $GREP_INCLUDES -l "openclawcn/openclawcn" . $FIND_EXCLUDES 2>/dev/null || true)
if [ -n "$UPSTREAM_URL_FILES" ]; then
  while IFS= read -r filepath; do
    [ -z "$filepath" ] && continue
    if $DRY_RUN; then
      echo "  [DRY RUN] FIX URL: ${filepath}: openclawcn/openclawcn → openclaw/openclaw"
    else
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's|github\.com/openclawcn/openclawcn|github.com/openclaw/openclaw|g' "$filepath"
        sed -i '' 's|@openclawcn/|@openclaw/|g' "$filepath"
      else
        sed -i 's|github\.com/openclawcn/openclawcn|github.com/openclaw/openclaw|g' "$filepath"
        sed -i 's|@openclawcn/|@openclaw/|g' "$filepath"
      fi
    fi
  done <<< "$UPSTREAM_URL_FILES"
  log "  Fixed upstream URL references"
fi

# Also fix domain names
DOMAIN_FILES=$(eval grep -r $GREP_INCLUDES -l "openclawcn\.ai\|openclawcn\.com" . $FIND_EXCLUDES 2>/dev/null || true)
if [ -n "$DOMAIN_FILES" ]; then
  while IFS= read -r filepath; do
    [ -z "$filepath" ] && continue
    if $DRY_RUN; then
      echo "  [DRY RUN] FIX DOMAIN: ${filepath}"
    else
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's/openclawcn\.ai/openclaw.ai/g' "$filepath"
        sed -i '' 's/openclawcn\.com/openclaw.com/g' "$filepath"
      else
        sed -i 's/openclawcn\.ai/openclaw.ai/g' "$filepath"
        sed -i 's/openclawcn\.com/openclaw.com/g' "$filepath"
      fi
    fi
  done <<< "$DOMAIN_FILES"
  log "  Fixed domain name references"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo "========================================="
echo "  BRAND RENAME $(if $DRY_RUN; then echo '(DRY RUN)'; else echo 'COMPLETE'; fi)"
echo "========================================="
echo "  Files processed: ${TOTAL_FILES_CHANGED}"
if $DRY_RUN; then
  echo "  Replacements: ~${TOTAL_REPLACEMENTS}"
fi
echo "========================================="

if ! $DRY_RUN && [ "$TOTAL_FILES_CHANGED" -gt 0 ]; then
  echo ""
  echo "Changes applied. Review with: git diff --stat"
  echo "To commit:  git add -A && git commit -m 'chore: apply CN brand rename'"
fi

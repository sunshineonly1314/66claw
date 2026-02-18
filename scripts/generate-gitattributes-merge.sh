#!/usr/bin/env bash
# ============================================================
# Generate .gitattributes merge=ours rules from cn-protected-files.json
#
# Usage: bash scripts/generate-gitattributes-merge.sh
#
# This reads config/cn-protected-files.json and appends merge
# protection rules to .gitattributes. Idempotent — it replaces
# the CN block if it already exists.
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${REPO_ROOT}/config/cn-protected-files.json"
GITATTR="${REPO_ROOT}/.gitattributes"

if [ ! -f "$CONFIG" ]; then
  echo "ERROR: $CONFIG not found"
  exit 1
fi

# Check for jq
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not installed."
  echo "Install: brew install jq / apt install jq / choco install jq"
  exit 1
fi

# --- Remove existing CN block ---
MARKER_START="# === CN MERGE PROTECTION START ==="
MARKER_END="# === CN MERGE PROTECTION END ==="

if grep -q "$MARKER_START" "$GITATTR" 2>/dev/null; then
  # Remove everything between markers (inclusive)
  sed -i "/$MARKER_START/,/$MARKER_END/d" "$GITATTR"
fi

# --- Generate new block ---
{
  echo ""
  echo "$MARKER_START"
  echo "# Auto-generated from config/cn-protected-files.json"
  echo "# Regenerate: bash scripts/generate-gitattributes-merge.sh"
  echo "# When merging upstream/main, these files keep the CN version."
  echo ""

  echo "# --- Section I: CN-Only Files (always keep ours) ---"

  # Individual files
  jq -r '.section1_cn_only.files[]' "$CONFIG" | while read -r f; do
    echo "$f merge=ours"
  done

  echo ""
  echo "# --- Section I: CN-Only Directories ---"

  # Directories (use ** glob)
  jq -r '.section1_cn_only.directories[]' "$CONFIG" | while read -r d; do
    # Ensure trailing ** for glob
    d="${d%/}"
    echo "${d}/** merge=ours"
  done

  echo ""
  echo "$MARKER_END"
} >> "$GITATTR"

echo "Done. .gitattributes updated with CN merge protection rules."
RULE_COUNT=$(grep -c "merge=ours" "$GITATTR" || true)
echo "Total merge=ours rules: ${RULE_COUNT}"

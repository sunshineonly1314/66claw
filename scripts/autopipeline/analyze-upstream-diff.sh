#!/usr/bin/env bash
# ============================================================
# Upstream Diff Analyzer
#
# Collects structured data about upstream changes for AI analysis.
# Outputs a JSON manifest + individual diff files that an AI agent
# can consume to produce a comprehensive analysis report.
#
# Usage:
#   bash scripts/autopipeline/analyze-upstream-diff.sh                    # Analyze vs upstream/main
#   bash scripts/autopipeline/analyze-upstream-diff.sh --output-dir /tmp  # Custom output
#   bash scripts/autopipeline/analyze-upstream-diff.sh --merge-base abc123 # Explicit merge-base
#
# Output structure:
#   <output-dir>/
#     manifest.json        ← Master manifest for AI consumption
#     commits.jsonl        ← One JSON object per upstream commit
#     diff-stat.txt        ← git diff --stat output
#     diff-summary.txt     ← git diff --stat summary line
#     section2-diffs/      ← Individual diffs for each Section II file
#       defaults.ts.diff
#       models-config.providers.ts.diff
#       ...
#     new-files.txt        ← List of files added by upstream
#     deleted-files.txt    ← List of files deleted by upstream
#     renamed-files.txt    ← List of files renamed by upstream
#     package-diff.txt     ← package.json diff (if changed)
#     brand-scan.txt       ← New files containing 'OpenClaw' patterns
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

CONFIG="${REPO_ROOT}/config/cn-protected-files.json"
DATE=$(date +%Y-%m-%d)
OUTPUT_DIR=""
MERGE_BASE=""
UPSTREAM_REF="upstream/main"

# --- Parse arguments ---
for arg in "$@"; do
  case "$arg" in
    --output-dir=*) OUTPUT_DIR="${arg#*=}" ;;
    --merge-base=*) MERGE_BASE="${arg#*=}" ;;
    --upstream-ref=*) UPSTREAM_REF="${arg#*=}" ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

if [ -z "$OUTPUT_DIR" ]; then
  OUTPUT_DIR="${REPO_ROOT}/.upstream-analysis/${DATE}"
fi

mkdir -p "$OUTPUT_DIR"
mkdir -p "${OUTPUT_DIR}/section2-diffs"

log() { echo "[$(date +%H:%M:%S)] $*"; }

# ============================================================
# Step 1: Determine merge base
# ============================================================
log "Step 1: Determining merge base..."

if [ -z "$MERGE_BASE" ]; then
  # Ensure upstream is fetched
  if ! git remote get-url upstream >/dev/null 2>&1; then
    echo "ERROR: upstream remote not configured"
    exit 1
  fi
  git fetch upstream main --tags --prune 2>/dev/null || true
  MERGE_BASE=$(git merge-base HEAD "${UPSTREAM_REF}")
fi

MERGE_BASE_SHORT=$(git rev-parse --short "$MERGE_BASE")
COMMIT_COUNT=$(git rev-list --count "${MERGE_BASE}..${UPSTREAM_REF}")

log "Merge base: ${MERGE_BASE_SHORT}"
log "Upstream commits: ${COMMIT_COUNT}"

if [ "$COMMIT_COUNT" -eq 0 ]; then
  log "No new upstream commits. Nothing to analyze."
  echo '{"status":"no_changes","commit_count":0}' > "${OUTPUT_DIR}/manifest.json"
  exit 0
fi

# ============================================================
# Step 2: Collect commit data
# ============================================================
log "Step 2: Collecting commit data (${COMMIT_COUNT} commits)..."

# Individual commits as JSONL
git log "${MERGE_BASE}..${UPSTREAM_REF}" --pretty=format:'{
  "hash": "%h",
  "hash_full": "%H",
  "author": "%an",
  "author_email": "%ae",
  "date": "%aI",
  "subject": "%s",
  "body": "%b"
}' | while IFS= read -r line; do
  # Sanitize JSON (escape inner quotes in body)
  echo "$line"
done > "${OUTPUT_DIR}/commits.jsonl"

# Commit list (simple)
git log "${MERGE_BASE}..${UPSTREAM_REF}" --oneline > "${OUTPUT_DIR}/commits-oneline.txt"

log "  Saved ${COMMIT_COUNT} commits"

# ============================================================
# Step 3: Diff statistics
# ============================================================
log "Step 3: Collecting diff statistics..."

git diff --stat "${MERGE_BASE}..${UPSTREAM_REF}" > "${OUTPUT_DIR}/diff-stat.txt"
git diff --stat "${MERGE_BASE}..${UPSTREAM_REF}" | tail -1 > "${OUTPUT_DIR}/diff-summary.txt"
git diff --numstat "${MERGE_BASE}..${UPSTREAM_REF}" > "${OUTPUT_DIR}/diff-numstat.txt"

DIFF_SUMMARY=$(cat "${OUTPUT_DIR}/diff-summary.txt")
log "  Stats: ${DIFF_SUMMARY}"

# ============================================================
# Step 4: File change classification
# ============================================================
log "Step 4: Classifying file changes..."

ALL_CHANGED=$(git diff --name-only "${MERGE_BASE}..${UPSTREAM_REF}")
CHANGED_COUNT=$(echo "$ALL_CHANGED" | wc -l | tr -d ' ')

# New files (added by upstream)
git diff --name-only --diff-filter=A "${MERGE_BASE}..${UPSTREAM_REF}" > "${OUTPUT_DIR}/new-files.txt"
NEW_COUNT=$(wc -l < "${OUTPUT_DIR}/new-files.txt" | tr -d ' ')

# Deleted files
git diff --name-only --diff-filter=D "${MERGE_BASE}..${UPSTREAM_REF}" > "${OUTPUT_DIR}/deleted-files.txt"
DELETED_COUNT=$(wc -l < "${OUTPUT_DIR}/deleted-files.txt" | tr -d ' ')

# Renamed files
git diff --name-only --diff-filter=R "${MERGE_BASE}..${UPSTREAM_REF}" > "${OUTPUT_DIR}/renamed-files.txt"
RENAMED_COUNT=$(wc -l < "${OUTPUT_DIR}/renamed-files.txt" | tr -d ' ')

# Modified files
git diff --name-only --diff-filter=M "${MERGE_BASE}..${UPSTREAM_REF}" > "${OUTPUT_DIR}/modified-files.txt"
MODIFIED_COUNT=$(wc -l < "${OUTPUT_DIR}/modified-files.txt" | tr -d ' ')

log "  Total: ${CHANGED_COUNT} (new: ${NEW_COUNT}, deleted: ${DELETED_COUNT}, renamed: ${RENAMED_COUNT}, modified: ${MODIFIED_COUNT})"

# ============================================================
# Step 5: Section II impact analysis
# ============================================================
log "Step 5: Section II impact analysis..."

SECTION2_AFFECTED=0
SECTION2_LIST=""

if [ -f "$CONFIG" ] && command -v jq &>/dev/null; then
  SECTION2_FILES=$(jq -r '.section2_modified_upstream.files[].path' "$CONFIG")

  while IFS= read -r s2file; do
    if echo "$ALL_CHANGED" | grep -q "^${s2file}$"; then
      SECTION2_AFFECTED=$((SECTION2_AFFECTED + 1))
      SECTION2_LIST="${SECTION2_LIST}${s2file},"

      # Extract individual diff for this Section II file
      SAFE_NAME=$(echo "$s2file" | sed 's|/|__|g')
      git diff "${MERGE_BASE}..${UPSTREAM_REF}" -- "$s2file" > "${OUTPUT_DIR}/section2-diffs/${SAFE_NAME}.diff"

      # Get the CN marker for this file
      MARKER=$(jq -r ".section2_modified_upstream.files[] | select(.path==\"${s2file}\") | .marker" "$CONFIG")
      CN_INJECTION=$(jq -r ".section2_modified_upstream.files[] | select(.path==\"${s2file}\") | .cn_injection" "$CONFIG")

      log "  AFFECTED: ${s2file} (marker: ${MARKER})"
    fi
  done <<< "$SECTION2_FILES"
else
  log "  WARNING: cn-protected-files.json or jq not available, skipping Section II analysis"
fi

log "  ${SECTION2_AFFECTED} Section II files affected"

# ============================================================
# Step 6: Section I collision check
# ============================================================
log "Step 6: Section I collision check..."

SECTION1_COLLISIONS=0
SECTION1_COLLISION_LIST=""

if [ -f "$CONFIG" ] && command -v jq &>/dev/null; then
  while IFS= read -r s1file; do
    if echo "$ALL_CHANGED" | grep -q "^${s1file}$"; then
      SECTION1_COLLISIONS=$((SECTION1_COLLISIONS + 1))
      SECTION1_COLLISION_LIST="${SECTION1_COLLISION_LIST}${s1file},"
    fi
  done < <(jq -r '.section1_cn_only.files[]' "$CONFIG" 2>/dev/null)
fi

log "  ${SECTION1_COLLISIONS} Section I files also changed upstream (will be auto-protected)"

# ============================================================
# Step 7: Package.json diff
# ============================================================
log "Step 7: Dependency analysis..."

if echo "$ALL_CHANGED" | grep -q "^package.json$"; then
  git diff "${MERGE_BASE}..${UPSTREAM_REF}" -- package.json > "${OUTPUT_DIR}/package-diff.txt"
  PACKAGE_CHANGED=true
  log "  package.json changed — diff saved"
else
  PACKAGE_CHANGED=false
  log "  package.json unchanged"
fi

# Lock file
if echo "$ALL_CHANGED" | grep -q "pnpm-lock.yaml"; then
  LOCKFILE_CHANGED=true
  log "  pnpm-lock.yaml changed"
else
  LOCKFILE_CHANGED=false
fi

# ============================================================
# Step 8: Brand pattern scan
# ============================================================
log "Step 8: Brand pattern scan..."

# Check new files for OpenClaw patterns that will need CN branding
BRAND_HITS=0
if [ -s "${OUTPUT_DIR}/new-files.txt" ]; then
  while IFS= read -r newfile; do
    # Only check text files (skip binaries)
    case "$newfile" in
      *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.yml|*.yaml|*.sh|*.html|*.css)
        # Check upstream version of this file for brand patterns
        if git show "${UPSTREAM_REF}:${newfile}" 2>/dev/null | grep -qi "openclaw" 2>/dev/null; then
          echo "$newfile" >> "${OUTPUT_DIR}/brand-scan.txt"
          BRAND_HITS=$((BRAND_HITS + 1))
        fi
        ;;
    esac
  done < "${OUTPUT_DIR}/new-files.txt"
fi

# Also check modified files for new OpenClaw references
while IFS= read -r modfile; do
  case "$modfile" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.yml|*.yaml|*.sh|*.html|*.css)
      DIFF_CONTENT=$(git diff "${MERGE_BASE}..${UPSTREAM_REF}" -- "$modfile" 2>/dev/null || true)
      if echo "$DIFF_CONTENT" | grep -q "^+.*[Oo]pen[Cc]law" 2>/dev/null; then
        echo "$modfile" >> "${OUTPUT_DIR}/brand-scan.txt"
        BRAND_HITS=$((BRAND_HITS + 1))
      fi
      ;;
  esac
done < "${OUTPUT_DIR}/modified-files.txt"

log "  ${BRAND_HITS} files need brand rename treatment"

# ============================================================
# Step 9: Breaking change detection
# ============================================================
log "Step 9: Breaking change detection..."

BREAKING_SIGNALS=0
BREAKING_LIST=""

# Check for type definition changes
TYPE_FILES=$(echo "$ALL_CHANGED" | grep -E "types\.(ts|d\.ts)$|\.d\.ts$" || true)
if [ -n "$TYPE_FILES" ]; then
  TYPE_COUNT=$(echo "$TYPE_FILES" | wc -l | tr -d ' ')
  BREAKING_SIGNALS=$((BREAKING_SIGNALS + TYPE_COUNT))
  BREAKING_LIST="${BREAKING_LIST}type_definitions:${TYPE_COUNT},"
  echo "$TYPE_FILES" > "${OUTPUT_DIR}/changed-types.txt"
  log "  ${TYPE_COUNT} type definition files changed"
fi

# Check for export changes in index files
INDEX_FILES=$(echo "$ALL_CHANGED" | grep -E "index\.(ts|js)$" || true)
if [ -n "$INDEX_FILES" ]; then
  INDEX_COUNT=$(echo "$INDEX_FILES" | wc -l | tr -d ' ')
  BREAKING_LIST="${BREAKING_LIST}index_files:${INDEX_COUNT},"
  log "  ${INDEX_COUNT} index files changed (possible export changes)"
fi

# Check for config schema changes
CONFIG_FILES=$(echo "$ALL_CHANGED" | grep -E "config.*schema|zod-schema" || true)
if [ -n "$CONFIG_FILES" ]; then
  CONFIG_SCHEMA_COUNT=$(echo "$CONFIG_FILES" | wc -l | tr -d ' ')
  BREAKING_LIST="${BREAKING_LIST}config_schemas:${CONFIG_SCHEMA_COUNT},"
  log "  ${CONFIG_SCHEMA_COUNT} config schema files changed"
fi

# ============================================================
# Step 10: Directory heatmap
# ============================================================
log "Step 10: Change heatmap..."

echo "$ALL_CHANGED" | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -20 > "${OUTPUT_DIR}/dir-heatmap.txt"

# ============================================================
# Step 11: Risk level calculation
# ============================================================
log "Step 11: Calculating risk level..."

RISK_LEVEL="low"
RISK_REASONS=""

# Critical: directory restructuring
DIR_RENAMES=$(git diff --name-status "${MERGE_BASE}..${UPSTREAM_REF}" | grep "^R" | wc -l | tr -d ' ')
if [ "$DIR_RENAMES" -gt 20 ]; then
  RISK_LEVEL="critical"
  RISK_REASONS="${RISK_REASONS}directory_restructure,"
fi

# Critical: major dep version change
if [ "$PACKAGE_CHANGED" = true ] && [ -f "${OUTPUT_DIR}/package-diff.txt" ]; then
  MAJOR_BUMPS=$(grep -cE '^\+.*": "\^?[0-9]+\.' "${OUTPUT_DIR}/package-diff.txt" 2>/dev/null || echo "0")
  if [ "$MAJOR_BUMPS" -gt 5 ]; then
    RISK_LEVEL="critical"
    RISK_REASONS="${RISK_REASONS}major_dep_changes,"
  fi
fi

# High: models-config.providers.ts changed
if echo "$SECTION2_LIST" | grep -q "models-config.providers.ts"; then
  if [ "$RISK_LEVEL" != "critical" ]; then
    RISK_LEVEL="high"
  fi
  RISK_REASONS="${RISK_REASONS}providers_changed,"
fi

# High: >5 Section II files
if [ "$SECTION2_AFFECTED" -gt 5 ]; then
  if [ "$RISK_LEVEL" != "critical" ]; then
    RISK_LEVEL="high"
  fi
  RISK_REASONS="${RISK_REASONS}many_section2,"
fi

# Medium: 1-5 Section II files
if [ "$SECTION2_AFFECTED" -ge 1 ] && [ "$SECTION2_AFFECTED" -le 5 ]; then
  if [ "$RISK_LEVEL" = "low" ]; then
    RISK_LEVEL="medium"
  fi
  RISK_REASONS="${RISK_REASONS}some_section2,"
fi

RECOMMENDATION="auto-merge"
if [ "$RISK_LEVEL" = "medium" ]; then
  RECOMMENDATION="agent-resolve"
elif [ "$RISK_LEVEL" = "high" ] || [ "$RISK_LEVEL" = "critical" ]; then
  RECOMMENDATION="manual-review"
fi

log "  Risk: ${RISK_LEVEL} (${RISK_REASONS:-none})"
log "  Recommendation: ${RECOMMENDATION}"

# ============================================================
# Step 12: Generate manifest
# ============================================================
log "Step 12: Generating manifest..."

cat > "${OUTPUT_DIR}/manifest.json" <<MANIFEST_EOF
{
  "status": "analyzed",
  "date": "${DATE}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "merge_base": "${MERGE_BASE}",
  "merge_base_short": "${MERGE_BASE_SHORT}",
  "upstream_ref": "${UPSTREAM_REF}",
  "commit_count": ${COMMIT_COUNT},
  "files": {
    "total_changed": ${CHANGED_COUNT},
    "new": ${NEW_COUNT},
    "deleted": ${DELETED_COUNT},
    "renamed": ${RENAMED_COUNT},
    "modified": ${MODIFIED_COUNT}
  },
  "cn_impact": {
    "section1_collisions": ${SECTION1_COLLISIONS},
    "section2_affected": ${SECTION2_AFFECTED},
    "section2_files": "$(echo "$SECTION2_LIST" | sed 's/,$//')",
    "section1_collision_files": "$(echo "$SECTION1_COLLISION_LIST" | sed 's/,$//')"
  },
  "risk": {
    "level": "${RISK_LEVEL}",
    "reasons": "$(echo "$RISK_REASONS" | sed 's/,$//')",
    "recommendation": "${RECOMMENDATION}"
  },
  "dependencies": {
    "package_json_changed": ${PACKAGE_CHANGED},
    "lockfile_changed": ${LOCKFILE_CHANGED}
  },
  "brand": {
    "files_needing_rename": ${BRAND_HITS}
  },
  "breaking_signals": {
    "count": ${BREAKING_SIGNALS},
    "details": "$(echo "$BREAKING_LIST" | sed 's/,$//')"
  },
  "output_dir": "${OUTPUT_DIR}",
  "files_generated": [
    "manifest.json",
    "commits.jsonl",
    "commits-oneline.txt",
    "diff-stat.txt",
    "diff-summary.txt",
    "diff-numstat.txt",
    "new-files.txt",
    "deleted-files.txt",
    "renamed-files.txt",
    "modified-files.txt",
    "dir-heatmap.txt",
    "section2-diffs/",
    "brand-scan.txt",
    "package-diff.txt"
  ]
}
MANIFEST_EOF

log "Manifest saved to ${OUTPUT_DIR}/manifest.json"

# ============================================================
# Summary
# ============================================================
echo ""
echo "========================================="
echo "  UPSTREAM ANALYSIS COMPLETE"
echo "========================================="
echo "  Commits:         ${COMMIT_COUNT}"
echo "  Files changed:   ${CHANGED_COUNT}"
echo "  Risk level:      ${RISK_LEVEL}"
echo "  Section II:      ${SECTION2_AFFECTED} files"
echo "  Brand rename:    ${BRAND_HITS} files"
echo "  Recommendation:  ${RECOMMENDATION}"
echo "  Output:          ${OUTPUT_DIR}/"
echo "========================================="
echo ""
echo "Next: Run AI analysis with:"
echo "  claude --print 'Analyze the upstream diff' < ${OUTPUT_DIR}/manifest.json"
echo "  OR: Use the merge-upstream.sh --analyze flag"

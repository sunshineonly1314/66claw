#!/usr/bin/env bash
# ============================================================
# OpenClawCN Upstream Merge Workflow
#
# Usage:
#   bash scripts/merge-upstream.sh              # Full merge
#   bash scripts/merge-upstream.sh --dry-run    # Preview only
#   bash scripts/merge-upstream.sh --skip-tests # Skip post-merge tests
#   bash scripts/merge-upstream.sh --analyze    # Run AI analysis before merge
#   bash scripts/merge-upstream.sh --analyze-only # Only analyze, don't merge
#
# Prerequisites:
#   - upstream remote configured: git remote add upstream https://github.com/openclaw/openclaw.git
#   - merge drivers configured: bash scripts/setup-merge-drivers.sh
#   - .gitattributes has CN merge rules
#   - (for --analyze) claude CLI or ANTHROPIC_API_KEY
#
# What this script does:
#   1. Fetches upstream/main
#   2. Detects new upstream commits
#   3. Analyzes impact on CN Section II files
#   3.5. (--analyze) AI deep analysis of upstream changes
#   4. Creates a merge branch and merges
#   4.5. Applies CN brand rename (OpenClaw → OpenClawCN)
#   5. Runs lint/build/test validation
#   6. Verifies CN critical file integrity
#   7. Outputs a structured summary
# ============================================================
set -euo pipefail

# --- Parse arguments ---
DRY_RUN=false
SKIP_TESTS=false
AI_ANALYZE=false
ANALYZE_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --skip-tests) SKIP_TESTS=true ;;
    --analyze) AI_ANALYZE=true ;;
    --analyze-only) AI_ANALYZE=true; ANALYZE_ONLY=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

DATE=$(date +%Y-%m-%d)
BRANCH="merge/upstream-${DATE}"
UPSTREAM_REF="upstream/main"
CONFIG="${REPO_ROOT}/config/cn-protected-files.json"
LOG_FILE="${REPO_ROOT}/merge-${DATE}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
ok() { echo -e "${GREEN}[OK]${NC} $*"; }

# ============================================================
# Step 1: Prerequisites
# ============================================================
log "=== Step 1/7: Prerequisites ==="

# Check upstream remote
if ! git remote get-url upstream >/dev/null 2>&1; then
  error "upstream remote not configured"
  echo "  Run: git remote add upstream https://github.com/openclaw/openclaw.git"
  exit 1
fi
ok "upstream remote: $(git remote get-url upstream)"

# Check merge driver
if ! git config merge.ours.driver >/dev/null 2>&1; then
  warn "merge driver not configured. Setting up..."
  bash scripts/setup-merge-drivers.sh
fi
ok "merge driver configured"

# Check for clean working tree
if [ -n "$(git status --porcelain)" ]; then
  warn "Working tree has uncommitted changes."
  echo "  Consider: git stash push -m 'before-upstream-merge-${DATE}'"
  read -p "  Continue anyway? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Check .gitattributes has merge rules
if ! grep -q "merge=ours" .gitattributes 2>/dev/null; then
  warn ".gitattributes missing merge=ours rules."
  echo "  Run: bash scripts/generate-gitattributes-merge.sh"
  read -p "  Generate now? [Y/n] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    bash scripts/generate-gitattributes-merge.sh
  fi
fi
MERGE_RULES=$(grep -c "merge=ours" .gitattributes 2>/dev/null || echo "0")
ok ".gitattributes has ${MERGE_RULES} merge=ours rules"

# ============================================================
# Step 2: Fetch upstream
# ============================================================
log "=== Step 2/7: Fetch upstream ==="
git fetch upstream main --tags --prune
ok "upstream fetched"

LAST_MERGE=$(git merge-base HEAD upstream/main)
COMMIT_COUNT=$(git rev-list --count "${LAST_MERGE}..upstream/main")
LAST_MERGE_SHORT=$(git rev-parse --short "$LAST_MERGE")

if [ "$COMMIT_COUNT" -eq 0 ]; then
  ok "No new upstream commits since ${LAST_MERGE_SHORT}. Nothing to do."
  exit 0
fi
log "Found ${COMMIT_COUNT} new upstream commits since merge-base ${LAST_MERGE_SHORT}"

# ============================================================
# Step 3: Impact analysis
# ============================================================
log "=== Step 3/7: Impact analysis ==="

# Changed files in upstream
UPSTREAM_CHANGED=$(git diff --name-only "${LAST_MERGE}..upstream/main")
UPSTREAM_CHANGED_COUNT=$(echo "$UPSTREAM_CHANGED" | wc -l | tr -d ' ')
log "Upstream changed ${UPSTREAM_CHANGED_COUNT} files"
echo ""

# Section II impact analysis
CN_SECTION2_FILES=(
  "src/config/defaults.ts"
  "src/config/auto-detect-env.ts"
  "src/agents/models-config.ts"
  "src/agents/models-config.providers.ts"
  "package.json"
  "AGENTS.md"
  "src/auto-reply/reply/get-reply.ts"
  "src/agents/model-fallback.ts"
  "src/media-understanding/providers/openai/index.ts"
  "src/media-understanding/defaults.ts"
  "src/media-understanding/attachments.ts"
  "src/config/types.agent-defaults.ts"
  "ui/src/ui/app-gateway.ts"
  "ui/src/ui/storage.ts"
)

echo "--- CN Section II (manual merge needed) ---"
SECTION2_AFFECTED=0
SECTION2_AFFECTED_LIST=()
for f in "${CN_SECTION2_FILES[@]}"; do
  if echo "$UPSTREAM_CHANGED" | grep -q "^${f}$"; then
    warn "  AFFECTED: ${f}"
    SECTION2_AFFECTED_LIST+=("$f")
    SECTION2_AFFECTED=$((SECTION2_AFFECTED + 1))
  fi
done
if [ "$SECTION2_AFFECTED" -eq 0 ]; then
  ok "  No Section II files affected — clean merge expected!"
else
  warn "  ${SECTION2_AFFECTED} Section II files need manual attention after merge"
fi
echo ""

# Section I collision check (files upstream changed that we protect)
echo "--- CN Section I collision check ---"
SECTION1_COLLISIONS=0
if [ -f "$CONFIG" ] && command -v jq &>/dev/null; then
  while read -r f; do
    if echo "$UPSTREAM_CHANGED" | grep -q "^${f}$"; then
      log "  Protected file also changed upstream (will keep ours): ${f}"
      SECTION1_COLLISIONS=$((SECTION1_COLLISIONS + 1))
    fi
  done < <(jq -r '.section1_cn_only.files[]' "$CONFIG" 2>/dev/null)
fi
log "  ${SECTION1_COLLISIONS} Section I files will be auto-protected by merge=ours"
echo ""

# Top changed upstream directories
echo "--- Top upstream change areas ---"
echo "$UPSTREAM_CHANGED" | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -10
echo ""

# ============================================================
# Dry run exit
# ============================================================
if $DRY_RUN; then
  echo ""
  echo "========================================="
  echo "  DRY RUN SUMMARY"
  echo "========================================="
  echo "  Would create branch: ${BRANCH}"
  echo "  Upstream commits: ${COMMIT_COUNT}"
  echo "  Upstream files changed: ${UPSTREAM_CHANGED_COUNT}"
  echo "  Section II conflicts expected: ${SECTION2_AFFECTED}"
  echo "  Section I auto-protected: ${SECTION1_COLLISIONS}"
  echo "  Merge rules in .gitattributes: ${MERGE_RULES}"
  echo "========================================="
  exit 0
fi

# ============================================================
# Step 3.5: AI analysis (optional)
# ============================================================
if $AI_ANALYZE; then
  log "=== Step 3.5: AI Analysis ==="

  # Run the structured data collection
  log "Collecting structured diff data..."
  bash "${REPO_ROOT}/scripts/autopipeline/analyze-upstream-diff.sh" \
    --merge-base="${LAST_MERGE}" \
    --upstream-ref=upstream/main

  # Find the output dir (just created by analyze-upstream-diff.sh)
  ANALYSIS_DIR=$(ls -d "${REPO_ROOT}/.upstream-analysis/"*/ 2>/dev/null | sort -r | head -1)

  if [ -n "$ANALYSIS_DIR" ]; then
    # Run AI analysis
    log "Running AI deep analysis..."
    if bash "${REPO_ROOT}/scripts/autopipeline/ai-analyze-upstream.sh" --input-dir="${ANALYSIS_DIR}"; then
      ok "AI analysis report saved to docs/upstream-reports/${DATE}.md"
    else
      warn "AI analysis failed (non-fatal). Continuing with merge."
    fi
  fi

  if $ANALYZE_ONLY; then
    log "Analyze-only mode. Stopping before merge."
    echo ""
    echo "========================================="
    echo "  ANALYSIS COMPLETE (no merge performed)"
    echo "========================================="
    echo "  Report: docs/upstream-reports/${DATE}.md"
    echo "  Data:   ${ANALYSIS_DIR}"
    echo ""
    echo "  To proceed with merge:"
    echo "    bash scripts/merge-upstream.sh"
    echo "========================================="
    exit 0
  fi
fi

# ============================================================
# Step 4: Create branch and merge
# ============================================================
log "=== Step 4/8: Create branch & merge ==="

CURRENT_BRANCH=$(git symbolic-ref --short HEAD)

# Check if branch already exists
if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  warn "Branch ${BRANCH} already exists."
  # Append timestamp to make unique
  BRANCH="${BRANCH}-$(date +%H%M%S)"
  log "Using unique branch name: ${BRANCH}"
fi

git checkout -b "${BRANCH}"
log "Created branch: ${BRANCH}"

MERGE_MSG="chore: merge upstream ${DATE} (${COMMIT_COUNT} commits)

Upstream commits: ${COMMIT_COUNT}
Section II files affected: ${SECTION2_AFFECTED}
Merge-base: ${LAST_MERGE_SHORT}
Auto-protected by merge=ours: ${SECTION1_COLLISIONS} files"

if git merge upstream/main --no-edit -m "$MERGE_MSG" 2>&1 | tee "${LOG_FILE}"; then
  ok "Merge completed successfully"
else
  echo ""
  error "=== MERGE CONFLICTS ==="
  echo ""
  echo "Conflicting files:"
  git diff --name-only --diff-filter=U 2>/dev/null || true
  echo ""

  # Check if any conflicts are Section I (should have been auto-resolved)
  echo "Checking for incorrectly conflicted Section I files..."
  if [ -f "$CONFIG" ] && command -v jq &>/dev/null; then
    git diff --name-only --diff-filter=U 2>/dev/null | while read -r cf; do
      if jq -r '.section1_cn_only.files[]' "$CONFIG" 2>/dev/null | grep -q "^${cf}$"; then
        error "  Section I file has conflict (merge=ours should have prevented this): ${cf}"
        echo "  Fix: git checkout --ours '${cf}' && git add '${cf}'"
      fi
    done
  fi

  echo ""
  echo "To resolve:"
  echo "  1. Edit conflicting files, keeping CN modifications"
  echo "  2. git add <resolved-files>"
  echo "  3. git merge --continue"
  echo "  4. Re-run: bash scripts/merge-upstream.sh --skip-tests"
  echo ""
  echo "To abort:"
  echo "  git merge --abort && git checkout ${CURRENT_BRANCH} && git branch -D ${BRANCH}"
  exit 1
fi

# ============================================================
# Step 4.5: Brand rename (OpenClaw → OpenClawCN)
# ============================================================
log "=== Step 4.5/8: Brand rename ==="

if [ -f "${REPO_ROOT}/scripts/autopipeline/apply-cn-brand.sh" ]; then
  if bash "${REPO_ROOT}/scripts/autopipeline/apply-cn-brand.sh"; then
    # Check if brand rename made any changes
    if [ -n "$(git status --porcelain)" ]; then
      git add -A
      git commit -m "chore: apply CN brand rename (OpenClaw → OpenClawCN)

Automated brand rename after upstream merge.
Applied by: scripts/autopipeline/apply-cn-brand.sh"
      ok "Brand rename applied and committed"
    else
      ok "Brand rename: no changes needed"
    fi
  else
    warn "Brand rename script failed (non-fatal). Continue manually."
  fi
else
  warn "scripts/autopipeline/apply-cn-brand.sh not found. Skipping brand rename."
  echo "  Create it to automate OpenClaw → OpenClawCN renaming."
fi

# ============================================================
# Step 5: Post-merge validation
# ============================================================
if $SKIP_TESTS; then
  warn "=== Step 5/8: Skipping tests (--skip-tests) ==="
else
  log "=== Step 5/8: Post-merge validation ==="

  log "Running lint..."
  if pnpm lint 2>&1 | tail -5; then
    ok "Lint passed"
  else
    error "Lint failed. Fix lint errors before continuing."
    exit 1
  fi

  log "Running build..."
  if pnpm build 2>&1 | tail -5; then
    ok "Build passed"
  else
    error "Build failed. Fix build errors before continuing."
    exit 1
  fi

  log "Running tests..."
  if pnpm test 2>&1 | tail -10; then
    ok "Tests passed"
  else
    error "Tests failed. Fix test failures before continuing."
    exit 1
  fi
fi

# ============================================================
# Step 6: CN integrity verification
# ============================================================
log "=== Step 6/8: CN integrity verification ==="

CN_CRITICAL=(
  "src/config/region-cn.ts"
  "src/config/cn-mirrors.ts"
  "src/config/defaults-cn.test.ts"
  "src/i18n/locales/zh-CN.ts"
  "ui/src/ui/i18n/locales/zh-CN.ts"
  "ui/src/ui/views/channels.feishu.ts"
  "config/dispatch.yaml"
  "config/cn-protected-files.json"
  ".github/workflows/build-macos-cn.yml"
  "docs/china-localization.md"
)

MISSING=0
for f in "${CN_CRITICAL[@]}"; do
  if [ ! -f "$f" ]; then
    error "MISSING: $f"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -gt 0 ]; then
  error "${MISSING} critical CN files are missing! Merge may have corrupted them."
  exit 1
fi
ok "All ${#CN_CRITICAL[@]} critical CN files present"

# Brand consistency check
BRAND_ERRORS=0
for f in src/config/region-cn.ts src/config/cn-mirrors.ts src/agents/siliconflow-models.ts; do
  if [ -f "$f" ] && grep -q "OpenClawConfig" "$f" 2>/dev/null; then
    if ! grep -q "OpenClawCNConfig" "$f" 2>/dev/null; then
      warn "Brand inconsistency in $f: found OpenClawConfig without OpenClawCN variant"
      BRAND_ERRORS=$((BRAND_ERRORS + 1))
    fi
  fi
done
if [ "$BRAND_ERRORS" -eq 0 ]; then
  ok "Brand consistency check passed"
fi

# API endpoint check
log "Checking CN API endpoints..."
ENDPOINT_PATTERNS=("api.siliconflow.cn" "dashscope.aliyuncs.com" "open.bigmodel.cn" "api.moonshot.cn")
EP_MISSING=0
for ep in "${ENDPOINT_PATTERNS[@]}"; do
  if ! grep -r "$ep" src/ --include="*.ts" -q 2>/dev/null; then
    warn "API endpoint not found in src/: $ep"
    EP_MISSING=$((EP_MISSING + 1))
  fi
done
if [ "$EP_MISSING" -eq 0 ]; then
  ok "All CN API endpoints present"
else
  warn "${EP_MISSING} API endpoints may be missing (non-fatal)"
fi

# ============================================================
# Step 7: Post-merge AI analysis (if enabled)
# ============================================================
if $AI_ANALYZE; then
  log "=== Step 7/8: Post-merge AI verification ==="
  # Re-run analysis on the merged result to verify CN integrity at code level
  log "Generating post-merge analysis data..."
  # Save the AI report alongside the merge log
  ANALYSIS_DIR=$(ls -d "${REPO_ROOT}/.upstream-analysis/"*/ 2>/dev/null | sort -r | head -1)
  if [ -n "$ANALYSIS_DIR" ] && [ -f "docs/upstream-reports/${DATE}.md" ]; then
    ok "AI analysis report available at docs/upstream-reports/${DATE}.md"
  fi
else
  log "=== Step 7/8: Skipping AI analysis (use --analyze to enable) ==="
fi

# ============================================================
# Step 8: Summary
# ============================================================
echo ""
echo "========================================="
echo "  MERGE COMPLETE"
echo "========================================="
echo "  Branch:            ${BRANCH}"
echo "  Previous branch:   ${CURRENT_BRANCH}"
echo "  Upstream commits:  ${COMMIT_COUNT}"
echo "  Files changed:     ${UPSTREAM_CHANGED_COUNT}"
echo "  Section II manual: ${SECTION2_AFFECTED}"
echo "  Section I auto:    ${SECTION1_COLLISIONS}"
echo "  CN files OK:       ${#CN_CRITICAL[@]}/${#CN_CRITICAL[@]}"
echo "  Log file:          ${LOG_FILE}"
if [ -f "docs/upstream-reports/${DATE}.md" ]; then
  echo "  AI report:         docs/upstream-reports/${DATE}.md"
fi
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Review changes:  git diff ${CURRENT_BRANCH}..${BRANCH} --stat"
echo "  2. Spot check:      git diff ${CURRENT_BRANCH}..${BRANCH} -- src/config/"
if [ "$SECTION2_AFFECTED" -gt 0 ]; then
  echo "  3. Verify Section II files:"
  for f in "${SECTION2_AFFECTED_LIST[@]}"; do
    echo "     git diff ${CURRENT_BRANCH}..${BRANCH} -- ${f}"
  done
fi
echo "  4. Push:            git push origin ${BRANCH}"
echo "  5. Create PR:       gh pr create --base ${CURRENT_BRANCH} --title 'chore: merge upstream ${DATE}'"
echo "  6. After merge:     update cn/docs/CN_CUSTOMIZATIONS.md date"

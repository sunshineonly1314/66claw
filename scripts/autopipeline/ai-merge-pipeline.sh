#!/usr/bin/env bash
# ============================================================
# AI-Powered Full Merge Pipeline
#
# THE SINGLE COMMAND that does everything:
#   fetch → analyze → merge → resolve conflicts → brand rename
#   → lint fix → build fix → test fix → review → commit → report
#
# Usage:
#   bash scripts/autopipeline/ai-merge-pipeline.sh                # Full auto pipeline
#   bash scripts/autopipeline/ai-merge-pipeline.sh --dry-run      # Preview only
#   bash scripts/autopipeline/ai-merge-pipeline.sh --no-push      # Don't push at end
#   bash scripts/autopipeline/ai-merge-pipeline.sh --max-fix-rounds=5
#
# Prerequisites:
#   - upstream remote configured
#   - claude CLI or ANTHROPIC_API_KEY
#   - pnpm, node 22+
#
# Exit codes:
#   0 = Success (all automated)
#   1 = Partial success (needs human for some files)
#   2 = Total failure (nothing could be merged)
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

DRY_RUN=false
NO_PUSH=false
MAX_FIX_ROUNDS=3
DATE=$(date +%Y-%m-%d)
PIPELINE_LOG="${REPO_ROOT}/.upstream-analysis/${DATE}/pipeline.log"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --no-push) NO_PUSH=true ;;
    --max-fix-rounds=*) MAX_FIX_ROUNDS="${arg#*=}" ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*" | tee -a "$PIPELINE_LOG" 2>/dev/null || echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
ok() { echo -e "${GREEN}[✓]${NC} $*" | tee -a "$PIPELINE_LOG" 2>/dev/null || echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*" | tee -a "$PIPELINE_LOG" 2>/dev/null || echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*" | tee -a "$PIPELINE_LOG" 2>/dev/null || echo -e "${RED}[✗]${NC} $*"; }
phase() { echo -e "\n${CYAN}══════════════════════════════════════════${NC}" | tee -a "$PIPELINE_LOG" 2>/dev/null; echo -e "${CYAN}  $*${NC}" | tee -a "$PIPELINE_LOG" 2>/dev/null; echo -e "${CYAN}══════════════════════════════════════════${NC}\n" | tee -a "$PIPELINE_LOG" 2>/dev/null; }

mkdir -p "$(dirname "$PIPELINE_LOG")"

# Track pipeline state
PIPELINE_STATE="started"
BRANCH=""
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "HEAD")
COMMIT_COUNT=0
MERGE_SUCCEEDED=false
CONFLICTS_RESOLVED=false
BRAND_RENAMED=false
LINT_PASSED=false
BUILD_PASSED=false
TESTS_PASSED=false
REPORT_GENERATED=false
FIXES_APPLIED=0

# Cleanup on failure
cleanup() {
  if [ "$PIPELINE_STATE" != "completed" ] && [ "$PIPELINE_STATE" != "started" ]; then
    echo ""
    warn "Pipeline interrupted at state: ${PIPELINE_STATE}"
    if [ -n "$BRANCH" ]; then
      echo "  Merge branch: ${BRANCH}"
      echo "  To abort: git merge --abort 2>/dev/null; git checkout ${CURRENT_BRANCH}; git branch -D ${BRANCH}"
    fi
  fi
}
trap cleanup EXIT

# ============================================================
# Phase 0: Prerequisites
# ============================================================
phase "Phase 0: Prerequisites"

# Check for AI capability
HAS_AI=false
if command -v claude &>/dev/null; then
  HAS_AI=true
  ok "Claude CLI available"
elif [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  HAS_AI=true
  ok "Anthropic API key configured"
else
  error "No Claude CLI or ANTHROPIC_API_KEY. AI features disabled."
  error "Install: npm install -g @anthropic-ai/claude-code"
  error "Or set: export ANTHROPIC_API_KEY=sk-ant-..."
  exit 2
fi

# Check upstream remote
if ! git remote get-url upstream >/dev/null 2>&1; then
  error "upstream remote not configured"
  echo "  Run: git remote add upstream https://github.com/openclaw/openclaw.git"
  exit 2
fi
ok "Upstream remote: $(git remote get-url upstream)"

# Check merge driver
if ! git config merge.ours.driver >/dev/null 2>&1; then
  log "Setting up merge drivers..."
  bash scripts/setup-merge-drivers.sh
fi
ok "Merge driver configured"

# Check clean working tree
if [ -n "$(git status --porcelain)" ]; then
  warn "Working tree has uncommitted changes."
  if $DRY_RUN; then
    log "  (dry-run mode, continuing)"
  else
    log "  Stashing changes..."
    git stash push -m "ai-merge-pipeline-${DATE}"
    ok "  Changes stashed"
  fi
fi

PIPELINE_STATE="prerequisites_done"

# ============================================================
# Phase 1: Fetch & Detect
# ============================================================
phase "Phase 1: Fetch & Detect"

git fetch upstream main --tags --prune 2>&1 | tail -3
ok "Upstream fetched"

LAST_MERGE=$(git merge-base HEAD upstream/main)
COMMIT_COUNT=$(git rev-list --count "${LAST_MERGE}..upstream/main")
LAST_MERGE_SHORT=$(git rev-parse --short "$LAST_MERGE")

if [ "$COMMIT_COUNT" -eq 0 ]; then
  ok "No new upstream commits since ${LAST_MERGE_SHORT}. Nothing to do."
  PIPELINE_STATE="completed"
  exit 0
fi

log "Found ${COMMIT_COUNT} new upstream commits since ${LAST_MERGE_SHORT}"
PIPELINE_STATE="detected"

# ============================================================
# Phase 2: AI Analysis
# ============================================================
phase "Phase 2: AI Analysis"

log "Collecting structured diff data..."
bash scripts/autopipeline/analyze-upstream-diff.sh \
  --merge-base="${LAST_MERGE}" \
  --upstream-ref=upstream/main 2>&1 | tail -5

ANALYSIS_DIR=$(ls -d "${REPO_ROOT}/.upstream-analysis/"*/ 2>/dev/null | sort -r | head -1)

if [ -n "$ANALYSIS_DIR" ] && [ -f "${ANALYSIS_DIR}/manifest.json" ]; then
  RISK_LEVEL=$(python3 -c "import json; print(json.load(open('${ANALYSIS_DIR}/manifest.json'))['risk']['level'])" 2>/dev/null || echo "unknown")
  RECOMMENDATION=$(python3 -c "import json; print(json.load(open('${ANALYSIS_DIR}/manifest.json'))['risk']['recommendation'])" 2>/dev/null || echo "unknown")
  SECTION2_AFFECTED=$(python3 -c "import json; print(json.load(open('${ANALYSIS_DIR}/manifest.json'))['cn_impact']['section2_affected'])" 2>/dev/null || echo "0")

  log "Risk level: ${RISK_LEVEL}"
  log "Recommendation: ${RECOMMENDATION}"
  log "Section II files affected: ${SECTION2_AFFECTED}"

  # Generate AI analysis report
  log "Generating AI analysis report..."
  if bash scripts/autopipeline/ai-analyze-upstream.sh --input-dir="${ANALYSIS_DIR}" 2>&1 | tail -3; then
    REPORT_GENERATED=true
    ok "AI report: docs/upstream-reports/${DATE}.md"
  else
    warn "AI report generation failed (non-fatal)"
  fi
else
  warn "Could not read analysis data"
  RISK_LEVEL="unknown"
fi

if $DRY_RUN; then
  echo ""
  echo "========================================="
  echo "  DRY RUN — would proceed with merge"
  echo "  Commits: ${COMMIT_COUNT}"
  echo "  Risk: ${RISK_LEVEL}"
  echo "========================================="
  PIPELINE_STATE="completed"
  exit 0
fi

PIPELINE_STATE="analyzed"

# ============================================================
# Phase 3: Merge
# ============================================================
phase "Phase 3: Merge"

BRANCH="merge/upstream-${DATE}"
if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  BRANCH="${BRANCH}-$(date +%H%M%S)"
fi

git checkout -b "${BRANCH}"
log "Created branch: ${BRANCH}"

MERGE_MSG="chore: merge upstream ${DATE} (${COMMIT_COUNT} commits)

Upstream commits: ${COMMIT_COUNT}
Risk level: ${RISK_LEVEL}
Section II affected: ${SECTION2_AFFECTED}
Merge-base: ${LAST_MERGE_SHORT}
Pipeline: ai-merge-pipeline"

if git merge upstream/main --no-edit -m "$MERGE_MSG" 2>&1 | tee -a "$PIPELINE_LOG"; then
  MERGE_SUCCEEDED=true
  CONFLICTS_RESOLVED=true
  ok "Merge completed cleanly (no conflicts)"
else
  MERGE_SUCCEEDED=false
  CONFLICT_COUNT=$(git diff --name-only --diff-filter=U 2>/dev/null | wc -l | tr -d ' ')
  warn "Merge has ${CONFLICT_COUNT} conflicts"

  # ============================================================
  # Phase 3.5: AI Conflict Resolution
  # ============================================================
  phase "Phase 3.5: AI Conflict Resolution"

  if bash scripts/autopipeline/agent-resolve-conflicts.sh 2>&1 | tee -a "$PIPELINE_LOG"; then
    CONFLICTS_RESOLVED=true
    MERGE_SUCCEEDED=true
    git commit --no-edit 2>/dev/null || git merge --continue 2>/dev/null || true
    ok "All conflicts resolved by AI"
  else
    REMAINING=$(git diff --name-only --diff-filter=U 2>/dev/null | wc -l | tr -d ' ')
    if [ "$REMAINING" -gt 0 ]; then
      error "AI could not resolve ${REMAINING} conflicts"
      echo ""
      echo "Unresolved files:"
      git diff --name-only --diff-filter=U 2>/dev/null | sed 's/^/  - /'
      echo ""
      echo "Manual resolution needed. Pipeline paused."
      echo "  After fixing: git add . && git merge --continue"
      echo "  Then re-run:  bash scripts/autopipeline/ai-merge-pipeline.sh --no-push"
      PIPELINE_STATE="conflicts_unresolved"
      exit 1
    else
      # All resolved even though script returned non-zero
      git commit --no-edit 2>/dev/null || git merge --continue 2>/dev/null || true
      CONFLICTS_RESOLVED=true
      MERGE_SUCCEEDED=true
    fi
  fi
fi

PIPELINE_STATE="merged"

# ============================================================
# Phase 4: Brand Rename
# ============================================================
phase "Phase 4: Brand Rename (OpenClaw → OpenClawCN)"

if [ -f scripts/autopipeline/apply-cn-brand.sh ]; then
  if bash scripts/autopipeline/apply-cn-brand.sh 2>&1 | tee -a "$PIPELINE_LOG"; then
    if [ -n "$(git status --porcelain)" ]; then
      git add -A
      git commit -m "chore: apply CN brand rename (OpenClaw → OpenClawCN)

Automated by ai-merge-pipeline after upstream merge."
      BRAND_RENAMED=true
      ok "Brand rename applied and committed"
    else
      ok "Brand rename: no changes needed"
      BRAND_RENAMED=true
    fi
  else
    warn "Brand rename failed (non-fatal)"
  fi
else
  warn "scripts/autopipeline/apply-cn-brand.sh not found"
fi

PIPELINE_STATE="brand_renamed"

# ============================================================
# Phase 5: Lint → Build → Test (with AI auto-fix loop)
# ============================================================
phase "Phase 5: Validate & Auto-Fix"

log "Running validation pipeline with auto-fix (max ${MAX_FIX_ROUNDS} rounds)..."

if bash scripts/autopipeline/agent-fix-failures.sh --max-rounds="${MAX_FIX_ROUNDS}" 2>&1 | tee -a "$PIPELINE_LOG"; then
  LINT_PASSED=true
  BUILD_PASSED=true
  TESTS_PASSED=true
  ok "All validations passed!"

  # Commit any fixes
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "fix: auto-fix lint/build/test failures after upstream merge

Automated by ai-merge-pipeline agent."
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
  fi
else
  # Try to determine what passed
  if pnpm lint 2>&1 >/dev/null; then LINT_PASSED=true; fi
  if pnpm build 2>&1 >/dev/null; then BUILD_PASSED=true; fi

  # Commit whatever fixes were applied
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "fix: partial auto-fix after upstream merge (some failures remain)

Automated by ai-merge-pipeline agent.
Note: Some lint/build/test failures still need manual attention."
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
  fi

  warn "Some validations still failing"
fi

PIPELINE_STATE="validated"

# ============================================================
# Phase 6: CN Integrity Verification
# ============================================================
phase "Phase 6: CN Integrity Check"

CN_CRITICAL=(
  "src/config/region-cn.ts"
  "src/config/cn-mirrors.ts"
  "src/i18n/locales/zh-CN.ts"
  "config/dispatch.yaml"
  "config/cn-protected-files.json"
)

MISSING=0
for f in "${CN_CRITICAL[@]}"; do
  if [ ! -f "$f" ]; then
    error "MISSING: $f"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -gt 0 ]; then
  error "${MISSING} critical CN files missing!"
else
  ok "All ${#CN_CRITICAL[@]} critical CN files present"
fi

PIPELINE_STATE="verified"

# ============================================================
# Phase 7: Push & Report
# ============================================================
phase "Phase 7: Push & Report"

ALL_PASSED=$($LINT_PASSED && $BUILD_PASSED && $TESTS_PASSED && echo true || echo false)

if ! $NO_PUSH; then
  log "Pushing branch ${BRANCH}..."
  git push origin "${BRANCH}" --force-with-lease 2>&1 | tail -3
  ok "Pushed to origin/${BRANCH}"
fi

# Save pipeline report
REPORT_FILE="${REPO_ROOT}/docs/upstream-reports/${DATE}-pipeline.md"
mkdir -p "$(dirname "$REPORT_FILE")"

cat > "$REPORT_FILE" <<REPORT_EOF
# AI Merge Pipeline Report — ${DATE}

## Pipeline Result

| Phase | Status |
|-------|--------|
| Fetch & Detect | ✓ ${COMMIT_COUNT} commits |
| AI Analysis | $(if $REPORT_GENERATED; then echo '✓ Report generated'; else echo '⚠ No report'; fi) |
| Merge | $(if $MERGE_SUCCEEDED; then echo '✓ Success'; else echo '✗ Failed'; fi) |
| Conflict Resolution | $(if $CONFLICTS_RESOLVED; then echo '✓ All resolved'; else echo '✗ Unresolved'; fi) |
| Brand Rename | $(if $BRAND_RENAMED; then echo '✓ Applied'; else echo '⚠ Skipped'; fi) |
| Lint | $(if $LINT_PASSED; then echo '✓ Passed'; else echo '✗ Failed'; fi) |
| Build | $(if $BUILD_PASSED; then echo '✓ Passed'; else echo '✗ Failed'; fi) |
| Tests | $(if $TESTS_PASSED; then echo '✓ Passed'; else echo '✗ Failed'; fi) |
| CN Integrity | $(if [ "$MISSING" -eq 0 ]; then echo '✓ All files present'; else echo "✗ ${MISSING} files missing"; fi) |

## Details

- **Branch**: \`${BRANCH}\`
- **Base branch**: \`${CURRENT_BRANCH}\`
- **Upstream commits**: ${COMMIT_COUNT}
- **Risk level**: ${RISK_LEVEL}
- **Fixes auto-applied**: ${FIXES_APPLIED}
- **Generated**: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Next Steps

$(if $ALL_PASSED; then
  echo "All checks passed! Create a PR:"
  echo "\`\`\`bash"
  echo "gh pr create --base ${CURRENT_BRANCH} --head ${BRANCH} --title 'chore: merge upstream ${DATE} (${COMMIT_COUNT} commits)'"
  echo "\`\`\`"
else
  echo "Some checks failed. Review and fix manually:"
  if ! $LINT_PASSED; then echo "- [ ] Fix lint errors: \`pnpm lint\`"; fi
  if ! $BUILD_PASSED; then echo "- [ ] Fix build errors: \`pnpm build\`"; fi
  if ! $TESTS_PASSED; then echo "- [ ] Fix test failures: \`pnpm test\`"; fi
fi)

---
*Auto-generated by ai-merge-pipeline*
REPORT_EOF

ok "Pipeline report: ${REPORT_FILE}"

# Commit the report
if [ -n "$(git status --porcelain docs/upstream-reports/)" ]; then
  git add docs/upstream-reports/
  git commit -m "docs: add upstream merge pipeline report ${DATE}"
  if ! $NO_PUSH; then
    git push origin "${BRANCH}" --force-with-lease 2>&1 | tail -1
  fi
fi

# ============================================================
# Final Summary
# ============================================================
PIPELINE_STATE="completed"

echo ""
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo -e "${CYAN}  AI MERGE PIPELINE — COMPLETE${NC}"
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo ""
echo "  Branch:          ${BRANCH}"
echo "  Commits merged:  ${COMMIT_COUNT}"
echo "  Risk level:      ${RISK_LEVEL}"
echo "  Conflicts:       $(if $CONFLICTS_RESOLVED; then echo 'All resolved ✓'; else echo 'UNRESOLVED ✗'; fi)"
echo "  Brand rename:    $(if $BRAND_RENAMED; then echo 'Applied ✓'; else echo 'Skipped'; fi)"
echo "  Lint:            $(if $LINT_PASSED; then echo 'Passed ✓'; else echo 'FAILED ✗'; fi)"
echo "  Build:           $(if $BUILD_PASSED; then echo 'Passed ✓'; else echo 'FAILED ✗'; fi)"
echo "  Tests:           $(if $TESTS_PASSED; then echo 'Passed ✓'; else echo 'FAILED ✗'; fi)"
echo "  Fixes applied:   ${FIXES_APPLIED}"
echo "  AI report:       docs/upstream-reports/${DATE}.md"
echo "  Pipeline report: docs/upstream-reports/${DATE}-pipeline.md"
echo "  Pipeline log:    ${PIPELINE_LOG}"
echo ""

if $LINT_PASSED && $BUILD_PASSED && $TESTS_PASSED; then
  echo -e "${GREEN}  🎉 FULL SUCCESS — Ready to create PR${NC}"
  echo ""
  echo "  gh pr create --base ${CURRENT_BRANCH} --head ${BRANCH} \\"
  echo "    --title 'chore: merge upstream ${DATE} (${COMMIT_COUNT} commits)'"
  exit 0
else
  echo -e "${YELLOW}  ⚠ PARTIAL SUCCESS — Some checks need manual attention${NC}"
  exit 1
fi

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

# ============================================================
# Phase 2.5: Deep Semantic Review
# ============================================================
phase "Phase 2.5: Deep Semantic Review"

DEEP_REVIEW_TOTAL=0
if [ -n "$ANALYSIS_DIR" ]; then
  log "Running deep semantic code review (5 passes)..."
  if bash scripts/autopipeline/ai-deep-review.sh --input-dir="${ANALYSIS_DIR}" 2>&1 | tee -a "$PIPELINE_LOG"; then
    ok "Deep review: docs/upstream-reports/${DATE}-deep-review.md"
    if [ -f "${ANALYSIS_DIR}/deep-review/summary.json" ]; then
      DEEP_REVIEW_TOTAL=$(python3 -c "import json; print(json.load(open('${ANALYSIS_DIR}/deep-review/summary.json'))['total'])" 2>/dev/null || echo "0")
      DEEP_REVIEW_CRITICAL=$(python3 -c "import json; print(json.load(open('${ANALYSIS_DIR}/deep-review/summary.json'))['critical'])" 2>/dev/null || echo "0")
      log "Deep review: ${DEEP_REVIEW_TOTAL} findings (${DEEP_REVIEW_CRITICAL} critical)"
    fi
  else
    warn "Deep review failed (non-fatal)"
  fi
else
  warn "No analysis data for deep review"
fi

if $DRY_RUN; then
  echo ""
  echo "========================================="
  echo "  DRY RUN — would proceed with merge"
  echo "  Commits: ${COMMIT_COUNT}"
  echo "  Risk: ${RISK_LEVEL}"
  echo "  Deep review findings: ${DEEP_REVIEW_TOTAL}"
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
# Phase 5: Multi-Round Validate & Auto-Fix
# ============================================================
TEST_RESULTS_DIR="${REPO_ROOT}/test-results"
mkdir -p "$TEST_RESULTS_DIR"

# --- Phase 5a: Post-Merge Smoke Tests ---
phase "Phase 5a: Post-Merge Smoke Tests (Round 1)"

log "Running post-merge smoke tests to detect merge regressions..."
if bash scripts/autopipeline/multi-round-test.sh \
  --stage=post-merge \
  --output-dir="$TEST_RESULTS_DIR" 2>&1 | tee -a "$PIPELINE_LOG"; then
  ok "Post-merge smoke: all tests pass"
else
  warn "Post-merge smoke: some tests failing (will attempt auto-fix)"
fi

# --- Phase 5b: Auto-Fix with AI ---
phase "Phase 5b: Auto-Fix (AI, max ${MAX_FIX_ROUNDS} rounds)"

log "Running AI auto-fix pipeline..."
if bash scripts/autopipeline/agent-fix-failures.sh --max-rounds="${MAX_FIX_ROUNDS}" 2>&1 | tee -a "$PIPELINE_LOG"; then
  LINT_PASSED=true
  BUILD_PASSED=true
  ok "Auto-fix: all checks passing"
else
  warn "Auto-fix: some checks still failing"
fi

# Commit any fixes from auto-fix
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "fix: auto-fix lint/build/test failures after upstream merge

Automated by ai-merge-pipeline agent."
  FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

# --- Phase 5c: Full Validation (Round 2) ---
phase "Phase 5c: Full Validation (Round 2)"

log "Running full validation with coverage..."
if bash scripts/autopipeline/multi-round-test.sh \
  --stage=post-fix \
  --coverage \
  --output-dir="$TEST_RESULTS_DIR" 2>&1 | tee -a "$PIPELINE_LOG"; then
  LINT_PASSED=true
  BUILD_PASSED=true
  TESTS_PASSED=true
  ok "Full validation: ALL PASSED"
else
  # Determine what passed
  if pnpm lint 2>&1 >/dev/null; then LINT_PASSED=true; fi
  if pnpm build 2>&1 >/dev/null; then BUILD_PASSED=true; fi
  warn "Full validation: some checks still failing"
fi

# --- Phase 5d: Final Regression Gate (Round 3) ---
phase "Phase 5d: Final Regression Gate (Round 3)"

log "Running final regression gate vs post-merge baseline..."
if bash scripts/autopipeline/multi-round-test.sh \
  --stage=final \
  --output-dir="$TEST_RESULTS_DIR" \
  --baseline="$TEST_RESULTS_DIR/post-merge.json" 2>&1 | tee -a "$PIPELINE_LOG"; then
  TESTS_PASSED=true
  ok "Final gate: NO REGRESSIONS"
else
  warn "Final gate: regressions detected or tests failing"
  TESTS_PASSED=false
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

# Bug fix: $LINT_PASSED is a string "true"/"false", not a command.
# Use string comparison instead of executing the variable as a command.
if [ "$LINT_PASSED" = "true" ] && [ "$BUILD_PASSED" = "true" ] && [ "$TESTS_PASSED" = "true" ]; then
  ALL_PASSED=true
else
  ALL_PASSED=false
fi

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
| AI Analysis | $([ "$REPORT_GENERATED" = "true" ] && echo '✓ Report generated' || echo '⚠ No report') |
| Merge | $([ "$MERGE_SUCCEEDED" = "true" ] && echo '✓ Success' || echo '✗ Failed') |
| Conflict Resolution | $([ "$CONFLICTS_RESOLVED" = "true" ] && echo '✓ All resolved' || echo '✗ Unresolved') |
| Brand Rename | $([ "$BRAND_RENAMED" = "true" ] && echo '✓ Applied' || echo '⚠ Skipped') |
| Lint | $([ "$LINT_PASSED" = "true" ] && echo '✓ Passed' || echo '✗ Failed') |
| Build | $([ "$BUILD_PASSED" = "true" ] && echo '✓ Passed' || echo '✗ Failed') |
| Tests | $([ "$TESTS_PASSED" = "true" ] && echo '✓ Passed' || echo '✗ Failed') |
| CN Integrity | $(if [ "$MISSING" -eq 0 ]; then echo '✓ All files present'; else echo "✗ ${MISSING} files missing"; fi) |

## Details

- **Branch**: \`${BRANCH}\`
- **Base branch**: \`${CURRENT_BRANCH}\`
- **Upstream commits**: ${COMMIT_COUNT}
- **Risk level**: ${RISK_LEVEL}
- **Fixes auto-applied**: ${FIXES_APPLIED}
- **Generated**: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Next Steps

$(if [ "$ALL_PASSED" = "true" ]; then
  echo "All checks passed! Create a PR:"
  echo "\`\`\`bash"
  echo "gh pr create --base ${CURRENT_BRANCH} --head ${BRANCH} --title 'chore: merge upstream ${DATE} (${COMMIT_COUNT} commits)'"
  echo "\`\`\`"
else
  echo "Some checks failed. Review and fix manually:"
  [ "$LINT_PASSED" != "true" ] && echo "- [ ] Fix lint errors: \`pnpm lint\`"
  [ "$BUILD_PASSED" != "true" ] && echo "- [ ] Fix build errors: \`pnpm build\`"
  [ "$TESTS_PASSED" != "true" ] && echo "- [ ] Fix test failures: \`pnpm test\`"
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
echo "  Conflicts:       $([ "$CONFLICTS_RESOLVED" = "true" ] && echo 'All resolved ✓' || echo 'UNRESOLVED ✗')"
echo "  Brand rename:    $([ "$BRAND_RENAMED" = "true" ] && echo 'Applied ✓' || echo 'Skipped')"
echo "  Lint:            $([ "$LINT_PASSED" = "true" ] && echo 'Passed ✓' || echo 'FAILED ✗')"
echo "  Build:           $([ "$BUILD_PASSED" = "true" ] && echo 'Passed ✓' || echo 'FAILED ✗')"
echo "  Tests:           $([ "$TESTS_PASSED" = "true" ] && echo 'Passed ✓' || echo 'FAILED ✗')"
echo "  Fixes applied:   ${FIXES_APPLIED}"
echo "  Deep review:     ${DEEP_REVIEW_TOTAL} findings"
echo "  AI report:       docs/upstream-reports/${DATE}.md"
echo "  Deep review:     docs/upstream-reports/${DATE}-deep-review.md"
echo "  Pipeline report: docs/upstream-reports/${DATE}-pipeline.md"
echo "  Test results:    ${TEST_RESULTS_DIR}/"
echo "  Pipeline log:    ${PIPELINE_LOG}"
echo ""

if [ "$ALL_PASSED" = "true" ]; then
  echo -e "${GREEN}  🎉 FULL SUCCESS — Ready to create PR${NC}"
  echo ""
  echo "  gh pr create --base ${CURRENT_BRANCH} --head ${BRANCH} \\"
  echo "    --title 'chore: merge upstream ${DATE} (${COMMIT_COUNT} commits)'"
  exit 0
else
  echo -e "${YELLOW}  ⚠ PARTIAL SUCCESS — Some checks need manual attention${NC}"
  exit 1
fi

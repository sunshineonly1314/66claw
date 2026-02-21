#!/usr/bin/env bash
# ============================================================
# Progressive Merge: Split large upstream updates into scoped PRs
#
# When upstream has >50 commits or risk=critical, creates
# multiple smaller PRs grouped by code area for easier review.
#
# Usage:
#   bash scripts/autopipeline/progressive-merge.sh --dry-run
#   bash scripts/autopipeline/progressive-merge.sh --strategy=directory
#   bash scripts/autopipeline/progressive-merge.sh --max-prs=3
#
# Strategy:
#   Each "scope" is a full merge but the PR description highlights
#   only the files in that scope. This avoids cherry-pick complexity
#   while giving reviewers focused review units.
#
# Prerequisites:
#   - upstream remote configured
#   - merge drivers configured
#   - .upstream-analysis/ data collected (optional but recommended)
#
# Exit codes:
#   0 = All scoped PRs created successfully
#   1 = Some scopes failed (partial success)
#   2 = Configuration error
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# --- Defaults ---
DRY_RUN=false
STRATEGY="directory"
MAX_PRS=5
BASE_BRANCH="master"
THRESHOLD_COMMITS=50
THRESHOLD_FILES=200
NO_PUSH=false
SKIP_TESTS=false

DATE=$(date +%Y-%m-%d)
UPSTREAM_REF="upstream/main"

# --- Parse arguments ---
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --strategy=*) STRATEGY="${arg#*=}" ;;
    --max-prs=*) MAX_PRS="${arg#*=}" ;;
    --base-branch=*) BASE_BRANCH="${arg#*=}" ;;
    --threshold-commits=*) THRESHOLD_COMMITS="${arg#*=}" ;;
    --threshold-files=*) THRESHOLD_FILES="${arg#*=}" ;;
    --no-push) NO_PUSH=true ;;
    --skip-tests) SKIP_TESTS=true ;;
    --force) THRESHOLD_COMMITS=0; THRESHOLD_FILES=0 ;;
    *) echo "Unknown option: $arg"; exit 2 ;;
  esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${BLUE}[progressive][$(date +%H:%M:%S)]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
scope_header() { echo -e "${CYAN}=== Scope $1: $2 ===${NC}"; }

# ============================================================
# Step 1: Check if progressive merge is needed
# ============================================================
log "=== Step 1: Analyze upstream ==="

# Ensure upstream remote
if ! git remote get-url upstream >/dev/null 2>&1; then
  echo "Error: upstream remote not configured"
  echo "  Run: git remote add upstream https://github.com/openclaw/openclaw.git"
  exit 2
fi

# Fetch upstream
git fetch upstream main --tags --prune 2>/dev/null

MERGE_BASE=$(git merge-base HEAD "$UPSTREAM_REF")
COMMIT_COUNT=$(git rev-list --count "${MERGE_BASE}..${UPSTREAM_REF}")
CHANGED_FILES=$(git diff --name-only "${MERGE_BASE}..${UPSTREAM_REF}")
FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')

log "Upstream commits: $COMMIT_COUNT"
log "Changed files: $FILE_COUNT"

if [ "$COMMIT_COUNT" -lt "$THRESHOLD_COMMITS" ] && [ "$FILE_COUNT" -lt "$THRESHOLD_FILES" ]; then
  log "Below progressive merge threshold (commits < $THRESHOLD_COMMITS, files < $THRESHOLD_FILES)"
  log "Use --force to override, or use regular merge-upstream.sh"
  exit 0
fi

ok "Progressive merge recommended: $COMMIT_COUNT commits, $FILE_COUNT files"

# ============================================================
# Step 2: Define scopes
# ============================================================
log "=== Step 2: Define scopes (strategy: $STRATEGY) ==="

# Scope definitions: name, description, directory patterns
declare -A SCOPE_NAMES
declare -A SCOPE_DESCS
declare -A SCOPE_PATTERNS
declare -a SCOPE_ORDER

SCOPE_ORDER=(foundation core gateway ui other)
SCOPE_NAMES[foundation]="foundation"
SCOPE_DESCS[foundation]="Config, types, and build system"
SCOPE_PATTERNS[foundation]="src/config/|src/infra/|tsconfig|package.json|pnpm-lock"

SCOPE_NAMES[core]="core"
SCOPE_DESCS[core]="Agent logic and auto-reply"
SCOPE_PATTERNS[core]="src/agents/|src/auto-reply/|src/media-understanding/|src/media/"

SCOPE_NAMES[gateway]="gateway"
SCOPE_DESCS[gateway]="Gateway and server methods"
SCOPE_PATTERNS[gateway]="src/gateway/|src/web/"

SCOPE_NAMES[ui]="ui"
SCOPE_DESCS[ui]="UI components and styles"
SCOPE_PATTERNS[ui]="ui/"

SCOPE_NAMES[other]="other"
SCOPE_DESCS[other]="Docs, scripts, and everything else"
SCOPE_PATTERNS[other]=".*"  # Catch-all

# Assign files to scopes
declare -A SCOPE_FILES
declare -A SCOPE_COUNTS

for scope in "${SCOPE_ORDER[@]}"; do
  SCOPE_FILES[$scope]=""
  SCOPE_COUNTS[$scope]=0
done

while IFS= read -r file; do
  [ -z "$file" ] && continue
  assigned=false
  for scope in "${SCOPE_ORDER[@]}"; do
    pattern="${SCOPE_PATTERNS[$scope]}"
    if [ "$scope" = "other" ] || echo "$file" | grep -qE "$pattern"; then
      if [ -n "${SCOPE_FILES[$scope]}" ]; then
        SCOPE_FILES[$scope]="${SCOPE_FILES[$scope]}"$'\n'"$file"
      else
        SCOPE_FILES[$scope]="$file"
      fi
      SCOPE_COUNTS[$scope]=$((${SCOPE_COUNTS[$scope]} + 1))
      assigned=true
      break
    fi
  done
done <<< "$CHANGED_FILES"

# Display scope breakdown
echo ""
echo "Scope Breakdown:"
echo "─────────────────────────────────────────"
for scope in "${SCOPE_ORDER[@]}"; do
  count=${SCOPE_COUNTS[$scope]}
  printf "  %-12s  %4d files  %s\n" "${SCOPE_NAMES[$scope]}" "$count" "${SCOPE_DESCS[$scope]}"
done
echo "─────────────────────────────────────────"
echo "  Total:        ${FILE_COUNT} files"
echo ""

# Filter out empty scopes and limit to MAX_PRS
ACTIVE_SCOPES=()
for scope in "${SCOPE_ORDER[@]}"; do
  if [ "${SCOPE_COUNTS[$scope]}" -gt 0 ] && [ ${#ACTIVE_SCOPES[@]} -lt "$MAX_PRS" ]; then
    ACTIVE_SCOPES+=("$scope")
  fi
done

log "Active scopes: ${#ACTIVE_SCOPES[@]} (max: $MAX_PRS)"

# ============================================================
# Dry run exit
# ============================================================
if $DRY_RUN; then
  echo ""
  echo "========================================="
  echo "  PROGRESSIVE MERGE DRY RUN"
  echo "========================================="
  echo "  Upstream commits: $COMMIT_COUNT"
  echo "  Total files: $FILE_COUNT"
  echo "  Scopes: ${#ACTIVE_SCOPES[@]}"
  echo ""
  for i in "${!ACTIVE_SCOPES[@]}"; do
    scope="${ACTIVE_SCOPES[$i]}"
    echo "  PR $((i + 1))/${#ACTIVE_SCOPES[@]}: ${SCOPE_NAMES[$scope]}"
    echo "    Files: ${SCOPE_COUNTS[$scope]}"
    echo "    Description: ${SCOPE_DESCS[$scope]}"
    echo "    Branch: merge/upstream-${DATE}-$((i + 1))-${scope}"
    echo ""
  done
  echo "  To execute: remove --dry-run flag"
  echo "========================================="
  exit 0
fi

# ============================================================
# Step 3: Setup merge driver
# ============================================================
log "=== Step 3: Setup merge drivers ==="

git config merge.ours.name "Always keep CN version" 2>/dev/null || true
git config merge.ours.driver true 2>/dev/null || true
ok "Merge driver configured"

# ============================================================
# Step 4: Execute scoped merges
# ============================================================
log "=== Step 4: Execute scoped merges ==="

CURRENT_BRANCH=$(git symbolic-ref --short HEAD)
SUCCESS_COUNT=0
FAIL_COUNT=0
CREATED_BRANCHES=()
CREATED_PRS=()

for i in "${!ACTIVE_SCOPES[@]}"; do
  scope="${ACTIVE_SCOPES[$i]}"
  scope_num=$((i + 1))
  scope_name="${SCOPE_NAMES[$scope]}"
  scope_desc="${SCOPE_DESCS[$scope]}"
  scope_count="${SCOPE_COUNTS[$scope]}"
  branch="merge/upstream-${DATE}-${scope_num}-${scope_name}"

  scope_header "$scope_num/${#ACTIVE_SCOPES[@]}" "$scope_name ($scope_count files)"

  # Return to base branch
  git checkout "$CURRENT_BRANCH" 2>/dev/null

  # Check if branch exists
  if git rev-parse --verify "$branch" >/dev/null 2>&1; then
    warn "Branch $branch already exists, skipping"
    continue
  fi

  # Create scope branch
  git checkout -b "$branch"
  log "Created branch: $branch"

  # Full merge
  MERGE_MSG="chore: merge upstream ${DATE} (scope ${scope_num}/${#ACTIVE_SCOPES[@]}: ${scope_name})

Upstream commits: ${COMMIT_COUNT}
Scope: ${scope_name} — ${scope_desc}
Files in scope: ${scope_count}
Total scopes: ${#ACTIVE_SCOPES[@]}
Strategy: progressive-merge (${STRATEGY})"

  if git merge "$UPSTREAM_REF" --no-edit -m "$MERGE_MSG" 2>&1; then
    ok "Merge succeeded for scope: $scope_name"

    # Apply brand rename if available
    if [ -f "${REPO_ROOT}/scripts/autopipeline/apply-cn-brand.sh" ]; then
      bash "${REPO_ROOT}/scripts/autopipeline/apply-cn-brand.sh" 2>/dev/null || true
      if [ -n "$(git status --porcelain)" ]; then
        git add -A
        git commit -m "chore: apply CN brand rename (scope: ${scope_name})" 2>/dev/null || true
      fi
    fi

    # Run post-merge smoke test (unless skipped)
    if ! $SKIP_TESTS; then
      log "Running post-merge smoke test for scope: $scope_name"
      TEST_DIR="${REPO_ROOT}/test-results/progressive-${scope_name}"
      mkdir -p "$TEST_DIR"

      if bash "${REPO_ROOT}/scripts/autopipeline/multi-round-test.sh" \
        --stage=post-merge \
        --output-dir="$TEST_DIR" 2>&1; then
        ok "Smoke tests passed for scope: $scope_name"
      else
        warn "Smoke tests failed for scope: $scope_name (continuing)"
      fi
    fi

    # Push and create PR
    if ! $NO_PUSH; then
      log "Pushing branch: $branch"
      git push origin "$branch" --force-with-lease 2>&1

      # Build scope-specific file list for PR body
      SCOPE_FILE_LIST=$(echo "${SCOPE_FILES[$scope]}" | head -30 | sed 's/^/- `/' | sed 's/$/`/')
      REMAINING=$((scope_count - 30))
      if [ "$REMAINING" -gt 0 ]; then
        SCOPE_FILE_LIST="${SCOPE_FILE_LIST}"$'\n'"- ... and ${REMAINING} more files"
      fi

      PR_BODY="$(cat <<EOF
## Upstream Merge — Scope ${scope_num}/${#ACTIVE_SCOPES[@]}: ${scope_name}

**Strategy**: Progressive merge (${STRATEGY})
**Upstream commits**: ${COMMIT_COUNT}
**Files in this scope**: ${scope_count}

### Scope: ${scope_desc}

### Files in this scope (review focus)
${SCOPE_FILE_LIST}

### All scopes in this progressive merge
$(for j in "${!ACTIVE_SCOPES[@]}"; do
  s="${ACTIVE_SCOPES[$j]}"
  marker=""
  [ "$s" = "$scope" ] && marker=" **(this PR)**"
  echo "- Scope $((j+1)): ${SCOPE_NAMES[$s]} (${SCOPE_COUNTS[$s]} files)${marker}"
done)

### Review checklist
- [ ] Review files listed above for this scope
- [ ] Section II files: verify CN injections preserved
- [ ] Brand consistency: OpenClawCN (not OpenClaw)
- [ ] Run local smoke tests on this branch

---
*Auto-generated by progressive-merge.sh*
EOF
)"

      if command -v gh &>/dev/null; then
        PR_URL=$(gh pr create \
          --base "$CURRENT_BRANCH" \
          --head "$branch" \
          --title "chore: merge upstream ${DATE} (scope ${scope_num}/${#ACTIVE_SCOPES[@]}: ${scope_name})" \
          --body "$PR_BODY" \
          --label "upstream-sync,progressive-merge" 2>&1 || echo "PR creation failed")

        if echo "$PR_URL" | grep -q "https://"; then
          ok "PR created: $PR_URL"
          CREATED_PRS+=("$PR_URL")
        else
          warn "PR creation failed for scope: $scope_name"
        fi
      else
        warn "gh CLI not available, skipping PR creation"
        log "Push branch manually and create PR for: $branch"
      fi
    fi

    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    CREATED_BRANCHES+=("$branch")
  else
    fail "Merge failed for scope: $scope_name"
    git merge --abort 2>/dev/null || true
    git checkout "$CURRENT_BRANCH" 2>/dev/null || true
    git branch -D "$branch" 2>/dev/null || true
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

# Return to original branch
git checkout "$CURRENT_BRANCH" 2>/dev/null || true

# ============================================================
# Step 5: Summary
# ============================================================
echo ""
echo "========================================="
echo "  PROGRESSIVE MERGE COMPLETE"
echo "========================================="
echo "  Strategy:     ${STRATEGY}"
echo "  Total scopes: ${#ACTIVE_SCOPES[@]}"
echo "  Succeeded:    ${SUCCESS_COUNT}"
echo "  Failed:       ${FAIL_COUNT}"
echo ""

if [ ${#CREATED_BRANCHES[@]} -gt 0 ]; then
  echo "  Created branches:"
  for b in "${CREATED_BRANCHES[@]}"; do
    echo "    - $b"
  done
fi

if [ ${#CREATED_PRS[@]} -gt 0 ]; then
  echo ""
  echo "  Created PRs:"
  for pr in "${CREATED_PRS[@]}"; do
    echo "    - $pr"
  done
fi

echo ""
echo "  Review order (dependency-based):"
for i in "${!ACTIVE_SCOPES[@]}"; do
  scope="${ACTIVE_SCOPES[$i]}"
  echo "    $((i + 1)). ${SCOPE_NAMES[$scope]} (${SCOPE_COUNTS[$scope]} files)"
done
echo "========================================="

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0

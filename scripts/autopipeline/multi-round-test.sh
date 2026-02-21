#!/usr/bin/env bash
# ============================================================
# Multi-Round Test Orchestrator
#
# Replaces the single lint->build->test pass with a structured
# multi-stage testing approach that tracks regressions between
# stages and compares against baselines.
#
# Usage:
#   bash scripts/autopipeline/multi-round-test.sh --stage=pre-merge --output-dir=test-results/
#   bash scripts/autopipeline/multi-round-test.sh --stage=post-merge --output-dir=test-results/
#   bash scripts/autopipeline/multi-round-test.sh --stage=post-fix --coverage --output-dir=test-results/
#   bash scripts/autopipeline/multi-round-test.sh --stage=final --output-dir=test-results/ --baseline=test-results/pre-merge.json
#
# Stages:
#   pre-merge   - Unit tests only, establishes known-good baseline
#   post-merge  - tsc + unit tests, detects merge-caused regressions
#   post-fix    - lint + build + full test suite + optional coverage
#   final       - Full suite + regression diff vs baseline (gate)
#
# Exit codes:
#   0 = All tests in stage passed
#   1 = Some tests failed
#   2 = Configuration error
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# --- Defaults ---
STAGE=""
OUTPUT_DIR=""
BASELINE=""
COVERAGE=false
FAIL_FAST=false

# --- Parse arguments ---
for arg in "$@"; do
  case "$arg" in
    --stage=*) STAGE="${arg#*=}" ;;
    --output-dir=*) OUTPUT_DIR="${arg#*=}" ;;
    --baseline=*) BASELINE="${arg#*=}" ;;
    --coverage) COVERAGE=true ;;
    --fail-fast) FAIL_FAST=true ;;
    *) echo "Unknown option: $arg"; exit 2 ;;
  esac
done

if [ -z "$STAGE" ]; then
  echo "Error: --stage is required (pre-merge|post-merge|post-fix|final)"
  exit 2
fi

if [ -z "$OUTPUT_DIR" ]; then
  OUTPUT_DIR="${REPO_ROOT}/test-results"
fi

mkdir -p "$OUTPUT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[multi-round-test][$(date +%H:%M:%S)]${NC} $*"; }
ok()  { echo -e "${GREEN}[PASS]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

# --- Result tracking ---
RESULT_FILE="${OUTPUT_DIR}/${STAGE}.json"
VITEST_REPORT_DIR="${OUTPUT_DIR}/vitest-reports-${STAGE}"
mkdir -p "$VITEST_REPORT_DIR"

START_TIME=$(date +%s)
LINT_PASSED="null"
BUILD_PASSED="null"
TEST_PASSED=false
TEST_TOTAL=0
TEST_FAILED=0
TEST_FAILED_NAMES="[]"
COVERAGE_LINES="null"
COVERAGE_MEETS="null"
REGRESSIONS="[]"
TYPE_CHECK_PASSED="null"

# --- Helper: run tests and capture results ---
run_unit_tests() {
  log "Running unit tests..."
  export OPENCLAWCN_VITEST_REPORT_DIR="$VITEST_REPORT_DIR"

  if pnpm test 2>&1 | tee "${OUTPUT_DIR}/${STAGE}-test.log"; then
    TEST_PASSED=true
    ok "Unit tests passed"
  else
    TEST_PASSED=false
    fail "Unit tests failed"
  fi

  # Parse vitest JSON reports to extract test counts
  parse_vitest_results
}

run_type_check() {
  log "Running type check (tsc --noEmit)..."
  if pnpm exec tsc --noEmit --skipLibCheck 2>&1 | tee "${OUTPUT_DIR}/${STAGE}-tsc.log"; then
    TYPE_CHECK_PASSED=true
    ok "Type check passed"
  else
    TYPE_CHECK_PASSED=false
    fail "Type check failed"
  fi
}

run_lint() {
  log "Running lint..."
  if pnpm lint 2>&1 | tee "${OUTPUT_DIR}/${STAGE}-lint.log"; then
    LINT_PASSED=true
    ok "Lint passed"
  else
    LINT_PASSED=false
    fail "Lint failed"
    # Attempt auto-fix
    log "Attempting lint auto-fix..."
    pnpm lint:fix 2>&1 || true
    if pnpm lint 2>&1 | tee "${OUTPUT_DIR}/${STAGE}-lint-retry.log"; then
      LINT_PASSED=true
      ok "Lint passed after auto-fix"
    else
      fail "Lint still failing after auto-fix"
    fi
  fi
}

run_build() {
  log "Running build..."
  if pnpm build 2>&1 | tee "${OUTPUT_DIR}/${STAGE}-build.log"; then
    BUILD_PASSED=true
    ok "Build passed"
  else
    BUILD_PASSED=false
    fail "Build failed"
  fi
}

run_coverage() {
  log "Running tests with coverage..."
  export OPENCLAWCN_VITEST_REPORT_DIR="$VITEST_REPORT_DIR"

  if pnpm test:coverage 2>&1 | tee "${OUTPUT_DIR}/${STAGE}-coverage.log"; then
    ok "Coverage tests passed"
  else
    warn "Coverage tests had failures"
  fi

  # Extract coverage from vitest output
  if [ -f "${OUTPUT_DIR}/${STAGE}-coverage.log" ]; then
    COVERAGE_LINES=$(grep -oP 'All files.*?\|\s*[\d.]+' "${OUTPUT_DIR}/${STAGE}-coverage.log" | grep -oP '[\d.]+$' || echo "null")
    if [ "$COVERAGE_LINES" != "null" ] && [ -n "$COVERAGE_LINES" ]; then
      # Check against 70% threshold
      MEETS=$(echo "$COVERAGE_LINES >= 70.0" | bc -l 2>/dev/null || echo "1")
      if [ "$MEETS" = "1" ]; then
        COVERAGE_MEETS=true
      else
        COVERAGE_MEETS=false
      fi
    fi
  fi
}

run_e2e_tests() {
  log "Running e2e tests..."
  if pnpm test:e2e 2>&1 | tee "${OUTPUT_DIR}/${STAGE}-e2e.log"; then
    ok "E2E tests passed"
  else
    warn "E2E tests had failures (non-fatal in merge pipeline)"
  fi
}

# --- Helper: parse vitest JSON reports ---
parse_vitest_results() {
  local total=0
  local failed=0
  local failed_names_arr=()

  # vitest JSON reports are in $VITEST_REPORT_DIR/vitest-*.json
  for report_file in "${VITEST_REPORT_DIR}"/vitest-*.json; do
    [ -f "$report_file" ] || continue

    # Extract numTotalTests and numFailedTests using python or jq
    if command -v python3 &>/dev/null; then
      local file_total
      local file_failed
      file_total=$(python3 -c "
import json, sys
try:
    data = json.load(open('$report_file'))
    print(data.get('numTotalTests', 0))
except:
    print(0)
" 2>/dev/null || echo "0")
      file_failed=$(python3 -c "
import json, sys
try:
    data = json.load(open('$report_file'))
    print(data.get('numFailedTests', 0))
except:
    print(0)
" 2>/dev/null || echo "0")

      total=$((total + file_total))
      failed=$((failed + file_failed))

      # Extract failed test names
      local names
      names=$(python3 -c "
import json, sys
try:
    data = json.load(open('$report_file'))
    for suite in data.get('testResults', []):
        for test in suite.get('assertionResults', []):
            if test.get('status') == 'failed':
                ancestors = ' > '.join(test.get('ancestorTitles', []))
                name = test.get('title', '')
                full = f\"{suite.get('name','')}: {ancestors} > {name}\" if ancestors else f\"{suite.get('name','')}: {name}\"
                print(full)
except:
    pass
" 2>/dev/null || true)

      while IFS= read -r name; do
        [ -n "$name" ] && failed_names_arr+=("$name")
      done <<< "$names"

    elif command -v jq &>/dev/null; then
      local file_total
      local file_failed
      file_total=$(jq '.numTotalTests // 0' "$report_file" 2>/dev/null || echo "0")
      file_failed=$(jq '.numFailedTests // 0' "$report_file" 2>/dev/null || echo "0")

      total=$((total + file_total))
      failed=$((failed + file_failed))
    fi
  done

  TEST_TOTAL=$total
  TEST_FAILED=$failed

  # Build JSON array of failed test names
  if [ ${#failed_names_arr[@]} -gt 0 ]; then
    TEST_FAILED_NAMES="["
    local first=true
    for name in "${failed_names_arr[@]}"; do
      if $first; then
        first=false
      else
        TEST_FAILED_NAMES="${TEST_FAILED_NAMES},"
      fi
      # Escape quotes in test names
      local escaped
      escaped=$(echo "$name" | sed 's/"/\\"/g')
      TEST_FAILED_NAMES="${TEST_FAILED_NAMES}\"${escaped}\""
    done
    TEST_FAILED_NAMES="${TEST_FAILED_NAMES}]"
  fi
}

# --- Helper: compare with baseline for regressions ---
compare_with_baseline() {
  if [ -z "$BASELINE" ] || [ ! -f "$BASELINE" ]; then
    log "No baseline provided or file not found, skipping regression comparison"
    return
  fi

  log "Comparing with baseline: $BASELINE"

  if ! command -v python3 &>/dev/null; then
    warn "python3 not available, skipping regression analysis"
    return
  fi

  REGRESSIONS=$(python3 -c "
import json, sys

try:
    with open('$BASELINE') as f:
        baseline = json.load(f)
    with open('$RESULT_FILE') as f:
        current = json.load(f)

    baseline_failed = set(baseline.get('test_failed_names', []))
    current_failed = set(current.get('test_failed_names', []))

    # Regressions: tests that passed in baseline but fail now
    regressions = sorted(current_failed - baseline_failed)

    # Output as JSON array
    print(json.dumps(regressions))
except Exception as e:
    print('[]')
" 2>/dev/null || echo "[]")

  local regression_count
  regression_count=$(echo "$REGRESSIONS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  if [ "$regression_count" -gt 0 ]; then
    fail "Found $regression_count regression(s) vs baseline!"
    echo "$REGRESSIONS" | python3 -c "
import json, sys
for r in json.load(sys.stdin):
    print(f'  - {r}')
" 2>/dev/null || true
  else
    ok "No regressions vs baseline"
  fi
}

# --- Helper: write result JSON ---
write_result() {
  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - START_TIME))

  cat > "$RESULT_FILE" <<EOF
{
  "stage": "${STAGE}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date +%Y-%m-%dT%H:%M:%SZ)",
  "duration_seconds": ${duration},
  "lint_passed": ${LINT_PASSED},
  "build_passed": ${BUILD_PASSED},
  "type_check_passed": ${TYPE_CHECK_PASSED},
  "test_passed": ${TEST_PASSED},
  "test_total": ${TEST_TOTAL},
  "test_failed": ${TEST_FAILED},
  "test_failed_names": ${TEST_FAILED_NAMES},
  "coverage": {
    "lines": ${COVERAGE_LINES:-null},
    "meets_threshold": ${COVERAGE_MEETS:-null}
  },
  "regressions_vs_baseline": ${REGRESSIONS}
}
EOF

  log "Result written to: $RESULT_FILE"
}

# --- Helper: determine overall stage pass/fail ---
stage_passed() {
  case "$STAGE" in
    pre-merge)
      [ "$TEST_PASSED" = "true" ]
      ;;
    post-merge)
      [ "$TEST_PASSED" = "true" ]
      ;;
    post-fix)
      [ "$LINT_PASSED" = "true" ] && [ "$BUILD_PASSED" = "true" ] && [ "$TEST_PASSED" = "true" ]
      ;;
    final)
      if [ "$TEST_PASSED" != "true" ]; then
        return 1
      fi
      # Check for regressions
      local regression_count
      regression_count=$(echo "$REGRESSIONS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
      [ "$regression_count" -eq 0 ]
      ;;
  esac
}

# ============================================================
# STAGE EXECUTION
# ============================================================

log "========================================="
log "  Multi-Round Test: Stage '${STAGE}'"
log "========================================="

case "$STAGE" in
  # ----------------------------------------------------------
  # PRE-MERGE: Establish baseline (unit tests only)
  # ----------------------------------------------------------
  pre-merge)
    log "Stage: Pre-merge baseline"
    log "Purpose: Establish known-good test state before merge"
    echo ""

    run_unit_tests
    write_result

    if stage_passed; then
      ok "Pre-merge baseline established: ${TEST_TOTAL} tests, ${TEST_FAILED} failures"
    else
      warn "Pre-merge baseline has ${TEST_FAILED} existing failures (will be excluded from regression check)"
    fi
    ;;

  # ----------------------------------------------------------
  # POST-MERGE: Detect merge-caused regressions
  # ----------------------------------------------------------
  post-merge)
    log "Stage: Post-merge smoke test"
    log "Purpose: Detect regressions caused by merge (before any fixes)"
    echo ""

    run_type_check

    if [ "$TYPE_CHECK_PASSED" = "false" ] && $FAIL_FAST; then
      fail "Type check failed, aborting (--fail-fast)"
      write_result
      exit 1
    fi

    run_unit_tests
    write_result

    if stage_passed; then
      ok "Post-merge smoke: ALL CLEAR (${TEST_TOTAL} tests pass)"
    else
      warn "Post-merge smoke: ${TEST_FAILED}/${TEST_TOTAL} tests failing"
      warn "These failures may be caused by the merge and need to be fixed"
    fi
    ;;

  # ----------------------------------------------------------
  # POST-FIX: Full validation after all automated fixes
  # ----------------------------------------------------------
  post-fix)
    log "Stage: Post-fix full validation"
    log "Purpose: Comprehensive check after brand rename + AI fixes"
    echo ""

    run_lint

    if [ "$LINT_PASSED" = "false" ] && $FAIL_FAST; then
      fail "Lint failed, aborting (--fail-fast)"
      write_result
      exit 1
    fi

    run_build

    if [ "$BUILD_PASSED" = "false" ] && $FAIL_FAST; then
      fail "Build failed, aborting (--fail-fast)"
      write_result
      exit 1
    fi

    run_unit_tests

    if $COVERAGE; then
      run_coverage
    fi

    write_result

    if stage_passed; then
      ok "Post-fix validation: ALL PASSED"
      if [ "$COVERAGE_LINES" != "null" ]; then
        log "Coverage: ${COVERAGE_LINES}% lines (threshold: 70%)"
      fi
    else
      fail "Post-fix validation: FAILURES DETECTED"
      [ "$LINT_PASSED" = "false" ] && fail "  Lint: FAILED"
      [ "$BUILD_PASSED" = "false" ] && fail "  Build: FAILED"
      [ "$TEST_PASSED" = "false" ] && fail "  Tests: ${TEST_FAILED}/${TEST_TOTAL} FAILED"
    fi
    ;;

  # ----------------------------------------------------------
  # FINAL: Regression gate before PR creation
  # ----------------------------------------------------------
  final)
    log "Stage: Final regression gate"
    log "Purpose: Ensure no regressions introduced by merge+fixes"
    echo ""

    # Run full test suite
    run_unit_tests

    # Write initial result (needed for comparison)
    write_result

    # Compare with baseline
    compare_with_baseline

    # Rewrite result with regression data
    write_result

    # Check test count didn't decrease (no tests accidentally deleted)
    if [ -n "$BASELINE" ] && [ -f "$BASELINE" ] && command -v python3 &>/dev/null; then
      BASELINE_TOTAL=$(python3 -c "import json; print(json.load(open('$BASELINE')).get('test_total', 0))" 2>/dev/null || echo "0")
      if [ "$TEST_TOTAL" -lt "$BASELINE_TOTAL" ]; then
        warn "Test count decreased: ${TEST_TOTAL} (now) vs ${BASELINE_TOTAL} (baseline)"
        warn "Some tests may have been accidentally deleted during merge"
      else
        ok "Test count maintained: ${TEST_TOTAL} >= ${BASELINE_TOTAL}"
      fi
    fi

    if stage_passed; then
      ok "========================================="
      ok "  FINAL GATE: PASSED"
      ok "  Tests: ${TEST_TOTAL} total, ${TEST_FAILED} failed"
      ok "  Regressions: 0"
      ok "========================================="
      exit 0
    else
      fail "========================================="
      fail "  FINAL GATE: FAILED"
      fail "  Tests: ${TEST_TOTAL} total, ${TEST_FAILED} failed"

      # 'local' is not valid outside a function; use plain variable in case block
      regression_count=$(echo "$REGRESSIONS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
      if [ "$regression_count" -gt 0 ]; then
        fail "  Regressions: ${regression_count}"
      fi
      fail "========================================="
      exit 1
    fi
    ;;

  *)
    echo "Error: Unknown stage '${STAGE}'"
    echo "Valid stages: pre-merge, post-merge, post-fix, final"
    exit 2
    ;;
esac

# Output pass/fail for CI step outputs
if stage_passed; then
  echo "passed=true" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true
  exit 0
else
  echo "passed=false" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true
  # Non-final stages don't exit with error (to allow pipeline to continue)
  if [ "$STAGE" = "final" ]; then
    exit 1
  fi
  exit 0
fi

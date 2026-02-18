#!/usr/bin/env bash
# ============================================================
# AI Test/Lint/Build Failure Fixer Agent
#
# After merge, if lint/build/test fails, this agent attempts
# to diagnose and fix the failures automatically.
#
# Usage:
#   bash scripts/autopipeline/agent-fix-failures.sh              # Fix all failures
#   bash scripts/autopipeline/agent-fix-failures.sh --lint-only   # Only fix lint errors
#   bash scripts/autopipeline/agent-fix-failures.sh --build-only  # Only fix build errors
#   bash scripts/autopipeline/agent-fix-failures.sh --test-only   # Only fix test failures
#   bash scripts/autopipeline/agent-fix-failures.sh --max-rounds=5 # Limit fix attempts
#
# Strategy:
#   1. Run lint → if fails → auto-fix (pnpm lint:fix) → if still fails → AI fix
#   2. Run build → if fails → AI analyzes errors → applies fix → retry
#   3. Run tests → if fails → AI analyzes failures → applies fix → retry
#   Each step retries up to MAX_ROUNDS times before giving up.
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

LINT_ONLY=false
BUILD_ONLY=false
TEST_ONLY=false
MAX_ROUNDS=3
RUN_ALL=true

for arg in "$@"; do
  case "$arg" in
    --lint-only) LINT_ONLY=true; RUN_ALL=false ;;
    --build-only) BUILD_ONLY=true; RUN_ALL=false ;;
    --test-only) TEST_ONLY=true; RUN_ALL=false ;;
    --max-rounds=*) MAX_ROUNDS="${arg#*=}" ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
ok() { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

FIXES_APPLIED=0
FIXES_FAILED=0

# ============================================================
# Helper: Call Claude to fix code
# ============================================================
ai_fix() {
  local prompt="$1"
  local result=""

  if command -v claude &>/dev/null; then
    result=$(echo "$prompt" | claude --print 2>/dev/null)
  elif [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    local prompt_json
    prompt_json=$(echo "$prompt" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
    result=$(curl -s https://api.anthropic.com/v1/messages \
      -H "x-api-key: ${ANTHROPIC_API_KEY}" \
      -H "anthropic-version: 2023-06-01" \
      -H "content-type: application/json" \
      -d "{
        \"model\": \"claude-sonnet-4-5-20250929\",
        \"max_tokens\": 16384,
        \"messages\": [{\"role\": \"user\", \"content\": ${prompt_json}}]
      }" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['content'][0]['text'])" 2>/dev/null)
  else
    error "No Claude CLI or ANTHROPIC_API_KEY available"
    return 1
  fi

  echo "$result"
}

# ============================================================
# Helper: Extract file path and line from error output
# ============================================================
extract_error_locations() {
  local errors="$1"
  # Match patterns like: src/foo/bar.ts:42:10 or src/foo/bar.ts(42,10)
  echo "$errors" | grep -oE '[a-zA-Z0-9_./-]+\.(ts|tsx|js|jsx):[0-9]+' | sort -u | head -20
}

# ============================================================
# Step 1: Lint
# ============================================================
fix_lint() {
  log "=== Lint Fix ==="

  for round in $(seq 1 "$MAX_ROUNDS"); do
    log "  Round $round/$MAX_ROUNDS: Running lint..."

    LINT_OUTPUT=$(pnpm lint 2>&1) && {
      ok "  Lint passed!"
      return 0
    }

    log "  Lint failed. Attempting auto-fix..."

    # First try the built-in auto-fix
    if pnpm lint:fix 2>&1 | tail -3; then
      log "  Auto-fix applied. Rechecking..."
      if pnpm lint 2>&1 >/dev/null; then
        ok "  Lint passed after auto-fix!"
        FIXES_APPLIED=$((FIXES_APPLIED + 1))
        return 0
      fi
    fi

    # Auto-fix didn't fully work — try AI
    log "  Auto-fix insufficient. Using AI..."

    # Get the remaining errors
    LINT_ERRORS=$(pnpm lint 2>&1 | tail -50)
    ERROR_FILES=$(extract_error_locations "$LINT_ERRORS")

    if [ -z "$ERROR_FILES" ]; then
      warn "  Could not parse error locations"
      continue
    fi

    # For each error file, read it and ask AI to fix
    while IFS= read -r error_loc; do
      [ -z "$error_loc" ] && continue
      EFILE="${error_loc%%:*}"
      ELINE="${error_loc#*:}"

      if [ ! -f "$EFILE" ]; then
        continue
      fi

      FILE_CONTENT=$(cat "$EFILE")
      NEARBY_ERRORS=$(echo "$LINT_ERRORS" | grep "$EFILE" | head -10)

      FIX_PROMPT="Fix the lint errors in this TypeScript file. The project uses oxlint with strict rules.

File: ${EFILE}

Lint errors:
\`\`\`
${NEARBY_ERRORS}
\`\`\`

File content:
\`\`\`typescript
${FILE_CONTENT}
\`\`\`

Rules:
1. Fix ONLY the lint errors shown above
2. Do NOT change any logic or behavior
3. Do NOT add/remove functionality
4. Common fixes: unused imports, missing types, incorrect comparisons
5. Output the COMPLETE fixed file content. No explanations, no markdown fences."

      FIXED=$(ai_fix "$FIX_PROMPT" 2>/dev/null || true)

      if [ -n "$FIXED" ]; then
        echo "$FIXED" > "$EFILE"
        log "    AI fixed: $EFILE"
        FIXES_APPLIED=$((FIXES_APPLIED + 1))
      fi
    done <<< "$ERROR_FILES"
  done

  error "  Lint still failing after $MAX_ROUNDS rounds"
  FIXES_FAILED=$((FIXES_FAILED + 1))
  return 1
}

# ============================================================
# Step 2: Build
# ============================================================
fix_build() {
  log "=== Build Fix ==="

  for round in $(seq 1 "$MAX_ROUNDS"); do
    log "  Round $round/$MAX_ROUNDS: Running build..."

    BUILD_OUTPUT=$(pnpm build 2>&1) && {
      ok "  Build passed!"
      return 0
    }

    log "  Build failed. Analyzing errors..."

    BUILD_ERRORS=$(echo "$BUILD_OUTPUT" | grep -E "error|Error|ERROR" | tail -30)
    ERROR_FILES=$(extract_error_locations "$BUILD_OUTPUT")

    if [ -z "$ERROR_FILES" ]; then
      # Check for module resolution errors
      MODULE_ERRORS=$(echo "$BUILD_OUTPUT" | grep -E "Cannot find module|Module not found" | head -10)
      if [ -n "$MODULE_ERRORS" ]; then
        FIX_PROMPT="The TypeScript build failed with module resolution errors. Analyze these errors and tell me ONLY the exact file edits needed (file path + what to change). Do NOT output full file contents.

Build errors:
\`\`\`
${MODULE_ERRORS}
\`\`\`

Common causes after upstream merge:
1. Import path changed (file moved/renamed)
2. Export removed from a module
3. Type definition changed
4. New required import not added

Output format:
FILE: path/to/file.ts
CHANGE: line X: old_code → new_code"

        DIAGNOSIS=$(ai_fix "$FIX_PROMPT" 2>/dev/null || true)
        if [ -n "$DIAGNOSIS" ]; then
          log "  AI diagnosis:"
          echo "$DIAGNOSIS" | sed 's/^/    /'
        fi
      fi
      warn "  Could not auto-fix build errors. Manual intervention needed."
      FIXES_FAILED=$((FIXES_FAILED + 1))
      return 1
    fi

    # For each error file, try to fix
    while IFS= read -r error_loc; do
      [ -z "$error_loc" ] && continue
      EFILE="${error_loc%%:*}"

      if [ ! -f "$EFILE" ]; then
        continue
      fi

      FILE_CONTENT=$(cat "$EFILE")
      FILE_ERRORS=$(echo "$BUILD_OUTPUT" | grep "$EFILE" | head -15)

      FIX_PROMPT="Fix the TypeScript build errors in this file. This is from an OpenClawCN project after merging upstream OpenClaw changes.

File: ${EFILE}

Build errors:
\`\`\`
${FILE_ERRORS}
\`\`\`

File content:
\`\`\`typescript
${FILE_CONTENT}
\`\`\`

Rules:
1. Fix ONLY the build errors
2. If an import path changed, update the import
3. If a type changed, update the type usage
4. If an export was removed, find the new location or remove the import
5. Do NOT change CN-specific code (marked with OpenClawCN comments)
6. Output the COMPLETE fixed file content. No explanations, no markdown fences."

      FIXED=$(ai_fix "$FIX_PROMPT" 2>/dev/null || true)

      if [ -n "$FIXED" ]; then
        echo "$FIXED" > "$EFILE"
        log "    AI fixed: $EFILE"
        FIXES_APPLIED=$((FIXES_APPLIED + 1))
      fi
    done <<< "$ERROR_FILES"
  done

  error "  Build still failing after $MAX_ROUNDS rounds"
  FIXES_FAILED=$((FIXES_FAILED + 1))
  return 1
}

# ============================================================
# Step 3: Tests
# ============================================================
fix_tests() {
  log "=== Test Fix ==="

  for round in $(seq 1 "$MAX_ROUNDS"); do
    log "  Round $round/$MAX_ROUNDS: Running tests..."

    TEST_OUTPUT=$(pnpm test 2>&1) && {
      ok "  All tests passed!"
      return 0
    }

    log "  Tests failed. Analyzing failures..."

    # Extract failed test info
    FAILED_TESTS=$(echo "$TEST_OUTPUT" | grep -E "FAIL|✗|×|failed" | head -20)
    FAILED_FILES=$(echo "$TEST_OUTPUT" | grep -oE '[a-zA-Z0-9_./-]+\.test\.(ts|tsx|js)' | sort -u | head -10)

    if [ -z "$FAILED_FILES" ]; then
      # Try to extract from vitest output format
      FAILED_FILES=$(echo "$TEST_OUTPUT" | grep -E "^  ❌|^ FAIL" | grep -oE '[a-zA-Z0-9_./-]+\.(ts|tsx|js)' | sort -u | head -10)
    fi

    if [ -z "$FAILED_FILES" ]; then
      warn "  Could not identify failing test files."
      echo "  Last 30 lines of test output:"
      echo "$TEST_OUTPUT" | tail -30 | sed 's/^/    /'
      FIXES_FAILED=$((FIXES_FAILED + 1))
      return 1
    fi

    log "  Failing test files:"
    echo "$FAILED_FILES" | sed 's/^/    /'

    while IFS= read -r testfile; do
      [ -z "$testfile" ] && continue

      if [ ! -f "$testfile" ]; then
        continue
      fi

      # Get the test file and its source file
      TEST_CONTENT=$(cat "$testfile")
      SOURCE_FILE=$(echo "$testfile" | sed 's/\.test\./\./' | sed 's/\.e2e\./\./')
      SOURCE_CONTENT=""
      if [ -f "$SOURCE_FILE" ]; then
        SOURCE_CONTENT=$(cat "$SOURCE_FILE")
      fi

      # Get specific failure output for this file
      FAILURE_OUTPUT=$(echo "$TEST_OUTPUT" | grep -A 20 "$testfile" | head -30)

      FIX_PROMPT="Fix the failing test in this OpenClawCN project. The test broke after merging upstream OpenClaw changes.

Test file: ${testfile}
Source file: ${SOURCE_FILE}

Test failure output:
\`\`\`
${FAILURE_OUTPUT}
\`\`\`

Test file content:
\`\`\`typescript
${TEST_CONTENT}
\`\`\`

$(if [ -n "$SOURCE_CONTENT" ]; then echo "Source file content:
\`\`\`typescript
${SOURCE_CONTENT}
\`\`\`"; fi)

Rules:
1. The source code is CORRECT (it was just merged). Fix the TEST to match.
2. Common causes: function signature changed, new required parameter, return type changed, export renamed
3. If a CN-specific test, make sure CN assertions are preserved
4. If the test imports something that was moved/renamed, update the import
5. Do NOT delete tests — fix them to pass
6. Output the COMPLETE fixed test file content. No explanations, no markdown fences."

      FIXED=$(ai_fix "$FIX_PROMPT" 2>/dev/null || true)

      if [ -n "$FIXED" ]; then
        echo "$FIXED" > "$testfile"
        log "    AI fixed test: $testfile"
        FIXES_APPLIED=$((FIXES_APPLIED + 1))
      fi
    done <<< "$FAILED_FILES"
  done

  error "  Tests still failing after $MAX_ROUNDS rounds"
  FIXES_FAILED=$((FIXES_FAILED + 1))
  return 1
}

# ============================================================
# Run the fix pipeline
# ============================================================
log "Starting AI failure fixer (max ${MAX_ROUNDS} rounds per step)..."
echo ""

LINT_OK=true
BUILD_OK=true
TEST_OK=true

if $RUN_ALL || $LINT_ONLY; then
  fix_lint || LINT_OK=false
  echo ""
fi

if ($RUN_ALL || $BUILD_ONLY) && $LINT_OK; then
  fix_build || BUILD_OK=false
  echo ""
fi

if ($RUN_ALL || $TEST_ONLY) && $LINT_OK && $BUILD_OK; then
  fix_tests || TEST_OK=false
  echo ""
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo "========================================="
echo "  FAILURE FIX SUMMARY"
echo "========================================="
echo "  Lint:     $(if $LINT_OK; then echo 'PASSED ✓'; else echo 'FAILED ✗'; fi)"
echo "  Build:    $(if $BUILD_OK; then echo 'PASSED ✓'; else echo 'FAILED ✗'; fi)"
echo "  Tests:    $(if $TEST_OK; then echo 'PASSED ✓'; else echo 'FAILED ✗'; fi)"
echo "  Fixes applied: ${FIXES_APPLIED}"
echo "  Fixes failed:  ${FIXES_FAILED}"
echo "========================================="

if $LINT_OK && $BUILD_OK && $TEST_OK; then
  ok "All checks passing!"
  exit 0
else
  error "Some checks still failing. Manual intervention needed."
  exit 1
fi

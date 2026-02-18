#!/usr/bin/env bash
# ============================================================
# AI Conflict Resolver Agent
#
# When a merge produces conflicts, this script uses Claude to
# automatically resolve them based on CN injection patterns.
#
# Usage:
#   bash scripts/autopipeline/agent-resolve-conflicts.sh              # Resolve all conflicts
#   bash scripts/autopipeline/agent-resolve-conflicts.sh --dry-run    # Preview only
#
# Prerequisites:
#   - Active merge in progress (git merge state)
#   - claude CLI installed and authenticated
#   - OR ANTHROPIC_API_KEY set
#
# Resolution strategy:
#   Level 1 (auto): Section I files → git checkout --ours
#   Level 2 (AI):   Section II files with markers → Claude resolves
#   Level 3 (skip): Section II files without markers → report for human
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

CONFIG="${REPO_ROOT}/config/cn-protected-files.json"
DRY_RUN=false
MAX_RETRIES=2

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
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

# ============================================================
# Check prerequisites
# ============================================================
CONFLICT_FILES=$(git diff --name-only --diff-filter=U 2>/dev/null || true)
if [ -z "$CONFLICT_FILES" ]; then
  ok "No merge conflicts found."
  exit 0
fi

CONFLICT_COUNT=$(echo "$CONFLICT_FILES" | wc -l | tr -d ' ')
log "Found ${CONFLICT_COUNT} conflicting files"

# Check for Claude CLI or API key
HAS_CLAUDE=false
if command -v claude &>/dev/null; then
  HAS_CLAUDE=true
elif [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  HAS_CLAUDE=true
fi

# ============================================================
# Classify conflicts
# ============================================================
LEVEL1_FILES=()    # Section I → auto-resolve with --ours
LEVEL2_FILES=()    # Section II with markers → AI resolve
LEVEL3_FILES=()    # Section II without markers or unknown → human
OTHER_FILES=()     # Not in any section → try AI, fallback human

# Load Section I files
SECTION1_FILES=""
SECTION1_DIRS=""
if [ -f "$CONFIG" ] && command -v jq &>/dev/null; then
  SECTION1_FILES=$(jq -r '.section1_cn_only.files[]' "$CONFIG" 2>/dev/null || true)
  SECTION1_DIRS=$(jq -r '.section1_cn_only.directories[]' "$CONFIG" 2>/dev/null || true)
fi

# Load Section II files with markers
declare -A SECTION2_MARKERS
if [ -f "$CONFIG" ] && command -v jq &>/dev/null; then
  while IFS= read -r line; do
    path=$(echo "$line" | jq -r '.path')
    marker=$(echo "$line" | jq -r '.marker')
    SECTION2_MARKERS["$path"]="$marker"
  done < <(jq -c '.section2_modified_upstream.files[]' "$CONFIG" 2>/dev/null || true)
fi

# Files with strong CN markers (known to have ===== OpenClawCN: patterns)
MARKER_FILES=(
  "src/auto-reply/reply/get-reply.ts"
  "src/agents/model-fallback.ts"
  "src/config/types.agent-defaults.ts"
  "src/config/defaults.ts"
)

# Files WITHOUT markers (hardest to resolve)
NO_MARKER_FILES=(
  "src/agents/models-config.providers.ts"
)

while IFS= read -r cfile; do
  [ -z "$cfile" ] && continue

  IS_SECTION1=false
  IS_SECTION2=false
  HAS_MARKER=false

  # Check Section I (files)
  if echo "$SECTION1_FILES" | grep -qx "$cfile"; then
    IS_SECTION1=true
  fi

  # Check Section I (directories)
  if ! $IS_SECTION1; then
    while IFS= read -r dir; do
      [ -z "$dir" ] && continue
      dir="${dir%/}"  # Remove trailing slash
      if [[ "$cfile" == "$dir"/* ]]; then
        IS_SECTION1=true
        break
      fi
    done <<< "$SECTION1_DIRS"
  fi

  # Check Section II
  if [ -n "${SECTION2_MARKERS[$cfile]+x}" ]; then
    IS_SECTION2=true
    # Check if it has strong markers
    for mf in "${MARKER_FILES[@]}"; do
      if [ "$cfile" = "$mf" ]; then
        HAS_MARKER=true
        break
      fi
    done
  fi

  if $IS_SECTION1; then
    LEVEL1_FILES+=("$cfile")
  elif $IS_SECTION2 && $HAS_MARKER; then
    LEVEL2_FILES+=("$cfile")
  elif $IS_SECTION2 && ! $HAS_MARKER; then
    LEVEL3_FILES+=("$cfile")
  else
    OTHER_FILES+=("$cfile")
  fi
done <<< "$CONFLICT_FILES"

log ""
log "=== Conflict Classification ==="
log "  Level 1 (auto-ours):    ${#LEVEL1_FILES[@]} files"
log "  Level 2 (AI+markers):   ${#LEVEL2_FILES[@]} files"
log "  Level 3 (hard/human):   ${#LEVEL3_FILES[@]} files"
log "  Other (unknown):        ${#OTHER_FILES[@]} files"
log ""

# ============================================================
# Level 1: Auto-resolve Section I files (keep ours)
# ============================================================
if [ "${#LEVEL1_FILES[@]}" -gt 0 ]; then
  log "--- Level 1: Auto-resolving Section I files ---"
  for f in "${LEVEL1_FILES[@]}"; do
    if $DRY_RUN; then
      echo "  [DRY RUN] git checkout --ours '$f'"
    else
      git checkout --ours "$f" && git add "$f"
      ok "  Resolved (ours): $f"
    fi
  done
fi

# ============================================================
# Level 2: AI-resolve Section II files with markers
# ============================================================
resolve_with_ai() {
  local filepath="$1"
  local marker="${SECTION2_MARKERS[$filepath]:-}"

  # Get the conflicted file content
  local content
  content=$(cat "$filepath")

  # Build the resolution prompt
  local prompt
  prompt=$(cat <<RESOLVE_PROMPT
You are resolving a git merge conflict in the OpenClawCN project. This file has both upstream (OpenClaw) changes and CN-specific modifications that must be preserved.

## File: ${filepath}

## CN Marker Pattern: ${marker}

## Rules:
1. KEEP all CN-specific code blocks marked with:
   - \`// ===== OpenClawCN: [text] =====\` ... \`// ===== END [optional] =====\`
   - \`// ========================================\n// OpenClawCN 专属功能：[text]\`
   - Chinese comments
   - Imports from \`../dispatch/\`, \`./region-cn.js\`, \`./provider-health.js\`, \`./free-model-priority.js\`
   - Functions: applyCnDefaults, routeByModality, dispatchRequest, recordProviderSuccess/Failure
   - Variables: freeModel*, preferDomestic, modalityRouting
2. ACCEPT all upstream changes that don't conflict with CN code
3. If upstream modified code NEAR a CN block, keep BOTH (upstream change + CN block)
4. Remove ALL conflict markers (\`<<<<<<<\`, \`=======\`, \`>>>>>>>\`)
5. The result must be valid TypeScript/JavaScript

## Conflicted File Content:
\`\`\`
${content}
\`\`\`

Output ONLY the resolved file content. No explanations, no markdown fences.
RESOLVE_PROMPT
  )

  local resolved=""

  if command -v claude &>/dev/null; then
    resolved=$(echo "$prompt" | claude --print 2>/dev/null)
  elif [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    local prompt_json
    prompt_json=$(echo "$prompt" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
    resolved=$(curl -s https://api.anthropic.com/v1/messages \
      -H "x-api-key: ${ANTHROPIC_API_KEY}" \
      -H "anthropic-version: 2023-06-01" \
      -H "content-type: application/json" \
      -d "{
        \"model\": \"claude-sonnet-4-5-20250929\",
        \"max_tokens\": 16384,
        \"messages\": [{\"role\": \"user\", \"content\": ${prompt_json}}]
      }" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['content'][0]['text'])" 2>/dev/null)
  fi

  if [ -z "$resolved" ]; then
    return 1
  fi

  # Validate: no conflict markers remain
  if echo "$resolved" | grep -q "^<<<<<<<\|^=======\|^>>>>>>>"; then
    return 1
  fi

  echo "$resolved"
}

if [ "${#LEVEL2_FILES[@]}" -gt 0 ]; then
  log "--- Level 2: AI-resolving Section II files with markers ---"

  if ! $HAS_CLAUDE; then
    warn "  No Claude CLI or API key. Skipping AI resolution."
    LEVEL3_FILES+=("${LEVEL2_FILES[@]}")
    LEVEL2_FILES=()
  fi

  for f in "${LEVEL2_FILES[@]}"; do
    if $DRY_RUN; then
      echo "  [DRY RUN] AI resolve: $f"
      continue
    fi

    log "  Resolving with AI: $f"
    RESOLVED=false

    for attempt in $(seq 1 $MAX_RETRIES); do
      RESULT=$(resolve_with_ai "$f" 2>/dev/null || true)

      if [ -n "$RESULT" ]; then
        # Write the resolved content
        echo "$RESULT" > "$f"

        # Quick syntax check (does it parse?)
        if npx tsc --noEmit --allowJs --skipLibCheck "$f" 2>/dev/null; then
          git add "$f"
          ok "  Resolved (AI): $f"
          RESOLVED=true
          break
        else
          warn "  AI resolution has syntax errors (attempt $attempt/$MAX_RETRIES)"
          # Restore conflicted state
          git checkout --merge "$f" 2>/dev/null || true
        fi
      else
        warn "  AI resolution returned empty (attempt $attempt/$MAX_RETRIES)"
      fi
    done

    if ! $RESOLVED; then
      error "  AI could not resolve: $f → marking for human review"
      LEVEL3_FILES+=("$f")
    fi
  done
fi

# ============================================================
# Level 2.5: Try AI on "other" (unknown) files
# ============================================================
if [ "${#OTHER_FILES[@]}" -gt 0 ] && $HAS_CLAUDE; then
  log "--- Level 2.5: Attempting AI resolution on unknown files ---"

  for f in "${OTHER_FILES[@]}"; do
    if $DRY_RUN; then
      echo "  [DRY RUN] AI attempt: $f"
      continue
    fi

    # For non-Section-II files, simpler prompt: just accept both sides intelligently
    content=$(cat "$f")

    SIMPLE_PROMPT="Resolve this git merge conflict. Accept BOTH sides of changes where possible. If they truly conflict, prefer the LOCAL (ours) version. Remove all conflict markers. Output ONLY the resolved file content.

File: ${f}

\`\`\`
${content}
\`\`\`"

    RESULT=""
    if command -v claude &>/dev/null; then
      RESULT=$(echo "$SIMPLE_PROMPT" | claude --print 2>/dev/null || true)
    fi

    if [ -n "$RESULT" ] && ! echo "$RESULT" | grep -q "^<<<<<<<"; then
      echo "$RESULT" > "$f"
      git add "$f"
      ok "  Resolved (AI-simple): $f"
    else
      warn "  Could not resolve: $f → marking for human review"
      LEVEL3_FILES+=("$f")
    fi
  done
fi

# ============================================================
# Level 3: Report unresolvable files
# ============================================================
REMAINING=$(git diff --name-only --diff-filter=U 2>/dev/null || true)
REMAINING_COUNT=0
if [ -n "$REMAINING" ]; then
  REMAINING_COUNT=$(echo "$REMAINING" | wc -l | tr -d ' ')
fi

echo ""
echo "========================================="
echo "  CONFLICT RESOLUTION SUMMARY"
echo "========================================="
echo "  Total conflicts:    ${CONFLICT_COUNT}"
echo "  Auto-resolved:      ${#LEVEL1_FILES[@]} (Section I → ours)"
echo "  AI-resolved:        $(( CONFLICT_COUNT - REMAINING_COUNT - ${#LEVEL1_FILES[@]} ))"
echo "  Still unresolved:   ${REMAINING_COUNT}"
echo "========================================="

if [ "$REMAINING_COUNT" -gt 0 ]; then
  echo ""
  echo "Unresolved files (manual intervention needed):"
  echo "$REMAINING" | sed 's/^/  - /'
  echo ""
  echo "To resolve manually:"
  echo "  1. Edit the files above"
  echo "  2. git add <resolved-files>"
  echo "  3. git merge --continue"
  exit 1
else
  ok "All conflicts resolved!"
  exit 0
fi

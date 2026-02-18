#!/usr/bin/env bash
# ============================================================
# AI-Powered Upstream Analysis
#
# Reads the structured data from analyze-upstream-diff.sh and
# uses Claude (via claude CLI) to produce a comprehensive
# analysis report saved to docs/upstream-reports/.
#
# Usage:
#   bash scripts/autopipeline/ai-analyze-upstream.sh                          # Auto-detect latest analysis
#   bash scripts/autopipeline/ai-analyze-upstream.sh --input-dir .upstream-analysis/2026-02-16
#   bash scripts/autopipeline/ai-analyze-upstream.sh --no-save                # Print only, don't save
#   bash scripts/autopipeline/ai-analyze-upstream.sh --full-diff              # Include full diffs (verbose)
#
# Prerequisites:
#   - claude CLI installed and authenticated
#   - analyze-upstream-diff.sh has been run first
#
# Output:
#   docs/upstream-reports/YYYY-MM-DD.md
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

INPUT_DIR=""
NO_SAVE=false
FULL_DIFF=false
DATE=$(date +%Y-%m-%d)

# --- Parse arguments ---
for arg in "$@"; do
  case "$arg" in
    --input-dir=*) INPUT_DIR="${arg#*=}" ;;
    --no-save) NO_SAVE=true ;;
    --full-diff) FULL_DIFF=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# Auto-detect latest analysis dir
if [ -z "$INPUT_DIR" ]; then
  INPUT_DIR=$(ls -d "${REPO_ROOT}/.upstream-analysis/"*/ 2>/dev/null | sort -r | head -1)
  if [ -z "$INPUT_DIR" ]; then
    echo "ERROR: No analysis data found. Run analyze-upstream-diff.sh first."
    exit 1
  fi
fi

INPUT_DIR="${INPUT_DIR%/}"  # Remove trailing slash

if [ ! -f "${INPUT_DIR}/manifest.json" ]; then
  echo "ERROR: ${INPUT_DIR}/manifest.json not found."
  exit 1
fi

echo "[$(date +%H:%M:%S)] Starting AI analysis of ${INPUT_DIR}..."

# Check if no changes
STATUS=$(python3 -c "import json; print(json.load(open('${INPUT_DIR}/manifest.json'))['status'])" 2>/dev/null || echo "unknown")
if [ "$STATUS" = "no_changes" ]; then
  echo "No upstream changes to analyze."
  exit 0
fi

# ============================================================
# Build the analysis context
# ============================================================
CONTEXT_FILE=$(mktemp)
trap "rm -f $CONTEXT_FILE" EXIT

cat > "$CONTEXT_FILE" <<'PROMPT_HEADER'
You are an expert code reviewer analyzing upstream changes for the OpenClawCN project (a Chinese localization fork of OpenClaw).

Your task: Analyze the upstream diff data below and produce a comprehensive Markdown report. This report will be saved permanently and used by the team to decide how to handle the merge.

## Project Context

OpenClawCN is a deep fork of OpenClaw with:
- **Section I files**: CN-only files (5,982+) protected by `merge=ours` — these NEVER conflict
- **Section II files**: 14 upstream files with CN code injected — these are the RISK zone
- **Brand rename**: OpenClaw → OpenClawCN naming throughout the codebase
- 5 of 14 Section II files have `===== OpenClawCN:` comment markers delimiting CN injection blocks
- `models-config.providers.ts` is the hardest file — NO markers, CN code in 2 zones

## Section II Files (the 14 risk files)
1. `src/config/defaults.ts` — calls applyCnDefaults()
2. `src/config/auto-detect-env.ts` — CN region detection
3. `src/agents/models-config.ts` — references CN providers
4. `src/agents/models-config.providers.ts` — CN provider list (HARDEST, no markers)
5. `package.json` — CN version, scripts, deps
6. `AGENTS.md` — CN dev conventions
7. `src/auto-reply/reply/get-reply.ts` — modality routing
8. `src/agents/model-fallback.ts` — provider health tracking
9. `src/media-understanding/providers/openai/index.ts` — audio capability fix
10. `src/media-understanding/defaults.ts` — video providers
11. `src/media-understanding/attachments.ts` — document type detection
12. `src/config/types.agent-defaults.ts` — preferDomestic config
13. `ui/src/ui/app-gateway.ts` — UI gateway
14. `ui/src/ui/storage.ts` — storage customizations

## Report Format Required

Produce the report in this EXACT structure:

```markdown
# Upstream Analysis Report — YYYY-MM-DD

## 1. Summary

| Field | Value |
|-------|-------|
| Date | ... |
| Upstream commits | ... |
| Files changed | ... |
| Risk level | `low`/`medium`/`high`/`critical` |
| Section II affected | .../14 |
| Recommendation | `auto-merge`/`agent-resolve`/`manual-review` |

## 2. Commit Analysis

For EACH commit, produce a table row:
| Hash | Author | Category | CN Impact | Summary |

Categories: feature / bugfix / refactor / docs / deps / ci / chore
CN Impact: none / low / medium / high

After the table, write 2-3 sentences summarizing the overall direction of upstream changes.

## 3. CN Impact Assessment

### Section I (auto-protected)
List any Section I files that upstream also changed (these are auto-protected, just note them).

### Section II (needs attention)
For EACH affected Section II file, provide:
- What upstream changed
- Does it overlap with CN injection zones?
- Risk level for this specific file
- Recommended action

## 4. Breaking Change Detection
List any:
- API signature changes
- Type definition changes
- Config format changes
- Export changes
- Major dependency bumps

## 5. Brand Consistency
- New files needing OpenClaw → OpenClawCN rename
- Count of affected files

## 6. Dependency Changes
Summarize package.json changes if any.

## 7. Action Items
Produce a prioritized action list:
- [AUTO] items that will be handled automatically
- [AGENT] items an AI agent can resolve
- [HUMAN] items requiring human review

Each item: file path, what needs to be done, why.
```

PROMPT_HEADER

# Append manifest
echo "" >> "$CONTEXT_FILE"
echo "## Analysis Data" >> "$CONTEXT_FILE"
echo "" >> "$CONTEXT_FILE"
echo '### manifest.json' >> "$CONTEXT_FILE"
echo '```json' >> "$CONTEXT_FILE"
cat "${INPUT_DIR}/manifest.json" >> "$CONTEXT_FILE"
echo '```' >> "$CONTEXT_FILE"

# Append commit list
echo "" >> "$CONTEXT_FILE"
echo '### Commits' >> "$CONTEXT_FILE"
echo '```' >> "$CONTEXT_FILE"
cat "${INPUT_DIR}/commits-oneline.txt" >> "$CONTEXT_FILE"
echo '```' >> "$CONTEXT_FILE"

# Append diff stat
echo "" >> "$CONTEXT_FILE"
echo '### Diff Statistics' >> "$CONTEXT_FILE"
echo '```' >> "$CONTEXT_FILE"
head -50 "${INPUT_DIR}/diff-stat.txt" >> "$CONTEXT_FILE"
echo '... (truncated)' >> "$CONTEXT_FILE"
echo '```' >> "$CONTEXT_FILE"

# Append directory heatmap
echo "" >> "$CONTEXT_FILE"
echo '### Directory Heatmap (top 20 most changed dirs)' >> "$CONTEXT_FILE"
echo '```' >> "$CONTEXT_FILE"
cat "${INPUT_DIR}/dir-heatmap.txt" >> "$CONTEXT_FILE"
echo '```' >> "$CONTEXT_FILE"

# Append new files
if [ -s "${INPUT_DIR}/new-files.txt" ]; then
  echo "" >> "$CONTEXT_FILE"
  echo '### New Files Added by Upstream' >> "$CONTEXT_FILE"
  echo '```' >> "$CONTEXT_FILE"
  head -50 "${INPUT_DIR}/new-files.txt" >> "$CONTEXT_FILE"
  NEW_TOTAL=$(wc -l < "${INPUT_DIR}/new-files.txt" | tr -d ' ')
  if [ "$NEW_TOTAL" -gt 50 ]; then
    echo "... and $((NEW_TOTAL - 50)) more" >> "$CONTEXT_FILE"
  fi
  echo '```' >> "$CONTEXT_FILE"
fi

# Append deleted files
if [ -s "${INPUT_DIR}/deleted-files.txt" ]; then
  echo "" >> "$CONTEXT_FILE"
  echo '### Deleted Files' >> "$CONTEXT_FILE"
  echo '```' >> "$CONTEXT_FILE"
  head -30 "${INPUT_DIR}/deleted-files.txt" >> "$CONTEXT_FILE"
  echo '```' >> "$CONTEXT_FILE"
fi

# Append Section II diffs
if [ -d "${INPUT_DIR}/section2-diffs" ]; then
  for difffile in "${INPUT_DIR}/section2-diffs"/*.diff; do
    if [ -f "$difffile" ]; then
      BASENAME=$(basename "$difffile" .diff)
      echo "" >> "$CONTEXT_FILE"
      echo "### Section II Diff: ${BASENAME}" >> "$CONTEXT_FILE"
      echo '```diff' >> "$CONTEXT_FILE"
      if $FULL_DIFF; then
        cat "$difffile" >> "$CONTEXT_FILE"
      else
        # Truncate large diffs to first 200 lines
        head -200 "$difffile" >> "$CONTEXT_FILE"
        TOTAL_LINES=$(wc -l < "$difffile" | tr -d ' ')
        if [ "$TOTAL_LINES" -gt 200 ]; then
          echo "... (${TOTAL_LINES} lines total, truncated)" >> "$CONTEXT_FILE"
        fi
      fi
      echo '```' >> "$CONTEXT_FILE"
    fi
  done
fi

# Append package.json diff
if [ -f "${INPUT_DIR}/package-diff.txt" ]; then
  echo "" >> "$CONTEXT_FILE"
  echo '### package.json Changes' >> "$CONTEXT_FILE"
  echo '```diff' >> "$CONTEXT_FILE"
  head -100 "${INPUT_DIR}/package-diff.txt" >> "$CONTEXT_FILE"
  echo '```' >> "$CONTEXT_FILE"
fi

# Append brand scan
if [ -f "${INPUT_DIR}/brand-scan.txt" ] && [ -s "${INPUT_DIR}/brand-scan.txt" ]; then
  echo "" >> "$CONTEXT_FILE"
  echo '### Files Needing Brand Rename (OpenClaw → OpenClawCN)' >> "$CONTEXT_FILE"
  echo '```' >> "$CONTEXT_FILE"
  cat "${INPUT_DIR}/brand-scan.txt" >> "$CONTEXT_FILE"
  echo '```' >> "$CONTEXT_FILE"
fi

# Append type changes
if [ -f "${INPUT_DIR}/changed-types.txt" ]; then
  echo "" >> "$CONTEXT_FILE"
  echo '### Changed Type Definition Files' >> "$CONTEXT_FILE"
  echo '```' >> "$CONTEXT_FILE"
  cat "${INPUT_DIR}/changed-types.txt" >> "$CONTEXT_FILE"
  echo '```' >> "$CONTEXT_FILE"
fi

echo "" >> "$CONTEXT_FILE"
echo "---" >> "$CONTEXT_FILE"
echo "Now produce the analysis report following the exact format specified above." >> "$CONTEXT_FILE"

# ============================================================
# Call Claude
# ============================================================
echo "[$(date +%H:%M:%S)] Calling Claude for AI analysis..."
echo "  Context size: $(wc -c < "$CONTEXT_FILE" | tr -d ' ') bytes"

REPORT_FILE="${REPO_ROOT}/docs/upstream-reports/${DATE}.md"

if command -v claude &>/dev/null; then
  REPORT=$(claude --print < "$CONTEXT_FILE" 2>/dev/null)
elif [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  # Fallback: direct API call
  PROMPT_CONTENT=$(cat "$CONTEXT_FILE" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
  REPORT=$(curl -s https://api.anthropic.com/v1/messages \
    -H "x-api-key: ${ANTHROPIC_API_KEY}" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "{
      \"model\": \"claude-sonnet-4-5-20250929\",
      \"max_tokens\": 8192,
      \"messages\": [{\"role\": \"user\", \"content\": ${PROMPT_CONTENT}}]
    }" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['content'][0]['text'])" 2>/dev/null)
else
  echo "ERROR: Neither 'claude' CLI nor ANTHROPIC_API_KEY available."
  echo "  Install claude CLI: npm install -g @anthropic-ai/claude-code"
  echo "  Or set: export ANTHROPIC_API_KEY=sk-ant-..."
  echo ""
  echo "Saving raw analysis data for manual review instead."
  cp "$CONTEXT_FILE" "${REPORT_FILE%.md}.raw-context.md"
  echo "  Saved to: ${REPORT_FILE%.md}.raw-context.md"
  exit 1
fi

# ============================================================
# Save report
# ============================================================
if $NO_SAVE; then
  echo "$REPORT"
else
  mkdir -p "$(dirname "$REPORT_FILE")"

  # Add metadata header
  cat > "$REPORT_FILE" <<HEADER_EOF
<!-- Auto-generated by scripts/autopipeline/ai-analyze-upstream.sh -->
<!-- Source data: ${INPUT_DIR} -->
<!-- Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ) -->

HEADER_EOF
  echo "$REPORT" >> "$REPORT_FILE"

  echo ""
  echo "========================================="
  echo "  AI ANALYSIS COMPLETE"
  echo "========================================="
  echo "  Report saved to: ${REPORT_FILE}"
  echo "  Source data:      ${INPUT_DIR}/"
  echo "========================================="
fi

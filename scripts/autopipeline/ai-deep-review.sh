#!/usr/bin/env bash
# ============================================================
# AI Deep Semantic Code Review
#
# Multi-pass deep code analysis using Claude API. Goes beyond
# the merge-feasibility check of ai-analyze-upstream.sh to
# perform semantic review: logic correctness, API compatibility,
# security, performance, cross-file impact, and CN consistency.
#
# Usage:
#   bash scripts/autopipeline/ai-deep-review.sh --input-dir=.upstream-analysis/2026-02-19/
#   bash scripts/autopipeline/ai-deep-review.sh --input-dir=... --passes=logic,api
#   bash scripts/autopipeline/ai-deep-review.sh --input-dir=... --max-files=20
#
# Prerequisites:
#   - .upstream-analysis/ data collected by analyze-upstream-diff.sh
#   - claude CLI or ANTHROPIC_API_KEY
#
# Output:
#   docs/upstream-reports/DATE-deep-review.md
#
# Exit codes:
#   0 = Review completed (findings may exist)
#   1 = Error (missing data, API failure)
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# --- Defaults ---
INPUT_DIR=""
PASSES="logic,api,security,crossfile,cn"
MAX_FILES=30
OUTPUT_PATH=""
DATE=$(date +%Y-%m-%d)
MODEL="claude-sonnet-4-5-20250929"
MAX_TOKENS=8192

# --- Parse arguments ---
for arg in "$@"; do
  case "$arg" in
    --input-dir=*) INPUT_DIR="${arg#*=}" ;;
    --passes=*) PASSES="${arg#*=}" ;;
    --max-files=*) MAX_FILES="${arg#*=}" ;;
    --output=*) OUTPUT_PATH="${arg#*=}" ;;
    --model=*) MODEL="${arg#*=}" ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

if [ -z "$INPUT_DIR" ]; then
  # Auto-detect latest analysis dir
  INPUT_DIR=$(ls -d "${REPO_ROOT}/.upstream-analysis/"*/ 2>/dev/null | sort -r | head -1)
  if [ -z "$INPUT_DIR" ]; then
    echo "Error: No analysis data found. Run analyze-upstream-diff.sh first."
    exit 1
  fi
fi

if [ ! -d "$INPUT_DIR" ]; then
  echo "Error: Input directory not found: $INPUT_DIR"
  exit 1
fi

if [ -z "$OUTPUT_PATH" ]; then
  mkdir -p "${REPO_ROOT}/docs/upstream-reports"
  OUTPUT_PATH="${REPO_ROOT}/docs/upstream-reports/${DATE}-deep-review.md"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[deep-review][$(date +%H:%M:%S)]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

# --- Check for Claude API access ---
HAS_CLI=false
HAS_API=false

if command -v claude &>/dev/null; then
  HAS_CLI=true
fi

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  HAS_API=true
fi

if ! $HAS_CLI && ! $HAS_API; then
  echo "Error: Need either 'claude' CLI or ANTHROPIC_API_KEY"
  exit 1
fi

# Working directory for intermediate results
WORK_DIR="${INPUT_DIR}/deep-review"
mkdir -p "$WORK_DIR"

# ============================================================
# Data Collection: Import Graph + Signature Extraction
# ============================================================

log "=== Phase 0: Collect supplementary data ==="

MERGE_BASE=$(python3 -c "import json; print(json.load(open('${INPUT_DIR}/manifest.json'))['merge_base']['full'])" 2>/dev/null || echo "")
UPSTREAM_REF="upstream/main"

# Get list of changed .ts files (limited to MAX_FILES)
CHANGED_TS_FILES=()
if [ -f "${INPUT_DIR}/diff-numstat.txt" ]; then
  while IFS= read -r line; do
    file=$(echo "$line" | awk '{print $3}')
    if [[ "$file" == *.ts ]] && [ ${#CHANGED_TS_FILES[@]} -lt "$MAX_FILES" ]; then
      CHANGED_TS_FILES+=("$file")
    fi
  done < "${INPUT_DIR}/diff-numstat.txt"
fi

log "Changed .ts files: ${#CHANGED_TS_FILES[@]} (max: $MAX_FILES)"

# --- Import Graph (regex-based, file-level) ---
collect_import_graph() {
  log "Collecting import graph..."

  # Bug fix: write file list to a temp JSON file instead of embedding in python -c string.
  # Avoids shell injection when file paths contain single quotes or special characters.
  local file_list_json="${WORK_DIR}/changed-ts-files.json"
  if [ ${#CHANGED_TS_FILES[@]} -gt 0 ]; then
    printf '%s\n' "${CHANGED_TS_FILES[@]}" \
      | python3 -c "import json,sys; print(json.dumps([l.rstrip() for l in sys.stdin if l.strip()]))" \
      > "$file_list_json" 2>/dev/null \
      || echo "[]" > "$file_list_json"
  else
    echo "[]" > "$file_list_json"
  fi

  python3 - "$file_list_json" "$REPO_ROOT" "${WORK_DIR}/import-graph.json" <<'PYEOF'
import json, re, os, sys

file_list_path = sys.argv[1]
repo_root      = sys.argv[2]
output_path    = sys.argv[3]

with open(file_list_path, encoding='utf-8') as f:
    changed_files = json.load(f)

graph = {}
import_pattern = re.compile(r'''(?:import|export)\s+.*?\s+from\s+['"]([^'"]+)['"]''')

# Build forward import map for changed files
for filepath in changed_files:
    full_path = os.path.join(repo_root, filepath)
    if not os.path.isfile(full_path):
        continue
    imports = []
    try:
        with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
            for line in f:
                m = import_pattern.search(line)
                if m:
                    imp = m.group(1)
                    if imp.startswith('.'):
                        base_dir = os.path.dirname(filepath)
                        resolved = os.path.normpath(os.path.join(base_dir, imp)).replace('\\', '/')
                        for ext in ['', '.ts', '/index.ts']:
                            candidate = resolved + ext
                            if os.path.isfile(os.path.join(repo_root, candidate)):
                                imports.append(candidate)
                                break
                        else:
                            imports.append(resolved)
                    else:
                        imports.append(imp)
    except Exception:
        pass
    graph[filepath] = {'imports': imports, 'importedBy': []}

# Build reverse map: which files import the changed files
for filepath in changed_files:
    basename = os.path.splitext(os.path.basename(filepath))[0]
    try:
        for root, dirs, files in os.walk(os.path.join(repo_root, 'src')):
            for fname in files:
                if not fname.endswith('.ts'):
                    continue
                fpath = os.path.join(root, fname)
                rel_path = os.path.relpath(fpath, repo_root).replace('\\', '/')
                if rel_path == filepath:
                    continue
                try:
                    with open(fpath, 'r', encoding='utf-8', errors='replace') as fh:
                        content = fh.read()
                    if basename in content and filepath in graph:
                        for m in import_pattern.finditer(content):
                            if basename in m.group(1):
                                graph[filepath]['importedBy'].append(rel_path)
                                break
                except Exception:
                    pass
    except Exception:
        pass

# Compute affected downstream files
all_downstream = set()
changed_set = set(changed_files)
for filepath, data in graph.items():
    for imp_by in data.get('importedBy', []):
        if imp_by not in changed_set:
            all_downstream.add(imp_by)

result = {'nodes': graph, 'affectedDownstream': sorted(all_downstream)}
with open(output_path, 'w', encoding='utf-8') as out:
    json.dump(result, out, indent=2)
PYEOF

  # Fallback if script failed
  [ -f "${WORK_DIR}/import-graph.json" ] || echo '{"nodes":{},"affectedDownstream":[]}' > "${WORK_DIR}/import-graph.json"

  local downstream_count
  downstream_count=$(python3 -c "import json; print(len(json.load(open('${WORK_DIR}/import-graph.json'))['affectedDownstream']))" 2>/dev/null || echo "0")
  ok "Import graph: ${#CHANGED_TS_FILES[@]} nodes, ${downstream_count} downstream files"
}

# --- Signature Extraction (before/after) ---
collect_signatures() {
  log "Extracting exported symbol signatures..."

  local sig_file="${WORK_DIR}/signature-changes.json"
  local changes=()

  for filepath in "${CHANGED_TS_FILES[@]}"; do
    # Skip if not a source file
    [[ "$filepath" == *.test.ts ]] && continue
    [[ "$filepath" == *.spec.ts ]] && continue

    local before_sigs after_sigs
    before_sigs=$(git show "${MERGE_BASE}:${filepath}" 2>/dev/null | grep -E "^export (function|const|type|interface|class|enum|default)" 2>/dev/null | head -50 || echo "")
    after_sigs=$(git show "${UPSTREAM_REF}:${filepath}" 2>/dev/null | grep -E "^export (function|const|type|interface|class|enum|default)" 2>/dev/null | head -50 || echo "")

    if [ "$before_sigs" != "$after_sigs" ]; then
      changes+=("{\"file\":\"${filepath}\",\"before\":$(echo "$before_sigs" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""'),\"after\":$(echo "$after_sigs" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""')}")
    fi
  done

  # Write JSON array
  if [ ${#changes[@]} -gt 0 ]; then
    echo "[" > "$sig_file"
    local first=true
    for c in "${changes[@]}"; do
      if $first; then
        first=false
      else
        echo "," >> "$sig_file"
      fi
      echo "  $c" >> "$sig_file"
    done
    echo "]" >> "$sig_file"
  else
    echo "[]" > "$sig_file"
  fi

  ok "Signature changes: ${#changes[@]} files with changed exports"
}

# Run data collection
collect_import_graph
collect_signatures

# ============================================================
# AI Analysis Passes
# ============================================================

# Helper: call Claude API
call_claude() {
  local prompt_file="$1"
  local output_file="$2"
  local pass_name="$3"

  log "Running AI pass: ${pass_name}..."

  if $HAS_CLI; then
    if claude --print < "$prompt_file" > "$output_file" 2>/dev/null; then
      ok "Pass '${pass_name}' completed via CLI"
      return 0
    fi
  fi

  if $HAS_API; then
    local prompt_content
    prompt_content=$(cat "$prompt_file" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" 2>/dev/null)

    local response
    response=$(curl -s -X POST "https://api.anthropic.com/v1/messages" \
      -H "Content-Type: application/json" \
      -H "x-api-key: ${ANTHROPIC_API_KEY}" \
      -H "anthropic-version: 2023-06-01" \
      -d "{
        \"model\": \"${MODEL}\",
        \"max_tokens\": ${MAX_TOKENS},
        \"messages\": [{\"role\": \"user\", \"content\": ${prompt_content}}]
      }" 2>/dev/null)

    if [ -n "$response" ]; then
      echo "$response" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for block in data.get('content', []):
    if block.get('type') == 'text':
        print(block['text'])
" > "$output_file" 2>/dev/null

      if [ -s "$output_file" ]; then
        ok "Pass '${pass_name}' completed via API"
        return 0
      fi
    fi
  fi

  warn "Pass '${pass_name}' failed (no response)"
  return 1
}

# Check which passes to run
should_run_pass() {
  echo "$PASSES" | tr ',' '\n' | grep -q "^$1$"
}

# --- Collect diff context (shared across passes) ---
DIFF_CONTEXT="${WORK_DIR}/diff-context.txt"
{
  echo "=== Changed Files Summary ==="
  cat "${INPUT_DIR}/diff-stat.txt" 2>/dev/null | head -60 || echo "(no diff-stat)"
  echo ""

  echo "=== Section II File Diffs ==="
  for diff_file in "${INPUT_DIR}/section2-diffs/"*.diff; do
    [ -f "$diff_file" ] || continue
    echo "--- $(basename "$diff_file") ---"
    head -200 "$diff_file"
    echo ""
  done
} > "$DIFF_CONTEXT" 2>/dev/null

# ============================================================
# Pass 1: Logic Correctness
# ============================================================
if should_run_pass "logic"; then
  PROMPT_FILE="${WORK_DIR}/prompt-logic.txt"
  cat > "$PROMPT_FILE" <<'PROMPT_HEADER'
You are a senior code reviewer performing a deep logic analysis on upstream code changes
being merged into a fork project (OpenClawCN, a Chinese localization of OpenClaw).

Analyze the following diffs for:
1. **Logic errors**: Off-by-one errors, incorrect boolean logic, wrong operator precedence
2. **Null/undefined risks**: Missing null checks, optional chaining needed, unhandled undefined
3. **Race conditions**: Async operations without proper awaiting, concurrent state mutations
4. **Edge cases**: Empty arrays/strings, boundary values, division by zero
5. **Error handling**: Uncaught exceptions, missing try/catch, swallowed errors

Output format: JSON array of findings, each with:
{"file": "path", "line_hint": "approx line or function name", "severity": "critical|high|medium|low", "issue": "description", "suggestion": "fix recommendation"}

Output ONLY the JSON array, no other text.

=== DIFFS ===
PROMPT_HEADER

  cat "$DIFF_CONTEXT" >> "$PROMPT_FILE"

  if call_claude "$PROMPT_FILE" "${WORK_DIR}/logic-findings.json" "logic"; then
    # Validate JSON
    python3 -c "import json; json.load(open('${WORK_DIR}/logic-findings.json'))" 2>/dev/null || \
      echo "[]" > "${WORK_DIR}/logic-findings.json"
  else
    echo "[]" > "${WORK_DIR}/logic-findings.json"
  fi
fi

# ============================================================
# Pass 2: API Compatibility
# ============================================================
if should_run_pass "api"; then
  PROMPT_FILE="${WORK_DIR}/prompt-api.txt"
  cat > "$PROMPT_FILE" <<'PROMPT_HEADER'
You are an API compatibility reviewer. Analyze the following upstream changes for breaking changes
in a TypeScript project (OpenClaw → OpenClawCN fork).

Focus on:
1. **Exported function signature changes**: Parameters added/removed/reordered, return type changes
2. **Type/interface changes**: Fields added/removed, type widening/narrowing
3. **Enum changes**: Values added/removed/reordered
4. **Re-export changes**: Index files that change what they export
5. **Import path changes**: Module restructuring that breaks import paths
6. **Default value changes**: Changed defaults that may silently alter behavior

Output format: JSON array of findings, each with:
{"symbol": "functionName/TypeName", "file": "path", "change_type": "signature|type|enum|export|default", "before": "old signature", "after": "new signature", "breaking": true/false, "downstream_impact": "list of files that may break", "severity": "critical|high|medium|low"}

Output ONLY the JSON array, no other text.

=== SIGNATURE CHANGES ===
PROMPT_HEADER

  cat "${WORK_DIR}/signature-changes.json" >> "$PROMPT_FILE"

  echo "" >> "$PROMPT_FILE"
  echo "=== IMPORT GRAPH ===" >> "$PROMPT_FILE"
  cat "${WORK_DIR}/import-graph.json" >> "$PROMPT_FILE"

  echo "" >> "$PROMPT_FILE"
  echo "=== DIFFS ===" >> "$PROMPT_FILE"
  cat "$DIFF_CONTEXT" >> "$PROMPT_FILE"

  if call_claude "$PROMPT_FILE" "${WORK_DIR}/api-findings.json" "api"; then
    python3 -c "import json; json.load(open('${WORK_DIR}/api-findings.json'))" 2>/dev/null || \
      echo "[]" > "${WORK_DIR}/api-findings.json"
  else
    echo "[]" > "${WORK_DIR}/api-findings.json"
  fi
fi

# ============================================================
# Pass 3: Security & Performance
# ============================================================
if should_run_pass "security"; then
  PROMPT_FILE="${WORK_DIR}/prompt-security.txt"
  cat > "$PROMPT_FILE" <<'PROMPT_HEADER'
You are a security and performance reviewer. Analyze the following upstream code changes for:

**Security**:
1. Command injection via unsanitized user input in exec/spawn
2. Path traversal via unsanitized file paths
3. XSS via unescaped HTML output
4. Prototype pollution via unsafe object merging
5. Sensitive data exposure in logs/errors
6. Missing authentication/authorization checks
7. SSRF via user-controlled URLs

**Performance**:
1. O(n^2) or worse algorithms in hot paths
2. Unbounded array/string growth
3. Missing pagination on queries
4. Synchronous I/O in async contexts
5. Memory leaks (event listeners, intervals not cleaned up)
6. Redundant re-computation (missing memoization)

Output format: JSON array of findings, each with:
{"file": "path", "category": "security|performance", "issue": "description", "severity": "critical|high|medium|low", "cwe": "CWE-XXX if applicable", "recommendation": "fix suggestion"}

Output ONLY the JSON array, no other text.

=== DIFFS ===
PROMPT_HEADER

  cat "$DIFF_CONTEXT" >> "$PROMPT_FILE"

  if call_claude "$PROMPT_FILE" "${WORK_DIR}/security-perf-findings.json" "security"; then
    python3 -c "import json; json.load(open('${WORK_DIR}/security-perf-findings.json'))" 2>/dev/null || \
      echo "[]" > "${WORK_DIR}/security-perf-findings.json"
  else
    echo "[]" > "${WORK_DIR}/security-perf-findings.json"
  fi
fi

# ============================================================
# Pass 4: Cross-File Impact
# ============================================================
if should_run_pass "crossfile"; then
  PROMPT_FILE="${WORK_DIR}/prompt-crossfile.txt"
  cat > "$PROMPT_FILE" <<'PROMPT_HEADER'
You are reviewing upstream changes for cross-file impact. The import graph below shows
which files import the changed files. Your job is to identify files that were NOT changed
by upstream but may BREAK due to changes in their dependencies.

Focus on:
1. Files importing changed modules that now have different signatures
2. Files that depend on specific behavior that was changed
3. Type mismatches caused by upstream type changes propagating through imports
4. Config files that reference changed module paths

Output format: JSON array of findings, each with:
{"affected_file": "path", "cause_file": "changed file that causes the break", "reason": "why it may break", "severity": "critical|high|medium|low", "action": "what to check or fix"}

Output ONLY the JSON array, no other text.

=== IMPORT GRAPH ===
PROMPT_HEADER

  cat "${WORK_DIR}/import-graph.json" >> "$PROMPT_FILE"

  echo "" >> "$PROMPT_FILE"
  echo "=== SIGNATURE CHANGES ===" >> "$PROMPT_FILE"
  cat "${WORK_DIR}/signature-changes.json" >> "$PROMPT_FILE"

  echo "" >> "$PROMPT_FILE"
  echo "=== CHANGED FILES SUMMARY ===" >> "$PROMPT_FILE"
  cat "${INPUT_DIR}/diff-stat.txt" 2>/dev/null | head -40 >> "$PROMPT_FILE"

  if call_claude "$PROMPT_FILE" "${WORK_DIR}/cross-file-findings.json" "crossfile"; then
    python3 -c "import json; json.load(open('${WORK_DIR}/cross-file-findings.json'))" 2>/dev/null || \
      echo "[]" > "${WORK_DIR}/cross-file-findings.json"
  else
    echo "[]" > "${WORK_DIR}/cross-file-findings.json"
  fi
fi

# ============================================================
# Pass 5: CN Consistency
# ============================================================
if should_run_pass "cn"; then
  PROMPT_FILE="${WORK_DIR}/prompt-cn.txt"
  cat > "$PROMPT_FILE" <<PROMPT_HEADER
You are reviewing upstream changes for CN (China) localization consistency.
This is a fork (OpenClawCN) that adds Chinese functionality to OpenClaw.

"Section II" files are upstream files where CN code has been injected. These files
have CN markers like:
- // ===== OpenClawCN: [description] =====
- // OpenClawCN 专属功能：
- // CN-PATCH:[name]

The following Section II files have CN injections that MUST be preserved:
$(cat "${REPO_ROOT}/config/cn-protected-files.json" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data.get('section2_modified_upstream', {}).get('files', []):
    path = item.get('path', '')
    marker = item.get('marker', '')
    injection = item.get('cn_injection', '')
    print(f'- {path} (marker: {marker}) — {injection}')
" 2>/dev/null || echo "(config not available)")

Analyze the upstream diffs for these risks:
1. CN injection markers overwritten or corrupted
2. CN function calls removed (e.g., applyCnDefaults, routeByModality, cnGatewayHandlers)
3. CN-specific imports removed
4. Brand references changed (should use OpenClawCN, not OpenClaw)
5. CN API endpoints removed or changed
6. CN environment variable detection logic altered

Output format: JSON array of findings, each with:
{"file": "path", "issue": "what CN injection is at risk", "marker": "the CN marker affected", "severity": "critical|high|medium|low", "action": "what to verify or fix"}

Output ONLY the JSON array, no other text.

=== SECTION II DIFFS ===
PROMPT_HEADER

  for diff_file in "${INPUT_DIR}/section2-diffs/"*.diff; do
    [ -f "$diff_file" ] || continue
    echo "--- $(basename "$diff_file") ---" >> "$PROMPT_FILE"
    cat "$diff_file" >> "$PROMPT_FILE"
    echo "" >> "$PROMPT_FILE"
  done

  if call_claude "$PROMPT_FILE" "${WORK_DIR}/cn-findings.json" "cn"; then
    python3 -c "import json; json.load(open('${WORK_DIR}/cn-findings.json'))" 2>/dev/null || \
      echo "[]" > "${WORK_DIR}/cn-findings.json"
  else
    echo "[]" > "${WORK_DIR}/cn-findings.json"
  fi
fi

# ============================================================
# Aggregate: Generate Markdown Report
# ============================================================
log "=== Generating deep review report ==="

python3 -c "
import json, os, sys
from datetime import datetime

work_dir = '${WORK_DIR}'
date_str = '${DATE}'

def load_findings(filename):
    path = os.path.join(work_dir, filename)
    try:
        with open(path) as f:
            content = f.read().strip()
            # Handle case where Claude wraps JSON in markdown
            if content.startswith('\`\`\`'):
                lines = content.split('\n')
                content = '\n'.join(lines[1:-1] if lines[-1].startswith('\`\`\`') else lines[1:])
            data = json.loads(content)
            return data if isinstance(data, list) else []
    except (FileNotFoundError, json.JSONDecodeError):
        return []

logic = load_findings('logic-findings.json')
api = load_findings('api-findings.json')
security = load_findings('security-perf-findings.json')
crossfile = load_findings('cross-file-findings.json')
cn = load_findings('cn-findings.json')

# Count by severity
def count_severity(findings):
    counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
    for f in findings:
        sev = f.get('severity', 'low').lower()
        counts[sev] = counts.get(sev, 0) + 1
    return counts

all_findings = logic + api + security + crossfile + cn
total_counts = count_severity(all_findings)

report = []
report.append(f'# Deep Semantic Review — {date_str}')
report.append('')
report.append('## Executive Summary')
report.append('')
report.append(f'| Severity | Count |')
report.append(f'|----------|-------|')
report.append(f'| Critical | {total_counts[\"critical\"]} |')
report.append(f'| High     | {total_counts[\"high\"]} |')
report.append(f'| Medium   | {total_counts[\"medium\"]} |')
report.append(f'| Low      | {total_counts[\"low\"]} |')
report.append(f'| **Total**| **{len(all_findings)}** |')
report.append('')

# Pass 1: Logic
report.append('## 1. Logic Correctness')
report.append('')
if logic:
    report.append('| File | Severity | Issue | Suggestion |')
    report.append('|------|----------|-------|------------|')
    for f in logic:
        file = f.get('file', '?')
        sev = f.get('severity', '?')
        issue = f.get('issue', '?').replace('|', '\\|')
        suggestion = f.get('suggestion', '').replace('|', '\\|')
        report.append(f'| \`{file}\` | {sev} | {issue} | {suggestion} |')
else:
    report.append('_No logic issues found._')
report.append('')

# Pass 2: API Compatibility
report.append('## 2. API Compatibility')
report.append('')
breaking = [f for f in api if f.get('breaking')]
non_breaking = [f for f in api if not f.get('breaking')]
if breaking:
    report.append('### Breaking Changes')
    report.append('')
    report.append('| Symbol | File | Change | Before | After | Impact |')
    report.append('|--------|------|--------|--------|-------|--------|')
    for f in breaking:
        report.append(f'| \`{f.get(\"symbol\",\"?\")}\` | \`{f.get(\"file\",\"?\")}\` | {f.get(\"change_type\",\"?\")} | {f.get(\"before\",\"\")[:40]} | {f.get(\"after\",\"\")[:40]} | {f.get(\"downstream_impact\",\"\")} |')
    report.append('')
if non_breaking:
    report.append('### Non-Breaking Changes')
    report.append(f'_{len(non_breaking)} non-breaking API change(s) detected._')
elif not breaking:
    report.append('_No API compatibility issues found._')
report.append('')

# Pass 3: Security & Performance
report.append('## 3. Security & Performance')
report.append('')
sec_findings = [f for f in security if f.get('category') == 'security']
perf_findings = [f for f in security if f.get('category') == 'performance']

if sec_findings:
    report.append('### Security')
    report.append('')
    report.append('| File | Severity | Issue | CWE | Recommendation |')
    report.append('|------|----------|-------|-----|----------------|')
    for f in sec_findings:
        report.append(f'| \`{f.get(\"file\",\"?\")}\` | {f.get(\"severity\",\"?\")} | {f.get(\"issue\",\"?\").replace(\"|\",\"\\\\|\")} | {f.get(\"cwe\",\"—\")} | {f.get(\"recommendation\",\"\").replace(\"|\",\"\\\\|\")} |')
    report.append('')

if perf_findings:
    report.append('### Performance')
    report.append('')
    report.append('| File | Severity | Issue | Recommendation |')
    report.append('|------|----------|-------|----------------|')
    for f in perf_findings:
        report.append(f'| \`{f.get(\"file\",\"?\")}\` | {f.get(\"severity\",\"?\")} | {f.get(\"issue\",\"?\").replace(\"|\",\"\\\\|\")} | {f.get(\"recommendation\",\"\").replace(\"|\",\"\\\\|\")} |')
    report.append('')

if not sec_findings and not perf_findings:
    report.append('_No security or performance issues found._')
    report.append('')

# Pass 4: Cross-File Impact
report.append('## 4. Cross-File Impact')
report.append('')
if crossfile:
    report.append('| Affected File | Caused By | Reason | Severity | Action |')
    report.append('|---------------|-----------|--------|----------|--------|')
    for f in crossfile:
        report.append(f'| \`{f.get(\"affected_file\",\"?\")}\` | \`{f.get(\"cause_file\",\"?\")}\` | {f.get(\"reason\",\"?\").replace(\"|\",\"\\\\|\")} | {f.get(\"severity\",\"?\")} | {f.get(\"action\",\"\").replace(\"|\",\"\\\\|\")} |')
else:
    report.append('_No cross-file impact detected._')
report.append('')

# Pass 5: CN Consistency
report.append('## 5. CN Consistency')
report.append('')
if cn:
    report.append('| File | Issue | Marker | Severity | Action |')
    report.append('|------|-------|--------|----------|--------|')
    for f in cn:
        report.append(f'| \`{f.get(\"file\",\"?\")}\` | {f.get(\"issue\",\"?\").replace(\"|\",\"\\\\|\")} | \`{f.get(\"marker\",\"?\")}\` | {f.get(\"severity\",\"?\")} | {f.get(\"action\",\"\").replace(\"|\",\"\\\\|\")} |')
else:
    report.append('_No CN consistency issues found._')
report.append('')

# Action Items (prioritized)
report.append('## 6. Prioritized Action Items')
report.append('')
critical_high = [f for f in all_findings if f.get('severity', '').lower() in ('critical', 'high')]
if critical_high:
    for f in sorted(critical_high, key=lambda x: 0 if x.get('severity','').lower() == 'critical' else 1):
        sev = f.get('severity', '?').upper()
        issue = f.get('issue', f.get('reason', '?'))
        file = f.get('file', f.get('affected_file', '?'))
        action = f.get('suggestion', f.get('recommendation', f.get('action', '')))
        report.append(f'- **[{sev}]** \`{file}\`: {issue}')
        if action:
            report.append(f'  - Action: {action}')
else:
    report.append('_No critical or high severity findings._')
report.append('')

report.append('---')
report.append(f'*Generated by ai-deep-review.sh on {date_str}*')

# Write report
with open('${OUTPUT_PATH}', 'w', encoding='utf-8') as f:
    f.write('\n'.join(report))

# Write summary counts for CI consumption
summary = {
    'total': len(all_findings),
    'critical': total_counts['critical'],
    'high': total_counts['high'],
    'medium': total_counts['medium'],
    'low': total_counts['low'],
    'passes_run': '${PASSES}'.split(','),
    'files_analyzed': ${#CHANGED_TS_FILES[@]}
}
with open(os.path.join(work_dir, 'summary.json'), 'w') as f:
    json.dump(summary, f, indent=2)

print(f'Report: {len(all_findings)} findings ({total_counts[\"critical\"]} critical, {total_counts[\"high\"]} high)')
" 2>&1

ok "Deep review report saved to: ${OUTPUT_PATH}"

# Output summary for CI
if [ -f "${WORK_DIR}/summary.json" ]; then
  TOTAL=$(python3 -c "import json; print(json.load(open('${WORK_DIR}/summary.json'))['total'])" 2>/dev/null || echo "0")
  CRITICAL=$(python3 -c "import json; print(json.load(open('${WORK_DIR}/summary.json'))['critical'])" 2>/dev/null || echo "0")
  HIGH=$(python3 -c "import json; print(json.load(open('${WORK_DIR}/summary.json'))['high'])" 2>/dev/null || echo "0")

  echo "deep_review_total=${TOTAL}" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true
  echo "deep_review_critical=${CRITICAL}" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true
  echo "deep_review_high=${HIGH}" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true

  log "Summary: ${TOTAL} findings (${CRITICAL} critical, ${HIGH} high)"
fi

log "Deep review complete."

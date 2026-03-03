#!/usr/bin/env bash
# Analyze all 1010 skills and extract external service dependencies
# Outputs:
#   /tmp/skills-deps.tsv          - full TSV with all skills and their URLs
#   /tmp/skills-blocked-candidates.txt - skills with China-blocked domains

SKILLS_DIR="d:/codeknowledge/clawdbot-main/clawdbot-main/skills"
TSV_OUT="/tmp/skills-deps.tsv"
BLOCKED_OUT="/tmp/skills-blocked-candidates.txt"
RAW_OUT="/tmp/skills-blocked-raw.txt"

# Already-deprioritized skills from region-cn.ts
ALREADY_DEPRIORITIZED="gemini nano-banana-pro gog goplaces local-places oracle openai-image-gen openai-whisper-api summarize coding-agent sag spotify-player voice-call gifgrep food-order ordercli bird eightctl slack discord wacli bluebubbles trello linear notion comfy homekit"

# Blocked domains regex (for grep -oiE)
BLOCKED_REGEX='google\.com|googleapis\.com|google\.cloud|youtube\.com|youtu\.be|openai\.com|twitter\.com|/x\.com|facebook\.com|instagram\.com|meta\.com|discord\.com|discord\.gg|slack\.com|spotify\.com|twitch\.tv|reddit\.com|medium\.com|notion\.so|notion\.com|telegram\.org|t\.me|whatsapp\.com|line\.me|dropbox\.com|wttr\.in|tenor\.com|giphy\.com|huggingface\.co|anthropic\.com|amazonaws\.com'

# Human-readable categories
HARD_BLOCKED='google\.com|googleapis\.com|google\.cloud|youtube\.com|youtu\.be|openai\.com|twitter\.com|/x\.com|facebook\.com|instagram\.com|meta\.com|discord\.com|discord\.gg|slack\.com|spotify\.com|twitch\.tv|reddit\.com|medium\.com|notion\.so|notion\.com|telegram\.org|t\.me|whatsapp\.com|line\.me|dropbox\.com|wttr\.in|tenor\.com|giphy\.com'

PARTIAL_BLOCKED='huggingface\.co|anthropic\.com|amazonaws\.com'

# Write TSV header
printf "skill_id\tname\tdescription\thomepage\turls_found\n" > "$TSV_OUT"

# Clear raw output
> "$RAW_OUT"

count=0

for skill_dir in "$SKILLS_DIR"/*/; do
  skill_id=$(basename "$skill_dir")
  skill_file="$skill_dir/SKILL.md"

  if [ ! -f "$skill_file" ]; then
    continue
  fi

  count=$((count + 1))

  # Extract frontmatter fields using awk
  name=$(awk '/^---$/{fm++;next} fm==1 && /^name:/{val=$0; sub(/^name: */, "", val); gsub(/^["'"'"'"]|["'"'"'"]$/, "", val); print val; exit} fm>=2{exit}' "$skill_file")

  description=$(awk '/^---$/{fm++;next} fm==1 && /^description:/{val=$0; sub(/^description: */, "", val); gsub(/^["'"'"'"]|["'"'"'"]$/, "", val); print val; exit} fm>=2{exit}' "$skill_file")

  homepage=$(awk '/^---$/{fm++;next} fm==1 && /^homepage:/{val=$0; sub(/^homepage: */, "", val); gsub(/^["'"'"'"]|["'"'"'"]$/, "", val); print val; exit} fm>=2{exit}' "$skill_file")

  # Clean description for TSV (replace tabs and newlines, truncate)
  description=$(echo "$description" | tr '\t' ' ' | tr '\n' ' ' | cut -c1-200)

  # Extract all URLs from the entire file
  urls=$(grep -oiE 'https?://[a-zA-Z0-9._~:/?#@!$&()*+,;=%-]+' "$skill_file" 2>/dev/null | sed 's/[).,;>]*$//' | sort -u | tr '\n' ' ' | sed 's/ *$//' || true)

  # Write TSV row
  printf "%s\t%s\t%s\t%s\t%s\n" "$skill_id" "$name" "$description" "$homepage" "$urls" >> "$TSV_OUT"

  # Also check for API domain references in body text (without https://)
  api_domains=$(grep -oiE '(api\.openai\.com|api\.slack\.com|api\.twitter\.com|api\.telegram\.org|graph\.facebook\.com|api\.spotify\.com|api\.discord\.com|api\.notion\.com|api\.medium\.com|api\.twitch\.tv|api\.reddit\.com|api\.dropbox\.com|api\.line\.me|api\.whatsapp\.com|api\.giphy\.com|generativelanguage\.googleapis\.com)' "$skill_file" 2>/dev/null | sort -u | tr '\n' ' ' | sed 's/ *$//' || true)

  all_refs="$urls $homepage $api_domains"

  if [ -z "$(echo "$all_refs" | tr -d ' ')" ]; then
    continue
  fi

  # Check for blocked domains
  blocked_found=$(echo "$all_refs" | grep -oiE "$BLOCKED_REGEX" 2>/dev/null | sort -u | tr '\n' ',' | sed 's/,$//' || true)

  if [ -z "$blocked_found" ]; then
    continue
  fi

  # Determine status
  status="NEW - NEEDS REVIEW"
  for dep in $ALREADY_DEPRIORITIZED; do
    if [ "$dep" = "$skill_id" ]; then
      status="ALREADY DEPRIORITIZED"
      break
    fi
  done

  # Categorize
  has_hard=$(echo "$blocked_found" | grep -oiE "$HARD_BLOCKED" 2>/dev/null | head -1 || true)
  has_partial=$(echo "$blocked_found" | grep -oiE "$PARTIAL_BLOCKED" 2>/dev/null | head -1 || true)

  block_type=""
  if [ -n "$has_hard" ] && [ -n "$has_partial" ]; then
    block_type="BLOCKED+PARTIAL"
  elif [ -n "$has_hard" ]; then
    block_type="BLOCKED"
  elif [ -n "$has_partial" ]; then
    block_type="PARTIAL"
  fi

  printf "%s|%s|%s|%s|%s\n" "$skill_id" "$blocked_found" "$block_type" "$status" "$description" >> "$RAW_OUT"
done

# Now format the blocked candidates output nicely
{
  total_blocked=0
  already_dep=0
  needs_review=0

  if [ -f "$RAW_OUT" ] && [ -s "$RAW_OUT" ]; then
    total_blocked=$(wc -l < "$RAW_OUT")
    already_dep=$(grep -c "ALREADY DEPRIORITIZED" "$RAW_OUT" || true)
    needs_review=$(grep -c "NEEDS REVIEW" "$RAW_OUT" || true)
  fi

  echo "=============================================================================="
  echo "  SKILLS WITH CHINA-BLOCKED EXTERNAL SERVICE DEPENDENCIES"
  echo "  Generated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "  Total skills scanned: $count"
  echo "=============================================================================="
  echo ""
  echo "  SUMMARY:"
  echo "  - Total skills with blocked dependencies: $total_blocked"
  echo "  - Already deprioritized in region-cn.ts:  $already_dep"
  echo "  - NEW candidates needing review:          $needs_review"
  echo ""
  echo "=============================================================================="

  if [ ! -s "$RAW_OUT" ]; then
    echo ""
    echo "  No blocked candidates found."
    exit 0
  fi

  echo ""
  echo ""
  echo "=== SECTION 1: ALREADY DEPRIORITIZED (in cnDeprioritizedSkills) ==="
  echo ""
  printf "  %-28s %-14s %-50s %s\n" "SKILL_ID" "BLOCK_TYPE" "BLOCKED_DOMAINS" "DESCRIPTION"
  printf "  %-28s %-14s %-50s %s\n" "----------------------------" "--------------" "--------------------------------------------------" "--------------------------------------------"

  grep "ALREADY DEPRIORITIZED" "$RAW_OUT" | sort | while IFS='|' read -r sid doms btype bstatus desc; do
    printf "  %-28s %-14s %-50s %.70s\n" "$sid" "$btype" "$doms" "$desc"
  done

  echo ""
  echo ""
  echo "=== SECTION 2: NEW - NEEDS REVIEW (not yet deprioritized) ==="
  echo ""
  echo "--- 2a. HARD BLOCKED (google, openai, twitter/x, facebook, discord, slack, etc.) ---"
  echo ""
  printf "  %-28s %-14s %-50s %s\n" "SKILL_ID" "BLOCK_TYPE" "BLOCKED_DOMAINS" "DESCRIPTION"
  printf "  %-28s %-14s %-50s %s\n" "----------------------------" "--------------" "--------------------------------------------------" "--------------------------------------------"

  grep "NEEDS REVIEW" "$RAW_OUT" | grep "|BLOCKED|" | sort | while IFS='|' read -r sid doms btype bstatus desc; do
    printf "  %-28s %-14s %-50s %.70s\n" "$sid" "$btype" "$doms" "$desc"
  done

  echo ""
  echo ""
  echo "--- 2b. HARD + PARTIALLY BLOCKED ---"
  echo ""
  printf "  %-28s %-14s %-50s %s\n" "SKILL_ID" "BLOCK_TYPE" "BLOCKED_DOMAINS" "DESCRIPTION"
  printf "  %-28s %-14s %-50s %s\n" "----------------------------" "--------------" "--------------------------------------------------" "--------------------------------------------"

  grep "NEEDS REVIEW" "$RAW_OUT" | grep "BLOCKED+PARTIAL" | sort | while IFS='|' read -r sid doms btype bstatus desc; do
    printf "  %-28s %-14s %-50s %.70s\n" "$sid" "$btype" "$doms" "$desc"
  done

  echo ""
  echo ""
  echo "--- 2c. PARTIALLY BLOCKED ONLY (huggingface, anthropic, amazonaws - may work with mirrors) ---"
  echo ""
  printf "  %-28s %-14s %-50s %s\n" "SKILL_ID" "BLOCK_TYPE" "BLOCKED_DOMAINS" "DESCRIPTION"
  printf "  %-28s %-14s %-50s %s\n" "----------------------------" "--------------" "--------------------------------------------------" "--------------------------------------------"

  grep "NEEDS REVIEW" "$RAW_OUT" | grep "|PARTIAL|" | sort | while IFS='|' read -r sid doms btype bstatus desc; do
    printf "  %-28s %-14s %-50s %.70s\n" "$sid" "$btype" "$doms" "$desc"
  done

  echo ""
  echo ""
  echo "=============================================================================="
  echo "  DOMAIN FREQUENCY ANALYSIS"
  echo "=============================================================================="
  echo ""
  echo "  Frequency of blocked domains across all flagged skills:"
  echo ""

  cut -d'|' -f2 "$RAW_OUT" | tr ',' '\n' | sed 's/^ *//' | sed 's/ *$//' | grep -v '^$' | sort | uniq -c | sort -rn | while read -r cnt dom; do
    printf "    %4d  %s\n" "$cnt" "$dom"
  done

  echo ""
  echo ""
  echo "=============================================================================="
  echo "  RECOMMENDED ADDITIONS TO cnDeprioritizedSkills"
  echo "=============================================================================="
  echo ""
  echo "  Skills with HARD BLOCKED dependencies that should be added:"
  echo ""

  grep "NEEDS REVIEW" "$RAW_OUT" | grep -E "\|BLOCKED\||BLOCKED\+PARTIAL" | sort | while IFS='|' read -r sid doms btype bstatus desc; do
    printf "    \"%s\",\n" "$sid"
  done

} > "$BLOCKED_OUT"

echo ""
echo "Done! Processed $count skills."
echo "TSV output: $TSV_OUT ($(wc -l < "$TSV_OUT") lines incl. header)"
echo "Blocked candidates: $BLOCKED_OUT"
echo ""

# Quick stats
if [ -s "$RAW_OUT" ]; then
  echo "Quick stats:"
  echo "  Total flagged: $(wc -l < "$RAW_OUT")"
  echo "  Already deprioritized: $(grep -c 'ALREADY DEPRIORITIZED' "$RAW_OUT" || true)"
  echo "  New needs review: $(grep -c 'NEEDS REVIEW' "$RAW_OUT" || true)"
fi

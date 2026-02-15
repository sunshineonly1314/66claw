#!/usr/bin/env bash
# Batch merge upstream security files with brand name replacement
# Usage: bash scripts/merge-upstream-files.sh <file_list>
#
# For each file in the list:
# 1. Check if it has CN-specific code
# 2. If clean: replace from upstream with brand rename
# 3. If CN-specific: skip and log for manual handling
# 4. If file doesn't exist in upstream: skip

set -euo pipefail

UPSTREAM_REF="upstream/main"
CN_PATTERNS="china|wechat|xiaohongshu|openclawcnCN|OpenClawCN|tauri|TAURI|中国|微信|小红书"

UPDATED=0
SKIPPED_CN=0
SKIPPED_MISSING=0
NEW_FILES=0
ERRORS=0

cn_files=""
missing_files=""
error_files=""

while IFS= read -r file; do
  # Skip empty lines and comments
  [[ -z "$file" || "$file" == \#* ]] && continue

  # Check if file exists in upstream
  if ! git show "${UPSTREAM_REF}:${file}" > /dev/null 2>&1; then
    SKIPPED_MISSING=$((SKIPPED_MISSING + 1))
    missing_files="${missing_files}\n  ${file}"
    continue
  fi

  # Check for CN-specific code in local file
  if [ -f "$file" ]; then
    if grep -qiE "$CN_PATTERNS" "$file" 2>/dev/null; then
      SKIPPED_CN=$((SKIPPED_CN + 1))
      cn_files="${cn_files}\n  ${file}"
      continue
    fi
  else
    NEW_FILES=$((NEW_FILES + 1))
    mkdir -p "$(dirname "$file")"
  fi

  # Replace with upstream version
  if git show "${UPSTREAM_REF}:${file}" > "$file" 2>/dev/null; then
    # Apply brand name replacements
    sed -i 's/OpenClawConfig/OpenClawCNConfig/g' "$file"
    sed -i 's/OpenClawSchema/OpenClawCNSchema/g' "$file"
    sed -i 's/types\.openclaw/types.openclawcn/g' "$file"
    UPDATED=$((UPDATED + 1))
  else
    ERRORS=$((ERRORS + 1))
    error_files="${error_files}\n  ${file}"
  fi
done

echo "=== Merge Results ==="
echo "Updated:         $UPDATED"
echo "New files:       $NEW_FILES"
echo "Skipped (CN):    $SKIPPED_CN"
echo "Skipped (miss):  $SKIPPED_MISSING"
echo "Errors:          $ERRORS"

if [ -n "$cn_files" ]; then
  echo -e "\nCN-specific files (manual handling needed):${cn_files}"
fi
if [ -n "$missing_files" ]; then
  echo -e "\nMissing in upstream:${missing_files}"
fi
if [ -n "$error_files" ]; then
  echo -e "\nErrors:${error_files}"
fi

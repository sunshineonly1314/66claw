#!/usr/bin/env bash
# ============================================================
# Setup custom Git merge drivers for CN file protection
# Run once per clone: bash scripts/setup-merge-drivers.sh
#
# This configures the "ours" merge driver referenced in
# .gitattributes so that CN-only files always keep the
# local (CN) version when merging upstream.
# ============================================================
set -euo pipefail

echo "Configuring Git merge drivers for OpenClawCN..."

# The "ours" driver simply keeps the local version (exit 0 = success, keep %A)
git config merge.ours.name "Always keep CN version (merge=ours)"
git config merge.ours.driver true

echo "Done. Merge driver 'ours' is now configured."
echo ""
echo "Verify with: git config merge.ours.driver"
echo "Expected output: true"

# Merge Action Plan — Immediate Actions

## Quick Wins: Can Cherry-Pick Right Now (Low Conflict)

These commits have minimal or no overlap with CN-modified files:

### 1. failover-error.ts — Add 502/503/504 failover (`3c57bf4c85`)
**File:** `src/agents/failover-error.ts` (line ~163)
**Change:** Add `if (status === 502 || status === 503 || status === 504) { return "timeout"; }` after the `status === 408` check
**CN Impact:** We have minor CN modifications but this specific function is untouched
**Risk:** LOW

### 2. errors.ts — Kimi token limit detection (`9bd04849ed`)
**File:** `src/agents/pi-embedded-helpers/errors.ts`
**Change:** Add `lower.includes("model token limit") ||` to `isContextOverflowError()`
**CN Impact:** We modified this file but not this function
**Risk:** LOW

### 3. model-compat.ts — Moonshot developer role (`3640484e28`)
**File:** `src/agents/model-compat.ts`
**Change:** Add `isMoonshot` detection alongside existing CN Doubao/GLM checks
**CN Impact:** We need to MERGE upstream's Moonshot addition WITH our Doubao/GLM additions
**Risk:** MEDIUM — manual merge needed, but straightforward

### 4. deepMerge prototype pollution (`e0aaf2d399`)
**File:** `src/config/includes.ts`
**Change:** Add `BLOCKED_MERGE_KEYS` Set and filter in `deepMerge()`
**CN Impact:** This file is NOT in our modified files list — clean cherry-pick
**Risk:** LOW

### 5. Context overflow error patterns (`69692d0d3a`)
**File:** `src/agents/pi-embedded-helpers/errors.ts`
**Change:** Additional error pattern detection
**CN Impact:** Same file as #2 above, can be combined
**Risk:** LOW

---

## Medium Effort: Require Careful Manual Merge

### 6. mergeProviderModels() rewrite (`15e32c7341`)
**File:** `src/agents/models-config.ts`
**Change:** Rewrite of `mergeProviderModels()` to refresh capability metadata
**CN Impact:** We have extensive modifications to `models-config.providers.ts` but this is in `models-config.ts`
**Action:** Read the current CN `models-config.ts`, compare, adopt upstream rewrite
**Risk:** MEDIUM

### 7. Windows spawn fixes
**Commits:** `a1a1f56841`, `65a1787f92`, `32c66aff49`
**Action:** Cherry-pick individually, test on Windows
**Risk:** MEDIUM

### 8. Atomic session writes (`94eecaa446`)
**Action:** Cherry-pick, test on Windows
**Risk:** MEDIUM

---

## High Effort: Need Dedicated Sessions

### 9. Security sweep (v2026.2.19 — ~30 commits)
**Approach:** Cherry-pick one at a time, test after each
**Start with:** deepMerge (#4 above), then gateway auth, then SSRF, then the rest

### 10. Plugin hook wiring
**Commits:** `7c822d039b`, `ab71fdf821`, `2655041f69`, `d34138dfee`
**CN files affected:** `src/plugins/runtime/index.ts`, `src/plugins/registry.ts`
**Approach:** Read upstream changes, manually integrate into CN-modified files

### 11. Zod schema refactors
**Commits:** `3c6cff5758`, `6e36d956d6`, `cc2a63cd2d`
**CN files affected:** ALL zod-schema*.ts files
**Approach:** Must preserve CN additions (bing, firecrawl, proactiveCompaction, tools.write/browser)

### 12. UI i18n merge
**Commit:** `4b17ce7f48` + follow-ups
**CN files affected:** `ui/src/ui/i18n/locales/zh-CN.ts`
**Approach:** Adopt upstream i18n infrastructure, merge CN translations

---

## Suggested Execution Order

```
Session 1 (NOW): Quick wins #1-#5 — can be done in current session
Session 2: mergeProviderModels rewrite + Windows fixes (#6-#8)
Session 3: Security cherry-picks (#9)
Session 4: Plugin hooks + Zod schemas (#10-#11)
Session 5: UI/i18n merge (#12)
Session 6: Remaining features (Mistral, Gemini search, tools catalog)
Session 7: Full validation test run
```

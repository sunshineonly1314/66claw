# Upstream Release: v2026.2.15 → v2026.2.17

**Commits:** ~979 (794 touching src/ui, 1818 files, +70,607 / -37,069)
**Date Range:** 2026-02-16 to 2026-02-18
**Tag:** `v2026.2.17` → `4134875c31`

---

## Security Fixes (P0)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `b5f551d716` | **YES** | OC-06: Path traversal in config includes | **HIGH** — config/io.ts modified |
| `d1c00dbb7c` | **YES** | Harden include confinement edge cases (#18652) | **HIGH** — config/io.ts |
| `638853c6d2` | **YES** | Sanitize sandbox env vars before Docker launch | MEDIUM |
| `5487c9adeb` | **YES** | Add sandbox env sanitization helpers | MEDIUM |
| `235794d9f6` | **YES** | OC-09: Credential theft via env variable injection | MEDIUM |
| `d4c057f8c1` | **YES** | Set 0o600 on remaining session file write paths | LOW |
| `095d522099` | **YES** | Create session transcript with 0o600 (#18066) | LOW |
| `b0a01fe482` | **YES** | Preflight exec scripts for shell var injection (#18457) | MEDIUM |

## Model & Provider Features (P1)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `c90b09cb02` | **YES** | Anthropic 1M context beta header | LOW |
| `ae2c8f2cf0` | **YES** | Anthropic Sonnet 4.6 support | LOW |
| `2e91552f09` | **YES** | Generic provider API key rotation (#19587) | MEDIUM — auth-profiles |
| `4928717b92` | **YES** | Handle Qwen 3 reasoning in Ollama | LOW |
| `edbc68e9f1` | REVIEW | Z.AI tool_stream for real-time streaming | LOW |
| `960cc11513` | **YES** | Azure AI Foundry URL support | LOW |
| `068260bbea` | **YES** | Azure api-version query param | LOW |

## Windows Fixes (P1 for CN)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `a1a1f56841` | **YES** | Disable detached spawn on Windows (empty output) (#18035) | **CRITICAL** |
| `65a1787f92` | **YES** | Normalize paths to forward slashes for Windows RegExp | **HIGH** |
| `32c66aff49` | **YES** | Add windowsHide: true to spawn | HIGH |
| `94eecaa446` | **YES** | Atomic session store writes (Windows context loss) | **HIGH** |
| `f275611862` | **YES** | Restore SHA-1 in slugifySessionKey (#18503) | MEDIUM |

## Memory & Compaction (P2)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `fa9420069a` | **YES** | MMR re-ranking for search result diversity | MEDIUM |
| `6b3e0710f4` | REVIEW | Opt-in temporal decay for hybrid search scoring | LOW |
| `65aedac20e` | REVIEW | LLM-based query expansion for FTS mode | LOW |
| `153794080e` | **YES** | FTS fallback when no embedding provider (#17725) | MEDIUM |
| `811c4f5e91` | REVIEW | Post-compaction read audit (Layer 3) | LOW |
| `c4f829411f` | REVIEW | Workspace critical rules in compaction summary | LOW |
| `35a3e1b788` | REVIEW | Post-compaction workspace context as system event | MEDIUM |
| `b32ae6fa0c` | **YES** | Isolate managed QMD collections per agent | LOW |
| `65ad9a4262` | **YES** | Fix MMR tie-break and temporal timestamp dedupe | LOW |

## UI / i18n (P1)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `4b17ce7f48` | **CAREFUL** | i18n support (en/zh-CN/zh-TW/pt) | **HIGH** — overlaps our zh-CN.ts |
| `cf44a0c4c1` | **CAREFUL** | Localize language selector and validate locale | MEDIUM |
| `a9c952b13a` | **CAREFUL** | Resolve dynamic import warnings, add zh-TW | MEDIUM |
| `382158fb30` | **YES** | Auto-refresh sessions list after deletion | LOW |
| `daef91800c` | REVIEW | Searchable model picker token matching | LOW |

## Subagent & Agent Runtime (P2)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `5a3a448bc4` | REVIEW | /subagents spawn command | LOW |
| `6931ca7035` | REVIEW | Route nested announce to parent | LOW |
| `de900bace8` | REVIEW | Reset announceRetryCount in replaceSubagentRun | LOW |
| `a6c741eb46` | **YES** | Break infinite announce retry loop (#18264) | MEDIUM |
| `e5eb5b3e43` | **YES** | Stuck loop detection + exponential backoff (#17118) | MEDIUM |
| `b4a90bb743` | REVIEW | Configurable tool loop detection | LOW |
| `8a67016646` | **YES** | Raise bootstrap total cap, warn /context truncation | MEDIUM |

## Process & Platform (P2)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `20957efa46` | **YES** | Graceful process tree termination (SIGTERM→SIGKILL) | MEDIUM |
| `0b8b95f2c9` | **YES** | Prevent gateway crash loop after failed update | **HIGH** — update-startup.ts |
| `b1d5c71609` | **YES** | Standalone script for service restart after update | MEDIUM |
| `e91a5b0216` | **YES** | Release stale session locks + watchdog for hung calls | MEDIUM |

## Plugin Hooks (P1)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `15fe87e6b7` | **YES** | before_message_write plugin hook | MEDIUM |
| `b90eb51520` | **YES** | modelOverride/providerOverride in before_agent_start | MEDIUM |
| `60dc3741c0` | **YES** | Fix before_tool_call hook double-fires (#16852) | LOW |
| `6d31d1ecc6` | **YES** | Enforce high-priority override precedence | LOW |

## Cron Fixes (P2)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `fec4be8dec` | **YES** | Prevent daily jobs skipping days (48h jump) (#17903) | LOW |
| `de6cc05e7e` | **YES** | Prevent spin loop on same-second completion (#17821) | LOW |
| `0ee3480690` | **YES** | Preserve model fallbacks on agent override | LOW |

## Gateway / Config Fixes (P2)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `cb391f4bdc` | **YES** | config.patch: prevent array destruction without id (#18030) | **HIGH** — CN defaults |
| `f4b2fd00bc` | **YES** | Harden object-array merge-by-id fallback | **HIGH** — CN defaults |
| `5d9a026a9e` | **YES** | Hard-cap chat.history oversized payloads | LOW |
| `497e2d76ad` | REVIEW | Channel health monitor with auto-restart | LOW |

## Slack Block Kit (~25 commits)

| Merge? | Description |
|--------|-------------|
| BATCH | New feature: Full Slack Block Kit interaction support |
| | Includes: send/edit blocks, modal submissions, view events, static_select, overflow menus, rich text previews, interaction handler |
| | Low conflict risk — mostly new files |

## Telegram Features (~15 commits)

| Merge? | Description |
|--------|-------------|
| BATCH | Forum topic creation, channel_post support, message reactions |
| | Inline button styles, streaming fixes, voice transcription |
| | Low conflict risk |

## SKIP

| Category | Reason |
|----------|--------|
| Linq channel (iMessage via API) | Not used in CN |
| ~80 refactor(test) deduplication commits | Test infrastructure only |
| Discord audio/voice features | Not critical for CN |

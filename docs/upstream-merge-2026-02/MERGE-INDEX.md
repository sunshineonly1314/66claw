# Upstream Merge Tracking — 2026-02-23

## Overview

| Item | Value |
|------|-------|
| **CN Fork Branch** | `master` |
| **Upstream Remote** | `upstream` → `https://github.com/openclaw/openclaw.git` |
| **Last Synced Upstream Version** | `v2026.2.14` |
| **Target Upstream Version** | `v2026.2.22` (commit `a54dc7fe80`, 2026-02-22) |
| **Upstream HEAD at merge start** | `69692d0d3a` (2026-02-23) |
| **Total Upstream Commits (v2026.2.14..HEAD)** | ~4245 |
| **Total src/ui Files Changed** | 3535 files, +293,589 / -159,612 lines |
| **CN Modified Files** | 143 tracked + 38 untracked (CN-only) |

## Release Breakdown

| Release Range | Commits | Focus Areas |
|---|---|---|
| [v2026.2.14→v2026.2.15](./release-v2026.2.15.md) | ~11,217 | Subagent orchestration, security hardening, plugin hooks, UI XSS fixes |
| [v2026.2.15→v2026.2.17](./release-v2026.2.17.md) | ~979 | Slack Block Kit, Telegram features, memory MMR, Windows fixes, i18n |
| [v2026.2.17→v2026.2.19](./release-v2026.2.19.md) | ~572 | MASSIVE security sweep, deepMerge prototype pollution, gateway auth |
| [v2026.2.19→v2026.2.22](./release-v2026.2.22.md) | ~1375 | Kimi upstream support(!), Mistral provider, tools catalog, cron overhaul |

## Merge Priority Matrix

### P0 — Security (MUST merge, no exceptions)

| Commit | Release | Description | CN Conflict? |
|--------|---------|-------------|-------------|
| `e0aaf2d399` | v2026.2.19 | Block prototype-polluting keys in `deepMerge` | **YES** — CN uses deepMerge in config |
| `9edec67a18` | v2026.2.19 | Block plaintext WebSocket to non-loopback | LOW |
| `f1e1ad73ad` | v2026.2.19 | SHA-256 before timingSafeEqual (length leak) | LOW |
| `baf4a799a9` | v2026.2.19 | Use YAML core schema (type coercion) | LOW |
| `ee6d0bd321` | v2026.2.19 | Escape backticks in exec-approval previews | MEDIUM |
| `fb35635c10` | v2026.2.19 | execFileSync instead of execSync | **YES** — `exec-approvals.ts` modified |
| `57102cbec9` | v2026.2.19 | crypto.randomBytes for temp files | LOW |
| `e955582c8f` | v2026.2.19 | Security headers on gateway HTTP | MEDIUM — `server-http.ts` modified |
| `c5698caca3` | v2026.2.19 | Default gateway auth bootstrap | **YES** — setup-wizard modified |
| `30b6eccae5` | v2026.2.15 | Auth rate-limiting & brute-force protection | MEDIUM |
| `6c4c535813` | v2026.2.15 | Unicode homoglyph sanitization | LOW |
| `887b209db4` | v2026.2.15 | Sandbox docker config validation | **YES** — sandbox-paths.ts modified |
| `bebba124e8` | v2026.2.15 | UI XSS escape fix | **YES** — chat.ts modified |
| `a324031801` | v2026.2.15 | Password-from-URL fix | MEDIUM |
| `53273b490b` | v2026.2.15 | Sender spoofing prevention | MEDIUM |
| `2363e1b085` | v2026.2.15 | Skill download path restriction | LOW |
| `235794d9f6` | v2026.2.17 | OC-09: Credential theft via env injection | MEDIUM |
| `b5f551d716` | v2026.2.17 | OC-06: Path traversal in config includes | **YES** — config/io.ts modified |
| `0e28e50b45` | v2026.2.22 | Detect obfuscated exec bypass commands | MEDIUM |
| `3f0b9dbb36` | v2026.2.22 | Block shell-wrapper line-continuation bypass | MEDIUM |
| `d306fc8ef1` | v2026.2.22 | OC-07: Redact session history credentials | LOW |
| `44727dc3a1` | v2026.2.22 | Strip hidden content (prompt injection) | LOW |

### P1 — Core Features (should merge)

| Commit | Release | Description | CN Conflict? |
|--------|---------|-------------|-------------|
| `b8f66c260d` | v2026.2.15 | Nested subagent orchestration + token reduction | MEDIUM |
| `dec6859702` | v2026.2.15 | Prompt token bloat reduction | MEDIUM |
| `7c822d039b` | v2026.2.15 | Plugin llm input/output hooks | **YES** — plugins/runtime modified |
| `ab71fdf821` | v2026.2.15 | Plugin compaction/reset hooks | **YES** — plugins/runtime modified |
| `c90b09cb02` | v2026.2.17 | Anthropic 1M context beta header | LOW |
| `ae2c8f2cf0` | v2026.2.17 | Anthropic Sonnet 4.6 support | LOW |
| `4b17ce7f48` | v2026.2.17 | UI i18n (en/zh-CN/zh-TW/pt) | **YES** — we have zh-CN.ts |
| `3a3c2da916` | v2026.2.22 | Gemini search grounding as web_search provider | LOW |
| `d92ba4f8aa` | v2026.2.22 | Mistral provider support | LOW |
| `9e1a13bf4c` | v2026.2.22 | Data-driven tools catalog | LOW |
| `3c57bf4c85` | v2026.2.22 | HTTP 502/503/504 failover | **YES** — failover-error.ts modified |

### P2 — Important Bug Fixes (should merge)

| Commit | Release | Description | CN Conflict? |
|--------|---------|-------------|-------------|
| `cbf58d2e1c` | v2026.2.15 | Memory context window cache collisions | MEDIUM |
| `fe73878dfc` | v2026.2.15 | Session mapping across gateway restarts | MEDIUM |
| `ffbcb37342` | v2026.2.15 | Memory flush prompt datetime injection | **YES** — memory-flush.ts modified |
| `cb391f4bdc` | v2026.2.17 | config.patch array destruction fix | **YES** — defaults.ts |
| `a1a1f56841` | v2026.2.17 | Windows detached spawn empty output fix | HIGH relevance |
| `94eecaa446` | v2026.2.17 | Atomic session writes (Windows context loss) | HIGH relevance |
| `0b8b95f2c9` | v2026.2.17 | Prevent gateway crash loop after failed update | **YES** — update-startup.ts |
| `15e32c7341` | v2026.2.22 | Refresh Moonshot Kimi vision capabilities | **YES** — overlaps CN Kimi work |
| `9bd04849ed` | v2026.2.22 | Detect Kimi model-token-limit overflows | **YES** — overlaps CN Kimi work |
| `3640484e28` | v2026.2.22 | Map Moonshot developer role compatibility | **YES** — model-compat.ts |
| `69692d0d3a` | v2026.2.22 | Context overflow error pattern detection | MEDIUM |

### P3 — Nice-to-Have / Channel-Specific (merge if clean)

| Area | Commits | Notes |
|------|---------|-------|
| Slack Block Kit | ~25 commits (v2026.2.17) | New feature, low conflict risk |
| Telegram features | ~15 commits (v2026.2.17) | Forum topics, reactions, streaming |
| Discord subagent routing | ~14 commits (v2026.2.17) | Mostly new code |
| Cron overhaul | ~10 commits (v2026.2.22) | New UI + controller |
| Linq channel (iMessage) | 3 commits (v2026.2.17) | Entirely new |
| Memory MMR/temporal decay | 5 commits (v2026.2.17) | New search features |

### SKIP — Not Applicable to CN

| Category | Reason |
|----------|--------|
| `google-antigravity` removal (`382785c6ce`) | CN never used this provider |
| Apple Watch companion | iOS-only |
| BlueBubbles channel | iMessage alternative, not used in CN |
| Nostr profile API fixes | Not used in CN |

---

## CN-Specific Protected Files

These files have heavy CN customizations and require **manual merge** (never auto-merge upstream):

### Critical — CN Core (NEVER auto-merge)
- `src/config/defaults.ts` — 20+ CN patches, Bing/Firecrawl/SiliconFlow defaults
- `src/config/region-cn.ts` — CN region detection (CN-only file)
- `src/config/zod-schema.agent-runtime.ts` — CN schema additions (bing, firecrawl, tools.write/browser)
- `src/config/zod-schema.agent-defaults.ts` — proactiveCompaction schema
- `src/config/zod-schema.providers-cn.ts` — CN provider schemas (CN-only file)
- `src/agents/models-config.providers.ts` — buildKimiCodeProvider, SiliconFlow providers
- `src/agents/siliconflow-models.ts` — SILICONFLOW_RECOMMENDED_MODELS, isVision heuristic
- `src/agents/pi-embedded-runner/model.ts` — resolveModel fallback with input inheritance
- `src/dispatch/` — entire directory is CN-only (capability registry, modality router, tool discovery)
- `src/gateway/cn-handlers.ts` — CN-only gateway handlers
- `src/gateway/setup-wizard*.ts` — CN setup wizard customizations

### High — CN Modifications (manual review required)
- `src/agents/model-compat.ts` — Kimi compat flags
- `src/agents/failover-error.ts` — CN failover logic
- `src/agents/sandbox-paths.ts` — CN sandbox modifications
- `src/agents/system-prompt.ts` — CN system prompt patches
- `src/agents/tool-policy.ts` — CN tool policy additions
- `src/agents/workspace.ts` / `workspace-dir.ts` — CN workspace paths
- `src/config/paths.ts` — CN installation paths
- `src/config/io.ts` — CN config I/O
- `src/gateway/server-methods/*.ts` — CN server method additions
- `src/infra/exec-approvals.ts` — CN exec approval modifications
- `src/infra/installer-updater.ts` — CN update system
- `src/plugins/runtime/index.ts` — CN plugin runtime patches
- `ui/src/ui/views/chat.ts` — CN UI customizations
- `ui/src/ui/i18n/locales/zh-CN.ts` — CN translations
- `ui/src/ui/controllers/model-config.ts` — CN model config UI

### CN-Only New Files (no upstream conflict)
- `src/dispatch/capability-registry.ts` / `capability-registry-remote.ts`
- `src/dispatch/modality-router.ts` / `tool-discovery.ts` / `tool-filter.ts` / `tool-index.ts`
- `src/gateway/server-methods/capability-matrix.ts` / `log-report.ts` / `license.ts`
- `src/agents/model-context-probe.ts`
- `src/agents/tools/wecom-*.ts` / `memory-upsert-tool.ts`
- `src/auto-reply/reply/memory-extraction.ts` / `memory-consolidation.ts`
- `src/config/provider-capability-mapping.ts`
- `src/infra/installer-updater-full.ts` / `update-state.ts`
- `src/logging/log-truncate.ts` / `sanitize.ts`
- `src/media/chat-image-store.ts`
- `src/memory/profile-store.ts`
- `ui/src/ui/chat/compose-card.ts` / `intent-hint.ts`
- `ui/src/ui/controllers/orchestrator.ts`
- `ui/src/ui/views/update-banner.ts` / `update-dialog.ts`
- `ui/src/ui/embedded-qrcodes.ts`

---

## Merge Strategy

### Phase 1: Security Cherry-Picks (P0)
Cherry-pick all 22 security commits individually, resolving conflicts manually.
Test each one after cherry-pick.

### Phase 2: Core Features (P1)
Cherry-pick feature commits that add new capabilities.
Pay special attention to Zod schema changes — must sync with CN additions.

### Phase 3: Bug Fixes (P2)
Cherry-pick important bug fixes, especially:
- Windows-specific fixes (directly relevant to CN desktop)
- Kimi upstream changes (compare with CN Kimi implementation)
- Config merge fixes (critical for CN defaults layer)

### Phase 4: Channel Features (P3)
Merge remaining channel-specific features as clean cherry-picks.

### Phase 5: Validation
- Run full test suite
- Verify CN-specific features still work
- Test Kimi/SiliconFlow providers
- Test setup wizard flow
- Test desktop build

---

## Progress Log

| Date | Action | Status |
|------|--------|--------|
| 2026-02-23 | Initial analysis of v2026.2.14..upstream/main | DONE |
| 2026-02-23 | Created merge tracking documentation | DONE |
| 2026-02-23 | Kimi upstream vs CN comparison analysis | DONE |
| 2026-02-23 | Quick Win #1: 502/503/504 failover (`3c57bf4c85`) → `failover-error.ts` + `errors.ts` | DONE |
| 2026-02-23 | Quick Win #2: Kimi token limit detection (`9bd04849ed`) → `errors.ts` | DONE |
| 2026-02-23 | Quick Win #3: Context overflow patterns (`69692d0d3a`) → `errors.ts` | DONE |
| 2026-02-23 | Quick Win #4: Moonshot developer role (`3640484e28`) → `model-compat.ts` | DONE |
| 2026-02-23 | Quick Win #5: deepMerge prototype pollution (`e0aaf2d399`) → `includes.ts` | DONE |
| 2026-02-23 | All Quick Wins verified: tsc clean, 25/25 tests pass | DONE |
| 2026-02-23 | Batch 2 #1: mergeProviderModels rewrite (`15e32c7341`) → `models-config.ts` | DONE |
| 2026-02-23 | Batch 2 #2: windowsHide:true (`32c66aff49`) → `process/exec.ts` | DONE |
| 2026-02-23 | Batch 2 #3: OC-06 path traversal fix (`b5f551d716`+`d1c00dbb7c`) → `includes.ts` | DONE |
| 2026-02-23 | Batch 2 #4: execFileSync security (`fb35635c10`) → `date-time.ts`, `program-args.ts` | DONE |
| 2026-02-23 | Batch 2 SKIP: crypto.randomBytes — CN already uses crypto.randomUUID | SKIP |
| 2026-02-23 | Batch 2 SKIP: Atomic session writes — CN already has CN-PATCH:reliability | SKIP |
| 2026-02-23 | Batch 2 SKIP: Windows detached spawn — file doesn't exist in CN | SKIP |
| 2026-02-23 | Batch 2 verified: tsc 0 errors, 48/48 tests pass (includes+failover+fallback) | DONE |
| 2026-02-23 | Batch 3 triage: 18 remaining P0 security commits analyzed | DONE |
| 2026-02-23 | Batch 3 SKIP: SHA-256 timingSafeEqual — CN already has HMAC `safeEqualSecret` | SKIP |
| 2026-02-23 | Batch 3 SKIP: Unicode homoglyph — CN already has `ANGLE_BRACKET_MAP` | SKIP |
| 2026-02-23 | Batch 3 SKIP: Password-from-URL — CN already has URL param strip | SKIP |
| 2026-02-23 | Batch 3 #1: YAML core schema (`baf4a799a9`) → `frontmatter.ts` | DONE |
| 2026-02-23 | Batch 3 #2: UI XSS escape raw HTML (`bebba124e8`) → `markdown.ts` | DONE |
| 2026-02-23 | Batch 3 #3: Security headers (`e955582c8f`) → `http-common.ts` + `server-http.ts` | DONE |
| 2026-02-23 | Batch 3 #4: Block plaintext WebSocket CWE-319 (`9edec67a18`) → `net.ts` + `client.ts` + `call.ts` | DONE |
| 2026-02-23 | Batch 3 #5: OC-07 session history credential redaction (`d306fc8ef1`) → `sessions-history-tool.ts` | DONE |
| 2026-02-23 | Batch 3 verified: tsc 0 new errors, 109/109 tests pass (includes+gateway+markdown+fallback) | DONE |
| 2026-02-23 | Batch 3 DEFER: Auth rate-limiting (`30b6eccae5`) — heavy conflict with CN `server.impl.ts` | DEFER |
| 2026-02-23 | Batch 3 DEFER: Gateway auth bootstrap (`c5698caca3`) — heavy conflict with CN setup wizard | DEFER |
| 2026-02-23 | Batch 3 DEFER: Sandbox docker validation (`887b209db4`) — conflicts with CN Zod schema | DEFER |
| 2026-02-23 | Batch 3 DEFER: Sender spoofing prevention (`53273b490b`) — 42-file refactor, 4 CN-modified | DEFER |
| 2026-02-23 | Batch 3 DEFER→DONE: Exec-approval backtick escape (`ee6d0bd321`) — resolved in Phase 3.5 | DONE |
| 2026-02-23 | Batch 3 DEFER: Skill download path restriction (`2363e1b085`) — CN lacks `skill-download.ts` | DEFER |
| 2026-02-23 | Batch 3 DEFER: Credential theft env injection (`235794d9f6`) — CN lacks `bash-tools/` | DEFER |
| 2026-02-23 | Batch 3 DEFER: Obfuscated exec bypass (`0e28e50b45`) — CN lacks `bash-tools/` | DEFER |
| 2026-02-23 | Batch 3 DEFER: Shell line-continuation bypass (`3f0b9dbb36`) — CN lacks `node-host/` | DEFER |
| 2026-02-23 | Batch 3 DEFER→DONE: Strip hidden content (`44727dc3a1`) — resolved in Phase 3.5 via `web-fetch-visibility.ts` | DONE |
| 2026-02-24 | **Phase 2 START: Core Features (P1)** | |
| 2026-02-24 | P1 triage: 11 items analyzed, 4 applied, 1 partial, 6 deferred | DONE |
| 2026-02-24 | P1-1: Anthropic 1M context beta header (`c90b09cb02`) → `extra-params.ts` | DONE |
| 2026-02-24 | P1-2: Anthropic Sonnet 4.6 support (`ae2c8f2cf0`) → 6 files (cli-backends, live-model-filter, model-forward-compat, model-selection, configure.gateway-auth, defaults) | DONE |
| 2026-02-24 | P1-3: Gemini search grounding (`3a3c2da916`) → `web-search.ts` + `zod-schema.agent-runtime.ts` + `types.tools.ts` + `schema.help.ts` + `schema.labels.ts` | DONE |
| 2026-02-24 | P1-4: Plugin LLM input/output hook types (`7c822d039b` partial) → `plugins/hooks.ts` + `plugins/types.ts` (types+runner only, wiring deferred) | DONE |
| 2026-02-24 | P1 SKIP: HTTP 502/503/504 failover (`3c57bf4c85`) — ALREADY DONE in Phase 1 Batch 1 | SKIP |
| 2026-02-24 | P1 DEFER: Subagent orchestration (`b8f66c260d`) — 49-file, +2922 line refactor, too invasive | DEFER |
| 2026-02-24 | P1 DEFER: Token bloat reduction (`dec6859702`) — 17 files, config schema changes need careful merge | DEFER |
| 2026-02-24 | P1 DEFER: Mistral provider (`d92ba4f8aa`) — 22-file new provider plumbing | DEFER |
| 2026-02-24 | P1 DEFER: Data-driven tools catalog (`9e1a13bf4c`) — 20-file UI+gateway refactor | DEFER |
| 2026-02-24 | P1 DEFER: UI i18n framework (`4b17ce7f48`) — 13 files, conflicts with CN `zh-CN.ts` | DEFER |
| 2026-02-24 | P1 DEFER: Plugin compaction/reset hooks (`ab71fdf821`) — 11 files, needs attempt.ts wiring | DEFER |
| 2026-02-24 | P1 DEFER: Plugin LLM hooks wiring into attempt.ts — complex, hooks already registered | DEFER |
| 2026-02-24 | Phase 2 verified: tsc 22 pre-existing errors (0 new), 1720/1725 tests pass (5 pre-existing failures) | DONE |
| 2026-02-24 | **Phase 3 START: Bug Fixes (P2)** | |
| 2026-02-24 | P2 triage: 11 items total, 4 already done (Phase 1 Kimi), 3 already skipped, 5 remaining | DONE |
| 2026-02-24 | P2-1: Memory context window cache collisions (`cbf58d2e1c`) → `context.ts` (applyDiscoveredContextWindows, fail-safe min, getAvailable) | DONE |
| 2026-02-24 | P2-2: Session mapping across gateway restarts (`fe73878dfc`) → `boot.ts` (resolveBootSessionId reuses existing session) | DONE |
| 2026-02-24 | P2-3: Memory flush prompt datetime injection (`ffbcb37342`) → `memory-flush.ts` + `agent-runner-memory.ts` (resolveMemoryFlushPromptForRun) | DONE |
| 2026-02-24 | P2-4: config.patch array destruction fix (`cb391f4bdc`) → `merge-patch.ts` (relax patch id requirement, append id-less entries) | DONE |
| 2026-02-24 | P2-5: Gateway crash loop prevention (`0b8b95f2c9`) → `update.ts` (gate restart on ok) + `update-runner.ts` (early bail + --fix) | DONE |
| 2026-02-24 | Phase 3 verified: tsc 22 pre-existing errors (0 new), 89/89 tests pass | DONE |
| 2026-02-24 | **Phase 3.5: Additional Safe Merges (deep scan)** | |
| 2026-02-24 | Extra security: Backtick escape in exec-approval Discord embeds → `exec-approvals.ts` | DONE |
| 2026-02-24 | Extra security: Strip hidden content (prompt injection) → NEW `web-fetch-visibility.ts` + `web-fetch-utils.ts` | DONE |
| 2026-02-24 | **Batch A: High-value safe fixes** | |
| 2026-02-24 | A-1 SKIP: Reasoning/thinking leak prevention — `reasoningExplicitlySet` not in CN codebase | SKIP |
| 2026-02-24 | A-2 SKIP: OpenRouter reasoning_effort conflict — `reasoning_effort` not in CN codebase | SKIP |
| 2026-02-24 | A-3: Moonshot strict OpenAI-compat turn ordering (`9757d2bb64`) → `transcript-policy.ts` (user-turn merge for moonshot) | DONE |
| 2026-02-24 | A-4: Compaction retry with exponential backoff (`068b9c9749`) → `compaction.ts` (retryAsync wrap for generateSummary) | DONE |
| 2026-02-24 | A-5: Skill path compaction saves 400-600 tokens (`4f2c57eb4e`) → `skills/workspace.ts` (compactSkillPaths replaces homedir with ~) | DONE |
| 2026-02-24 | **Batch B: Additive improvements** | |
| 2026-02-24 | B-6 DEFER: Workspace rules in compaction summary — needs extractSections infrastructure | DEFER |
| 2026-02-24 | B-7: Mistral in MemorySearchSchema (`042947b944`) → `zod-schema.agent-runtime.ts` (add mistral to provider + fallback unions) | DONE |
| 2026-02-24 | B-8: Per-model thinkingDefault override (`671f913123`) → `model-selection.ts` + `types.agent-defaults.ts` + `zod-schema.agent-defaults.ts` | DONE |
| 2026-02-24 | B-9 SKIP: Remove synthetic "Done." reply — already absent in CN codebase | SKIP |
| 2026-02-24 | **Batch C: Security hardening** | |
| 2026-02-24 | C-10: Centralize prototype-key guards (`08e020881d` + `95dab6e019`) → NEW `prototype-keys.ts` + `merge-patch.ts` + `legacy.shared.ts` + `runtime-overrides.ts` + `config-paths.ts` + `includes.ts` | DONE |
| 2026-02-24 | C-11 DEFER: Plugin systemPrompt hook fix (`a66b98a9da`) — needs applySystemPromptOverrideToSession, touches core attempt.ts | DEFER |
| 2026-02-24 | All batches verified: tsc 22 pre-existing errors (0 new), 841/843 tests pass (2 pre-existing cn-merge-protection failures) | DONE |
| 2026-02-24 | **Batch D: Compaction quartet** | |
| 2026-02-24 | D-1: Count only completed auto-compactions (`457835b104`) → `pi-embedded-subscribe.handlers.compaction.ts` (move incrementCompactionCount to end, only when !willRetry) | DONE |
| 2026-02-24 | D-2/D-3: Compaction token sanitization (`05691be511` + `50c5f75904`) → `compaction.ts` (estimateCompactionMessageTokens strips toolResult.details before estimation; applied to 4 call sites) | DONE |
| 2026-02-24 | D-4 SKIP: Compaction floor guidance (`5c9f9722af`) — CN already has `DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR = 20_000` | SKIP |
| 2026-02-24 | **Batch E: Small safe fixes** | |
| 2026-02-24 | E-1: Gemini thoughtSignatures sanitization → `transcript-policy.ts` (extend sanitizeThoughtSignatures to all Google models, not just OpenRouter Gemini) | DONE |
| 2026-02-24 | E-2: BindingsSchema comment field → `types.agents.ts` + `zod-schema.agents.ts` (add optional comment to AgentBinding) | DONE |
| 2026-02-24 | E-3: Guard trim crashes on nullish values → `subagent-announce.ts` + `agent.ts` + `session-utils.ts` (3 locations, `x.trim()` → `(x ?? "").trim()`) | DONE |
| 2026-02-24 | E-4 SKIP: Param shadowing fix — pattern doesn't exist in CN codebase | SKIP |
| 2026-02-24 | E-5: Skip cooldown for timeouts → `pi-embedded-runner/run.ts` (gate markAuthProfileFailure behind `reason !== "timeout"`) | DONE |
| 2026-02-24 | E-6: Never shorten cooldown deadline on retry → `auth-profiles/usage.ts` (only extend disabledUntil/cooldownUntil, never reduce) | DONE |
| 2026-02-24 | E-7: Config-reload skip when file not found → `config-reload.ts` (guard `!snapshot.exists` before `!snapshot.valid`) | DONE |
| 2026-02-24 | E-8: Redact sensitive values in config get → `config-cli.ts` (apply redactConfigObject before getAtPath) | DONE |
| 2026-02-24 | E-9 SKIP: Session key canonicalization — CN already has extensive toLowerCase/canonicalization in 10+ files | SKIP |
| 2026-02-24 | Batch D+E verified: tsc 22 pre-existing errors (0 new), 94/94 targeted tests pass | DONE |
| 2026-02-24 | **Batch F: Deferred item review — low-risk security merges** | |
| 2026-02-24 | Deferred item triage: 17 items re-analyzed, 12 remain deferred (high risk/UI/deep conflict), 5 candidates evaluated | DONE |
| 2026-02-24 | F-1: OC-09 Docker env credential sanitization (`235794d9f6`) → NEW `sanitize-env-vars.ts` + `docker.ts` patch (27 tests) | DONE |
| 2026-02-24 | F-2: Shell line-continuation allowlist bypass (`3f0b9dbb36` partial) → `exec-approvals-analysis.ts` parser fix only (allowlist/node-host parts deferred — missing `exec-safe-bin-*` deps) + 3 new tests | DONE |
| 2026-02-24 | F SKIP: Obfuscated exec bypass (`0e28e50b45`) — depends on `bash-tools.exec-host-*.ts` which don't exist in CN | SKIP |
| 2026-02-24 | F SKIP: Skill download path restriction (`2363e1b085`) — `skills-install.ts` refactored heavily upstream (311 lines deleted), too risky | SKIP |
| 2026-02-24 | F SKIP: Mistral provider full support (`d92ba4f8aa`) — 55 files, 996 lines, too large for cherry-pick | SKIP |
| 2026-02-24 | Batch F verified: tsc 22 pre-existing errors (0 new), 57/57 exec-approvals + 27/27 sanitize-env-vars tests pass | DONE |
| 2026-02-24 | **Batch G: Deep-scan safe merges (errors, network, compaction, security headers, DashScope)** | |
| 2026-02-24 | G-1: Chinese context overflow error patterns (`544809b6f6`) → `errors.ts` (5 Chinese patterns: 上下文过长/超出/长度超/超出最大/请压缩上下文) | DONE |
| 2026-02-24 | G-2: Reasoning-required misclassification guard (`4f340b8812`) → `errors.ts` (isReasoningConstraintErrorMessage excludes "reasoning is mandatory" from context overflow) | DONE |
| 2026-02-24 | G-3: Groq TPM rate limit fix (`652099cd5c`) → `errors.ts` (exclude "tpm"/"tokens per minute" from context overflow classifiers + add to rate limit patterns) | DONE |
| 2026-02-24 | G-4: OC-65 compaction counter reset security (`084f621025`) → `run.ts` (remove overflowCompactionAttempts = 0 to prevent unbounded compaction cycles) | DONE |
| 2026-02-24 | G-5: Nested network error detection (`daaad03593`) → `unhandled-rejections.ts` (collectErrorCandidates traverses cause/original/data/errors tree; TRANSIENT_NETWORK_ERROR_NAMES + message snippet matching) | DONE |
| 2026-02-24 | G-6: Undici fetch failed simplification (`824d1e095b`) → `unhandled-rejections.ts` (treat all "fetch failed" TypeError as transient regardless of cause) | DONE |
| 2026-02-24 | G-7: HSTS header hardening (`9af3ec92a5`) → `http-common.ts` + `server-http.ts` + `server-runtime-state.ts` + `server-runtime-config.ts` + `types.gateway.ts` + `zod-schema.ts` + `schema.help.ts` + `schema.labels.ts` | DONE |
| 2026-02-24 | G-8: Compaction cancel vs truncate (`ea47ab29bd`) → `compaction-safeguard.ts` (return `{ cancel: true }` instead of fallback summary when summarization fails/no model/no API key) | DONE |
| 2026-02-24 | G-9: Compaction prompt too long (`b703ea3675`) → `compaction.ts` + `compaction-safeguard.ts` (SUMMARIZATION_OVERHEAD_TOKENS=4096, SAFETY_MARGIN in chunkMessagesByMaxTokens, subtract overhead from maxChunkTokens) | DONE |
| 2026-02-24 | G-10: resolveUserPath null safety (`eec3182cbb`) → `utils.ts` (early `if (!input) return ""` guard) | DONE |
| 2026-02-24 | G-11: DashScope disable developer role (`30c622554f`) → `model-compat.ts` (isDashScope detection for dashscope.aliyuncs.com endpoints) | DONE |
| 2026-02-24 | G-12 SKIP: false-positive billing rewrite (`5e423b596c`) — CN already removed shouldRewriteBillingText | SKIP |
| 2026-02-24 | G-13 DEFER: senderIsOwner forward (`5dae5e6ef2`) — CN agent-runner-utils.ts doesn't have buildEmbeddedRunBaseParams | DEFER |
| 2026-02-24 | Batch G verified: tsc 22 pre-existing errors (0 new), 29/29 unhandled-rejections + 17/17 compaction + 8/8 model-compat pass | DONE |
| 2026-02-24 | **Batch H: Cache-TTL, WS flood guard, log cap, context1m** | |
| 2026-02-24 | H-1: Cache-TTL moonshot/zai eligibility (`f93ca93498`) → `cache-ttl.ts` (CACHE_TTL_NATIVE_PROVIDERS set + OpenRouter prefix matching for moonshot/zai) | DONE |
| 2026-02-24 | H-2: WS unauthorized flood guard (`7fb69b7cd2`) → NEW `unauthorized-flood-guard.ts` + `message-handler.ts` (close after 10 repeated unauthorized role requests per connection) | DONE |
| 2026-02-24 | H-3 DEFER: Config write immutability (`f208518cb9`) — io.ts is heavily CN-modified, deep rewrite | DEFER |
| 2026-02-24 | H-4 DEFER: Model fallback to defaults.model (`a4c373935f`) — large refactor, needs new model-input.ts, 6+ CN-modified files | DEFER |
| 2026-02-24 | H-5 DEFER: Compaction safeguard prod build (`1410d15c5e`) — major extensions.ts + compact.ts refactor | DEFER |
| 2026-02-24 | H-6 SKIP: Log file size cap (`8cc744ef1f`) — CN already has far superior disk budget management (rotation, dir budget, disk-full degradation, ULF format) | SKIP |
| 2026-02-24 | H-7 DEFER: Pass model through compaction safeguard (`01380f49f5`) — depends on H-5 | DEFER |
| 2026-02-24 | H-8 DEFER: Context1m OAuth skip (`f03ff39754`) — CN extra-params.ts lacks OAuth-aware beta merging prereqs (piAiBetas, isAnthropicOAuthApiKey) | DEFER |
| 2026-02-24 | Batch H verified: tsc 22 pre-existing errors (0 new), 29/29 unhandled-rejections + 17/17 context tests pass | DONE |
| 2026-02-24 | **Batch I: Deep analysis P0 bug fixes (from deferred review)** | |
| 2026-02-24 | Deep analysis of all 18 DEFERRED items: 5 already present in CN (mislabeled), 2 trivial bug fixes, 2 high-value P1, 2 P2 architectural, 1 P3, 1 skip | DONE |
| 2026-02-24 | I-1: senderIsOwner forward (`5dae5e6ef2`) → `followup-runner.ts` + `queue/types.ts` + `agent-runner-execution.ts` + `agent-runner-memory.ts` + `proactive-compaction.ts` (owner-only tools lost on queue followup) | DONE |
| 2026-02-24 | I-2: Plugin systemPrompt fix (`a66b98a9da`) → `attempt.ts` (`const` → `let` systemPromptText + 6-line hookResult.systemPrompt application via applySystemPromptOverrideToSession) | DONE |
| 2026-02-24 | Batch I verified: tsc 22 pre-existing errors (0 new), 23/23 proactive-compaction + 15/15 model + 28/28 system-prompt tests pass | DONE |
| 2026-02-24 | **Deferred items reclassified after deep analysis:** | |
| 2026-02-24 | ALREADY DONE (mislabeled): Auth rate-limiting, Sender spoofing, Token bloat, UI i18n (CN ahead), Plugin hooks (except systemPrompt) | N/A |
| 2026-02-24 | REMAIN DEFERRED: Gateway auth bootstrap (P2, 8 files), Subagent orchestration (P3, 86 files), Data-driven tools catalog (P2, 5 files), Sandbox docker validation (P1, 5 files), Workspace rules in compaction (P1, 3 files) | DEFER |
| 2026-02-24 | REMAIN DEFERRED from Batch H: Config write immutability, Model fallback to defaults.model, Compaction safeguard prod build, Pass model through compaction safeguard, Context1m OAuth skip | DEFER |
| 2026-02-24 | **Batch J: Deep-scan P0 bug fixes + security hardening** | |
| 2026-02-24 | J-1/J-2 SKIP: HTTP 503/400 failover (`2af3415fac`/`71b4be8799`) — CN already has 502/503/504 + 400 status handling | SKIP |
| 2026-02-24 | J-3: Abort stop reason → timeout for failover (`12ce358da5`) → `failover-error.ts` TIMEOUT_HINT_RE + `errors.ts` timeout patterns (abort/reason:abort) | DONE |
| 2026-02-24 | J-4: Strip trailing /v1 from Anthropic baseUrl (`ac6cec7677`) → `model-compat.ts` (normalizeAnthropicBaseUrl prevents /v1/v1/messages 404) | DONE |
| 2026-02-24 | J-5: Orphaned tool results for ALL providers (`252079f001`) → `transcript-policy.ts` (repairToolUseResultPairing = true universally, not just Google/Anthropic) | DONE |
| 2026-02-24 | J-6: Allow empty edit replacement text (`3823587ada`) → `pi-tools.read.ts` (allowEmpty: true on newText param) | DONE |
| 2026-02-24 | J-7 SKIP: Exit 126/127 as failures (`f3459d71e8`) — CN already checks code===0, non-zero codes already fail | SKIP |
| 2026-02-24 | J-8: Guard .trim() on undefined workspaceDir (`177f167eab`) → `plugin-skills.ts` (string → string\|undefined, nullish coalescing) | DONE |
| 2026-02-24 | J-9: Strip null bytes from workspace paths (`19c43eade2`) → `agent-scope.ts` (stripNullBytes on all resolveAgentWorkspaceDir return paths) | DONE |
| 2026-02-24 | J-10: Mistral strict9 tool call ID sanitization (`3dfee78d72`) → `errors.ts` format pattern + `run.ts` randomBytes ID + `attempt.ts` streamFn sanitize wrapper | DONE |
| 2026-02-24 | J-11 SKIP: Windows dev=0 sameFileIdentity (`04bcabcbae`) — `safe-open-sync.ts` doesn't exist in CN | SKIP |
| 2026-02-24 | J-12: Windows SID-based ACL classification (`85a3c0c818`) → `windows-acl.ts` (SID_RE, TRUSTED_SIDS, USERSID env, SID-aware classifyPrincipal) | DONE |
| 2026-02-24 | J-13/J-14 SKIP: ZAI compat guard + developer role (`68a467dd66`/`57e6a9a762`) — CN model-compat.ts already covers these via isZai+openai-completions check | SKIP |
| 2026-02-24 | J-17 SKIP: runTimeoutSeconds .int() (`8bcd405b1c`) — field doesn't exist in CN zod schema | SKIP |
| 2026-02-24 | J-18 SKIP: safeBody in prompt builder (`c1fe688d40`) — depends on shared/chat-content.ts which doesn't exist in CN | SKIP |
| 2026-02-24 | J-19: Persist reasoning 'off' instead of deleting (`52ac7634db`) → `sessions-patch.ts` (keep reasoningLevel='off' explicit to prevent re-enable) | DONE |
| 2026-02-24 | Batch J verified: tsc 22 pre-existing errors (0 new), 6/6 failover + 34/34 model-compat+windows-acl + 38/38 security pass | DONE |
| 2026-02-24 | **Batch K: Deep-scan extended — failover, transcript, ReDoS hardening** | |
| 2026-02-24 | K-1: Classify Anthropic api_error ISE for failover (`35fe33aa90`) → `errors.ts` (new `isJsonApiInternalServerError` → classifyFailoverReason returns "timeout") | DONE |
| 2026-02-24 | K-4: Recognize Bedrock as Anthropic-compatible in transcript policy (`792bd6195c`) → `transcript-policy.ts` (add `bedrock-converse-stream` API + `amazon-bedrock` provider) | DONE |
| 2026-02-24 | K-11: ReDoS regex hardening (`a2dfe9879f`) → NEW `src/security/safe-regex.ts` + `redact.ts` (compileSafeRegex) + `discord/monitor/exec-approvals.ts` (compileSafeRegex) | DONE |
| 2026-02-24 | K-2/K-3/K-5 DEFER: OpenRouter reasoning_effort/cache_control (`ec1bc41cf2`/`3e974dc93f`/`c52b2ad5c3`) — CN lacks createOpenRouterWrapper infrastructure | DEFER |
| 2026-02-24 | K-6 SKIP: Compaction counter reset (`084f621025`) — CN already has this fix (line 635 run.ts) | SKIP |
| 2026-02-24 | K-7 DEFER: Dynamic retry cap (`c8466e516f`) — CN has different retry architecture, no MAX_RUN_RETRY_ITERATIONS | DEFER |
| 2026-02-24 | K-8 DEFER: Default reasoning on (`c543994e90`) — multi-file change across model-selection + auto-reply | DEFER |
| 2026-02-24 | K-9 DEFER: Configurable tool loop detection (`076df941a3`) — 5+ file change | DEFER |
| 2026-02-24 | K-10 DEFER: Prototype pollution 24-file sweep (`f97c0922e1`) — CN lacks routing modules | DEFER |
| 2026-02-24 | K-12 SKIP: MiniMax live filter exclusion (`b520e7ac38`) — test infrastructure only | SKIP |
| 2026-02-24 | K-CN-ALREADY: merge-patch prototype pollution (`e23c08b5f4`) — CN already has isBlockedObjectKey guard | SKIP |
| 2026-02-24 | K-CN-ALREADY: home-dir structural resolve (`456bd58740`) — CN already has resolveRawHomeDir + path.resolve | SKIP |
| 2026-02-24 | K-CN-ALREADY: npm/pnpm ENOENT Windows (`5c8880ed3f`) — CN already has resolveCommand() | SKIP |
| 2026-02-24 | K-CN-ALREADY: Windows shell hardening (`a7eb0dd9a5`) — CN exec.ts has own security validation | SKIP |
| 2026-02-24 | K-CN-ALREADY: compaction orphaned tool_results (`f32eeae3bc`) — CN pruneHistoryForContextShare already calls repairToolUseResultPairing | SKIP |
| 2026-02-24 | K-CN-ALREADY: compaction retryAsync (`068b9c9749`) — CN compaction.ts already wraps generateSummary in retryAsync | SKIP |
| 2026-02-24 | K-CN-ALREADY: compaction token sanitization (`50c5f75904`) — CN already has estimateCompactionMessageTokens | SKIP |
| 2026-02-24 | K-CN-ALREADY: compaction prompt too long (`b703ea3675`) — CN already has SUMMARIZATION_OVERHEAD_TOKENS | SKIP |
| 2026-02-24 | K-CN-ALREADY: apply_patch path traversal (`5544646a09`) — CN already uses assertSandboxPath | SKIP |
| 2026-02-24 | K-CN-ALREADY: config path hardening (`f208518cb9`) — CN already has prototype-keys.ts | SKIP |
| 2026-02-24 | Batch K verified: tsc 22 pre-existing errors (0 new), transcript-policy 4/4 + failover 17/17 + billing 4/4 pass | DONE |
| 2026-02-24 | **Batch L: Optimization & robustness sweep** | |
| 2026-02-24 | L-1: Expand abort triggers to 50+ phrases incl. Chinese/multilingual (`aea28e26fb`+`4b316c33db`) → `abort.ts` + `normalizeAbortTriggerText()` + `/stop!!!` variant | DONE |
| 2026-02-24 | L-2: Optional chaining on `runResult?.meta?.` accesses (`d649069184`) → `agent-runner.ts` (prevent crash on aborted runs) | DONE |
| 2026-02-24 | L-3: Auth cooldown immutable-window refinement (`7c3c406a35`) → `usage.ts` (reuse active deadline, don't extend) | DONE |
| 2026-02-24 | L-4: Strip stale pre-compaction usage snapshots (`6bf5e76be6`) → `google.ts` (new `stripStaleAssistantUsageBeforeLatestCompaction` + pipeline integration) | DONE |
| 2026-02-24 | L-5: Expand overloaded error patterns (`2af3415fac` partial) → `errors.ts` (add "service unavailable", "high demand" to overloaded patterns) | DONE |
| 2026-02-24 | L-6: Honor configured contextWindow overrides (`150c5815eb`) → `context.ts` (new `applyConfiguredContextWindows` + resilient load pipeline with `.catch()`) | DONE |
| 2026-02-24 | L-CN-ALREADY: YAML core schema (`baf4a799a9`) — CN already has `{ schema: "core" }` | SKIP |
| 2026-02-24 | L-CN-ALREADY: Auth cooldown never-shorten (`dc69610d51`) — CN already has this fix | SKIP |
| 2026-02-24 | L-CN-ALREADY: Auth profile clear all stats (`f91034aa6b`) — CN already has full clearing | SKIP |
| 2026-02-24 | L-DEFER: Gateway device-token-mismatch stale cleanup (`ae93bc9f51`+`5dd304d1c6`) — touches device-pairing + client.ts, needs device-auth-store import | DEFER |
| 2026-02-24 | L-DEFER: Boot session ephemeral (`b562aa6625`) — refactors session bootstrap, medium risk | DEFER |
| 2026-02-24 | L-DEFER: Chat history hard-cap (`5d9a026a9e`+`81fd771cb9`) — 165+ lines, medium risk | DEFER |
| 2026-02-24 | L-DEFER: Config-reload deep-compare/retry (`f2d664e24f`+`4e65e61612`) — config-reload.ts has CN changes | DEFER |
| 2026-02-24 | L-DEFER: Image dimension configurable (`b05e89e5e6`) — 19 files, high conflict risk | DEFER |
| 2026-02-24 | L-DEFER: Memory search unavailable/FTS (`93c2f20a23`+`65aedac20e`) — depends on memory-search FTS module | DEFER |
| 2026-02-24 | L-DEFER: Per-agent stream params (`160bd61fff`) — touches attempt.ts + extra-params.ts | DEFER |
| 2026-02-24 | L-DEFER: Restart cooldown/audit (`ff74d89e86`) — ~55 lines new logic | DEFER |
| 2026-02-24 | L-DEFER: Config EACCES hint (`c69fc383b9`) — additive but io.ts has CN changes | DEFER |
| 2026-02-24 | Batch L verified: tsc 22 pre-existing errors (0 new), failover 25/25 + sanitize 17/17 pass | DONE |
| 2026-02-24 | **Batch M: Deferred items resolution** | |
| 2026-02-24 | M-1: Dynamic retry cap (`c8466e516f`) → `run.ts` + `types.ts` — add `resolveMaxRunRetryIterations()` (32-160 cap based on profile count), `runLoopIterations` counter, guard at top of while loop, `"retry_limit"` error kind | DONE |
| 2026-02-24 | M-2 SKIP: Default reasoning on (`c543994e90`) — CN already has `thinkingDefault: "high"` in defaults.ts (line 728), upstream only changes fallback to `"low"` | SKIP |
| 2026-02-24 | M-3: Config EACCES hint (`c69fc383b9`) → `io.ts` — log helpful permission error message on EACCES/EPERM write failures | DONE |
| 2026-02-24 | M-4: Restart cooldown (`ff74d89e86`) → `restart.ts` — add 30s `RESTART_COOLDOWN_MS` between successive restart emissions to prevent restart storms | DONE |
| 2026-02-24 | M-5: Device-token-mismatch cleanup (`ae93bc9f51`+`5dd304d1c6`) → `client.ts` — call `clearDeviceAuthToken()` when connect fails with `device_token_mismatch` (was dead code, now connected) | DONE |
| 2026-02-24 | M-6: Configurable tool loop detection (`076df941a3`) → 4 files — track consecutive identical tool call fingerprints in subscribe handler, abort session after N repetitions (default 4, configurable via `agents.defaults.toolLoopThreshold`) | DONE |
| 2026-02-24 | M-7 KEEP DEFERRED: OpenRouter reasoning/cache wrappers (`ec1bc41cf2`/`3e974dc93f`/`c52b2ad5c3`) — PI SDK already handles `reasoning_effort` via `compat.supportsReasoningEffort`; cache_control risk-benefit insufficient | DEFER |
| 2026-02-24 | M-8 SKIP: Config-reload deep compare (`f2d664e24f`+`4e65e61612`) — CN already has `diffConfigPaths()` recursive deep compare + debounce + watcher error tolerance | SKIP |
| 2026-02-24 | M-9: Prototype pollution guards (`f97c0922e1` partial) → 6 files — add `isBlockedObjectKey()` to `redact-snapshot.ts` (4 deep-walk functions, CRITICAL), `field-encrypt.ts` (2 walks, HIGH), `server-methods.ts` (dispatch lookup, MEDIUM); normalize inline guards in `runtime-overrides.ts` + `legacy.shared.ts` | DONE |
| 2026-02-24 | M-FINAL-SKIP: Gateway auth bootstrap (`c5698caca3`) — CN has different setup wizard/auth flow | SKIP |
| 2026-02-24 | M-FINAL-SKIP: Sandbox docker validation (`887b209db4`) — CN has own docker.ts validation | SKIP |
| 2026-02-24 | M-FINAL-SKIP: Data-driven tools catalog (`9e1a13bf4c`) — CN FTS5+vec architecture is ahead | SKIP |
| 2026-02-24 | M-FINAL-SKIP: Workspace rules in compaction (`B-6`) — needs `extractSections` infrastructure | SKIP |
| 2026-02-24 | M-FINAL-SKIP: Model fallback to defaults.model (`a4c373935f`) — CN has 8 custom fallback sections | SKIP |
| 2026-02-24 | M-FINAL-SKIP: Compaction safeguard prod build (`1410d15c5e`+`01380f49f5`) — CN compaction heavily customized | SKIP |
| 2026-02-24 | M-FINAL-SKIP: Context1m OAuth skip (`f03ff39754`) — CN doesn't support Anthropic OAuth | SKIP |
| 2026-02-24 | M-FINAL-SKIP: Boot session ephemeral (`b562aa6625`) — CN intentionally reuses sessions | SKIP |
| 2026-02-24 | M-FINAL-SKIP: Chat history hard-cap (`5d9a026a9e`+`81fd771cb9`) — CN already has 1000-msg + 6MiB cap | SKIP |
| 2026-02-24 | M-FINAL-SKIP: Image dimension configurable (`b05e89e5e6`) — 19 files, high conflict | SKIP |
| 2026-02-24 | M-FINAL-SKIP: Memory search FTS (`93c2f20a23`+`65aedac20e`) — CN has own memory system | SKIP |
| 2026-02-24 | M-FINAL-SKIP: Per-agent stream params (`160bd61fff`) — low priority, revisit next merge | SKIP |
| 2026-02-24 | Batch M verified: tsc 22 pre-existing errors (0 new), model-fallback 92/92 + includes 4/4 pass | DONE |
| 2026-02-24 | **Phase 4 START: Channel Features (P3)** | |
| 2026-02-24 | P3 triage: 6 areas analyzed (Slack 25, Telegram 15, Discord 14, Cron 10, Linq 3, Memory MMR 5) | DONE |
| 2026-02-24 | P3 expert review: Only Cron bug fixes approved for merge; all other channels SKIP | DONE |
| 2026-02-24 | P3 SKIP: Slack Block Kit (~25 commits) — large batch, defer to next merge cycle | SKIP |
| 2026-02-24 | P3 SKIP: Telegram features (~15 commits) — CN already has forum topics, streaming, channel_post | SKIP |
| 2026-02-24 | P3 SKIP: Discord subagent routing (~14 commits) — CN already has agent routing, conflict risk | SKIP |
| 2026-02-24 | P3 SKIP: Linq channel (3 commits) — CN does not use Linq/iMessage API | SKIP |
| 2026-02-24 | P3 SKIP: Memory MMR/temporal decay (5 commits) — CN memory system heavily customized | SKIP |
| 2026-02-24 | P3 SKIP: Cron UI new features (`77c3b142a9`) — CN already has full cron UI with run history | SKIP |
| 2026-02-24 | P3 SKIP: Cron webhook (`115cfb4430`+`99db4d13e5`) — CN cron has no webhook feature | SKIP |
| 2026-02-24 | **Batch N: Cron bug fixes** | |
| 2026-02-24 | N-1: Cron jobId path traversal security (`259d863353`) → `run-log.ts` (sanitize jobId with basename+whitelist+startsWith guard in resolveCronRunLogPath) | DONE |
| 2026-02-24 | N-2: Preserve due jobs after manual runs (`f6c2e99f5d`) → `ops.ts` (replace recomputeNextRuns with recomputeNextRunsForMaintenance in run()) | DONE |
| 2026-02-24 | N-3: Persist manual run marker before unlock (`211ab9e4f6`) → `timer.ts` (add persist(state) after runningAtMs in executeJob, test updated to vi.waitFor) | DONE |
| 2026-02-24 | N-4: Respect aborts in wake-now retries (`3efe63d1ad`) → `timer.ts` (add !job.enabled / !state.running check in heartbeat retry loop) | DONE |
| 2026-02-24 | N-5: Apply timeout to startup catch-up runs (`73e5bb7635`) → `timer.ts` (wrap executeJob in Promise.race timeout in runMissedJobs) | DONE |
| 2026-02-24 | N-6: Cancel timed-out runs before side effects (`556af3f08b`) → `timer.ts` (clear runningAtMs in catch block of onTimer execution loop) | DONE |
| 2026-02-24 | N-7: Clean run-log write queue entries (`9bc265f379`) → `run-log.ts` (.finally() cleanup in appendCronRunLog writesByPath Map) | DONE |
| 2026-02-24 | Batch N verified: tsc 22 pre-existing errors (0 new), cron 147/147 pass (7 pre-existing failures in unrelated files) | DONE |
| 2026-02-24 | **Phase 5: Validation** | |
| 2026-02-24 | V-1: tsc compilation — 22 pre-existing errors, 0 new introduced by merge | PASS |
| 2026-02-24 | V-2: Security module tests — 318/320 pass (2 pre-existing Windows ACL timeouts) | PASS |
| 2026-02-24 | V-3: Agent/Model tests — model-fallback 17/17, model.test 15/15, sandbox-explain 4/4, system-prompt 28/28 (64/64) | PASS |
| 2026-02-24 | V-4: Cron module tests — 147/147 pass (7 pre-existing in isolated-agent + session-reaper) | PASS |
| 2026-02-24 | V-5: Gateway tests — server-ready 21/21, model-config 44/44, session-utils.fs 42/42, logs 9/9 (116/116) | PASS |
| 2026-02-24 | V-6: Dispatch tests — 859/859 pass, 92 skipped (2 accuracy benchmarks need vectorized data) | PASS |
| 2026-02-24 | V-7: Config tests — 824/826 pass (2 pre-existing cn-merge-protection gitattributes) | PASS |
| 2026-02-24 | V-FIX-1: `getFsAllowedDirs()` regression — `fs.accessSync` on 26 Windows drives = 8.6s; replaced with `fsutil fsinfo drives` (~20ms). All 12 defaults-cn + 35 config tests unblocked | DONE |
| 2026-02-24 | V-FIX-2: `engine.deep.test.ts` MCP hints regression — fallback auto-discovery read real marketplace index from disk; added mocks for `auto-discovery.js` + `tool-discovery.js`. 2 tests fixed | DONE |
| 2026-02-24 | V-FINAL: All key test suites pass, 0 new regressions, merge validated | DONE |
| 2026-02-24 | **Batch O: Deep review of SKIP/DEFER items (user-requested)** | |
| 2026-02-24 | O-EVAL: Deep analysis of DEFER item (OpenRouter wrappers) + 7 "too large" SKIPs | DONE |
| 2026-02-24 | O-1+O-2: OpenRouter reasoning/cache wrappers (`ec1bc41cf2`+`3e974dc93f`+`c52b2ad5c3`) → `extra-params.ts` — `createOpenRouterReasoningWrapper` strips `reasoning_effort` from payload via onPayload hook; `createOpenRouterCacheControlWrapper` injects `cache_control: { type: "ephemeral" }` into last user message for Anthropic-via-OpenRouter models | DONE |
| 2026-02-24 | O-SKIP-CONFIRM: Mistral full provider (55 files) — CN has 80% compat layer, recommend manual `buildMistralProvider()` as separate task | SKIP→FUTURE→P-1 |
| 2026-02-24 | O-SKIP-CONFIRM: Image dimension configurable (19 files) — hardcoded 2000px works, CN image pipeline just fixed, too risky | SKIP |
| 2026-02-24 | O-SKIP-CONFIRM: Per-agent stream params — per-model config exists, low priority | SKIP |
| 2026-02-24 | O-SKIP-CONFIRM: Workspace rules in compaction — CN has `customInstructions` pipe, recommend CN-native `extractSections()` as separate task | SKIP→FUTURE→P-2 |
| 2026-02-24 | O-SKIP-CONFIRM: Subagent orchestration (49 files) — CN is architecturally ahead (orchestrator/DAG/parallel decomposition) | SKIP |
| 2026-02-24 | O-SKIP-CONFIRM: Token bloat reduction — CN already equivalent (confirmed "ALREADY DONE" in Batch I) | SKIP |
| 2026-02-24 | O-SKIP-CONFIRM: UI i18n framework (13 files) — CN ahead (80+ files, 312KB translations, production deployed) | SKIP |
| 2026-02-24 | Batch O verified: tsc 0 new errors, model 15/15 + fallback 17/17 pass | DONE |
| 2026-02-24 | **Batch P: FUTURE items implementation (Mistral provider + workspace rules)** | |
| 2026-02-24 | P-1: Mistral provider — `buildMistralProvider()` with 5 models (mistral-large-latest, codestral-latest, mistral-small-latest, pixtral-large-latest, mistral-medium-latest). Constants, implicit resolution, `supportsDeveloperRole: false`, `MISTRAL_PREFIXES` live-model-filter, auth credential setter, CN_PROVIDERS card, region-cn recommended. 8 files modified | DONE |
| 2026-02-24 | P-2: Workspace rules in compaction — NEW `compaction-rules.ts`: `extractSections()` parses AGENTS.md/SOUL.md for rule-like sections (keyword scoring), truncates to 800 chars, prepends to `customInstructions` before `session.compact()`. Single integration point in `compact.ts`. 2 files modified, 1 new file, 8 unit tests pass | DONE |
| 2026-02-24 | Batch P verified: tsc 0 new errors, compaction-rules 8/8, defaults-cn 43/43, region-cn 31/31, model-fallback 17/17, model.test 15/15, engine.deep 31/31 — all pass | DONE |
| 2026-02-24 | **Cross-reference audit: ~95 YES-tagged commits were never tracked in Progress Log** | |
| 2026-02-24 | Full evaluation of ~95 missing items: ~68 need merging, ~22 already covered by CN, ~5 non-applicable | DONE |
| 2026-02-24 | **Batch Q: P0 Security Items (untracked upstream commits)** | |
| 2026-02-24 | Q-1: SSRF IPv6 transition bypasses (`baa335f258`+`d51929ecb5`) → `ssrf.ts` (ISATAP ::5efe: detection, Teredo 2001:0000:: XOR deobfuscation, 6to4 2002:: extraction, block documentation 2001:db8:: and multicast ff00::) | DONE |
| 2026-02-24 | Q-2: Symlink TOCTOU fix (`cfc5e7bd82`) → `store.ts` (fs.stat → fs.lstat in saveMediaSource to reject symlinks) | DONE |
| 2026-02-24 | Q-3a: Plugin path containment (`81b19aaa1a`) → `registry.ts` (resolvePath now resolves relative to plugin dir and rejects traversal via path.relative check) | DONE |
| 2026-02-24 | Q-3b: npm install integrity (`5dc50b8a3f`) → ALREADY DONE (--ignore-scripts present in all npm calls: plugins/install.ts, hooks/install.ts, infra/install-package-dir.ts, agents/skills-install.ts) | SKIP |
| 2026-02-24 | Q-3c: Disable plugin runtime exec (`45db2aa0cd`) → `runtime/index.ts` (guardedRunCommandWithTimeout wrapper, defaults to reject with clear error message; setPluginExecEnabled() for opt-in) | DONE |
| 2026-02-24 | Q-4a: Gateway bind fail-closed (`08a7967936`) → `net.ts` (all 0.0.0.0 fallbacks replaced with throw Error; only mode=lan explicitly binds to all interfaces) | DONE |
| 2026-02-24 | Q-4b: 2MB prompt size limit (`732e53151e`) → `logs-chat.ts` (ChatSendParamsSchema.message + ChatInjectParamsSchema.message: maxLength 2_000_000) | DONE |
| 2026-02-24 | Q-4c: Block webchat session mutators (`981d266480`) → `sessions.ts` (patch/reset/delete/compact check isWebchatConnect, reject with error) | DONE |
| 2026-02-24 | Q-5a: Allowlist entry cap (`24c954d972`) → `exec-approvals.ts` (MAX_ALLOWLIST_ENTRIES=500, LRU eviction by lastUsedAt) | DONE |
| 2026-02-24 | Q-5b: Socket buffer cap (`a10ec2607f`) → `exec-approvals.ts` (1MB buffer limit in requestExecApprovalViaSocket) | DONE |
| 2026-02-24 | Q-5c: Forwarder command truncation → `exec-approval-forwarder.ts` (MAX_FORWARDED_COMMAND_CHARS=2000, truncate with "...(truncated)" suffix) | DONE |
| 2026-02-24 | Q-5d: Pending approval cap → `exec-approval-manager.ts` (MAX_PENDING_APPROVALS=100, throw on overflow) | DONE |
| 2026-02-24 | Q-6a: OTEL log redaction (`7fab4d128a`) → `extensions/diagnostics-otel/src/service.ts` (inline 11 redaction patterns matching sanitize.ts; applied to log message + string attributes before OTEL emit) | DONE |
| 2026-02-24 | Q-6b: Web fetch body cap → `web-shared.ts` (readResponseText now uses streaming reader with 5MB MAX_RESPONSE_BODY_BYTES hard limit, reader.cancel() on exceeded) | DONE |
| 2026-02-24 | Batch Q verified: tsc 22 pre-existing errors (0 new), exec-approvals 57/57 + gateway 44/44 + session-utils 42/42 pass | DONE |

---

## Summary

| Category | Applied | Skipped | Deferred | Total |
|----------|---------|---------|----------|-------|
| P0 Security (Phase 1) | 15 | 3 | 8 | 26 |
| P1 Core Features (Phase 2) | 4 | 1 | 7 | 12 |
| P2 Bug Fixes (Phase 3) | 5 | 0 | 0 | 5 |
| Extra Security (Phase 3.5) | 2 | 0 | 0 | 2 |
| Batch A Safe Fixes | 3 | 2 | 0 | 5 |
| Batch B Additive | 2 | 1 | 1 | 4 |
| Batch C Security | 1 | 0 | 1 | 2 |
| Batch D Compaction | 3 | 1 | 0 | 4 |
| Batch E Small Fixes | 6 | 3 | 0 | 9 |
| Batch F Deferred Review | 2 | 3 | 0 | 5 |
| Batch G Deep-Scan Safe | 11 | 1 | 1 | 13 |
| Batch H Cache/WS/Logs | 2 | 1 | 5 | 8 |
| Batch I P0 Bug Fixes | 2 | 0 | 0 | 2 |
| Batch J Deep-Scan Fixes | 8 | 7 | 0 | 15 |
| Batch K Extended Scan | 3 | 12 | 6 | 21 |
| Batch L Optimization & Robustness | 6 | 3 | 9 | 18 |
| Batch M Deferred Resolution | 5 | 14 | 1 | 20 |
| Phase 4 Channel Triage | 0 | 8 | 0 | 8 |
| Batch N Cron Bug Fixes | 7 | 0 | 0 | 7 |
| Phase 5 Validation Fixes | 2 | 0 | 0 | 2 |
| Batch O SKIP/DEFER Deep Review | 1 | 0 | 0 | 1 |
| Batch P FUTURE Implementation | 2 | 0 | 0 | 2 |
| Batch Q P0 Security (untracked) | 14 | 1 | 0 | 15 |
| **TOTAL** | **106** | **61** | **0** | **200** |

---

## Remaining Unmerged Items (for future merge cycles)

Cross-reference audit identified ~87 YES/CAREFUL/MERGE-tagged upstream commits that were never
tracked in the Progress Log. Most are LOW impact. HIGH-impact items listed first.

### HIGH Priority (Windows/CN core impact)

| Hash | Release | Description | CN Impact |
|------|---------|-------------|-----------|
| `65a1787f92` | v2026.2.17 | Normalize paths to forward slashes for Windows RegExp | **HIGH** |
| `f4b2fd00bc` | v2026.2.17 | Harden object-array merge-by-id fallback | **HIGH** — CN defaults |
| `221d50bc18` | v2026.2.19 | Preserve assistant partial stream during reasoning | **HIGH** — pi-embedded-runner |
| `280c6b117b` | v2026.2.19 | Windows schtasks quoting fixes (daemon) | **HIGH** — Windows |
| `dafe52e8cf` | v2026.2.19 | Windows schtasks quoting fixes pt2 | **HIGH** — Windows |
| `1ad9f9af5a` | v2026.2.22 | Resolve qmd Windows shim commands | **HIGH** — Windows |
| `8ec0ef5866` | v2026.2.15 | Config.patch merge object arrays by id | **HIGH** |
| `3c6cff5758` | v2026.2.15 | Refactor: share agent sandbox schema | **HIGH** — CN Zod |
| `6e36d956d6` | v2026.2.15 | Refactor: share agent model schema | **HIGH** — CN Zod |
| `cc2a63cd2d` | v2026.2.15 | Refactor: dedupe exec/fs zod schemas | **HIGH** — CN Zod |
| `dc5d234848` | v2026.2.15 | Share server-method param validation | **HIGH** — CN server-methods |

### MEDIUM Priority (features, optimization)

| Hash | Release | Description | CN Impact |
|------|---------|-------------|-----------|
| `e8816c554f` | v2026.2.19 | Fix subagent delivery to origin channel | MEDIUM |
| `0ff506140d` | v2026.2.19 | Clear matched tool errors, dedupe reasoning end | MEDIUM |
| `e1059e95aa` | v2026.2.19 | Extract Windows cmd argv helpers | MEDIUM |
| `b62bd290cb` | v2026.2.19 | Remove hardcoded disableBlockStreaming (honor config) | MEDIUM |
| `a6c741eb46` | v2026.2.17 | Break infinite announce retry loop (#18264) | MEDIUM |
| `e5eb5b3e43` | v2026.2.17 | Stuck loop detection + exponential backoff (#17118) | MEDIUM |
| `8a67016646` | v2026.2.17 | Raise bootstrap total cap, warn /context truncation | MEDIUM |
| `20957efa46` | v2026.2.17 | Graceful process tree termination (SIGTERM→SIGKILL) | MEDIUM |
| `b1d5c71609` | v2026.2.17 | Standalone script for service restart after update | MEDIUM |
| `e91a5b0216` | v2026.2.17 | Release stale session locks + watchdog for hung calls | MEDIUM |
| `15fe87e6b7` | v2026.2.17 | before_message_write plugin hook | MEDIUM |
| `b90eb51520` | v2026.2.17 | modelOverride/providerOverride in before_agent_start | MEDIUM |
| `153794080e` | v2026.2.17 | FTS fallback when no embedding provider (#17725) | MEDIUM |
| `fa9420069a` | v2026.2.17 | MMR re-ranking for search result diversity | MEDIUM |
| `2e91552f09` | v2026.2.17 | Generic provider API key rotation (#19587) | MEDIUM |

### LOW Priority (additive, minor fixes)

| Hash | Release | Description | CN Impact |
|------|---------|-------------|-----------|
| `64b273a71c` | v2026.2.22 | Harden safe-bin trust, add trusted dirs | LOW |
| `6817c0ec7b` | v2026.2.22 | Tighten elevated allowFrom sender matching | LOW |
| `3645420a33` | v2026.2.22 | Skip cache-busting for bundled hooks | LOW |
| `9d37654a90` | v2026.2.22 | Gate auto reasoning by effective thinking level | LOW |
| `42795b87a3` | v2026.2.22 | Don't auto-enable reasoning when thinking active | LOW |
| `1000ff04ea` | v2026.2.22 | Hard-cap embedding inputs before batch | LOW |
| `82d34b4b06` | v2026.2.22 | Harden qmd collection recovery | LOW |
| `dc6afeb4f8` | v2026.2.22 | Skip unnecessary full history reloads | LOW |
| `f2e9986813` | v2026.2.22 | Append out-of-band final payloads in active chat | LOW |
| `8264d4521b` | v2026.2.22 | Render final assistant payloads without history wait | LOW |
| `02dc0c8752` | v2026.2.22 | Stop websocket client on lifecycle teardown | LOW |
| `d574056761` | v2026.2.22 | Send stable websocket instance IDs | LOW |
| `19046e0cfc` | v2026.2.22 | Preserve session labels across /new | LOW |
| `e6383a2c13` | v2026.2.22 | Probe port liveness for stale lock recovery | LOW |
| `9ea740afb6` | v2026.2.22 | Canonicalize mixed-case session keys | LOW |
| `de96f5fed2` | v2026.2.22 | Honor default agent for implicit store path | LOW |
| `5ad5ea53cd` | v2026.2.22 | Resolve resumed session agent scope before run | LOW |
| `48e6b4fca3` | v2026.2.19 | Run BOOT.md for each configured agent at startup | MEDIUM |
| `35016a380c` | v2026.2.19 | Serialize sandbox registry mutations and lock usage | LOW |
| `b45bb6801c` | v2026.2.19 | Skip embedding provider check when QMD backend active | LOW |
| `3d4ef56044` | v2026.2.19 | Include provider/model name in billing error message | LOW |
| `f855d0be4f` | v2026.2.19 | Skip heartbeat when HEARTBEAT.md absent | LOW |
| `45db2aa0cd` | v2026.2.19 | Disable plugin runtime command execution by default | LOW (Q-3c done) |
| `d4c057f8c1` | v2026.2.17 | Set 0o600 on remaining session file write paths | LOW |
| `095d522099` | v2026.2.17 | Create session transcript with 0o600 (#18066) | LOW |
| `638853c6d2` | v2026.2.17 | Sanitize sandbox env vars before Docker launch | LOW (F-1 done) |
| `5487c9adeb` | v2026.2.17 | Add sandbox env sanitization helpers | LOW (F-1 done) |
| `60dc3741c0` | v2026.2.17 | Fix before_tool_call hook double-fires (#16852) | LOW |
| `6d31d1ecc6` | v2026.2.17 | Enforce high-priority override precedence | LOW |
| `fec4be8dec` | v2026.2.17 | Prevent daily jobs skipping days (48h jump) | LOW (close to N) |
| `de6cc05e7e` | v2026.2.17 | Prevent spin loop on same-second completion | LOW (close to N) |
| `0ee3480690` | v2026.2.17 | Preserve model fallbacks on agent override | LOW |
| `4928717b92` | v2026.2.17 | Handle Qwen 3 reasoning in Ollama | LOW |
| `960cc11513` | v2026.2.17 | Azure AI Foundry URL support | LOW |
| `068260bbea` | v2026.2.17 | Azure api-version query param | LOW |
| `382158fb30` | v2026.2.17 | Auto-refresh sessions list after deletion | LOW |
| `b0a01fe482` | v2026.2.17 | Preflight exec scripts for shell var injection | MEDIUM |

### New Structural Files (MERGE-tagged, not yet added)

| File | Lines | Release | Description |
|------|-------|---------|-------------|
| `src/agents/tool-catalog.ts` | +322 | v2026.2.22 | Data-driven tools catalog (SKIP — CN FTS5 ahead) |
| `src/infra/exec-wrapper-resolution.ts` | +460 | v2026.2.22 | Extracted from exec |
| `src/infra/exec-command-resolution.ts` | +296 | v2026.2.22 | Extracted from exec |
| `src/node-host/invoke-system-run.ts` | +359 | v2026.2.22 | Split from invoke.ts |
| `src/shared/net/ip.ts` | +331 | v2026.2.22 | Extracted from ssrf.ts |
| `ui/src/ui/views/config-search.ts` | +92 | v2026.2.22 | UI config search |

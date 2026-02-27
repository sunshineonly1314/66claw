# Upstream Release: v2026.2.19 → v2026.2.22 (+ upstream/main)

**Commits:** ~1375 (2189 files, +169,684 / -95,852)
**Date Range:** 2026-02-19 to 2026-02-23
**Tag:** `v2026.2.22` → `a54dc7fe80`
**upstream/main HEAD:** `69692d0d3a`

---

## !! KIMI UPSTREAM SUPPORT — CRITICAL OVERLAP !!

Upstream now has native Moonshot Kimi support that directly overlaps our CN Kimi implementation.
**These commits MUST be carefully compared with our CN Kimi code.**

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `15e32c7341` | **COMPARE** | Refresh Moonshot Kimi vision capabilities | **CRITICAL** — overlaps CN `kimi-coding` vision fix |
| `9bd04849ed` | **COMPARE** | Detect Kimi model-token-limit overflows | **CRITICAL** — new upstream Kimi handling |
| `3640484e28` | **COMPARE** | Map Moonshot developer role compatibility | **CRITICAL** — overlaps CN `compat.supportsDeveloperRole` |

**Action Required:** Diff upstream Kimi changes against our implementation in:
- `src/agents/model-compat.ts` (CN has Kimi compat flags)
- `src/agents/failover-error.ts` (CN has Kimi error handling)
- `src/agents/models-config.providers.ts` (CN has buildKimiCodeProvider)
- `src/agents/siliconflow-models.ts` (CN isVision heuristic includes "kimi")

If upstream's implementation is better/more complete, adopt it. If ours adds CN-specific
features (headers, User-Agent), keep ours and cherry-pick only non-overlapping parts.

---

## Security Fixes (P0)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `0e28e50b45` | **YES** | Detect obfuscated commands that bypass allowlist (#24287) | MEDIUM |
| `3f0b9dbb36` | **YES** | Block shell-wrapper line-continuation bypass | MEDIUM |
| `24c954d972` | **YES** | Harden allow-always wrapper persistence | LOW |
| `64b273a71c` | **YES** | Harden safe-bin trust, add trusted dirs | LOW |
| `d306fc8ef1` | **YES** | OC-07: Redact session history credentials (#16928) | LOW |
| `7fab4d128a` | **YES** | Redact sensitive data in OTEL exports (CWE-532) (#18182) | LOW |
| `9c87b53c8e` | **YES** | Redact sensitive values in `config get` output (#23654) | LOW |
| `44727dc3a1` | **YES** | Strip hidden content to prevent prompt injection (#21074) | LOW |
| `6817c0ec7b` | **YES** | Tighten elevated allowFrom sender matching | LOW |
| `a10ec2607f` | **YES** | Sanitize untrusted wrapper markup in payloads | LOW |

## New Features (P1)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `3a3c2da916` | **YES** | Gemini (Google Search grounding) as web_search provider (#13075) | LOW |
| `d92ba4f8aa` | **YES** | Full Mistral provider support (#23845) | LOW — new provider |
| `9e1a13bf4c` | **YES** | Data-driven agents tools catalog with provenance | LOW — new file |
| `77c3b142a9` | REVIEW | Full cron edit parity, run history, filters | MEDIUM — new cron UI |
| `f8171ffcdc` | REVIEW | Tag filters, complete schema help/labels | LOW — new config UI |
| `331b728b8d` | REVIEW | OSC 8 hyperlinks for wrapped URLs (#17814) | LOW |
| `3645420a33` | **YES** | Skip cache-busting for bundled hooks, mtime workspace hooks | LOW |

## Model & Agent Runtime (P1)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `9d37654a90` | **YES** | Gate auto reasoning by effective thinking level (#24335) | LOW |
| `42795b87a3` | **YES** | Don't auto-enable reasoning when thinking active (#24290) | LOW |
| `9757d2bb64` | **YES** | Normalize strict openai-compatible turn ordering | MEDIUM |
| `a4c373935f` | **YES** | Fallback to agents.defaults.model (#24210) | MEDIUM |
| `ec1bc41cf2` | **YES** | Remove conflicting reasoning_effort from OpenRouter (#24120) | LOW |
| `5c7c37a02a` | REVIEW | Infer auth-profile unavailable failover reason | MEDIUM |
| `a66b98a9da` | **YES** | Fix: hook systemPrompt gets collected then thrown away (#14583) | LOW |
| `69692d0d3a` | **YES** | Detect context overflow error patterns (#20539) | MEDIUM |
| `3c57bf4c85` | **YES** | HTTP 502/503/504 as failover-eligible (#21017) | **HIGH** — failover-error.ts |

## Compaction / Memory (P2)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `457835b104` | **YES** | Count only completed auto-compactions (#24056) | MEDIUM |
| `05691be511` | **YES** | Ignore tool result details in oversized checks (#24057) | MEDIUM |
| `5c9f9722af` | **YES** | Align compaction floor guidance (#24059) | MEDIUM |
| `50c5f75904` | **YES** | Sanitize token split accounting (#24058) | MEDIUM |
| `1000ff04ea` | **YES** | Hard-cap embedding inputs before batch | LOW |
| `d7747148d0` | REVIEW | Reindex when sources change | LOW |
| `82d34b4b06` | **YES** | Harden qmd collection recovery | LOW |
| `1ad9f9af5a` | **YES** | Resolve qmd Windows shim commands | **HIGH** — Windows |

## Cron / Scheduling (P2)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `f6c2e99f5d` | **YES** | Preserve due jobs after manual runs (#23994) | LOW |
| `211ab9e4f6` | **YES** | Persist manual run marker before unlock (#23993) | LOW |
| `3efe63d1ad` | **YES** | Respect aborts in main wake-now retries (#23967) | LOW |
| `9bc265f379` | **YES** | Clean run-log write queue entries (#23968) | LOW |
| `73e5bb7635` | **YES** | Apply timeout to startup catch-up runs (#23966) | LOW |
| `556af3f08b` | **YES** | Cancel timed-out runs before side effects (#22411) | LOW |
| `259d863353` | **YES** | Harden cron.runs jobId path handling | LOW |

## Gateway / Webchat (P2)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `7fb69b7cd2` | **YES** | Stop repeated unauthorized WS floods per connection (#24294) | MEDIUM |
| `dc6afeb4f8` | **YES** | Skip unnecessary full history reloads (#20588) | LOW |
| `f2e9986813` | **YES** | Append out-of-band final payloads in active chat (#11139) | LOW |
| `8264d4521b` | **YES** | Render final assistant payloads without history wait (#14928) | LOW |
| `02dc0c8752` | **YES** | Stop websocket client on lifecycle teardown (#23422) | LOW |
| `d574056761` | **YES** | Send stable websocket instance IDs (#23616) | LOW |
| `19046e0cfc` | **YES** | Preserve session labels across /new (#23755) | LOW |
| `e6383a2c13` | **YES** | Probe port liveness for stale lock recovery | LOW |
| `9165bd7f37` | REVIEW | Auto-approve loopback scope upgrades | MEDIUM |

## Exec / Sandbox (P2)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `278331c49c` | REVIEW | Restore sandbox as implicit host default | MEDIUM — sandbox-paths.ts |
| `45febecf2a` | REVIEW | Keep implicit sandbox default, no-alert baseline | MEDIUM |
| `394a1af70f` | REVIEW | Per-agent exec defaults for opaque session keys | LOW |
| `c677be9d5f` | REVIEW | Skip default timeout for background sessions | LOW |
| `a30f9c8673` | REVIEW | Fallback docker user to workspace owner uid/gid | LOW |

## Config / Sessions (P2)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `f208518cb9` | **YES** | Keep write inputs immutable with unsetPaths (#24134) | LOW |
| `36400df086` | REVIEW | Pass agentDir to /compact for agent-specific auth (#24133) | LOW |
| `9ea740afb6` | **YES** | Canonicalize mixed-case session keys | LOW |
| `de96f5fed2` | **YES** | Honor default agent for implicit store path | LOW |
| `5ad5ea53cd` | **YES** | Resolve resumed session agent scope before run | LOW |

## Breaking Changes

| Commit | Description | CN Action |
|--------|-------------|-----------|
| `382785c6ce` | Remove `google-antigravity` provider | **SKIP** — CN never used this |

## Major Structural Refactors (New Files)

| File | Lines | Action |
|------|-------|--------|
| `src/agents/tool-catalog.ts` | +322 | **MERGE** — new file, no conflict |
| `src/infra/exec-wrapper-resolution.ts` | +460 | **MERGE** — extracted from exec |
| `src/infra/exec-command-resolution.ts` | +296 | **MERGE** — extracted from exec |
| `src/node-host/invoke-system-run.ts` | +359 | **MERGE** — split from invoke.ts |
| `src/shared/net/ip.ts` | +331 | **MERGE** — extracted from ssrf.ts |
| `ui/src/ui/views/config-search.ts` | +92 | **MERGE** — new UI |

## SKIP

| Category | Reason |
|----------|--------|
| `google-antigravity` removal | CN never used it |
| Discord voice manager (684 lines) | New feature, not CN priority |
| Discord thread bindings (959 lines) | Channel-specific, low priority |
| Telegram lane-delivery extraction | Channel-specific |
| WhatsApp allowFrom enforcement | Not used in CN |

# Upstream Release: v2026.2.14 → v2026.2.15

**Commits:** ~11,217 (large release, includes major refactoring)
**Date Range:** 2026-02-14 to 2026-02-16
**Tag:** `v2026.2.15` → `ea487f05c1`

---

## Security Fixes (P0)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `30b6eccae5` | **YES** | Auth rate-limiting & brute-force protection (#15035) | MEDIUM — new feature, gateway |
| `1fb52b4d7b` | **YES** | Trusted-proxy auth mode (#15940) | MEDIUM — gateway |
| `6c4c535813` | **YES** | Unicode angle bracket homoglyph sanitization (#14665) | LOW |
| `887b209db4` | **YES** | Harden sandbox docker config validation | **HIGH** — sandbox-paths.ts modified |
| `6254e96acf` | **YES** | Harden prompt path sanitization | MEDIUM |
| `2363e1b085` | **YES** | Restrict skill download target paths | LOW |
| `c6c53437f7` | **YES** | Scope session tools & webhook secret fallback | MEDIUM |
| `da55d70fb0` | **YES** | Harden untrusted web tool transcripts | LOW |
| `113ebfd6a2` | **YES** | Harden hook and device token auth | MEDIUM |
| `9230a2ae14` | **YES** | Require auth on control HTTP & auto-bootstrap token | MEDIUM |
| `bebba124e8` | **YES** | UI: Escape raw HTML in chat messages (XSS) (#13952) | **HIGH** — chat.ts modified |
| `a324031801` | **YES** | UI: Do not hydrate password from URL | MEDIUM |
| `53273b490b` | **YES** | Prevent sender spoofing in group prompts | MEDIUM |
| `559c8d9930` | **YES** | Replace deprecated SHA-1 in sandbox config hash | MEDIUM |
| `bc88e58fcf` | REVIEW | Skill/plugin code safety scanner (#9806) | MEDIUM |
| `233483d2b9` | REVIEW | Centralize dangerous tool lists | LOW |

## Core Features (P1)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `b8f66c260d` | **YES** | Nested subagent orchestration + reduce token waste (#14447) | MEDIUM — touches config schemas |
| `dec6859702` | **YES** | Reduce prompt token bloat from exec/context (#16539) | MEDIUM |
| `7c822d039b` | **YES** | Plugin llm input/output hook payloads (#16724) | **HIGH** — plugins/runtime modified |
| `ab71fdf821` | **YES** | Plugin compaction/reset hooks, bootstrap globs (#13287) | **HIGH** — plugins/runtime modified |
| `2c8b921054` | **YES** | `messages.suppressToolErrors` config option (#16620) | Need Zod schema |
| `b6069fc68c` | REVIEW | Per-channel ackReaction config (#17092) | Need Zod schema |
| `115cfb4430` | REVIEW | Cron finished-run webhook (#14535) | LOW |
| `14fb2c05b1` | **YES** | Preserve partial output on abort (#15026) | MEDIUM |
| `d19b746928` | REVIEW | Skills cross-platform install fallback (#17687) | LOW |

## Bug Fixes (P2)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `cbf58d2e1c` | **YES** | Memory context window cache collisions | MEDIUM |
| `fe73878dfc` | **YES** | Session mapping across gateway restarts | MEDIUM |
| `ffbcb37342` | **YES** | Memory flush prompt datetime injection | **HIGH** — memory-flush.ts modified |
| `8ec0ef5866` | **YES** | Config.patch merge object arrays by id | **HIGH** — config merge |
| `cd44a0d01e` | **YES** | PTY process spawning fix (#14257) | MEDIUM |
| `166cf6a3e0` | **YES** | web_fetch: cap response body before parsing (OOM) | LOW |
| `b562aa6625` | REVIEW | Keep boot sessions ephemeral | MEDIUM |
| `0931a35709` | REVIEW | Guard withSessionStoreLock vs undefined storePath | LOW |
| `1911942363` | **YES** | Sensitive field whitelist case-insensitive (#16148) | LOW |

## UI Fixes

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `c4d2061a7c` | **YES** | Allow img tags in DOMPurify for markdown images (#15480) | MEDIUM — UI |
| `841dbeee0a` | **YES** | Coerce form values to schema types (#13468) | MEDIUM — config form |
| `ae7e377747` | REVIEW | RTL support for Hebrew/Arabic (#11498) | LOW |
| `8a352c8f9d` | REVIEW | Token usage dashboard (#10072) | LOW — new UI |

## Config Schema Refactors (Conflict Zone)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `3c6cff5758` | CAREFUL | Refactor: share agent sandbox schema | **HIGH** — CN Zod additions |
| `6e36d956d6` | CAREFUL | Refactor: share agent model schema | **HIGH** — CN Zod additions |
| `cc2a63cd2d` | CAREFUL | Refactor: dedupe exec/fs zod schemas | **HIGH** — CN Zod additions |

## Gateway Refactors

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `dc5d234848` | CAREFUL | Share server-method param validation | **HIGH** — CN server-methods |
| `adc818db4a` | REVIEW | Serve Control UI bootstrap config / CSP | MEDIUM |
| `eed02a2b57` | REVIEW | Preserve control-ui scopes in bypass mode | MEDIUM |
| `b4f14d6f7a` | REVIEW | Hide BOOTSTRAP in agent files post-onboarding | MEDIUM |

## SKIP

| Category | Reason |
|----------|--------|
| Discord component v2 UI tool support (`a61c2dc4bd`) | Not relevant to CN |
| 500+ test consolidation commits | Test-only, merge opportunistically |
| 300+ refactor(test): dedupe commits | Test infrastructure only |

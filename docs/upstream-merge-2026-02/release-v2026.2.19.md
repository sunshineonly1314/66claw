# Upstream Release: v2026.2.17 → v2026.2.19

**Commits:** ~572 (488 touching src/ui, 944 files, +39,565 / -22,750)
**Date Range:** 2026-02-18 to 2026-02-19
**Tag:** `v2026.2.19` → `2c05cbb43e`

---

## !! MASSIVE SECURITY SWEEP !! (~30 commits)

This release is dominated by a comprehensive security audit. **All security commits should be merged.**

### Critical Security (MUST MERGE)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `e0aaf2d399` | **YES** | Block prototype-polluting keys in `deepMerge` (#20853) | **CRITICAL** — CN uses deepMerge extensively |
| `9edec67a18` | **YES** | Block plaintext WebSocket to non-loopback (#20803) | LOW |
| `f1e1ad73ad` | **YES** | SHA-256 before timingSafeEqual (length leak) (#20856) | LOW |
| `baf4a799a9` | **YES** | Use YAML core schema to prevent type coercion (#20857) | LOW |
| `ee6d0bd321` | **YES** | Escape backticks in exec-approval previews (#20854) | MEDIUM — exec-approvals.ts |
| `fb35635c10` | **YES** | execFileSync instead of execSync (#20655) | **HIGH** — exec-approvals.ts modified |
| `57102cbec9` | **YES** | crypto.randomBytes for temp file names (#20654) | LOW |
| `e955582c8f` | **YES** | Baseline security headers on gateway HTTP (#10526) | MEDIUM — server-http.ts |
| `c5698caca3` | **YES** | Default gateway auth bootstrap, explicit mode none (#20686) | **HIGH** — setup-wizard |
| `45db2aa0cd` | **YES** | Disable plugin runtime command execution by default (#20828) | MEDIUM — plugins/runtime |
| `981d266480` | **YES** | Block webchat session mutators (#20800) | MEDIUM |

### SSRF Hardening

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `26c9b37f5b` | **YES** | Strict IPv4 literal handling | LOW |
| `baa335f258` | **YES** | ISATAP bypass block | LOW |
| `d51929ecb5` | **YES** | Additional SSRF hardening | LOW |

### File & Plugin Security

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `81b19aaa1a` | **YES** | Plugin and hook path containment | MEDIUM — plugins |
| `5dc50b8a3f` | **YES** | npm plugin/hook install integrity | MEDIUM |
| `cfc5e7bd82` | **YES** | saveMediaSource symlink TOCTOU fix | LOW |
| `bafdbb6f11` | **YES** | Eliminate safeBins file-existence oracle | LOW |

### Gateway Auth

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `08a7967936` | **YES** | Fail closed on gateway bind fallback, tighten canvas IP | MEDIUM |
| `0bda0202fd` | **YES** | Require explicit approval for device access upgrades | LOW |
| `732e53151e` | **YES** | OC-53: 2MB prompt size limit (ACP DoS prevention) | LOW |
| `f7a7a28c56` | **YES** | Enforce hooks token separation from gateway auth (#20813) | MEDIUM |

---

## Agent Runtime & Subagent Routing (P1)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `48e6b4fca3` | **YES** | Run BOOT.md for each configured agent at startup (#20569) | MEDIUM — behavioral change |
| `35016a380c` | **YES** | Serialize sandbox registry mutations and lock usage | LOW |
| `0bf1b38cc0` | REVIEW | Fix subagent completion thread routing | LOW |
| `e8816c554f` | REVIEW | Fix subagent delivery to origin channel | LOW |
| `289f215b31` | REVIEW | Manual subagent spawn via OriginatingTo fallback | LOW |

## Streaming Pipeline (P2)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `221d50bc18` | **YES** | Preserve assistant partial stream during reasoning | **HIGH** — pi-embedded-runner |
| `0ff506140d` | **YES** | Clear matched tool errors, dedupe reasoning end | MEDIUM |

## Gateway & Daemon (P2)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `c45f3c5b00` | REVIEW | Harden canvas auth with session capabilities | LOW |
| `ff74d89e86` | **YES** | Harden gateway control-plane restart protections | MEDIUM |
| `280c6b117b` | **YES** | Windows schtasks quoting fixes (daemon) | **HIGH** — Windows build |
| `dafe52e8cf` | **YES** | Windows schtasks quoting fixes pt2 | **HIGH** — Windows build |
| `e1059e95aa` | **YES** | Extract Windows cmd argv helpers | MEDIUM |
| `99db4d13e5` | **YES** | Guard cron webhook delivery against SSRF | LOW |

## Features (P2-P3)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `2ddc13cdb7` | REVIEW | UI: Update warning banner for control dashboard | LOW — already have update-banner.ts |
| `e3e0ffd801` | REVIEW | Audit gateway HTTP no-auth exposure | LOW |
| `f25bbbc37e` | SKIP | Switch anthropic onboarding defaults to sonnet | CN overrides anyway |

## Platform Fixes (P2)

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `2bb8ead187` | REVIEW | Fix LaunchAgent TMPDIR → SQLITE_CANTOPEN on macOS | macOS-specific |
| `7255c20ddc` | REVIEW | Harden docker-setup mount validation | LOW |
| `39881a318a` | REVIEW | Browser: reuse extension relay when port occupied | LOW |

## Config Fixes

| Commit | Merge? | Description | CN Impact |
|--------|--------|-------------|-----------|
| `b45bb6801c` | **YES** | Skip embedding provider check when QMD backend active | LOW |
| `3d4ef56044` | **YES** | Include provider/model name in billing error message | LOW |
| `b62bd290cb` | **YES** | Remove hardcoded disableBlockStreaming (honor config) | MEDIUM |
| `f855d0be4f` | **YES** | Skip heartbeat when HEARTBEAT.md absent | LOW |

## SKIP

| Category | Reason |
|----------|--------|
| Apple Watch companion (#20054) | iOS-only |
| iOS APNs wake (#20332) | iOS-only |
| Paired-device remove/clear flows (#20057) | Not relevant to CN |
| Canvas A2UI improvements (#20312) | Not used in CN |
| ~25 refactor commits | Code hygiene, merge if clean |

---
name: version-record
description: |
  Record version changes to versionrecord.md after completing a batch of feature work, bug fixes, or optimizations.
  Use this skill proactively when: (1) you finish implementing a feature or fixing a bug, (2) you complete a batch of related changes,
  (3) the user asks to log/archive what was done, (4) before committing or wrapping up a session.
  Each agent should call this skill to append its changes to the version record.
nameZh: "版本记录"
descriptionZh: "在完成功能开发、修复或优化后，将变更记录追加到 versionrecord.md，用于本地归档和发版说明。"
---

# Version Record

Append structured change entries to `versionrecord.md` (project root) after completing work.

## Format

Each entry follows this template:

```markdown
## YYYY-MM-DD HH:mm
<!-- version: X.Y.Z -->

### <Category>
- **<short title>** — <one-line description of what changed and why>
- **<short title>** — ...
```

The version number MUST be read from `package.json` (`version` field) at the time of writing. This associates each entry with the correct release version.

### Categories (pick the most fitting)

| Category | When to use |
|----------|-------------|
| `New Feature` | Wholly new functionality |
| `Enhancement` | Improvement to existing feature |
| `Bug Fix` | Correcting incorrect behavior |
| `Refactor` | Internal restructuring, no behavior change |
| `Performance` | Speed/memory/resource optimization |
| `UI/UX` | Visual or interaction changes |
| `Config` | Configuration, env, or deployment changes |
| `Docs` | Documentation updates |
| `Test` | Test additions or fixes |
| `Build` | Build system, CI/CD, packaging changes |
| `Security` | Security patches or hardening |

## Workflow

1. Read the existing `versionrecord.md` (last 30 lines) to understand the current state.
2. Read `package.json` to get the current version number (e.g. `1.1.6`).
3. Determine the current date and time (use ISO format `YYYY-MM-DD HH:mm`).
4. Compose the entry using the format above. Rules:
   - Use **Chinese** for descriptions (this is a CN project).
   - Each bullet is one logical change; group related sub-changes into a single bullet.
   - Keep descriptions concise: what changed + why, not how.
   - If multiple categories apply, use multiple `### Category` headings under the same date-time.
   - Do NOT duplicate entries that already exist in the file.
   - ALWAYS include `<!-- version: X.Y.Z -->` on the line immediately after the `## YYYY-MM-DD HH:mm` header, using the version from package.json.
5. Append the new entry to the **end** of `versionrecord.md`.
6. If `versionrecord.md` does not exist, create it with the header shown below, then append.

## Initial File Template

If creating the file for the first time:

```markdown
# OpenClawCN Version Record

> Auto-maintained by agents. Each entry records changes made during a development session.
> Used for local tracking and release notes generation.

---
```

## Example Entry

```markdown
## 2026-02-17 14:30
<!-- version: 1.1.6 -->

### New Feature
- **多模态能力检测** — 新增 modality-capability-checker，自动检测模型是否支持图片分析/生成/视频分析
- **CN Handler 聚合器** — 创建 cn-handlers.ts，将 CN 专属网关处理器与上游代码解耦

### Bug Fix
- **飞书消息回复去重** — 修复 reply-dispatcher 在高并发下重复发送回复的问题
```

## Auto-Generated Changelog

This file is the **source of truth** for `pnpm release:changelog`, which auto-generates `CHANGELOG.md` for end users.

The generator will:
- **Keep**: `New Feature`, `Enhancement`, `Bug Fix`, `UI/UX`, `Performance`, `Security`, `Config` categories
- **Drop**: `Test`, `Docs`, `Architecture`, `Research`, `Files Changed`, `Files New` sections (not user-facing)
- **Drop**: code blocks, tables, sub-bullets with file paths

So when writing entries, keep in mind:
- The **bold title** + **one-line description** in user-facing categories will appear in the changelog as-is
- Write titles that make sense to end users, not just developers
- Technical file lists and test counts are fine to include (they'll be auto-filtered out)

### Version Markers

Every entry MUST include a `<!-- version: X.Y.Z -->` marker on the line immediately after the `## YYYY-MM-DD HH:mm` header. The version number comes from `package.json`.

This marker is how `generate-changelog.ts` groups entries by version. Without it, entries cannot be correctly attributed to a release.

```markdown
## 2026-02-19 10:00
<!-- version: 1.1.7 -->
```

## Important Notes

- Always append, never overwrite or reorder existing entries.
- One date-time block per session/batch; do not create multiple blocks for the same timestamp.
- If you made no user-facing or meaningful changes, skip recording.
- ALWAYS read `package.json` version and include `<!-- version: X.Y.Z -->` — this is mandatory, not optional.

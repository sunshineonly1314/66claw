# Batch 2: P0 安全漏洞合并分析

> 双人审查制：实施者分析 + 审查者验证
> 更新时间: 2026-02-11

---

## 逐项分析结果

### SEC-01: WhatsApp accountId 路径遍历 (1bdd9e3)

**上游改动**: `resolveDefaultAuthDir()` 中对 accountId 调用 `normalizeAccountId()` 防止 `../../../etc/passwd` 类路径遍历

**CN 现状分析**:
- CN 的 `src/web/accounts.ts:88-90` — `resolveDefaultAuthDir(accountId)` 直接拼接 accountId，**未做净化**
- CN 有 `normalizeAccountId()` 函数在 `src/routing/session-key.ts:87-99`，功能完整（strip 非法字符、转小写、截断64字符）
- 但 `resolveDefaultAuthDir` **没有调用它**

**审查者验证**:
- ✅ 确认漏洞存在 — `resolveWhatsAppAuthDir` 调用 `resolveDefaultAuthDir(accountId)` 时只做了 `.trim()`，未做路径净化
- ✅ 上游修复方案简洁正确
- ⚠️ CN 还有一个额外风险点：`resolveWhatsAppAuthDir` line 109 的 `const accountId = params.accountId.trim()` 也只做了 trim

**决策**: ✅ **合并** — 纯安全补丁，不影响现有逻辑
**合并方式**: 手动修改 `src/web/accounts.ts` 的 `resolveDefaultAuthDir` 函数
**风险**: 极低

---

### SEC-02: message-tool filePath 沙盒验证 (9b6fffd)

**上游改动**: message-tool.ts 中对 filePath/path 参数调用 `assertSandboxPath()` 防止沙盒逃逸

**CN 现状分析**:
- CN 的 `src/agents/tools/message-tool.ts` (401行) — **未找到** assertSandboxPath 调用
- CN 的 `src/agents/clawdbot-tools.ts` — 对 image-tool 传递了 sandboxRoot，**但未对 message-tool 传递**
- CN 有完整的 `assertSandboxPath` 实现（src/agents/sandbox-paths.ts），但 message-tool 没接入
- 安全审计文档 Phase 2 标记 "Message Tool layer - Default rejects local files (allowLocalFiles: false)"

**审查者验证**:
- ✅ message-tool 确实有 `allowLocalFiles` 默认 false 的保护，但这是**应用层**保护
- ⚠️ 如果某处配置开启了 allowLocalFiles，或者 LLM 直接传入绝对路径，仍可能绕过
- ✅ 上游增加了**纵深防御**层 — 即使 allowLocalFiles 被开启，也要在沙盒范围内

**决策**: ✅ **合并** — 纵深防御，不影响现有功能
**合并方式**:
1. `src/agents/clawdbot-tools.ts` — 创建 message-tool 时传递 sandboxRoot
2. `src/agents/tools/message-tool.ts` — 添加 sandboxRoot 参数和 assertSandboxPath 检查
**风险**: 低

---

### SEC-03: MEDIA 路径 LFI 防护 (34e2425)

**上游改动**: `stage-sandbox-media.ts` 中对本地路径调用 `assertSandboxPath()` 防止 LFI

**CN 现状分析**:
- CN 的 `src/auto-reply/reply/stage-sandbox-media.ts` — `resolveAbsolutePath()` 只验证是否为绝对路径，**未做沙盒边界检查**
- CN 的 `src/media/parse.ts:17-27` — `isValidMedia()` 明确允许 `/`、`./`、`../`、`~` 开头的路径
- CN 有 SSRF 保护（远程 URL），但**本地路径 LFI 防护缺失**

**审查者验证**:
- ✅ 漏洞确认 — 攻击者可通过 `MEDIA:/etc/passwd` 或 `MEDIA:../../secrets.txt` 读取宿主文件
- ✅ 上游修复分两部分：(1) stage-sandbox-media 增加沙盒检查 (2) parse.ts 收紧 isValidMedia
- ⚠️ CN 的 parse.ts 改动需要注意：收紧后只允许 `./` 且无 `..`，可能影响一些合法本地路径场景

**决策**: ✅ **合并** — 高危 LFI 漏洞
**合并方式**:
1. `src/auto-reply/reply/stage-sandbox-media.ts` — 添加 assertSandboxPath 检查
2. `src/media/parse.ts` — 收紧 isValidMedia，只允许 `./` 且无 `..`
3. `src/auto-reply/reply/get-reply-run.ts` — 更新 agent hint 文本
**风险**: 中 — parse.ts 的收紧可能影响某些本地路径用法，需测试
**注意**: CN 的 SSRF 保护（fetch.ts + ssrf.ts）是 CN 独有增强，保留不覆盖

---

### SEC-04: 媒体解析器本地路径 LFI (c67df65)

**上游改动**: `src/media/parse.ts` 的 `isValidMedia()` 收紧为只允许 `./` 且无 `..`

**CN 现状分析**: 与 SEC-03 同一文件，CN 的 isValidMedia 允许 `/`、`./`、`../`、`~`

**审查者验证**: 与 SEC-03 一并处理

**决策**: ✅ **合并** — 与 SEC-03 一起处理
**合并方式**: 包含在 SEC-03 的 parse.ts 修改中
**风险**: 同 SEC-03

---

### SEC-05: lobster exec 任意命令执行 GHSA-4mhr (1295b67)

**上游改动**: lobster-tool.ts 加固 resolveExecutablePath（要求 basename 在白名单内、文件存在且可执行）和 resolveCwd（相对路径且在工作目录内）

**CN 现状分析**:
- CN 的 `extensions/lobster/src/lobster-tool.ts:74-80` — resolveExecutablePath 已有**基本验证**（只允许 "lobster" 或绝对路径）
- CN 有 **独有的 validateCwdPath** 函数（lines 30-55）— 用正则阻止敏感系统目录（/etc, /root, /var/log, /proc 等 + Windows 系统目录）
- CN 标注 "ClawdbotCN 专属：路径注入防护"

**审查者验证**:
- ✅ CN 的 resolveExecutablePath 验证较弱 — 只检查 isAbsolute，不检查 basename 是否为 lobster
- ⚠️ 攻击者仍可传入 `/bin/bash` 这样的绝对路径
- ✅ CN 的 validateCwdPath 是**CN 独有优势**，比上游更好（上游只做 path.relative 检查，CN 额外阻止敏感目录）
- 💡 最佳方案: 合并上游的 resolveExecutablePath 加固 + 保留 CN 的 validateCwdPath

**决策**: ✅ **合并（混合方案）**
**合并方式**:
1. resolveExecutablePath — 吸收上游的 basename 白名单检查 + 文件存在性检查
2. validateCwdPath — **保留 CN 版本**（比上游更好）
3. 合并上游的 pluginConfig.lobsterPath 优先逻辑
**风险**: 低
**CN 优势保留**: validateCwdPath 的敏感目录正则

---

### SEC-06: Docker sandbox PATH 注入 (771f23d)

**上游改动**: 将 PATH 值通过 `-e` 环境变量传递而非直接插入 shell 命令字符串

**CN 现状分析**:
- CN 的 `src/agents/bash-tools.shared.ts:67` — **仍使用旧的不安全方式**:
  ```ts
  const pathExport = params.env.PATH ? `export PATH="${params.env.PATH}:$PATH"; ` : "";
  ```
- CN **没有** `CLAWDBOT_PREPEND_PATH` 环境变量机制
- 恶意 PATH 如 `$(touch /tmp/pwned)` 会被 shell 执行

**审查者验证**:
- ✅ 漏洞确认 — shell 注入风险明确存在
- ✅ 上游修复方案正确 — 通过 docker -e 传递避免 shell 解析
- ⚠️ 需注意 CN 的 buildDockerExecArgs 函数可能有其他调用方，需确认不影响

**决策**: ✅ **合并**
**合并方式**: 修改 `src/agents/bash-tools.shared.ts` 的 `buildDockerExecArgs`
**风险**: 低 — 只影响 Docker 场景

---

## 合并执行顺序

| 序号 | 项目 | 优先级 | 预估时间 |
|------|------|--------|---------|
| 1 | SEC-06 Docker PATH 注入 | P0 | 15min |
| 2 | SEC-01 WhatsApp accountId 路径遍历 | P0 | 10min |
| 3 | SEC-03+04 media parse.ts LFI | P0 | 30min |
| 4 | SEC-02 message-tool 沙盒验证 | P0 | 20min |
| 5 | SEC-05 lobster exec 加固 | P0 | 30min |

---

## 状态跟踪

- [x] SEC-06 Docker PATH injection ✅ (bash-tools.shared.ts — CLAWDBOT_PREPEND_PATH 方案)
- [x] SEC-01 WhatsApp accountId ✅ (web/accounts.ts — normalizeAccountId 调用)
- [x] SEC-03+04 media parse LFI ✅ (parse.ts 收紧 + stage-sandbox-media.ts 沙盒检查)
- [x] SEC-02 message-tool sandbox ✅ (message-tool.ts + clawdbot-tools.ts — sandboxRoot 传递)
- [x] SEC-05 lobster exec ✅ (混合方案: 上游 basename 白名单 + CN validateCwdPath 保留)

## 编译验证

- TypeScript `tsc --noEmit`: **0 errors** ✅
- 日期: 2026-02-11

## CN 优势保留清单

| 文件 | CN 独有特性 | 保留状态 |
|------|-----------|---------|
| extensions/lobster/src/lobster-tool.ts | validateCwdPath + BLOCKED_CWD_PATTERNS 敏感目录正则 | ✅ 保留 |
| src/media/fetch.ts | SSRF 保护 (validateUrlForSsrf) | ✅ 保留 |
| src/infra/net/ssrf.ts | 完整 SSRF 验证（私有 IP/metadata/local 域名阻止） | ✅ 保留 |
| src/media/fetch.security.test.ts | SSRF 安全测试覆盖 | ✅ 保留 |

## 变更文件汇总

| 文件 | 变更类型 | 关联 SEC |
|------|---------|---------|
| src/agents/bash-tools.shared.ts | 修改 buildDockerExecArgs | SEC-06 |
| src/web/accounts.ts | 修改 import + resolveDefaultAuthDir | SEC-01 |
| src/media/parse.ts | 修改 isValidMedia + looksLikeLocalPath | SEC-03+04 |
| src/auto-reply/reply/stage-sandbox-media.ts | 修改 import + 添加沙盒边界检查 | SEC-03 |
| src/agents/tools/message-tool.ts | 修改 import + MessageToolOptions + execute | SEC-02 |
| src/agents/clawdbot-tools.ts | 修改 createMessageTool 参数 | SEC-02 |
| extensions/lobster/src/lobster-tool.ts | 修改 resolveExecutablePath + isWindowsSpawn | SEC-05 |

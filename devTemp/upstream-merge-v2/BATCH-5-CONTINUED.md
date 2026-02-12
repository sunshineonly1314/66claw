# Batch 5: 延后项继续分析与合并

> 双人审查制 | 创建时间: 2026-02-11

---

## 本轮合并项

### CH-07: Discord Exec-Approvals 按钮认证修复 (**P0 安全 — 升级**)

**上游关联**: commit 4537ebc43
**问题**: `ExecApprovalButton.run()` 没有验证按下按钮的用户是否在 `approvers` 列表中。
任何收到 DM 的人（包括转发/截图分享场景）都能批准或拒绝命令执行。
**CN 现状**: exec-approvals.ts 存在相同漏洞
**修复方案**:
1. 在 `DiscordExecApprovalHandler` 类上添加 `isApprover(userId: string)` 公开方法
2. 在 `ExecApprovalButton.run()` 开头检查 `interaction.user?.id`，拒绝非 approver
3. 非授权用户收到 ephemeral 回复 "You are not authorized..."

**决策**: ✅ **合并 — P0 安全漏洞**
**影响文件**: 1 个 (`src/discord/monitor/exec-approvals.ts`)
**风险**: 低

---

### CH-09: Telegram 引用解析修复

**上游关联**: commits a4b38ce88 + 1c1d7fa0e + 582732391
**问题**: 上游修复 `reply_parameters` API (Bot API 7.0+) 的 quote_text 相关问题
**CN 现状**: CN 使用旧式 `reply_to_message_id`，完全没有 `reply_parameters` / `quote_text` 功能
**决策**: ❌ **跳过 — CN 不使用此 API 特性，上游修复不适用**

---

### CH-11: Discord Forum/Media 线程自动创建

**上游关联**: commit ead3bb645
**问题**: 向 Discord Forum/Media 频道发消息时不会自动创建线程，导致发送失败
**CN 现状**: CN 已有 Forum 频道的**接收**支持（`message-handler.process.ts`、`threading.ts`），
但**发送**端（`send.outbound.ts`）没有检查目标是否 Forum 并自动创建线程
**决策**: ⚠️ **延后 — P2 功能增强，复杂度中等，需要修改 send 路径**

---

### CH-12: Telegram Video Note (圆形视频) 支持

**上游关联**: commit fb8e4489a
**问题**: Telegram 圆形视频消息 (`video_note`) 被完全忽略（返回 null，消息丢失）
**CN 现状**: `resolveMedia()` 只处理 photo/video/document/audio/voice，完全遗漏 video_note
**修复方案**:
1. `delivery.ts` `resolveMedia()` — media 选择链添加 `msg.video_note`
2. `delivery.ts` — placeholder 添加 video_note → `<media:video>`
3. `bot-message-context.ts` — placeholder 添加 video_note
4. `bot/helpers.ts` `describeReplyTarget()` — 引用回复中识别 video_note

**决策**: ✅ **合并 — 修复消息丢失 bug**
**影响文件**: 3 个
**风险**: 低

---

## 剩余上游安全项分析

### SEC-07: Gateway Canvas Host 认证 (47538bc)
**分析**: CN 已有 canvas host 基础设施（14+ 文件引用）。canvas HTTP 请求不经过 gateway token 认证，
但这是设计如此（静态 UI 资源）。上游可能增加了新的认证层。
**决策**: ⚠️ **延后 — 需要上游 diff 确认具体改动范围，涉及 gateway 深层架构**

### SEC-08: Device Bypass Shared Auth (fe81b1d)
**分析**: CN 中 "device bypass" 仅在 i18n、logout test、onboarding finalize 中出现，
不是核心安全路径。
**决策**: ⚠️ **延后 — 低优先级**

### SEC-09: Environment Variable Validation in Exec Tool (0a5821a)
**分析**: CN 已有 PATH 注入防护 (SEC-06 已合并)。bash-tools.shared.ts:66-68 将所有非 PATH 的 env 直接传递到 Docker 容器（潜在风险：LD_PRELOAD、PYTHONPATH 等）。
**CN 威胁模型**: 单用户自托管架构，env 由用户配置文件控制，不是外部攻击面。
**决策**: ❌ **跳过 — 威胁模型不适用（多租户场景才需要）**

### SEC-10: Web Tools/File Parsing Hardening (b796f6e)
**分析**: CN 已有 SSRF 保护 (`ssrf.js`，Batch 2 确认保留)。web tools 加固是额外防御层。
**决策**: ⚠️ **延后 — CN 已有 SSRF 保护**

### SEC-11: Skill/Plugin Code Safety Scanner (bc88e58)
**分析**: 全新功能模块（7 个相关文件）。CN 当前无此功能。
**决策**: ⚠️ **延后 — 新功能模块，需独立批次**

---

## 状态跟踪

- [x] CH-07 Discord 按钮认证 — ✅ `isApprover()` + interaction.user.id 检查 (**P0 安全**)
- [x] CH-09 Telegram 引用修复 — ❌ **跳过（CN 不使用 reply_parameters）**
- [x] CH-11 Discord Forum 线程 — ⚠️ **延后（P2 功能增强）**
- [x] CH-12 Telegram video_note — ✅ 3 文件修复（media 选择 + placeholder + reply target）
- [x] SEC-07 Canvas Host Auth — ⚠️ **延后（需上游 diff）**
- [x] SEC-08 Device Bypass Auth — ⚠️ **延后（低优先级）**
- [x] SEC-09 Env Validation — ❌ **跳过（CN 单用户架构，威胁模型不适用）**
- [x] SEC-10 Web Tools Hardening — ⚠️ **延后（CN 已有 SSRF）**
- [x] SEC-11 Skill Safety Scanner — ⚠️ **延后（新功能模块）**

---

## Batch 6: 小型改进项分析

### CH-13: fetchWithTimeout 共享工具提取

**上游目的**: 统一多个重复的 `fetchWithTimeout` 实现
**CN 现状**: 已有共享实现 (`media-understanding/providers/shared.ts`)，但另有 7+ 独立实现分散在各模块
**签名差异**:
- `media-understanding/providers/shared.ts`: `(url, init, timeoutMs, fetchFn)` — 4 参数
- `discord/probe.ts`: `(url, timeoutMs, fetcher, headers?)` — 参数顺序不同
- `telegram/download.ts`: `(url, timeoutMs, options?)` — 使用全局 fetch

**决策**: ⚠️ **延后 — 需修改 13+ 调用点，纯重构，优先级 P2**

---

### SEC-09: Environment Variable Validation (已在上方)

**决策**: ❌ **跳过 — CN 单用户自托管，威胁模型不适用**

---

TypeScript `tsc --noEmit`: **0 errors** ✅ (2026-02-11)

## 变更文件汇总

| 文件 | 变更类型 | 关联 |
|------|---------|------|
| src/discord/monitor/exec-approvals.ts | 认证检查 + isApprover() | CH-07 |
| src/telegram/bot/delivery.ts | video_note media 选择 + placeholder | CH-12 |
| src/telegram/bot-message-context.ts | video_note placeholder | CH-12 |
| src/telegram/bot/helpers.ts | video_note reply target | CH-12 |

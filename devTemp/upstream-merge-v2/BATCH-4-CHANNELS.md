# Batch 4: 频道/平台修复合并分析

> 双人审查制 | 创建时间: 2026-02-11

---

## P0 安全/稳定性（必须合并）

### CH-01: Telegram 文件下载超时 DoS 防护 (d46b489e2)

**上游改动**: Telegram 文件下载增加 30s/60s 超时，防止 CWE-400 资源耗尽
**CN 现状**: 待检查
**决策**: 待分析
**风险**: 低 — 单文件改动

---

### CH-02: Discord Gateway 重连无限循环上限 (d3c71875e)

**上游改动**: 限制 Discord gateway 重连为 50 次（~25分钟窗口），防止无限循环阻塞事件循环
**CN 现状**: 待检查
**决策**: 待分析
**风险**: 低 — 2 文件改动

---

### CH-03: Slack 媒体下载验证 + URL 校验 (4e4ed2ea1)

**上游改动**: 验证 Slack 文件 URL 并限制媒体下载大小
**CN 现状**: 待检查
**决策**: 待分析
**风险**: 低 — 6 文件改动

---

### CH-04: Signal 群组消息 mention gating 强制执行 (1d46ca3a9)

**上游改动**: Signal 群组消息绕过了 mention gating，现在与其他频道对齐
**CN 现状**: 待检查
**决策**: 待分析
**风险**: 低 — 2 文件改动

---

### CH-05: 不可信频道元数据与系统提示分离 (35eb40a70)

**上游改动**: 将 Discord/Slack 元数据从系统提示中分离，防止注入攻击
**CN 现状**: 待检查
**决策**: 待分析
**风险**: 中 — 13 文件改动

---

### CH-06: auto-reply 发送者身份欺骗防护 (53273b490)

**上游改动**: 分离 inbound-meta 和 inbound-sender-meta，防止群组中身份欺骗
**CN 现状**: 待检查
**决策**: 待分析
**风险**: 极高 — 42 文件改动
**注意**: 这是一个大型重构，可能需要延后或分阶段处理

---

### CH-07: Discord Agent 组件 DM 认证强制执行 (4537ebc43)

**上游改动**: Discord DM 的 agent 组件认证验证
**CN 现状**: 待检查
**决策**: 待分析
**风险**: 中 — 5 文件、659 行新增

---

## P1 重要修复

### CH-08: Telegram DM allowFrom 匹配修复 (29425e27e + a77afe618)

**上游改动**: 修复 Telegram DM 使用 chatId 而非 user id 进行 allowFrom 匹配
**CN 现状**: 待检查
**决策**: 待分析
**风险**: 低

---

### CH-09: Telegram 引用解析修复 (a4b38ce88 + 1c1d7fa0e + 582732391)

**上游改动**: 修复 Telegram 引用上下文保留和 QUOTE_TEXT_INVALID 错误
**CN 现状**: 待检查
**决策**: 待分析
**风险**: 低

---

### CH-10: Slack slash 命令 fail-closed 安全修复 (fff59da96)

**上游改动**: 如果频道类型查找失败，默认拒绝 slash 命令
**CN 现状**: 待检查
**决策**: 待分析
**风险**: 低

---

### CH-11: Discord Forum/Media 频道自动创建线程 (ead3bb645)

**上游改动**: 向 Discord Forum/Media 频道发送时自动创建线程
**CN 现状**: 待检查
**决策**: 待分析
**风险**: 低

---

### CH-12: Telegram 视频笔记支持 (fb8e4489a)

**上游改动**: 完整的 Telegram 视频笔记支持
**CN 现状**: 待检查
**决策**: 待分析
**风险**: 低

---

### CH-13: fetchWithTimeout 共享工具函数 (a26670a2f)

**上游改动**: 将 fetchWithTimeout 提取为共享工具函数
**CN 现状**: 待检查（CN 可能已有类似实现）
**决策**: 待分析
**风险**: 中

---

### CH-14: Feishu 频道支持扩展 (4fc4c5256 + 7c951b01a)

**上游改动**: Feishu 大幅扩展：post解析、文档链接、路由、回复、表情、打字、用户查找
**CN 现状**: 待检查
**决策**: 待分析
**风险**: 中 — 17 文件、1517 行新增

---

## 状态跟踪

- [x] CH-01 Telegram 下载超时 — ❌ **跳过（CN 已有更完善实现，30s API/120s 下载，options 对象参数）**
- [x] CH-02 Discord 重连上限 — ✅ `maxAttempts: 50` (防止无限循环)
- [x] CH-03 Slack 媒体验证 — ✅ Slack URL 域名白名单 + 重定向协议检查 + maxBytes 传递
- [x] CH-04 Signal mention gating — ✅ 完整实现（mention 检测 + pending history 保留）
- [ ] CH-05 元数据注入防护 — ⚠️ 13 文件，延后到下一批次
- [ ] CH-06 发送者欺骗防护 — ⚠️ 42 文件，延后到独立批次
- [x] CH-07 Discord 按钮认证 — ✅ **P0 安全修复** `isApprover()` 检查 (Batch 5)
- [x] CH-08 Telegram DM allowFrom — ✅ `msg.from.id` 优先于 `chatId`
- [x] CH-09 Telegram 引用修复 — ❌ **跳过（CN 不使用 reply_parameters API）** (Batch 5)
- [x] CH-10 Slack slash 命令 — ✅ `normalizeSlackChannelType` fail-closed
- [x] CH-11 Discord Forum 线程 — ⚠️ **延后（P2 功能增强，send 路径需改动）** (Batch 5)
- [x] CH-12 Telegram 视频笔记 — ✅ video_note 3 文件修复 (Batch 5)
- [ ] CH-13 fetchWithTimeout 共享 — P2 延后（重构）
- [ ] CH-14 Feishu 扩展 — P2 延后（功能增强，17文件）

TypeScript `tsc --noEmit`: **0 errors** ✅ (2026-02-11, CH-02/03/04/08/10 included)

## 变更文件汇总

| 文件 | 变更类型 | 关联 CH |
|------|---------|--------|
| src/discord/monitor/provider.ts | `maxAttempts: 50` | CH-02 |
| src/slack/monitor/media.ts | URL 域名验证 + 协议安全 + maxBytes | CH-03 |
| src/signal/monitor/event-handler.ts | mention gating 完整实现 | CH-04 |
| src/telegram/bot-message-context.ts | DM allowFrom 使用 user id | CH-08 |
| src/slack/monitor/slash.ts | `normalizeSlackChannelType` fail-closed | CH-10 |

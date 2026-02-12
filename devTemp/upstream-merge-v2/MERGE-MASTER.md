# ClawdbotCN 上游合并主控文件 v2

> **开始日期**: 2026-02-11
> **策略**: 逐 commit cherry-pick + 双人审查（实施者 + 审查者）
> **原则**: 好的吸收，不好的不吸收，CN 独有优化不覆盖

---

## 工作原则

1. **不直接 merge** — 逐项 cherry-pick 或手动移植
2. **双人制** — 实施者分析 + 审查者交叉验证
3. **CN 优先** — 如果 CN 已有更好的实现，保留 CN 版本
4. **文件记录** — 每项合并决策都记录在案，防止上下文丢失
5. **冲突上报** — 严重冲突不强行解决，报告人工决策

---

## 批次状态

| 批次 | 内容 | 状态 | 文件 |
|------|------|------|------|
| Batch 2 | P0 安全漏洞 (6项) | ✅ 全部完成 | BATCH-2-SECURITY.md |
| Batch 3 | 核心功能增强 (9项) | ✅ 4项合并/3项跳过/2项延后 | BATCH-3-CORE.md |
| Batch 4 | 渠道/平台修复 (14项) | ✅ 5项合并/1项跳过/8项延后 | BATCH-4-CHANNELS.md |
| Batch 5 | 延后项继续 (9项) | ✅ 2项合并/2项跳过/5项延后 | BATCH-5-CONTINUED.md |
| Batch 7 | 元数据注入防护 (1项) | ✅ 1项合并 | BATCH-7-METADATA-INJECTION.md |
| Batch 6 | 小型改进项 (2项) | ✅ 0项合并/2项跳过 | (记录于 BATCH-5) |
| Batch 8 | 发送者欺骗防护 (1项) | ⚠️ 1项延后 | BATCH-8-SENDER-SPOOFING.md |
| Batch 9 | 小型改进审查 (3项) | ❌ 3项跳过 | BATCH-9-SMALL-ITEMS.md |

---

## 全局合并总结 (截至 2026-02-11)

### 变更文件清单 (24个源文件)

**Batch 2 — 安全漏洞修复 (7文件)**

| # | 文件 | 变更 | 批次 |
|---|------|------|------|
| 1 | src/agents/bash-tools.shared.ts | 修改 | SEC-06 Docker PATH 注入修复 |
| 2 | src/web/accounts.ts | 修改 | SEC-01 WhatsApp accountId 路径遍历 |
| 3 | src/media/parse.ts | 修改 | SEC-03+04 MEDIA LFI 修复 |
| 4 | src/auto-reply/reply/stage-sandbox-media.ts | 修改 | SEC-03 沙盒边界检查 |
| 5 | src/agents/tools/message-tool.ts | 修改 | SEC-02 message-tool 沙盒验证 |
| 6 | src/agents/clawdbot-tools.ts | 修改 | SEC-02 sandboxRoot 传递 |
| 7 | extensions/lobster/src/lobster-tool.ts | 修改 | SEC-05 exec 加固（混合方案） |

**Batch 3 — 核心功能增强 (5文件)**

| # | 文件 | 变更 | 批次 |
|---|------|------|------|
| 8 | src/config/defaults.ts | 修改 | CORE-03 maxTokens 钳位 |
| 9 | src/utils/normalize-secret-input.ts | **新增** | CORE-04 API Key 换行清理 |
| 10 | src/agents/model-auth.ts | 修改 | CORE-04 API Key 换行清理 |
| 11 | src/agents/tools/sessions-history-tool.ts | 修改 | CORE-07 sessions_history 80KB 保护 |
| 12 | src/gateway/server-methods/chat.ts | 修改 | CORE-05 compaction amnesia 修复 |

**Batch 4 — 频道/平台修复 (5文件)**

| # | 文件 | 变更 | 批次 |
|---|------|------|------|
| 13 | src/discord/monitor/provider.ts | 修改 | CH-02 Discord 重连上限 50 |
| 14 | src/slack/monitor/media.ts | 修改 | CH-03 Slack URL 域名验证 |
| 15 | src/signal/monitor/event-handler.ts | 修改 | CH-04 Signal mention gating |
| 16 | src/telegram/bot-message-context.ts | 修改 | CH-08 DM allowFrom + CH-12 video_note |
| 17 | src/slack/monitor/slash.ts | 修改 | CH-10 Slack slash fail-closed |

**Batch 5 — 延后项继续 (4文件)**

| # | 文件 | 变更 | 批次 |
|---|------|------|------|
| 18 | src/discord/monitor/exec-approvals.ts | 修改 | CH-07 按钮认证修复 (P0安全) |
| 19 | src/telegram/bot/delivery.ts | 修改 | CH-12 video_note media 识别 |
| 20 | src/telegram/bot-message-context.ts | 修改 | CH-12 video_note placeholder |
| 21 | src/telegram/bot/helpers.ts | 修改 | CH-12 video_note reply target |

**Batch 7 — 元数据注入防护 (1文件)**

| # | 文件 | 变更 | 批次 |
|---|------|------|------|
| 22 | src/auto-reply/envelope.ts | 修改 | CH-05 元数据注入防护 (P0安全) |

**审查记录文件 (6文件)**

| # | 文件 | 类型 |
|---|------|------|
| 23 | devTemp/upstream-merge-v2/BATCH-2-SECURITY.md | 审查记录 |
| 24 | devTemp/upstream-merge-v2/BATCH-3-CORE.md | 审查记录 |
| 25 | devTemp/upstream-merge-v2/BATCH-4-CHANNELS.md | 审查记录 |
| 26 | devTemp/upstream-merge-v2/BATCH-5-CONTINUED.md | 审查记录 |
| 27 | devTemp/upstream-merge-v2/BATCH-7-METADATA-INJECTION.md | 审查记录 |
| 28 | devTemp/upstream-merge-v2/MERGE-MASTER.md | 主控文件 |

### CN 优势保留清单

| CN 独有特性 | 保留状态 |
|-----------|---------|
| lobster validateCwdPath 敏感目录正则 | ✅ 保留 |
| SSRF 保护 (fetch.ts + ssrf.ts) | ✅ 保留 |
| SSRF 安全测试 (fetch.security.test.ts) | ✅ 保留 |
| stripReasoningTagsFromText (CN 已有) | ✅ 不覆盖 |
| stripDowngradedToolCallText (CN 已有) | ✅ 不覆盖 |
| Telegram 下载超时 (CN 更完善: options 对象参数) | ✅ 不覆盖 |
| Telegram reply_parameters (CN 不使用此 API) | ✅ 不引入 |

### 跳过/延后项

**已跳过（CN 已有或不适用）:**

| 项目 | 原因 |
|------|------|
| CORE-01 think 标签泄露 | CN 已有相同实现 |
| CORE-02 streaming 剥离 | CN 已有相同实现 |
| CORE-06 throwIfAborted 统一 | 纯重构性质，CN 有自己的 abort 工具链 |
| CORE-09 tsdown hooks | CN 不使用 tsdown |
| CH-01 Telegram 下载超时 | CN 已有更完善实现 |
| CH-09 Telegram 引用修复 | CN 不使用 reply_parameters API |
| SEC-09 Env validation | CN 单用户架构，威胁模型不适用 |
| CH-13 fetchWithTimeout 共享 | CN 已有但签名不统一，纯重构 |
| **CH-14 Feishu 扩展** | **CN extensions/feishu 已有完整实现（18 文件）** ← **Batch 9 确认** |
| SEC-08 Device Bypass Auth | 低优先级，非核心路径 ← Batch 9 |
| **CORE-08 Session 维护** | **规模过大（23文件/1566行），单用户收益低** ← **Batch 10 跳过** |

**仍延后（需后续批次）:**

| 项目 | 原因 | 规模 |
|------|------|------|
| CH-05 上游方案 (结构化分离) | CN 已用 sanitizer 快速修复（Batch 7），上游方案需协议改动 | 40+ 文件 |
| CH-06 发送者欺骗防护 | 大型重构（42文件），Batch 7 已防护P0注入，身份欺骗为P2风险 | Batch 8 延后 |
| CH-11 Discord Forum 线程 | P2 功能增强，需修改 send 路径 | 中等规模 |
| CH-13 fetchWithTimeout 共享 | P2 重构，13+ 调用点 | 中等规模 |
| SEC-07 Canvas Host Auth | 需上游 diff 确认改动 | 深层架构 |
| SEC-10 Web Tools Hardening | CN 已有 SSRF 保护 | 中等规模 |
| SEC-11 Skill Safety Scanner | CN 已有 Docker 沙盒 + 安装审批，代码扫描为额外层 | Batch 11 延后 |

### 合并统计

| 类别 | 合并 | 跳过 | 延后 | 总计 |
|------|------|------|------|------|
| Batch 2 安全 | 6 | 0 | 0 | 6 |
| Batch 3 核心 | 4 | 3 | 2 | 9 |
| Batch 4 频道 | 5 | 1 | 8 | 14 |
| Batch 5 继续 | 2 | 2 | 5 | 9 |
| Batch 6 小型 | 0 | 2 | 0 | 2 |
| Batch 7 安全 | 1 | 0 | 0 | 1 |
| Batch 8 发送者 | 0 | 0 | 1 | 1 |
| Batch 9 小型 | 0 | 3 | 0 | 3 |
| Batch 10 系统 | 0 | 1 | 0 | 1 |
| Batch 11 安全 | 0 | 0 | 1 | 1 |
| **合计** | **18** | **14** | **17** | **49** |

### 编译验证

- TypeScript `tsc --noEmit`: **0 errors** ✅ (2026-02-11, 全部 4 个批次)

---

## 合并决策日志

详见各批次文件:
- BATCH-2-SECURITY.md — 6 项安全漏洞修复详情
- BATCH-3-CORE.md — 9 项核心功能分析详情
- BATCH-4-CHANNELS.md — 14 项频道/平台修复详情
- BATCH-5-CONTINUED.md — 9 项延后项继续分析详情

## 独立审查发现及修复 (Review Phase)

1. **P1**: message-tool.ts 缺少 `media` 字段沙盒检查 → 已修复（添加 HTTP URL 排除）
2. **P2**: sessions-history-tool.ts `contentTruncated` 引用比较始终为 true → 已修复（改为 `bytes` 字段）

## 变更摘要 (git diff --stat)

```
21 source files changed, ~430 insertions(+), ~180 deletions(-)
```

重点变更:
- **安全修复**: 路径遍历、LFI、沙盒逃逸、PATH 注入、token 泄露、按钮认证缺失
- **数据完整性**: compaction amnesia、sessions_history 溢出保护
- **平台对齐**: Signal mention gating、Telegram DM allowFrom、Slack fail-closed
- **功能补全**: Telegram video_note 支持

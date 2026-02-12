# Batch 3: 核心功能增强合并分析

> 双人审查制 | 更新时间: 2026-02-11

---

## 逐项分析结果

### CORE-01: think 标签泄露修复 (67d25c653)

**上游改动**: message-tool.ts 中 strip `<think>` 标签
**CN 现状**: ✅ 已有！`stripReasoningTagsFromText` 存在于 `src/shared/text/reasoning-tags.ts`，message-tool.ts 已接入
**决策**: ❌ **跳过** — CN 已有相同实现

---

### CORE-02: streaming 路径文本剥离 (22458f57f)

**上游改动**: emitBlockChunk 中增加 stripDowngradedToolCallText，支持 [Historical context:...] 清理
**CN 现状**: ✅ 已有！`stripDowngradedToolCallText` 存在于 `pi-embedded-utils.ts`，`emitBlockChunk` 已调用
**决策**: ❌ **跳过** — CN 已有相同实现

---

### CORE-03: maxTokens 超过 contextWindow 的钳位 (eed580d31)

**上游改动**: `defaults.ts` 中 `Math.min(rawMaxTokens, contextWindow)`
**CN 现状**: CN 的 defaultMaxTokens 已是 `Math.min(DEFAULT_MODEL_MAX_TOKENS, contextWindow)`，但如果用户显式配置 `raw.maxTokens` 大于 contextWindow，CN **不会钳位**
**审查者验证**:
- CN 现有: `const maxTokens = isPositiveNumber(raw.maxTokens) ? raw.maxTokens : defaultMaxTokens;`
- 上游新增一层: `const maxTokens = Math.min(rawMaxTokens, contextWindow);`
- 这是一个边界保护，防止用户配置错误导致 API 静默失败
**决策**: ✅ **合并** — 简单的边界保护
**风险**: 极低

---

### CORE-04: 粘贴 API Key 的换行符清理 (42a07791c)

**上游改动**: 新建 `normalize-secret-input.ts`，全局替换 `.trim()` 为 `normalizeSecretInput()`
**CN 现状**: ❌ 不存在。CN 有 `redactSensitiveText` 用于日志脱敏，但没有输入端的换行符清理
**审查者验证**:
- 这是用户体验改善：从终端粘贴 API key 时可能带入 `\r\n`
- 影响 15 个文件，改动面较大
- 但核心逻辑简单，不影响功能逻辑
**决策**: ✅ **合并（核心工具函数 + 关键调用点）**
**合并策略**:
1. 创建 `src/utils/normalize-secret-input.ts`
2. 在最关键的入口点使用：auth-profiles、model-auth、onboard
3. 不需要覆盖所有 15 个文件，选关键的几个即可
**风险**: 低

---

### CORE-05: Gateway post-compaction amnesia 修复 (0cf93b8fa)

**上游改动**: chat.ts 中把 raw JSONL 写入改为通过 SessionManager.appendMessage 确保 parentId 链
**CN 现状**: ❌ **存在同样的漏洞**
- `appendAssistantTranscriptMessage()` (lines 100-154) 使用 `fs.appendFileSync` 直接写 JSONL
- 写入的 transcriptEntry 没有 `parentId` 字段
- `chat.inject` (lines 664-684) 完全重复相同的 raw JSONL 写入逻辑
- 两处都使用 `stopReason: "injected"` (非标准 Pi enum)
- 两处都使用 `randomUUID().slice(0, 8)` 自行生成 id

**审查者深度验证 (2026-02-11)**:
- ✅ 漏洞确认 — `fs.appendFileSync` 写入缺少 `parentId`，compaction 后 parentId 链断裂
- ✅ CN 已有 `SessionManager.open()` + `appendMessage()` 的使用先例：
  - `src/config/sessions/transcript.ts:97-119` — 正确使用，带 api/provider/model/usage 字段
  - `src/agents/pi-embedded-runner/compact.ts` — 正确使用
  - `src/agents/session-tool-result-guard.ts` — 正确使用
- ✅ 修复方案清晰：改用 `SessionManager.open(transcriptPath).appendMessage(messageBody)`
- ⚠️ 影响范围：chat.ts 是核心文件，CN 有大量自定义逻辑
- ⚠️ `appendAssistantTranscriptMessage` 在两处调用：chat.send fallback (line ~550) 和直接函数
- ⚠️ `chat.inject` 有独立的重复逻辑需要合并

**修复要点**:
1. `appendAssistantTranscriptMessage()` — 改用 `SessionManager.appendMessage()`
2. 消息体增加 `api: "openai-responses"`, `provider: "clawdbot"`, `model: "gateway-injected"`
3. `stopReason: "injected"` → `stopReason: "stop"` (Pi 合法枚举值)
4. 完善 usage 结构（增加 cacheRead/cacheWrite/cost 字段）
5. `chat.inject` — 改为调用共享的 `appendAssistantTranscriptMessage()` 消除重复

**决策**: ✅ **合并** — 严重的数据完整性问题，compaction 后上下文丢失
**风险**: 中-高 — chat.ts 是核心文件，但修改范围明确，CN 已有 SessionManager 使用先例可参考

---

### CORE-06: throwIfAborted 统一 + compaction 错误判断修复 (79c246666)

**上游改动**: 提取共享 throwIfAborted，修复 isCompactionFailureError 匹配
**CN 现状分析 (2026-02-11)**:
- `throwIfAborted` 在 3 个文件中重复定义：
  1. `src/infra/outbound/deliver.ts:77-81` — `throw new Error("Outbound delivery aborted")` (缺少 err.name)
  2. `src/infra/outbound/message-action-runner.ts:602-608` — `err.name = "AbortError"` ✅
  3. `src/infra/outbound/outbound-send-service.ts:60-66` — `err.name = "AbortError"` ✅
- **不一致问题**: `deliver.ts` 的实现不设 `err.name = "AbortError"`，
  导致 `isAbortError(err)` 检查可能在 deliver 路径上不匹配
- `isCompactionFailureError` 在 `src/agents/pi-embedded-helpers/errors.ts:39-49` — 逻辑正确，
  第 47 行 `lower.includes("compaction")` 已覆盖所有变体
- CN 还有独立的 abort 工具：`src/agents/pi-tools.abort.ts` (`throwAbortError`, `combineAbortSignals`)
  和 `src/agents/pi-embedded-runner/abort.ts` (`isAbortError`)

**审查者验证**:
- ✅ `throwIfAborted` 重复确认 — 3 处重复，其中 1 处行为不一致
- ✅ `isCompactionFailureError` 当前工作正常，无需修改
- ⚠️ 统一 throwIfAborted 虽然是好的重构，但涉及 3+ 文件的 import 变更
- ⚠️ 这是纯重构性质，不修复任何已知 bug（deliver.ts 的不一致在实际使用中未暴露问题）
- ⚠️ CN 已有更完整的 abort 工具链 (pi-tools.abort.ts)，上游可能用更简单的方式

**决策**: ❌ **跳过** — 纯重构性质，收益低，冲突风险中等
**原因**:
1. `isCompactionFailureError` 当前实现正确，无需修复
2. `throwIfAborted` 统一虽好但属于代码美化，不修复实际 bug
3. CN 有自己的 abort 工具链 (pi-tools.abort.ts / pi-embedded-runner/abort.ts)
4. deliver.ts 的 err.name 不一致是潜在问题，但可以作为独立的小修复单独处理
**风险**: 跳过无风险

---

### CORE-07: sessions_history 超限防护 (bccdc95a9)

**上游改动**: 新增 SESSIONS_HISTORY_MAX_BYTES (80KB)、消息净化、字段裁剪、硬上限
**CN 现状**: ❌ 不存在。CN 只有 gateway 层的 6MB capArrayByJsonBytes，sessions_history 工具本身无保护
**审查者验证**:
- sessions_history 工具返回的内容直接进入 LLM 上下文
- 大量历史消息可导致 context overflow
- 上游新增多层保护：字段裁剪(details/usage/thinkingSignature)、文本截断(4000字符)、总字节上限(80KB)、超大单消息替换
**决策**: ✅ **合并** — 重要的 context overflow 防护
**风险**: 中 — sessions-history-tool.ts 可能有 CN 自定义

---

### CORE-08: Session 维护 + Cron 清理 (e19a23520)

**上游改动**: 23 文件 1566 行新增 — session store pruning、cron reaper、维护警告系统
**CN 现状**: ❌ 完全不存在。CN 没有 session 维护/清理功能
**审查者验证**:
- 这是一个大型功能新增，涉及 23 个文件
- 新增了 session store 修剪、条目上限、文件轮转、cron 会话回收器
- CN 独有的上下文裁剪 (context-pruning) 和 compaction 已处理内存端，但磁盘端缺失
- 直接 cherry-pick 可能冲突严重
**决策**: ⚠️ **延后到独立批次** — 太大太复杂，需要单独处理
**风险**: 极高 — 23 个文件，1566 行新增

---

### CORE-09: tsdown 迁移后 bundled hooks 修复 (5ac1be9cb)

**上游改动**: tsdown.config.ts 增加 hook handler 入口，fix copy-hook-metadata.ts 目标路径
**CN 现状**: CN 未迁移到 tsdown，仍使用 tsc
**决策**: ❌ **跳过** — CN 不使用 tsdown，无此问题
**审查者验证**: 正确。CN 没有 tsdown.config.ts，hooks 编译通过 tsc 正常工作

---

## 本批次执行计划

| 序号 | 项目 | 决策 | 预估时间 |
|------|------|------|---------|
| 1 | CORE-01 think 标签 | 跳过 | — |
| 2 | CORE-02 streaming 剥离 | 跳过 | — |
| 3 | CORE-03 maxTokens 钳位 | ✅ 合并 | 5min |
| 4 | CORE-04 API Key 换行清理 | ✅ 合并 | 20min |
| 5 | CORE-05 compaction amnesia | ✅ 合并 | 40min |
| 6 | CORE-06 throwIfAborted | ❌ 跳过 | — |
| 7 | CORE-07 sessions_history 保护 | ✅ 合并 | 30min |
| 8 | CORE-08 Session 维护系统 | 延后 | — |
| 9 | CORE-09 tsdown hooks | 跳过 | — |

---

## 状态跟踪

- [x] CORE-01 think 标签泄露 — **跳过（CN 已有）**
- [x] CORE-02 streaming 文本剥离 — **跳过（CN 已有）**
- [x] CORE-03 maxTokens 钳位 — ✅ `Math.min(rawMaxTokens, contextWindow)`
- [x] CORE-04 API Key 换行清理 — ✅ `normalizeSecretInput` + model-auth.ts 3处
- [x] CORE-05 compaction amnesia — ✅ **已合并**（SessionManager.appendMessage + chat.inject 去重 + stopReason 修正）
- [x] CORE-06 throwIfAborted — ❌ **跳过**（纯重构，CN 有自己的 abort 工具链）
- [x] CORE-07 sessions_history 保护 — ✅ 80KB 上限+字段净化+文本截断
- [x] CORE-08 Session 维护系统 — **延后（23文件/1566行）**
- [x] CORE-09 tsdown hooks — **跳过（CN 不使用 tsdown）**

TypeScript `tsc --noEmit`: **0 errors** ✅ (2026-02-11, CORE-05 included)

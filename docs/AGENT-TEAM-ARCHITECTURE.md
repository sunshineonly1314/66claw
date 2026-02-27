# Agent Team Architecture — 上游 Issue/PR 启示与 CN 改造记录

> 基于上游 Issue/PR (#2894, #14510, #7756, #14633, #6535, #7296, #14741, #14739, #14211, #12498, #13185) 的深度分析，
> 结合 CN 代码库审计，分为 **已实施**、**值得借鉴**、**暂缓观望** 三层。

---

## 一、已实施 — P0/P1 改造（2026-02-23）

### 1. Session 级子 agent 总量控制 (taskBudget)

**上游教训**: 单 session 中触发 50-100 个 subagent → token 爆炸 + API rate limit (#2894, #14510, PR #7756)

**改造内容**:
- 新增配置 `agents.defaults.subagents.taskBudget` (全局) / `agent.subagents.taskBudget` (per-agent)
- 默认值: 16
- 运行时: `sessions-spawn-tool.ts` 在 maxDepth 检查后，用 `listSubagentRunsForRequester()` 统计当前 requester 已 spawn 的子 agent 数量
- 超出预算返回 `status: "forbidden"` 并建议归档现有 session

**修改文件**:
- `src/config/types.agent-defaults.ts` — 添加 `taskBudget?: number`
- `src/config/types.agents.ts` — 添加 per-agent `taskBudget?: number`
- `src/config/zod-schema.agent-defaults.ts` — 添加 `taskBudget` 校验
- `src/config/zod-schema.agent-runtime.ts` — 添加 `taskBudget` 校验
- `src/agents/tools/sessions-spawn-tool.ts` — 运行时预算检查

### 2. Proactive Compaction 保护 Agent Identity

**上游教训**: 并行 Task 执行时 AGENTS.MD 上下文丢失 (#14633, #6535)

**改造内容**:
- 在 `customInstructions` 中增加:
  - `Agent identity, role definition, and system instructions (from SOUL.md/AGENTS.md)`
  - `Tool usage rules and constraints`
  - `Do NOT discard agent identity or system instructions even during aggressive compaction.`

**修改文件**:
- `src/auto-reply/reply/proactive-compaction.ts` — 扩展 customInstructions

### 3. Handoff 深度限制可配置化

**上游启示**: #7296 — 配置一致性原则

**改造内容**:
- `maxHandoffDepth` 从硬编码 `3` 改为三级配置: per-agent > global > default(3)
- 配置路径: `agent.subagents.maxHandoffDepth` / `agents.defaults.subagents.maxHandoffDepth`
- 与 spawn 的 `maxDepth` 配置模式完全一致

**修改文件**:
- `src/config/types.agent-defaults.ts` — 添加 `maxHandoffDepth?: number`
- `src/config/types.agents.ts` — 添加 per-agent `maxHandoffDepth?: number`
- `src/config/zod-schema.agent-defaults.ts` — 添加校验
- `src/config/zod-schema.agent-runtime.ts` — 添加校验
- `src/agents/tools/sessions-handoff-tool.ts` — 运行时可配置检查

---

## 二、已实施 — P2 改造（2026-02-23 续）

### 4. Quota Exhaustion 快速 Failover

**上游启示**: billing 错误（余额不足）是 account-wide 的，不会自愈，不应等 3 次失败才标记 down。

**改造内容**:
- `model-fallback.ts`: 当 `describeFailoverError` 返回 `reason === "billing"` 时，
  调用 `markProviderDown()` 立即标记 down，跳过 3 次渐进式失败计数
- 同时应用于 `runWithImageModelFallback` 路径
- 注意: `auth` 错误**不**快速标记 down，因为多 auth profile 场景下一个 key 失效不应禁用整个 provider。
  auth 错误由已有的 auth-profile cooldown 系统（per-key 冷却）处理。

**修改文件**:
- `src/agents/model-fallback.ts` — import `markProviderDown` + `resolveFailoverReasonFromError`，条件分支

### 5. Session Resume — 恢复子 agent

**上游 PR #7756**: Task 工具增加 `task_id` 参数恢复已有 session。

**改造内容**:
- `SessionsSpawnToolSchema` 增加可选 `resumeSessionKey` 参数
- 当提供时，跳过 depth/budget/agent-allowlist 检查
- 校验 session 存在且属于当前 requester（通过 `listSubagentRunsForRequester` + `childSessionKey` 匹配）
- 直接向已有 session 发送新 task，返回 `status: "resumed"`

**修改文件**:
- `src/agents/tools/sessions-spawn-tool.ts` — schema + resume 快速路径

---

## 三、待实施 — 需要更大重构

### 6. Stream Delta 插件钩子 (P1)

**上游 PR #14741**: 在流式输出的 text-delta / reasoning-delta / tool-input-delta 阶段注入插件钩子。

**CN 场景**:
- 内容安全过滤（CN 合规）
- 成本控制（检测过长输出时中断）
- WeCom 企业合规（实时审计）

**建议**: 在 `PluginRuntime.stream` 命名空间注入 delta 钩子，先实现 text-delta 子类型。

### 7. Model-Specific Agent Prompt (P2)

**上游 PR #14211**: agent prompt 支持 `string | Record<string, string>`，按模型通配符匹配。

**CN 场景**: Kimi/Qwen/DeepSeek/GLM 对中文 prompt 响应差异显著。

**评估**: 需要在 `AgentConfig` 类型、zod schema、workspace 加载、system-prompt builder 中全链路修改。
建议作为独立 PR。

### 8. Provider Sticky Session (已评估 — 不需要)

**上游 #14739**: 同一会话粘在一个 provider 上。

**评估**: CN 已有 `checkProviderHealth()` → skip "down" 的机制。加上 P2-4 的快速 failover，
billing/auth 失败后立即标记 down，后续请求自动跳过。额外的 sticky session 缓存收益不大。

---

## 三、暂缓观望

| 方向 | 上游状态 | CN 评估 |
|------|---------|---------|
| 全配置驱动 Agent 定义 (#12498, #13185) | 社区强烈要求中 | CN 已是配置驱动，监控 schema 设计即可 |
| Session Tree 可视化 (PR #7756 UI) | TUI 实现 | CN 是 Web UI，概念可借鉴但实现完全不同 |
| 消息分页 (PR #7756 pagination) | ULID 游标分页 | CN 用 proactive compaction，架构差异大 |

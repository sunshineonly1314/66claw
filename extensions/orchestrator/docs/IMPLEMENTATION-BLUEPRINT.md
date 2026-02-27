# Agent Team Orchestrator — 完整实现蓝图

> **版本**: 1.0
> **日期**: 2026-02-22
> **模块**: `extensions/orchestrator/`
> **前置文档**:
>   - `docs/AGENT-TEAM-GUIDED-ORCHESTRATION.md` — 交互方案设计
>   - `extensions/orchestrator/docs/UI-UX-DESIGN.md` — UI/UX 视觉设计 v2.0

---

## 一、实现总览

### 1.1 目标

把现有的 6-action 开发者工具 → **双轨用户产品**：
- **模板直达**: 匹配模板 → 一键部署 → 使用指南（3 秒完成）
- **引导式构建**: 对话 → 提议 → SOUL → 部署 → 使用指南（3-5 轮）

### 1.2 文件变更清单

```
extensions/orchestrator/
├── index.ts                           ← 修改: 注册新 gateway 方法
├── src/
│   ├── types.ts                       ← 修改: 扩展类型定义
│   ├── orchestrate-tool.ts            ← 修改: 新增 4 个 action handler
│   ├── system-prompt.ts               ← 重写: 引导式对话 prompt
│   ├── state.ts                       ← 修改: 新增 draft 状态
│   ├── templates.ts                   ← 小改: 模板输出格式
│   ├── model-gate.ts                  ← 不变
│   ├── tool-recommend.ts              ← 不变
│   │
│   ├── guided/                        ← 新增目录
│   │   ├── capability-inference.ts    ← 新增: 能力推断引擎
│   │   ├── soul-validator.ts          ← 新增: SOUL 结构校验
│   │   ├── cost-estimator.ts          ← 新增: 成本估算
│   │   └── usage-guide.ts            ← 新增: 使用指南生成
│   │
│   └── ui/                            ← 新增目录
│       ├── orchestrator-view.ts       ← 新增: 主视图（Lit html）
│       ├── orchestrator-state.ts      ← 新增: 前端状态机
│       ├── orchestrator-styles.ts     ← 新增: CSS 模块
│       ├── orchestrator-gateway.ts    ← 新增: 前端 ↔ gateway 通信
│       └── components/
│           ├── welcome.ts             ← 新增: 欢迎页
│           ├── template-card.ts       ← 新增: 模板卡片
│           ├── question-card.ts       ← 新增: 问题卡片
│           ├── proposal-card.ts       ← 新增: 方案卡片
│           ├── soul-preview.ts        ← 新增: SOUL 预览/编辑
│           ├── deploy-progress.ts     ← 新增: 部署进度
│           ├── success-view.ts        ← 新增: 完成页
│           └── message-thread.ts      ← 新增: 消息列表
│
├── __tests__/                         ← 已有测试目录
│   ├── ... (existing 5 test files)
│   ├── quick-deploy.test.ts           ← 新增
│   ├── guided-propose.test.ts         ← 新增
│   ├── capability-inference.test.ts   ← 新增
│   └── usage-guide.test.ts            ← 新增
```

**外部集成文件**（仅添加入口钩子，不修改核心逻辑）：

```
ui/src/ui/views/agents.ts              ← 修改: 添加 "智能组队" 入口按钮
ui/src/ui/app-view-state.ts            ← 修改: 添加 orchestrator 状态字段
ui/src/styles/agents.css               ← 修改: 添加入口按钮样式
ui/src/ui/i18n/locales/zh-CN.ts        ← 修改: 添加 orch.* i18n key
ui/src/ui/i18n/locales/en.ts           ← 修改: 添加 orch.* i18n key
```

---

## 二、后端实现

### 2.1 类型扩展 (`types.ts`)

```typescript
// ── 新增：用户上下文 ──
export type UserContext = {
  scenario: string;       // 场景标签: "customer_support" | "coding" | "content" | ...
  channels: string[];     // 渠道: ["wechat", "dingtalk", "feishu", "web"]
  resources: string[];    // 已有资源: ["faq_doc", "pdf", "database", "api"]
  volume: "low" | "medium" | "high";
  budget: "cheap" | "balanced" | "premium";
};

// ── 新增：推断能力 ──
export type InferredCapabilities = {
  model: {
    primary: string;           // "deepseek/deepseek-chat"
    fallbacks?: string[];
  };
  tools: {
    profile?: string;          // "coding" | "messaging" | "minimal" | "full"
    allow?: string[];
    alsoAllow?: string[];
    deny?: string[];
  };
  skills: string[];
  mcpHints: string[];
  memorySearch: {
    enabled: boolean;
    sources?: string[];
  };
  identity: {
    name: string;
    emoji?: string;
  };
  subagents?: {
    maxDepth?: number;
    allowAgents?: string[];
  };
  heartbeat?: {
    enabled: boolean;
    schedule?: string;         // cron 表达式
  };
};

// ── AgentBlueprint 扩展 ──
export type AgentBlueprint = {
  name: string;
  id: string;
  role: string;
  soul: string;
  emoji?: string;
  modelTier: ModelTier;
  modelId?: string;
  tools: AgentToolRecommendation;
  dependsOn?: string[];
  // 新增
  inferredCapabilities?: InferredCapabilities;
};

// ── OrchestrationPlan 扩展 ──
export type OrchestrationPlan = {
  planId: string;
  createdAt: string;
  requirement: string;
  templateId?: string;
  agents: AgentBlueprint[];
  teamDescription: string;
  estimatedTokensPerTurn?: number;
  // 新增
  mode: "template" | "guided" | "manual";
  userContext?: UserContext;
  usageGuide?: string;
};

// ── OrchestrationState 扩展 ──
export type OrchestrationState = {
  planId: string;
  status: "draft" | "confirming" | "deploying" | "deployed" | "failed" | "rolled_back";
  //       ^^^^^ 新增 draft 状态
  agents: AgentDeployState[];
  deployStartedAt?: string;
  deployFinishedAt?: string;
  error?: string;
};

// ── OrchestrateAction 扩展 ──
export type OrchestrateAction =
  | "plan"
  | "confirm"
  | "deploy"
  | "status"
  | "rollback"
  | "templates"
  // 新增
  | "quick_deploy"
  | "guided_propose"
  | "guided_refine"
  | "guided_deploy";
```

### 2.2 新增 Action: `quick_deploy`

**位置**: `orchestrate-tool.ts` 新增 `handleQuickDeploy()`

```typescript
async function handleQuickDeploy(
  params: Record<string, unknown>,
  ctx: OpenClawCNPluginToolContext,
  callGateway: CallGatewayFn,
): Promise<AgentToolResult<unknown>> {
  const requirement = String(params.requirement ?? "").trim();
  const templateId = typeof params.templateId === "string" ? params.templateId.trim() : undefined;

  // 1. 匹配模板
  let template = templateId ? getTemplate(templateId) : matchTemplate(requirement);
  if (!template) {
    return textResult(
      "没有找到匹配的模板。\n\n" +
      "可以尝试「引导式构建」——告诉我更多关于你的需求，我来帮你规划。"
    );
  }

  // 2. 深拷贝 blueprints
  const blueprints = deepCloneBlueprints(template.agents);

  // 3. 能力推断（基于模板默认 context）
  const defaultContext: UserContext = {
    scenario: template.category ?? "general",
    channels: [],
    resources: [],
    volume: "medium",
    budget: "balanced",
  };
  for (const bp of blueprints) {
    bp.inferredCapabilities = inferAgentCapabilities(bp, defaultContext, ctx);
  }

  // 4. 创建 plan + 直接部署（合并 plan→confirm→deploy）
  const planId = generatePlanId();
  const plan: OrchestrationPlan = {
    planId,
    createdAt: new Date().toISOString(),
    requirement,
    templateId: template.id,
    agents: blueprints,
    teamDescription: template.description,
    mode: "template",
    userContext: defaultContext,
  };

  await savePlan(plan);
  const state = createInitialState(plan);
  state.status = "deploying";
  state.deployStartedAt = new Date().toISOString();
  await saveState(state);

  // 5. 执行部署
  const deployResult = await executeDeploySequence(plan, state, ctx, callGateway);

  // 6. 生成使用指南
  const usageGuide = generateUsageGuide(plan, template);
  plan.usageGuide = usageGuide;
  await savePlan(plan);

  // 7. 返回面向用户的结果
  return textResult(formatQuickDeployResult(plan, deployResult, usageGuide));
}
```

**关键设计**:
- 合并 plan → confirm → deploy 为单步操作
- 自动推断能力配置
- 生成使用指南
- 输出面向用户的友好文案（无技术术语）

### 2.3 新增 Action: `guided_propose`

```typescript
async function handleGuidedPropose(
  params: Record<string, unknown>,
  ctx: OpenClawCNPluginToolContext,
): Promise<AgentToolResult<unknown>> {
  const requirement = String(params.requirement ?? "").trim();
  const userContextJson = typeof params.userContext === "string" ? params.userContext : "{}";

  // 1. 解析 userContext
  let userContext: UserContext;
  try {
    userContext = JSON.parse(userContextJson);
  } catch {
    userContext = { scenario: "general", channels: [], resources: [], volume: "medium", budget: "balanced" };
  }

  // 2. LLM 会把团队结构作为 agentBlueprints 传入
  //    这里只需要做能力推断 + 保存为 draft
  const blueprintsJson = typeof params.agentBlueprints === "string" ? params.agentBlueprints : undefined;
  let blueprints: AgentBlueprint[] = [];

  if (blueprintsJson) {
    const parsed = JSON.parse(blueprintsJson);
    blueprints = parsed.map(normalizeBlueprint);
  }

  // 3. 为每个 agent 推断能力
  for (const bp of blueprints) {
    bp.inferredCapabilities = inferAgentCapabilities(bp, userContext, ctx);
  }

  // 4. 保存为 draft
  const planId = generatePlanId();
  const plan: OrchestrationPlan = {
    planId,
    createdAt: new Date().toISOString(),
    requirement,
    agents: blueprints,
    teamDescription: requirement,
    mode: "guided",
    userContext,
  };

  await savePlan(plan);
  const state = createInitialState(plan);
  state.status = "draft";   // draft 允许反复修改
  await saveState(state);

  // 5. 返回方案摘要（面向用户，无技术细节）
  return textResult(formatProposalForUser(plan));
}
```

### 2.4 新增 Action: `guided_refine`

```typescript
async function handleGuidedRefine(
  params: Record<string, unknown>,
): Promise<AgentToolResult<unknown>> {
  const planId = String(params.planId ?? "").trim();
  const refinementsJson = typeof params.refinements === "string" ? params.refinements : "{}";
  const soulContentsJson = typeof params.soulContents === "string" ? params.soulContents : undefined;

  const plan = await loadPlan(planId);
  if (!plan) return textResult(`找不到方案 "${planId}"。`);

  const state = await loadState(planId);
  if (!state || state.status !== "draft") {
    return textResult(`方案 "${planId}" 当前状态为 "${state?.status}"，无法修改。`);
  }

  // 1. 处理结构调整
  const refinements = JSON.parse(refinementsJson);
  if (refinements.adjustments) {
    // 应用 LLM 传入的调整（增删改 agent）
    applyAdjustments(plan, refinements.adjustments);
  }

  // 2. 如果有 SOUL 内容，写入
  if (soulContentsJson) {
    const soulMap: Record<string, string> = JSON.parse(soulContentsJson);
    for (const [agentId, soulContent] of Object.entries(soulMap)) {
      const agent = plan.agents.find(a => a.id === agentId);
      if (agent) {
        // 校验 SOUL 结构
        const validation = validateSoulStructure(soulContent);
        if (!validation.valid) {
          return textResult(
            `"${agent.name}" 的 SOUL 缺少必要章节：${validation.missing.join("、")}。\n` +
            `请补充后重试。`
          );
        }
        agent.soul = soulContent;
      }
    }
  }

  await savePlan(plan);

  // 3. 如果所有 agent 都有 SOUL，提示可以部署
  const allHaveSoul = plan.agents.every(a => a.soul && a.soul.length > 50);
  const next = allHaveSoul
    ? `\n\n所有成员的工作指南已就绪。确认后调用 guided_deploy 部署。`
    : `\n\n还有 ${plan.agents.filter(a => !a.soul || a.soul.length <= 50).length} 个成员需要编写工作指南。`;

  return textResult(formatRefinementResult(plan) + next);
}
```

### 2.5 新增 Action: `guided_deploy`

```typescript
async function handleGuidedDeploy(
  params: Record<string, unknown>,
  ctx: OpenClawCNPluginToolContext,
  callGateway: CallGatewayFn,
): Promise<AgentToolResult<unknown>> {
  const planId = String(params.planId ?? "").trim();

  const plan = await loadPlan(planId);
  if (!plan) return textResult(`找不到方案 "${planId}"。`);

  let state = await loadState(planId);
  if (!state) return textResult(`找不到方案状态。`);

  // 允许从 draft 或 confirming 状态直接部署
  if (state.status !== "draft" && state.status !== "confirming") {
    return textResult(`方案当前状态为 "${state.status}"，无法部署。`);
  }

  // 合并 confirm + deploy
  state = { ...state, status: "deploying", deployStartedAt: new Date().toISOString() };
  await saveState(state);

  // 执行部署（复用 deploy 核心逻辑，但使用增强的配置）
  const deployResult = await executeDeploySequence(plan, state, ctx, callGateway);

  // 生成使用指南
  const usageGuide = generateUsageGuide(plan);
  plan.usageGuide = usageGuide;
  await savePlan(plan);

  return textResult(formatGuidedDeployResult(plan, deployResult, usageGuide));
}
```

### 2.6 增强部署核心: `executeDeploySequence()`

从现有 `handleDeploy` 中提取通用部署逻辑，增强配置 patch：

```typescript
async function executeDeploySequence(
  plan: OrchestrationPlan,
  initialState: OrchestrationState,
  ctx: OpenClawCNPluginToolContext,
  callGateway: CallGatewayFn,
): Promise<DeployResult> {
  let state = initialState;
  const results: AgentDeployResult[] = [];
  const deployed = new Set<string>();
  const agentQueue = [...plan.agents];
  let maxIterations = agentQueue.length * 2;

  while (agentQueue.length > 0 && maxIterations-- > 0) {
    // 依赖排序 + 批次部署（逻辑同现有 handleDeploy）
    const { nextBatch, deferred } = partitionByDependencies(agentQueue, deployed);

    if (nextBatch.length === 0 && deferred.length > 0) {
      state = { ...state, status: "failed", error: "dependency deadlock" };
      await saveState(state);
      break;
    }

    for (const bp of nextBatch) {
      try {
        // Step 1: agents.create
        state = updateAgentStatus(state, bp.id, "creating");
        await saveState(state);
        await callGateway("agents.create", {
          name: bp.name,
          id: bp.id,
          emoji: bp.emoji,
          workspace: resolveAgentWorkspace(ctx, bp.id),
        });

        // Step 2: SOUL.md
        state = updateAgentStatus(state, bp.id, "writing_soul");
        await saveState(state);
        await callGateway("agents.files.set", {
          agentId: bp.id,
          name: "SOUL.md",
          content: bp.soul,
        });

        // Step 3: 完整配置 patch（增强版）
        state = updateAgentStatus(state, bp.id, "configuring");
        await saveState(state);
        const configPatch = buildFullConfigPatch(bp);
        if (configPatch) {
          const snapshot = await callGateway("config.get", {}) as Record<string, unknown> | undefined;
          const baseHash = snapshot?.hash as string | undefined;
          await callGateway("config.patch", {
            raw: JSON.stringify(configPatch),
            ...(baseHash ? { baseHash } : {}),
          });
        }

        // Done
        state = updateAgentStatus(state, bp.id, "ready");
        await saveState(state);
        deployed.add(bp.id);
        results.push({ agentId: bp.id, name: bp.name, status: "ready" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        state = updateAgentStatus(state, bp.id, "failed", msg);
        await saveState(state);
        results.push({ agentId: bp.id, name: bp.name, status: "failed", error: msg });
      }
    }

    agentQueue.length = 0;
    agentQueue.push(...deferred);
  }

  return { planId: plan.planId, agents: results, finalStatus: state.status };
}
```

### 2.7 增强配置 Patch: `buildFullConfigPatch()`

替换现有的 `buildToolsConfigPatch()`，输出完整的 15+ 维度配置：

```typescript
function buildFullConfigPatch(bp: AgentBlueprint): Record<string, unknown> | undefined {
  const cap = bp.inferredCapabilities;
  if (!cap) {
    // 降级到旧逻辑
    return buildToolsConfigPatch(bp);
  }

  const agentEntry: Record<string, unknown> = { id: bp.id };

  // model
  if (cap.model?.primary) {
    agentEntry.model = cap.model.fallbacks?.length
      ? { primary: cap.model.primary, fallbacks: cap.model.fallbacks }
      : cap.model.primary;
  }

  // tools
  const tools: Record<string, unknown> = {};
  if (cap.tools.profile)   tools.profile = cap.tools.profile;
  if (cap.tools.allow?.length)     tools.allow = cap.tools.allow;
  if (cap.tools.alsoAllow?.length) tools.alsoAllow = cap.tools.alsoAllow;
  if (cap.tools.deny?.length)      tools.deny = cap.tools.deny;
  if (Object.keys(tools).length) agentEntry.tools = tools;

  // skills
  if (cap.skills?.length) {
    agentEntry.skills = cap.skills;
  }

  // memorySearch
  if (cap.memorySearch?.enabled) {
    agentEntry.memorySearch = cap.memorySearch;
  }

  // identity
  if (cap.identity) {
    agentEntry.identity = cap.identity;
  }

  // subagents
  if (cap.subagents) {
    agentEntry.subagents = cap.subagents;
  }

  // heartbeat
  if (cap.heartbeat?.enabled) {
    agentEntry.heartbeat = cap.heartbeat;
  }

  if (Object.keys(agentEntry).length <= 1) return undefined; // only 'id'

  return {
    agents: {
      list: [agentEntry],
    },
  };
}
```

### 2.8 能力推断引擎 (`guided/capability-inference.ts`)

```typescript
export function inferAgentCapabilities(
  bp: AgentBlueprint,
  ctx: UserContext,
  pluginCtx: OpenClawCNPluginToolContext,
): InferredCapabilities {
  return {
    model:        selectModel(bp, ctx, pluginCtx),
    tools:        inferTools(bp.role, ctx),
    skills:       inferSkills(bp.role, ctx),
    mcpHints:     recommendMCPServers(bp.role, ctx.resources),
    memorySearch: inferMemorySearch(bp.role, ctx),
    identity:     { name: bp.name, emoji: bp.emoji },
    subagents:    inferSubagents(bp.role),
    heartbeat:    inferHeartbeat(bp.role, ctx),
  };
}

// ── Model Selection ──
function selectModel(bp: AgentBlueprint, ctx: UserContext, pluginCtx: OpenClawCNPluginToolContext) {
  const configuredProviders = getConfiguredProviders(pluginCtx.config);
  const tier = bp.modelTier;
  const budget = ctx.budget;

  // 三层候选：tier 优先 → budget 修正 → 可用性过滤
  const candidates = MODEL_TIER_MAP[tier]
    .filter(m => isProviderAvailable(m.provider, configuredProviders));

  if (candidates.length === 0) {
    // 降级到任何可用模型
    return { primary: "deepseek/deepseek-chat" };
  }

  // 场景匹配（推理/长文本/视觉/简单）
  const scored = candidates.map(m => ({
    ...m,
    score: scoreModelForScenario(m, bp.role, ctx.scenario),
  })).sort((a, b) => b.score - a.score);

  return {
    primary: scored[0].fullId,
    fallbacks: scored.slice(1, 3).map(m => m.fullId),
  };
}

// ── Tools Inference ──
function inferTools(role: string, ctx: UserContext) {
  const SCENARIO_MAP: Record<string, { profile: string; also: string[] }> = {
    "customer_support": { profile: "messaging", also: ["web_search", "memory_search"] },
    "coding":           { profile: "coding", also: ["browser"] },
    "research":         { profile: "full", also: [] },
    "content":          { profile: "minimal", also: ["web_search", "web_fetch", "image_gen"] },
    "data_analysis":    { profile: "minimal", also: ["group:fs", "group:runtime"] },
    "scheduling":       { profile: "minimal", also: ["cron", "message"] },
  };

  const base = SCENARIO_MAP[ctx.scenario] ?? { profile: "minimal", also: [] };
  const also = [...base.also];

  // 渠道 → 工具
  if (ctx.channels.includes("wechat"))   also.push("wechat_send", "wechat_cs");
  if (ctx.channels.includes("dingtalk")) also.push("dingtalk_send");
  if (ctx.channels.includes("feishu"))   also.push("feishu_send");

  // 角色关键词 → 工具
  if (/分发|路由|调度/.test(role)) also.push("sessions_spawn", "sessions_send");
  if (/知识库|检索|查询/.test(role)) also.push("memory_search", "memory_get");
  if (/定时|提醒|定期/.test(role)) also.push("cron");

  return {
    profile: base.profile,
    alsoAllow: [...new Set(also)],
  };
}

// ── Skills Inference ──
function inferSkills(role: string, ctx: UserContext): string[] {
  const skills: string[] = [];

  const SCENARIO_SKILLS: Record<string, string[]> = {
    "customer_support": ["wechat-cs", "summarize", "self-troubleshoot"],
    "coding":           ["coding-agent", "github", "web-researcher"],
    "news":             ["ai-daily-news", "cctv-news", "news-aggregator"],
    "content":          ["xiaohongshu", "summarize", "web-researcher"],
    "finance":          ["nano-pdf"],
    "scheduling":       ["oracle"],
  };

  skills.push(...(SCENARIO_SKILLS[ctx.scenario] ?? []));

  // 资源 → 技能
  if (ctx.resources.includes("pdf"))      skills.push("nano-pdf");
  if (ctx.resources.includes("github"))   skills.push("github");

  return [...new Set(skills)];
}
```

### 2.9 使用指南生成 (`guided/usage-guide.ts`)

```typescript
export function generateUsageGuide(
  plan: OrchestrationPlan,
  template?: SceneTemplate,
): string {
  const lines: string[] = [];

  // 团队成员简介
  for (const bp of plan.agents) {
    const initial = bp.name.charAt(0);
    lines.push(`[${initial}] ${bp.name} — ${bp.role}`);
  }

  lines.push("");
  lines.push("开始使用：");

  // 基于场景生成具体示例
  const examples = generateUsageExamples(plan.userContext?.scenario, plan.agents);
  for (const ex of examples.slice(0, 3)) {
    lines.push(`  ${ex}`);
  }

  lines.push("");
  lines.push("管理和调整：");
  lines.push("  前往「智能体」页面查看和管理每个成员的配置");

  return lines.join("\n");
}
```

### 2.10 System Prompt 重写 (`system-prompt.ts`)

完整重写，引导 LLM 按新流程交互：

```typescript
export const ORCHESTRATOR_SYSTEM_PROMPT = `
## 智能组队

你可以帮用户创建和管理 AI 助手团队。使用 agents_orchestrate 工具。

### 工作流程

**判断路径**
- 用户需求明确且匹配模板（财务管理/日常助手/学习规划） → 直接调用 action="quick_deploy"
- 用户需求复杂或不明确 → 进入引导式构建

**引导式构建步骤**

1. 了解需求（不调用工具，直接对话）
   先问几个关键问题：
   - 场景：你想让助手帮你做什么？
   - 渠道：在哪些平台上使用？
   - 资源：有没有已有的文档/数据？
   - 成本偏好：省钱优先 / 平衡 / 效果优先？

2. 提议团队
   收集到信息后，调用 action="guided_propose"
   必须传入：requirement, userContext (JSON), agentBlueprints (JSON)
   向用户展示方案时只说名字和职责，不说模型/工具技术细节

3. 编写工作指南
   用户确认后，为每个成员编写 SOUL.md
   SOUL 必须包含：角色定义、核心职责、行为准则、能力边界、协作指令
   调用 action="guided_refine" 传入 soulContents

4. 部署
   调用 action="guided_deploy"
   部署后必须告诉用户：
   - 2-3 个具体使用示例
   - 去哪里管理和调整

### 输出规范
- 全程用中文
- 不暴露 modelTier/tokens/tools 等技术术语
- 用简洁的职责描述展示团队
- 每个团队建议 3-5 个成员
- 只推荐用户已配置的模型
`.trim();
```

### 2.11 新增 Gateway 方法 (`index.ts`)

在 `register()` 中新增：

```typescript
// ── 引导式编排 gateway 方法 ──

api.registerGatewayMethod("orchestrator.quick_deploy", async ({ params, respond }) => {
  // 前端直接调用模板部署
  const p = params as Record<string, unknown>;
  const templateId = String(p.templateId ?? "");
  const template = getTemplate(templateId);
  if (!template) {
    respond(false, undefined, { code: "NOT_FOUND", message: `Template "${templateId}" not found` });
    return;
  }
  // 创建简化的 context 并执行部署
  // ... 复用 quick_deploy 逻辑
  respond(true, { planId: "...", status: "deployed" }, undefined);
});

api.registerGatewayMethod("orchestrator.deploy.status", async ({ params, respond }) => {
  // 前端轮询部署进度
  const planId = String((params as Record<string, unknown>).planId ?? "");
  const state = await loadState(planId);
  const plan = await loadPlan(planId);
  if (!state || !plan) {
    respond(false, undefined, { code: "NOT_FOUND", message: "Plan not found" });
    return;
  }
  respond(true, {
    status: state.status,
    agents: state.agents,
    progress: calculateProgress(state),
    plan: { teamDescription: plan.teamDescription, agentCount: plan.agents.length },
  }, undefined);
});
```

### 2.12 Tool Schema 更新

```typescript
const ORCHESTRATE_ACTIONS = [
  "plan", "confirm", "deploy", "status", "rollback", "templates",
  "quick_deploy", "guided_propose", "guided_refine", "guided_deploy",
] as const;

const OrchestrateToolSchema = Type.Object({
  action: Type.Unsafe<(typeof ORCHESTRATE_ACTIONS)[number]>({
    type: "string",
    enum: [...ORCHESTRATE_ACTIONS],
  }),
  requirement: Type.Optional(Type.String()),
  templateId: Type.Optional(Type.String()),
  planId: Type.Optional(Type.String()),
  agentBlueprints: Type.Optional(Type.String()),
  teamDescription: Type.Optional(Type.String()),
  // 新增
  userContext: Type.Optional(Type.String()),      // JSON string
  refinements: Type.Optional(Type.String()),      // JSON string
  soulContents: Type.Optional(Type.String()),     // JSON string
});
```

---

## 三、前端实现

### 3.1 状态机 (`ui/orchestrator-state.ts`)

```typescript
export type OrchestratorPhase =
  | "closed"            // 编排器未打开
  | "welcome"           // 欢迎页（模板列表 + 示例）
  | "gathering"         // AI 正在问问题（对话中）
  | "proposing"         // AI 调了 guided_propose，等待结果
  | "proposed"          // 方案已展示，等用户操作
  | "refining"          // 正在优化/生成 SOUL
  | "soul-preview"      // SOUL 预览，等用户确认
  | "deploying"         // 部署中（进度条）
  | "success"           // 部署成功
  | "error";            // 出错

export type OrchestratorMessage = {
  id: string;
  role: "system" | "user" | "thinking";
  content: string;
  timestamp: number;
  // 富内容类型
  widget?: "questions" | "proposal" | "soul-preview" | "deploy-progress" | "success" | "error";
  widgetData?: unknown;
};

export type OrchestratorState = {
  phase: OrchestratorPhase;
  messages: OrchestratorMessage[];
  currentPlanId: string | null;
  inputValue: string;
  inputDisabled: boolean;
  templates: SceneTemplate[];
  deployProgress: {
    total: number;
    completed: number;
    agents: Array<{ id: string; name: string; status: string }>;
  } | null;
};

// 初始状态
export function createInitialOrchestratorState(): OrchestratorState {
  return {
    phase: "welcome",
    messages: [],
    currentPlanId: null,
    inputValue: "",
    inputDisabled: false,
    templates: [],
    deployProgress: null,
  };
}

// 状态转换函数
export function orchestratorReducer(
  state: OrchestratorState,
  action: OrchestratorAction,
): OrchestratorState {
  switch (action.type) {
    case "OPEN":
      return { ...createInitialOrchestratorState(), phase: "welcome" };
    case "CLOSE":
      return { ...state, phase: "closed" };
    case "SET_TEMPLATES":
      return { ...state, templates: action.templates };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };
    case "SET_PHASE":
      return { ...state, phase: action.phase };
    case "SET_INPUT":
      return { ...state, inputValue: action.value };
    case "SET_DEPLOY_PROGRESS":
      return { ...state, deployProgress: action.progress };
    case "TEMPLATE_DEPLOY_START":
      return { ...state, phase: "deploying", inputDisabled: true };
    case "DEPLOY_SUCCESS":
      return { ...state, phase: "success" };
    case "DEPLOY_ERROR":
      return { ...state, phase: "error" };
    default:
      return state;
  }
}
```

### 3.2 Gateway 通信 (`ui/orchestrator-gateway.ts`)

```typescript
import { callGateway } from "../../../../src/gateway/call.js";

export async function fetchTemplates(): Promise<SceneTemplate[]> {
  const result = await callGateway({
    method: "orchestrator.templates.list",
    params: {},
  }) as { templates: SceneTemplate[] };
  return result.templates;
}

export async function quickDeployTemplate(templateId: string): Promise<{ planId: string }> {
  return callGateway({
    method: "orchestrator.quick_deploy",
    params: { templateId },
  }) as Promise<{ planId: string }>;
}

export async function pollDeployStatus(planId: string): Promise<DeployStatusResult> {
  return callGateway({
    method: "orchestrator.deploy.status",
    params: { planId },
  }) as Promise<DeployStatusResult>;
}
```

### 3.3 主视图 (`ui/orchestrator-view.ts`)

```typescript
import { html, nothing } from "lit";
import type { OrchestratorState } from "./orchestrator-state.js";
import { renderWelcome } from "./components/welcome.js";
import { renderMessageThread } from "./components/message-thread.js";
import { renderDeployProgress } from "./components/deploy-progress.js";
import { renderSuccessView } from "./components/success-view.js";

export function renderOrchestrator(
  state: OrchestratorState,
  handlers: OrchestratorHandlers,
) {
  return html`
    <div class="orch-container">
      <!-- 顶栏 -->
      <div class="orch-header">
        <button class="orch-header-back" @click=${handlers.onClose}>
          ${t("orch.back")}
        </button>
        <span class="orch-header-title">${t("orch.headerTitle")}</span>
      </div>

      <!-- 主内容区 -->
      <div class="orch-thread">
        ${state.phase === "welcome"
          ? renderWelcome(state.templates, handlers)
          : nothing}

        ${state.messages.length > 0
          ? renderMessageThread(state.messages, handlers)
          : nothing}

        ${state.phase === "deploying"
          ? renderDeployProgress(state.deployProgress)
          : nothing}

        ${state.phase === "success"
          ? renderSuccessView(state, handlers)
          : nothing}
      </div>

      <!-- 输入栏（非 deploying/success 时显示） -->
      ${state.phase !== "deploying" && state.phase !== "success"
        ? html`
          <div class="orch-compose">
            <textarea
              class="orch-input"
              .value=${state.inputValue}
              ?disabled=${state.inputDisabled}
              placeholder=${t("orch.inputPlaceholder")}
              @input=${handlers.onInput}
              @keydown=${handlers.onKeydown}
            ></textarea>
            <button
              class="orch-send"
              ?disabled=${state.inputDisabled || !state.inputValue.trim()}
              @click=${handlers.onSend}
            >
              <!-- SVG arrow icon -->
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        ` : nothing}
    </div>
  `;
}
```

### 3.4 CSS 模块 (`ui/orchestrator-styles.ts`)

所有 CSS 来自 `UI-UX-DESIGN.md` v2.0，以 CSS string export：

```typescript
export const orchestratorStyles = `
  /* 引入 UI-UX-DESIGN.md 中定义的所有 CSS */
  /* .orch-entry, .orch-header, .orch-thread, .orch-msg--ai, */
  /* .orch-msg--user, .orch-compose, .orch-welcome, .orch-tpl-grid, */
  /* .orch-question, .orch-chip, .orch-proposal, .orch-agent-row, */
  /* .orch-avatar, .orch-tag, .orch-soul, .orch-deploy, .orch-success, */
  /* .orch-thinking, .orch-error, 响应式 */
`;
```

### 3.5 外部集成

#### `ui/src/ui/views/agents.ts` — 添加入口

在 `renderAgents()` 的 sidebar 区域，`renderAddAgentForm()` 之前插入：

```typescript
// 智能组队入口按钮
function renderOrchestratorEntry(onOpen: () => void) {
  return html`
    <button class="orch-entry" @click=${onOpen}>
      <div class="orch-entry-mark">
        <div class="orch-entry-mark-inner"></div>
      </div>
      <div>
        <div class="orch-entry-title">${t("orch.entryTitle")}</div>
        <div class="orch-entry-sub">${t("orch.entrySub")}</div>
      </div>
    </button>
  `;
}
```

#### `ui/src/ui/app-view-state.ts` — 添加状态

```typescript
// 在 AppViewState 中新增
orchestratorOpen: boolean;          // 编排器是否打开
orchestratorState: OrchestratorState | null;  // 编排器内部状态
```

#### i18n keys — 新增

`zh-CN.ts`:
```typescript
"orch.entryTitle": "智能组队",
"orch.entrySub": "AI 规划 · 一键部署",
"orch.headerTitle": "智能组队",
"orch.back": "返回",
"orch.welcomeTitle": "智 能 组 队",
"orch.welcomeSub": "描述你的场景，AI 为你规划最佳团队配置",
"orch.sectionTemplates": "从模板开始",
"orch.sectionCustom": "或者直接描述",
"orch.inputPlaceholder": "描述你的需求...",
"orch.send": "发送",
"orch.templateDeploy": "一键部署",
"orch.templateCount": "{{count}} 个智能体",
"orch.deploying": "部署中",
"orch.deployConfirm": "确认部署",
"orch.successTitle": "团队已上线",
"orch.successSub": "{{team}} — 包含以下成员",
"orch.startChat": "开始对话",
"orch.guideLabel": "试试这样说",
"orch.backToList": "返回智能体列表",
"orch.createMore": "继续创建",
"orch.confirm": "确认",
"orch.adjust": "调整",
"orch.redo": "重新规划",
"orch.costLabel": "预估日均成本",
"orch.soulExpand": "展开预览",
"orch.soulCollapse": "收起",
"orch.soulEdit": "编辑",
"orch.soulSave": "保存",
"orch.soulCancel": "取消",
"orch.thinking": "规划中...",
"orch.errorRetry": "重试",
"orch.errorBack": "返回",
```

`en.ts`:
```typescript
"orch.entryTitle": "Smart Team",
"orch.entrySub": "AI-powered planning & one-click deploy",
"orch.headerTitle": "Smart Team",
"orch.back": "Back",
"orch.welcomeTitle": "SMART TEAM",
"orch.welcomeSub": "Describe your scenario, AI plans the best team for you",
// ... (对应的英文翻译)
```

---

## 四、交互流程时序

### 4.1 模板直达

```
用户点击 "智能组队" 按钮
    │
    ▼
前端: phase=welcome, 加载模板列表
    │
用户点击模板卡片 "一键部署"
    │
    ▼
前端: phase=deploying
    │  调用 gateway: orchestrator.quick_deploy({ templateId })
    │
    ▼
后端: matchTemplate → deepClone → inferCapabilities → deploy
    │  agents.create × N
    │  agents.files.set("SOUL.md") × N
    │  config.patch(完整配置) × N
    │
    ▼
前端: 轮询 orchestrator.deploy.status
    │  更新进度条和步骤列表
    │
    ▼
后端: 全部 ready → status="deployed"
    │
    ▼
前端: phase=success, 展示团队成员 + 使用指南
```

### 4.2 引导式构建

```
用户在输入框输入需求 → 发送
    │
    ▼
前端: phase=gathering
    │  创建 orchestrator session, 注入 system prompt
    │  LLM 收到用户消息
    │
    ▼
LLM: 问几个问题（纯对话，不调工具）
    │
用户: 回答问题 / 选择选项
    │
    ▼
LLM: 调用 agents_orchestrate(action="guided_propose", ...)
    │
    ▼
后端: 生成团队结构 → 能力推断 → 保存 draft
    │
    ▼
前端: phase=proposed, 展示方案卡片
    │
用户: "确认" / "调整" / "重新规划"
    │
    ├─ "调整" → LLM 修改 → guided_propose 再来一轮
    │
    └─ "确认" →
        │
        ▼
    LLM: 为每个 agent 编写 SOUL.md
    LLM: 调用 guided_refine(soulContents=...)
        │
        ▼
    前端: phase=soul-preview, 展示 SOUL 预览
        │
    用户: "确认部署"
        │
        ▼
    LLM: 调用 guided_deploy
        │
        ▼
    后端: confirm + deploy → 进度推送
        │
        ▼
    前端: phase=deploying → success
```

---

## 五、实现顺序

### Phase 1: 后端核心（优先实现）

| 序号 | 文件 | 任务 |
|------|------|------|
| 1.1 | `src/types.ts` | 扩展类型定义 |
| 1.2 | `src/state.ts` | 添加 draft 状态支持 |
| 1.3 | `src/guided/usage-guide.ts` | 使用指南生成 |
| 1.4 | `src/guided/capability-inference.ts` | 能力推断引擎 |
| 1.5 | `src/guided/soul-validator.ts` | SOUL 结构校验 |
| 1.6 | `src/guided/cost-estimator.ts` | 成本估算 |
| 1.7 | `src/orchestrate-tool.ts` | 新增 4 个 action + executeDeploySequence + buildFullConfigPatch |
| 1.8 | `src/system-prompt.ts` | 完整重写 |
| 1.9 | `index.ts` | 注册新 gateway 方法 |
| 1.10 | `__tests__/*.test.ts` | 新增测试 |

### Phase 2: 前端视图

| 序号 | 文件 | 任务 |
|------|------|------|
| 2.1 | `src/ui/orchestrator-state.ts` | 状态机 |
| 2.2 | `src/ui/orchestrator-styles.ts` | CSS 模块 |
| 2.3 | `src/ui/orchestrator-gateway.ts` | Gateway 通信 |
| 2.4 | `src/ui/components/welcome.ts` | 欢迎页 |
| 2.5 | `src/ui/components/template-card.ts` | 模板卡片 |
| 2.6 | `src/ui/components/message-thread.ts` | 消息列表 |
| 2.7 | `src/ui/components/question-card.ts` | 问题卡片 |
| 2.8 | `src/ui/components/proposal-card.ts` | 方案卡片 |
| 2.9 | `src/ui/components/soul-preview.ts` | SOUL 预览 |
| 2.10 | `src/ui/components/deploy-progress.ts` | 部署进度 |
| 2.11 | `src/ui/components/success-view.ts` | 完成页 |
| 2.12 | `src/ui/orchestrator-view.ts` | 主视图组装 |

### Phase 3: 集成

| 序号 | 文件 | 任务 |
|------|------|------|
| 3.1 | `ui/src/ui/views/agents.ts` | 添加入口按钮 |
| 3.2 | `ui/src/ui/app-view-state.ts` | 添加状态字段 |
| 3.3 | `ui/src/styles/agents.css` | 入口样式 |
| 3.4 | `ui/src/ui/i18n/locales/zh-CN.ts` | i18n keys |
| 3.5 | `ui/src/ui/i18n/locales/en.ts` | i18n keys |

---

## 六、关键约束

1. **零侵入**: 所有编排逻辑在 `extensions/orchestrator/` 内，外部只加入口和状态字段
2. **只推荐已有模型**: 必须读取 `ctx.config` 的 providers，不推荐用户没配置的模型
3. **不暴露技术术语**: 面向用户的所有输出中不出现 modelTier/tokens/tools.allow 等
4. **渐进披露**: 基本信息一屏展示，技术细节（SOUL/配置）折叠展示
5. **视觉一致**: 复用项目已有的 indigo→violet 渐变体系、shimmer/glow 动画
6. **不用 emoji**: 全部用渐变头像 + CSS 状态点 + 纯文字
7. **向后兼容**: 保留全部 6 个旧 action，新增 4 个不破坏现有工作流

---

*本蓝图为完整的前后端实现计划。每个 Phase 内的文件按依赖顺序排列。*

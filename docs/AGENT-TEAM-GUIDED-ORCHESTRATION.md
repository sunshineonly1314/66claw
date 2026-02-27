# Agent Team Guided Orchestration — 交互式智能组队完整方案

> **版本**: 1.0
> **日期**: 2026-02-22
> **前置**: 基于 `extensions/orchestrator/` 现有代码重构
> **核心理念**: 用户定结构，AI 填细节；模板直达 + 交互式构建双轨

---

## 一、问题诊断

### 当前方案的核心缺陷

| 问题 | 原因 | 业界验证 |
|------|------|----------|
| LLM 一次生成完整 agent 团队，SOUL 质量不可控 | 缺少迭代和用户反馈 | ICLR 2025: 79% 多 agent 失败源自规格问题 |
| 6 步交互流程（templates→plan→confirm→deploy→status），步骤过多 | 把内部编排过程暴露给用户 | 无商业产品这样做 |
| 输出信息面向开发者（modelTier/tokens/tools） | 未区分用户角色 | Coze/CrewAI 全程零技术术语 |
| 部署后不知道怎么用 | 缺少使用引导 | AgentGPT 等产品必有 onboarding |
| 无法动态配置 model/tools/skills/MCP | 只写了 tools.allow 和 profile | 现有基础设施支持 15+ 维度配置 |

### 可用基础设施盘点

经过深入研究，现有系统已具备完整的能力矩阵：

| 维度 | 现有能力 | 配置路径 |
|------|---------|----------|
| **模型** | 20+ 提供商，三层 tier（cheap/mid/sota），fallback 链，modality router | `agents.list[].model` |
| **工具** | 30+ 独立工具，6 个 group，4 个 profile，per-provider override | `agents.list[].tools` |
| **技能** | 90+ bundled skills，远程注册表，per-agent 过滤 | `agents.list[].skills` |
| **MCP** | 12000+ 工具发现，5 个默认 server，on-demand 安装 | `mcp.servers[]` + 工具策略 |
| **记忆** | SQLite + FTS5 + sqlite-vec，SiliconFlow embedding | `agents.list[].memorySearch` |
| **身份** | IDENTITY.md + SOUL.md，emoji/avatar/theme | `agents.list[].identity` |
| **沙箱** | Docker 隔离，三种模式（off/non-main/all） | `agents.list[].sandbox` |
| **子代理** | 深度控制，模型覆盖，允许列表 | `agents.list[].subagents` |
| **心跳** | 定时自主任务 | `agents.list[].heartbeat` |
| **存储** | SQLite×3（memory/mcp-index/tool-index），StateStore（KV/PubSub/Queue/Lock） | 各自独立 |

---

## 二、方案总览

### 2.1 双轨模式

```
用户入口（Agents 页面 "智能组队" 按钮）
                │
                ▼
        ┌───────────────┐
        │  意图分析层    │
        │  (LLM 理解)    │
        └───┬───────┬───┘
            │       │
    ┌───────▼──┐ ┌──▼─────────┐
    │ 模板直达 │ │ 引导式构建  │
    │ (3秒部署)│ │ (对话创建)  │
    └──────────┘ └────────────┘
```

| 路径 | 触发条件 | 步骤数 | 用户感知 |
|------|---------|-------|---------|
| **模板直达** | 匹配到内置模板 | 1（确认即部署） | "帮你组建了XX团队，试试说…" |
| **引导式构建** | 无匹配模板 | 3-5 轮对话 | AI 问问题 → 提议团队 → 逐个优化 SOUL → 部署 |

### 2.2 核心交互原则

1. **先问后做** — AI 先理解用户场景、资源、能力，再规划
2. **零技术术语** — 用户看到的只有 emoji+名字+一句话职责
3. **用户定结构，AI 填细节** — 用户决定"几个agent各干什么"，AI 负责 SOUL/tools/model
4. **渐进式披露** — 基本信息一屏展示，技术细节按需展开
5. **部署即可用** — 部署完成后必须告诉用户"接下来怎么做"

---

## 三、交互流程详细设计

### 3.1 模板直达路径

```
用户："帮我管理个人财务"

系统（内部）：
  1. matchTemplate("帮我管理个人财务") → finance-tracker ✓
  2. 跳过 plan/confirm 步骤
  3. 直接调用 quickDeploy(templateId)

系统（用户看到）：
  "正在为你部署「个人财务管理」团队..."

  ✅ 团队已就位！

  📒 记账助手 — 记录你的每一笔收支
  📊 财务分析师 — 分析消费趋势，生成报表
  ⏰ 预算管家 — 监控预算，超支时提醒你

  💡 开始使用：
  • 记账 → 直接说 "午餐 28元" 或 "打车 15"
  • 看报表 → 说 "这周花了多少钱"
  • 设预算 → 说 "每月餐饮预算 2000"
```

**技术实现**：新增 `action: "quick_deploy"` — 一步完成 plan+confirm+deploy。

### 3.2 引导式构建路径

分为 4 个阶段，每个阶段是一次 tool call：

#### 阶段 1：需求理解（action: "guided_start"）

```
用户："帮我搞一套客服系统"

AI 输出（由 system prompt 引导生成）：
  "好的！我来帮你规划客服团队。先了解几个关键信息：

   1️⃣ 你的客服场景是什么？
      比如：电商售后、技术支持、在线咨询、社群运营？

   2️⃣ 你希望通过哪些渠道接入？
      比如：微信、钉钉、飞书、网页、或者先不接渠道？

   3️⃣ 你有没有已有的知识库或FAQ文档？
      比如：产品手册PDF、常见问题文档等？

   4️⃣ 大概需要处理多大的量？
      比如：每天几十条消息 vs 几百条？"
```

**技术要点**：
- 这一阶段**不调用工具**，纯靠 system prompt 引导 LLM 问对问题
- system prompt 中的 "Guided Questions" 模板教 LLM 该问什么
- 问题维度：场景、渠道、资源（已有文档/API）、规模、预算偏好

#### 阶段 2：团队提议（action: "guided_propose"）

用户回答了问题后，LLM 调用工具：

```typescript
agents_orchestrate({
  action: "guided_propose",
  requirement: "电商售后客服系统，微信渠道，有FAQ文档，日均200条",
  userContext: JSON.stringify({
    scenario: "ecommerce_support",
    channels: ["wechat"],
    resources: ["faq_doc"],
    volume: "medium",
    budget: "balanced"    // cheap/balanced/premium
  })
})
```

**工具输出（面向用户的）**：

```markdown
## 推荐团队方案

根据你的需求，我建议这样的团队：

### 📋 工单分发员 (dispatcher)
  自动分析客户问题类型，分配给对应的专业客服

### 🔧 技术客服 (tech-support)
  处理技术类问题（安装、配置、故障排除）

### 💬 售后客服 (after-sales)
  处理退换货、投诉、补偿等售后问题

### 📚 知识库助手 (kb-assistant)
  基于你的FAQ文档回答常见问题，减少人工量

---

需要调整吗？比如增减成员、修改职责、或者告诉我更多细节。
确认后我来为每个成员编写详细的工作指南。
```

**技术要点**：
- LLM 基于 `userContext` 生成团队结构
- 工具内部自动为每个 agent 调用 `recommendToolsForRole()` + `classifyTierByScenario()`
- 但**不暴露技术细节**给用户
- 存储为 `draft` 状态（新状态），允许用户反复修改

#### 阶段 3：SOUL 生成与优化（action: "guided_refine"）

用户确认团队结构后：

```typescript
agents_orchestrate({
  action: "guided_refine",
  planId: "orch-20260222-xxxxx",
  refinements: JSON.stringify({
    approved: true,
    // 或者: adjustments: [{ id: "tech-support", change: "分成前端和后端两个" }]
  })
})
```

**系统内部流程**：

```
对每个 agent，分步生成完整 SOUL：

  Step 1: 基础 SOUL 生成
    输入: agent name + role + userContext（场景/渠道/资源）
    输出: 结构化 SOUL（角色定义 / 行为准则 / 能力边界 / handoff 指令）
    方法: 专门的 SOUL_GENERATION_PROMPT 模板

  Step 2: 能力配置推断
    输入: role + scenario + resources + volume
    输出: {
      model: "deepseek/deepseek-chat",      // 基于 tier + 场景复杂度
      tools: { profile: "messaging", alsoAllow: ["web_search"] },
      skills: ["wechat-cs", "summarize"],    // 匹配渠道和场景
      mcpHints: ["@mcp/sqlite"],             // 有知识库需求 → 数据库工具
      memorySearch: { enabled: true },       // 需要记住客户历史
      subagents: { maxDepth: 1 },            // 允许派生子任务
    }
```

**面向用户的输出**：

```markdown
## 团队配置完成

为每位成员编写了详细的工作指南和能力配置：

📋 **工单分发员**
  模型：DeepSeek Chat（高性价比，日均200条无压力）
  能力：消息分析、智能路由、会话管理

🔧 **技术客服**
  模型：DeepSeek Reasoner（推理能力强，适合技术问题）
  能力：知识库检索、网页搜索、代码分析
  技能：自助排障、日志分析

💬 **售后客服**
  模型：GLM-4 Flash（快速响应，降低成本）
  能力：消息发送、记忆管理
  技能：话术模板

📚 **知识库助手**
  模型：Qwen Plus（长文本理解好）
  能力：文件读取、记忆检索
  数据源：你的FAQ文档

预计每日 token 成本约 ¥3-5（中等用量基准）

确认部署吗？
```

#### 阶段 4：一键部署（action: "guided_deploy"）

用户确认后，`guided_deploy` 内部合并 confirm+deploy：

```
1. agents.create × 4
2. agents.files.set("SOUL.md") × 4
3. config.patch（tools + skills + model + memorySearch）
4. 生成使用指南
```

**面向用户的输出**：

```markdown
✅ 客服团队已部署完成！

## 使用指南

### 基本用法
• 客户消息会自动由「工单分发员」分析并转给对应客服
• 常见问题由「知识库助手」直接回答
• 需要人工介入时，客服会提示你

### 渠道接入
你的团队已配置好微信渠道支持。
前往「渠道管理」页面完成微信公众号/企业微信的绑定。

### 知识库
把你的FAQ文档放到知识库助手的工作空间：
  ~/agents/kb-assistant/docs/
系统会自动索引和检索。

### 监控
• 查看团队状态 → Agents 页面
• 查看对话记录 → 各 agent 的会话历史
• 调整配置 → 点击对应 agent → 工具/技能 标签页
```

---

## 四、动态能力规划引擎

### 4.1 能力推断逻辑

核心函数 `inferAgentCapabilities(agent, context)`：

```typescript
interface UserContext {
  scenario: string;       // 场景标签
  channels: string[];     // 接入渠道
  resources: string[];    // 用户已有资源
  volume: "low" | "medium" | "high";
  budget: "cheap" | "balanced" | "premium";
}

interface InferredCapabilities {
  model: AgentModelConfig;          // primary + fallbacks
  tools: AgentToolsConfig;          // profile + allow/deny
  skills: string[];                 // 技能列表
  mcpHints: string[];               // 推荐的 MCP 服务
  memorySearch: MemorySearchConfig; // 记忆/RAG 配置
  subagents?: SubagentConfig;       // 子代理限制
  identity: IdentityConfig;         // 名称/emoji
  heartbeat?: HeartbeatConfig;      // 定时任务
}
```

### 4.2 模型选择策略

```typescript
function selectModelForAgent(
  role: string,
  scenario: string,
  budget: "cheap" | "balanced" | "premium",
  complexity: "simple" | "moderate" | "complex",
): AgentModelConfig {
  // 1. 基于角色复杂度确定 tier
  const tier = determineTier(role, complexity, budget);

  // 2. 基于场景选择最优模型
  //    - 需要推理 → deepseek-reasoner / claude-sonnet
  //    - 需要长文本 → kimi-for-coding(262K) / qwen-max(128K)
  //    - 简单路由 → glm-4-flash(免费) / qwen-turbo(便宜)
  //    - 需要视觉 → qwen-vl-max / gpt-4o

  // 3. 构建 fallback 链（同 tier 内其他模型）

  // 4. 匹配用户已配置的 provider
  //    → 只推荐用户有 API Key 的模型！
}
```

**关键约束：只推荐用户已有的模型**

```typescript
// 从 config 获取用户已配置的 providers
const configuredProviders = getConfiguredProviders(ctx.config);
// 只在已配置的 provider 中选模型
const availableModels = filterByConfiguredProviders(candidates, configuredProviders);
```

### 4.3 工具推断策略

```typescript
function inferTools(role: string, scenario: string, channels: string[]): AgentToolsConfig {
  // 基础 profile
  let profile = "minimal";

  // 场景 → 工具映射
  const toolMap = {
    "customer_support": { profile: "messaging", also: ["web_search", "memory_search"] },
    "coding":           { profile: "coding", also: ["browser"] },
    "research":         { profile: "full", also: [] },
    "content_creation": { profile: "minimal", also: ["web_search", "web_fetch", "image_gen"] },
    "data_analysis":    { profile: "minimal", also: ["group:fs", "group:runtime"] },
    "scheduling":       { profile: "minimal", also: ["cron", "message"] },
  };

  // 渠道 → 额外工具
  if (channels.includes("wechat"))   also.push("wechat_send", "wechat_cs");
  if (channels.includes("dingtalk")) also.push("dingtalk_send");
  if (channels.includes("feishu"))   also.push("feishu_send");

  // 角色特殊需求
  if (role.includes("分发") || role.includes("路由")) also.push("sessions_spawn", "sessions_send");
  if (role.includes("知识库") || role.includes("检索")) also.push("memory_search", "memory_get");
  if (role.includes("定时") || role.includes("提醒")) also.push("cron");

  return { profile, alsoAllow: [...new Set(also)] };
}
```

### 4.4 技能推断策略

```typescript
function inferSkills(role: string, scenario: string, resources: string[]): string[] {
  const skills: string[] = [];

  // 场景 → 技能映射（基于 90+ bundled skills 的实际 skillKey）
  const scenarioSkills = {
    "customer_support": ["wechat-cs", "summarize", "self-troubleshoot"],
    "coding":           ["coding-agent", "github", "web-researcher"],
    "news":             ["ai-daily-news", "cctv-news", "news-aggregator", "news-briefing"],
    "content":          ["xiaohongshu", "summarize", "web-researcher"],
    "finance":          ["nano-pdf"],  // 读取账单PDF
    "scheduling":       ["oracle"],    // 日程管理
  };

  // 资源 → 技能
  if (resources.includes("pdf"))       skills.push("nano-pdf");
  if (resources.includes("notion"))    skills.push("notion");
  if (resources.includes("obsidian"))  skills.push("obsidian");
  if (resources.includes("github"))    skills.push("github");
  if (resources.includes("trello"))    skills.push("trello");

  // 去重 + 校验技能存在性
  return [...new Set([...skills, ...(scenarioSkills[scenario] ?? [])])];
}
```

### 4.5 MCP 推荐策略

```typescript
function recommendMCPServers(role: string, resources: string[]): string[] {
  const servers: string[] = [];

  // 角色需求 → MCP 映射
  if (role.includes("数据库") || role.includes("数据分析"))  servers.push("mcp-server-sqlite");
  if (role.includes("文件") || role.includes("文档"))        servers.push("@mcp/server-filesystem");
  if (role.includes("搜索") || role.includes("研究"))        servers.push("mcp-server-fetch");
  if (resources.includes("google_sheets"))                   servers.push("@anthropic/mcp-google-sheets");

  // 已配置的 MCP 服务中过滤
  return servers.filter(s => isServerAvailableOrInstallable(s));
}
```

---

## 五、SOUL 生成引擎

### 5.1 SOUL 生成提示词

这是**整个方案的核心**。SOUL 的质量决定 agent 的行为质量。

```typescript
const SOUL_GENERATION_PROMPT = `
你是一个专业的 AI Agent 人格设计师。你的任务是为一个 AI 助手编写详细的 SOUL.md 文件。

## 输入信息
- Agent 名称: {{agentName}}
- Agent 角色: {{agentRole}}
- 用户场景: {{scenario}}
- 团队中的其他成员: {{teammates}}
- 用户已有资源: {{resources}}
- 用户的渠道: {{channels}}

## SOUL.md 必须包含的部分

### 1. 角色定义（2-3句话）
明确 "你是谁"、"你负责什么"。

### 2. 核心职责（3-5条）
具体的、可操作的职责条目。不说废话。

### 3. 行为准则（3-5条）
"该怎么做" — 具体的行为规则，不是空泛原则。
必须包含：
- 输入格式（用户会怎么给你信息）
- 输出格式（你应该怎么回复）
- 异常处理（遇到不确定的情况怎么办）

### 4. 能力边界（2-3条）
"不该做什么" — 明确说清楚超出能力范围的事。
必须指明：遇到这类问题应该转交给团队中的谁。

### 5. 协作指令（1-3条）
与团队其他成员的协作规则：
- 什么情况下需要调用其他成员
- 如何传递上下文
- 使用 sessions_send/sessions_spawn 的具体指引

### 6. 数据格式（如适用）
如果 agent 需要存取结构化数据，明确定义格式。

## 约束
- 全部用中文
- 总长度 300-600 字
- 不用"您"，用"你"
- 不说"我会尽力"这种模糊承诺
- 每条规则要具体可执行，不要废话
`.trim();
```

### 5.2 SOUL 生成方式

**不是在 tool 内部调用 LLM**，而是**让外层 LLM 生成**：

```
orchestrate tool 返回:
  "请为以下 agent 编写 SOUL.md，遵循以下模板：
   [SOUL_GENERATION_PROMPT 填入具体参数]"

→ 外层 LLM 用其完整推理能力生成 SOUL
→ 生成结果通过 guided_refine 传回 tool
→ tool 保存到 plan 中
```

这样利用了主 LLM 的完整上下文和推理能力，而不是在 tool 内部调一个受限的 API。

### 5.3 SOUL 质量保障

三层保障机制：

| 层 | 机制 | 说明 |
|---|---|---|
| **模板内置** | 模板路径的 SOUL 是人工精心编写的 | 质量最高，免校验 |
| **结构校验** | 检查 SOUL 是否包含必需的 5 个章节 | 缺少则要求 LLM 补充 |
| **用户确认** | 展示精简版给用户（角色+职责）| 用户说"调整XX"则重新生成 |

---

## 六、存储方案评估

### 6.1 SQLite 够用吗？

**结论：完全够用。** 理由：

| 数据类型 | 量级 | SQLite 能力 |
|---------|------|------------|
| 编排计划（Plan） | 数十个 | JSON 字段，轻松应对 |
| 部署状态（State） | 同上 | KV 存储 |
| SOUL 模板缓存 | 数百条 | TEXT 字段 |
| 用户反馈历史 | 数百条 | 单表 |
| 能力推断缓存 | 数百条 | JSON 字段 |

当前 orchestrator 用 JSON 文件存储的方案反而更简单 —— 不需要迁移到 SQLite，因为：
- 数据量极小（每个 plan 一个 JSON 文件）
- 无需复杂查询（按 planId 读写即可）
- 无并发写入（只有主 agent 操作 orchestrator）
- 现有实现已经可靠工作

**但如果未来需要**：
- 团队模板的语义搜索 → 用 SiliconFlow bge-m3 embedding + sqlite-vec（复用 tool-index 的模式）
- 跨 agent 共享知识 → 用 memory 系统的现有 FTS5+vec 混合搜索
- 分布式协调 → 切换到 Redis StateStore（已有实现）

### 6.2 SiliconFlow Embedding 评估

| 维度 | 现状 | 评估 |
|------|------|------|
| **模型** | BAAI/bge-m3, 1024 维 | 中文效果好，维度合理 |
| **成本** | 免费 | 零成本，可大量调用 |
| **延迟** | 一般 200-500ms | 可接受，有 LRU 缓存 |
| **用途** | 目前仅用于 tool-discovery | 可复用于 SOUL 模板语义匹配 |

**建议用法**：
- **模板匹配增强**：当关键词匹配失败时，用 embedding 做语义匹配
- **SOUL 相似度检测**：检测生成的 SOUL 是否与已有 agent 过于相似（避免职责重叠）
- **暂不用于核心流程**：当前关键词匹配 + LLM 理解已足够，embedding 作为增强可选项

---

## 七、UI 方案

### 7.1 入口

在现有 Agents 页面（`ui/src/ui/views/agents.ts`）的 sidebar 底部，现有 "+ Add Agent" 按钮之上，新增：

```
┌─────────────────────────┐
│  🤖 智能组队              │  ← 新按钮（primary 样式）
│  AI 帮你规划和部署团队    │
├─────────────────────────┤
│  + 添加 Agent            │  ← 现有按钮（secondary 样式）
│  手动创建单个 Agent       │
└─────────────────────────┘
```

### 7.2 点击后的交互界面

**方案：复用现有对话界面（Chat View）**

点击"智能组队"后：
1. 创建一个特殊的 session（`sessionKey: "orchestrator"`, `agentId: "main"`）
2. 注入 orchestrator 引导 prompt
3. 用户在对话中与 AI 交互，AI 调用 `agents_orchestrate` 工具
4. 工具的输出（团队方案、部署结果）以 Markdown 卡片展示在对话中

**为什么不做独立页面**：
- 复用现有 Chat UI 的全部能力（Markdown 渲染、流式输出、附件）
- 对话式交互天然适合引导式构建
- 开发成本最低
- 用户已熟悉对话界面

### 7.3 部署后的展示

部署成功后，Agents 页面的 sidebar 自动刷新，展示新部署的 agent 团队。每个 agent 可以像现有 agent 一样点击查看/编辑 6 个 tab（Overview / Files / Tools / Skills / Channels / Cron）。

---

## 八、新增 Actions 设计

### 8.1 保留的 Actions

| Action | 变化 | 说明 |
|--------|------|------|
| `templates` | 不变 | 列出模板 |
| `plan` | 保留，作为高级 API | 开发者仍可直接传 agentBlueprints |
| `deploy` | 增强 | 增加完整能力配置（model/skills/MCP） |
| `status` | 不变 | 查看状态 |
| `rollback` | 不变 | 回滚 |

### 8.2 新增 Actions

```typescript
// 模板一键部署（小白路径）
action: "quick_deploy"
params: {
  requirement: string;       // 用户需求
  templateId?: string;       // 可选，指定模板
}
// 内部: matchTemplate → deepClone → deploy → 返回使用指南

// 引导式提议（AI 问完问题后调用）
action: "guided_propose"
params: {
  requirement: string;       // 用户需求
  userContext: string;       // JSON: 场景/渠道/资源/规模/预算
}
// 内部: 根据 context 推断团队结构 + 能力配置 → 保存为 draft

// 引导式优化（用户确认/调整团队后调用）
action: "guided_refine"
params: {
  planId: string;
  refinements: string;       // JSON: { approved: true } 或 { adjustments: [...] }
  soulContents?: string;     // JSON: { agentId: "完整SOUL内容", ... }
}
// 内部: 更新 plan，如果有 SOUL 则存入

// 引导式部署（确认后一键部署）
action: "guided_deploy"
params: {
  planId: string;
}
// 内部: 合并 confirm+deploy，部署完返回使用指南
```

### 8.3 增强的 Deploy 流程

现在 deploy 只写了 `tools.allow` 和 `profile`。增强后：

```typescript
// 每个 agent 的完整配置 patch
const fullConfigPatch = {
  agents: {
    list: [{
      id: bp.id,
      name: bp.name,
      model: bp.inferredCapabilities.model,        // ← 新增
      skills: bp.inferredCapabilities.skills,      // ← 新增
      tools: bp.inferredCapabilities.tools,        // ← 增强
      memorySearch: bp.inferredCapabilities.memorySearch, // ← 新增
      identity: bp.inferredCapabilities.identity,  // ← 新增
      subagents: bp.inferredCapabilities.subagents, // ← 新增
      heartbeat: bp.inferredCapabilities.heartbeat, // ← 新增
    }]
  }
};

await callGateway("config.patch", {
  raw: JSON.stringify(fullConfigPatch),
  baseHash,
  noRestart: false,  // 需要重启加载新配置
});
```

---

## 九、System Prompt 重写

### 9.1 新的 Orchestrator System Prompt

```typescript
export const ORCHESTRATOR_SYSTEM_PROMPT = `
## 智能组队助手

你可以帮用户创建和管理 AI 助手团队。

### 工作流程

当用户想创建团队时，按以下步骤进行：

**第一步：了解需求**
在调用任何工具之前，先问用户几个关键问题：
- 你想让这些助手帮你做什么？（场景）
- 你准备在哪些平台上用？（渠道：微信/钉钉/飞书/网页/不确定）
- 你有没有已有的资料？（FAQ文档/知识库/数据库/API）
- 对成本有什么偏好？（省钱优先/平衡/效果优先）

如果用户说的很明确（比如"帮我管理财务"），可以直接匹配模板，不用追问。

**第二步：提议团队**
收集到足够信息后，调用 agents_orchestrate action="guided_propose"。
把用户的回答整理成结构化的 userContext 传入。
向用户展示推荐方案，用简洁的语言描述每个成员的职责。
不要展示技术细节（model tier/tools/tokens），除非用户主动问。

**第三步：编写工作指南**
用户确认团队结构后，为每个成员编写 SOUL.md。
SOUL.md 必须包含：角色定义、核心职责、行为准则、能力边界、协作指令。
调用 agents_orchestrate action="guided_refine" 传入 SOUL 内容。

**第四步：部署**
调用 agents_orchestrate action="guided_deploy"。
部署完成后，必须告诉用户：
1. 怎么开始使用（给出 2-3 个具体的使用示例）
2. 在哪里管理和调整（Agents 页面）
3. 如何接入渠道（如果用户提了渠道需求）

### 快速路径
如果用户的需求直接匹配模板（财务管理/日常助手/学习规划），
直接调用 action="quick_deploy"，跳过所有中间步骤。

### 注意事项
- 全程用中文
- 不要暴露 modelTier、tokens、tools.allow 等技术术语
- 用 emoji 和简洁的职责描述展示团队
- 每个团队最多 5 个成员（除非用户明确需要更多）
- 优先推荐用户已配置的模型提供商
`.trim();
```

---

## 十、类型扩展

### 10.1 AgentBlueprint 扩展

```typescript
interface AgentBlueprint {
  // 现有字段
  name: string;
  id: string;
  role: string;
  soul: string;
  emoji?: string;
  modelTier: "cheap" | "mid" | "sota";
  tools: ToolRecommendation;
  dependsOn?: string[];

  // 新增：完整推断能力
  inferredCapabilities?: {
    model: {
      primary: string;              // "deepseek/deepseek-chat"
      fallbacks?: string[];
    };
    tools: {
      profile: string;
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
      schedule?: string;
    };
  };
}
```

### 10.2 OrchestrationPlan 扩展

```typescript
interface OrchestrationPlan {
  // 现有字段 ...

  // 新增
  userContext?: {
    scenario: string;
    channels: string[];
    resources: string[];
    volume: string;
    budget: string;
  };
  mode: "template" | "guided" | "manual";  // 创建模式
  usageGuide?: string;                     // 部署后的使用指南
}
```

### 10.3 OrchestrationState 扩展

```typescript
type OrchestrationStatus =
  | "draft"        // ← 新增：引导式构建中，可反复修改
  | "confirming"
  | "deploying"
  | "deployed"
  | "failed"
  | "rolled_back";
```

---

## 十一、实现优先级

### Phase 1：快速可用（3-5天）

| 任务 | 说明 |
|------|------|
| `quick_deploy` action | 模板一键部署，零交互 |
| 使用指南生成 | 部署后输出具体使用示例 |
| System Prompt 重写 | 引导 LLM 按新流程交互 |
| 面向用户的输出重写 | 去掉所有技术术语 |

### Phase 2：引导式构建（5-7天）

| 任务 | 说明 |
|------|------|
| `guided_propose` action | 基于 userContext 推断团队结构 |
| `guided_refine` action | SOUL 生成 + 存储 |
| `guided_deploy` action | 合并确认+部署 |
| 能力推断引擎 | model/tools/skills/MCP 动态推断 |
| `draft` 状态 | 支持反复修改 |

### Phase 3：UI + 增强（3-5天）

| 任务 | 说明 |
|------|------|
| "智能组队" 按钮 | Agents 页面入口 |
| 对话式 UI 集成 | 特殊 session 跳转 |
| 部署后 sidebar 刷新 | 自动展示新 agent |
| 更多模板 | 客服/内容创作/数据分析/项目管理 |

### Phase 4：智能增强（后续）

| 任务 | 说明 |
|------|------|
| Embedding 语义匹配 | SiliconFlow bge-m3 增强模板匹配 |
| SOUL 相似度检测 | 检测职责重叠 |
| 团队效果反馈 | 用户使用数据 → 优化推荐 |
| 自定义模板保存 | 用户创建的团队可保存为模板 |

---

## 十二、与现有系统的集成点

| 系统 | 集成方式 |
|------|---------|
| **Agent 页面** | 新增"智能组队"按钮 → 打开对话 session |
| **Chat 页面** | 复用对话 UI，orchestrator 特殊 session |
| **Gateway API** | 复用 agents.create / agents.files.set / config.patch |
| **Config Schema** | 复用 AgentEntrySchema 的所有 15+ 字段 |
| **Skills 系统** | 推断 skills 列表 → 写入 agents.list[].skills |
| **MCP 系统** | 推断 MCP 需求 → on-demand loader 安装 |
| **Memory 系统** | 按需启用 memorySearch → 写入 agents.list[].memorySearch |
| **Dispatch** | 推断 model → 写入 agents.list[].model，使用已有 fallback 链 |
| **Tool Policy** | 推断 tools → 写入 agents.list[].tools，使用已有 profile 系统 |
| **Tier Selector** | 复用 classifyTier() 进行成本估算 |
| **Modality Router** | 推断需要的 modality → 选择合适模型 |
| **Plugin System** | 保持现有 registerTool/on hook/registerGatewayMethod 机制 |

---

## 附录：完整交互示例

### A. 小白用户 + 模板命中

```
用户: 帮我管理学习

AI: 好的！我帮你组建了一个学习助手团队：

   🎯 学习规划师 — 制定学习计划、安排复习、跟踪进度
   👨‍🏫 学习导师 — 讲解知识点、回答疑问、推荐学习资料
   📋 笔记整理员 — 整理学习笔记、制作知识卡片

   ✅ 已部署完成！

   💡 这样开始使用：
   • "我想学Python，帮我规划" → 规划师制定计划
   • "什么是递归？" → 导师讲解
   • "整理一下今天学的内容" → 整理员归档笔记
```

### B. 进阶用户 + 引导式构建

```
用户: 帮我搞一套自动化运营系统

AI: 好的！自动化运营涵盖的面比较广，我先了解下你的需求：

  1. 你主要想自动化哪些运营工作？
     比如：内容发布、数据分析、客户跟进、社群管理？
  2. 你现在用哪些平台？
     比如：微信公众号、小红书、抖音、微博？
  3. 你有没有已有的数据源或工具？
     比如：Excel 报表、数据库、CRM 系统？
  4. 希望怎么控制成本？

用户: 主要是小红书内容发布和数据分析，有 Excel 的运营数据，成本低一点

AI: 明白了！推荐这样的团队：

  📝 内容策划 — 基于数据分析生成选题和内容大纲
  ✍️ 文案写手 — 生成小红书风格的图文内容
  📊 数据分析师 — 分析 Excel 运营数据，生成趋势报告
  ⏰ 定时助手 — 按计划自动执行内容发布流程

  需要调整吗？

用户: 好的就这样

AI: 正在为每位成员编写工作指南...（生成 SOUL）

  配置完成：
  📝 内容策划 — Qwen Plus（擅长中文创作）
  ✍️ 文案写手 — GLM-4 Flash（性价比高，日常写作够用）
  📊 数据分析师 — DeepSeek Chat（数据理解能力强）
  ⏰ 定时助手 — Qwen Turbo（简单任务，成本最低）

  预计日成本：¥1-2

  确认部署吗？

用户: 部署

AI: ✅ 团队已就位！

  💡 开始使用：
  • "分析这个月的数据" → 发送 Excel 给数据分析师
  • "帮我写一篇关于XX的小红书" → 文案写手创作
  • "每周一自动生成周报" → 定时助手设定任务
```

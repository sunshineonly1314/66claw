# TODO-10: Skills + MCP 统一工具路由与智能推荐

> 创建日期: 2026-02-09
> 优先级: 高
> 关联: TODO-smart-router-design.md (模型路由), TODO-05-扩展插件改进.md

---

## 一、问题背景

### 1.1 当前架构现状

ClawdBot 有两套完全正交的工具系统：

| 维度 | Skills | MCP |
|------|--------|-----|
| 本质 | Prompt 注入 + 可选外部 CLI 依赖 | 独立子进程 + JSON-RPC 结构化调用 |
| 注册来源 | `skills/` 目录 + gitee/clawdskillsproxy 远程仓库 | `clawdbot.yaml` → `mcp.servers[]` |
| 加载方式 | `workspace.ts` 解析 SKILL.md frontmatter | `registry.ts` 加载配置 → spawn 子进程 |
| 工具桥接 | `formatSkillsForPrompt()` 注入 system prompt | `tool-bridge.ts` 转为 `mcp_{serverId}_{toolName}` |
| 执行方式 | LLM 读 SKILL.md 指令后自行调用 bash/tools | 直接 JSON-RPC `callTool()` 结构化调用 |
| 去重逻辑 | 无 | `clawdbot-tools.ts:169-177` 按 tool name 去重 |
| 规模 | 3000+ | 通常 20 个以内 |

### 1.2 核心问题

**当前没有统一的"任务→工具"路由层。**

- `pi-tools.ts:288-337` 是硬编码顺序拼接，把所有工具塞给 LLM
- Skills 通过 `buildWorkspaceSkillSnapshot()` 把所有 eligible SKILL.md 文本拼接成大 prompt
- "路由"完全由 LLM 自己在 context 中做选择
- 随着 eligible Skill 增多，context window 会被撑爆

---

## 二、Skill 和 MCP 的本质区别（彻底搞清楚）

### 2.1 Skill 的两种类型

**类型 A：纯 Prompt Skill（零依赖）**

如 `skills/canvas/SKILL.md` —— 无 metadata，无 `requires`。本质是教 LLM 如何使用已有内置 tool 的"教程文档"。

```
用户说 "在 iPad 上显示网页"
  → SKILL.md 全文注入 LLM prompt
  → LLM 读完"教程"后自行调用 canvas tool
```

**类型 B：Prompt + 外部 CLI 依赖**

如 `skills/github/SKILL.md`：`requires: { bins: ["gh"] }`

```
用户说 "查看 PR #55 CI 状态"
  → 检查 gh 命令是否存在
  → 存在 → SKILL.md 注入 prompt
  → LLM 生成: gh pr checks 55 --repo owner/repo
  → 通过 exec tool 执行 shell 命令
  → 返回 stdout 结果
```

**Skill 的依赖不是 Skill 本身在运行，是 Skill 教 LLM 去调用外部 CLI 工具。Skill 本身永远只是文本。**

### 2.2 MCP 的本质

```
MCP Server（独立子进程，持续运行）
  → stdio JSON-RPC 暴露 tools
  → 每个 tool 有严格 JSON Schema
  → Agent 直接 callTool(name, args) 结构化调用
  → 返回结构化结果
```

### 2.3 对比图

```
┌─────────────────────────────────────────────────────────┐
│                        LLM Agent                        │
├──────────────────────┬──────────────────────────────────┤
│   Skill 路径          │   MCP 路径                       │
│                      │                                  │
│   SKILL.md ──注入──→ │   JSON Schema ──注入──→          │
│   LLM Prompt         │   LLM Tools Array               │
│        │             │        │                         │
│        ▼             │        ▼                         │
│   LLM 生成 bash 命令  │   LLM 选择 mcp_xxx_yyy tool     │
│        │             │        │                         │
│        ▼             │        ▼                         │
│   exec tool 执行     │   tool-bridge → JSON-RPC call    │
│   gh pr checks 55   │   client.callTool("read", {})    │
│        │             │        │                         │
│        ▼             │        ▼                         │
│   stdout 文本结果     │   结构化 JSON 结果                │
└──────────────────────┴──────────────────────────────────┘

  轻量，无进程开销              重，独立进程 + 健康检查
  灵活，自然语言描述             可靠，严格 Schema 校验
  脆弱，LLM 可能生成错误命令     稳定，参数类型有保证
  3000+ 容易扩展               20 个上限 (MCP_MAX_SERVERS)
```

---

## 三、行业方案调研

### 3.1 Cursor IDE

- **架构**: 专用 Composer 模型（MoE）+ ReAct 循环
- **工具选择**: 无独立 intent classifier，模型自己在 ~15 个固定 tools 中选择
- **关键**: 模型在大量 tool-use trajectories 上微调，专门训练了工具选择能力
- **模型路由**: Auto 模式按任务复杂度选不同模型级别
- **MCP**: 通过配置文件接入

### 3.2 Claude Code

- **架构**: 纯 Prompt 工程 + Tool Search
- **工具选择**: 18+ 内置工具全部给 LLM，系统 prompt 包含详细使用指南
- **Skill Meta-Tool（渐进式加载）**:
  - 所有 Skills → 只加载 name + description（轻量摘要）
  - 需要时才调用 Skill tool → 注入完整 SKILL.md
  - 避免一开始撑满 context window
- **Tool Search Tool（2025.11 推出，关键创新）**:
  - 大量 MCP tools → `defer_loading: true`（不预加载）
  - Agent 需要能力时 → 用 BM25/regex 搜索工具名和描述
  - 返回 Top-3~5 匹配的工具定义
  - **效果**: 50 工具从 77K tokens 降到 8.7K（85% 节省），支持 10,000 工具目录
  - **准确率**: Opus 4.5 从 79.5% → 88.1%，自动在 MCP 工具描述超 context 10% 时启用

### 3.3 核心结论

**行业共识: 不做独立意图分类器，让 LLM 自己选。但必须解决规模化问题——工具太多时用 Tool Search 按需加载。**

---

## 四、推荐架构方案

### 4.1 分层架构

```
┌──────────────────────────────────────────────────────────────┐
│  第 0 层：Always-On 核心能力（永远加载）                        │
│  ~10 个 always:true 的 Skill + 内置 tools + 已启用 MCP        │
│  直接放入 tools array / system prompt                         │
│  占 context：约 5-8K tokens                                   │
├──────────────────────────────────────────────────────────────┤
│  第 1 层：Tool Search（按需发现）                               │
│  3000+ Skills + 所有 MCP tools → 构建搜索索引                  │
│  Agent 需要能力时 → 调用 search_tools(query)                   │
│  返回 Top-5 匹配，注入 context                                 │
│  占 context：每次搜索约 1-2K tokens                            │
├──────────────────────────────────────────────────────────────┤
│  第 2 层：用户手动浏览（兜底）                                   │
│  统一的"能力商店"UI                                            │
│  按分类/标签/搜索 浏览 Skills + MCP                             │
│  高级用户自定义配置                                             │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 统一数据模型

```typescript
type UnifiedCapability = {
  // 统一身份
  id: string;                    // "skill:github" 或 "mcp:filesystem:readFile"
  source: "skill" | "mcp";

  // 展示信息
  name: string;
  nameZh?: string;
  emoji?: string;
  description: string;
  descriptionZh?: string;
  category: string;              // 来自 layer3 或手动标注
  tags: string[];

  // 状态
  status: "ready" | "needs_setup" | "installing" | "unavailable";
  qualityTier?: "S" | "A" | "B" | "C" | "D";

  // 交互
  trySaying?: string[];          // "试试说..." 示例
  configAction?: () => void;

  // 排序信号
  usageCount: number;
  globalPopularity: number;
  lastUsed?: Date;
};
```

### 4.3 搜索策略

**Skills + MCP 都搜到时的选择逻辑：**

| 场景 | 策略 |
|------|------|
| 只有 Skills 匹配 | 注入匹配 Skill 的 SKILL.md 到 prompt |
| 只有 MCP 匹配 | 暴露对应 MCP tool |
| Skills + MCP 都匹配 | 合并排序，精确匹配偏向 MCP（结构化更可靠），模糊匹配偏向 Skill |
| 多个 Skills + 多个 MCP | Top-K 截断（K=3~5），按 composite score 排序 |
| 都没匹配 | 降级到通用 Agent 能力（bash + browser + 通用推理） |

**Composite Score 公式：**

```typescript
function compositeScore(c: ToolCandidate): number {
  const weights = {
    relevance: 0.40,    // 最重要：和任务匹配度（BM25 score）
    quality: 0.20,      // 工具质量（S=1, A=0.8, B=0.6, C=0.4, D=0.2）
    reliability: 0.20,  // 可用性（MCP: health check; Skill: requires 检查）
    userPref: 0.15,     // 个性化（用户历史使用频率）
    recency: 0.05,      // 时间衰减（最近使用时间）
  };
  return weights.relevance * c.relevanceScore
       + weights.quality * tierToScore(c.qualityTier)
       + weights.reliability * c.reliabilityScore
       + weights.userPref * c.userPreference
       + weights.recency * c.recency;
}
```

### 4.4 小白友好设计原则

**关键: 小白不需要知道 Skills/MCP 的区别，也不需要自己选。**

三层推荐：
1. **Zero-Config 默认推荐**：预装 10~15 个"必备能力"（always:true + S/A tier）
2. **Task-Aware 任务驱动推荐**：用户描述任务 → 系统自动检索推荐 → 一键安装
3. **Expert 手动配置**：完整浏览/过滤/自定义（藏在折叠面板）

**准确性保证方案：**
- Embedding 召回 + LLM 精排的双保险
- 已有 layer1/2/3 质量体系做排序加权（这是 Cursor/Claude Code 没有的优势）
- Fallback: 推荐不准时用户永远能搜索/浏览全量工具
- 反馈闭环: 追踪"推荐了但没用" vs "推荐了且用了"

---

## 五、实施路线图

### Phase 1（短期 2~3 周）

- [ ] 定义 `UnifiedCapability` 数据模型
- [ ] 在 `clawdbot-tools.ts` 中合并 skill entries + MCP tools 为统一索引
- [ ] 利用现有 layer3 tags 构建 BM25 倒排索引
- [ ] 实现 `search_tools` Agent tool（注册为内置工具）
- [ ] Skills 改为 defer loading（只加载 name + description，需要时才注入全文）
- [ ] UI: 把 extensions-page + skills 列表合并为统一"能力"页面

### Phase 2（中期 1~2 月）

- [ ] 本地 embedding 索引（sqlite-vec / hnswlib，嵌入 3000+ descriptions）
- [ ] Task-Aware 推荐：在 agent-runner-execution 中增加工具推荐步骤
- [ ] 使用频率追踪：记录 usageCount / lastUsed，用于个性化排序
- [ ] MCP 健康检查历史，作为 reliability score 信号

### Phase 3（长期）

- [ ] LLM 精排：embedding 召回 + LLM 二次排序
- [ ] 自动安装流：推荐 → 一键安装 → 立即可用（已有 skills-batch 基础设施）
- [ ] 社区热度信号：接入 download count / star count 作为 globalPopularity
- [ ] 反馈闭环系统：追踪推荐命中率，持续优化权重

---

## 六、关键文件清单

### 当前路由相关代码

| 文件 | 作用 |
|------|------|
| `src/agents/pi-tools.ts:108-419` | 工具组装主入口（硬编码拼接） |
| `src/agents/clawdbot-tools.ts:149-179` | ClawdBot 工具 + 插件 + MCP 合并 |
| `src/agents/skills/workspace.ts:95-212` | Skill 加载、过滤、prompt 生成 |
| `src/agents/skills/config.ts:187-253` | Skill eligibility 检查 |
| `src/mcp/tool-bridge.ts` | MCP tool → Agent tool 桥接 |
| `src/mcp/runtime-manager.ts` | MCP 运行时管理（进程启停） |

### Skill 质量评估（已有优势）

| 文件 | 作用 |
|------|------|
| `skillsqingxi/pipeline.ts` | 三层评估 pipeline |
| `skillsqingxi/layer1-rules.ts` | 规则引擎（结构/安全） |
| `skillsqingxi/layer2-security.ts` | AI 安全审计 |
| `skillsqingxi/layer3-quality.ts` | 质量评分 + 分类 + tags |
| `skillsqingxi/types.ts` | 评估结果类型定义 |

### 需要新建的文件（Phase 1）

| 文件 | 作用 |
|------|------|
| `src/agents/tools/tool-search.ts` | search_tools 工具实现 |
| `src/agents/skills/unified-index.ts` | 统一 Skills + MCP 索引 |
| `src/agents/skills/bm25-index.ts` | BM25 搜索引擎（轻量本地） |

---

## 七、与 TODO-smart-router-design.md 的关系

- **TODO-smart-router-design**: 解决**模型路由**问题（简单任务用便宜模型，复杂任务用强模型）
- **本 TODO**: 解决**工具路由**问题（从 3000+ Skills + MCP 中找到正确的工具）
- **两者互补**：先选工具（本 TODO），再选模型（smart-router）
- 优先级链：用户 `/model` 指令 > Smart Router 模型选择 > Tool Search 工具发现 > 默认行为

---

## 八、一句话总结

**不做独立意图分类器，学 Claude Code 的 Tool Search 模式：建 BM25 索引覆盖所有 Skills + MCP tools，让 Agent 按需搜索自己选择。已有的 layer1/2/3 质量评分体系（S/A/B/C/D tier）是别人没有的排序优势——直接用它加权搜索结果。**

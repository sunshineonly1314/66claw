# TODO-10: 智能匹配与加载 Skills/MCP

> 调研日期: 2026-02-09
> 优先级: 高
> 状态: 调研完成，待实施

---

## 一、现状诊断：openclawcn 当前的"硬匹配"瓶颈

当前 skill 加载是 **9 级硬过滤器链**（`src/agents/skills/config.ts` `shouldIncludeSkill()`）：

```
SKILL.md 加载 -> 区域过滤(CN) -> enabled检查 -> OS兼容 -> always标记
  -> bins二进制检查 -> anyBins检查 -> env环境变量 -> config配置路径
  -> 全部通过 = 加入 prompt
```

**核心问题：没有任何语义匹配，所有通过的 skill 全量注入 prompt。**

| 维度 | 现状 | 问题 |
|------|------|------|
| **选择逻辑** | 环境硬匹配（有没有 `gh` CLI、有没有 API key） | 不看用户意图 |
| **加载粒度** | 全量注入所有符合条件的 skill prompt | token 浪费 |
| **MCP 工具** | 全量注入所有已启动 server 的所有工具 | 最多 20 server x N tools |
| **优先级** | 无 | skill 之间没有权重 |
| **上下文感知** | 无 | 不根据对话内容动态调整 |

### 工具数量与准确率的关系（业界研究数据）

| 工具数量 | LLM 选择准确率 |
|----------|---------------|
| ~50 tools | 84-95% |
| ~200 tools | 41-83% |
| ~740 tools | **0-20%** |

> 来源: Scale AI / ToolBench / BFCL 评测

---

## 二、业界方案全景图

### 2.1 五大流派对比

| 方案 | 检索方式 | 大规模准确率 | Token 节省 | 成熟度 |
|------|----------|-------------|-----------|--------|
| **全量注入**（openclawcn 现状） | 无 | 740+ tools 时 0-20% | 0% | -- |
| **Anthropic Tool Search** | Regex + BM25 | 2792 tools 时 ~34% | 85% | Beta (2025.11) |
| **RAG-MCP**（论文） | Dense embeddings | 中等规模 ~43% | 50%+ | 学术研究 |
| **Stacklok MCP Optimizer** | **混合语义 + BM25** | 2792 tools 时 **94%** | 显著 | 生产级 |
| **vLLM Semantic Router** | 6 类信号融合 | +10.24pt 提升 | 48.5% | 生产 v0.1 (2026.01) |

### 2.2 关键方案详解

#### (A) Anthropic 官方 Tool Search Tool（Beta）

2025.11 推出，API header: `advanced-tool-use-2025-11-20`

```jsonc
// API 请求中标记 defer_loading
{
  "tools": [
    { "name": "github_pr", "defer_loading": true },
    { "name": "slack_send", "defer_loading": true }
    // 可支持 10,000+ 工具定义
  ]
}
```

- Claude 按需通过 **regex + BM25** 搜索发现工具，每次返回 3-5 个
- 支持 **自定义检索**：用 `tool_reference` 块接入自己的检索引擎
- **局限**：内置检索准确率偏低（Stacklok 实测 34% vs 94%），但自定义检索接口是关键杠杆
- 仅支持 Sonnet 4.5 / Opus 4.5+

> 参考:
> - https://www.anthropic.com/engineering/advanced-tool-use
> - https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool

#### (B) Stacklok MCP Optimizer（当前最优解）

```
用户查询 -> 混合检索(语义embedding + BM25关键词) -> Top-K候选 -> LLM最终选择
```

- 两个核心原语：`find_tool`（混合搜索）+ `call_tool`（路由执行）
- 2792 tools 实测：**检索准确率 98%，最终选择准确率 94%**
- 自动轮询保持索引同步
- 开源: https://github.com/StacklokLabs/mcp-optimizer

> 参考:
> - https://stacklok.com/blog/stackloks-mcp-optimizer-vs-anthropics-tool-search-tool-a-head-to-head-comparison/
> - https://docs.stacklok.com/toolhive/tutorials/mcp-optimizer

#### (C) Tool Gating MCP（语义网关）

```
MCP Client <-> Tool Gating Proxy <-> [MCP Server 1, 2, 3, ...]
```

- 使用 **sentence-transformer** 对工具元数据做嵌入
- 用户查询 -> 嵌入 -> 语义相似度匹配
- 声称 **减少 90%+ 上下文使用**
- 工具按需加载：匹配到才实际连接对应 MCP server
- 开源: https://github.com/ajbmachon/tool-gating-mcp

#### (D) RAG-MCP（学术方案，arXiv:2505.03275）

- 将所有 MCP server 的工具描述建成向量索引
- 查询时语义检索 -> 只传递匹配的工具给 LLM
- 实测：prompt token 减少 50%+，工具选择准确率从 13.62% 提升到 **43.13%**

> 参考:
> - https://arxiv.org/abs/2505.03275
> - https://writer.com/engineering/rag-mcp/

#### (E) vLLM Semantic Router（最前沿，NeurIPS 2025）

2026.01 v0.1 "Iris" 发布：

```
信号提取(6类) -> 信号决策组合(AND/OR/优先级) -> 工具路由
```

6 类信号：Domain / Keyword / Embedding / Factual / Feedback / Preference

延迟降低 47.1%，token 降低 48.5%。

> 参考:
> - https://blog.vllm.ai/2026/01/05/vllm-sr-iris.html
> - https://github.com/vllm-project/semantic-router

#### 其他相关项目

| 项目 | 定位 | 链接 |
|------|------|------|
| **Tool-to-Agent Retrieval** | 共享向量空间检索，+19.4% Recall@5 | arXiv:2511.01854 |
| **SONAR** | 语义 + 网络健康感知路由，93% 成功率 | arXiv:2510.18550 |
| **Writer MCP Gateway** | 自动 API 描述重写 + 向量检索 | writer.com/engineering/rag-mcp |
| **Arcade.dev MCP Runtime** | 生产级 MCP 治理平台 | arcade.dev |
| **Smithery.ai** | 7300+ MCP 工具市场 | smithery.ai |
| **GitHub MCP Registry** | 带语义搜索嵌入的 MCP 注册表 | github.blog |
| **Official MCP Registry** | 2000+ server，子串搜索 | registry.modelcontextprotocol.io |

---

## 三、openclawcn 已有的可利用资产

| 资产 | 位置 | 可利用价值 |
|------|------|-----------|
| **skills-index.json** | `skillsqingxi/output/skills-index.json` | 已有 name、description、descriptionZh、category、tags、tier、score |
| **3 层质量评估** | `skillsqingxi/layer1-3` | 已有安全规则 + AI 审计 + 质量评分 |
| **SKILL.md 元数据** | 每个 skill 的 frontmatter | emoji、requires、install、primaryEnv |
| **MCP 工具桥接** | `src/mcp/tool-bridge.ts` | 已有 serverId + toolName + inputSchema + description |
| **快照版本机制** | `src/agents/skills/workspace.ts` | SkillSnapshot + version 缓存失效 |
| **文件监听** | `src/agents/skills/refresh.ts` | chokidar 实时检测 skill 变更 |

---

## 四、推荐架构：三阶段智能匹配方案

### 阶段一：Lightweight -- 基于 Anthropic Tool Search 的低成本方案

**原理**：利用 Anthropic 官方 `defer_loading` + 自定义 `tool_reference` 检索

```
+--------------------------------------------------------------+
|                    Agent Runtime                             |
|                                                              |
|  用户消息 -> Claude (仅加载 find_skill + find_mcp_tool)      |
|               |                                              |
|               +- 需要工具时 -> 调用 find_skill/find_mcp_tool |
|               |                                              |
|               v                                              |
|  +-------------------------+                                 |
|  |   本地检索引擎 (轻量)    |                                |
|  |                         |                                 |
|  |  BM25(name + desc +     |     +----------------------+   |
|  |  tags + category)       | --> | 返回 Top-5 skill     |   |
|  |                         |     | 作为 tool_reference   |   |
|  +-------------------------+     +----------------------+   |
|                                                              |
|  Claude 获得匹配的 skill 完整 prompt -> 执行                 |
+--------------------------------------------------------------+
```

**实现要点**：
- 复用 `skills-index.json` 的 tags/category/description 做 BM25 检索
- 注册两个 meta-tool：`find_skill(query)` 和 `find_mcp_tool(query)`
- 其他所有 skill/MCP tool 标记为 `defer_loading: true`
- **成本**：几乎为零，无需外部依赖，纯字符串匹配
- **开发量**：1-2 天

### 阶段二：Semantic -- 混合语义检索

**原理**：参考 Stacklok MCP Optimizer，引入 embedding 向量检索

```
              启动时/skill变更时

  所有 SKILL.md desc + MCP tool desc
         |
         v
  Sentence Transformer 嵌入
  (本地: all-MiniLM-L6-v2, ~80MB)
         |
         v
  +-------------------+
  | 向量索引           |  <-- 利用 refresh.ts 的
  | (内存/SQLite)      |      版本机制增量更新
  +-------------------+

              查询时

  用户意图 -> embedding -> 向量近似搜索 (Top-10)
                    +
            BM25 关键词搜索 (Top-10)
                    |
                    v
             RRF 融合排序 -> Top-5 返回
```

**实现要点**：
- 使用 `all-MiniLM-L6-v2`（80MB，纯 CPU 推理，延迟 <10ms）
- 混合检索 = Dense Embedding + BM25，用 **RRF（Reciprocal Rank Fusion）** 融合
- 索引构建绑定 `SkillSnapshot.version`，skill 变更自动重建
- 参考 Stacklok 数据：2792 tools 时检索准确率 98%
- **开发量**：1-2 周

### 阶段三：Adaptive -- 上下文自适应路由

**原理**：参考 vLLM Semantic Router 的多信号决策架构

```
  信号层（6 类信号并行提取）

  +---------+ +---------+ +----------+ +--------------+
  | Domain  | |Keyword  | |Embedding | | Conversation |
  | 检测    | | 匹配    | | 语义     | | 上下文       |
  +----+----+ +----+----+ +----+-----+ +------+-------+
       |           |           |               |
       v           v           v               v
  +----------------------------------------------------+
  |            决策融合层                                |
  |                                                    |
  |  权重 = f(信号置信度, skill tier, 使用频率)          |
  |  会话级缓存: 同话题复用已选 skill                    |
  |  反馈学习: 工具调用成功/失败 -> 调整权重             |
  +----------------------------------------------------+
       |
       v
  动态工具集 (3-8 个最相关 skill/MCP tool)
```

**新增能力**：
- **会话上下文感知**：分析最近 N 轮对话主题，预加载相关 skill
- **使用频率权重**：高频使用的 skill 获得加权提升
- **质量权重**：利用 `skills-index.json` 的 `tier` 和 `overallScore`
- **反馈回路**：工具调用成功 -> 提升权重；失败 -> 降低权重
- **开发量**：2-4 周

---

## 五、Skills 与 MCP 工具的统一检索索引

**关键洞察：Skills 和 MCP Tools 应该共享同一个检索索引。**

```
统一索引 Schema:
{
  id: "skill:github" | "mcp:weather:get_temp",
  type: "skill" | "mcp_tool",
  name: "github" | "get_temperature",
  description: "...",
  embedding: Float32Array(384),      // 阶段二引入
  keywords: ["git", "pr", "issue"],
  category: "开发工具",
  tier: "S" | "A" | "B" | null,
  serverId?: "weather_server",       // MCP only
  requires?: { bins, env, ... },     // Skill only
}
```

MCP tool 的描述来自 `tool-bridge.ts` 的 `MCPToolInfo.description` + `inputSchema`，与 skill 的 `SKILL.md` description 放入同一个向量空间。

---

## 六、可行性评估与建议路径

| 维度 | 阶段一 (BM25) | 阶段二 (Hybrid) | 阶段三 (Adaptive) |
|------|-------------|----------------|-------------------|
| **开发量** | 1-2 天 | 1-2 周 | 2-4 周 |
| **外部依赖** | 无 | sentence-transformer (~80MB) | 同上 + 持久化存储 |
| **效果预估** | 全量->Top-5, token 节省 60%+ | 2800 tools 时 94%+ 准确率 | 会话级自适应 |
| **风险** | 关键词匹配不够精确 | 嵌入模型需要加载时间 | 复杂度高 |
| **适合场景** | skill < 50 | skill 50-500 | skill 500+ |

### 建议执行路径

1. **立即可做（阶段一）**：利用已有 `skills-index.json` 做 BM25，配合 Anthropic `defer_loading` API，零成本获得显著提升
2. **中期目标（阶段二）**：参考 Stacklok MCP Optimizer（开源）架构，当前实测效果最好的方案
3. **快速集成选项**：直接部署 tool-gating-mcp 或 mcp-optimizer 作为 MCP proxy 层，不改 openclawcn 核心代码

### 最高 ROI 切入点

- `src/agents/skills/workspace.ts` -> `buildWorkspaceSkillSnapshot()` 增加检索层，将"全量注入"改为"按需检索注入"
- `src/mcp/tool-bridge.ts` -> `bridgeAllTools()` 对 MCP 工具做同样处理

---

## 七、参考资源

### 学术论文
- ToolBench (ICLR 2024): https://github.com/OpenBMB/ToolBench
- RAG-MCP: arXiv:2505.03275
- Tool-to-Agent Retrieval: arXiv:2511.01854
- SONAR: arXiv:2510.18550

### 开源项目
- Stacklok MCP Optimizer: https://github.com/StacklokLabs/mcp-optimizer
- Tool Gating MCP: https://github.com/ajbmachon/tool-gating-mcp
- vLLM Semantic Router: https://github.com/vllm-project/semantic-router
- Skills.sh: https://github.com/vercel-labs/skills

### 官方文档
- Anthropic Advanced Tool Use: https://www.anthropic.com/engineering/advanced-tool-use
- Tool Search Tool API: https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
- MCP Registry: https://registry.modelcontextprotocol.io/
- GitHub MCP Registry: https://github.blog/ai-and-ml/github-copilot/meet-the-github-mcp-registry-the-fastest-way-to-discover-mcp-servers/

### 行业博客
- Stacklok vs Anthropic 对比: https://stacklok.com/blog/stackloks-mcp-optimizer-vs-anthropics-tool-search-tool-a-head-to-head-comparison/
- Writer MCP Gateway: https://writer.com/engineering/rag-mcp/
- Red Hat Tool RAG: https://next.redhat.com/2025/11/26/tool-rag-the-next-breakthrough-in-scalable-ai-agents/

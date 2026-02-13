# Intelligent Dispatch Module

智能调度模块 — 在用户请求到达主模型之前，自动识别意图并路由到最优的 **模型 + Skill + MCP 工具** 组合。

---

## 1. 需求背景

### 1.1 问题

Clawdbot 的 skills、MCP tools、模型选择各自独立：

- **Skills** 在 system prompt 中平铺列出，由 LLM 自行判断使用哪个 — 无优先级
- **MCP tools** 全部暴露给 LLM，无根据任务类型过滤或推荐
- **模型** 固定为配置中的默认模型 — 画图任务用 Claude、SQL 查询用 Claude，资源浪费

### 1.2 目标

构建一个轻量级智能调度层，在用户请求到达主模型之前，自动完成：

1. **意图识别** — 判断用户想做什么（画图 / 发微信 / 写代码 / 查数据库 / ...）
2. **模型路由** — 根据意图自动切换到最优模型（画图→SeedDance，代码→Opus）
3. **Skill 推荐** — 将最相关的 skill 排到 system prompt 最前面
4. **MCP 工具标注** — 在推荐的 MCP 工具旁添加 `[推荐]` 标注
5. **复杂度评估** — 判断任务是简单/中等/复杂，决定执行策略（单 agent / 增强 / 多 agent 并行）
6. **成本控制** — 预估请求成本，在预算内自动降级到更便宜的模型

### 1.3 方案

**混合模式**（规则优先 + LLM 兜底），独立 `dispatch.yaml` 配置文件。

- 规则分类器（关键词 + 正则 + 同义词扩展）→ 延迟 < 5ms
- LLM 分类器（仅规则置信度不足时触发）→ 轻量模型单次推理
- 16 步后处理流水线 → 媒体加成、复杂度、资源守卫、成本估算、遥测

---

## 2. 架构总览

```
用户消息
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│                    Dispatch Engine                        │
│                     (engine.ts)                          │
│                                                          │
│  ┌──────────────┐   置信度 ≥ 0.7   ┌─────────────────┐  │
│  │ 规则分类器    │ ────────────────→ │ 直接路由        │  │
│  │ 关键词+正则   │                  │                 │  │
│  │ +同义词扩展   │                  └─────────────────┘  │
│  └──────┬───────┘                                        │
│         │ 置信度 < 0.7                                   │
│  ┌──────▼───────┐                                        │
│  │ LLM 分类器   │  轻量模型(Haiku/Qwen)                 │
│  │ 单次推理     │  同时返回意图+复杂度                    │
│  └──────────────┘                                        │
│         │                                                │
│  ┌──────▼───────────────────────────────────────────┐    │
│  │ 后处理流水线                                      │    │
│  │  ① AbortSignal   ④ 会话上下文调整               │    │
│  │  ② 媒体类型加成   ⑤ 资源守卫降级                 │    │
│  │  ③ 复杂度评估     ⑥ 成本估算+遥测记录            │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
                   RoutingDecision {
                     intent, confidence,
                     modelOverride,
                     skillHints, mcpToolHints,
                     complexity, strategy,
                     estimatedCostUsd
                   }
                           │
                           ▼
                   get-reply-run.ts
                   (应用 model/skill/system 覆盖)
```

---

## 3. 核心流程（engine.ts 16 步）

| 步骤 | 模块 | 说明 |
|------|------|------|
| 1 | config-loader | 加载 dispatch.yaml（带缓存 + 10s mtime 热更新） |
| 2 | config-loader | 未找到配置或 `enabled: false` → 直接返回默认路由 |
| 3 | intent-classifier | 意图分类：规则优先，置信度不足时 LLM 兜底 |
| 4 | engine | 查找匹配的 intent 定义（未找到时 warn 并回退默认） |
| **4.5** | **engine** | **AbortSignal 检查点 — 请求已取消则立即返回** |
| 5 | engine | 媒体类型加成（图片/音频附件 → 相关意图 +0.25） |
| 6 | engine | 媒体重分类：低置信度文本 + 强媒体信号 → 切换意图 |
| 7 | engine | 解析 model override（支持 fallback 备选模型） |
| 8 | engine | MCP 工具通配符展开（`mcp_database_*` → 具体工具名） |
| 9 | complexity-classifier | 复杂度评估（规则 + LLM piggyback） |
| 10 | session-context | 会话上下文分析 → 复杂度微调（±1 级） |
| 11 | resource-guard | 资源守卫：并发检查 + 策略降级 |
| 12 | engine | 策略级 model override（按 single/enhanced/multi 选模型） |
| 13 | cost-estimator | 成本预估（token 估算 + 模型定价，保证非负） |
| 14 | engine | 组装 RoutingDecision |
| 15 | dispatch-telemetry | 记录遥测事件（环形缓冲，O(1) 写入） |
| 16 | session-context | 记录本轮会话快照 |

---

## 4. 模块文件说明

### 4.1 核心文件（3,750 行）

| 文件 | 行数 | 职责 |
|------|------|------|
| **types.ts** | 209 | 全部类型定义：DispatchConfig, IntentDefinition, RoutingDecision, ComplexityLevel, ExecutionStrategy 等 |
| **engine.ts** | 510 | 调度引擎主入口。`dispatchRequest()` 编排 16 步流水线。含 AbortSignal 检查、intent 查找 warn 日志 |
| **config-loader.ts** | 405 | 加载和校验 dispatch.yaml。YAML 解析 → 校验 → 预编译正则 → 缓存。支持 mtime 热更新。含 ReDoS 防护（嵌套量词 + 贪婪分组检测） |
| **intent-classifier.ts** | 437 | 意图分类。规则匹配（关键词 + 正则 + 同义词加成）→ LLM 兜底 → 置信度排序。关键词 RegExp 缓存有 1000 上限 FIFO 驱逐 |
| **llm-classify.ts** | 222 | 轻量 LLM 分类。直接调用 Anthropic/OpenAI-compatible API，隔离依赖 |
| **complexity-classifier.ts** | 231 | 复杂度评估。规则启发式（长度/多步/研究/对比信号）→ 评分 → low/medium/high。ENUM_RE 使用字符类否定匹配防 ReDoS |
| **synonym-expander.ts** | 279 | 双语同义词扩展。内置 7 个意图的 CN↔EN 同义词表，提升关键词召回率 |
| **skill-hints.ts** | 48 | Skill 重排序。将推荐 skill 移到 system prompt 前面（不删除其他 skill） |
| **cost-estimator.ts** | 389 | Token 估算（CJK 1.5字/token, EN 4字/token）+ 20 款模型定价表 + 预算守卫。成本保证非负 |
| **session-context.ts** | 304 | 多轮会话追踪。滑动窗口（20 轮）、复杂度趋势检测、回指检测 |
| **resource-guard.ts** | 280 | 资源守卫。并发信号量 + 策略降级（multi → enhanced → single）+ 熔断器。slot 释放幂等 |
| **dispatch-telemetry.ts** | 324 | 结构化遥测。环形缓冲（1000 事件）、Map 索引 O(1) 查询、聚合指标 |
| **index.ts** | 112 | 统一导出。所有公共 API 的单一入口点 |

### 4.2 测试文件（3,397 行 / 309 用例）

| 文件 | 用例数 | 覆盖范围 |
|------|--------|---------|
| **intent-classifier.test.ts** | 22 | 关键词/正则/组合评分、CJK 匹配、大小写、catch-all |
| **complexity-classifier.test.ts** | 31 | 简单/中等/复杂任务、信号组合、边界、置信度判定 |
| **config-loader.test.ts** | 12 | YAML 解析、默认值填充、校验错误、热更新 |
| **synonym-expander.test.ts** | 19 | 同义词索引构建、扩展、加成计算、CJK 单字 |
| **cost-estimator.test.ts** | 20 | Token 估算、模型定价匹配、预算检查 |
| **session-context.test.ts** | 20 | 多轮记录、超时重置、复杂度趋势、会话上限 |
| **resource-guard.test.ts** | 15 | 并发限制、策略降级、熔断器触发/恢复 |
| **dispatch-telemetry.test.ts** | 12 | 环形缓冲、事件丰富、指标聚合 |
| **skill-hints.test.ts** | 7 | Skill 重排序、空输入处理 |
| **stress-validation.test.ts** | 40 | 性能验证、CJK 原生支持、端到端流水线、**ReDoS 抗性、缓存边界、成本非负、复杂度分数不变量** |
| **real-world-cases.test.ts** | 111 | 12 类真实场景（画图/微信/SQL/代码/桌面/搜索/音频/通用/歧义/对抗/复杂度/跨语言） |

**总计：7,147 行代码 / 309 个测试用例 / 11 个测试文件**

---

## 5. 意图分类算法

### 5.1 规则分类器（< 5ms）

```
评分 = min(1.0, 关键词分 + 正则分 + 组合加成 + 同义词加成)

关键词分 = min(0.6, 命中数/总数 × 0.6 × 3)
  - CJK 关键词：子串匹配（中文无词边界）
  - ASCII 关键词：\b 词边界匹配（缓存 RegExp，上限 1000 条 FIFO 驱逐）

正则分 = min(0.8, 命中数/总数 × 0.8 × 2)
  - 预编译正则，case-insensitive
  - 编译前经 ReDoS 安全检查（嵌套量词、交替分组、贪婪量词分组）

组合加成 = +0.1（关键词 + 正则同时命中时）
同义词加成 = min(0.2, 命中同义词组数 × 0.05)
```

### 5.2 LLM 兜底分类

- 触发条件：规则最高置信度 < `ruleConfidenceThreshold`（默认 0.7）
- 模型：轻量模型（Haiku / Qwen-Turbo），单次推理
- 输出：`{"intent": "...", "confidence": 0.x, "complexity": "..."}`
- 复杂度 piggyback：零额外成本附带复杂度评估
- LLM 返回的 confidence 经 `Math.min(1.0, Math.max(0, ...))` 钳位

### 5.3 同义词扩展

内置 7 个意图的双语同义词表：

| 意图 | 同义词组示例 |
|------|-------------|
| image_generation | 画/绘画/作画/AI绘画 ↔ draw/paint/sketch/illustrate |
| wechat_operation | 发消息/传话/告诉/通知 ↔ send message/text |
| database_query | 查询/检索/筛选 ↔ query/filter/lookup |
| coding | 代码/源码/程序 ↔ code/programming ；重构/refactor ；debug/调试/排查bug |
| desktop_control | 打开/启动/运行 ↔ open/launch/start ；截图/截屏 ↔ screenshot |
| web_browsing | 搜索/搜一下/帮我查 ↔ search ；浏览/访问 ↔ browse/visit |
| audio_processing | 语音/音频/录音 ↔ voice/audio ；转文字/转录 ↔ transcribe/STT |

---

## 6. 复杂度评估算法

### 6.1 信号与权重

| 信号 | 正则模式 | 权重 | 说明 |
|------|---------|------|------|
| multi_step | `首先.*然后`, `step [1-9]`, `第一...第二` | +0.35 | 明确的多步骤任务 |
| multi_dimension | `各方面`, `分别`, `respectively` | +0.20 | 多维度分析 |
| enumeration | 3+ 项列表（逗号/顿号/编号） | +0.15 | 枚举型任务（ReDoS 安全正则） |
| deep_research | `深入/全面/系统性/综合/调研/评估` | +0.20 ~ +0.45 | 研究型任务（按指标数分级） |
| comparison | `对比/比较/vs/优缺点/pros and cons` | +0.20 | 对比评估 |
| very_long_prompt | CJK > 600字 / EN > 1500字 | +0.20 | 超长提示 |
| long_prompt | CJK > 200字 / EN > 500字 | +0.10 | 长提示 |
| simple_greeting | `你好/hello/嗨` | -0.50 | 简单问候 |
| simple_question | `什么是/谁是/翻译` | -0.30 | 简单问题 |
| simple_command | `帮我翻译/总结一下` | -0.20 | 简单指令 |
| very_short | CJK < 30字 / EN < 60字（无其他信号时） | -0.20 | 超短提示 |

**分数不变量**：最终分数经 `Math.max(0, Math.min(1, score))` 钳位，始终在 [0, 1] 范围内。

### 6.2 研究指标分级计数

当 `deep_research` 信号触发时，进一步计算不同研究关键词的出现数量：

| 指标数 | 加分 | 示例 |
|--------|------|------|
| 1 个 | +0.20 | "全面分析" |
| 2 个 | +0.25 | "全面深入分析" |
| 3~4 个 | +0.35 | "全面深入分析...系统性评估" |
| 5+ 个 | +0.45 | "全面深入分析...系统性评估...pros and cons" |

### 6.3 阈值与执行策略

```
score ≤ 0.2  → low    → single  策略（一个 agent，最便宜模型）
score 0.2~0.5 → medium → enhanced 策略（一个 agent，更强模型）
score ≥ 0.5  → high   → multi/enhanced（研究类并行，编程类单 agent）
```

---

## 7. 安全机制

### 7.1 ReDoS 防护

| 层级 | 机制 | 位置 |
|------|------|------|
| 配置层 | `isRegexDangerous()` 编译前检测嵌套量词、交替分组、贪婪 `.*` 分组 | config-loader.ts:292 |
| 内置正则 | `ENUM_RE` 使用字符类否定 `[^,，、]*` 代替贪婪 `.*` | complexity-classifier.ts:50 |
| 长度限制 | 用户正则模式最长 500 字符 | config-loader.ts:285 |

### 7.2 内存安全

| 资源 | 边界机制 | 位置 |
|------|---------|------|
| keywordRegexCache | 上限 1000 条，FIFO 驱逐 | intent-classifier.ts:41-56 |
| 会话 sessions Map | 上限 100 个，LRU 淘汰 + 30 分钟超时 | session-context.ts |
| 遥测环形缓冲 | 上限 1000 事件，自动覆盖 | dispatch-telemetry.ts |
| 成本日志 | 24 小时滑动窗口 | cost-estimator.ts |
| 资源守卫错误日志 | 60 秒滑动窗口 | resource-guard.ts |

### 7.3 取消传播

- `dispatchRequest()` 接受 `AbortSignal` 参数
- 步骤 3（LLM 分类）：signal 直接传递给 LLM API 调用
- 步骤 4.5：分类完成后显式检查 `signal.aborted`，已取消则立即返回

### 7.4 成本非负保证

`estimateCost()` 返回值经 `Math.max(0, ...)` 保护，防止浮点精度导致负数。

---

## 8. 资源守卫

### 8.1 并发控制

| 参数 | 默认值 | 说明 |
|------|--------|------|
| maxConcurrentRequests | 5 | 最大并行 LLM 请求 |
| maxConcurrentMultiAgent | 2 | 最大并行多 agent 编排 |

### 8.2 策略降级链

```
multi (并行多agent) ──[multi槽满/并发不足]-→ enhanced (强模型单agent) ──[并发已满]-→ single (最便宜)
```

### 8.3 熔断器

- 错误率 ≥ 50%（至少 5 个样本）→ 熔断开启
- 熔断期间：multi/enhanced → 强制降为 single
- 30 秒冷却后自动恢复
- slot 释放函数幂等（多次调用安全）

---

## 9. 成本估算

### 9.1 Token 估算

| 语言 | 字符/Token | 说明 |
|------|-----------|------|
| 英文 | ~4 | GPT/Claude 平均 |
| CJK | ~1.5 | 每个汉字约 1-2 个 token |
| 混合 | 加权平均 | 按 CJK 字符占比 |

### 9.2 输出 Token 估算

| 复杂度 | 基础输出 | multi 策略 | enhanced 策略 |
|--------|---------|-----------|--------------|
| low | 200 | 600 (×3) | 300 (×1.5) |
| medium | 800 | 2400 (×3) | 1200 (×1.5) |
| high | 2000 | 6000 (×3) | 3000 (×1.5) |

### 9.3 预算守卫

- **单请求限额**：超出 → 自动降级到更便宜模型
- **小时限额**：超出 → 阻止昂贵路由
- **日限额**：软限制，日志告警

---

## 10. 会话上下文

### 10.1 滑动窗口

- 每个 session 保留最近 20 轮会话快照
- 超过 30 分钟无交互 → 自动重置
- 最多追踪 100 个并发 session（LRU 淘汰）

### 10.2 信号检测

| 信号 | 说明 | 影响 |
|------|------|------|
| 回指检测 | "上面/前面/刚才/above/previous/continue" | 如果上轮是 high → 复杂度 +1 |
| 复杂度趋势 | 最近 5 轮的复杂度线性趋势 | escalating → +1, declining → -1 |
| 话题连续性 | 当前意图与最近 3 轮一致 | 标记为话题延续 |

---

## 11. 配置文件 dispatch.yaml

### 11.1 搜索路径

`{agentDir}/dispatch.yaml` → `{workspaceDir}/dispatch.yaml`

### 11.2 完整示例

```yaml
version: 1

settings:
  enabled: true
  ruleConfidenceThreshold: 0.7  # 规则置信度阈值
  timeoutMs: 3000               # 调度超时
  debug: false                  # 调试日志

classifier:
  model: "anthropic/claude-haiku-3"
  maxTokens: 100
  systemPrompt: |
    You are an intent classifier. ...
    Available intents: {{intent_ids}}

intents:
  - id: "image_generation"
    description: "Generate images from text"
    patterns:
      keywords: ["画", "生成图", "draw", "create image"]
      regex: ["(画|生成).*?(图|image|picture)"]
      semanticTags: ["image", "visual"]
      mediaTypes: ["image"]  # 图片附件加成
    routing:
      model: "seeddance/seeddance-2.0"
      fallbackModel: "openai/dall-e-3"
    skills: ["openai-image-gen"]
    mcpTools: []
    systemHint: "User wants to generate an image."

  - id: "database_query"
    patterns:
      keywords: ["SQL", "数据库", "database"]
      regex:
        # 要求完整 SQL 结构，防止自然语言误匹配
        - "SELECT\\s+(?:\\*|[\\w.]+(?:\\s*,\\s*[\\w.]+)*)\\s+FROM\\s"
        - "INSERT\\s+INTO"
        - "UPDATE\\s+\\w+\\s+SET"
        - "DELETE\\s+FROM"
        - "CREATE\\s+TABLE"
    routing:
      model: null  # 使用默认模型
    mcpTools: ["mcp_database_*"]  # 通配符展开

  - id: "general"  # 兜底，必须放最后
    patterns:
      keywords: []
      regex: []
    routing:
      model: null

defaults:
  model: null
  skills: []
  mcpTools: []
```

### 11.3 关键词设计原则

1. **避免多义词做关键词**：如 "select"（SQL 关键字 vs 英文动词）应通过正则匹配完整语句 `SELECT...FROM`，而非裸关键词
2. **CJK 单字有效**：中文 "画" 是完整语素，可作为关键词
3. **正则要求结构化匹配**：SQL 模式要求 `SELECT <列> FROM <表>` 的完整结构，防止自然语言误匹配
4. **同义词表补充召回**：dispatch.yaml 关键词 + synonym-expander 内置同义词双重覆盖
5. **同义词避免跨意图污染**：database_query 同义词不含 "select"（英文通用动词）和 "search"（属于 web_browsing）

---

## 12. 集成点

### 12.1 get-reply-run.ts 集成

在 `followupRun` 构建之前调用 dispatch engine：

```typescript
import { dispatchRequest } from "../dispatch/engine.js";
import { applySkillHints } from "../dispatch/skill-hints.js";

const dispatch = await dispatchRequest({
  prompt: baseBodyTrimmed,
  clawdbotConfig: cfg,
  agentDir,
  workspaceDir,
  availableMCPTools: mcpTools,
  sessionId,
});

// 应用 model override（用户指令优先）
if (dispatch.modelOverride && !userExplicitModel) {
  provider = dispatch.modelOverride.provider;
  model = dispatch.modelOverride.model;
}

// 应用 skill hints
if (dispatch.skillHints.length > 0 && skillsSnapshot) {
  skillsSnapshot = applySkillHints(skillsSnapshot, dispatch.skillHints);
}
```

### 12.2 system-prompt.ts 集成

对 dispatch 推荐的 MCP 工具添加 `[推荐]` 标注：

```typescript
const isHinted = dispatchMCPToolHints?.includes(tool);
const suffix = isHinted ? " [推荐/Recommended]" : "";
```

---

## 13. 设计决策

| 决策 | 理由 |
|------|------|
| Dispatch 在 followupRun 之前运行 | 只修改输入参数，不侵入 PI agent 内部 |
| Skill hints 重排序而非过滤 | 保留 agent 使用其他 skill 的能力 |
| MCP tools 标注而非过滤 | 不破坏工具合约 |
| 独立 dispatch.yaml | 与 clawdbot.yaml 解耦，热更新独立 |
| LLM 分类通过独立 API 调用 | 避免循环依赖，隔离 provider 层 |
| engine 只读资源检查 | dispatch 只做路由决策，不持有 LLM 请求槽 |
| 环形缓冲遥测 | 有界内存，O(1) 写入/查询 |
| 会话 Map 上限 100 | 防止无界增长，LRU 淘汰 |
| 同义词移除 "select" | 多义英文词在非 SQL 语境造成误匹配 |
| SQL regex 要求完整结构 | `SELECT...FROM` 而非裸 `SELECT`，防止自然语言误匹配 |
| ENUM_RE 用字符类否定 | `[^,，、]*` 代替 `.*`，消除 ReDoS 回溯风险 |
| keywordRegexCache FIFO 驱逐 | 上限 1000 条，防止长时间运行内存泄漏 |
| engine 步骤 4.5 abort 检查 | 分类后立即检查取消信号，避免不必要的后续计算 |
| cost 非负保护 | `Math.max(0, ...)` 防止浮点精度导致负数成本 |

---

## 14. 性能指标

| 指标 | 实测值 | 说明 |
|------|--------|------|
| 规则分类延迟 | ~0.023ms | 比 5ms 目标快 200+ 倍 |
| 长提示分类延迟 | ~0.156ms | 5000 字提示仍远低于 5ms |
| ReDoS 抗性 | < 50ms | 100 个连续逗号的对抗性输入 |
| CJK 单字匹配 | ✓ | "画" 作为完整关键词正确匹配 |
| 同义词召回提升 | +15~25% | 对长尾表述的覆盖 |
| 真实案例准确率 | 111/111 (100%) | 12 类场景，含对抗测试 |
| 全量测试 | 309/309 (100%) | 11 个测试文件 |

---

## 15. 独立审查记录

### 15.1 审查范围

以外部专家视角进行三维独立审查：架构与类型安全、分类器算法正确性、引擎流水线与运维模块。

### 15.2 发现与修复

共发现 38 个问题，已修复 6 个 CRITICAL/HIGH 级：

| # | 严重度 | 文件 | 问题 | 修复 |
|---|--------|------|------|------|
| 1 | CRITICAL | complexity-classifier.ts | `ENUM_RE` 嵌套量词 ReDoS | 改为字符类否定匹配 |
| 2 | CRITICAL | intent-classifier.ts | keywordRegexCache 无界增长 | FIFO 驱逐上限 1000 |
| 3 | HIGH | engine.ts | intent 查找失败静默回退 | 添加 warn 日志 |
| 4 | HIGH | cost-estimator.ts | 浮点精度可产生负数成本 | Math.max(0, ...) |
| 5 | HIGH | config-loader.ts | ReDoS 检测遗漏贪婪分组 | 新增 `(.*){n}` 检测 |
| 6 | HIGH | engine.ts | 分类后无 AbortSignal 检查 | 添加检查点 |

### 15.3 未修复的可接受问题

- 熔断器状态转换无互斥锁 — Node.js 单线程无真实竞态
- `extractIntentJson()` 不处理字符串内转义 — LLM 输出极少此场景
- 配置热更新 10 秒防抖窗口 — 设计预期行为
- CJK token 估算 1.5 字/token 非模型自适应 — 用于预估非计费

---

## 16. 模型分层选择器（Model Tier Selector）

### 16.1 需求背景

Clawdbot 的各子系统（记忆提取、意图分类、摘要等）需要调用 LLM，但不一定需要用户的会话主模型：
- 记忆提取只需最便宜的模型即可
- 意图分类需要轻量快速的模型
- 复杂分析可能需要 SOTA 级模型

用户（尤其国内用户）配置的模型多种多样（qwen、kimi、minimax、deepseek 等），系统需要**全自动**地从已配置的 provider 中选择最合适的模型。

### 16.2 架构

```
用户配置的所有 Providers
    │
    ▼
┌─────────────────────────────────────────┐
│         buildModelTiers()               │
│                                         │
│  getMergedProvidersForAgent()            │
│  → 扫描所有 provider + env + auth       │
│  → 提取每个模型的 cost 数据              │
│  → 按成本分为三个层级                     │
│  → 层级内按 MODEL_QUALITY 排序           │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│      selectModelByTier(tier)            │
│                                         │
│  requested tier → 同层级候选 → 验证 key   │
│      │ (无可用模型)                      │
│      ▼                                  │
│  fallback tier → 邻近层级 → 验证 key     │
│      │ (仍无)                           │
│      ▼                                  │
│  return null                            │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│    resolveModelForTier(tier)            │
│                                         │
│  返回可直接调用的:                        │
│  { provider, modelId, model, apiKey,    │
│    tier, costPer1M }                    │
└─────────────────────────────────────────┘
```

### 16.3 核心文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `tier-selector.ts` | ~300 | 模型分层、选择、fallback 逻辑 |
| `cost-estimator.ts` | 389 | 模型定价表、成本估算（供分层参考） |

### 16.4 分层标准

基于模型的总成本（input + output per 1M tokens）自动分层：

| 层级 | 成本阈值 | 代表模型 | 典型用途 |
|------|---------|---------|---------|
| `cheap` | ≤ $2.0/1M | glm-4-flash ($0), qwen-turbo ($0.4), gpt-4o-mini ($0.75), deepseek-chat ($1.37) | 记忆提取、分类、简单任务 |
| `mid` | $2.0 ~ $20.0/1M | gpt-4o ($12.5), claude-sonnet ($18), qwen-max ($8.0) | 一般对话、摘要 |
| `sota` | > $20.0/1M | claude-opus ($90), o1 ($75), gpt-4-turbo ($40) | 复杂编码、分析、规划 |

### 16.5 质量评分（同层级排序）

同一层级内可能有多个模型。使用内置质量评分决定优先级（分数越高越优先）：

| 模型 | 质量分 | 层级 |
|------|--------|------|
| claude-opus-4-5 | 100 | sota |
| o1 | 95 | sota |
| deepseek-reasoner | 90 | sota |
| claude-sonnet-4-5 | 80 | mid |
| gpt-4o | 75 | mid |
| qwen-max | 70 | mid |
| claude-haiku-3.5 | 60 | mid |
| deepseek-chat | 50 | cheap |
| gpt-4o-mini | 40 | cheap |
| qwen-turbo | 35 | cheap |
| glm-4-flash | 30 | cheap |

未知模型默认质量分 25。支持模糊匹配（如 `claude-sonnet-4-5-20250929` 匹配 `claude-sonnet-4-5`）。

### 16.6 Fallback 机制

当请求的层级无可用模型时，自动尝试邻近层级：

```
cheap → mid → sota     （要便宜的没有，就用次贵的）
mid   → cheap → sota   （要中等的没有，先试便宜的）
sota  → mid → cheap    （要最好的没有，逐级降低）
```

每个候选模型都会验证：
1. 模型可以被 `resolveModel()` 解析
2. 有有效的 API key（通过 `getApiKeyForModel()` 验证）

### 16.7 使用方式

```typescript
import { resolveModelForTier } from "../dispatch/tier-selector.js";

// 选择最便宜的模型（用于记忆提取等低成本任务）
const cheap = await resolveModelForTier({ tier: "cheap", cfg, agentDir });
if (cheap) {
  const result = await completeSimple(cheap.model, { messages }, { apiKey: cheap.apiKey });
}

// 选择 SOTA 模型（用于复杂分析任务）
const sota = await resolveModelForTier({ tier: "sota", cfg, agentDir });

// 获取所有层级的模型列表（用于调试）
const tiers = await buildModelTiers({ cfg, agentDir });
// tiers.cheap = [{ provider, modelId, totalCostPer1M, tier }]
// tiers.mid   = [...]
// tiers.sota  = [...]
```

### 16.8 设计决策

| 决策 | 理由 |
|------|------|
| 基于成本分层而非固定模型名 | 新模型上线时自动归类，无需更新分层逻辑 |
| 质量评分用于同层级排序 | 同样便宜的模型中优先选质量最好的 |
| Fallback 到邻近层级 | 确保用户只要有任意一个 provider 就能工作 |
| 全自动零配置 | 用户是"小白"，不应要求手动配置哪个模型做什么 |
| 模型发现复用 getMergedProvidersForAgent() | 与主会话模型发现完全一致，无额外配置负担 |
| API key 验证在选择时执行 | 避免选了模型但运行时发现没 key |
| 支持国内模型 | qwen/glm/moonshot/deepseek 均内置质量评分和定价 |

### 16.9 与 Dispatch Engine 的关系

分层选择器独立于 dispatch engine，但可被 dispatch 使用：

- **Dispatch engine** 的 `suggestModel()` 基于复杂度推荐模型（已有但未投入生产）
- **Tier selector** 基于成本自动选择，已在**记忆提取**中投入使用
- 未来可将 dispatch engine 的复杂度路由与 tier selector 结合：
  - `low` 复杂度 → `resolveModelForTier("cheap")`
  - `medium` 复杂度 → `resolveModelForTier("mid")`
  - `high` 复杂度 → `resolveModelForTier("sota")`

### 16.10 公共 API

从 `src/dispatch/index.ts` 统一导出：

```typescript
export { buildModelTiers, selectModelByTier, resolveModelForTier } from "./tier-selector.js";
export type { ModelTier, TierSelection, TierSelectionResult } from "./tier-selector.js";
```

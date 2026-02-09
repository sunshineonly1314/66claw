# ClawdbotCN 智能路由 (Smart Router) 设计方案

## Context

当前 clawdbot 的模型选择是静态的 — 所有消息都走同一个模型和 thinking level。不管用户发"你好"还是发 500 行代码让 debug，用的都是同一个配置。Performance Profile (economy/balanced/power) 只调 thinking 深度，不换模型本身。

**目标**: 根据消息内容自动选择模型等级 — 简单问题用便宜快速模型，复杂任务用强模型深度推理。

**优先级链**: 用户 `/model` 指令 > 智能路由 > 免费模型 > 默认模型

---

## 方案概览

### 3 个等级

| 等级 | 场景 | 默认模型示例 | Thinking |
|------|------|-------------|----------|
| `lightweight` | 日常问答、打招呼、简单翻译 | Qwen3-8B / flash | `off` |
| `standard` | 一般任务、总结、问答 | DeepSeek-V3 | `low` |
| `advanced` | 复杂推理、写代码、数学 | DeepSeek-R1 / Opus | `medium` |

### 分类策略

启发式优先（零 token 开销），不确定时可选用小模型分类。

---

## 需要修改/新建的文件

### 新建 4 个文件

**1. `src/config/types.smart-router.ts`** — 类型定义

```typescript
import type { ThinkLevel } from "../auto-reply/thinking.js";

export type SmartRouterTierId = "lightweight" | "standard" | "advanced";

export type SmartRouterTierConfig = {
  model: string;                   // "provider/model" 引用
  thinkingDefault?: ThinkLevel;    // 该等级的 thinking level
  label?: string;                  // 日志标签
};

export type SmartRouterClassificationRules = {
  advancedPatterns?: string[];     // 正则，命中即 advanced
  lightweightPatterns?: string[];  // 正则，命中即 lightweight
  shortMessageThreshold?: number;  // 低于此字符数 → lightweight 候选 (默认 20)
  longMessageThreshold?: number;   // 高于此字符数 → advanced 候选 (默认 500)
  confidenceThreshold?: number;    // 低于此置信度 → 触发 LLM 分类 (默认 0.6)
};

export type SmartRouterLlmClassifierConfig = {
  enabled?: boolean;               // 默认 false
  model?: string;                  // 分类用的小模型
  maxTokens?: number;              // 默认 50
  timeoutMs?: number;              // 默认 3000
};

export type SmartRouterConfig = {
  enabled?: boolean;
  tiers?: {
    lightweight?: SmartRouterTierConfig;
    standard?: SmartRouterTierConfig;
    advanced?: SmartRouterTierConfig;
  };
  rules?: SmartRouterClassificationRules;
  llmClassifier?: SmartRouterLlmClassifierConfig;
  logDecisions?: boolean;          // 默认 true
};
```

**2. `src/auto-reply/reply/smart-router.ts`** — 核心编排器

```typescript
export type SmartRouterResult = {
  tier: SmartRouterTierId;
  provider: string;
  model: string;
  thinkingDefault?: ThinkLevel;
  reason: string;
  confidence: number;
  usedLlm: boolean;
};

export async function applySmartRouter(params: {
  text: string;
  mediaUrl?: string;
  mediaType?: string;
  isNewSession: boolean;
  cfg: ClawdbotConfig;
  defaultProvider: string;
  aliasIndex: ModelAliasIndex;
}): Promise<SmartRouterResult | null>;
```

逻辑:
1. 检查 `cfg.smartRouter?.enabled`
2. 调用启发式分类 → `{tier, confidence, reason}`
3. 如果 confidence < threshold 且 llmClassifier.enabled → 调 LLM 分类
4. 用 `resolveModelRefFromString()` 解析 tier 对应的模型引用
5. 返回 `SmartRouterResult`

**3. `src/auto-reply/reply/smart-router-heuristics.ts`** — 启发式分类引擎

纯函数，零 token 开销。加权评分系统:

| 信号 | 权重 | 方向 |
|------|------|------|
| 消息 < shortMessageThreshold (20字) | +0.4 | lightweight |
| 消息 > longMessageThreshold (500字) | +0.3 | advanced |
| 包含代码块 (triple backtick) | +0.5 | advanced |
| 编程关键词 (`function`, `class`, `import`, `def`, `SELECT`) | +0.3 | advanced |
| 中文代码请求 (`写代码`, `调试`, `报错`, `bug`) | +0.4 | advanced |
| 推理关键词 (`为什么`, `分析`, `设计方案`, `优化`) | +0.3 | advanced |
| 数学指标 (`求解`, `计算`, `公式`, 方程模式) | +0.3 | advanced |
| 问候语 (`你好`, `hi`, `hello`, `嗨`) | +0.5 | lightweight |
| 确认语 (`好的`, `谢谢`, `收到`, `OK`) | +0.5 | lightweight |
| 短问句 (< 50字 + `?`/`？`) | +0.3 | lightweight |
| 有图片/视频附件 | +0.2 | advanced |
| 新会话 + 短消息 | +0.2 | lightweight |
| 用户自定义 advancedPatterns 命中 | +0.6 | advanced |
| 用户自定义 lightweightPatterns 命中 | +0.6 | lightweight |

决策逻辑:
- advancedScore > lightweightScore 且 >= 0.5 → `advanced`
- lightweightScore > advancedScore 且 >= 0.4 → `lightweight`
- 其他 → `standard` (默认兜底)

**4. `src/auto-reply/reply/smart-router-llm.ts`** — 可选 LLM 分类器

仅在启发式不确定时触发，用极低成本的小模型做分类:

```
Classify this message into exactly one category. Reply with only the category name.
Categories:
- lightweight: greetings, simple questions, acknowledgments
- standard: general questions, moderate tasks, summaries
- advanced: coding, debugging, complex reasoning, math, architecture design

Message: """{text truncated to 500 chars}"""
Category:
```

- 输入 ~250 tokens，输出 ~5 tokens
- timeout 3 秒，失败回退到 standard
- 默认关闭 (`llmClassifier.enabled: false`)

### 修改 4 个现有文件

**5. `src/config/types.clawdbot.ts`** — 加 2 行

```diff
+import type { SmartRouterConfig } from "./types.smart-router.js";

 export type ClawdbotConfig = {
   // ...existing fields...
   license?: LicenseConfig;
+  /** ClawdbotCN 智能路由 */
+  smartRouter?: SmartRouterConfig;
   credentials?: Record<string, string>;
 };
```

**6. `src/config/zod-schema.ts`** — 在 freeModels schema (L556-600) 之后加 smartRouter schema

```typescript
// ClawdbotCN 智能路由
smartRouter: z
  .object({
    enabled: z.boolean().optional(),
    tiers: z.object({
      lightweight: z.object({
        model: z.string(),
        thinkingDefault: z.enum(["off","minimal","low","medium","high","xhigh"]).optional(),
        label: z.string().optional(),
      }).strict().optional(),
      standard: z.object({ /* 同上 */ }).strict().optional(),
      advanced: z.object({ /* 同上 */ }).strict().optional(),
    }).strict().optional(),
    rules: z.object({
      advancedPatterns: z.array(z.string()).optional(),
      lightweightPatterns: z.array(z.string()).optional(),
      shortMessageThreshold: z.number().int().positive().optional(),
      longMessageThreshold: z.number().int().positive().optional(),
      confidenceThreshold: z.number().min(0).max(1).optional(),
    }).strict().optional(),
    llmClassifier: z.object({
      enabled: z.boolean().optional(),
      model: z.string().optional(),
      maxTokens: z.number().int().positive().optional(),
      timeoutMs: z.number().int().positive().optional(),
    }).strict().optional(),
    logDecisions: z.boolean().optional(),
  })
  .strict()
  .optional(),
```

**7. `src/config/defaults.ts`** — 在 `applyCnDefaults()` 末尾加 smart router 默认值

默认 `enabled: false`，用户在 YAML 里显式启用。不在 CN defaults 里自动开启，避免意外。

**8. `src/auto-reply/reply/get-reply.ts`** — 主插入点

在 **L254（`model = resolvedModel`）之后、L256（免费模型块）之前** 插入:

```typescript
// ========================================
// ClawdbotCN 专属功能：智能路由 (Smart Router)
// ========================================
let smartRouterApplied = false;
let smartRouterThinkOverride: ThinkLevel | undefined;

if (!opts?.isHeartbeat && !directives.hasModelDirective && cfg.smartRouter?.enabled) {
  try {
    const routingResult = await applySmartRouter({
      text: cleanedBody,
      mediaUrl: ctx.MediaUrl,
      mediaType: ctx.MediaType,
      isNewSession,
      cfg,
      defaultProvider,
      aliasIndex,
    });
    if (routingResult) {
      provider = routingResult.provider;
      model = routingResult.model;
      smartRouterApplied = true;
      smartRouterThinkOverride = routingResult.thinkingDefault;
      defaultRuntime.log(
        `[SmartRouter] tier=${routingResult.tier} model=${provider}/${model} ` +
        `think=${routingResult.thinkingDefault ?? "default"} reason=${routingResult.reason}`
      );
    }
  } catch (err) {
    defaultRuntime.log(`[SmartRouter] 分类失败，使用默认模型: ${err}`);
  }
}

// Smart router thinking level 覆盖（用户 /think 指令仍然最优先）
if (smartRouterThinkOverride && !directives.hasThinkDirective) {
  resolvedThinkLevel = smartRouterThinkOverride;
}
```

免费模型块 L268 条件加一个 `!smartRouterApplied`:

```diff
-if (!userSpecifiedModelInThisMessage && freeModelProvider && freeModelName && freeModelCfg) {
+if (!userSpecifiedModelInThisMessage && !smartRouterApplied && freeModelProvider && freeModelName && freeModelCfg) {
```

---

## 配置示例 (YAML)

```yaml
smartRouter:
  enabled: true
  tiers:
    lightweight:
      model: "siliconflow/Qwen/Qwen3-8B"
      thinkingDefault: "off"
      label: "日常问答"
    standard:
      model: "siliconflow/deepseek-ai/DeepSeek-V3"
      thinkingDefault: "low"
      label: "一般任务"
    advanced:
      model: "siliconflow/Pro/deepseek-ai/DeepSeek-R1"
      thinkingDefault: "medium"
      label: "复杂推理/代码"
  rules:
    shortMessageThreshold: 20
    longMessageThreshold: 500
    advancedPatterns:
      - "写.*(代码|程序|脚本|函数)"
      - "debug|调试|排错|报错"
      - "分析.*原因|设计.*架构|重构"
    lightweightPatterns:
      - "^(你好|hi|hello|嗨|在吗)"
      - "^(谢谢|好的|收到|OK)"
  llmClassifier:
    enabled: false
  logDecisions: true
```

---

## Thinking Level 优先级

```
用户 /think 指令 > Smart Router tier.thinkingDefault > session 存储的 level > config thinkingDefault > performance profile
```

Smart Router 按消息级别覆盖，不持久化到 session。

---

## 测试计划

### 新建测试文件
- `src/auto-reply/reply/smart-router-heuristics.test.ts` — 启发式分类单测
- `src/auto-reply/reply/smart-router.test.ts` — 集成测试

### 关键测试用例
1. "你好" → lightweight
2. "帮我写一个排序算法" → advanced
3. "总结一下这篇文章" → standard
4. 包含 ``` 代码块的消息 → advanced
5. 短消息 "OK" → lightweight
6. 用户自定义 pattern 命中测试
7. `enabled: false` 时返回 null（不干预）
8. 用户 `/model` 指令时跳过路由
9. LLM 分类器超时回退到 standard

### 运行验证
```bash
npx vitest run src/auto-reply/reply/smart-router-heuristics.test.ts
npx vitest run src/auto-reply/reply/smart-router.test.ts
npx tsc --noEmit  # 类型检查
```

---

## 文件变更汇总

| 文件 | 操作 | 改动量 |
|------|------|--------|
| `src/config/types.smart-router.ts` | 新建 | ~50 行 |
| `src/auto-reply/reply/smart-router.ts` | 新建 | ~80 行 |
| `src/auto-reply/reply/smart-router-heuristics.ts` | 新建 | ~150 行 |
| `src/auto-reply/reply/smart-router-llm.ts` | 新建 | ~60 行 |
| `src/config/types.clawdbot.ts` | 修改 | +3 行 |
| `src/config/zod-schema.ts` | 修改 | +30 行 |
| `src/config/defaults.ts` | 修改 | +10 行 |
| `src/auto-reply/reply/get-reply.ts` | 修改 | +25 行, 改 1 行 |
| `src/auto-reply/reply/smart-router-heuristics.test.ts` | 新建 | ~100 行 |
| `src/auto-reply/reply/smart-router.test.ts` | 新建 | ~80 行 |

### 复用的现有函数
- `resolveModelRefFromString()` — `src/agents/model-selection.ts` (解析 model 引用)
- `detectChinaRegion()` — `src/config/region-cn.ts` (CN 区域检测)
- `defaultRuntime.log()` — `src/runtime.ts` (日志)
- `ModelAliasIndex` / `buildModelAliasIndex()` — `src/agents/model-selection.ts` (别名索引)

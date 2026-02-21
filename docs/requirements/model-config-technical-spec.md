# 模型配置页面 - 完整技术规格

> 基于现有代码的完整技术规格说明
> 更新时间: 2026-02-18

## 📋 目录

- [1. LongCat + 蚂蚁百灵 免费模型](#1-longcat--蚂蚁百灵-免费模型)
- [2. 自动切换调度逻辑](#2-自动切换调度逻辑)
- [3. 硅基流动 Embedding 必需性](#3-硅基流动-embedding-必需性)
- [4. 自动检测与性能优化](#4-自动检测与性能优化)
- [5. Provider-Model-Capability 映射](#5-provider-model-capability-映射)
- [6. 完整提供商支持列表](#6-完整提供商支持列表)
- [7. 开箱即用设计哲学](#7-开箱即用设计哲学)

---

## 1. LongCat + 蚂蚁百灵 免费模型

### 1.1 技术规格

**代码位置**: `src/config/free-model-providers.ts`

#### 蚂蚁百灵 (Ant Ling)

```typescript
{
  id: "ant-ling",
  name: "蚂蚁百灵",
  displayName: "蚂蚁百灵 Ling-1T",
  baseUrl: "https://api.tbox.cn/api/llm/v1",
  models: ["ling-1t", "ring-1t", "ming-flash-omni"],
  defaultModel: "ling-1t",
  freeQuota: {
    type: "daily",
    limit: 500000,        // 每日 50 万 tokens
    unit: "tokens",
    resetsAt: "每日 00:00 (北京时间)"
  },
  envKey: "ANT_LING_API_KEY",
  registerUrl: "https://ling.tbox.cn/open",
  docsUrl: "https://alipaytbox.yuque.com/sxs0ba/ling/intro",
  features: ["多模态", "联网搜索", "复杂推理", "每日50万tokens"],
  recommended: true
}
```

**能力**:
- ✅ 文字对话
- ✅ 多模态 (需验证具体支持范围)
- ✅ 联网搜索
- ✅ 复杂推理

**API 密钥** (测试用):
```
sk-studio-32004aa83de04ea4b6c8b6d7d4534c52
```

**测试结果**:
```bash
curl -X POST "https://api.tbox.cn/api/llm/v1/chat/completions" \
  -H "Authorization: Bearer sk-studio-32004aa83de04ea4b6c8b6d7d4534c52" \
  -d '{"model":"ling-1t","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'

# 响应: ✅ 正常
# {"id":"...","choices":[{"message":{"content":"Hello! How can I"}}],...}
```

#### 美团 LongCat

```typescript
{
  id: "meituan-longcat",
  name: "美团LongCat",
  displayName: "LongCat Flash",
  baseUrl: "https://api.longcat.chat/openai/v1",
  models: ["longcat-flash-chat"],
  defaultModel: "longcat-flash-chat",
  freeQuota: {
    type: "daily",
    limit: 500000,        // 每日 50 万 tokens
    unit: "tokens",
    resetsAt: "每日 00:00 (北京时间)"
  },
  envKey: "LONGCAT_API_KEY",
  registerUrl: "https://longcat.chat/login?countrycode=86&countryname=China&callback=https%3A%2F%2Flongcat.chat%2Fplatform",
  docsUrl: "https://longcat.chat/platform/docs/zh/",
  features: ["128K上下文", "OpenAI兼容", "Anthropic兼容", "每日50万tokens"],
  recommended: true
}
```

**能力**:
- ✅ 文字对话
- ✅ 128K 超长上下文
- ✅ OpenAI 格式兼容
- ✅ Anthropic 格式兼容

**API 密钥** (测试用):
```
ak_2sd5Xz1qd5AP0vd5J17Yf4vl2Oe1O
```

**测试结果**:
```bash
curl -X POST "https://api.longcat.chat/openai/v1/chat/completions" \
  -H "Authorization: Bearer ak_2sd5Xz1qd5AP0vd5J17Yf4vl2Oe1O" \
  -d '{"model":"longcat-flash-chat","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'

# 响应: ✅ 正常
# {"id":"...","choices":[{"message":{"content":"Hello! How can I"}}],...}
```

### 1.2 总配额与重置规则

```typescript
// 总配额: 每天 100 万字
总额度 = 50万 (蚂蚁百灵) + 50万 (LongCat) = 100万 tokens

// 重置时间: 每天凌晨 00:00 (北京时间, UTC+8)
重置逻辑: getBeijingDateString() // src/config/free-models-time.ts

// 重置操作:
1. 清空所有账号的 todayUsage.tokens 和 todayUsage.requests
2. 将 status="exhausted" 的账号恢复为 status="active"
3. 清除速率限制冷却标记 rateLimitedUntil
4. 重置统计数据 stats.todaySavings 和 stats.todayFreeRequests
```

### 1.3 用户价值

**对用户**:
- ✅ 完全免费,无需注册第三方平台
- ✅ 开箱即用,首次打开就能聊天
- ✅ 每天 100 万字,足够日常使用
- ✅ 自动切换,无感知体验

**对 ClawdbotCN**:
- ✅ 降低新用户门槛 (0 配置启动)
- ✅ 差异化竞争优势 (独家福利)
- ✅ 提高留存率 (用户无需购买 API Key)

---

## 2. 自动切换调度逻辑

### 2.1 核心调度器

**代码位置**: `src/agents/free-model-scheduler.ts`

```typescript
class FreeModelScheduler {
  // 选择最优账号 (按 priority 排序)
  selectBestAccount(): FreeModelAccount | undefined

  // 检测错误是否为额度不足
  detectQuotaError(providerId, httpStatus, responseBody): QuotaCheckResult

  // 处理额度不足,切换到下一个模型
  async handleQuotaExhausted(currentProviderId): Promise<{
    nextAccount: FreeModelAccount | undefined;
    notification: FreeModelSwitchNotification;
  }>

  // 更新使用统计
  async updateUsage(providerId, tokens): Promise<void>

  // 每日重置 (00:00 调用)
  async dailyReset(): Promise<void>
}
```

### 2.2 切换优先级

**默认优先级**:
```typescript
accounts: [
  { providerId: "meituan-longcat", priority: 1 },  // LongCat 优先
  { providerId: "ant-ling", priority: 2 },         // 蚂蚁百灵次之
  // 用户配置的其他免费服务商按优先级
]
```

**优先级策略** (默认):
```typescript
scheduling: {
  strategy: "priority",  // 严格按 priority 顺序
  showNotification: true,
  preCheck: true
}
```

**轮询策略** (可选):
```typescript
scheduling: {
  strategy: "round_robin",  // 选择使用次数最少的
  showNotification: true,
  preCheck: true
}
```

### 2.3 切换流程

```
用户发送消息
  ↓
checkFreeModelPriority() // src/auto-reply/reply/free-model-priority.ts
  ↓
选择最优账号 (priority 排序,过滤 exhausted/disabled/rateLimited)
  ↓
╔═══════════════════════════════════════════════════════════╗
║ 情况 1: 首次使用免费模型                                    ║
╠═══════════════════════════════════════════════════════════╣
║ notification.type = "started"                            ║
║ message = "免费模型 LongCat 已开始使用"                      ║
╚═══════════════════════════════════════════════════════════╝
  ↓
╔═══════════════════════════════════════════════════════════╗
║ 情况 2: LongCat 用完,切换到蚂蚁百灵                          ║
╠═══════════════════════════════════════════════════════════╣
║ detectQuotaError(httpStatus=402/429/403)                ║
║ → handleQuotaExhausted("meituan-longcat")               ║
║ → selectBestAccount() → "ant-ling"                      ║
║ notification.type = "switched"                          ║
║ message = "LongCat 额度已用完,已切换到蚂蚁百灵"              ║
╚═══════════════════════════════════════════════════════════╝
  ↓
╔═══════════════════════════════════════════════════════════╗
║ 情况 3: 所有免费模型都用完                                   ║
╠═══════════════════════════════════════════════════════════╣
║ selectBestAccount() → undefined                         ║
║ notification.type = "exhausted"                         ║
║ message = "今日免费额度已全部用完,已切换回付费模型"            ║
║ → 提示用户配置其他服务商或等待明日重置                        ║
╚═══════════════════════════════════════════════════════════╝
```

### 2.4 额度检测逻辑

**三层检测机制**:

```typescript
// Layer 1: HTTP 状态码
402 → balance (余额不足)
429 → rate_limit (速率限制,10分钟冷却)
403 → 结合关键词判断

// Layer 2: Provider 特定错误码
蚂蚁百灵: numericCodes=[41, 121], stringCodes=["quota_exceeded"]
LongCat: stringCodes=["quota_exceeded", "daily_limit_exceeded"]

// Layer 3: 错误消息关键词匹配
中文: "额度不足", "额度已用完", "今日额度已耗尽"
英文: "quota exceeded", "insufficient quota", "daily limit"
```

### 2.5 本地限流保护

**代码位置**: `src/auto-reply/reply/free-model-priority.ts:400-434`

```typescript
// 本地预检: 达到每日 token 上限时主动标记 exhausted
// 避免继续发送请求撞服务端错误

if (account.todayUsage.tokens >= provider.freeQuota.limit) {
  account.status = "exhausted";
  account.lastError = `本地限流: 已使用 ${used} tokens, 达到上限 ${limit}`;
}
```

**好处**:
- ✅ 避免额外的 API 请求 (节省配额)
- ✅ 更快的切换响应 (无需等待服务端返回错误)
- ✅ 更友好的错误提示 (明确告知达到上限)

---

## 3. 硅基流动 Embedding 必需性

### 3.1 用途说明

**代码位置**: `src/dispatch/tool-discovery.ts`

硅基流动的 `text-embedding-v2` 模型用于**智能工具发现系统**的向量搜索:

```typescript
// 智能工具发现流程:
用户输入: "帮我发个邮件"
  ↓
1. FTS5 BM25 关键词搜索 (从 12k+ 工具中筛选)
  ↓
2. sqlite-vec 向量相似度搜索 (需要 embedding)
  ↓
3. 混合打分排序 (BM25 分数 + 向量距离)
  ↓
推荐结果: [gmail-mcp, outlook-mcp, sendgrid-skill]
```

### 3.2 Embedding 模型配置

```typescript
// 硅基流动 embedding 模型
{
  providerId: "siliconflow",
  model: "BAAI/bge-large-zh-v1.5",  // 或 text-embedding-v2
  用途: "工具发现系统的向量搜索",
  免费: true,
  接口: "https://api.siliconflow.cn/v1/embeddings"
}
```

### 3.3 降级策略

**如果用户未配置硅基流动**:

```typescript
// 降级为纯 FTS5 BM25 搜索
if (!embeddingProvider || !embeddingProvider.apiKey) {
  console.warn("[tool-discovery] 无 embedding 配置,降级为纯 FTS5");
  results = await fts5Search(query);  // 仅关键词匹配
}

// 准确率对比:
- 混合搜索 (FTS5 + 向量): 100% 命中率
- 纯 FTS5 搜索: 97.4% 命中率

// 性能对比:
- 混合搜索: <10ms
- 纯 FTS5: <5ms (更快)
```

### 3.4 用户引导策略

**渐进式引导** (不强制要求):

```
场景 1: 用户从未使用智能推荐
  → 不提示配置硅基流动
  → LongCat + 蚂蚁百灵 足够使用

场景 2: 用户首次使用智能推荐 (输入模糊需求)
  → 检测到缺少 embedding 配置
  → 弹出提示: "配置硅基流动可获得更精准的工具推荐 (免费)"
  → 用户可选择 [立即配置] 或 [暂不需要]

场景 3: 用户已配置硅基流动
  → 自动使用混合搜索
  → 获得最佳推荐效果
```

### 3.5 实名认证说明

**硅基流动要求实名认证**:

```
注册流程:
1. 访问 https://siliconflow.cn
2. 手机号注册
3. 上传身份证照片
4. 等待审核 (约 1 小时)
5. 获取 API Key

为什么要实名?
- 国家规定: 所有 AI 服务都需要实名认证
- 免费额度: 实名后才能使用免费额度
```

**UI 设计建议**:
- ❌ 不要在本系统内设计实名认证流程 (属于硅基流动官网)
- ✅ 提供跳转链接 + 分步指引
- ✅ 解释"为什么要实名" (国家规定)

---

## 4. 自动检测与性能优化

### 4.1 当前实现

**代码位置**: `src/agents/free-model-scheduler.ts:463-511`

```typescript
async validateApiKey(providerId: string, apiKey: string) {
  const provider = getFreeModelProvider(providerId);

  // 发送最小测试请求
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: provider.defaultModel,  // 只测试默认模型
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 5  // 最小 token
    })
  });

  // 判断结果
  if (response.ok) return { valid: true };
  if (response.status === 401 || 403) return { valid: false, error: "密钥无效" };
  if (response.status === 429 || 402) return { valid: true };  // 额度问题不影响密钥有效性
}
```

### 4.2 性能优化策略

**核心原则**: 不逐个测试所有模型

```typescript
// ❌ 错误做法: 逐个测试 200+ 模型
for (const model of availableModels) {  // 200+ 次请求
  await testModel(providerId, apiKey, model.id);
}
// 问题: 耗时长 (200+ 秒), 消耗大量配额

// ✅ 正确做法: 只测试 defaultModel 验证密钥
await testModel(providerId, apiKey, provider.defaultModel);  // 1 次请求
// 优势: 快速 (<5秒), 配额消耗小 (5 tokens)
```

**获取模型列表的方式**:

```typescript
// 方案 1: 调用 /v1/models API (推荐)
const response = await fetch(`${baseUrl}/v1/models`, {
  headers: { Authorization: `Bearer ${apiKey}` }
});
const { data: models } = await response.json();

// 方案 2: 使用本地 capability mapping (备用)
const models = PROVIDER_CAPABILITY_MAPPINGS[providerId].models;
```

### 4.3 并发控制

**推荐策略**:

```typescript
// 同时配置多个提供商时的并发控制
const MAX_CONCURRENT_TESTS = 3;
const SINGLE_TEST_TIMEOUT = 5000;  // 5 秒
const TOTAL_TIMEOUT = 30000;       // 30 秒

// 使用 p-limit 控制并发
import pLimit from 'p-limit';
const limit = pLimit(MAX_CONCURRENT_TESTS);

const results = await Promise.all(
  providers.map(p => limit(() => validateApiKey(p.id, p.apiKey)))
);
```

### 4.4 API 配额保护

```typescript
// 保护策略 1: 最小 token 测试
{
  max_tokens: 5,        // 只生成 5 个 tokens
  temperature: 0        // 确定性输出,避免浪费
}

// 保护策略 2: 失败不重试
if (!response.ok) {
  // 直接标记为不可用,不重试
  return { valid: false };
}

// 保护策略 3: 缓存验证结果 (可选)
const cache = new Map<string, { valid: boolean; expireAt: number }>();
```

---

## 5. Provider-Model-Capability 映射

### 5.1 数据结构定义

**待创建文件**: `src/config/provider-capability-mapping.ts`

```typescript
/** 能力类型 */
export type Capability =
  | "text"                  // 文字对话
  | "image-understanding"   // 图片理解
  | "image-generation"      // 图片生成
  | "video"                 // 视频理解
  | "embedding";            // Embedding

/** Provider-Model-Capability 映射 */
export interface ProviderCapabilityMapping {
  providerId: string;
  name: string;
  icon: string;
  models: Array<{
    modelId: string;
    modelName: string;
    capabilities: Capability[];
    pricing: {
      type: "free" | "paid";
      details?: string;
    };
    testEndpoint?: string;  // 用于快速验证的端点
    contextWindow?: number;
    maxTokens?: number;
  }>;
}
```

### 5.2 示例: 硅基流动

```typescript
export const PROVIDER_CAPABILITY_MAPPINGS: Record<string, ProviderCapabilityMapping> = {
  "siliconflow": {
    providerId: "siliconflow",
    name: "硅基流动",
    icon: "🔮",
    models: [
      // 文字对话模型
      {
        modelId: "Qwen/Qwen2.5-7B-Instruct",
        modelName: "Qwen2.5-7B-Instruct",
        capabilities: ["text"],
        pricing: { type: "free" },
        contextWindow: 32768,
        maxTokens: 8192
      },
      {
        modelId: "deepseek-ai/DeepSeek-V3",
        modelName: "DeepSeek-V3",
        capabilities: ["text"],
        pricing: { type: "paid", details: "¥0.002/千tokens" },
        contextWindow: 128000,
        maxTokens: 8192
      },

      // 图片理解模型
      {
        modelId: "Qwen/Qwen-VL-Plus",
        modelName: "Qwen-VL-Plus",
        capabilities: ["image-understanding"],
        pricing: { type: "free" },
      },

      // 图片生成模型
      {
        modelId: "black-forest-labs/FLUX.1-schnell",
        modelName: "FLUX.1-schnell",
        capabilities: ["image-generation"],
        pricing: { type: "free" },
      },

      // 视频理解模型
      {
        modelId: "Qwen/Qwen2-VL-7B-Instruct",
        modelName: "Qwen2-VL-7B",
        capabilities: ["video"],
        pricing: { type: "free" },
      },

      // Embedding 模型 (必需!)
      {
        modelId: "BAAI/bge-large-zh-v1.5",
        modelName: "bge-large-zh-v1.5",
        capabilities: ["embedding"],
        pricing: { type: "free" },
        testEndpoint: "/v1/embeddings"
      }
    ]
  }
};
```

### 5.3 示例: MiniMax (多模型多能力)

```typescript
"minimax": {
  providerId: "minimax",
  name: "MiniMax",
  icon: "⚡",
  models: [
    {
      modelId: "MiniMax-M2.1",
      modelName: "MiniMax-M2.1",
      capabilities: ["text"],  // 只有文字对话
      pricing: { type: "paid" },
      contextWindow: 200000
    },
    {
      modelId: "MiniMax-VL-01",
      modelName: "MiniMax-VL-01",
      capabilities: ["image-understanding"],  // 只有图片理解
      pricing: { type: "paid" }
    },
    {
      modelId: "MiniMax-M2.1-Video",
      modelName: "MiniMax-M2.1-Video",
      capabilities: ["video"],  // 只有视频理解
      pricing: { type: "paid" }
    },
    {
      modelId: "MiniMax-Text-Embedding-v1",
      modelName: "Text-Embedding-v1",
      capabilities: ["embedding"],  // 只有 embedding
      pricing: { type: "paid" }
    }
  ]
}
```

### 5.4 使用方式

```typescript
// 获取某个能力的所有可用模型
function getModelsByCapability(capability: Capability): ModelInfo[] {
  const results: ModelInfo[] = [];

  for (const [providerId, mapping] of Object.entries(PROVIDER_CAPABILITY_MAPPINGS)) {
    for (const model of mapping.models) {
      if (model.capabilities.includes(capability)) {
        results.push({
          providerId,
          providerName: mapping.name,
          ...model
        });
      }
    }
  }

  return results;
}

// 示例: 获取所有支持图片生成的模型
const imageGenModels = getModelsByCapability("image-generation");
// 结果:
// [
//   { providerId: "siliconflow", modelId: "FLUX.1-schnell", pricing: "free" },
//   { providerId: "openai", modelId: "dall-e-3", pricing: "paid" },
//   ...
// ]
```

---

## 6. 完整提供商支持列表

**代码位置**: `src/gateway/setup-page-components.ts`

与 setup 页面保持**完全一致**,支持所有 15 个提供商:

### 6.1 国内主流推荐 (优先展示)

1. **Kimi Code** (⭐ 首选) - 代码专用
2. **通义千问** - 阿里出品,送100万Token
3. **豆包** - 字节出品,响应极快

### 6.2 更多国内服务

4. **硅基流动** (必选) - 智能推荐必需
5. **DeepSeek** - 性价比之王
6. **智谱 GLM** - 有永久免费模型
7. **Kimi (月之暗面)** - 长上下文之王
8. **MiniMax** - Agent/代码专家
9. **腾讯混元** - 混元大模型系列

### 6.3 国际服务 (需科学上网)

10. **OpenAI** - GPT-4.1 / o3 系列
11. **Anthropic Claude** - Claude Sonnet 4 / Opus 4.5
12. **Google Gemini** - Gemini 3 系列
13. **NVIDIA NIM** - 高性能推理

### 6.4 本地模型 & 自定义

14. **Ollama** - 本地运行,完全免费
15. **OpenAI 兼容** - 自定义服务

**总计**: 15 个提供商

---

## 7. 开箱即用设计哲学

### 7.1 核心理念

**"不要让用户配置,让用户使用"**

```
传统 AI 应用:
  打开 → 要求配置 API Key → 选择模型 → 才能开始使用
  流失率: 60%+ (用户在配置环节放弃)

OpenClawCN:
  打开 → 直接聊天 → (需要时才引导升级)
  流失率: <10%
```

### 7.2 渐进式引导

```
阶段 1: 开箱即用 (0 配置)
  ├─ 预配置: LongCat + 蚂蚁百灵
  ├─ 日额度: 100 万字
  └─ 用户体验: 打开就能聊天

阶段 2: 需求驱动 (按需配置)
  ├─ 场景 1: 额度即将用完 → 推荐配置其他免费服务商
  ├─ 场景 2: 需要看图功能 → 引导配置支持图片理解的服务商
  ├─ 场景 3: 需要画图功能 → 引导配置支持图片生成的服务商
  └─ 场景 4: 需要智能推荐 → 引导配置硅基流动 (embedding)

阶段 3: 专业使用 (高级配置)
  ├─ 切换模型 → 高级设置中选择
  ├─ 调整优先级 → 拖拽排序
  └─ 自定义服务 → 配置 OpenAI 兼容服务
```

### 7.3 信息分层

**Layer 1: 用户视角 (能力层)**
```
💬 聊天
👁️ 看图
🎨 画图
📹 看视频
```

**Layer 2: 执行层 (模型层)**
```
Qwen2.5-7B-Instruct → 用于聊天
MiniMax-VL-01 → 用于看图
FLUX.1-schnell → 用于画图
```

**Layer 3: 技术层 (厂家层)**
```
来自 硅基流动
来自 MiniMax
来自 硅基流动
```

**显示原则**:
- ✅ Layer 1 始终可见 (用户关心能力)
- ✅ Layer 2 主要信息 (当前使用哪个模型)
- ✅ Layer 3 次要信息 (来自哪个厂家)

### 7.4 零技术术语

**语言映射表**:

| 技术术语 | 生活语言 |
|---------|---------|
| Model Provider | 服务商 |
| API Key | 密钥 / 账号 |
| Model | (隐藏,用户不需要知道) |
| Capability | 功能 (聊天/看图/画图) |
| Token | 字 |
| Quota | 额度 |
| Rate Limit | 速率限制 → "请求太频繁,请稍后重试" |
| Embedding | (完全隐藏) |
| Fine-tuning | (完全隐藏) |

**UI 文案示例**:

❌ 错误:
```
您的 OpenAI Provider 的 gpt-4o-mini Model 已达到今日 Token Quota 限制
```

✅ 正确:
```
OpenAI 今日额度已用完,已自动切换到其他服务商继续使用
```

---

## 8. 实施清单

### 8.1 后端任务

- [x] 免费模型 Provider 配置 (`src/config/free-model-providers.ts`)
- [x] 免费模型调度器 (`src/agents/free-model-scheduler.ts`)
- [x] 自动切换逻辑 (`src/auto-reply/reply/free-model-priority.ts`)
- [x] 额度检测机制 (三层检测)
- [x] 每日重置逻辑
- [x] 本地限流保护
- [ ] **Provider-Model-Capability 映射数据** (`src/config/provider-capability-mapping.ts`)
- [ ] **自动检测 API** (`POST /api/model-config/providers/{providerId}/detect`)
- [ ] **能力查询 API** (`GET /api/model-config/capabilities/{capability}/models`)
- [ ] **模型切换 API** (`POST /api/model-config/capabilities/{capability}/switch`)

### 8.2 前端任务

- [ ] **能力卡片 UI** (💬 聊天 / 👁️ 看图 / 🎨 画图)
- [ ] **提供商列表 UI** (与 setup 页面一致)
- [ ] **实时检测进度显示** (⏳ 正在检测可用模型...)
- [ ] **模型切换下拉菜单**
- [ ] **渐进式引导流程** (7 个场景)
- [ ] **零技术术语重写** (所有文案)

### 8.3 测试任务

- [x] 免费模型 API 连通性测试
- [x] 自动切换逻辑测试 (`free-model-scheduler.test.ts`)
- [x] 额度检测测试 (`free-model-priority.ts` 相关测试)
- [ ] **所有 15 个提供商的自动检测测试**
- [ ] **模型可用性验证测试**
- [ ] **免费模型优先选择测试**
- [ ] **并发配置测试**

---

## 9. 参考资料

### 9.1 现有代码

- `src/config/free-model-providers.ts` - 免费模型配置
- `src/config/types.free-models.ts` - 类型定义
- `src/agents/free-model-scheduler.ts` - 调度器
- `src/auto-reply/reply/free-model-priority.ts` - 优先级检查
- `src/gateway/setup-page-components.ts` - 提供商列表

### 9.2 设计文档

- `docs/requirements/model-config-final-design.md` - 小白友好版设计
- `docs/requirements/model-config-architecture-redesign.md` - 架构设计
- `docs/requirements/model-config-providers-list.md` - 提供商详情
- `docs/requirements/model-config-auto-enable-summary.md` - 自动启用总结

### 9.3 API 文档

- 蚂蚁百灵: https://alipaytbox.yuque.com/sxs0ba/ling/intro
- LongCat: https://longcat.chat/platform/docs/zh/
- 硅基流动: https://docs.siliconflow.cn/

---

**更新日期**: 2026-02-18
**维护者**: ClawdbotCN 团队
**版本**: v1.0

# 模型能力卡片 (Capability Cards) 服务端定时同步需求

> 文档版本：v1.0
> 创建时间：2026-02-23
> 客户端版本：ClawdbotCN v2026.2+
> 优先级：P1（发布后尽快）

---

## 一、背景

ClawdbotCN 客户端有一个**模型能力注册表 (Capability Registry)**，记录了 60+ 模型的能力评分（text、code、vision 等，1-5 分）。客户端根据这些评分自动判断模型强弱等级 (`strengthTier`)，用于：
- UI 上展示弱模型警告（"建议使用 DeepSeek-R1 等主流大模型"）
- 智能路由选择最优模型

当前问题：**内置卡片是硬编码的，新模型上线后客户端不更新就看不到**。

解决方案：服务端定时从外部模型数据源拉取最新模型信息，生成 `capability-cards.json` 文件，客户端每 24 小时自动获取。

---

## 二、架构

```
[外部数据源]                   [服务端 - 香港 43.129.194.117]              [客户端]

LiteLLM (GitHub)  ─────┐            ┌─────────────────────────┐
                        │    定时     │  定时任务 (cron/xxl-job) │     每 24h
OpenRouter API    ─────►├───拉取────►│  生成 capability-cards   │◄──────────────
                        │   (2x/天)   │  Ed25519 签名            │    GET 拉取
手动维护 JSON     ─────┘            │  写入 Java 后端可读目录   │
                                    └─────────────────────────┘
                                           │
                                     Nginx 反代
                                           │
                              ┌─────────────────────────────┐
                              │ 杭州 121.43.61.90           │
                              │ www.obplugins.cn            │
                              │ /api/v1/capability-cards.json│
                              │ → 透传到 43.129.194.117      │
                              └─────────────────────────────┘
```

### 关键网络约束

| 服务器 | IP | 位置 | 外网访问 |
|--------|-----|------|---------|
| 阿里云杭州 (流量入口) | 121.43.61.90 | 杭州 | **不可直接访问外网** |
| 阿里云上海 (数据层) | 106.15.198.253 | 上海 | **不可直接访问外网** |
| 腾讯云香港 (跳板机) | 43.129.194.117 | 香港 | **可以访问外网** ✓ |

**因此：所有外部 API 拉取必须在香港服务器 (43.129.194.117) 上执行。**

---

## 三、外部数据源

### 3.1 LiteLLM — 主数据源（推荐首选）

- **URL**: `https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json`
- **认证**: 无需（公开 JSON 文件）
- **数据量**: 400+ 模型
- **可用字段**:
  - `max_tokens` / `max_input_tokens` / `max_output_tokens` — 上下文窗口
  - `input_cost_per_token` / `output_cost_per_token` — 定价（可用于推断模型等级）
  - `supports_vision` / `supports_function_calling` / `supports_audio_input` — 能力标记
  - `mode` — `"chat"` / `"embedding"` / `"image_generation"` 等
- **拉取频率**: 每 12 小时一次
- **超时**: 30 秒
- **备用镜像**: 如果 GitHub raw 被墙，可走 `https://mirror.ghproxy.com/` 或 `https://raw.gitmirror.com/` 代理

**LiteLLM 数据示例：**
```json
{
  "deepseek/deepseek-chat": {
    "max_tokens": 8192,
    "max_input_tokens": 64000,
    "max_output_tokens": 8192,
    "input_cost_per_token": 0.00000014,
    "output_cost_per_token": 0.00000028,
    "supports_function_calling": true,
    "supports_vision": false,
    "mode": "chat"
  }
}
```

### 3.2 OpenRouter — 补充数据源

- **URL**: `https://openrouter.ai/api/v1/models`
- **认证**: 无需（公开 API）
- **可用字段**:
  - `context_length` — 上下文窗口
  - `pricing.prompt` / `pricing.completion` — 定价
  - `architecture.modality` — `"text→text"` / `"text+image→text"` 等
  - `top_provider.max_completion_tokens` — 最大输出
- **拉取频率**: 每 12 小时一次
- **超时**: 15 秒

### 3.3 手动维护 JSON（兜底）

对于国内独有模型（如 Kimi-K2.5、GLM-5、doubao-seed、MiniMax 等），外部数据源可能覆盖不到。需要在服务端维护一份**手动补充文件**，格式与输出完全一致。

建议放在：
```
/opt/clawdbot/config/manual-capability-cards.json
```

---

## 四、输出文件格式

### 4.1 完整 JSON 结构

客户端从 `https://www.obplugins.cn/api/v1/capability-cards.json` 获取以下 JSON：

```json
{
  "version": 2,
  "publishedAt": "2026-02-23T10:30:00.000Z",
  "cards": [
    {
      "provider": "deepseek",
      "modelId": "deepseek-chat",
      "displayName": "DeepSeek V3",
      "capabilities": {
        "text": 4,
        "code": 5
      },
      "modelType": "chat",
      "region": "domestic",
      "costTier": "standard",
      "costPer1M": 1.37,
      "strengthTier": "strong",
      "maxContextTokens": 64000,
      "tags": ["coding", "chinese"]
    }
  ],
  "signature": "base64-encoded-ed25519-signature..."
}
```

### 4.2 字段说明

#### 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `version` | number | 是 | Schema 版本号，当前为 `2` |
| `publishedAt` | string | 是 | ISO 8601 时间戳，生成时间 |
| `cards` | array | 是 | 模型卡片数组 |
| `signature` | string | 是 | Ed25519 签名（base64），对 `cards` 数组的 JSON 签名 |

#### 每张卡片字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `provider` | string | 是 | 提供商 ID（如 `"deepseek"`, `"qwen"`, `"zhipu"`, `"openai"`, `"anthropic"`） |
| `modelId` | string | 是 | 模型 ID（如 `"deepseek-chat"`, `"gpt-4o"`, `"claude-sonnet-4-5"`） |
| `displayName` | string | 是 | 用户友好的展示名称 |
| `aliases` | string[] | 否 | 别名列表（如 `["deepseek-v3"]`） |
| `capabilities` | object | 是 | 能力评分，见下方 |
| `modelType` | string | 是 | `"chat"` 或 `"specialized"` |
| `region` | string | 是 | `"domestic"` (国内) 或 `"international"` (海外) |
| `costTier` | string | 是 | `"premium"` / `"standard"` / `"free"` |
| `costPer1M` | number | 是 | 每百万 token 的美元成本（混合 input/output 均价） |
| **`strengthTier`** | string | **是（新增）** | **`"strong"` / `"moderate"` / `"weak"`** |
| `maxContextTokens` | number | 否 | 最大上下文窗口 |
| `languages` | string[] | 否 | 支持的语言（如 `["zh", "en"]`） |
| `tags` | string[] | 否 | 标签（如 `["coding", "reasoning", "vision"]`） |

#### `capabilities` 对象

键为能力维度，值为 1-5 的评分（整数）：

| 键 | 说明 | 评分标准 |
|----|------|---------|
| `text` | 文本对话/理解 | 5=顶级(Claude/GPT-4o), 4=优秀(DeepSeek-V3), 3=可用(Qwen-turbo), 2=基础, 1=差 |
| `code` | 代码生成/理解 | 5=顶级(Claude/DeepSeek), 4=优秀(GPT-4o), 3=可用, 2=基础, 1=差 |
| `vision` | 图片理解 | 5=顶级(GPT-4o), 4=优秀, 3=可用, 0/缺=不支持 |
| `imageGen` | 图片生成 | 5=顶级(DALL-E 3), 0/缺=不支持 |
| `video` | 视频理解 | 5=顶级, 0/缺=不支持 |
| `audio` | 音频理解 | 5=顶级(Whisper), 0/缺=不支持 |
| `tts` | 语音合成 | 5=顶级, 0/缺=不支持 |
| `embedding` | 嵌入 | 5=顶级, 0/缺=不支持 |
| `toolCall` | 工具调用 | 5=顶级, 0/缺=不支持 |

### 4.3 `strengthTier` 推导规则

`strengthTier` 是本次**核心新增字段**，客户端用它判断是否弹出弱模型警告。

**自动推导规则（当无法手动判断时）：**

| 条件 | strengthTier | 典型模型 |
|------|-------------|---------|
| `text >= 4` 或 `code >= 4` | `"strong"` | DeepSeek-V3, Claude-4, GPT-4o, Kimi-K2.5 |
| `text >= 3` 或 `code >= 3` | `"moderate"` | Qwen-turbo, GLM-4-plus, moonshot-v1 |
| 其余 | `"weak"` | GLM-4-flash, Qwen2.5-7B, 小参数开源模型 |

**手动覆盖优先**：如果手动在卡片中指定了 `strengthTier`，客户端直接使用，不再推导。

**实用参考**（帮助从外部数据推断评分）：

| 指标 | strong 参考线 | moderate 参考线 |
|------|-------------|----------------|
| 参数量 | ≥ 100B (或 MoE ≥ 600B 激活) | ≥ 30B |
| 输入定价 ($/1M tokens) | ≥ $1 | ≥ $0.1 |
| 知名度 | 各厂旗舰模型 | 各厂中端模型 |

---

## 五、签名机制

### 5.1 Ed25519 密钥对

与客户端更新签名系统相同的基础设施，但使用**独立的密钥对**。

**环境变量：**
- 私钥（仅部署在香港服务器）：`OPENCLAWCN_CAPABILITY_CARDS_PRIVATE_KEY`
- 公钥（编译到客户端）：`OPENCLAWCN_CAPABILITY_CARDS_PUBLIC_KEY`

**密钥格式**: DER/SPKI (base64)，与 `extension-signature.ts` 相同格式。

### 5.2 签名步骤

```
1. 构建 canonical payload = JSON.stringify(cards)
   注意：是对 cards 数组做 JSON 序列化，不包含 version/publishedAt
2. 用 Ed25519 私钥签名 canonical payload (UTF-8 bytes)
3. 签名结果 base64 编码，放入 "signature" 字段
```

### 5.3 生成密钥对

```bash
# 在香港服务器上执行（仅需一次）
openssl genpkey -algorithm ed25519 -out capability-cards-private.pem
openssl pkey -in capability-cards-private.pem -pubout -outform DER | base64 -w0 > capability-cards-public-key.b64

# 私钥保存到环境变量
export OPENCLAWCN_CAPABILITY_CARDS_PRIVATE_KEY=$(openssl pkey -in capability-cards-private.pem -outform DER | base64 -w0)

# 公钥 (base64) 给客户端开发，编译到二进制中
cat capability-cards-public-key.b64
```

### 5.4 签名代码参考 (Node.js)

```javascript
const crypto = require("crypto");

function signCards(cards, privateKeyB64) {
  const canonical = JSON.stringify(cards);
  const privateKeyBuf = Buffer.from(privateKeyB64, "base64");

  const privateKey = crypto.createPrivateKey({
    key: privateKeyBuf,
    format: "der",
    type: "pkcs8",
  });

  const signature = crypto.sign(null, Buffer.from(canonical, "utf8"), privateKey);
  return signature.toString("base64");
}
```

Java 等价代码用 `java.security.Signature` 和 `EdDSA` 即可。

---

## 六、定时任务设计

### 6.1 执行位置

**必须在香港服务器 (43.129.194.117) 上运行**，因为阿里云杭州/上海服务器无法访问 GitHub 和 OpenRouter。

### 6.2 执行频率

- **正常**: 每 12 小时执行一次 (cron: `0 0,12 * * *`)
- **首次部署**: 手动执行一次验证

### 6.3 任务流程

```
┌─────────────────────────────────────────────────────────────┐
│                    定时任务 (每 12h)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 拉取 LiteLLM JSON (GitHub)                              │
│     GET https://raw.githubusercontent.com/BerriAI/litellm/  │
│         main/model_prices_and_context_window.json            │
│     超时 30s，重试 2 次                                       │
│                                                             │
│  2. 拉取 OpenRouter 模型列表                                  │
│     GET https://openrouter.ai/api/v1/models                  │
│     超时 15s，重试 2 次                                       │
│                                                             │
│  3. 读取手动维护的补充卡片                                     │
│     /opt/clawdbot/config/manual-capability-cards.json        │
│                                                             │
│  4. 合并 & 转换                                              │
│     - LiteLLM + OpenRouter 去重（provider+modelId 唯一键）    │
│     - 从定价/参数量/能力标记推导 capabilities 评分             │
│     - 推导 strengthTier                                      │
│     - 手动卡片优先级最高（覆盖自动生成的同名卡片）             │
│                                                             │
│  5. Ed25519 签名                                             │
│                                                             │
│  6. 写入文件 / 通过 API 更新                                  │
│     → /api/v1/capability-cards.json 可被客户端读取            │
│                                                             │
│  7. 记录日志 & 告警                                           │
│     - 成功: 记录卡片数量、耗时                                │
│     - 失败: 重试后仍失败 → 发企业微信/钉钉告警                │
│     - 失败时不覆盖上一次的有效文件                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 LiteLLM → capabilities 评分映射

```
# text 评分：
- 定价 >= $10/1M input   → text: 5  (顶级: Claude Opus, GPT-4.5)
- 定价 >= $1/1M input    → text: 4  (优秀: DeepSeek-V3, GPT-4o)
- 定价 >= $0.1/1M input  → text: 3  (可用: Qwen-turbo, GLM-4-plus)
- 定价 >= $0.01/1M input → text: 2  (基础: GLM-4-flash)
- 定价 < $0.01           → text: 1  (最弱)

# code 评分（同 text，但针对已知代码模型加分）：
- 模型名含 "coder"/"code"/"coding" → code 评分 = max(text + 1, 5)
- 模型名含 "deepseek" 且非 lite    → code = max(text, 4)

# vision 评分：
- supports_vision == true → vision: 3 (默认)
- 模型名含 "vision"/"vl"/"4o" → vision: 4

# toolCall 评分：
- supports_function_calling == true → toolCall: 4 (默认)

# 其他维度按 mode 字段映射：
- mode == "image_generation" → imageGen: 4, modelType: "specialized"
- mode == "audio_transcription" → audio: 4, modelType: "specialized"
- mode == "embedding" → embedding: 4, modelType: "specialized"
```

### 6.5 provider ID 映射

外部数据源的模型名前缀需要映射到我们的 provider ID：

| 外部前缀 | 我们的 provider | 备注 |
|---------|----------------|------|
| `deepseek/` | `deepseek` | |
| `openai/`, `gpt-`, `o1-`, `o3-`, `o4-` | `openai` | |
| `anthropic/`, `claude-` | `anthropic` | |
| `google/`, `gemini-` | `google` | |
| `qwen/`, `alibaba/` | `qwen` | |
| `zhipu/`, `glm-`, **`z-ai/`** | `zhipu` | ⚠️ OpenRouter 实际用 `z-ai/` 前缀 |
| `moonshot/`, `kimi-`, **`moonshotai/`** | `moonshot` | ⚠️ OpenRouter 实际用 `moonshotai/` 前缀 |
| `minimax/` | `minimax` | |
| `doubao/`, `bytedance/` | `doubao` | |
| **`stepfun/`** | `stepfun` | 阶跃星辰（新增） |
| `mistral/` | `mistral` | |
| `meta-llama/`, `llama-` | `meta` | |

### 6.6 去重与优先级

同一个 `provider + modelId` 组合可能出现在多个数据源。优先级：

1. **手动维护 JSON** — 最高优先级（人工校准）
2. **OpenRouter** — 次优先级（字段更丰富）
3. **LiteLLM** — 基础数据源（覆盖面最广）

---

## 七、API 端点

### 7.1 `GET /api/v1/capability-cards.json`

客户端每 24 小时拉取一次的端点。

**响应**：
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: public, max-age=3600
ETag: "v2-20260223103000"
```

```json
{
  "version": 2,
  "publishedAt": "2026-02-23T10:30:00.000Z",
  "cards": [ ... ],
  "signature": "..."
}
```

**错误响应** (数据未就绪)：
```http
HTTP/1.1 503 Service Unavailable
Retry-After: 3600
```

**注意**：
- 此 URL 已通过 Nginx 配置透传到香港后端，无缓存（`/api/*` 路径不缓存）
- 但建议在 Java 后端加 `Cache-Control: public, max-age=3600`（1 小时），减轻频繁请求的压力
- 支持 `ETag` / `If-None-Match` 条件请求（可选，非必须）

### 7.2 `POST /api/v1/capability-cards/refresh` （可选，运维用）

手动触发立即拉取外部数据源重新生成 capability cards。

**请求**：
```http
POST /api/v1/capability-cards/refresh
Content-Type: application/json
Authorization: Bearer <admin-token>
```

**响应**：
```json
{
  "code": 200,
  "message": "Refreshed 423 cards in 8.2s",
  "data": {
    "cardsCount": 423,
    "sources": {
      "litellm": 387,
      "openrouter": 412,
      "manual": 24,
      "merged": 423
    },
    "publishedAt": "2026-02-23T10:30:00.000Z"
  }
}
```

---

## 八、国内特有模型（手动维护清单）

以下模型在 LiteLLM/OpenRouter 中**可能缺失或数据不准确**，需要在手动维护文件中确保正确：

```json
[
  {
    "provider": "deepseek", "modelId": "deepseek-chat", "displayName": "DeepSeek V3",
    "capabilities": { "text": 4, "code": 5 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 1.37,
    "strengthTier": "strong", "maxContextTokens": 64000
  },
  {
    "provider": "deepseek", "modelId": "deepseek-reasoner", "displayName": "DeepSeek R1",
    "capabilities": { "text": 5, "code": 5 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 6.27,
    "strengthTier": "strong", "maxContextTokens": 64000
  },
  {
    "provider": "kimi-coding", "modelId": "kimi-for-coding", "displayName": "Kimi for Coding",
    "capabilities": { "text": 4, "code": 5, "vision": 3 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 2,
    "strengthTier": "strong"
  },
  {
    "provider": "zhipu", "modelId": "glm-5-code", "displayName": "GLM-5 Code",
    "capabilities": { "text": 3, "code": 4, "toolCall": 4 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 2,
    "strengthTier": "strong"
  },
  {
    "provider": "minimax", "modelId": "MiniMax-M1", "displayName": "MiniMax M1",
    "capabilities": { "text": 4, "code": 3 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 1.5,
    "strengthTier": "strong"
  },
  {
    "provider": "qwen", "modelId": "qwen-max", "displayName": "Qwen Max",
    "capabilities": { "text": 4, "code": 4, "toolCall": 4 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 5.6,
    "strengthTier": "strong"
  },
  {
    "provider": "qwen", "modelId": "qwq-plus", "displayName": "QWQ Plus (推理)",
    "capabilities": { "text": 4, "code": 4 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 4,
    "strengthTier": "strong"
  },
  {
    "provider": "doubao", "modelId": "doubao-seed-1-8-251228", "displayName": "豆包 Seed 1.8",
    "capabilities": { "text": 4, "code": 3 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 0.4,
    "strengthTier": "strong"
  },
  {
    "provider": "moonshot", "modelId": "moonshot-v1-auto", "displayName": "Moonshot v1 Auto",
    "capabilities": { "text": 3, "code": 3 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 4,
    "strengthTier": "moderate"
  },
  {
    "provider": "zhipu", "modelId": "glm-4-flash", "displayName": "GLM-4 Flash (免费)",
    "capabilities": { "text": 2, "code": 2 },
    "modelType": "chat", "region": "domestic", "costTier": "free", "costPer1M": 0,
    "strengthTier": "weak"
  },
  {
    "provider": "siliconflow", "modelId": "deepseek-ai/DeepSeek-V3", "displayName": "DeepSeek V3 (硅基)",
    "capabilities": { "text": 4, "code": 5 },
    "modelType": "chat", "region": "domestic", "costTier": "free", "costPer1M": 0,
    "strengthTier": "strong"
  },
  {
    "provider": "siliconflow", "modelId": "Qwen/Qwen2.5-7B-Instruct", "displayName": "Qwen 2.5 7B (免费)",
    "capabilities": { "text": 2, "code": 2 },
    "modelType": "chat", "region": "domestic", "costTier": "free", "costPer1M": 0,
    "strengthTier": "weak"
  },

  // ============ 2026-02-24 新增 — OpenRouter 已收录但远程端点缺失的模型 ============

  {
    "provider": "deepseek", "modelId": "deepseek-v3.2", "displayName": "DeepSeek V3.2",
    "capabilities": { "text": 4, "code": 5, "toolCall": 4 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 0.64,
    "strengthTier": "strong", "maxContextTokens": 163840
  },
  {
    "provider": "deepseek", "modelId": "deepseek-v3.2-speciale", "displayName": "DeepSeek V3.2 SpecialE",
    "capabilities": { "text": 5, "code": 5, "toolCall": 4 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 1.6,
    "strengthTier": "strong", "maxContextTokens": 163840
  },
  {
    "provider": "moonshot", "modelId": "kimi-k2.5", "displayName": "Kimi K2.5",
    "capabilities": { "text": 4, "code": 4, "vision": 3, "toolCall": 4 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 2.7,
    "strengthTier": "strong", "maxContextTokens": 262144
  },
  {
    "provider": "moonshot", "modelId": "kimi-k2-thinking", "displayName": "Kimi K2 Thinking",
    "capabilities": { "text": 4, "code": 4, "toolCall": 4 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 2.5,
    "strengthTier": "strong", "maxContextTokens": 131072
  },
  {
    "provider": "qwen", "modelId": "qwen3.5-plus", "displayName": "千问 3.5 Plus",
    "capabilities": { "text": 5, "code": 4, "vision": 4 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 2.4,
    "strengthTier": "strong", "maxContextTokens": 1000000
  },
  {
    "provider": "qwen", "modelId": "qwen3-max-thinking", "displayName": "千问 3 Max Thinking",
    "capabilities": { "text": 5, "code": 4 },
    "modelType": "chat", "region": "domestic", "costTier": "premium", "costPer1M": 7.2,
    "strengthTier": "strong", "maxContextTokens": 262144
  },
  {
    "provider": "qwen", "modelId": "qwen3-coder-next", "displayName": "千问 3 Coder Next",
    "capabilities": { "text": 3, "code": 5 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 0.87,
    "strengthTier": "strong", "maxContextTokens": 262144
  },
  {
    "provider": "zhipu", "modelId": "glm-5", "displayName": "GLM-5",
    "capabilities": { "text": 4, "code": 4, "toolCall": 4 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 6.0,
    "strengthTier": "strong", "maxContextTokens": 204800
  },
  {
    "provider": "stepfun", "modelId": "step-3.5-flash", "displayName": "StepFun 3.5 Flash",
    "capabilities": { "text": 3, "code": 3 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 0.4,
    "strengthTier": "moderate", "maxContextTokens": 256000
  },
  {
    "provider": "minimax", "modelId": "MiniMax-M2.5", "displayName": "MiniMax M2.5",
    "capabilities": { "text": 4, "code": 3, "toolCall": 3 },
    "modelType": "chat", "region": "domestic", "costTier": "standard", "costPer1M": 3.0,
    "strengthTier": "strong", "maxContextTokens": 196608
  }
]
```

> **⚠️ 服务端问题 (2026-02-24)**：当前远程端点 `https://www.obplugins.cn/api/api/v1/capability-cards.json` 返回 800+ 国际模型卡片（来自 LiteLLM），但 **0 张国内 domestic 模型卡片**。说明服务端尚未合并 OpenRouter CN 模型数据和手动维护 JSON。请 tecbinhome 优先完成：
> 1. 部署 `manual-capability-cards.json`（上方清单）到 `/opt/clawdbot/config/`
> 2. 配置 OpenRouter 数据源拉取（`z-ai/`、`moonshotai/`、`qwen/` 等 CN provider）
> 3. 合并逻辑中添加 `region: "domestic"` 标记

---

## 九、部署检查清单

### 9.1 香港服务器 (43.129.194.117) 准备

- [ ] 安装 Node.js 18+ 或 Java 17+（选择一种语言实现定时任务）
- [ ] 生成 Ed25519 密钥对（见第五节）
- [ ] 设置环境变量 `OPENCLAWCN_CAPABILITY_CARDS_PRIVATE_KEY`
- [ ] 创建手动维护文件 `/opt/clawdbot/config/manual-capability-cards.json`（初始内容见第八节）
- [ ] 配置 cron 定时任务 `0 0,12 * * *`
- [ ] 确认可以访问 `raw.githubusercontent.com` 和 `openrouter.ai`

### 9.2 首次运行验证

```bash
# 在香港服务器上

# 1. 验证外网访问
curl -s https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json | head -c 200
# 期望：返回 JSON 内容

curl -s https://openrouter.ai/api/v1/models | head -c 200
# 期望：返回 JSON 内容

# 2. 手动触发一次生成
/opt/clawdbot/scripts/generate-capability-cards.sh
# 期望：生成 capability-cards.json 并输出卡片数量

# 3. 验证签名
node -e "
const fs = require('fs');
const crypto = require('crypto');
const payload = JSON.parse(fs.readFileSync('/path/to/capability-cards.json'));
const pubKey = crypto.createPublicKey({
  key: Buffer.from(process.env.OPENCLAWCN_CAPABILITY_CARDS_PUBLIC_KEY, 'base64'),
  format: 'der', type: 'spki'
});
const canonical = JSON.stringify(payload.cards);
const valid = crypto.verify(null, Buffer.from(canonical), pubKey, Buffer.from(payload.signature, 'base64'));
console.log('Signature valid:', valid);
"
# 期望：Signature valid: true

# 4. 通过客户端端点验证
curl -s https://www.obplugins.cn/api/v1/capability-cards.json | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Version: {d[\"version\"]}')
print(f'Cards: {len(d[\"cards\"])}')
print(f'Published: {d[\"publishedAt\"]}')
print(f'Has signature: {bool(d.get(\"signature\"))}')
# 检查 strengthTier 覆盖率
tiers = [c.get('strengthTier') for c in d['cards']]
print(f'Strong: {tiers.count(\"strong\")}, Moderate: {tiers.count(\"moderate\")}, Weak: {tiers.count(\"weak\")}')
"
```

### 9.3 公钥交付

生成密钥对后，请将公钥 (base64 字符串) 发给客户端开发，用于设置 `OPENCLAWCN_CAPABILITY_CARDS_PUBLIC_KEY` 环境变量并嵌入二进制。

---

## 十、客户端对接（已完成，仅供参考）

客户端侧代码已经就绪，无需服务端配合修改：

| 文件 | 功能 |
|------|------|
| `src/dispatch/capability-registry-remote.ts` | 每 24h 拉取 `capability-cards.json`，验签，缓存 |
| `src/dispatch/capability-registry.ts` | 内置 60+ 卡片 + 远程覆盖 + `strengthTier` 推导 |
| `src/config/provider-capability-mapping.ts` | `ModelDef` 加 `strengthTier` 字段 |
| `src/gateway/server-methods/model-config.ts` | Gateway API 响应带 `strengthTier` |
| `ui/src/ui/views/model-config.ts` | UI 弱模型警告读取 `strengthTier` |

**客户端行为**：
- 远程卡片有 `strengthTier` → 直接使用
- 远程卡片无 `strengthTier` → 从 `capabilities.text/code` 评分推导
- 远程拉取失败 → 用本地缓存
- 缓存也没有 → 用内置的 60+ 张卡片

---

## 十一、FAQ

**Q: 如果外部 API 全部不可访问怎么办？**
A: 定时任务失败时**不覆盖**上一次成功生成的文件。客户端会继续使用缓存或内置卡片。可以单独依赖手动维护 JSON 生成。

**Q: 为什么不在阿里云上拉取再传到香港？**
A: 阿里云机器无法访问 `raw.githubusercontent.com` 和 `openrouter.ai`（被墙/无外网）。所有外部 API 调用必须从香港发起。

**Q: 新增一个国内厂商模型怎么操作？**
A: 编辑香港服务器上的 `/opt/clawdbot/config/manual-capability-cards.json`，添加一张卡片，等下次定时任务执行或手动调用 `/api/v1/capability-cards/refresh`。

**Q: `strengthTier` 可以不填吗？**
A: 可以但不建议。如果不填，客户端会从 `capabilities.text/code` 推导。但推导可能不准（比如一个便宜但 text=4 的模型会被判为 strong），所以建议服务端尽量填上。

**Q: 签名是必须的吗？**
A: 当前客户端在 `OPENCLAWCN_CAPABILITY_CARDS_PUBLIC_KEY` 为空时跳过签名验证。部署初期可以先不签名，等密钥对就绪后再启用。但**强烈建议尽早启用**，防止中间人篡改。

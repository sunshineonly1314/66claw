# 模型配置页 — 智能探测终极方案

> **设计师**: 世界顶级 UI/UE 交互体验设计师
> **核心理念**: 一次配置，智能探测，自动启用所有能力
> **用户价值**: 用户只需配置一次 API Key，系统自动探测并启用所有支持的能力

---

## 一、核心设计理念

### 1.1 用户心智模型的根本改变

**传统模式（繁琐）**:
```
用户: 我要配置 OpenAI
  → 配置文本模型
  → 哦，还需要配置图片？再配置一次
  → 视频也需要单独配置？又配置一次
  → 太麻烦了！
```

**智能探测模式（极简）**:
```
用户: 我要配置 OpenAI
  → 系统自动探测: 支持文本、图片、视频
  → 自动启用所有能力
  → 完成！
```

### 1.2 设计目标

1. **一次配置，全能力探测**
   - 用户输入 API Key
   - 系统自动探测该 Key 支持哪些能力
   - 自动配置所有可用的默认模型

2. **智能引导补齐缺失能力**
   - 配置完成后，显示"能力总览"
   - 缺失的能力自动推荐补充

3. **零配置门槛**
   - 用户不需要知道"Vision"、"Image Gen"等术语
   - 系统自动匹配最佳默认模型

---

## 二、页面整体架构（单一视图）

```
┌─────────────────────────────────────────────────────────────┐
│ 模型配置                                          [刷新]    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ━━━ 你的能力总览 ━━━                                        │
│                                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │ 💬 文本  │ │ 🖼️ 图片  │ │ 🎬 视频  │ │ 🧠 记忆  │       │
│ │ ✅ 可用  │ │ ✅ 可用  │ │ ❌ 缺失  │ │ ✅ 可用  │       │
│ │ 3 个模型 │ │ 1 个模型 │ │          │ │ 1 个模型 │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│ ━━━ 已配置提供商 (2) ━━━                                    │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ OpenAI                                         [✅ 5项]│  │
│ │ ✅ 文本对话 (gpt-4o)                                   │  │
│ │ ✅ 图片理解 (gpt-4o)                                   │  │
│ │ ✅ 图片生成 (dall-e-3)                                 │  │
│ │ ✅ 视频理解 (gpt-4o)                                   │  │
│ │ ✅ 语音 (whisper-1)                                    │  │
│ │                                                        │  │
│ │ [管理模型]  [删除]                                     │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 硅基流动                                       [✅ 2项]│  │
│ │ ✅ 文本对话 (DeepSeek-V3)                              │  │
│ │ ✅ Embedding (BGE-Large-ZH)                            │  │
│ │                                                        │  │
│ │ [管理模型]  [删除]                                     │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ━━━ 补齐能力 ━━━                                            │
│                                                              │
│ ⚠️ 你还缺少以下能力:                                         │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 🎬 视频理解/生成                                       │  │
│ │                                                        │  │
│ │ 推荐配置:                                              │  │
│ │ • Google Gemini (支持视频理解)                         │  │
│ │ • 字节豆包 (支持视频理解)                              │  │
│ │                                                        │  │
│ │ [立即配置]                                             │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ━━━ 添加更多提供商 ━━━                          [展开]      │
│                                                              │
│ [DeepSeek]  [通义千问]  [Anthropic]  ...                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、核心交互流程：智能探测

### 3.1 配置弹窗（智能探测版）

```
┌─────────────────────────────────────────────────────────┐
│ 配置 OpenAI                                        [×] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ API Key *                                                │
│ [●●●●●●●●●●●●●●●●sk-xxx]  [显示]                       │
│                                                          │
│ [开始探测]                                               │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ 🔍 探测中...                                             │
│                                                          │
│ ✅ 文本对话 — 检测到 gpt-4o                              │
│ ✅ 图片理解 — 检测到 gpt-4o                              │
│ ✅ 图片生成 — 检测到 dall-e-3                            │
│ ✅ 视频理解 — 检测到 gpt-4o                              │
│ ✅ 语音识别 — 检测到 whisper-1                           │
│ ❌ Embedding — 不支持                                    │
│                                                          │
│ 💡 共检测到 5 项能力，将自动配置默认模型                 │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ 高级选项 (可选):                                         │
│                                                          │
│ 文本对话模型: [gpt-4o ▼]                                │
│ 图片生成模型: [dall-e-3 ▼]                              │
│                                                          │
│ □ 探测完成后自动保存（无需手动点击）                     │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                              [取消]  [保存配置]         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 探测流程详解

#### Step 1: 输入 API Key

```
┌─────────────────────────────────────────┐
│ API Key *                                │
│ [sk-proj-xxx...]  [显示]               │
│                                          │
│ [开始探测]  (输入后启用)                 │
└─────────────────────────────────────────┘
```

#### Step 2: 点击"开始探测"，启动智能检测

```
┌─────────────────────────────────────────┐
│ 🔍 探测中...                             │
│                                          │
│ ⏳ 正在检测文本对话能力...               │
│ ⏳ 正在检测图片理解能力...               │
│ ⏳ 正在检测图片生成能力...               │
│ ⏳ 正在检测视频理解能力...               │
│ ⏳ 正在检测 Embedding 能力...           │
└─────────────────────────────────────────┘
```

#### Step 3: 探测完成，显示结果

```
┌─────────────────────────────────────────┐
│ ✅ 探测完成                              │
│                                          │
│ ✅ 文本对话 — gpt-4o                     │
│ ✅ 图片理解 — gpt-4o                     │
│ ✅ 图片生成 — dall-e-3                   │
│ ✅ 视频理解 — gpt-4o                     │
│ ❌ Embedding — 不支持                    │
│                                          │
│ 💡 共检测到 4 项能力                     │
│                                          │
│ [保存配置]                               │
└─────────────────────────────────────────┘
```

#### Step 4: 保存后自动关闭，显示成功提示

```
┌─────────────────────────────────────────┐
│ ✅ 已配置 OpenAI，启用 4 项能力      [×]│
└─────────────────────────────────────────┘

页面刷新，显示已配置卡片
```

---

## 四、后端智能探测逻辑

### 4.1 探测接口设计

```typescript
POST /api/models/detect

请求:
{
  "provider": "openai",
  "apiKey": "sk-proj-xxx...",
  "baseUrl": "https://api.openai.com/v1" // 可选
}

响应:
{
  "success": true,
  "capabilities": [
    {
      "type": "text",
      "supported": true,
      "models": ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
      "defaultModel": "gpt-4o"
    },
    {
      "type": "image-understanding",
      "supported": true,
      "models": ["gpt-4o"],
      "defaultModel": "gpt-4o"
    },
    {
      "type": "image-generation",
      "supported": true,
      "models": ["dall-e-3", "dall-e-2"],
      "defaultModel": "dall-e-3"
    },
    {
      "type": "video-understanding",
      "supported": true,
      "models": ["gpt-4o"],
      "defaultModel": "gpt-4o"
    },
    {
      "type": "audio",
      "supported": true,
      "models": ["whisper-1"],
      "defaultModel": "whisper-1"
    },
    {
      "type": "embedding",
      "supported": false,
      "reason": "OpenAI Embeddings 使用不同的 API 端点"
    }
  ]
}
```

### 4.2 探测实现逻辑

```typescript
// src/gateway/server-methods/model-detection.ts

/**
 * 智能探测提供商支持的能力
 */
export async function detectProviderCapabilities(
  provider: string,
  apiKey: string,
  baseUrl?: string
): Promise<CapabilityDetectionResult> {

  // 1. 获取该提供商的模型列表
  const models = await fetchProviderModels(provider, apiKey, baseUrl);

  // 2. 分析每个模型的能力
  const capabilities: CapabilityDetection[] = [];

  // 文本对话
  const textModels = models.filter(m => supportsText(m));
  if (textModels.length > 0) {
    capabilities.push({
      type: "text",
      supported: true,
      models: textModels.map(m => m.id),
      defaultModel: selectBestTextModel(textModels),
    });
  }

  // 图片理解（Vision）
  const visionModels = models.filter(m => supportsVision(m));
  if (visionModels.length > 0) {
    capabilities.push({
      type: "image-understanding",
      supported: true,
      models: visionModels.map(m => m.id),
      defaultModel: selectBestVisionModel(visionModels),
    });
  }

  // 图片生成
  const imageGenModels = models.filter(m => supportsImageGen(m));
  if (imageGenModels.length > 0) {
    capabilities.push({
      type: "image-generation",
      supported: true,
      models: imageGenModels.map(m => m.id),
      defaultModel: selectBestImageGenModel(imageGenModels),
    });
  }

  // 视频理解
  const videoModels = models.filter(m => supportsVideo(m));
  if (videoModels.length > 0) {
    capabilities.push({
      type: "video-understanding",
      supported: true,
      models: videoModels.map(m => m.id),
      defaultModel: selectBestVideoModel(videoModels),
    });
  }

  // Embedding
  const embeddingModels = models.filter(m => supportsEmbedding(m));
  if (embeddingModels.length > 0) {
    capabilities.push({
      type: "embedding",
      supported: true,
      models: embeddingModels.map(m => m.id),
      defaultModel: selectBestEmbeddingModel(embeddingModels),
    });
  }

  return { success: true, capabilities };
}

/**
 * 判断模型是否支持文本对话
 */
function supportsText(model: ModelInfo): boolean {
  // 大部分模型都支持文本
  return !model.id.includes("embedding") &&
         !model.id.includes("dall-e") &&
         !model.id.includes("whisper");
}

/**
 * 判断模型是否支持 Vision
 */
function supportsVision(model: ModelInfo): boolean {
  const id = model.id.toLowerCase();

  // OpenAI
  if (id.includes("gpt-4o") || id.includes("gpt-4-vision")) return true;

  // Claude
  if (id.includes("claude") && !id.includes("instant")) return true;

  // Gemini
  if (id.includes("gemini") && id.includes("pro")) return true;

  // 通义千问
  if (id.includes("qwen-vl")) return true;

  // 智谱
  if (id.includes("glm-4v")) return true;

  // 豆包
  if (id.includes("doubao") && id.includes("vision")) return true;

  return false;
}

/**
 * 判断模型是否支持图片生成
 */
function supportsImageGen(model: ModelInfo): boolean {
  const id = model.id.toLowerCase();

  // DALL-E
  if (id.includes("dall-e")) return true;

  // Stable Diffusion
  if (id.includes("stable-diffusion") || id.includes("sdxl")) return true;

  // 通义万相
  if (id.includes("wanx")) return true;

  // 文心一格
  if (id.includes("ernie-vilg")) return true;

  return false;
}

/**
 * 选择最佳文本模型（优先级：性能 > 成本）
 */
function selectBestTextModel(models: ModelInfo[]): string {
  // 优先级: gpt-4o > claude-sonnet > deepseek-chat
  const priority = [
    "gpt-4o",
    "claude-sonnet-4",
    "gemini-2.0",
    "deepseek-chat",
    "qwen-max",
  ];

  for (const p of priority) {
    const found = models.find(m => m.id.includes(p));
    if (found) return found.id;
  }

  return models[0].id; // 默认返回第一个
}
```

---

## 五、已配置提供商卡片设计

### 5.1 卡片布局（展开式）

```
┌────────────────────────────────────────────────────────┐
│ OpenAI                                         [✅ 5项]│
│                                                        │
│ ✅ 文本对话 — gpt-4o                                   │
│ ✅ 图片理解 — gpt-4o                                   │
│ ✅ 图片生成 — dall-e-3                                 │
│ ✅ 视频理解 — gpt-4o                                   │
│ ✅ 语音识别 — whisper-1                                │
│                                                        │
│ API Key: ●●●●●●●●●●●●sk-xxx  [显示]  [修改]          │
│                                                        │
│ [管理模型]  [重新探测]  [删除]                         │
└────────────────────────────────────────────────────────┘
```

### 5.2 点击"管理模型"展开详细配置

```
┌────────────────────────────────────────────────────────┐
│ OpenAI — 管理模型                                 [×] │
├────────────────────────────────────────────────────────┤
│                                                        │
│ ━━━ 文本对话 ━━━                                      │
│                                                        │
│ 当前模型: [gpt-4o ▼]                                  │
│                                                        │
│ 可选模型:                                              │
│ • gpt-4o (最新多模态模型)                              │
│ • gpt-4o-mini (快速轻量版)                             │
│ • gpt-3.5-turbo (经济型)                               │
│                                                        │
│ ━━━ 图片理解 ━━━                                      │
│                                                        │
│ 当前模型: [gpt-4o ▼]                                  │
│                                                        │
│ ━━━ 图片生成 ━━━                                      │
│                                                        │
│ 当前模型: [dall-e-3 ▼]                                │
│                                                        │
│ 可选模型:                                              │
│ • dall-e-3 (高质量)                                    │
│ • dall-e-2 (经济型)                                    │
│                                                        │
│ ━━━ 视频理解 ━━━                                      │
│                                                        │
│ 当前模型: [gpt-4o ▼]                                  │
│                                                        │
├────────────────────────────────────────────────────────┤
│                              [取消]  [保存更改]       │
└────────────────────────────────────────────────────────┘
```

---

## 六、能力总览卡片设计

### 6.1 可用状态（绿色）

```
┌──────────────┐
│ 💬 文本对话  │
│              │
│ ✅ 可用      │
│ 3 个模型     │
│              │
│ • OpenAI     │
│ • 硅基流动   │
│ • DeepSeek   │
│              │
│ [查看详情]   │
└──────────────┘
```

### 6.2 缺失状态（红色虚线）

```
┌──────────────┐
│ 🎬 视频理解  │
│              │
│ ❌ 缺失      │
│              │
│ 推荐配置:    │
│ • Gemini     │
│ • 豆包       │
│              │
│ [立即配置]   │
└──────────────┘
```

---

## 七、补齐能力引导

### 7.1 缺失能力提示卡片

```
┌────────────────────────────────────────────────────────┐
│ ⚠️ 你还缺少以下能力                                     │
├────────────────────────────────────────────────────────┤
│                                                        │
│ 🎬 视频理解/生成                                       │
│                                                        │
│ 推荐配置:                                              │
│ • Google Gemini (免费额度充足，支持视频理解)           │
│ • 字节豆包 (国内访问快，支持视频理解)                  │
│                                                        │
│ [配置 Gemini]  [配置豆包]  [暂不需要]                 │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 7.2 点击"配置 Gemini"后

直接打开配置弹窗，智能探测流程同上。

---

## 八、关键交互细节

### 8.1 探测失败的处理

```
┌─────────────────────────────────────────┐
│ ❌ 探测失败                              │
│                                          │
│ 无法连接到 OpenAI API                   │
│                                          │
│ 可能原因:                                │
│ • API Key 无效                          │
│ • 网络连接问题                          │
│ • 需要科学上网                          │
│                                          │
│ [重新探测]  [手动配置]  [取消]         │
└─────────────────────────────────────────┘
```

### 8.2 手动配置模式（兜底方案）

如果自动探测失败，提供手动配置入口：

```
┌─────────────────────────────────────────┐
│ 手动配置 OpenAI                          │
│                                          │
│ API Key: [●●●●●●●●●●]                   │
│                                          │
│ 选择要启用的能力:                        │
│ ☑ 文本对话 — 模型: [gpt-4o ▼]          │
│ ☑ 图片理解 — 模型: [gpt-4o ▼]          │
│ ☑ 图片生成 — 模型: [dall-e-3 ▼]        │
│ ☐ 视频理解 — 不启用                     │
│                                          │
│ [保存配置]                               │
└─────────────────────────────────────────┘
```

### 8.3 重新探测按钮

已配置的提供商卡片上有"重新探测"按钮：

```
[重新探测]  →  重新检测该 API Key 的能力
                可能检测到新增的模型
```

---

## 九、免费模型的智能提示

### 9.1 探测到免费模型时的特殊提示

```
┌─────────────────────────────────────────┐
│ ✅ 探测完成                              │
│                                          │
│ 🎁 检测到免费模型！                      │
│                                          │
│ ✅ 文本对话 — Qwen2.5-7B (免费)         │
│ ✅ Embedding — BGE-Large-ZH (免费)      │
│                                          │
│ 💡 该提供商提供每日免费额度              │
│    配置后可省钱，额度用完自动切换        │
│                                          │
│ [启用免费模型自动切换]  [仅保存配置]    │
└─────────────────────────────────────────┘
```

---

## 十、数据结构设计

### 10.1 探测结果数据

```typescript
interface ProviderCapabilities {
  provider: string;              // "openai"
  apiKey: string;                // 加密存储
  baseUrl?: string;
  detectedAt: string;            // ISO 时间戳

  capabilities: {
    text?: {
      enabled: boolean;
      models: string[];          // ["gpt-4o", "gpt-4o-mini"]
      defaultModel: string;      // "gpt-4o"
      currentModel: string;      // 用户选择的当前模型
    };
    imageUnderstanding?: {
      enabled: boolean;
      models: string[];
      defaultModel: string;
      currentModel: string;
    };
    imageGeneration?: {
      enabled: boolean;
      models: string[];
      defaultModel: string;
      currentModel: string;
    };
    videoUnderstanding?: {
      enabled: boolean;
      models: string[];
      defaultModel: string;
      currentModel: string;
    };
    audio?: {
      enabled: boolean;
      models: string[];
      defaultModel: string;
      currentModel: string;
    };
    embedding?: {
      enabled: boolean;
      models: string[];
      defaultModel: string;
      currentModel: string;
    };
  };
}
```

### 10.2 能力总览数据

```typescript
interface CapabilityOverview {
  text: {
    available: boolean;
    providerCount: number;       // 有多少个提供商支持
    providers: string[];         // ["openai", "siliconflow"]
  };
  imageUnderstanding: {
    available: boolean;
    providerCount: number;
    providers: string[];
  };
  imageGeneration: {
    available: boolean;
    providerCount: number;
    providers: string[];
  };
  videoUnderstanding: {
    available: boolean;
    providerCount: number;
    providers: string[];
    recommendations?: string[];  // 缺失时推荐
  };
  audio: {
    available: boolean;
    providerCount: number;
    providers: string[];
  };
  embedding: {
    available: boolean;
    providerCount: number;
    providers: string[];
  };
}
```

---

## 十一、实现优先级

### Phase 1: 核心探测功能
- ✅ 探测接口 (`/api/models/detect`)
- ✅ 能力判断逻辑 (文本、图片、视频)
- ✅ 配置弹窗 + 探测进度显示
- ✅ 保存探测结果

### Phase 2: 智能UI
- ✅ 能力总览卡片 (4 个能力)
- ✅ 已配置提供商卡片 (展开式)
- ✅ 补齐能力引导

### Phase 3: 体验优化
- 重新探测功能
- 手动配置兜底
- 免费模型智能提示
- 探测失败友好提示

---

## 十二、验收标准

| 类别 | 检查项 |
|------|--------|
| 智能探测 | 输入 API Key 后一键探测所有能力 |
| 自动配置 | 探测完成后自动配置默认模型 |
| 能力总览 | 4 个能力卡片正确显示可用/缺失状态 |
| 补齐引导 | 缺失能力自动显示推荐配置 |
| 提供商卡片 | 显示该提供商的所有启用能力 |
| 重新探测 | 可重新探测以发现新模型 |
| 兜底方案 | 探测失败可切换手动配置 |

---

**文档版本**: Smart v1.0
**核心价值**: 一次配置，智能探测，零配置门槛
**最后更新**: 2026-02-18

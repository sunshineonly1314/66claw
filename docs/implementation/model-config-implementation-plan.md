# 模型设置页面 - 完整实施方案

> 从"免费模型页面"升级为"模型设置页面"
> 实施时间: 2026-02-18
> 设计理念: 能力优先 + 零AI感 + 人性化交互

---

## 🎯 核心改变

### 从"免费模型"到"模型设置"

**旧理念** (免费模型页面):
```
免费模型 Provider 管理
  ├─ LongCat配置
  ├─ 蚂蚁百灵配置
  └─ 省钱统计
```

**新理念** (模型设置页面):
```
我能做什么? (能力优先)
  ├─ 💬 聊天 → 使用 Qwen2.5-7B (来自硅基流动)
  ├─ 👁️ 看图 → 未配置 [+ 添加]
  ├─ 🎨 画图 → 未配置 [+ 添加]
  ├─ 📹 看视频 → 未配置 [+ 添加]
  └─ 🧩 智能推荐 → 使用 bge-large-zh (来自硅基流动)
```

### 关键差异

| 维度 | 免费模型页面 | 模型设置页面 |
|------|------------|------------|
| **核心关注** | Provider (厂家) | Capability (能力) |
| **信息层次** | 厂家 → 模型 (模糊) | 能力 → 模型 → 厂家 |
| **用户语言** | 免费模型/API Key | 聊天/看图/画图/密钥 |
| **页面目的** | 配置免费模型省钱 | 管理所有 AI 能力 |
| **适用范围** | 仅免费 Provider | 所有 15 个 Provider |

---

## ✅ 已完成的工作

### 1. Provider-Model-Capability 映射数据 ✅

**文件**: `src/config/provider-capability-mapping.ts`

**内容**:
- ✅ 定义了 `Capability` 类型 (text/image-understanding/image-generation/video/embedding)
- ✅ 定义了 `ModelDef` 接口 (模型ID、名称、能力、定价)
- ✅ 定义了 `ProviderCapabilityMapping` 接口
- ✅ 完整配置了 15 个提供商的 300+ 模型映射
- ✅ 提供了查询函数 (`getModelsByCapability`, `getProviderCapabilities`)
- ✅ 提供了人性化名称/描述/图标 (`CAPABILITY_NAMES`, `CAPABILITY_DESCRIPTIONS`, `CAPABILITY_ICONS`)

**示例**:
```typescript
// 获取所有支持"聊天"能力的模型
const chatModels = getModelsByCapability("text");
// 返回: [
//   { providerId: "siliconflow", model: { modelId: "Qwen2.5-7B", capabilities: ["text"], ... } },
//   { providerId: "openai", model: { modelId: "gpt-4o", capabilities: ["text", "image-understanding"], ... } },
//   ...
// ]
```

---

## 📋 待实施的工作

### 阶段 1: 后端 API (高优先级)

#### 1.1 Gateway API Handler

**文件**: `src/gateway/server-methods/model-config.ts` (新建)

**需要实现的 API**:

```typescript
// 1. 获取所有能力及其状态
"modelConfig.capabilities.list": () => Promise<{
  capabilities: Array<{
    capability: Capability;
    name: string;          // "聊天"
    description: string;   // "和 AI 聊天对话"
    icon: string;          // "💬"
    status: "active" | "inactive";
    currentModel: {
      providerId: string;
      providerName: string;
      modelId: string;
      modelName: string;
      isFree: boolean;
    } | null;
    availableModels: number;  // 可切换的模型数量
  }>;
}>

// 2. 获取某个能力的所有可用模型
"modelConfig.capability.models": (params: {
  capability: Capability;
}) => Promise<{
  models: Array<{
    providerId: string;
    providerName: string;
    providerIcon: string;
    modelId: string;
    modelName: string;
    pricing: { type: "free" | "paid"; details?: string };
    configured: boolean;  // 该 Provider 是否已配置
    active: boolean;      // 是否是当前使用的模型
  }>;
}>

// 3. 切换能力的当前模型
"modelConfig.capability.switchModel": (params: {
  capability: Capability;
  providerId: string;
  modelId: string;
}) => Promise<{ success: boolean; error?: string }>

// 4. 自动检测 Provider 的所有模型
"modelConfig.provider.detect": (params: {
  providerId: string;
  apiKey: string;
}) => Promise<{
  success: boolean;
  models: Array<{
    modelId: string;
    modelName: string;
    capabilities: Capability[];
    available: boolean;  // 测试结果
    error?: string;
  }>;
  autoEnabled: {
    text?: string;           // 自动启用的文字对话模型
    "image-understanding"?: string;
    "image-generation"?: string;
    video?: string;
    embedding?: string;
  };
}>

// 5. 获取所有 Provider 列表
"modelConfig.providers.list": () => Promise<{
  providers: Array<{
    providerId: string;
    name: string;
    icon: string;
    capabilities: Capability[];
    configured: boolean;
    activeModels: number;  // 正在使用的模型数
  }>;
}>
```

**实现要点**:
- 继承现有的 `freeModels.*` API 逻辑
- 添加 capability-first 的查询逻辑
- 集成 `provider-capability-mapping.ts`

#### 1.2 配置存储扩展

**文件**: `src/config/types.models.ts` (扩展)

**需要添加的配置字段**:

```typescript
export interface ModelCapabilityConfig {
  // 每个能力的当前使用模型
  capabilities: {
    text?: {
      providerId: string;
      modelId: string;
    };
    "image-understanding"?: {
      providerId: string;
      modelId: string;
    };
    "image-generation"?: {
      providerId: string;
      modelId: string;
    };
    video?: {
      providerId: string;
      modelId: string;
    };
    embedding?: {
      providerId: string;
      modelId: string;
    };
  };
}
```

---

### 阶段 2: 前端 UI (高优先级)

#### 2.1 能力卡片视图

**文件**: `ui/src/ui/views/model-config.ts` (新建,替换 free-models.ts)

**UI 结构**:

```
┌─────────────────────────────────────────────────────────────┐
│  模型设置                                      [刷新]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  你能做什么                                                  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 💬 聊天                            ✅ 已启用           │  │
│  │                                                      │  │
│  │ 当前: Qwen2.5-7B-Instruct                            │  │
│  │ 来自: 硅基流动 (免费)                                │  │
│  │                                                      │  │
│  │ 今日已用: 1.2K / 50万字                              │  │
│  │                                                      │  │
│  │ [切换模型 ▼]                                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 👁️ 看图                            ❌ 未配置          │  │
│  │                                                      │  │
│  │ 上传图片让 AI 识别和理解                              │  │
│  │                                                      │  │
│  │ [+ 添加功能]                                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🎨 画图                            ❌ 未配置          │  │
│  │                                                      │  │
│  │ 用文字描述让 AI 画图                                  │  │
│  │                                                      │  │
│  │ [+ 添加功能]                                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🧩 智能推荐                        ⚠️ 建议配置        │  │
│  │                                                      │  │
│  │ 智能推荐工具和技能 (需要硅基流动 Embedding)            │  │
│  │                                                      │  │
│  │ [配置硅基流动]                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**设计要点**:
- ✅ 能力卡片优先 (不是 Provider 卡片)
- ✅ 使用生活化语言 (聊天/看图/画图,不是 text/image-understanding)
- ✅ 状态清晰 (已启用/未配置/建议配置)
- ✅ 次要信息 (来自哪个 Provider)
- ✅ 行动明确 (切换模型/添加功能)

#### 2.2 模型切换下拉菜单

**点击 [切换模型 ▼] 后**:

```
┌─────────────────────────────────────────────────────────┐
│ 切换聊天模型                                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 已配置的服务商:                                          │
│                                                         │
│ 硅基流动 (当前)                                          │
│   ✓ Qwen2.5-7B-Instruct           [免费]  ← 当前使用   │
│   ○ Llama-3.3-70B-Instruct        [免费]               │
│   ○ DeepSeek-V3                   [付费]               │
│                                                         │
│ OpenAI (已配置)                                          │
│   ○ GPT-4o                        [付费]               │
│   ○ GPT-4o-Mini                   [便宜]               │
│                                                         │
│ 未配置的服务商:                                          │
│                                                         │
│ Kimi Code (⭐ 首选)                                      │
│   [+ 配置后可用]                                        │
│                                                         │
│ 通义千问                                                 │
│   [+ 配置后可用]                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 2.3 添加功能流程

**点击 [+ 添加功能] 后**:

```
┌─────────────────────────────────────────────────────────┐
│ 添加"看图"功能                                [X]        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 选择一个服务商:                                          │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ☁️ 通义千问 (推荐)                          [免费]  │ │
│ │                                                     │ │
│ │ • 支持图片理解                                       │ │
│ │ • 送100万Token免费额度                              │ │
│ │ • 阿里出品,稳定可靠                                 │ │
│ │                                                     │ │
│ │ [选择这个]                                          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔮 硅基流动                              [免费]      │ │
│ │                                                     │ │
│ │ • 支持图片理解                                       │ │
│ │ • 多个免费模型可选                                   │ │
│ │ • 国内速度快                                         │ │
│ │                                                     │ │
│ │ [选择这个]                                          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [查看更多服务商]                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**选择服务商后 → 复用现有的配置弹窗** (3步引导: 注册 → 获取密钥 → 粘贴)

#### 2.4 零 AI 感的文案

**语言映射表**:

| 技术术语 | 人性化语言 |
|---------|----------|
| text capability | 聊天 |
| image-understanding capability | 看图 |
| image-generation capability | 画图 |
| video capability | 看视频 |
| embedding capability | 智能推荐 |
| Model Provider | 服务商 |
| API Key | 密钥 (第一次提到时加注: "一串以 sk- 开头的文字") |
| Token | 字 |
| Configure | 添加功能 / 配置 |
| Switch Model | 切换模型 |
| Enable | 启用 |
| Test Connection | 验证密钥 |

---

### 阶段 3: 集成与迁移 (中优先级)

#### 3.1 导航菜单更新

**文件**: `ui/src/ui/navigation.ts`

```typescript
// 修改导航项
{
  id: "model-config",        // 旧: "free-models"
  label: t("nav.modelConfig"),  // "模型设置" (旧: "免费模型")
  icon: "⚙️",                  // 旧: "✨"
  path: "/model-config",
}
```

#### 3.2 路由更新

**文件**: `ui/src/ui/app.ts`

```typescript
// 添加新路由,保留旧路由作为重定向
case "model-config":
  return renderModelConfigPage(...);

case "free-models":
  // 重定向到新页面
  window.location.hash = "#model-config";
  return nothing;
```

#### 3.3 i18n 翻译

**文件**: `ui/src/ui/i18n/locales/zh-CN.ts`

```typescript
modelConfig: {
  title: "模型设置",
  capabilities: {
    title: "你能做什么",
    text: "聊天",
    "image-understanding": "看图",
    "image-generation": "画图",
    video: "看视频",
    embedding: "智能推荐",
  },
  status: {
    active: "已启用",
    inactive: "未配置",
    recommended: "建议配置",
  },
  actions: {
    switchModel: "切换模型",
    addCapability: "添加功能",
    configure: "配置",
  },
  // ... 更多翻译
}
```

---

### 阶段 4: 测试 (中优先级)

#### 4.1 单元测试

- [ ] `provider-capability-mapping.test.ts` - 测试映射数据完整性
- [ ] `model-config.test.ts` - 测试 Gateway API

#### 4.2 集成测试

- [ ] 能力卡片正确显示状态
- [ ] 模型切换功能正常
- [ ] 添加功能流程完整
- [ ] 自动检测+启用正常工作

#### 4.3 用户测试

- [ ] 小白用户理解"聊天/看图/画图"
- [ ] 能够成功配置第一个服务商
- [ ] 能够切换模型
- [ ] 文案无技术术语

---

## 🚧 实施优先级

### P0 (最高优先级,先做)
1. ✅ Provider-Model-Capability 映射数据
2. ⏳ 后端 Gateway API (`model-config.ts`)
3. ⏳ 前端能力卡片 UI (`model-config.ts` view)
4. ⏳ i18n 翻译更新

### P1 (高优先级,紧接着做)
1. 模型切换下拉菜单
2. 添加功能流程
3. 导航菜单和路由更新

### P2 (中优先级,有时间做)
1. 单元测试
2. 集成测试
3. 用户测试
4. 性能优化

---

## 📝 实施检查清单

### 后端
- [x] 创建 `provider-capability-mapping.ts`
- [ ] 创建 `server-methods/model-config.ts`
- [ ] 扩展 `types.models.ts` 添加 capability config
- [ ] 注册 Gateway API handlers
- [ ] 编写单元测试

### 前端
- [ ] 创建 `ui/views/model-config.ts`
- [ ] 创建 `ui/controllers/model-config.ts`
- [ ] 创建 `ui/styles/model-config.css`
- [ ] 更新导航菜单
- [ ] 更新路由
- [ ] 更新 i18n 翻译

### 集成
- [ ] 测试能力卡片显示
- [ ] 测试模型切换
- [ ] 测试添加功能流程
- [ ] 用户测试验收

---

## 💡 关键决策

### 决策 1: 渐进式迁移,保留旧页面
**原因**: 避免一次性破坏现有功能,允许用户逐步适应
**实施**: 新路由 `/model-config`,旧路由 `/free-models` 重定向

### 决策 2: 能力优先,Provider 次之
**原因**: 用户关心"我能做什么",不关心"我用哪个厂家"
**实施**: 首页显示能力卡片,Provider 信息作为次要信息

### 决策 3: 零技术术语
**原因**: 降低小白用户门槛,提高可用性
**实施**: 聊天/看图/画图 代替 text/image-understanding/image-generation

### 决策 4: 继承免费模型逻辑
**原因**: LongCat + 蚂蚁百灵 仍然是核心卖点
**实施**: 免费模型作为默认配置,自动出现在"聊天"能力中

---

**实施负责人**: ClawdbotCN 团队
**预计完成时间**: 2026-02-20
**文档版本**: v1.0

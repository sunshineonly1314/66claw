# 模型配置页面架构重新设计

> 基于用户反馈: "MiniMax 有很多种模型,不同模型有不同的能力,你就得不同处理啊。。厂家-模型--能力 是这个关系。。"

## 🔍 问题诊断

### 旧理解 (错误)
```
MiniMax (厂家) = 支持文字+图片
  ↓
用户配置 MiniMax → 就能用文字和图片
```

**问题**: 把厂家当成单一能力体,忽略了一个厂家有多个不同能力的模型

### 新理解 (正确)
```
MiniMax (厂家)
  ├── MiniMax-M2.1 (模型)         → 文字对话能力
  ├── MiniMax-VL-01 (模型)        → 图片理解能力
  └── MiniMax-M2.1-Video (模型)   → 视频理解能力
```

**正确**: 一个厂家提供多个模型,每个模型有自己的专属能力

---

## 🏗️ 三层架构

### Layer 1: Capability (能力层) - 用户视角
```
💬 文字对话
👁️ 图片理解
🎨 图片生成
🎬 视频理解
```

**用户心智**: "我想聊天" / "我想看图" / "我想生成图"

### Layer 2: Model (模型层) - 系统执行
```
Qwen2.5-7B-Instruct    → 用于文字对话
MiniMax-VL-01          → 用于图片理解
FLUX.1-schnell         → 用于图片生成
```

**系统执行**: 具体调用哪个模型来实现能力

### Layer 3: Provider (厂家层) - 技术细节
```
硅基流动 (Qwen2.5-7B-Instruct)
MiniMax (MiniMax-VL-01)
硅基流动 (FLUX.1-schnell)
```

**技术细节**: 模型来自哪个厂家,API Key 归属

---

## 🎨 UI 设计改进

### 改进 1: 能力卡片优先

**旧设计**: 以厂家为主
```
免费模型
  ├── 硅基流动 [配置]
  ├── MiniMax [配置]
  └── OpenAI [配置]
```

**新设计**: 以能力为主
```
你的模型配置
  ├── 💬 文字对话 [已启用]
  │     └── 当前: Qwen2.5-7B-Instruct (来自 硅基流动)
  │
  ├── 👁️ 图片理解 [已启用]
  │     └── 当前: MiniMax-VL-01 (来自 MiniMax)
  │
  └── 🎨 图片生成 [未配置]
        [+ 添加]
```

### 改进 2: 模型名称可见

**旧设计**: 看不到模型
```
[卡片]
  硅基流动
  ● 已配置
  [查看详情]
```
→ 看不到具体用的是哪个模型

**新设计**: 模型名称突出
```
[卡片]
  💬 文字对话
  ● 已启用

  Qwen2.5-7B-Instruct  ← 主要信息
  来自 硅基流动        ← 次要信息

  今日已用: 1.2K / 50万字

  [切换模型 ▼]
```
→ 清晰看到当前使用的模型

### 改进 3: 模型切换功能

**旧设计**: 无法切换
```
无法切换模型,只能删除厂家重新配置
```

**新设计**: 下拉菜单切换
```
[切换模型 ▼]
  硅基流动 (当前)
    ✓ Qwen2.5-7B    [免费]
    ○ Qwen2.5-72B   [付费]
    ○ DeepSeek-V3   [付费]

  OpenAI (已配置)
    ○ GPT-4.1       [付费]
    ○ GPT-4.1-mini  [便宜]

  MiniMax (未配置)
    [+ 添加 MiniMax 配置]
```
→ 灵活切换同能力的不同模型

### 改进 4: 配置时按模型分组

**旧设计**: 只显示厂家能力
```
配置 MiniMax
  支持的能力:
  ✅ 文字  ✅ 图片

  API Key: [输入框]
  [测试连接] [保存]
```
→ 用户不知道有多个模型,以为一个配置搞定所有

**新设计**: 按模型展示能力
```
配置 MiniMax
  💡 MiniMax 提供多个专业模型

  API Key: [输入框]
  ⏳ 正在检测可用模型...

  ✓ 检测完成! 发现 3 个模型:

  ☑ MiniMax-M2.1
    💬 文字对话
    • Agent/代码专家
    • 200K 上下文

  ☑ MiniMax-VL-01
    👁️ 图片理解
    • 支持图片+文字混合输入
    • 支持多图对话

  ☑ MiniMax-M2.1-Video
    🎬 视频理解
    • 支持视频+文字混合输入
    • 视频场景理解

  [保存配置]
```
→ 清晰展示每个模型及其能力,用户可选择启用哪些

---

## 🔧 特殊情况处理

### 情况 1: 单模型厂家 (Kimi Code)
```
Kimi Code
  └── kimi-for-coding → 文字对话
```
→ 简化展示,不需要选择模型

### 情况 2: 多模型厂家 (MiniMax)
```
MiniMax
  ├── MiniMax-M2.1 → 文字对话
  ├── MiniMax-VL-01 → 图片理解
  └── MiniMax-M2.1-Video → 视频理解
```
→ 配置时按模型分组,每个模型显示自己的能力

### 情况 3: 聚合平台 (硅基流动)
```
硅基流动 (200+ 模型聚合平台)
  ├── 文字对话: Qwen2.5-7B / DeepSeek-V3 / Yi-Lightning (50+)
  ├── 图片理解: Qwen-VL-Plus / Qwen2-VL-72B (15+)
  ├── 图片生成: FLUX.1 / SD3 / FLUX.1-dev (20+)
  └── Embedding: text-embedding-v2 (必需)
```
→ 按能力分组,展示多个可选模型,推荐免费的

---

## 💻 实施要点

### 后端 API 设计

```typescript
// 获取某个能力的所有可用模型
GET /api/model-config/capabilities/{capability}/models
→ 返回所有已配置厂家中支持该能力的模型列表

// 切换能力的当前模型
POST /api/model-config/capabilities/{capability}/switch
{
  "providerId": "siliconflow",
  "modelId": "Qwen2.5-7B-Instruct"
}
→ 切换该能力使用的模型

// 配置厂家时检测所有模型
POST /api/model-config/providers/{providerId}/detect
{
  "apiKey": "sk-xxx"
}
→ 返回该厂家的所有模型及其能力
```

### 前端状态管理

```typescript
interface ModelConfigState {
  // 能力卡片 (用户视角)
  capabilities: {
    text: {
      status: 'active' | 'inactive';
      currentModel: {
        providerId: 'siliconflow';
        modelId: 'Qwen2.5-7B-Instruct';
        modelName: 'Qwen2.5-7B-Instruct';
        isFree: true;
      };
    };
    'image-understanding': { ... };
    'image-generation': { ... };
    video: { ... };
  };

  // 可切换的模型列表
  availableModels: {
    text: [
      { providerId: 'siliconflow', modelId: 'Qwen2.5-7B-Instruct', ... },
      { providerId: 'siliconflow', modelId: 'DeepSeek-V3', ... },
      { providerId: 'openai', modelId: 'GPT-4.1', ... }
    ];
    'image-understanding': [ ... ];
    ...
  };

  // 已配置的厂家
  providers: [
    { id: 'siliconflow', name: '硅基流动', configured: true },
    { id: 'minimax', name: 'MiniMax', configured: false }
  ];
}
```

---

## 📝 总结

### 核心改变
从 **"配置厂家"** 转变为 **"选择能力 → 查看模型 → 切换模型"**

### 信息层次
**Capability (能力) → Model (模型) → Provider (厂家)**
三层架构清晰可见,可控制,可切换

### 用户价值
- ✅ 一眼看到所有能力状态
- ✅ 清楚知道每个能力用的是哪个具体模型
- ✅ 灵活切换到同能力的其他模型
- ✅ 配置时清晰看到每个模型的具体能力
- ✅ 厂家信息降级为次要信息

### 技术实现
- ✅ 后端按能力索引模型
- ✅ 前端能力卡片为主,模型信息可见
- ✅ 模型切换下拉菜单,实时生效
- ✅ 配置向导按模型分组展示能力

---

## 🎯 设计原则

### 1. 用户心智模型匹配
```
用户想法: "我想聊天" (关心能力)
  ↓
系统设计: 💬 文字对话卡片置顶 ✓
  ↓
显示信息: 当前模型 Qwen2.5-7B (清晰)
  ↓
高级操作: 点击切换到其他模型 (可选)
```

### 2. 三层架构清晰可见
```
Layer 1 (用户层): 💬 文字对话
  ↓ 主要信息
Layer 2 (执行层): Qwen2.5-7B-Instruct
  ↓ 次要信息
Layer 3 (技术层): 来自 硅基流动
```

### 3. 一个 API Key,多个模型
```
用户配置硅基流动 API Key
  ↓
系统检测到 200+ 模型
  ↓
按能力分组:
  ├─ 💬 文字: Qwen2.5-7B / DeepSeek-V3 / Yi-Lightning ...
  ├─ 👁️ 图片: Qwen-VL-Plus / Qwen2-VL-72B ...
  ├─ 🎨 生成: FLUX.1 / SD3 ...
  └─ 🧩 Embedding: text-embedding-v2 (必需)
```

---

> **核心洞察**: 用户不关心 "我配置了哪些厂家",而关心 "我能做什么" + "我正在用哪个模型"。通过 Capability → Model → Provider 三层架构,让每一层信息都清晰可见,可控制,可切换。

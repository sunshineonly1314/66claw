# 模型配置页面 - 智能卡片设计方案 (参考顶级产品)

> 设计理念: **Zero-config First, Smart Detection, Visual Clarity**
> 参考产品: Vercel Dashboard, Raycast Extensions, Cursor Settings, Notion Integrations

---

## 🏗️ 核心概念: Provider → Model → Capability 三层架构

### 关系图解

```
Provider (厂家/平台)
  ├── Model 1 (模型)
  │     ├── Capability A (能力: 文字对话)
  │     └── Capability B (能力: 工具调用)
  ├── Model 2 (模型)
  │     ├── Capability C (能力: 图片理解)
  │     └── Capability D (能力: 多模态)
  └── Model 3 (模型)
        └── Capability E (能力: 图片生成)
```

### 真实案例对比

**❌ 错误理解: "MiniMax 支持文字+图片"**
```
MiniMax (厂家)
  └── 支持: 文字 + 图片  ← 错误! 厂家不等于单一模型
```

**✅ 正确理解: "MiniMax 的不同模型有不同能力"**
```
MiniMax (厂家)
  ├── MiniMax-M2.1 → 文字对话 (Agent/代码专家)
  ├── MiniMax-VL-01 → 图片理解 (多模态视觉)
  └── MiniMax-M2.1-Video → 视频理解 (视频分析)
```

### UI 设计原则

1. **顶层: 能力视角** (用户关心 "我想做什么")
   - 💬 文字对话
   - 👁️ 图片理解
   - 🎨 图片生成
   - 🎬 视频理解

2. **中层: 模型选择** (系统展示 "用哪个模型实现")
   - Qwen2.5-7B-Instruct (for 文字对话)
   - MiniMax-VL-01 (for 图片理解)
   - FLUX.1-schnell (for 图片生成)

3. **底层: 厂家归属** (技术细节)
   - 硅基流动 (Qwen2.5-7B-Instruct)
   - MiniMax (MiniMax-VL-01)
   - 硅基流动 (FLUX.1-schnell)

### 特殊情况处理

**情况 1: 单模型厂家 (Kimi Code)**
```
Kimi Code (厂家) = kimi-for-coding (模型) = 文字对话 (能力)
```
→ 简化展示,不需要选择模型

**情况 2: 多模型厂家 (MiniMax)**
```
MiniMax (厂家)
  ├── MiniMax-M2.1 → 文字对话
  ├── MiniMax-VL-01 → 图片理解
  └── MiniMax-M2.1-Video → 视频理解
```
→ 配置时按模型分组展示

**情况 3: 聚合平台 (硅基流动)**
```
硅基流动 (平台)
  ├── 文字对话: Qwen2.5-7B / DeepSeek-V3 / Yi-Lightning ...
  ├── 图片理解: Qwen-VL-Plus / Qwen2-VL-72B ...
  ├── 图片生成: FLUX.1-schnell / SD3 ...
  └── Embedding: text-embedding-v2 (必需)
```
→ 按能力分组,展示多个可选模型

---

## 🎯 设计目标

### 用户心智模型
```
小白用户: "我想聊天 / 看图 / 生成图"  ← 关心能力
进阶用户: "我想用 GPT-4 / Claude / Qwen"  ← 关心模型
```

### 系统交互目标
```
1. 首次进入: 3秒理解页面,30秒完成配置
2. 日常使用: 一眼看到所有能力状态
3. 高级配置: 展开详情,精细控制模型选择
```

---

## 📐 页面布局

### 整体结构 (参考 Raycast Extensions)

```
┌─────────────────────────────────────────────────────────────────┐
│  模型配置                          [智能推荐] [高级设置]         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🚀 快速开始 (首次使用显示)                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │   👋 欢迎使用 OpenClawCN                                   │ │
│  │                                                           │ │
│  │   ⚠️ 开始前必须完成的配置:                                 │ │
│  │                                                           │ │
│  │   1️⃣ 硅基流动 (必须配置,需实名认证)                        │ │
│  │      用于智能推荐 skills 和 MCP 工具                       │ │
│  │      [🔗 去实名认证并获取 API Key]                         │ │
│  │                                                           │ │
│  │   ┌─────────────────────────────────────────────────┐   │ │
│  │   │ 硅基流动 API Key:                                 │   │ │
│  │   │ ┌───────────────────────────────────────────┐   │   │ │
│  │   │ │ sk-xxxxxxxxxxxxxxxxxxxxxxx                │   │   │ │
│  │   │ └───────────────────────────────────────────┘   │   │ │
│  │   │                                                   │   │ │
│  │   │ ⏳ 粘贴后自动验证...                              │   │ │
│  │   └─────────────────────────────────────────────────┘   │ │
│  │                                                           │ │
│  │   2️⃣ 免费模型 (可选,推荐开启)                              │ │
│  │      ✓ LongCat - 每天50万字                             │ │
│  │      ✓ 蚂蚁百灵 - 每天50万字                             │ │
│  │      [☑️ 同时启用免费模型]                                │ │
│  │                                                           │ │
│  │   [下一步]                                                │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  📊 你的模型配置 (已配置后显示)                                  │
│                                                                 │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌────────────┐│
│  │ 💬 文字对话          │ │ 👁️ 图片理解          │ │ 🎨 图片生成 ││
│  │                     │ │                     │ │            ││
│  │ ● 已启用            │ │ ○ 未配置            │ │ ○ 未配置   ││
│  │                     │ │                     │ │            ││
│  │ 🎁 LongCat          │ │                     │ │            ││
│  │ 今日已用: 1.2K/50万字│ │ 推荐配置:            │ │ 推荐配置:   ││
│  │                     │ │                     │ │            ││
│  │ 🎁 蚂蚁百灵 (备用)   │ │ • 硅基流动           │ │ • 硅基流动  ││
│  │ 自动切换            │ │   Qwen-VL-Plus      │ │   FLUX.1    ││
│  │                     │ │                     │ │            ││
│  │ [切换模型 ▼]        │ │ • MiniMax           │ │ [+ 添加]   ││
│  │  ├ Qwen2.5-7B       │ │   MiniMax-VL-01     │ │            ││
│  │  ├ DeepSeek-V3      │ │                     │ │            ││
│  │  └ GPT-4.1          │ │ [+ 添加]            │ │            ││
│  └─────────────────────┘ └─────────────────────┘ └────────────┘│
│                                                                 │
│  🔧 其他模型平台 (可选配置)                                      │
│                                                                 │
│  ⚠️ 必选配置                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 硅基流动  [已配置 ✅]  🔮 智能推荐必需 需实名认证         │   │
│  │          embedding: text-embedding-v2 (已验证)         │   │
│  │          [重新配置] [查看详情]                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🇨🇳 国内主流推荐 (优先配置)                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ⭐ Kimi Code    [未配置 ○]  💻 代码专用 262K上下文 极速  │   │
│  │                            点击后自动测试+启用所有模型   │   │
│  │ 通义千问        [未配置 ○]  ☁️ 阿里出品 送100万Token    │   │
│  │                            自动启用: 文字+图片+Embedding │   │
│  │ MiniMax        [未配置 ○]  ⚡ M2.1 支持文字+图片+视频    │   │
│  │                            自动启用: 文字+图片+视频+嵌入 │   │
│  │ 豆包            [未配置 ○]  🔥 字节出品 响应快 便宜      │   │
│  │                            自动启用: 文字+图片理解      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🇨🇳 更多国内服务  [展开 ▼]                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ DeepSeek      [未配置 ○]  🚀 性价比之王 仅文字对话      │   │
│  │ 智谱GLM       [未配置 ○]  🧠 GLM-4 永久免费 文字+图片   │   │
│  │ Kimi(月之暗面) [未配置 ○]  🌙 长上下文之王 1M tokens    │   │
│  │ 腾讯混元      [未配置 ○]  💫 混元大模型系列 文字+图片    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🌐 国际服务 (需要科学上网)  [展开 ▼]                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ OpenAI        [未配置 ○]  🤖 GPT-4.1/o3 ChatGPT官方     │   │
│  │                            自动启用: 文字+图片+Embedding │   │
│  │ Anthropic     [未配置 ○]  🧬 Claude Sonnet4 编程最强    │   │
│  │                            自动启用: 文字+图片理解      │   │
│  │ Google Gemini [未配置 ○]  🔷 Gemini 3 免费额度充足      │   │
│  │                            自动启用: 文字+图片+Embedding │   │
│  │ NVIDIA NIM    [未配置 ○]  💚 高性能推理 有免费额度       │   │
│  │                            自动启用: 文字对话           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🔧 本地模型 & 自定义  [展开 ▼]                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Ollama        [未配置 ○]  🦙 本地运行 完全免费          │   │
│  │ OpenAI兼容    [未配置 ○]  🔌 兼容OpenAI格式的其他服务   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  💡 提示: LongCat和蚂蚁百灵每天共100万字免费额度,用完后需配置其他模型│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 核心交互设计

### 1. 必选配置: 硅基流动 (智能推荐必需)

**首次进入页面,必须先配置硅基流动:**

```
┌─────────────────────────────────────────────────────────┐
│  配置硅基流动 (必需)                           [关闭 ×]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ⚠️ 为什么必须配置硅基流动?                              │
│                                                         │
│  硅基流动提供 embedding 能力,用于:                       │
│  • 智能推荐 skills (工具插件)                            │
│  • 智能推荐 MCP 服务器                                   │
│  • 向量搜索和语义匹配                                    │
│                                                         │
│  没有它,智能推荐功能将无法使用                           │
│                                                         │
│  步骤 1: 实名认证并获取 API Key                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ⚠️ 必须完成实名认证才能使用                     │   │
│  │                                                 │   │
│  │  1. 访问 siliconflow.cn 注册账号                │   │
│  │  2. 完成实名认证 (上传身份证/护照)              │   │
│  │  3. 进入控制台 → API密钥                        │   │
│  │  4. 创建新密钥并复制                            │   │
│  │                                                 │   │
│  │  [🔗 打开硅基流动官网完成实名]                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  步骤 2: 粘贴 API Key 并验证                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │ sk-xxxxxxxxxxxxxxxxxxxxx                 │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  │                                                 │   │
│  │  ⏳ 正在验证 embedding 能力...                   │   │
│  │                                                 │   │
│  │  ✓ 检测到 text-embedding-v2 模型 ✅              │   │
│  │  ✓ embedding 测试通过 ✅                         │   │
│  │  ✓ 实名认证状态: 已认证 ✅                       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [保存配置]                                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**如果验证失败:**

```
┌─────────────────────────────────────────────────────────┐
│  配置硅基流动 (必需)                           [关闭 ×]  │
├─────────────────────────────────────────────────────────┤
│  ...                                                    │
│  步骤 2: 粘贴 API Key 并验证                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │ sk-xxxxxxxxxxxxxxxxxxxxx                 │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  │                                                 │   │
│  │  ❌ 验证失败                                     │   │
│  │                                                 │   │
│  │  错误原因: 实名认证未完成                        │   │
│  │                                                 │   │
│  │  请按以下步骤解决:                               │   │
│  │  1. 登录硅基流动官网                            │   │
│  │  2. 进入 个人中心 → 实名认证                    │   │
│  │  3. 上传身份证件并等待审核(约1-2小时)           │   │
│  │  4. 认证通过后重新输入 API Key                  │   │
│  │                                                 │   │
│  │  [🔗 前往实名认证]                               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [重新验证]                                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**技术实现:**
```typescript
// 验证硅基流动配置 (必须检查 embedding 能力)
async function verifySiliconFlowConfig(apiKey: string) {
  try {
    // 1. 测试 API Key 有效性
    const response = await fetch('https://api.siliconflow.cn/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!response.ok) {
      throw new Error('API Key 无效或已过期');
    }

    // 2. 检查是否有 embedding 模型
    const models = await response.json();
    const embeddingModel = models.data.find(m =>
      m.id.includes('embedding') || m.id === 'text-embedding-v2'
    );

    if (!embeddingModel) {
      throw new Error('该账号未开通 embedding 能力');
    }

    // 3. 测试 embedding 接口
    const testResponse = await fetch('https://api.siliconflow.cn/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-v2',
        input: 'test'
      })
    });

    if (!testResponse.ok) {
      const error = await testResponse.json();
      // 检查是否因为实名认证失败
      if (error.error?.code === 'account_not_verified') {
        throw new Error('实名认证未完成,请先完成实名认证');
      }
      throw new Error(`embedding 测试失败: ${error.error?.message}`);
    }

    // 4. 验证成功
    return {
      success: true,
      embeddingModel: embeddingModel.id,
      verified: true
    };

  } catch (err) {
    return {
      success: false,
      error: err.message,
      suggestion: getSuggestion(err.message)
    };
  }
}

function getSuggestion(errorMsg: string): string {
  if (errorMsg.includes('实名认证')) {
    return '请访问硅基流动官网完成实名认证,审核通过后(约1-2小时)再试';
  }
  if (errorMsg.includes('API Key')) {
    return '请检查 API Key 是否正确复制,注意不要有多余的空格';
  }
  if (errorMsg.includes('embedding')) {
    return '请联系硅基流动客服开通 embedding 权限';
  }
  return '请重新获取 API Key 后再试';
}
```

---

### 2. 能力卡片 (参考 Notion Integrations 卡片)

**大卡片设计 - 清晰的视觉层次**

```css
/* 已配置状态 - 绿色边框 + 渐变背景 */
.capability-card--active {
  border: 2px solid #10b981;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, transparent 100%);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);
}

/* 未配置状态 - 虚线边框 + 灰色背景 */
.capability-card--inactive {
  border: 2px dashed #d1d5db;
  background: var(--card);
  opacity: 0.7;
}

/* 卡片内容 */
.capability-card {
  padding: 24px;
  border-radius: 12px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.capability-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
```

**卡片内容结构 (强调模型层级):**

```html
<div class="capability-card capability-card--active">
  <!-- Header: 能力名称 + 状态 -->
  <div class="card-header">
    <span class="card-icon">💬</span>
    <h3 class="card-title">文字对话</h3>
    <span class="card-status card-status--active">● 已启用</span>
  </div>

  <!-- Current Model: 模型名称 (主要信息) -->
  <div class="card-model">
    <div class="model-name-primary">
      Qwen2.5-7B-Instruct
      <span class="model-badge model-badge--free">免费</span>
    </div>
    <div class="model-provider-secondary">
      <img src="siliconflow-icon.svg" class="provider-icon-small" />
      <span class="provider-name-small">来自 硅基流动</span>
    </div>
  </div>

  <!-- Usage Stats (紧凑条形图) -->
  <div class="card-usage">
    <div class="usage-bar">
      <div class="usage-fill" style="width: 2.4%"></div>
    </div>
    <span class="usage-text">今日已用: 1.2K / 50万字</span>
  </div>

  <!-- Actions: 切换模型 (下拉菜单) -->
  <details class="card-details">
    <summary>切换到其他模型</summary>
    <div class="card-model-list">
      <!-- 同厂家其他模型 -->
      <div class="model-group">
        <div class="model-group-title">硅基流动 (当前)</div>
        <button class="model-option model-option--active">
          <span class="model-option-name">✓ Qwen2.5-7B-Instruct</span>
          <span class="model-option-badge">免费</span>
        </button>
        <button class="model-option">
          <span class="model-option-name">Qwen2.5-72B-Instruct</span>
          <span class="model-option-badge">付费</span>
        </button>
        <button class="model-option">
          <span class="model-option-name">DeepSeek-V3</span>
          <span class="model-option-badge">付费</span>
        </button>
      </div>

      <!-- 其他已配置厂家 -->
      <div class="model-group">
        <div class="model-group-title">OpenAI (已配置)</div>
        <button class="model-option">
          <span class="model-option-name">GPT-4.1</span>
          <span class="model-option-badge">付费</span>
        </button>
        <button class="model-option">
          <span class="model-option-name">GPT-4.1-mini</span>
          <span class="model-option-badge">便宜</span>
        </button>
      </div>

      <!-- 未配置厂家 (提示添加) -->
      <div class="model-group model-group--unconfigured">
        <div class="model-group-title">MiniMax (未配置)</div>
        <button class="model-add-btn">
          + 添加 MiniMax 配置
        </button>
      </div>
    </div>
  </details>
</div>
```

---

### 3. 添加其他模型 (用户自己申请)

**示例 1: Kimi Code (单模态 - 仅文字)**

```
┌─────────────────────────────────────────────────────────┐
│  配置 Kimi Code                                [关闭 ×]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📋 支持的模态能力                                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✅ 💬 文字对话     ❌ 👁️ 图片理解                 │   │
│  │ ❌ 🎨 图片生成     ❌ 🎬 视频理解                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  💡 Kimi Code 专注代码场景,262K超长上下文,100 T/s极速    │
│                                                         │
│  步骤 1: 获取 API Key                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │  1. 访问 kimi.com/code/docs 查看文档             │   │
│  │  2. 注册账号并获取 API Key                       │   │
│  │  3. 复制密钥                                     │   │
│  │                                                 │   │
│  │  [🔗 打开 Kimi Code 官网]                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  步骤 2: 粘贴 API Key                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │ sk-xxxxxxxxxxxxxxxxxxxxx                 │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  │                                                 │   │
│  │  ⏳ 正在检测可用模型...                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ✓ 检测完成! 发现以下可用模型:                           │
│                                                         │
│  💬 文字对话                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ☑ kimi-for-coding (推荐)                        │   │
│  │    • 262K 上下文                                 │   │
│  │    • 100 Tokens/s 极速响应                       │   │
│  │    • 代码专用优化                                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  💡 Kimi Code 只支持文字对话,如需图片/视频能力,请配置其他平台│
│                                                         │
│  [取消]  [保存配置]                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

**示例 2: MiniMax (多模型 - 不同模型有不同能力)**

**关键改变: 按模型分组,每个模型清晰标注自己的能力**

```
┌──────────────────────────────────────────────────────────────┐
│  配置 MiniMax                                     [关闭 ×]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  💡 MiniMax 提供多种专业模型,每个模型有不同的能力              │
│                                                              │
│  步骤 1: 获取 API Key                                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │  1. 访问 minimax.io 注册账号                        │     │
│  │  2. 进入控制台 → API密钥                            │     │
│  │  3. 创建新密钥并复制                                │     │
│  │                                                    │     │
│  │  [🔗 打开 MiniMax 官网]                             │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  步骤 2: 粘贴 API Key                                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │  ┌─────────────────────────────────────────────┐  │     │
│  │  │ minimax-xxxxxxxxxxxxxxxxxxxxx               │  │     │
│  │  └─────────────────────────────────────────────┘  │     │
│  │                                                    │     │
│  │  ⏳ 正在检测可用模型...                             │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ✓ 检测完成! 你的账号可以使用以下模型:                        │
│                                                              │
│  ┌─────────────────── 模型列表 ────────────────────────┐    │
│  │                                                      │    │
│  │  ☑ MiniMax-M2.1  (推荐开启) ⭐                       │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │ 💬 文字对话                                   │  │    │
│  │  │ • Agent/代码专家                              │  │    │
│  │  │ • 200K 上下文                                 │  │    │
│  │  │ • 支持工具调用                                │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  │                                                      │    │
│  │  ☑ MiniMax-VL-01                                    │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │ 👁️ 图片理解                                   │  │    │
│  │  │ • 支持图片+文字混合输入                        │  │    │
│  │  │ • 图像理解准确率高                            │  │    │
│  │  │ • 支持多图对话                                │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  │                                                      │    │
│  │  ☑ MiniMax-M2.1-Video                               │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │ 🎬 视频理解                                   │  │    │
│  │  │ • 支持视频+文字混合输入                        │  │    │
│  │  │ • 视频场景理解                                │  │    │
│  │  │ • 视频内容摘要                                │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  │                                                      │    │
│  │  ☐ MiniMax-Text-Embedding-v1                        │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │ 🧩 文本嵌入 (向量化)                          │  │    │
│  │  │ • 文本相似度计算                              │  │    │
│  │  │ • 语义搜索                                    │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ✅ 检测完成! 自动启用所有可用模型:                              │
│  • 文字对话: MiniMax-M2.1                                       │
│  • 图片理解: MiniMax-VL-01                                      │
│  • 视频理解: MiniMax-M2.1-Video                                 │
│  • 文本嵌入: MiniMax-Text-Embedding-v1                          │
│                                                              │
│  💡 配置后,您可以在能力卡片中切换到其他模型                     │
│                                                              │
│  [取消]  [保存配置 (启用 4 个模型)]                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

**示例 3: 硅基流动 (全能型 - 多模型聚合平台)**

**关键改变: 硅基流动是模型聚合平台,按能力分组展示所有模型**

```
┌───────────────────────────────────────────────────────────────┐
│  配置 硅基流动 (必选)                              [关闭 ×]   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  💡 硅基流动是模型聚合平台,一个 API Key 可使用多家厂商模型     │
│  ⚠️ Embedding 能力是智能推荐 skills/MCP 的必需项              │
│                                                               │
│  步骤 1: 实名认证并获取 API Key                                │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  ⚠️ 必须完成实名认证才能使用                         │     │
│  │  1. 访问 siliconflow.cn 注册账号                    │     │
│  │  2. 完成实名认证 (上传身份证/护照)                  │     │
│  │  3. 进入控制台 → API密钥                            │     │
│  │  4. 创建新密钥并复制                                │     │
│  │                                                     │     │
│  │  [🔗 打开硅基流动官网完成实名]                       │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  步骤 2: 粘贴 API Key                                          │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  ┌──────────────────────────────────────────────┐  │     │
│  │  │ sk-xxxxxxxxxxxxxxxxxxxxx                     │  │     │
│  │  └──────────────────────────────────────────────┘  │     │
│  │                                                     │     │
│  │  ⏳ 正在检测可用模型... (硅基流动有 200+ 模型)        │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ✓ 检测完成! 推荐配置以下模型:                                 │
│                                                               │
│  ┌──────────────── 模型列表 (按能力分组) ──────────────────┐  │
│  │                                                          │  │
│  │  💬 文字对话模型 (5/50+ 已展示)  [展开查看全部 ▼]        │  │
│  │  ┌────────────────────────────────────────────────┐    │  │
│  │  │ ☑ Qwen2.5-7B-Instruct                          │    │  │
│  │  │   🎁 免费 · 7B参数 · 通用对话 · 上下文 32K      │    │  │
│  │  │                                                │    │  │
│  │  │ ☐ Qwen2.5-72B-Instruct                         │    │  │
│  │  │   💰 付费 · 72B参数 · 高质量 · 上下文 32K      │    │  │
│  │  │                                                │    │  │
│  │  │ ☐ DeepSeek-V3                                  │    │  │
│  │  │   💰 付费 · 685B参数 · 性价比之王 · 64K        │    │  │
│  │  │                                                │    │  │
│  │  │ ☐ Yi-Lightning                                 │    │  │
│  │  │   💰 付费 · 零一万物 · 极速响应 · 16K          │    │  │
│  │  │                                                │    │  │
│  │  │ ☐ Llama-3.3-70B-Instruct                       │    │  │
│  │  │   🎁 免费 · Meta官方 · 128K上下文              │    │  │
│  │  └────────────────────────────────────────────────┘    │  │
│  │                                                          │  │
│  │  👁️ 图片理解模型 (2/15+ 已展示)  [展开查看全部 ▼]        │  │
│  │  ┌────────────────────────────────────────────────┐    │  │
│  │  │ ☑ Qwen-VL-Plus                                 │    │  │
│  │  │   🎁 免费 · 多模态理解 · 支持多图对话           │    │  │
│  │  │                                                │    │  │
│  │  │ ☐ Qwen2-VL-72B                                 │    │  │
│  │  │   💰 付费 · 72B参数 · 高精度图像理解           │    │  │
│  │  └────────────────────────────────────────────────┘    │  │
│  │                                                          │  │
│  │  🎨 图片生成模型 (2/20+ 已展示)  [展开查看全部 ▼]        │  │
│  │  ┌────────────────────────────────────────────────┐    │  │
│  │  │ ☑ FLUX.1-schnell                               │    │  │
│  │  │   🎁 免费 · 快速生成 · 1024x1024              │    │  │
│  │  │                                                │    │  │
│  │  │ ☐ Stable Diffusion 3 Medium                    │    │  │
│  │  │   💰 付费 · 高质量 · 支持多种尺寸              │    │  │
│  │  └────────────────────────────────────────────────┘    │  │
│  │                                                          │  │
│  │  🎬 视频理解模型 (1/5+ 已展示)  [展开查看全部 ▼]         │  │
│  │  ┌────────────────────────────────────────────────┐    │  │
│  │  │ ☑ Qwen2-VL-7B                                  │    │  │
│  │  │   🎁 免费 · 视频场景理解 · 支持长视频          │    │  │
│  │  └────────────────────────────────────────────────┘    │  │
│  │                                                          │  │
│  │  🧩 Embedding模型 (必需,已自动勾选,不可取消) 🔒          │  │
│  │  ┌────────────────────────────────────────────────┐    │  │
│  │  │ ☑ text-embedding-v2                            │    │  │
│  │  │   🎁 免费 · 智能推荐 skills/MCP 必需            │    │  │
│  │  │   • 文本向量化 · 语义搜索                      │    │  │
│  │  └────────────────────────────────────────────────┘    │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                               │
│  ✅ 检测完成! 自动启用所有免费模型:                               │
│  • 文字对话: Qwen2.5-7B-Instruct, Llama-3.3-70B-Instruct       │
│  • 图片理解: Qwen-VL-Plus                                       │
│  • 图片生成: FLUX.1-schnell                                     │
│  • 视频理解: Qwen2-VL-7B                                        │
│  • Embedding: text-embedding-v2 (智能推荐必需)                 │
│                                                               │
│  💡 自动优先选择免费模型,付费模型可在能力卡片中手动切换          │
│                                                               │
│  [取消]  [保存配置 (启用 6 个模型)]                             │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**关键特性:**
1. **输入即检测**: 粘贴API Key后,自动触发检测(无需点"测试连接")
2. **全自动启用**: 检测到的所有可用模型自动启用,无需用户手动勾选
3. **智能推荐**: 系统优先推荐免费模型,自动配置最佳组合
4. **视觉反馈**: 实时显示检测进度(加载动画 → 成功 ✅)
5. **完整支持**: 与setup页面保持一致,支持所有提供商

---

## 🎯 关键改进点对比

### 旧设计 vs 新设计

| 维度 | 旧设计 (free-models.ts) | 新设计 (smart-cards) |
|------|------------------------|---------------------|
| **信息架构** | Provider 为主 (厂家列表) | Capability 为主 → Model → Provider |
| **首次配置** | 需要逐个点击Provider卡片 | 一键配置免费模型 (3秒完成) |
| **视觉层次** | 列表式,所有信息平铺 | 大卡片 + 折叠详情,层次清晰 |
| **状态呈现** | 小图标 + 文字描述 | 大面积颜色 + 状态点 + 进度条 |
| **添加模型** | 弹窗 → 填表 → 测试 → 保存 | 输入 → 自动检测 → 勾选模型 → 完成 |
| **能力感知** | 看不到能力,只看到Provider | 能力卡片置顶,清晰展示每个模型的能力 |
| **模型选择** | 不可见,用户不知道具体用哪个模型 | 清晰展示当前模型,可下拉切换 |
| **交互步骤** | 5步 (选择→填写→测试→确认→刷新) | 2步 (输入→确认) |
| **错误处理** | 弹窗提示错误信息 | 实时验证 + 内联错误提示 |
| **高级功能** | 全部平铺展示 | 折叠到"切换模型"下拉菜单 |

### 信息架构对比图

**旧设计 (Provider-First):**
```
免费模型配置
  ├── 硅基流动 [配置]
  ├── MiniMax [配置]
  ├── OpenAI [配置]
  └── ...

问题:
- 用户不知道配置后能做什么
- 看不到模型具体是什么
- 不清楚哪个能力用哪个模型
```

**新设计 (Capability → Model → Provider):**
```
你的模型配置
  ├── 💬 文字对话 [已启用]
  │     └── 当前: Qwen2.5-7B-Instruct (来自 硅基流动)
  │         [切换模型 ▼]
  │           ├── 硅基流动
  │           │   ├── Qwen2.5-7B-Instruct ✓
  │           │   ├── Qwen2.5-72B-Instruct
  │           │   └── DeepSeek-V3
  │           └── OpenAI
  │               ├── GPT-4.1
  │               └── GPT-4.1-mini
  │
  ├── 👁️ 图片理解 [已启用]
  │     └── 当前: MiniMax-VL-01 (来自 MiniMax)
  │         [切换模型 ▼]
  │           ├── MiniMax
  │           │   └── MiniMax-VL-01 ✓
  │           └── 硅基流动
  │               ├── Qwen-VL-Plus
  │               └── Qwen2-VL-72B
  │
  └── 🎨 图片生成 [未配置]
        [+ 添加]

优势:
✓ 用户一眼看到所有能力
✓ 清晰知道每个能力用的是哪个具体模型
✓ 可以灵活切换到同能力的其他模型
✓ 厂家信息降级为次要信息
```

---

## 🛠️ 技术实现要点

### 1. 验证硅基流动配置 (必选)
```typescript
// cn/src/gateway/server-methods/siliconflow-verify.ts
export async function verifySiliconFlowRequired(apiKey: string) {
  // 硅基流动是必选的,因为智能推荐依赖它的 embedding

  // Step 1: 验证 API Key 有效性
  const modelsResponse = await fetch('https://api.siliconflow.cn/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!modelsResponse.ok) {
    return {
      success: false,
      error: 'API Key 无效或已过期',
      suggestion: '请检查是否正确复制了 API Key'
    };
  }

  // Step 2: 检查 embedding 模型可用性
  const models = await modelsResponse.json();
  const embeddingModel = models.data.find(m =>
    m.id === 'text-embedding-v2' || m.id.includes('embedding')
  );

  if (!embeddingModel) {
    return {
      success: false,
      error: '未检测到 embedding 模型',
      suggestion: '请联系硅基流动客服开通 embedding 权限'
    };
  }

  // Step 3: 测试 embedding 接口 (检测实名认证)
  const embeddingTest = await fetch('https://api.siliconflow.cn/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: embeddingModel.id,
      input: 'test embedding verification'
    })
  });

  if (!embeddingTest.ok) {
    const error = await embeddingTest.json();

    // 检查是否实名认证问题
    if (error.error?.code === 'account_not_verified' ||
        error.error?.message?.includes('实名')) {
      return {
        success: false,
        error: '实名认证未完成',
        suggestion: '请访问硅基流动官网完成实名认证,审核通过(约1-2小时)后再试',
        helpUrl: 'https://siliconflow.cn/account/verify'
      };
    }

    return {
      success: false,
      error: `embedding 测试失败: ${error.error?.message}`,
      suggestion: '请确保账号有 embedding 使用权限'
    };
  }

  // Step 4: 保存配置
  await saveRequiredProvider({
    id: 'siliconflow',
    name: '硅基流动',
    apiKey,
    required: true, // 标记为必选
    capabilities: ['embedding', 'text', 'image-understanding', 'image-generation'],
    embeddingModel: embeddingModel.id,
    verifiedAt: new Date().toISOString()
  });

  return {
    success: true,
    embeddingModel: embeddingModel.id,
    verified: true
  };
}
```

### 2. 智能卡片状态管理
```typescript
interface CapabilityCardState {
  capability: 'text' | 'image-understanding' | 'image-generation' | 'video';
  status: 'active' | 'inactive' | 'error';
  provider: {
    id: string;
    name: string;
    icon: string;
    isFree: boolean;
  } | null;
  model: {
    name: string;
    displayName: string;
  } | null;
  usage: {
    current: number;
    limit: number;
    unit: string;
  } | null;
  actions: {
    switchModel: () => void;
    viewHistory: () => void;
    remove: () => void;
  };
}
```

### 3. 自动检测 + 自动启用 (核心逻辑)
```typescript
// src/gateway/server-methods/model-auto-enable.ts

/**
 * 用户输入 API Key 后,全自动流程:
 * 1. 检测该 Provider 的所有可用模型
 * 2. 测试每个模型是否真的能用
 * 3. 自动启用所有可用的模型 (优先免费)
 * 4. 返回启用结果给前端
 */
export async function autoEnableModels(
  providerId: string,
  apiKey: string
): Promise<AutoEnableResult> {
  const results: AutoEnableResult = {
    providerId,
    enabled: {
      text: [],
      'image-understanding': [],
      'image-generation': [],
      video: [],
      embedding: []
    },
    failed: [],
    summary: ''
  };

  try {
    // Step 1: 获取该 Provider 的所有模型列表
    const allModels = await fetchProviderModels(providerId, apiKey);
    console.log(`[${providerId}] 检测到 ${allModels.length} 个模型`);

    // Step 2: 逐个测试模型是否可用
    for (const model of allModels) {
      try {
        // 测试模型 (发送简单请求验证)
        const isAvailable = await testModel(providerId, apiKey, model.id);

        if (isAvailable) {
          // 按能力分组记录
          for (const capability of model.capabilities) {
            if (results.enabled[capability]) {
              results.enabled[capability].push({
                modelId: model.id,
                modelName: model.displayName || model.id,
                isFree: model.pricing?.type === 'free',
                capabilities: model.capabilities
              });
            }
          }
        } else {
          results.failed.push({
            modelId: model.id,
            reason: '测试失败,该账号可能未开通此模型'
          });
        }
      } catch (err) {
        results.failed.push({
          modelId: model.id,
          reason: `测试异常: ${err.message}`
        });
      }
    }

    // Step 3: 自动选择默认模型 (优先免费)
    for (const capability of Object.keys(results.enabled)) {
      const models = results.enabled[capability];
      if (models.length > 0) {
        // 优先选择免费模型
        const freeModel = models.find(m => m.isFree);
        const defaultModel = freeModel || models[0];

        // 保存为该能力的当前模型
        await saveCapabilityModel(capability, {
          providerId,
          modelId: defaultModel.modelId,
          modelName: defaultModel.modelName,
          isFree: defaultModel.isFree
        });
      }
    }

    // Step 4: 生成摘要
    const totalEnabled = Object.values(results.enabled)
      .reduce((sum, arr) => sum + arr.length, 0);
    results.summary = `自动启用 ${totalEnabled} 个模型 (${results.failed.length} 个不可用)`;

    return results;

  } catch (err) {
    throw new Error(`自动启用失败: ${err.message}`);
  }
}

/**
 * 测试单个模型是否可用
 */
async function testModel(
  providerId: string,
  apiKey: string,
  modelId: string
): Promise<boolean> {
  try {
    // 根据 Provider 调用对应的 API
    const endpoint = getProviderEndpoint(providerId, modelId);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      }),
      signal: AbortSignal.timeout(5000) // 5秒超时
    });

    return response.ok;
  } catch (err) {
    console.warn(`[${providerId}:${modelId}] 测试失败:`, err.message);
    return false;
  }
}

interface AutoEnableResult {
  providerId: string;
  enabled: {
    text: EnabledModel[];
    'image-understanding': EnabledModel[];
    'image-generation': EnabledModel[];
    video: EnabledModel[];
    embedding: EnabledModel[];
  };
  failed: { modelId: string; reason: string }[];
  summary: string;
}

interface EnabledModel {
  modelId: string;
  modelName: string;
  isFree: boolean;
  capabilities: string[];
}
```
```

### 4. 模型切换系统

```typescript
// src/gateway/server-methods/model-switch.ts

interface ModelConfig {
  capability: string;  // 'text' | 'image-understanding' | 'image-generation' | 'video'
  providerId: string;  // 'siliconflow' | 'minimax' | 'openai' ...
  modelId: string;     // 'Qwen2.5-7B-Instruct' | 'GPT-4.1' ...
  displayName: string; // 显示名称
  isFree: boolean;     // 是否免费
}

interface CapabilityModelMapping {
  text: ModelConfig[];
  'image-understanding': ModelConfig[];
  'image-generation': ModelConfig[];
  video: ModelConfig[];
}

// 获取某个能力的所有可用模型
export async function getModelsForCapability(capability: string): Promise<ModelConfig[]> {
  const allProviders = await getAllConfiguredProviders();
  const models: ModelConfig[] = [];

  for (const provider of allProviders) {
    const providerModels = await getProviderModels(provider.id, provider.apiKey);

    for (const model of providerModels) {
      if (model.capabilities.includes(capability)) {
        models.push({
          capability,
          providerId: provider.id,
          modelId: model.id,
          displayName: model.displayName || model.id,
          isFree: model.pricing?.type === 'free'
        });
      }
    }
  }

  return models;
}

// 切换能力的当前模型
export async function switchCapabilityModel(
  capability: string,
  providerId: string,
  modelId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 验证模型是否支持该能力
    const model = await getModel(providerId, modelId);
    if (!model.capabilities.includes(capability)) {
      return {
        success: false,
        error: `模型 ${modelId} 不支持 ${capability} 能力`
      };
    }

    // 2. 保存配置
    await saveCapabilityModelConfig(capability, {
      providerId,
      modelId,
      modelName: model.displayName || model.id,
      switchedAt: new Date().toISOString()
    });

    // 3. 通知前端更新
    emitModelSwitched(capability, providerId, modelId);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `切换失败: ${err.message}`
    };
  }
}
```

### 5. 前端状态管理

```typescript
// ui/src/ui/controllers/model-config.ts

interface ModelConfigState {
  // 能力卡片状态
  capabilities: {
    text: CapabilityCard;
    'image-understanding': CapabilityCard;
    'image-generation': CapabilityCard;
    video: CapabilityCard;
  };

  // 可用模型列表 (用于切换)
  availableModels: {
    text: ModelConfig[];
    'image-understanding': ModelConfig[];
    'image-generation': ModelConfig[];
    video: ModelConfig[];
  };

  // 配置的厂家列表
  providers: ProviderConfig[];
}

interface CapabilityCard {
  capability: string;
  status: 'active' | 'inactive';
  currentModel: {
    providerId: string;
    providerName: string;
    modelId: string;
    modelName: string;
    isFree: boolean;
  } | null;
  usage?: {
    current: number;
    limit: number;
    unit: string;
  };
}

// 切换模型
export async function switchModel(
  host: ModelConfigHost,
  capability: string,
  providerId: string,
  modelId: string
) {
  try {
    host.switching = true;

    const result = await host.client.request('modelConfig.switchModel', {
      capability,
      providerId,
      modelId
    });

    if (result.success) {
      // 更新本地状态
      await reloadCapabilityCard(host, capability);
    } else {
      host.error = result.error || '切换失败';
    }
  } catch (err) {
    host.error = `切换失败: ${String(err)}`;
  } finally {
    host.switching = false;
  }
}
```

---

## 📱 响应式设计

### 桌面端 (>768px)
```
3列卡片布局,每个能力卡片宽度 ~300px
```

### 移动端 (<768px)
```
1列堆叠,卡片全宽,折叠详情默认收起
```

---

## 🎨 视觉设计规范

### 颜色系统
```css
/* 状态颜色 */
--status-active: #10b981;   /* 绿色 - 已启用 */
--status-inactive: #6b7280; /* 灰色 - 未配置 */
--status-error: #ef4444;    /* 红色 - 错误 */
--status-warning: #f59e0b;  /* 黄色 - 额度告急 */

/* 免费标签 */
--badge-free: linear-gradient(135deg, #10b981 0%, #059669 100%);
--badge-paid: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
```

### 图标规范
```
能力图标: 24px, Emoji 或 Lucide Icons
Provider图标: 32px, 品牌Logo
状态点: 8px, 实心圆点
```

---

## 📊 用户测试目标

### 小白用户 (首次使用)
- [ ] 3秒内理解页面作用
- [ ] 30秒内完成免费模型配置
- [ ] 无需阅读文档即可使用

### 进阶用户 (自定义配置)
- [ ] 1分钟内添加自己的API Key
- [ ] 清晰看到所有能力的配置状态
- [ ] 可以灵活切换模型

---

## 🚀 实施计划

### Phase 1: 核心交互 (Week 1)
- [ ] 实现智能卡片组件
- [ ] 实现一键配置免费模型
- [ ] 实现自动检测能力

### Phase 2: 视觉优化 (Week 2)
- [ ] 大卡片视觉设计
- [ ] 动画和过渡效果
- [ ] 响应式布局

### Phase 3: 高级功能 (Week 3)
- [ ] 模型切换
- [ ] 使用历史
- [ ] 批量管理

---

## 🔄 完整用户旅程

### 首次使用流程

```
Step 1: 进入页面
  ↓
  🚀 快速开始引导
    ├─ 1️⃣ 配置硅基流动 (必须)
    │   ├─ 输入 API Key
    │   ├─ 自动检测 200+ 模型
    │   └─ 推荐勾选: Qwen2.5-7B + Qwen-VL + FLUX.1 + embedding
    │
    └─ 2️⃣ 启用免费模型 (推荐)
        ├─ ☑️ LongCat (每天50万字)
        └─ ☑️ 蚂蚁百灵 (每天50万字)
  ↓
Step 2: 完成配置
  ↓
  📊 能力卡片视图
    ├─ 💬 文字对话 [已启用]
    │   └─ 当前: LongCat (免费,自动切换蚂蚁百灵)
    │
    ├─ 👁️ 图片理解 [已启用]
    │   └─ 当前: Qwen-VL-Plus (硅基流动)
    │
    └─ 🎨 图片生成 [已启用]
        └─ 当前: FLUX.1-schnell (硅基流动)
```

### 日常使用流程

```
用户想切换文字对话模型:

Step 1: 点击 "💬 文字对话" 卡片
  ↓
  展开详情: [切换模型 ▼]
  ↓
Step 2: 查看可用模型列表
  ┌────────────────────────────┐
  │ 硅基流动 (当前)             │
  │  ✓ Qwen2.5-7B   [免费]      │
  │  ○ Qwen2.5-72B  [付费]      │
  │  ○ DeepSeek-V3  [付费]      │
  ├────────────────────────────┤
  │ OpenAI (已配置)             │
  │  ○ GPT-4.1      [付费]      │
  │  ○ GPT-4.1-mini [便宜]      │
  ├────────────────────────────┤
  │ MiniMax (未配置)            │
  │  [+ 添加 MiniMax 配置]      │
  └────────────────────────────┘
  ↓
Step 3: 点击目标模型
  ↓
  即时切换,无需刷新页面
  ↓
Step 4: 卡片更新显示
  💬 文字对话 [已启用]
    └─ 当前: DeepSeek-V3 (来自 硅基流动)
       今日已用: 0 / 无限制
```

### 添加新厂家流程 (全自动)

```
用户想添加 MiniMax:

Step 1: 点击 "MiniMax [未配置 ○]"
  ↓
Step 2: 弹窗显示配置向导
  ├─ 引导获取 API Key
  └─ 用户粘贴 API Key
  ↓
Step 3: 后端自动检测+测试所有模型 (无需等待)
  ⏳ 正在测试 MiniMax-M2.1... ✅ 可用
  ⏳ 正在测试 MiniMax-VL-01... ✅ 可用
  ⏳ 正在测试 MiniMax-M2.1-Video... ✅ 可用
  ⏳ 正在测试 MiniMax-Text-Embedding-v1... ✅ 可用
  ↓
Step 4: 显示检测结果 (所有可用模型已自动启用)
  ✅ 检测完成! 自动启用 4 个模型:
  • 文字对话: MiniMax-M2.1
  • 图片理解: MiniMax-VL-01
  • 视频理解: MiniMax-M2.1-Video
  • 文本嵌入: MiniMax-Text-Embedding-v1

  [确认] (直接保存,无需手动勾选)
  ↓
Step 5: 自动更新能力卡片
  💬 文字对话 [已启用]
    └─ 当前: MiniMax-M2.1 (来自 MiniMax)
       [切换模型] 下拉菜单中新增 MiniMax-M2.1

  👁️ 图片理解 [已启用]
    └─ 当前: MiniMax-VL-01 (来自 MiniMax)
       [切换模型] 下拉菜单中新增 MiniMax-VL-01

  🎬 视频理解 [已启用] ← 新能力自动激活
    └─ 当前: MiniMax-M2.1-Video (来自 MiniMax)
```

**关键改进:**
- ❌ 旧方式: 用户手动勾选模型
- ✅ 新方式: 系统自动测试+自动启用所有可用模型
- ✅ 用户体验: 输入 API Key → 等待检测 → 确认 → 完成 (3步)
- ✅ 智能优选: 自动优先选择免费模型作为默认

---

## 💡 总结

### 设计核心
**Capability-First Architecture**: 用户关心 "能做什么",而不是 "用什么厂家"

### 信息层次
**三层架构**:
1. **顶层**: 能力 (Capability) - 用户视角
2. **中层**: 模型 (Model) - 系统执行
3. **底层**: 厂家 (Provider) - 技术细节

### 交互理念
**Zero-config First**: 小白用户一键配置,进阶用户灵活切换模型

### 视觉核心
**Visual Clarity**: 大卡片 + 清晰模型名称 + 可折叠详情

### 技术核心
**Smart Detection**: 系统主动检测所有模型及其能力,用户只需勾选

---

## 🎯 设计原则总结

### 用户心智模型匹配
```
用户想法: "我想聊天" (关心能力)
  ↓
系统设计: 💬 文字对话卡片置顶 ✓
  ↓
显示信息: 当前模型 Qwen2.5-7B (清晰)
  ↓
高级操作: 点击切换到其他模型 (可选)
```

### 三层架构清晰可见
```
Layer 1 (用户层): 💬 文字对话
  ↓ 主要信息
Layer 2 (执行层): Qwen2.5-7B-Instruct
  ↓ 次要信息
Layer 3 (技术层): 来自 硅基流动
```

### 一个 API Key,多个模型
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

> 这个设计参考了 Vercel, Raycast, Cursor, Notion 等顶级产品的交互模式,将"配置厂家"变成"选择能力",将"抽象的Provider"变成"具体的Model",将"技术细节"变成"用户价值",大幅降低用户心智负担。

> **核心洞察**: 用户不关心 "我配置了哪些厂家",而关心 "我能做什么" + "我正在用哪个模型"。通过 Capability → Model → Provider 三层架构,让每一层信息都清晰可见,可控制,可切换。

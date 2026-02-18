# 模型配置页面 - 智能卡片设计方案 (参考顶级产品)

> 设计理念: **Zero-config First, Smart Detection, Visual Clarity**
> 参考产品: Vercel Dashboard, Raycast Extensions, Cursor Settings, Notion Integrations

---

## 🎯 设计目标

### 用户心智模型
```
小白用户: "我想聊天 / 看图 / 生成图"
进阶用户: "我想用 GPT-4 / Claude / Qwen"
```

### 系统交互目标
```
1. 首次进入: 3秒理解页面,30秒完成配置
2. 日常使用: 一眼看到所有能力状态
3. 高级配置: 展开详情,精细控制
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
│  │   🎁 我们为你准备了2个免费模型(无需注册):                   │ │
│  │                                                           │ │
│  │   ✓ LongCat - 文字对话 (每天50万字)                        │ │
│  │   ✓ 蚂蚁百灵 - 文字对话 (每天50万字)                        │ │
│  │                                                           │ │
│  │   [🎉 启用免费模型]  或  [跳过,我自己配置]                  │ │
│  │                                                           │ │
│  │   💡 提示: 启用后每天可免费使用100万字,节省约¥6-8           │ │
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
│  │ 🎁 LongCat (免费)   │ │                     │ │            ││
│  │ 今日已用: 1.2K/50万字│ │ 点击添加模型         │ │ 点击添加    ││
│  │                     │ │                     │ │            ││
│  │ 🎁 蚂蚁百灵 (备用)   │ │ 推荐: 硅基流动       │ │ 推荐: DALL-E││
│  │ 备用模型,自动切换    │ │ Qwen-VL (自己申请)  │ │ (自己申请)  ││
│  │ [查看详情 ▼]        │ │ [+ 添加]            │ │ [+ 添加]   ││
│  └─────────────────────┘ └─────────────────────┘ └────────────┘│
│                                                                 │
│  🔧 其他模型平台 (需要自己注册申请)                              │
│                                                                 │
│  🇨🇳 国内推荐服务                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ⭐ Kimi Code    [未配置 ○]  💻 代码专用 262K上下文 极速  │   │
│  │ 通义千问        [未配置 ○]  ☁️ 阿里出品 送100万Token    │   │
│  │ 豆包            [未配置 ○]  🔥 字节出品 响应快 便宜      │   │
│  │ 硅基流动        [未配置 ○]  🔮 免费额度 支持文字+图片+视频│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🇨🇳 更多国内服务  [展开 ▼]                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ DeepSeek      [未配置 ○]  🚀 性价比之王                  │   │
│  │ 智谱GLM       [未配置 ○]  🧠 GLM-4 永久免费模型          │   │
│  │ Kimi(月之暗面) [未配置 ○]  🌙 长上下文之王 1M tokens    │   │
│  │ MiniMax       [未配置 ○]  ⚡ M2.1 Agent/代码专家         │   │
│  │ 腾讯混元      [未配置 ○]  💫 混元大模型系列              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🌐 国际服务 (需要科学上网)  [展开 ▼]                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ OpenAI        [未配置 ○]  🤖 GPT-4.1/o3 ChatGPT官方     │   │
│  │ Anthropic     [未配置 ○]  🧬 Claude Sonnet4 编程最强    │   │
│  │ Google Gemini [未配置 ○]  🔷 Gemini 3 免费额度充足      │   │
│  │ NVIDIA NIM    [未配置 ○]  💚 高性能推理 有免费额度       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  💡 提示: LongCat和蚂蚁百灵每天共100万字免费额度,用完后需配置其他模型│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 核心交互设计

### 1. 启用免费模型 (LongCat + 蚂蚁百灵)

**点击"🎉 启用免费模型"后:**

```
┌─────────────────────────────────────────────┐
│  正在启用免费模型...                         │
├─────────────────────────────────────────────┤
│                                             │
│  ✓ 启用 LongCat ✅                           │
│  ✓ 启用 蚂蚁百灵 ✅                           │
│  ✓ 配置自动切换策略 ✅                       │
│                                             │
│  [取消]                                      │
└─────────────────────────────────────────────┘

配置完成后:
┌─────────────────────────────────────────────┐
│  🎉 免费模型已启用!                          │
├─────────────────────────────────────────────┤
│                                             │
│  已为你启用以下免费模型:                     │
│                                             │
│  ✅ LongCat - 每天50万字                    │
│  ✅ 蚂蚁百灵 - 每天50万字(备用)              │
│                                             │
│  🎁 每日免费额度: 100万字                    │
│  💰 预计每天节省: ¥6-8                       │
│                                             │
│  💡 额度用完后会提醒你添加其他模型            │
│                                             │
│  [开始聊天] [添加更多模型]                   │
└─────────────────────────────────────────────┘
```

**技术实现:**
```typescript
// 启用免费模型 = 启用内置的 LongCat + 蚂蚁百灵
async function enableFreeModels() {
  // 1. 无需用户输入API Key,直接启用内置配置
  const builtInProviders = [
    { id: 'longcat', name: 'LongCat', priority: 1 },
    { id: 'ant-bailing', name: '蚂蚁百灵', priority: 2 },
  ];

  // 2. 启用这两个模型
  await enableProviders(builtInProviders);

  // 3. 配置自动切换策略(LongCat优先,额度用完自动切换到蚂蚁百灵)
  await configureAutoSwitch({
    strategy: 'priority',
    providers: builtInProviders,
  });

  // 4. 显示成功页面
  showSuccessPage();
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

**卡片内容结构:**

```html
<div class="capability-card capability-card--active">
  <!-- Header -->
  <div class="card-header">
    <span class="card-icon">💬</span>
    <h3 class="card-title">文字对话</h3>
    <span class="card-status card-status--active">● 已启用</span>
  </div>

  <!-- Current Model -->
  <div class="card-model">
    <div class="model-provider">
      <img src="siliconflow-icon.svg" class="provider-icon" />
      <span class="provider-name">硅基流动</span>
      <span class="model-badge model-badge--free">免费</span>
    </div>
    <div class="model-name">Qwen2.5-7B-Instruct</div>
  </div>

  <!-- Usage Stats (紧凑条形图) -->
  <div class="card-usage">
    <div class="usage-bar">
      <div class="usage-fill" style="width: 2.4%"></div>
    </div>
    <span class="usage-text">今日已用: 1.2K / 50万字</span>
  </div>

  <!-- Actions (折叠,默认隐藏) -->
  <details class="card-details">
    <summary>查看详情</summary>
    <div class="card-actions">
      <button class="btn-link">切换模型</button>
      <button class="btn-link">查看历史</button>
      <button class="btn-link danger">移除配置</button>
    </div>
  </details>
</div>
```

---

### 3. 添加其他模型 (用户自己申请)

**点击"其他模型平台"中的任意一行,例如"Kimi Code"(首选推荐):**

```
┌─────────────────────────────────────────────────────────┐
│  配置 Kimi Code                                [关闭 ×]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  💡 Kimi Code 是代码专用模型,262K超长上下文,极速响应      │
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
│  │  粘贴后自动检测可用模型...                       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ✓ 检测完成! 发现以下可用模型:                           │
│                                                         │
│  ☑ 文字对话                                             │
│     • kimi-for-coding (推荐,262K上下文)                 │
│                                                         │
│  💡 Kimi Code 专注于代码场景,一次配置即可使用             │
│                                                         │
│  [取消]  [保存配置]                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘

---

**如果选择"MiniMax"(支持多模态):**

┌─────────────────────────────────────────────────────────┐
│  配置 MiniMax                                  [关闭 ×]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  💡 MiniMax 支持文字+图片理解,M2.1 Agent/代码专家         │
│                                                         │
│  步骤 1: 获取 API Key                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │  1. 访问 minimax.io 注册账号                     │   │
│  │  2. 进入控制台 → API密钥                         │   │
│  │  3. 创建新密钥并复制                             │   │
│  │                                                 │   │
│  │  [🔗 打开 MiniMax 官网]                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  步骤 2: 粘贴 API Key                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │ minimax-xxxxxxxxxxxxxxxxxxxxx            │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  │                                                 │   │
│  │  粘贴后自动检测可用模型...                       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ✓ 检测完成! 发现以下可用模型:                           │
│                                                         │
│  ☑ 文字对话                                             │
│     • MiniMax-M2.1 (推荐,Agent专家)                     │
│                                                         │
│  ☑ 图片理解                                             │
│     • MiniMax-VL-01 (支持视觉)                          │
│                                                         │
│  💡 建议: 全部勾选,一次配置启用多个能力                   │
│                                                         │
│  [取消]  [保存配置]                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**关键特性:**
1. **输入即检测**: 粘贴API Key后,自动触发检测(无需点"测试连接")
2. **多能力合并**: 一个API Key检测出所有能力,用户只需勾选
3. **智能推荐**: 系统高亮推荐最佳模型组合
4. **视觉反馈**: 实时显示检测进度(加载动画 → 成功 ✅)

---

## 🎯 关键改进点对比

### 旧设计 vs 新设计

| 维度 | 旧设计 (free-models.ts) | 新设计 (smart-cards) |
|------|------------------------|---------------------|
| **首次配置** | 需要逐个点击Provider卡片 | 一键配置免费模型 (3秒完成) |
| **视觉层次** | 列表式,所有信息平铺 | 大卡片 + 折叠详情,层次清晰 |
| **状态呈现** | 小图标 + 文字描述 | 大面积颜色 + 状态点 + 进度条 |
| **添加模型** | 弹窗 → 填表 → 测试 → 保存 | 输入 → 自动检测 → 勾选 → 完成 |
| **能力感知** | 看不到能力,只看到Provider | 能力卡片置顶,Provider降级 |
| **交互步骤** | 5步 (选择→填写→测试→确认→刷新) | 2步 (输入→确认) |
| **错误处理** | 弹窗提示错误信息 | 实时验证 + 内联错误提示 |
| **高级功能** | 全部平铺展示 | 折叠到"查看详情" |

---

## 🛠️ 技术实现要点

### 1. 启用免费模型 (LongCat + 蚂蚁百灵)
```typescript
// cn/src/gateway/server-methods/free-models-quick-setup.ts
export async function enableBuiltInFreeModels() {
  // LongCat 和 蚂蚁百灵 是 ClawdbotCN 内置的
  // 无需用户提供 API Key,直接启用
  const builtInProviders = [
    {
      id: 'longcat',
      name: 'LongCat',
      enabled: true,
      priority: 1, // 优先使用
      apiKey: BUILTIN_LONGCAT_KEY, // 内置密钥
      quota: { daily: 500000, unit: 'tokens' },
    },
    {
      id: 'ant-bailing',
      name: '蚂蚁百灵',
      enabled: true,
      priority: 2, // 备用
      apiKey: BUILTIN_ANT_BAILING_KEY, // 内置密钥
      quota: { daily: 500000, unit: 'tokens' },
    },
  ];

  // 保存配置
  await saveFreeModelsConfig({
    enabled: true,
    providers: builtInProviders,
    autoSwitch: true, // 自动切换
  });

  return { success: true, providers: builtInProviders };
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

### 3. 自动检测 + 实时反馈
```typescript
// 使用 SSE 流式返回检测进度
async function* detectCapabilities(apiKey: string) {
  yield { status: 'detecting', message: '正在连接...' };

  const models = await fetchModels(apiKey);
  yield { status: 'detecting', message: `检测到 ${models.length} 个模型` };

  const capabilities = analyzeCapabilities(models);
  yield { status: 'success', capabilities };
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

## 💡 总结

### 设计核心
**Zero-config First**: 小白用户一键配置,进阶用户深度自定义

### 视觉核心
**Visual Clarity**: 大卡片 + 清晰状态 + 最小化文字

### 交互核心
**Smart Detection**: 系统主动检测,用户只需确认

---

> 这个设计参考了 Vercel, Raycast, Cursor, Notion 等顶级产品的交互模式,将"配置"变成"选择",将"表格"变成"卡片",将"步骤"变成"智能",大幅降低用户心智负担。

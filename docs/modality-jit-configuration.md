# 多模态能力即时配置（JIT Configuration）

## 功能概述

当用户尝试使用多模态功能（图片分析、图片生成、视频分析）但未配置相应模型时，系统会自动弹出友好的配置引导对话框，帮助用户快速完成配置。

## 架构设计

### 1. 后端能力检测服务

**文件位置**：`src/agents/modality-capability-checker.ts`

**核心功能**：
- 检测用户是否配置了支持特定能力的模型
- 提供推荐配置建议
- 支持三种能力检测：
  - `image-analysis`：图片分析（vision 模型）
  - `image-generation`：图片生成（DALL-E、通义万相等）
  - `video-analysis`：视频分析（多模态模型）

**检测逻辑**：
```typescript
// 图片分析：检查模型 input 字段是否包含 "image"
function supportsImageAnalysis(model: ModelCatalogEntry): boolean {
  return model.input?.includes("image") ?? false;
}

// 图片生成：通过模型 ID 和 provider 判断
function supportsImageGeneration(model: ModelCatalogEntry): boolean {
  const id = model.id.toLowerCase();
  const provider = model.provider.toLowerCase();

  // 支持 OpenAI DALL-E、阿里通义万相、百度文心一格等
  return id.includes("dall-e") ||
         id.includes("wanx") ||
         id.includes("yige");
}

// 视频分析：检查 input 字段是否包含 "video"
function supportsVideoAnalysis(model: ModelCatalogEntry): boolean {
  const input = model.input as Array<string> | undefined;
  return input?.includes("video") ?? false;
}
```

### 2. Gateway API 端点

**文件位置**：`src/gateway/server-methods/modality-capability.ts`

**提供的 API**：

#### `modality.check` - 检查单个能力
```typescript
// Request
{
  "capability": "image-analysis" | "image-generation" | "video-analysis"
}

// Response
{
  "capability": "image-analysis",
  "hasCapability": false,
  "availableModels": [],
  "suggestion": "当前未配置支持图片分析的模型..."
}
```

#### `modality.checkMultiple` - 批量检查能力
```typescript
// Request
{
  "capabilities": ["image-analysis", "image-generation"]
}

// Response
{
  "results": [...],
  "missingCapabilities": ["image-analysis"],
  "suggestions": ["💡 推荐配置..."]
}
```

#### `modality.detectIntent` - 智能意图检测
```typescript
// Request
{
  "prompt": "帮我画一张猫咪的图片",
  "hasAttachments": false,
  "attachmentTypes": []
}

// Response
{
  "detectedIntent": "image-generation",
  "requiredCapabilities": ["image-generation"],
  "needsConfiguration": true,
  "suggestions": [...]
}
```

**检测规则**：
- 图片附件 → 需要 `image-analysis`
- 视频附件 → 需要 `video-analysis`
- 提示词包含"画一张"、"生成图片"等关键词 → 需要 `image-generation`

### 3. 前端配置引导组件

**文件位置**：
- `ui/src/ui/views/modality-config-guide.ts`（逻辑）
- `ui/src/ui/views/modality-config-guide.css`（样式）

**核心函数**：

#### `showModalityConfigGuide()` - 显示配置引导对话框
```typescript
showModalityConfigGuide({
  client: GatewayBrowserClient,
  missingCapabilities: ["image-analysis", "image-generation"],
  suggestions: [
    "💡 推荐配置支持图片分析的模型：\n   • 阿里云：qwen-vl-max\n   • 字节跳动：doubao-seed-1-8"
  ],
  onConfigured: () => {
    // 用户点击"前往配置"后的回调
    window.location.hash = "#/config";
  },
  onCancelled: () => {
    // 用户点击"稍后配置"后的回调
  }
});
```

**对话框功能**：
- 清晰列出缺失的能力（带图标）
- 提供具体的推荐配置方案
- 支持键盘操作（ESC 关闭、Tab 焦点循环）
- 支持 Dark Mode
- 移动端自适应

#### `checkAndGuideModalityConfig()` - 一体化检测与引导
```typescript
const { needsConfiguration, canProceed } = await checkAndGuideModalityConfig({
  client,
  prompt: "帮我分析这张图片",
  attachments: [{ mimeType: "image/jpeg" }],
  onConfigured: () => { /* ... */ },
  onCancelled: () => { /* ... */ }
});

if (!canProceed) {
  // 用户需要先配置，停止发送
  return;
}
```

### 4. 聊天流程集成

**文件位置**：`ui/src/ui/controllers/modality-guard.ts`

**集成方式**：

```typescript
// 在 sendChatMessage() 前调用
import { checkModalityBeforeSend } from "./modality-guard";

async function sendChatMessage(state, message, attachments) {
  // 1. 检查多模态能力
  const { canProceed } = await checkModalityBeforeSend({
    client: state.client,
    message,
    attachments
  });

  // 2. 如果需要配置，停止发送
  if (!canProceed) {
    return false;
  }

  // 3. 继续原有的发送逻辑
  await state.client.request("chat.send", { ... });
}
```

## 使用流程

### 场景 1：用户发送图片附件

1. 用户在聊天框粘贴或上传图片
2. 点击发送按钮
3. `modality-guard` 检测到图片附件
4. 调用 `modality.detectIntent` API
5. 后端检测到需要 `image-analysis` 能力
6. 检查用户是否配置了 vision 模型
7. **如果未配置**：
   - 弹出配置引导对话框
   - 显示推荐模型（qwen-vl-max、doubao-seed-1-8 等）
   - 用户点击"前往配置" → 跳转到设置页面
   - 或点击"稍后配置" → 取消本次发送
8. **如果已配置**：
   - 直接发送消息

### 场景 2：用户请求生成图片

1. 用户输入："帮我画一张猫咪的图片"
2. 点击发送按钮
3. `modality-guard` 检测到生成意图关键词
4. 调用 `modality.detectIntent` API
5. 后端检测到需要 `image-generation` 能力
6. 检查用户是否配置了图片生成模型
7. **如果未配置**：
   - 弹出配置引导对话框
   - 显示推荐模型（dall-e-3、wanx-v1 等）
   - 引导用户配置
8. **如果已配置**：
   - 直接发送消息

### 场景 3：用户发送视频附件

1. 用户上传视频文件
2. 点击发送按钮
3. `modality-guard` 检测到视频附件
4. 后端检测到需要 `video-analysis` 能力
5. 检查用户是否配置了视频理解模型
6. **如果未配置**：
   - 弹出配置引导对话框
   - 显示推荐模型（doubao-seed-1-8 等）
   - 引导用户配置

## 技术亮点

### 1. 智能意图识别
- 自动检测图片/视频附件
- 识别提示词中的生成意图
- 支持中英文关键词

### 2. 降级策略
- API 调用失败时，允许消息继续发送（不阻塞用户）
- 错误只记录到控制台，不影响用户体验

### 3. 无侵入性集成
- 使用 Guard 模式封装能力检测
- 原有 `sendChatMessage` 逻辑几乎不变
- 易于维护和扩展

### 4. 用户体验优化
- JIT（即时配置）：用到时再配置，不强制预配置
- 友好的视觉设计：图标、颜色、排版清晰
- 完整的可访问性支持：键盘导航、ARIA 标签
- 响应式设计：支持桌面和移动端

## 扩展指南

### 添加新的能力类型

1. 在 `modality-capability-checker.ts` 添加检测函数：
```typescript
function supportsNewCapability(model: ModelCatalogEntry): boolean {
  // 实现检测逻辑
  return model.someField === "someValue";
}
```

2. 在 `ModalityCapability` 类型添加新能力：
```typescript
export type ModalityCapability =
  | "image-analysis"
  | "image-generation"
  | "video-analysis"
  | "new-capability"; // 新增
```

3. 在 `checkModalityCapability` 函数添加 case：
```typescript
switch (capability) {
  case "new-capability":
    checker = supportsNewCapability;
    suggestionKey = "新能力";
    break;
}
```

4. 在 `modality-config-guide.ts` 添加图标和标签：
```typescript
const CAPABILITY_LABELS: Record<ModalityCapability, string> = {
  "new-capability": "新能力",
};

const CAPABILITY_ICONS: Record<ModalityCapability, string> = {
  "new-capability": "🆕",
};
```

### 自定义检测规则

在 `modality.detectIntent` handler 中添加新的关键词或逻辑：

```typescript
// 检测音频生成意图
const audioGenKeywords = ["生成音乐", "创作音频", "generate audio"];
if (audioGenKeywords.some((kw) => lowerPrompt.includes(kw.toLowerCase()))) {
  requiredCapabilities.push("audio-generation");
}
```

## 权限配置

在 `src/gateway/server-methods.ts` 中，`modality.*` 方法已被添加到 `READ_METHODS`，表示只需要 `operator.read` 权限即可访问。

如果需要更严格的权限控制，可以移动到其他权限组。

## 测试建议

1. **单元测试**：
   - 测试各个能力检测函数
   - 测试意图识别逻辑
   - 测试 API 响应格式

2. **集成测试**：
   - 模拟用户发送图片
   - 模拟用户请求生成图片
   - 验证对话框显示和交互

3. **E2E 测试**：
   - 完整的用户配置流程
   - 从检测 → 引导 → 配置 → 重试发送

4. **兼容性测试**：
   - 测试不同浏览器（Chrome、Firefox、Safari）
   - 测试移动设备（iOS、Android）
   - 测试 Dark Mode

## 性能考虑

1. **API 调用优化**：
   - `modality.detectIntent` 只在发送前调用一次
   - 模型目录加载使用缓存（`loadModelCatalog`）

2. **前端渲染优化**：
   - 对话框使用 CSS 动画（GPU 加速）
   - 事件监听器在对话框关闭时移除

3. **降级策略**：
   - API 失败时不阻塞发送
   - 错误只记录到控制台

## 已知限制

1. **静态关键词匹配**：
   - 图片生成意图检测使用关键词列表
   - 可能误判或漏判
   - 未来可以集成 NLP 模型提升准确性

2. **模型能力推断**：
   - 图片生成模型通过名称判断（如 dall-e、wanx）
   - 新模型可能需要手动添加到列表
   - 未来可以通过 API 自动发现

3. **多语言支持**：
   - 目前只支持中文和英文关键词
   - 未来可以添加 i18n 支持

## 总结

这套 JIT 配置机制为用户提供了无缝的多模态体验：

- ✅ **用户友好**：用到时才配置，降低学习成本
- ✅ **智能检测**：自动识别用户意图和附件类型
- ✅ **清晰引导**：推荐具体的模型和配置步骤
- ✅ **无侵入性**：不影响现有代码逻辑
- ✅ **可扩展性**：易于添加新的能力类型

通过这套机制，我们实现了"零配置启动，按需引导配置"的产品理念，大大提升了用户的首次使用体验。

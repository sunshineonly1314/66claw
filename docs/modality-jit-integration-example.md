# 多模态 JIT 配置集成示例

本文档提供如何将多模态能力检测集成到聊天流程的完整示例。

## 快速集成（推荐）

### 步骤 1：导入必要的模块

在 `ui/src/ui/controllers/chat.ts` 中添加导入：

```typescript
import { checkModalityBeforeSend } from "./modality-guard";
```

### 步骤 2：在发送前添加检测

修改 `sendChatMessage` 函数，在实际发送前添加能力检测：

```typescript
export async function sendChatMessage(
  state: ChatState,
  message: string,
  attachments?: ChatAttachment[],
): Promise<ChatSendResult> {
  if (!state.client || !state.connected) return false;
  const msg = message.trim();
  const hasAttachments = attachments && attachments.length > 0;
  if (!msg && !hasAttachments) return false;

  // ✅ 新增：多模态能力检测
  const { canProceed } = await checkModalityBeforeSend({
    client: state.client,
    message: msg,
    attachments: attachments || [],
  });

  // 如果需要配置，停止发送
  if (!canProceed) {
    state.chatSending = false;
    return false;
  }

  // 原有的发送逻辑...
  const now = Date.now();
  const contentBlocks: Array<{ type: string; text?: string; source?: unknown }> = [];
  // ... 后续代码不变
}
```

### 步骤 3：加载样式文件

在主 HTML 或主 CSS 中引入样式：

```html
<!-- ui/index.html -->
<link rel="stylesheet" href="/ui/views/modality-config-guide.css">
```

或在主 CSS 中导入：

```css
/* ui/src/styles/main.css */
@import './ui/views/modality-config-guide.css';
```

### 完成！

集成完成后，用户体验流程如下：

1. 用户粘贴图片 → 点击发送
2. 系统检测到需要 vision 模型
3. **如果未配置**：
   - 弹出配置引导对话框
   - 用户点击"前往配置" → 跳转到设置页面
4. **如果已配置**：
   - 消息正常发送

---

## 高级集成（自定义）

如果你需要更细粒度的控制，可以直接使用底层 API。

### 示例 1：手动检测单个能力

```typescript
import type { GatewayBrowserClient } from "../gateway";

async function checkImageAnalysisCapability(client: GatewayBrowserClient) {
  try {
    const result = await client.request("modality.check", {
      capability: "image-analysis"
    }) as {
      hasCapability: boolean;
      availableModels: Array<{ id: string; name: string; provider: string }>;
      suggestion?: string;
    };

    if (!result.hasCapability) {
      console.warn("No vision model configured:", result.suggestion);
      // 显示警告或引导用户配置
    } else {
      console.log("Available vision models:", result.availableModels);
    }

    return result.hasCapability;
  } catch (err) {
    console.error("Failed to check capability:", err);
    return false;
  }
}
```

### 示例 2：批量检查多个能力

```typescript
async function checkMultipleCapabilities(client: GatewayBrowserClient) {
  const result = await client.request("modality.checkMultiple", {
    capabilities: ["image-analysis", "image-generation", "video-analysis"]
  }) as {
    results: Array<{
      capability: string;
      hasCapability: boolean;
      availableModels: unknown[];
    }>;
    missingCapabilities: string[];
    suggestions: string[];
  };

  if (result.missingCapabilities.length > 0) {
    console.log("Missing capabilities:", result.missingCapabilities);
    console.log("Suggestions:", result.suggestions);

    // 手动显示配置引导
    showModalityConfigGuide({
      client,
      missingCapabilities: result.missingCapabilities as ModalityCapability[],
      suggestions: result.suggestions,
    });
  }

  return result.results;
}
```

### 示例 3：智能意图检测

```typescript
async function detectUserIntent(
  client: GatewayBrowserClient,
  prompt: string,
  attachments: Array<{ mimeType: string }>
) {
  const result = await client.request("modality.detectIntent", {
    prompt,
    hasAttachments: attachments.length > 0,
    attachmentTypes: attachments.map(att => att.mimeType)
  }) as {
    detectedIntent: string | null;
    requiredCapabilities: string[];
    needsConfiguration: boolean;
    suggestions: string[];
  };

  console.log("Detected intent:", result.detectedIntent);
  console.log("Required capabilities:", result.requiredCapabilities);
  console.log("Needs config:", result.needsConfiguration);

  if (result.needsConfiguration) {
    // 用户需要配置
    return { canProceed: false };
  }

  return { canProceed: true };
}
```

### 示例 4：自定义对话框内容

```typescript
import { showModalityConfigGuide } from "../views/modality-config-guide";

// 自定义建议内容
showModalityConfigGuide({
  client,
  missingCapabilities: ["image-analysis"],
  suggestions: [
    "🎯 您可以配置以下任一模型：\n\n" +
    "1. 阿里云 Qwen-VL-Max\n" +
    "   • 性能最强\n" +
    "   • 支持图片、视频\n" +
    "   • 配置：https://dashscope.aliyun.com\n\n" +
    "2. 字节豆包 Seed-1.8\n" +
    "   • 多模态大模型\n" +
    "   • 支持图片、视频、代码\n" +
    "   • 配置：https://www.volcengine.com/products/doubao"
  ],
  onConfigured: () => {
    console.log("User clicked 'Configure'");
    // 跳转到配置页面，并高亮显示相关字段
    window.location.hash = "#/config?highlight=vision";
  },
  onCancelled: () => {
    console.log("User cancelled configuration");
    // 记录用户跳过配置的事件
    trackEvent("modality_config_cancelled", {
      capability: "image-analysis"
    });
  }
});
```

---

## 测试用例

### 测试 1：发送图片附件（未配置 vision 模型）

**期望行为**：
1. 弹出配置引导对话框
2. 显示推荐的 vision 模型列表
3. 用户点击"前往配置"跳转到设置页面

**测试代码**：
```typescript
// 模拟用户上传图片
const imageAttachment = {
  mimeType: "image/jpeg",
  dataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA..."
};

const result = await sendChatMessage(
  chatState,
  "帮我分析这张图片",
  [imageAttachment]
);

// 如果未配置，result 应该为 false
expect(result).toBe(false);
```

### 测试 2：请求生成图片（未配置生成模型）

**期望行为**：
1. 检测到"画一张"关键词
2. 弹出配置引导对话框
3. 显示推荐的图片生成模型（DALL-E、通义万相等）

**测试代码**：
```typescript
const result = await sendChatMessage(
  chatState,
  "帮我画一张猫咪的图片",
  []
);

expect(result).toBe(false);
```

### 测试 3：发送图片附件（已配置 vision 模型）

**期望行为**：
1. 能力检测通过
2. 消息正常发送
3. 不弹出配置对话框

**测试代码**：
```typescript
// 假设用户已配置 qwen-vl-max
const result = await sendChatMessage(
  chatState,
  "这张图片里有什么？",
  [imageAttachment]
);

expect(result).toBe(true);
```

### 测试 4：API 调用失败（降级策略）

**期望行为**：
1. `modality.detectIntent` API 调用失败
2. 不阻塞发送流程
3. 消息正常发送
4. 错误只记录到控制台

**测试代码**：
```typescript
// 模拟 API 失败
jest.spyOn(client, 'request').mockRejectedValue(new Error("Network error"));

const result = await sendChatMessage(
  chatState,
  "Hello world",
  []
);

// 降级策略：允许发送
expect(result).toBe(true);
expect(console.error).toHaveBeenCalledWith(
  expect.stringContaining("Failed to check capability")
);
```

---

## 常见问题

### Q1: 如何禁用多模态能力检测？

如果在某些场景下需要禁用检测（如测试环境），可以在 `modality-guard.ts` 中添加开关：

```typescript
// 环境变量控制
const ENABLE_MODALITY_CHECK = process.env.ENABLE_MODALITY_CHECK !== "false";

export async function checkModalityBeforeSend(options: ModalityGuardOptions) {
  if (!ENABLE_MODALITY_CHECK) {
    return { canProceed: true };
  }

  // 原有逻辑...
}
```

### Q2: 如何自定义检测关键词？

在 `src/gateway/server-methods/modality-capability.ts` 中修改关键词列表：

```typescript
const imageGenKeywords = [
  // 中文
  "画一张", "画一幅", "生成图片", "帮我画", "创作图片", "绘制",
  // 英文
  "draw", "generate image", "create image", "paint", "illustration",
  // 自定义关键词
  "设计海报", "制作图标", "生成 logo"
];
```

### Q3: 如何添加新的能力类型？

参考 [集成文档](./modality-jit-configuration.md) 的"扩展指南"章节。

### Q4: 对话框样式如何自定义？

修改 `ui/src/ui/views/modality-config-guide.css`：

```css
/* 自定义主题色 */
.modality-guide-content {
  --primary-color: #10b981;  /* 绿色主题 */
  --primary-hover: #059669;
}

/* 自定义圆角 */
.modality-guide-content {
  border-radius: 16px;  /* 更圆润 */
}

/* 自定义字体 */
.modality-guide-content .modal-title {
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}
```

### Q5: 如何记录配置引导的分析数据？

在回调函数中集成分析工具：

```typescript
showModalityConfigGuide({
  client,
  missingCapabilities: ["image-analysis"],
  suggestions: [...],
  onConfigured: () => {
    // 记录用户点击"前往配置"
    analytics.track("modality_config_started", {
      capabilities: ["image-analysis"],
      trigger: "chat_send"
    });
  },
  onCancelled: () => {
    // 记录用户取消配置
    analytics.track("modality_config_cancelled", {
      capabilities: ["image-analysis"],
      trigger: "chat_send"
    });
  }
});
```

---

## 性能优化建议

### 1. 预加载模型目录

在应用启动时预加载模型目录，避免首次检测时的延迟：

```typescript
// 应用初始化时
async function initializeApp() {
  const client = await connectToGateway();

  // 预加载模型目录（缓存）
  await client.request("models.list", {});

  // 其他初始化逻辑...
}
```

### 2. 防抖动优化

如果用户快速点击发送，可以添加防抖：

```typescript
import { debounce } from "lodash-es";

const debouncedCheckModality = debounce(
  checkModalityBeforeSend,
  300  // 300ms 防抖
);
```

### 3. 缓存检测结果

在会话期间缓存能力检测结果：

```typescript
const capabilityCache = new Map<string, boolean>();

async function checkWithCache(capability: string) {
  if (capabilityCache.has(capability)) {
    return capabilityCache.get(capability);
  }

  const result = await checkModalityCapability(capability);
  capabilityCache.set(capability, result.hasCapability);

  return result.hasCapability;
}
```

---

## 总结

通过以上集成示例，你可以：

- ✅ 快速集成多模态能力检测（3 行代码）
- ✅ 自定义检测逻辑和对话框样式
- ✅ 添加分析和监控
- ✅ 优化性能和用户体验

如有问题，请参考：
- [完整技术文档](./modality-jit-configuration.md)
- [API 文档](../src/gateway/server-methods/modality-capability.ts)
- [前端组件文档](../ui/src/ui/views/modality-config-guide.ts)

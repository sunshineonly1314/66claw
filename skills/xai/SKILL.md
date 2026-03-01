---
name: xai
name_zh: XAI
description: 通过 xAI API 与 Grok 模型对话。支持 Grok-3、Grok-3-mini、视觉模型等。
description_zh: 通过 xAI API 与 Grok 模型对话。支持 Grok-3、Grok-3-mini、视觉模型等。
homepage: https://docs.x.ai
triggers:
  - grok
  - xai
  - ask grok
metadata:
  clawdbot:
    emoji: "🤖"
---
# xAI / Grok

与 xAI 的 Grok 模型对话，支持文本与视觉能力。

## 配置

在技能配置中设置您的 API 密钥：

```bash
# Via clawdbot config
clawdbot config set skills.entries.xai.apiKey "xai-YOUR-KEY"

# Or environment variable
export XAI_API_KEY="xai-YOUR-KEY"
```

获取 API 密钥地址：https://console.x.ai

## 命令

### 与 Grok 对话
```bash
node {baseDir}/scripts/chat.js "What is the meaning of life?"
```

### 指定模型
```bash
node {baseDir}/scripts/chat.js --model grok-3-mini "Quick question: 2+2?"
```

### 视觉能力（分析图像）
```bash
node {baseDir}/scripts/chat.js --image /path/to/image.jpg "What's in this image?"
```

### 🔍 搜索 X/Twitter（实时！）  
```bash
node {baseDir}/scripts/search-x.js "Remotion video framework"
node {baseDir}/scripts/search-x.js --days 7 "Claude AI tips"
node {baseDir}/scripts/search-x.js --handles @remotion_dev "updates"
```  

利用 xAI Responses API 与 x_search 工具，返回真实 X 推文并附带引用来源。

### 查看可用模型列表
```bash
node {baseDir}/scripts/models.js
```

## 可用模型

- `grok-3` —— 能力最强，适用于复杂任务  
- `grok-3-mini` —— 快速高效  
- `grok-3-fast` —— 专为速度优化  
- `grok-2-vision-1212` —— 图像理解专用模型  

## 示例用法

**用户：** “请 Grok 谈谈它对 AI 安全的看法”  
**操作：** 以该提示运行 chat.js  

**用户：** “用 Grok 分析这张图片”（附带图片）  
**操作：** 以 --image 标志运行 chat.js  

**用户：** “有哪些 Grok 模型可用？”  
**操作：** 运行 models.js  

## API 参考文档

xAI API 文档：https://docs.x.ai/api

## 环境变量

- `XAI_API_KEY` —— 您的 xAI API 密钥（必需）  
- `XAI_MODEL` —— 默认模型（可选，默认为 grok-3）  
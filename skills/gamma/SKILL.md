---
name: gamma
name_zh: Gamma
description: 使用 Gamma.app API 生成 AI 驱动的演示文稿、文档与社交媒体帖文。当用户要求创建演示文稿、融资推介幻灯片、幻灯片集、文档或社交媒体轮播图时使用。触发场景包括：“创建关于 X 的演示文稿”、“制作融资推介幻灯片”、“生成幻灯片”或“为 X 创建一个 Gamma”。
description_zh: 使用 Gamma.app API 生成 AI 驱动的演示文稿、文档与社交媒体帖文。当用户要求创建演示文稿、融资推介幻灯片、幻灯片集、文档或社交媒体轮播图时使用。触发场景包括：“创建关于 X 的演示文稿”、“制作融资推介幻灯片”、“生成幻灯片”或“为 X 创建一个 Gamma”。
metadata: {"clawdbot":{"requires":{"env":["GAMMA_API_KEY"]}}}
---
# Gamma.app API

借助 AI 生成精美的演示文稿、文档与社交媒体帖文。

## 初始化设置

```bash
export GAMMA_API_KEY="sk-gamma-xxxxx"
```

## 快捷命令

```bash
# Generate a presentation
{baseDir}/scripts/gamma.sh generate "Your content or topic here"

# Generate with options
{baseDir}/scripts/gamma.sh generate "Content" --format presentation --cards 12

# Check generation status
{baseDir}/scripts/gamma.sh status <generationId>

# List recent generations (if supported)
{baseDir}/scripts/gamma.sh list
```

## 脚本用法

### 生成（Generate）

```bash
{baseDir}/scripts/gamma.sh generate "<content>" [options]

Options:
  --format       presentation|document|social (default: presentation)
  --cards        Number of cards/slides (default: 10)
  --instructions Additional instructions for styling/tone
  --amount       concise|detailed (default: detailed)
  --tone         e.g., "professional", "casual", "technical"
  --audience     e.g., "investors", "developers", "general"
  --image-source aiGenerated|web|none (default: aiGenerated)
  --image-style  illustration|photo|mixed (default: illustration)
  --wait         Wait for completion and return URL
```

### 示例（Examples）

```bash
# Simple presentation
{baseDir}/scripts/gamma.sh generate "The future of AI automation" --wait

# Pitch deck with specific styling
{baseDir}/scripts/gamma.sh generate "$(cat pitch.md)" \
  --format presentation \
  --cards 15 \
  --instructions "Make it a professional pitch deck for investors" \
  --tone "professional" \
  --audience "investors" \
  --wait

# Social carousel
{baseDir}/scripts/gamma.sh generate "5 tips for productivity" \
  --format social \
  --cards 5 \
  --wait

# Document/report
{baseDir}/scripts/gamma.sh generate "Q4 2025 Performance Report" \
  --format document \
  --amount detailed \
  --wait
```

## API 参考

### 接口地址（Endpoint）
```
POST https://public-api.gamma.app/v1.0/generations
```

### 请求头（Headers）
```
X-API-KEY: <your-api-key>
Content-Type: application/json
```

### 请求体（Request Body）

```json
{
  "inputText": "Your content (1-750,000 chars)",
  "textMode": "generate",
  "format": "presentation|document|social",
  "numCards": 10,
  "additionalInstructions": "Styling instructions",
  "textOptions": {
    "amount": "concise|detailed",
    "tone": "professional",
    "audience": "target audience"
  },
  "imageOptions": {
    "source": "aiGenerated|web|none",
    "model": "flux-kontext-pro",
    "style": "illustration|photo"
  },
  "cardOptions": {
    "dimensions": "fluid|16x9|4x3|1x1|4x5|9x16"
  }
}
```

### 响应（Response）

初始响应：
```json
{"generationId": "abc123"}
```

轮询状态：
```
GET https://public-api.gamma.app/v1.0/generations/<generationId>
```

完成响应：
```json
{
  "generationId": "abc123",
  "status": "completed",
  "gammaUrl": "https://gamma.app/docs/xxxxx",
  "credits": {"deducted": 150, "remaining": 7500}
}
```

## 格式选项

| 格式 | 尺寸 | 适用场景 |
|------|------|-----------|
| presentation | fluid, 16x9, 4x3 | 融资推介幻灯片、幻灯片展示 |
| document | fluid, pageless, letter, a4 | 报告、文档 |
| social | 1x1, 4x5, 9x16 | Instagram、LinkedIn 轮播图 |

## 注意事项

- 生成通常耗时 1–3 分钟  
- 每次生成扣除相应积分（每套幻灯片约 150–300 积分）  
- 输入文本支持 Markdown 格式  
- 使用 `--wait` 标志可阻塞等待直至完成，并直接返回 URL  
---
name: fliz-ai-video-generator  
version: 1.0.0  
author: gregorybeyrouti  
description: |
  Fliz REST API 完整集成指南——一个由人工智能驱动的视频生成平台，可将文本内容自动转化为带语音旁白、AI 生成图像及字幕的专业级视频。
  
  在以下场景中使用本技能：
  - 与 Fliz API 构建集成（WordPress、Zapier、Make、n8n、自定义应用）
  - 通过 API 构建视频生成工作流
  - 实现用于接收视频完成通知的 Webhook 处理器
  - 开发用于创建、管理或翻译视频的自动化工具
  - 排查 Fliz API 错误或身份验证问题
  - 理解视频处理流程及轮询状态机制
  
  核心能力：基于文本/Brief 创建视频、监控视频状态、翻译视频、复制视频、列出语音/音乐资源、Webhook 通知。  
homepage: https://fliz.ai  
tags: [video, ai, fliz, content-creation, automation, api]  
metadata:  
  clawdbot:  
    emoji: "🎬"  
    primaryEnv: FLIZ_API_KEY  
---

# Fliz API 集成技能

以编程方式将文本内容转化为 AI 生成的视频。

## 快速参考

| 项目 | 值 |
|------|-------|
| 基础 URL | `https://app.fliz.ai` |
| 认证方式 | Bearer Token（JWT） |
| 获取 Token | https://app.fliz.ai/api-keys |
| API 文档 | https://app.fliz.ai/api-docs |
| 数据格式 | JSON |

## 身份验证

所有请求均需使用 Bearer Token 进行认证：

```bash
curl -X GET "https://app.fliz.ai/api/rest/voices" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

通过调用 `GET /api/rest/voices` 测试连接——若 Token 有效，则返回 200 状态码。

## 核心端点

### 1. 创建视频

```
POST /api/rest/video
```

**最小化请求示例：**  
```json
{
  "fliz_video_create_input": {
    "name": "Video Title",
    "description": "Full content text to transform into video",
    "format": "size_16_9",
    "lang": "en"
  }
}
```

**响应示例：**  
```json
{
  "fliz_video_create": {
    "video_id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
  }
}
```

> **CRITICAL**: The `description` field must contain the FULL TEXT content. Fliz does NOT extract content from URLs - upstream systems must fetch/process content first.

### 2. 获取视频状态

```
GET /api/rest/videos/{id}
```

轮询该端点以跟踪视频生成进度。请检查 `step` 字段：

| 步骤 | 状态 |
|------|--------|
| `pending` → `scrapping` → `script` → `image_*` → `speech` → `video_rendering` | 处理中 |
| `complete` | ✅ 就绪——`url` 字段包含 MP4 地址 |
| `failed` / `failed_unrecoverable` | ❌ 错误——请检查 `error` 字段 |
| `user_action` | ⚠️ 需人工干预 |

### 3. 列出视频

```
GET /api/rest/videos?limit=20&offset=0
```

### 4. 翻译视频

```
POST /api/rest/videos/{from_video_id}/translate?new_lang=fr
```

在目标语言中创建一个新视频。

### 5. 复制视频

```
POST /api/rest/videos/{from_video_id}/duplicate
```

### 6. 列出语音 / 音乐资源

```
GET /api/rest/voices
GET /api/rest/musics
```

## 视频创建参数

### 必填字段
- `name`（字符串）：视频标题  
- `description`（字符串）：完整文本内容  
- `format`（枚举）：`size_16_9` \| `size_9_16` \| `square`  
- `lang`（字符串）：ISO 639-1 语言代码（如 en、fr、es、de、pt 等）

### 可选自定义项

| 字段 | 描述 | 默认值 |
|-------|-------------|---------|
| `category` | `article` \| `product` \| `ad` | `article` |
| `script_style` | 叙述风格 | auto |
| `image_style` | 视觉风格 | `hyperrealistic` |
| `caption_style` | 字幕风格 | `animated_background` |
| `caption_position` | `bottom` \| `center` | `bottom` |
| `caption_font` | 字体族 | `poppins` |
| `caption_color` | 十六进制颜色（如 #FFFFFF） | white |
| `caption_uppercase` | 布尔值 | false |
| `voice_id` | 自定义语音 ID | auto |
| `is_male_voice` | 布尔值 | auto |
| `music_id` | 音乐曲目 ID | auto |
| `music_url` | 自定义音乐 URL | null |
| `music_volume` | 0–100 | 15 |
| `watermark_url` | 图片 URL | null |
| `site_url` | CTA URL | null |
| `site_name` | CTA 文本 | null |
| `webhook_url` | 回调 URL | null |
| `is_automatic` | 自动处理 | true |
| `video_animation_mode` | `full_video` \| `hook_only` | `full_video` |
| `image_urls` | URL 数组 | null |

> **Note**: For `product` and `ad` categories, `image_urls` is required (3-10 images).

完整枚举值请参阅 [references/enums-values.md](references/enums-values.md)。

## Webhook

配置 `webhook_url`，以便在视频就绪或失败时接收通知：

```json
{
  "event": "video.complete",
  "video_id": "a1b2c3d4-...",
  "step": "complete",
  "url": "https://cdn.fliz.ai/videos/xxx.mp4"
}
```

## 错误处理

| HTTP 状态码 | 含义 | 建议操作 |
|-----------|---------|--------|
| 200 | 成功 | 继续执行 |
| 400 | 请求错误 | 检查参数 |
| 401 | 未授权 | Token 无效或已过期 |
| 404 | 未找到 | 视频 ID 无效 |
| 429 | 请求频率超限 | 使用退避策略重试 |
| 500 | 服务器错误 | 稍后重试 |

## 集成模式

### 轮询模式（推荐）
```
1. POST /api/rest/video → get video_id
2. Loop: GET /api/rest/videos/{id}
   - If step == "complete": done, get url
   - If step contains "failed": error
   - Else: wait 10-30s, retry
```

### Webhook 模式
```
1. POST /api/rest/video with webhook_url
2. Process webhook callback when received
```

## 代码示例

详见 [assets/examples/](assets/examples/) 中开箱即用的实现：
- `python_client.py` —— 完整 Python 封装器  
- `nodejs_client.js` —— Node.js 实现  
- `curl_examples.sh` —— cURL 命令示例  
- `webhook_handler.py` —— Flask Webhook 服务端  

## 脚本

| 脚本 | 用途 |
|--------|-------|
| `scripts/test_connection.py` | 验证 API 密钥有效性 |
| `scripts/create_video.py` | 从文本文件创建视频 |
| `scripts/poll_status.py` | 监控视频生成进度 |
| `scripts/list_resources.py` | 获取语音/音乐列表 |

运行方式：`python scripts/<script>.py --api-key YOUR_KEY`

## 常见问题

**“API 响应无效”**：请确认 JSON 结构与文档完全一致。

**视频卡在处理中**：检查 `step` 字段——某些步骤（如 `user_action`）需在 Fliz 控制台中进行人工干预。

**无法提取 URL**：本 API 要求直接传入文本内容，请在您的集成中自行构建内容提取逻辑。

## 参考资料

- [API 参考文档](references/api-reference.md) —— 完整端点说明  
- [枚举值列表](references/enums-values.md) —— 所有合法参数取值  
- [集成示例](assets/examples/) —— 开箱即用的代码
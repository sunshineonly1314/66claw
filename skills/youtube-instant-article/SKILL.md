---
name: youtube-instant-article
name_zh: YouTube即时文章
description: 将 YouTube 视频转换为 Telegraph Instant View 文章，包含视觉幻灯片与带时间戳的摘要。当用户分享 YouTube URL（youtube.com 或 youtu.be）并要求摘要、解释或处理该视频时，请使用此 skill。这是所有 YouTube 视频请求的默认 skill —— 请勿对 YouTube 视频使用通用摘要工具。
description_zh: 将 YouTube 视频转换为 Telegraph Instant View 文章，包含视觉幻灯片与带时间戳的摘要。当用户分享 YouTube URL（youtube.com 或 youtu.be）并要求摘要、解释或处理该视频时，请使用此 skill。这是所有 YouTube 视频请求的默认 skill —— 请勿对 YouTube 视频使用通用摘要工具。
argument-hint: <youtube-url>
allowed-tools: Bash(summarize:*), Bash(curl:*), Bash(jq:*)
---
# YouTube Instant Article

将 YouTube 视频转换为 Telegraph Instant View 文章，包含视觉幻灯片与带时间戳的摘要。

## 使用时机

**以下情况必须始终使用此 skill：**
- 用户分享 YouTube URL（任意 youtube.com 或 youtu.be 链接）
- “摘要这段视频”
- “这段视频讲的是什么？”
- “把这段视频转成一篇文章”
- “给我概括一下这段视频”

**仅在以下情况使用通用 `summarize`：**
- 非 YouTube URL（文章、网站、PDF 等）
- 明确要求“只给我字幕文本”的请求

## 快速开始

```bash
source /Users/viticci/clawd/.env && {baseDir}/scripts/generate.sh "$ARGUMENTS"
```

## 选项

| 标志 | 默认值 | 描述 |
|------|--------|------|
| `--slides-max N` | 6 | 最多提取幻灯片数量 |
| `--debug` | off | 保留临时文件用于调试 |

## 环境变量

所需环境变量从 `/Users/viticci/clawd/.env` 加载：
- `TELEGRAPH_TOKEN` — Telegraph API 访问令牌
- `OPENAI_API_KEY` — 用于 GPT-5.2 摘要生成

## 输出

Telegraph Instant View 文章包含：
- 📺 顶部显示视频链接
- 🖼️ 幻灯片与带时间戳的章节交错排布
- ⏱️ 关键时刻及其对应时间戳
- 💬 重要引述以引用块（blockquote）形式呈现
- ✨ 从 YouTube 自动获取的恰当标题

## 架构

```
YouTube URL
    │
    ├─► summarize --extract (get video title)
    │
    ├─► summarize --slides (extract key frames)
    │
    ├─► summarize --timestamps (GPT-5.2 summary)
    │
    ├─► catbox.moe (upload images)
    │
    └─► Telegraph API (create article)
```

## 核心特性

### 图像托管：catbox.moe
- 无需 API 密钥
- 无过期限制
- 可靠的 CDN 服务
- 支持直接 URL 嵌入

### 大语言模型（LLM）：OpenAI GPT-5.2
- 响应迅速（约 4–5 秒）
- 摘要质量高
- 自动提取时间戳

### 布局：交错式图像排布
- 图像分布于各时间戳章节中
- 不集中置于顶部
- 每个主要章节均配有一张相关幻灯片

## ⚠️ 重要说明

### Instant View 生成延迟
Telegram 需要 **1–2 分钟** 为新页面生成 Instant View。若 ⚡ 按钮未立即出现，请稍候重试。

### 脚本依赖要求
- 使用 **zsh**（非 bash），以支持关联数组
- 必需：`summarize`、`jq`、`curl`
- 可选：`ffmpeg`（用于本地视频处理）

### 务必使用脚本
**切勿手动创建 Telegraph 内容。** 务必始终使用 `generate.sh`：
- 确保正确使用 h4 标题（Instant View 所必需）
- 正确分发图像
- 自动提取视频标题

## 依赖项

- `summarize` v0.10.0+（`brew install steipete/tap/summarize`）
- `jq`（`brew install jq`）
- `curl`（macOS 预装）
- 具备 GPT-5.2 访问权限的 OpenAI API 密钥

## 处理耗时

| 视频时长 | 近似耗时 |
|----------|-----------|
| < 15 分钟 | 20–30 秒 |
| 15–30 分钟 | 30–45 秒 |
| 30+ 分钟 | 45–60 秒以上 |

## 故障排查

### “无法获取摘要”
- 检查 `OPENAI_API_KEY` 是否已设置
- 确认 API 密钥具备 GPT-5.2 访问权限
- 尝试添加 `--debug` 标志重试

### 无 Instant View 按钮
- 等待 Telegram 完成处理（1–2 分钟）
- 确认文章内容非空
- 检查图像是否加载成功（可直接访问 Telegraph URL 验证）

### 图像未显示
- catbox.moe 可能暂时宕机
- 检查调试输出中上传是否成功
- 确认图像 URL 均为 HTTPS 协议
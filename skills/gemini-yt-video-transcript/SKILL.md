---
name: gemini-yt-video-transcript
name_zh: Gemini油管视频字幕
description: "使用 Google Gemini 为 YouTube 视频 URL 创建逐字稿（含说话人标签、段落分隔；不含时间码）。当用户要求转录 YouTube 视频，或需要一份干净、无时间戳的逐字稿时，请使用本 skill。"
description_zh: 使用 Google Gemini 为 YouTube 视频 URL 创建逐字稿（含说话人标签、段落分隔；不含时间码）。当用户要求转录 YouTube 视频，或需要一份干净、无时间戳的逐字稿时，请使用本 skill。
summary: "通过 Google Gemini 生成 YouTube 视频逐字稿（含说话人标签，不含时间码）。"
version: 1.0.2
homepage: https://github.com/odrobnik/gemini-yt-video-transcript-skill
metadata: {"clawdbot":{"emoji":"📝","requires":{"env":["GEMINI_API_KEY"],"bins":["python3"]}}}
---
# Gemini YouTube 视频逐字稿

使用 **Google Gemini** 为 YouTube URL 创建 **逐字稿**。

**输出格式**
- 首行为 YouTube 视频标题
- 其后仅为如下格式的逐字稿行：

```
Speaker: text
```

**要求**
- 不含时间码
- 不含额外标题 / 列表 / 评论性内容

## 使用方法

```bash
python3 {baseDir}/scripts/youtube_transcript.py "https://www.youtube.com/watch?v=..."
```

选项：
- `--out <path>` 将逐字稿写入指定文件（默认：在工作区 `out/` 文件夹中自动生成命名）。

## 交付方式

在聊天中：以文档/附件形式发送生成的逐字稿。
---
name: youtube-watcher
name_zh: YouTube监控器
description: 获取并读取 YouTube 视频的字幕文本。当需要对视频进行摘要、回答有关其内容的问题，或从中提取信息时使用。
description_zh: 获取并读取 YouTube 视频的字幕文本。当需要对视频进行摘要、回答有关其内容的问题，或从中提取信息时使用。
author: michael gathara
version: 1.0.0
triggers:
  - "watch youtube"
  - "summarize video"
  - "video transcript"
  - "youtube summary"
  - "analyze video"
metadata: {"clawdbot":{"emoji":"📺","requires":{"bins":["yt-dlp"]},"install":[{"id":"brew","kind":"brew","formula":"yt-dlp","bins":["yt-dlp"],"label":"Install yt-dlp (brew)"},{"id":"pip","kind":"uv","package":"yt-dlp","bins":["yt-dlp"],"label":"Install yt-dlp (pip)"}]}}
---
# YouTube Watcher

从 YouTube 视频中获取字幕，以支持摘要生成、问答（QA）及内容提取。

## 使用方法

### 获取字幕

获取视频的文字字幕。

```bash
python3 {baseDir}/scripts/get_transcript.py "https://www.youtube.com/watch?v=VIDEO_ID"
```

## 示例

**摘要视频：**

1. 获取字幕：
   ```bash
   python3 {baseDir}/scripts/get_transcript.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
   ```
2. 阅读输出结果，并为用户生成摘要。

**查找特定信息：**

1. 获取字幕。
2. 在文本中搜索关键词，或基于字幕内容回答用户问题。

## 注意事项

- 要求 `yt-dlp` 已安装且位于系统 PATH 中。
- 支持带有闭合字幕（CC）或自动生成字幕的视频。
- 若视频无字幕，脚本将报错退出。
---
name: youtube-summarizer
name_zh: YouTube摘要器
description: 自动获取 YouTube 视频字幕、生成结构化摘要，并向消息平台发送完整字幕文本。自动识别 YouTube URL，并提供视频元数据、关键洞见及可下载字幕。
description_zh: 自动获取 YouTube 视频字幕、生成结构化摘要，并向消息平台发送完整字幕文本。自动识别 YouTube URL，并提供视频元数据、关键洞见及可下载字幕。
version: 1.0.0
author: abe238
tags: [youtube, transcription, summarization, video, telegram]
---
# YouTube 字幕摘要器（YouTube Summarizer）skill

自动从 YouTube 视频中获取字幕、生成结构化摘要，并向消息平台交付完整字幕文本。

## 使用时机

当出现以下情形时激活本 skill：
- 用户分享 YouTube URL（youtube.com/watch、youtu.be、youtube.com/shorts）
- 用户要求摘要或转录某 YouTube 视频
- 用户询问某 YouTube 视频的内容信息

## 依赖项

**必需：** MCP YouTube Transcript 服务器须安装于以下路径：
`/root/clawd/mcp-server-youtube-transcript`

如未安装，请执行：
```bash
cd /root/clawd
git clone https://github.com/kimtaeyoon83/mcp-server-youtube-transcript.git
cd mcp-server-youtube-transcript
npm install && npm run build
```

## 工作流程

### 1. 检测 YouTube URL
从以下模式中提取视频 ID：
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- 直接提供视频 ID：`VIDEO_ID`（11 位字符）

### 2. 获取字幕
运行以下命令获取字幕：
```bash
cd /root/clawd/mcp-server-youtube-transcript && node --input-type=module -e "
import { getSubtitles } from './dist/youtube-fetcher.js';
const result = await getSubtitles({ videoID: 'VIDEO_ID', lang: 'en' });
console.log(JSON.stringify(result, null, 2));
" > /tmp/yt-transcript.json
```

将 `VIDEO_ID` 替换为上一步提取出的视频 ID。读取 `/tmp/yt-transcript.json` 中的输出结果。

### 3. 数据处理

解析 JSON 以提取以下字段：
- `result.metadata.title` — 视频标题  
- `result.metadata.author` — 频道名称  
- `result.metadata.viewCount` — 格式化后的观看次数  
- `result.metadata.publishDate` — 发布日期  
- `result.actualLang` — 使用的语言  
- `result.lines` — 字幕片段数组  

完整文本：`result.lines.map(l => l.text).join(' ')`

### 4. 生成摘要

使用如下模板生成结构化摘要：

```markdown
📹 **Video:** [title]
👤 **Channel:** [author] | 👁️ **Views:** [views] | 📅 **Published:** [date]

**🎯 Main Thesis:**
[1-2 sentence core argument/message]

**💡 Key Insights:**
- [insight 1]
- [insight 2]
- [insight 3]
- [insight 4]
- [insight 5]

**📝 Notable Points:**
- [additional point 1]
- [additional point 2]

**🔑 Takeaway:**
[Practical application or conclusion]
```

要求：
- 核心论点：最多 1–2 句  
- 关键洞见：3–5 条要点，每条 1–2 句  
- 重要细节：2–4 条支撑性信息  
- 实用结论：具可操作性的收尾总结  

### 5. 保存完整字幕

将完整字幕保存至带时间戳的文件：
```
/root/clawd/transcripts/YYYY-MM-DD_VIDEO_ID.txt
```

文件内容须包含：
- 视频元数据页眉  
- 完整字幕文本  
- 视频 URL 引用  

### 6. 平台特定交付

**若渠道为 Telegram：**  
```bash
message --action send --channel telegram --target CHAT_ID \
  --filePath /root/clawd/transcripts/YYYY-MM-DD_VIDEO_ID.txt \
  --caption "📄 YouTube Transcript: [title]"
```

**若渠道为其他平台/Webchat：**  
仅回复摘要内容（不附加文件）。

### 7. 回复摘要

将结构化摘要作为对用户的响应发送。

## 错误处理

**若字幕获取失败：**  
- 检查视频是否启用了字幕功能  
- 若请求语言不可用，尝试使用 `lang: 'en'` 回退机制  
- 告知用户字幕不可用，并建议替代方案：  
  - 使用 YouTube 自带的手动字幕功能  
  - 视频本身可能未提供字幕  
  - 尝试其他视频  

**若未安装 MCP 服务器：**  
- 提供安装说明  
- 若上下文允许，可主动提供自动化安装选项  

**若视频 ID 提取失败：**  
- 请求用户提供完整的 YouTube URL 或视频 ID  

## 示例

参见 `examples/` 目录下的示例输出。

## 质量准则

- **简洁性：** 摘要应在 30 秒内可快速浏览完毕  
- **准确性：** 不得添加字幕中未包含的信息  
- **结构性：** 使用一致的格式便于阅读  
- **情境适配性：** 根据视频长度调整详略程度  
  - 短视频（<5 分钟）：简明摘要  
  - 长视频（>30 分钟）：更细致的分解  

## 说明

- MCP 服务器通过模拟 Android 客户端行为，绕过 YouTube 对云 IP 的封锁  
- 在 VPS/云环境等 yt-dlp 常常失效的场景下仍能稳定运行  
- 支持多语言，自动回退至英文  
- 字幕质量取决于 YouTube 自动生成字幕或人工添加字幕的质量  
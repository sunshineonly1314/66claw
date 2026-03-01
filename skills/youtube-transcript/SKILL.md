---
name: youtube-transcript
name_zh: YouTube字幕
description: 获取并摘要 YouTube 视频的字幕文本。当被要求对 YouTube 视频进行摘要、转录或提取内容时使用。通过住宅 IP 代理获取字幕，以绕过 YouTube 对云 IP 的封禁。
description_zh: 获取并摘要 YouTube 视频的字幕文本。当被要求对 YouTube 视频进行摘要、转录或提取内容时使用。通过住宅 IP 代理获取字幕，以绕过 YouTube 对云 IP 的封禁。
---
# YouTube 字幕

从 YouTube 视频中获取字幕，并可选地对其进行摘要。

## 快速开始

```bash
python3 scripts/fetch_transcript.py <video_id_or_url> [languages]
```

**示例：**
```bash
python3 scripts/fetch_transcript.py dQw4w9WgXcQ
python3 scripts/fetch_transcript.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
python3 scripts/fetch_transcript.py dQw4w9WgXcQ "fr,en,de"
```

**输出：** JSON 格式，包含 `video_id`、`title`、`author`、`full_text` 和带时间戳的 `transcript` 数组。

## 工作流程

1. 使用视频 ID 或 URL 运行 `fetch_transcript.py`
2. 脚本检查 VPN 状态，如未启用则自动启动
3. 返回含完整字幕文本的 JSON
4. 按需对 `full_text` 字段进行摘要

## 语言代码

默认优先级：`en, fr, de, es, it, pt, nl`

可通过第二个参数覆盖：`python3 scripts/fetch_transcript.py VIDEO_ID "ja,ko,zh"`

## 安装与配置

参见 [references/SETUP.md](references/SETUP.md)：
- Python 依赖项安装
- WireGuard VPN 配置（云 VPS 环境必需）
- 常见错误排查
- 替代代理方案
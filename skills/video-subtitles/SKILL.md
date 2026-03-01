---
name: video-subtitles
name_zh: 视频字幕
description: 利用 ivrit.ai（希伯来语）与 Whisper（英语）模型，从音视频中生成 SRT 字幕，并支持多语言互译；亦可将字幕硬编码（burn-in）至视频中。适用于生成字幕、文字稿，或为 WhatsApp/社交媒体制作硬编码字幕。
description_zh: 利用 ivrit.ai（希伯来语）与 Whisper（英语）模型，从音视频中生成 SRT 字幕，并支持多语言互译；亦可将字幕硬编码（burn-in）至视频中。适用于生成字幕、文字稿，或为 WhatsApp/社交媒体制作硬编码字幕。
---
# 视频字幕

从视频或音频文件中生成电影风格字幕。支持语音转文字（transcription）、跨语言翻译及字幕硬编码（burn-in）至视频。

## 功能特性

- **希伯来语**：采用 ivrit.ai 微调模型（当前最优希伯来语转录效果）
- **英语**：OpenAI Whisper large-v3 模型
- **自动检测**：自动识别输入语言并选择最优模型
- **翻译功能**：支持希伯来语 → 英语翻译
- **硬编码字幕**：将字幕直接烧录进视频（在所有平台——包括 WhatsApp——均可见）
- **电影风格排版**：自然断句（每行最多 42 字符，持续时长 1–7 秒）

## 快速开始

```bash
# Plain transcript
./scripts/generate_srt.py video.mp4

# Generate SRT file
./scripts/generate_srt.py video.mp4 --srt

# Burn subtitles into video (always visible)
./scripts/generate_srt.py video.mp4 --srt --burn

# Translate to English + burn in
./scripts/generate_srt.py video.mp4 --srt --burn --translate en

# Force language
./scripts/generate_srt.py video.mp4 --lang he    # Hebrew
./scripts/generate_srt.py video.mp4 --lang en    # English
```

## 可选参数

| 标志 | 说明 |
|------|------|
| `--srt` | 仅生成 SRT 字幕文件 |
| `--burn` | 将字幕硬编码进视频（始终可见） |
| `--embed` | 嵌入软字幕（可在播放器中开关） |
| `--translate en` | 翻译为英文 |
| `--lang he/en` | 强制指定输入语言 |
| `-o FILE` | 自定义输出路径 |

## 输出结果

- **默认行为**：纯文本文字稿输出至 stdout
- **启用 `--srt` 时**：在输入文件同目录下生成 `video.srt`
- **启用 `--burn` 时**：生成带硬编码字幕的 `video_subtitled.mp4`

## 依赖要求

- **uv**：Python 包管理器（自动安装依赖）
- **ffmpeg-full**：用于字幕硬编码（`brew install ffmpeg-full`）
- **模型文件**：每个约 3 GB，首次运行时自动下载

## 字幕样式

- 字体大小 12，白色文字配黑色描边
- 底部对齐，符合电影字幕标准位置
- 每行最多 42 字符，最多两行
- 断句遵循标点符号与自然停顿
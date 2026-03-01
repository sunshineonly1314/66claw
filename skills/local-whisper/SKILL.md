---
name: local-whisper
name_zh: 本地Whisper
description: 使用 OpenAI Whisper 进行本地语音转文字。模型下载后全程离线运行。支持多种模型尺寸，提供高质量转录。
description_zh: 使用 OpenAI Whisper 进行本地语音转文字。模型下载后全程离线运行。支持多种模型尺寸，提供高质量转录。
metadata: {"clawdbot":{"emoji":"🎙️","requires":{"bins":["ffmpeg"]}}}
---
# 本地 Whisper 语音转文字（STT）

使用 OpenAI Whisper 进行本地语音转文字。**模型下载后全程离线运行**。

## 使用方式

```bash
# Basic
~/.clawdbot/skills/local-whisper/scripts/local-whisper audio.wav

# Better model
~/.clawdbot/skills/local-whisper/scripts/local-whisper audio.wav --model turbo

# With timestamps
~/.clawdbot/skills/local-whisper/scripts/local-whisper audio.wav --timestamps --json
```

## 模型

| 模型 | 大小 | 说明 |
|------|------|------|
| `tiny` | 39M | 最快 |
| `base` | 74M | **默认** |
| `small` | 244M | 性能均衡 |
| `turbo` | 809M | 速度与质量最佳平衡 |
| `large-v3` | 1.5GB | 最高精度 |

## 选项

- `--model/-m` —— 模型尺寸（默认：base）
- `--language/-l` —— 语言代码（省略时自动检测）
- `--timestamps/-t` —— 包含单词时间戳
- `--json/-j` —— JSON 格式输出
- `--quiet/-q` —— 抑制进度提示

## 设置

使用 uv 管理的虚拟环境，路径为 `.venv/`。如需重装：
```bash
cd ~/.clawdbot/skills/local-whisper
uv venv .venv --python 3.12
uv pip install --python .venv/bin/python click openai-whisper torch --index-url https://download.pytorch.org/whl/cpu
```
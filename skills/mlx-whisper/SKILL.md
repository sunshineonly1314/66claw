---
name: mlx-whisper
name_zh: MLX-Whisper
version: 1.0.0
description: 本地语音转文字，基于 MLX Whisper（专为 Apple Silicon 优化，无需 API 密钥）。
description_zh: 本地语音转文字，基于 MLX Whisper（专为 Apple Silicon 优化，无需 API 密钥）。
homepage: https://github.com/ml-explore/mlx-examples/tree/main/whisper
metadata: {"clawdbot":{"emoji":"🍎","requires":{"bins":["mlx_whisper"]},"install":[{"id":"pip","kind":"uv","package":"mlx-whisper","bins":["mlx_whisper"],"label":"安装 mlx-whisper（pip）"}]}}
---
# MLX Whisper

基于 Apple MLX 的本地语音转文字工具，专为 Apple Silicon Mac（M1/M2/M3/M4）优化。

## 快速开始

```bash
mlx_whisper /path/to/audio.mp3 --model mlx-community/whisper-large-v3-turbo
```

## 常见用法

```bash
# Transcribe to text file
mlx_whisper audio.m4a -f txt -o ./output

# Transcribe with language hint
mlx_whisper audio.mp3 --language en --model mlx-community/whisper-large-v3-turbo

# Generate subtitles (SRT)
mlx_whisper video.mp4 -f srt -o ./subs

# Translate to English
mlx_whisper foreign.mp3 --task translate
```

## 模型（首次使用时自动下载）

| 模型 | 大小 | 速度 | 质量 |
|------|------|------|------|
| mlx-community/whisper-tiny | ~75MB | 最快 | 基础 |
| mlx-community/whisper-base | ~140MB | 快 | 良好 |
| mlx-community/whisper-small | ~470MB | 中等 | 更佳 |
| mlx-community/whisper-medium | ~1.5GB | 较慢 | 出色 |
| mlx-community/whisper-large-v3 | ~3GB | 最慢 | 最佳 |
| mlx-community/whisper-large-v3-turbo | ~1.6GB | 快 | 极佳（推荐） |

## 注意事项

- 需运行于 Apple Silicon Mac（M1/M2/M3/M4）
- 模型将缓存至 `~/.cache/huggingface/`
- 默认模型为 `mlx-community/whisper-tiny`；如需最佳效果，请使用 `--model mlx-community/whisper-large-v3-turbo`
---
name: parakeet-mlx
name_zh: Parakeet MLX
description: 使用 Parakeet MLX（ASR）在 Apple Silicon 设备上本地执行语音转文字（无需 API 密钥）。
description_zh: 使用 Parakeet MLX（ASR）在 Apple Silicon 设备上本地执行语音转文字（无需 API 密钥）。
homepage: https://github.com/senstella/parakeet-mlx
metadata: {"clawdbot":{"emoji":"🦜","requires":{"bins":["parakeet-mlx"]},"install":[{"id":"uv-tool","kind":"uv","formula":"parakeet-mlx","bins":["parakeet-mlx"],"label":"Install Parakeet MLX CLI (uv tool install)"}]}}
---
# Parakeet MLX（命令行工具）

使用 `parakeet-mlx` 在 Apple Silicon 设备上本地转录音频。

快速开始
- `parakeet-mlx /path/audio.mp3 --output-format txt`
- `parakeet-mlx /path/audio.m4a --output-format vtt --highlight-words`
- `parakeet-mlx *.mp3 --output-format all`

注意事项
- 请使用以下命令安装 CLI：`uv tool install parakeet-mlx -U`（而非 `uv add` 或 `pip install`）
- 使用 `parakeet-mlx --help` 查看全部选项（即 `--help`，而非 `-h`）
- 首次运行时，模型将从 Hugging Face 下载至 `~/.cache/huggingface`
- 默认模型：`mlx-community/parakeet-tdt-0.6b-v3`（专为 Apple Silicon 优化）
- 音频处理需已安装 `ffmpeg`
- 输出格式支持：txt、srt、vtt、json，或全部格式
- 使用 `--verbose` 可查看详细进度及置信度分数
- 支持多文件输入（支持 Shell 通配符，例如 `*.mp3`）
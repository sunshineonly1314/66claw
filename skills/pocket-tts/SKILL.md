---
name: pocket-tts
description: 完全本地化、离线运行的文本转语音（TTS）功能，基于 Kyutai 的 Pocket TTS 模型。无需任何 API 调用或互联网连接，即可从文本生成高质量音频。内置 8 种语音，支持语音克隆，并全程仅依赖 CPU 运行。
description_zh: 完全本地化、离线运行的文本转语音（TTS）功能，基于 Kyutai 的 Pocket TTS 模型。无需任何 API 调用或互联网连接，即可从文本生成高质量音频。内置 8 种语音，支持语音克隆，并全程仅依赖 CPU 运行。
---
# Pocket TTS 技能

完全本地化、离线运行的文本转语音（TTS）功能，基于 Kyutai 的 Pocket TTS 模型。无需任何 API 调用或互联网连接，即可从文本生成高质量音频。内置 8 种语音，支持语音克隆，并全程仅依赖 CPU 运行。

## 功能特性

- 🎯 **完全本地化** —— 无任何 API 调用，完全离线运行  
- 🚀 **仅需 CPU** —— 无需 GPU，可在任意计算机上运行  
- ⚡ **快速生成** —— CPU 上约达实时速度的 2–6 倍  
- 🎤 **8 种内置语音** —— alba、marius、javert、jean、fantine、cosette、eponine、azelma  
- 🎭 **语音克隆** —— 可使用 WAV 样本克隆任意语音  
- 🔊 **低延迟** —— 首个音频分块约 200ms  
- 📚 **简洁的 Python API** —— 易于集成至任意项目  

## 安装方法

```bash
# 1. Accept the model license on Hugging Face
# https://huggingface.co/kyutai/pocket-tts

# 2. Install the package
pip install pocket-tts

# Or use uv for automatic dependency management
uvx pocket-tts generate "Hello world"
```

## 使用方式

### 命令行界面（CLI）

```bash
# Basic usage
pocket-tts "Hello, I am your AI assistant"

# With specific voice
pocket-tts "Hello" --voice alba --output hello.wav

# With custom voice file (voice cloning)
pocket-tts "Hello" --voice-file myvoice.wav --output output.wav

# Adjust speed
pocket-tts "Hello" --speed 1.2

# Start local server
pocket-tts --serve

# List available voices
pocket-tts --list-voices
```

### Python API

```python
from pocket_tts import TTSModel
import scipy.io.wavfile

# Load model
tts_model = TTSModel.load_model()

# Get voice state
voice_state = tts_model.get_state_for_audio_prompt(
    "hf://kyutai/tts-voices/alba-mackenna/casual.wav"
)

# Generate audio
audio = tts_model.generate_audio(voice_state, "Hello world!")

# Save to WAV
scipy.io.wavfile.write("output.wav", tts_model.sample_rate, audio.numpy())

# Check sample rate
print(f"Sample rate: {tts_model.sample_rate} Hz")
```

## 可用语音列表

| 语音 | 描述 |
|------|------|
| alba | 日常风格女性语音 |
| marius | 男性语音 |
| javert | 清晰的男性语音 |
| jean | 自然的男性语音 |
| fantine | 女性语音 |
| cosette | 女性语音 |
| eponine | 女性语音 |
| azelma | 女性语音 |

或使用 `--voice-file /path/to/wav.wav` 进行自定义语音克隆。

## 可选参数

| 参数 | 描述 | 默认值 |
|------|------|--------|
| `text` | 待转换的文本 | 必填项 |
| `-o, --output` | 输出 WAV 文件路径 | `output.wav` |
| `-v, --voice` | 语音预设 | `alba` |
| `-s, --speed` | 语速（0.5–2.0） | `1.0` |
| `--voice-file` | 用于克隆的自定义 WAV 文件 | 无 |
| `--serve` | 启动 HTTP 服务器 | False |
| `--list-voices` | 列出全部可用语音 | False |

## 系统要求

- Python 3.10–3.14  
- PyTorch 2.5+（CPU 版本即可）  
- 支持双 CPU 核心  

## 注意事项

- ⚠️ 模型受许可限制 —— 需先在 Hugging Face 接受许可协议  
- 🌍 仅支持英语（v1 版本）  
- 💾 首次运行将自动下载模型（约含 1 亿参数）  
- 🔊 音频以一维 torch 张量（PCM 数据）形式返回  

## 相关链接

- [演示页面](https://kyutai.org/tts)  
- [GitHub 仓库](https://github.com/kyutai-labs/pocket-tts)  
- [Hugging Face 页面](https://huggingface.co/kyutai/pocket-tts)  
- [论文](https://arxiv.org/abs/2509.06926)  
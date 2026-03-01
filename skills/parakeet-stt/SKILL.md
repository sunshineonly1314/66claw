---
name: parakeet-stt
name_zh: Parakeet语音识别
description: >-
description_zh: >-
  使用 NVIDIA Parakeet TDT 0.6B v3（基于 CPU 的 ONNX 模型）进行本地语音转文字。
  速度约为 Whisper 的 30 倍，支持 25 种语言，具备自动语言检测能力，并提供与 OpenAI 兼容的 API。
  适用于本地转录音频文件、将语音转换为文字，或在不依赖云端 API 的前提下处理语音录音。
homepage: https://github.com/groxaxo/parakeet-tdt-0.6b-v3-fastapi-openai
metadata: {"clawdbot":{"emoji":"🦜","env":["PARAKEET_URL"]}}
---
# Parakeet TDT（语音转文字）

基于 NVIDIA Parakeet TDT 0.6B v3 与 ONNX Runtime 的本地语音转文字方案。  
可在 CPU 上运行——无需 GPU。实时处理速度约快 30 倍。

## 安装

```bash
# Clone the repo
git clone https://github.com/groxaxo/parakeet-tdt-0.6b-v3-fastapi-openai.git
cd parakeet-tdt-0.6b-v3-fastapi-openai

# Run with Docker (recommended)
docker compose up -d parakeet-cpu

# Or run directly with Python
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 5000
```

默认端口为 `5000`。可通过设置 `PARAKEET_URL` 覆盖默认端口（例如：`http://localhost:5092`）。

## API 端点

OpenAI 兼容 API 地址为 `$PARAKEET_URL`（默认：`http://localhost:5000`）。

## 快速开始

```bash
# Transcribe audio file (plain text)
curl -X POST $PARAKEET_URL/v1/audio/transcriptions \
  -F "file=@/path/to/audio.mp3" \
  -F "response_format=text"

# Get timestamps and segments
curl -X POST $PARAKEET_URL/v1/audio/transcriptions \
  -F "file=@/path/to/audio.mp3" \
  -F "response_format=verbose_json"

# Generate subtitles (SRT)
curl -X POST $PARAKEET_URL/v1/audio/transcriptions \
  -F "file=@/path/to/audio.mp3" \
  -F "response_format=srt"
```

## Python / OpenAI SDK

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url=os.getenv("PARAKEET_URL", "http://localhost:5000") + "/v1",
    api_key="not-needed"
)

with open("audio.mp3", "rb") as f:
    transcript = client.audio.transcriptions.create(
        model="parakeet-tdt-0.6b-v3",
        file=f,
        response_format="text"
    )
print(transcript)
```

## 响应格式

| 格式 | 输出 |
|--------|--------|
| `text` | 纯文本 |
| `json` | `{"text": "..."}` |
| `verbose_json` | 带时间戳与单词的分段结果 |
| `srt` | SRT 字幕 |
| `vtt` | WebVTT 字幕 |

## 支持的语言（25 种）

英语、西班牙语、法语、德语、意大利语、葡萄牙语、波兰语、俄语、  
乌克兰语、荷兰语、瑞典语、丹麦语、芬兰语、挪威语、希腊语、捷克语、  
罗马尼亚语、匈牙利语、保加利亚语、斯洛伐克语、克罗地亚语、立陶宛语、拉脱维亚语、  
爱沙尼亚语、斯洛文尼亚语  

语言自动识别——无需任何配置。

## Web 界面

在浏览器中打开 `$PARAKEET_URL`，即可使用拖放式语音转文字界面。

## Docker 管理

```bash
# Check status
docker ps --filter "name=parakeet"

# View logs
docker logs -f <container-name>

# Restart
docker compose restart

# Stop
docker compose down
```

## 为何选择 Parakeet 而非 Whisper？

- **速度**：在 CPU 上实时处理速度快约 30 倍  
- **准确率**：与 Whisper large-v3 相当  
- **隐私性**：100% 本地运行，无任何云端调用  
- **兼容性**：可作为 OpenAI 语音转文字 API 的即插即用替代方案  
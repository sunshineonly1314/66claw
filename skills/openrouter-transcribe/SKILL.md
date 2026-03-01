---
name: openrouter-transcribe
name_zh: OpenRouter转录
description: 通过 OpenRouter 使用具备音频能力的模型（如 Gemini、GPT-4o-audio 等）转录音频文件。
description_zh: 通过 OpenRouter 使用具备音频能力的模型（如 Gemini、GPT-4o-audio 等）转录音频文件。
homepage: https://openrouter.ai/docs
metadata: {"clawdbot":{"emoji":"🎙️","requires":{"bins":["curl","ffmpeg","base64","jq"],"env":["OPENROUTER_API_KEY"]},"primaryEnv":"OPENROUTER_API_KEY"}}
---
# OpenRouter 音频转录

使用 OpenRouter 的聊天补全（chat completions）API，以 `input_audio` 内容类型转录音频文件。兼容所有支持音频输入的模型。

## 快速开始

```bash
{baseDir}/scripts/transcribe.sh /path/to/audio.m4a
```

输出发送至标准输出（stdout）。

## 有用参数

```bash
# Custom model (default: google/gemini-2.5-flash)
{baseDir}/scripts/transcribe.sh audio.ogg --model openai/gpt-4o-audio-preview

# Custom instructions
{baseDir}/scripts/transcribe.sh audio.m4a --prompt "Transcribe with speaker labels"

# Save to file
{baseDir}/scripts/transcribe.sh audio.m4a --out /tmp/transcript.txt

# Custom caller identifier (for OpenRouter dashboard)
{baseDir}/scripts/transcribe.sh audio.m4a --title "MyApp"
```

## 工作原理

1. 使用 ffmpeg 将音频转换为 WAV 格式（单声道，16kHz）  
2. 对音频进行 Base64 编码  
3. 将编码后音频连同 `input_audio` 内容一并发送至 OpenRouter 聊天补全接口  
4. 从响应中提取转录文本  

## API 密钥

设置 `OPENROUTER_API_KEY` 环境变量，或在 `~/.clawdbot/clawdbot.json` 中配置：

```json5
{
  skills: {
    "openrouter-transcribe": {
      apiKey: "YOUR_OPENROUTER_KEY"
    }
  }
}
```

## 请求头（Headers）

脚本向 OpenRouter 发送以下标识请求头：  
- `X-Title`：调用方名称（默认为 "Peanut/Clawdbot"）  
- `HTTP-Referer`：引用网址（默认为 "https://clawdbot.com"）  

这些信息将在您的 OpenRouter 控制台中显示，便于追踪。

## 故障排查

**ffmpeg 格式错误**：脚本使用临时目录（而非 `mktemp -t file.wav`），因为 macOS 的 mktemp 会在扩展名后添加随机后缀，导致格式识别失败。

**参数列表过长**：大体积音频文件生成的 Base64 字符串可能超出 shell 参数长度限制。脚本改用临时文件（`--rawfile` 供 jq 使用，`@file` 供 curl 使用），避免将数据作为命令行参数传递。

**空响应**：若收到 “Empty response from API”（API 返回空响应），脚本将输出原始响应内容以便调试。常见原因包括：  
- API 密钥无效  
- 所选模型不支持音频输入  
- 音频文件过大或已损坏  
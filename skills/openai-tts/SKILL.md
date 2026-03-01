---
name: openai-tts
name_zh: OpenAI语音合成
description: 通过 OpenAI Audio Speech API 实现文本转语音。
description_zh: 通过 OpenAI Audio Speech API 实现文本转语音。
homepage: https://platform.openai.com/docs/guides/text-to-speech
metadata: {"clawdbot":{"emoji":"🔊","requires":{"bins":["curl"],"env":["OPENAI_API_KEY"]},"primaryEnv":"OPENAI_API_KEY"}}
---
# OpenAI TTS（curl）

通过 OpenAI 的 `/v1/audio/speech` 端点，将文本转换为语音。

## 快速入门

```bash
{baseDir}/scripts/speak.sh "Hello, world!"
{baseDir}/scripts/speak.sh "Hello, world!" --out /tmp/hello.mp3
```

默认参数：
- 模型：`tts-1`（速度快）或 `tts-1-hd`（音质高）  
- 声音：`alloy`（中性），其他可选：`echo`、`fable`、`onyx`、`nova`、`shimmer`  
- 格式：`mp3`  

## 声音选项

| 声音 | 描述 |
|------|------|
| alloy | 中性、均衡 |
| echo | 男声、温暖 |
| fable | 英式口音、富有表现力 |
| onyx | 深沉、威严 |
| nova | 女声、友好 |
| shimmer | 女声、柔和 |

## 标志（Flags）

```bash
{baseDir}/scripts/speak.sh "Text" --voice nova --model tts-1-hd --out speech.mp3
{baseDir}/scripts/speak.sh "Text" --format opus --speed 1.2
```

选项说明：
- `--voice <name>`：alloy｜echo｜fable｜onyx｜nova｜shimmer（默认：alloy）  
- `--model <name>`：tts-1｜tts-1-hd（默认：tts-1）  
- `--format <fmt>`：mp3｜opus｜aac｜flac｜wav｜pcm（默认：mp3）  
- `--speed <n>`：0.25–4.0（默认：1.0）  
- `--out <path>`：输出文件路径（默认：标准输出 stdout 或自动生成文件名）

## API 密钥

设置 `OPENAI_API_KEY`，或在 `~/.clawdbot/clawdbot.json` 中配置：

```json5
{
  skills: {
    entries: {
      "openai-tts": {
        apiKey: "sk-..."
      }
    }
  }
}
```

## 定价

- tts-1：约 $0.015 / 每千字符  
- tts-1-hd：约 $0.030 / 每千字符  

短文本响应成本极低！
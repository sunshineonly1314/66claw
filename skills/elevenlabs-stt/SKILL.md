---
name: elevenlabs-stt
name_zh: ElevenLabs语音转文本
description: 使用 ElevenLabs 语音转文本（Speech-to-Text，Scribe v2）对音频文件进行转录。
description_zh: 使用 ElevenLabs 语音转文本（Speech-to-Text，Scribe v2）对音频文件进行转录。
homepage: https://elevenlabs.io/speech-to-text
metadata: {"clawdbot":{"emoji":"🎙️","requires":{"bins":["curl"],"env":["ELEVENLABS_API_KEY"]},"primaryEnv":"ELEVENLABS_API_KEY"}}
---
# ElevenLabs 语音转文本（STT）

使用 ElevenLabs Scribe v2 模型对音频文件进行转录。支持 90+ 种语言，并具备说话人分离（speaker diarization）能力。

## 快速入门

```bash
# Basic transcription
{baseDir}/scripts/transcribe.sh /path/to/audio.mp3

# With speaker diarization
{baseDir}/scripts/transcribe.sh /path/to/audio.mp3 --diarize

# Specify language (improves accuracy)
{baseDir}/scripts/transcribe.sh /path/to/audio.mp3 --lang en

# Full JSON output with timestamps
{baseDir}/scripts/transcribe.sh /path/to/audio.mp3 --json
```

## 可选参数

| 参数 | 说明 |
|------|-------------|
| `--diarize` | 识别不同说话人 |
| `--lang CODE` | ISO 语言代码（例如 en、pt、es） |
| `--json` | 输出含词级时间戳的完整 JSON |
| `--events` | 标记音频事件（如笑声、音乐等） |

## 支持格式

涵盖所有主流音视频格式：mp3、m4a、wav、ogg、webm、mp4 等。

## API 密钥

设置环境变量 `ELEVENLABS_API_KEY`，或在 clawdbot.json 中配置：

```json5
{
  skills: {
    entries: {
      "elevenlabs-stt": {
        apiKey: "sk_..."
      }
    }
  }
}
```

## 使用示例

```bash
# Transcribe a WhatsApp voice note
{baseDir}/scripts/transcribe.sh ~/Downloads/voice_note.ogg

# Meeting recording with multiple speakers
{baseDir}/scripts/transcribe.sh meeting.mp3 --diarize --lang en

# Get JSON for processing
{baseDir}/scripts/transcribe.sh podcast.mp3 --json > transcript.json
```
---
name: vocal-chat
name_zh: 语音聊天
description: 在 WhatsApp 上处理语音到语音的对话。自动转录收到的音频，并使用本地 TTS 生成语音回复。当用户希望“说话”而非打字时使用。
description_zh: 在 WhatsApp 上处理语音到语音的对话。自动转录收到的音频，并使用本地 TTS 生成语音回复。当用户希望“说话”而非打字时使用。
---
# 步话机模式

该 skill 利用本地语音转文字（ASR）与本地文本转语音（TTS）功能，自动化 WhatsApp 上的语音到语音交互流程。

## 工作流程

1. **接收音频**：当用户发送一个音频/ogg/opus 文件时：
   - 使用 `tools/transcribe_voice.sh` 获取对应文本。
   - 将该文本作为普通用户输入进行处理。

2. **发送回复**：
   - 不以纯文本形式回复，而是使用 `bin/sherpa-onnx-tts` 生成语音。
   - 将生成的 `.ogg` 文件作为语音便签发送回用户。

## 触发条件

- 用户发送了一条音频消息。
- 用户说 “activa modo walkie-talkie” 或 “hablemos por voz”。

## 约束条件

- 仅使用本地工具（ffmpeg、whisper-cpp、sherpa-onnx-tts）。
- 保持快速响应时间（RTF < 0.5）。
- 始终同时以**文本（确保清晰）和音频**两种形式回复。

## 手动执行（内部使用）

如需手动以语音方式回复：
```bash
bin/sherpa-onnx-tts /tmp/reply.ogg "Tu mensaje aquí"
```
然后通过 `message` 工具，将 `/tmp/reply.ogg` 发送出去，并传入 `filePath` 参数。
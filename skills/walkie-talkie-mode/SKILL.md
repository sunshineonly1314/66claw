---
name: walkie-talkie-mode
name_zh: 对讲模式
description: 处理 WhatsApp 上的语音对语音对话。自动转录收到的音频，并以本地 TTS 生成语音响应。当用户希望“说话”而非打字时启用。
description_zh: 处理 WhatsApp 上的语音对语音对话。自动转录收到的音频，并以本地 TTS 生成语音响应。当用户希望“说话”而非打字时启用。
---
# 步话机模式（Walkie-Talkie Mode）

本 skill 利用本地语音转文字（ASR）与本地文本转语音（TTS），自动化 WhatsApp 上的语音对语音交互流程。

## 工作流

1. **接收音频**：当用户发送音频/ogg/opus 文件时：
   - 使用 `tools/transcribe_voice.sh` 提取文本。
   - 将该文本作为普通用户提示进行处理。

2. **发出响应**：
   - 不以文本形式回复，而是使用 `bin/sherpa-onnx-tts` 生成语音。
   - 将生成的 `.ogg` 文件作为语音便签发回给用户。

## 触发条件

- 用户发送了一条音频消息。
- 用户说“activa modo walkie-talkie”或“hablemos por voz”。

## 约束条件

- 仅可使用本地工具（ffmpeg、whisper-cpp、sherpa-onnx-tts）。
- 需保持快速响应时间（实时因子 RTF < 0.5）。
- 必须同时以文本（确保清晰）和音频两种形式回复。

## 手动执行（内部使用）

如需手动以语音方式回复：
```bash
bin/sherpa-onnx-tts /tmp/reply.ogg "Tu mensaje aquí"
```
然后通过 `message` 工具，以 `filePath` 为参数发送 `/tmp/reply.ogg`。
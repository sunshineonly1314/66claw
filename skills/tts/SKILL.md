---
name: tts
name_zh: 文字转语音
description: 使用 Hume AI（或 OpenAI）API 将文本转换为语音。当用户请求音频消息、语音回复，或希望“亲耳听到”某内容时使用。
description_zh: 使用 Hume AI（或 OpenAI）API 将文本转换为语音。当用户请求音频消息、语音回复，或希望“亲耳听到”某内容时使用。
---
# 文本转语音（TTS）

将文本转换为语音，并生成音频文件（MP3）。

## Hume AI（首选）

- **首选语音**：`9e1f9e4f-691a-4bb0-b87c-e306a4c838ef`  
- **密钥**：以环境变量形式存储，分别为 `HUME_API_KEY` 和 `HUME_SECRET_KEY`。

### 使用方式

```bash
HUME_API_KEY="..." HUME_SECRET_KEY="..." node {baseDir}/scripts/generate_hume_speech.js --text "Hello Jonathan" --output "output.mp3"
```

## OpenAI（旧版）

- **首选语音**：`nova`  
- **使用方式**：`OPENAI_API_KEY="..." node {baseDir}/scripts/generate_speech.js --text "..." --output "..."`

## 通用说明

- 脚本将打印一行 `MEDIA:`，其中包含所生成文件的绝对路径。  
- 请使用 `message` 工具将生成的音频文件发送给用户。
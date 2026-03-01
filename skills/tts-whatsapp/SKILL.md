---
name: tts-whatsapp
name_zh: WhatsApp文字转语音
version: 1.0.0
description: Send high-quality text-to-speech voice messages on WhatsApp in 40+ languages with automatic delivery
description_zh: Send high-quality text-to-speech voice messages on WhatsApp in 40+ languages with automatic delivery
user-invocable: true
disable-model-invocation: false
tags:
  - whatsapp
  - tts
  - voice
  - messaging
  - multilingual
  - audio
author: Community
repository: https://github.com/clawdbot/clawdhub
---
# 🎙️ TTS WhatsApp —— 支持 40+ 种语言的语音消息

通过自动投递功能，在 WhatsApp 上发送高质量文本转语音（TTS）语音消息。支持 40+ 种语言、个人消息及群组广播。

## ✨ 特性

- 🎙️ **高质量 TTS**，由 Piper 驱动（支持 40+ 种语言）  
- 🎵 **自动格式转换**为 OGG/Opus（WhatsApp 标准格式）  
- 📤 **自动投递**，通过 Clawdbot 实现  
- 👥 **群组支持** —— 可向个人或 WhatsApp 群组发送  
- 🌍 **多语言支持** —— 法语、英语、西班牙语、德语及 40+ 种其他语言  
- 🧹 **智能清理** —— 成功发送后自动删除文件  
- ⚡ **快速响应** —— 从命令执行到送达耗时约 2–3 秒  

## 📦 前置条件

1. **Piper TTS**：`pip3 install --user piper-tts`  
2. **FFmpeg**：`brew install ffmpeg`（macOS）或 `apt install ffmpeg`（Linux）  
3. **语音模型**：从 [Hugging Face](https://huggingface.co/rhasspy/piper-voices) 下载  
   - 存放至 `~/.clawdbot/skills/piper-tts/models/`  
   - 示例路径：`fr_FR-siwis-medium.onnx`  

## 🚀 快速上手

### 基础用法  
```bash
tts-whatsapp "Hello, this is a test" --target "+15555550123"
```  

### 向 WhatsApp 群组发送  
```bash
tts-whatsapp "Hello everyone" --target "120363257357161211@g.us"
```  

### 切换语言  
```bash
tts-whatsapp "Hola mundo" --lang es_ES --voice carlfm --target "+34..."
```  

### 不同质量等级  
```bash
tts-whatsapp "High quality" --quality high --target "+1..."
```  

## 🌍 支持的语言

- 🇫🇷 法语（`fr_FR`）：siwis、upmc、tom  
- 🇬🇧 英语（英式，`en_GB`）：alan、alba  
- 🇺🇸 英语（美式，`en_US`）：lessac、amy、joe  
- 🇪🇸 西班牙语（`es_ES`、`es_MX`）：carlfm、davefx  
- 🇩🇪 德语（`de_DE`）：thorsten、eva_k  
- 🇮🇹 意大利语（`it_IT`）：riccardo  
- 🇵🇹 葡萄牙语（`pt_BR`、`pt_PT`）：faber  
- 🇳🇱 荷兰语（`nl_NL`）：mls、rdh  
- 🇷🇺 俄语（`ru_RU`）：dmitri、irina  
- 以及 30+ 种其他语言！  

[完整语音列表 →](https://rhasspy.github.io/piper-samples/)  

## 🔧 配置

在 `~/.clawdbot/clawdbot.json` 中配置：

```json
{
  "skills": {
    "entries": {
      "tts_whatsapp": {
        "enabled": true,
        "env": {
          "WHATSAPP_DEFAULT_TARGET": "+15555550123",
          "PIPER_DEFAULT_LANG": "en_US",
          "PIPER_DEFAULT_VOICE": "lessac",
          "PIPER_DEFAULT_QUALITY": "medium"
        }
      }
    }
  }
}
```  

## 🎛️ 全部选项

```
--target NUMBER       WhatsApp number or group ID
--message TEXT        Text message with audio
--lang LANGUAGE       Language (default: fr_FR)
--voice VOICE         Voice name (default: auto)
--quality QUALITY     x_low, low, medium, high
--speed SPEED         Playback speed (default: 1.0)
--no-send            Don't send automatically
```  

## 📊 性能表现

一条 10 秒语音消息总耗时约 **2.3 秒**：  
- TTS 生成：约 1 秒  
- 格式转换：约 0.2 秒  
- WhatsApp 投递：约 1 秒  

## 📚 完整文档

详见 [README.md](README.md)，内含完整文档、使用示例与故障排查指南。
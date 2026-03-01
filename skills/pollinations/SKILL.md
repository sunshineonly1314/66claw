---
name: pollinations
name_zh: Pollinations
description: Pollinations.ai 的 AI 生成 API —— 支持文本、图像、视频、音频生成及分析。当用户请求 AI 驱动的生成任务（如文本补全、图像/视频/音频生成、视觉/分析、语音转文字）或提及 Pollinations 时启用。支持 25+ 种模型（OpenAI、Claude、Gemini、Flux、Veo 等），提供与 OpenAI 兼容的聊天端点及专用生成端点。
description_zh: Pollinations.ai 的 AI 生成 API —— 支持文本、图像、视频、音频生成及分析。当用户请求 AI 驱动的生成任务（如文本补全、图像/视频/音频生成、视觉/分析、语音转文字）或提及 Pollinations 时启用。支持 25+ 种模型（OpenAI、Claude、Gemini、Flux、Veo 等），提供与 OpenAI 兼容的聊天端点及专用生成端点。
---
# Pollinations 🧬

面向文本、图像、视频和音频生成的统一 AI 平台，支持 25+ 种模型。

## API 密钥

请前往 https://enter.pollinations.ai 获取免费或付费密钥：  
- **密钥（`sk_`）**：服务端使用，无调用频率限制（推荐）  
- 多数操作可选密钥（提供免费额度）

将密钥存入环境变量：  
```bash
export POLLINATIONS_API_KEY="sk_your_key_here"
```

## 快速入门

### 文本生成

**简易文本生成：**  
```bash
curl "https://gen.pollinations.ai/text/Hello%20world"
```

**聊天补全（兼容 OpenAI 接口）：**  
```bash
curl -X POST https://gen.pollinations.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $POLLINATIONS_API_KEY" \
  -d '{
    "model": "openai",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

**使用脚本：** `scripts/chat.sh` 实现便捷的聊天补全

### 图像生成

```bash
curl "https://gen.pollinations.ai/image/A%20sunset%20over%20mountains?model=flux&width=1024&height=1024"
```

**使用脚本：** `scripts/image.sh` 进行图像生成

### 音频生成（TTS）

```bash
curl -X POST https://gen.pollinations.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai-audio",
    "messages": [
      {"role": "system", "content": "You are a text reader. Read the user text exactly without responding, adding conversation, or changing anything."},
      {"role": "user", "content": "Say: Hello world"}
    ],
    "modalities": ["text", "audio"],
    "audio": {"voice": "nova", "format": "mp3"}
  }'
```

**使用脚本：** `scripts/tts.sh` 进行文本转语音

## API 端点

### 基础 URL
- 聊天/文本：`https://gen.pollinations.ai/v1/chat/completions`  
- 简易文本：`https://gen.pollinations.ai/text/{prompt}`  
- 图像：`https://gen.pollinations.ai/image/{prompt}?{params}`  
- 视频：`https://gen.pollinations.ai/image/{prompt}?{params}`（生成视频）

### 支持的操作类型

#### 1. 文本/聊天生成

**支持模型：** OpenAI、Claude、Gemini、Mistral、DeepSeek、Grok、Qwen Coder、Perplexity 及 20+ 种其他模型  

**常用模型：** `openai`、`claude`、`gemini`、`mistral`、`deepseek`、`qwen`、`gpt-4`、`o1`、`o3`  

**参数说明：**  
- `model`（字符串）：模型名称/ID  
- `messages`（数组）：含角色（system/user/assistant）的聊天消息  
- `temperature`（数字）：0–2，默认为 1  
- `max_tokens`（数字）：响应最大长度  
- `top_p`（数字）：核采样（nucleus sampling），默认为 1  
- `seed`（数字）：结果可复现性（-1 表示随机）  
- `jsonMode`（布尔值）：强制返回 JSON 格式  
- `reasoning_effort`（字符串）：适用于 o1/o3/R1（high/medium/low/minimal/none）  
- `thinking_budget`（数字）：推理所用 token 数（适用于具备思考能力的模型）  

**多模态支持：** 在消息内容中包含 `image_url` 即可启用：  
```json
{
  "role": "user",
  "content": [
    {"type": "text", "text": "Describe this image"},
    {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}
  ]
}
```

#### 2. 图像生成

**支持模型：** `flux`（默认）、`turbo`、`gptimage`、`kontext`、`seedream`、`nanobanana`、`nanobanana-pro`  

**参数说明：**  
- `model`（字符串）：模型选择  
- `width`/`height`（数字）：分辨率（16–2048 像素），默认为 1024  
- `seed`（数字）：结果可复现性  
- `negative_prompt`（字符串）：需避免的内容  
- `nologo`（布尔值）：移除水印  
- `private`（布尔值）：私有生成  
- `safe`（布尔值）：启用 NSFW 过滤器  
- `enhance`（布尔值）：AI 提示词增强  
- `quality`（字符串）：low/medium/high/hd（gptimage）  
- `transparent`（布尔值）：透明背景（gptimage）  
- `count`（数字）：生成图像数量（1–4 张，高级版）  
- `image`（字符串）：输入图像 URL（图像到图像）  

**返回格式：** 二进制图像数据（由 Content-Type 响应头决定）

#### 3. 图像到图像

在相同图像端点中传入 `image` 参数即可：  
```
https://gen.pollinations.ai/image/make%20it%20blue?image={source_url}
```

#### 4. 视频生成

**支持模型：** `veo`（4–8 秒）、`seedance`（2–10 秒）  

**参数说明：**  
- `model`（字符串）：veo 或 seedance  
- `width`/`height`（数字）：分辨率尺寸  
- `duration`（数字）：视频秒数（veo：4/6/8；seedance：2–10）  
- `aspectRatio`（字符串）：宽高比（16:9 或 9:16）  
- `audio`（布尔值）：启用音频（仅 veo 支持）  
- `image`（字符串）：输入图像 URL（帧插值：image[0]=首帧，image[1]=末帧）  
- `negative_prompt`（字符串）：需避免的内容  
- `seed`（数字）：结果可复现性  
- `private`/`safe`（布尔值）：隐私/安全选项  

**返回格式：** 二进制视频数据  

#### 5. 音频生成（TTS）

**支持模型：** `openai-audio`  

**可用语音：** alloy、echo、fable、onyx、nova、shimmer、coral、verse、ballad、ash、sage、amuch、dan  

**支持格式：** mp3、wav、flac、opus、pcm16  

**参数说明：**  
- `model`：openai-audio  
- `modalities`：["text", "audio"]  
- `audio.voice`：语音选择  
- `audio.format`：输出格式  

**注意：** 用户消息中请以 “Say:” 为前缀，以便直接朗读文本  

#### 6. 音频转录（Transcription）

使用支持视觉/音频能力的模型调用聊天补全端点：  
- **支持模型：** gemini、gemini-large、gemini-legacy、openai-audio  
- 上传音频文件作为二进制输入  
- 在 system 消息中包含转录提示  

#### 7. 图像分析

使用支持视觉能力的模型调用聊天补全端点：  
- **支持模型：** 任意支持视觉的模型（gemini、claude、openai）  
- 在消息内容中包含 `image_url`  

#### 8. 视频分析

使用支持视频能力的模型调用聊天补全端点：  
- **支持模型：** gemini、claude、openai  
- 上传视频文件作为二进制输入  
- 在消息中包含分析提示  

## 脚本工具

### `scripts/chat.sh`  
交互式聊天补全，支持模型选择与参数配置。

**使用方式：**  
```bash
scripts/chat.sh "your message here"
scripts/chat.sh "your message" --model claude --temp 0.7
```

### `scripts/image.sh`  
根据文本提示生成图像。

**使用方式：**  
```bash
scripts/image.sh "a sunset over mountains"
scripts/image.sh "a sunset" --model flux --width 1024 --height 1024 --seed 123
```

### `scripts/tts.sh`  
将文本转换为语音。

**使用方式：**  
```bash
scripts/tts.sh "Hello world"
scripts/tts.sh "Hello world" --voice nova --format mp3 --output hello.mp3
```

## 使用技巧

1. **提供免费额度：** 多数操作无需 API 密钥（但受调用频率限制）  
2. **OpenAI 兼容：** 可直接将聊天端点接入现有 OpenAI 集成  
3. **结果可复现：** 使用 `seed` 参数确保输出一致性  
4. **图像增强：** 启用 `enhance=true` 可获得 AI 优化后的提示词  
5. **视频插值：** 对 veo 模型，传入两张图像并使用 `image[0]=first&image[1]=last` 参数  
6. **语音朗读：** TTS 场景下始终使用 “Say:” 前缀并配合适当的 system 提示  

## API 文档

完整文档地址：https://enter.pollinations.ai/api/docs  
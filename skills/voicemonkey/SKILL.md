---
name: voicemonkey
name_zh: Voicemonkey
description: 通过 VoiceMonkey API v2 控制 Alexa 设备——发布语音播报、触发预设流程（routines）、启动自定义工作流（flows），以及在设备上显示媒体内容。
description_zh: 通过 VoiceMonkey API v2 控制 Alexa 设备——发布语音播报、触发预设流程（routines）、启动自定义工作流（flows），以及在设备上显示媒体内容。
homepage: https://voicemonkey.io
metadata: {"clawdbot":{"emoji":"🐒","requires":{"env":["VOICEMONKEY_TOKEN"]},"primaryEnv":"VOICEMONKEY_TOKEN"}}
---
# VoiceMonkey

通过 VoiceMonkey API v2 控制 Alexa/Echo 设备。支持语音播报（TTS）、触发 Alexa 预设流程（routines）、启动自定义工作流（flows），以及在 Echo Show 设备上显示图像或视频。

## 安装配置

1. 在 [Voice Monkey 控制台](https://console.voicemonkey.io) → Settings → API Credentials 页面获取您的密钥令牌（secret token）  
2. 设置环境变量：  
   ```bash
   export VOICEMONKEY_TOKEN="your-secret-token"
   ```  
   或添加至 `~/.clawdbot/clawdbot.json`：  
   ```json
   {
     "skills": {
       "entries": {
         "voicemonkey": {
           "env": { "VOICEMONKEY_TOKEN": "your-secret-token" }
         }
       }
     }
   }
   ```  
3. 在 Voice Monkey 控制台 → Settings → Devices 页面查找您的设备 ID（Device IDs）

## API 基础地址（Base URL）

```
https://api-v2.voicemonkey.io
```

## 语音播报（Announcement）API

在 Alexa 设备上执行语音播报（TTS）、播放音视频，或展示图像。

**接口地址（Endpoint）：** `https://api-v2.voicemonkey.io/announcement`

### 基础 TTS 语音播报

```bash
curl -X GET "https://api-v2.voicemonkey.io/announcement?token=$VOICEMONKEY_TOKEN&device=YOUR_DEVICE_ID&text=Hello%20from%20Echo"
```

### 带认证请求头（推荐）

```bash
curl -X POST "https://api-v2.voicemonkey.io/announcement" \
  -H "Authorization: $VOICEMONKEY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device": "YOUR_DEVICE_ID",
    "text": "Hello from Echo the Fox!"
  }'
```

### 指定语音与提示音（Chime）

```bash
curl -X POST "https://api-v2.voicemonkey.io/announcement" \
  -H "Authorization: $VOICEMONKEY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device": "YOUR_DEVICE_ID",
    "text": "Dinner is ready!",
    "voice": "Brian",
    "chime": "soundbank://soundlibrary/alarms/beeps_and_bloops/bell_02"
  }'
```

### 在 Echo Show 上显示图像

```bash
curl -X POST "https://api-v2.voicemonkey.io/announcement" \
  -H "Authorization: $VOICEMONKEY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device": "YOUR_DEVICE_ID",
    "text": "Check out this image",
    "image": "https://example.com/image.jpg",
    "media_width": "100",
    "media_height": "100",
    "media_scaling": "best-fit"
  }'
```

### 播放音频文件

```bash
curl -X POST "https://api-v2.voicemonkey.io/announcement" \
  -H "Authorization: $VOICEMONKEY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device": "YOUR_DEVICE_ID",
    "audio": "https://example.com/sound.mp3"
  }'
```

### 在 Echo Show 上播放视频

```bash
curl -X POST "https://api-v2.voicemonkey.io/announcement" \
  -H "Authorization: $VOICEMONKEY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device": "YOUR_DEVICE_ID",
    "video": "https://example.com/video.mp4",
    "video_repeat": 1
  }'
```

### 在 Echo Show 上打开网页

```bash
curl -X POST "https://api-v2.voicemonkey.io/announcement" \
  -H "Authorization: $VOICEMONKEY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device": "YOUR_DEVICE_ID",
    "website": "https://example.com",
    "no_bg": "true"
  }'
```

### 语音播报参数说明

| 参数 | 是否必需 | 描述 |
|------|----------|------|
| `token` | 是* | 密钥令牌（*或通过 Authorization 请求头传入） |
| `device` | 是 | 来自 Voice Monkey 控制台的设备 ID |
| `text` | 否 | TTS 文本（支持 SSML） |
| `voice` | 否 | TTS 使用的语音类型（参见 API Playground 查看可选项） |
| `language` | 否 | 语言代码（提升发音准确性） |
| `chime` | 否 | 提示音（chime）URL 或 Alexa 声音库引用名 |
| `audio` | 否 | 待播放音频文件的 HTTPS 地址 |
| `background_audio` | 否 | 在 TTS 播报背景中播放的音频 |
| `image` | 否 | Echo Show 上显示图像的 HTTPS 地址 |
| `video` | 否 | Echo Show 上播放 MP4 视频的 HTTPS 地址 |
| `video_repeat` | 否 | 视频循环播放次数 |
| `website` | 否 | 在 Echo Show 上打开的网页 URL |
| `no_bg` | 否 | 设为 "true" 可隐藏 Voice Monkey 品牌标识 |
| `media_width` | 否 | 图像宽度 |
| `media_height` | 否 | 图像高度 |
| `media_scaling` | 否 | 图像缩放模式 |
| `media_align` | 否 | 图像对齐方式 |
| `media_radius` | 否 | 图像裁剪的圆角半径 |
| `var-[name]` | 否 | 更新 Voice Monkey 变量 |

## 预设流程（Routine）触发 API

触发 Voice Monkey 设备执行 Alexa 预设流程（Routines）。

**接口地址（Endpoint）：** `https://api-v2.voicemonkey.io/trigger`

```bash
curl -X POST "https://api-v2.voicemonkey.io/trigger" \
  -H "Authorization: $VOICEMONKEY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device": "YOUR_TRIGGER_DEVICE_ID"
  }'
```

| 参数 | 是否必需 | 描述 |
|------|----------|------|
| `token` | 是* | 密钥令牌（*或通过 Authorization 请求头传入） |
| `device` | 是 | 来自 Voice Monkey 控制台的触发设备 ID |

## 工作流（Flows）触发 API

启动 Voice Monkey 自定义工作流（Flows）。

**接口地址（Endpoint）：** `https://api-v2.voicemonkey.io/flows`

```bash
curl -X POST "https://api-v2.voicemonkey.io/flows" \
  -H "Authorization: $VOICEMONKEY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device": "YOUR_DEVICE_ID",
    "flow": 12345
  }'
```

| 参数 | 是否必需 | 描述 |
|------|----------|------|
| `token` | 是* | 密钥令牌（*或通过 Authorization 请求头传入） |
| `device` | 是 | 设备 ID |
| `flow` | 是 | 来自 Voice Monkey 控制台的数字型工作流 ID（Flow ID） |

## 媒体内容要求

### 图像（Images）
- 支持常见格式（JPG、PNG 等）  
- **不支持动态 GIF**  
- 请优化文件大小以加快加载速度  
- 必须托管于具备有效 SSL 证书的 HTTPS 地址  
- CORS 策略必须允许通配符：`Access-Control-Allow-Origin: *`  

### 视频（Videos）
- **仅支持 MP4 格式**（MPEG-4 Part-14）  
- 音频编码：AAC、MP3  
- 最高分辨率：1080p @30fps 或 @60fps  
- 必须托管于具备有效 SSL 证书的 HTTPS 地址  

### 音频（Audio）
- 支持格式：AAC、MP3、OGG、Opus、WAV  
- 码率：≤ 1411.20 kbps  
- 采样率：≤ 48kHz  
- 单文件大小：≤ 10MB  
- 总响应时长：≤ 240 秒  

## SSML 示例

在 `text` 参数中使用 SSML 可实现更丰富的语音播报效果：

```xml
<speak>
  <amazon:emotion name="excited" intensity="high">
    This is exciting news!
  </amazon:emotion>
</speak>
```

```xml
<speak>
  The time is <say-as interpret-as="time">3:30pm</say-as>
</speak>
```

## 注意事项

- 请妥善保管您的密钥令牌；如遭泄露，请通过控制台 → Settings → API Credentials 进行轮换  
- 可使用 [API Playground](https://console.voicemonkey.io) 测试并探索各项功能  
- 高级会员可在 Voice Monkey 控制台中直接上传媒体资源  
- 发送语音播报前务必确认，避免意外产生噪音  
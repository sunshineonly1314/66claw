# Chat 语音助手吉祥物 — 架构文档

## 概述

当系统检测到本地 ASR（语音识别）模型已安装时，在聊天输入框右上方浮现一个动画卡通机器人吉祥物，提示用户"语音告诉我"。用户点击麦克风按钮即可录音，录音完成后自动转写为文字并填入聊天框。

## 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                        前端 (Browser)                        │
│                                                              │
│  app-gateway.ts ──300ms──▶ checkVoiceCapabilities()          │
│       │                          │                           │
│       ▼                          ▼                           │
│  controllers/voice.ts      asr.status (RPC)                  │
│  ├─ checkAsrAvailability()       │                           │
│  ├─ transcribeAudio()            ▼                           │
│  ├─ dismissMascot()        app.ts (state)                    │
│  └─ isMascotDismissed()    ├─ voiceAsrAvailable              │
│                            ├─ voiceMascotDismissed            │
│  voice/audio-recorder.ts   ├─ voiceRecordingState            │
│  ├─ AudioRecorder          └─ voiceError                     │
│  └─ RecordingState               │                           │
│                                  ▼                           │
│  voice/wav-encoder.ts      app-render.ts                     │
│  └─ blobToWavBase64()      └─ voiceMascot prop ──▶ chat.ts   │
│                                                    │         │
│                                                    ▼         │
│                                          views/voice-mascot  │
│                                          └─ renderVoiceMascot│
│                                                              │
│  styles/chat/voice-mascot.css ── 5 组 keyframe 动画          │
└──────────────────────────────────────────────────────────────┘
                    ↕ WebSocket RPC
┌──────────────────────────────────────────────────────────────┐
│                     后端 (Node.js Gateway)                    │
│                                                              │
│  gateway/server-methods/asr.ts                               │
│  ├─ "asr.status"     → detectInstalledModel() (文件系统检查) │
│  └─ "asr.transcribe" → Base64 → 临时 WAV → speechToText()   │
│                                                              │
│  agents/tools/asr-tool.ts                                    │
│  ├─ detectInstalledModel()  → 扫描模型目录                   │
│  └─ speechToText()          → sherpa-onnx-node 推理          │
└──────────────────────────────────────────────────────────────┘
```

## 数据流

### 1. ASR 可用性检测

```
页面加载 → Gateway 连接成功 → 延迟 300ms
  → checkAsrAvailability(client)
  → RPC "asr.status"
  → 后端 detectInstalledModel() 扫描 ~/.clawdbot/tools/sherpa-onnx-asr/models/
  → 返回 { available: true/false, model: "sense-voice-..." }
  → 前端设置 voiceAsrAvailable = true → 吉祥物显现
```

### 2. 录音 → 转写 → 填入

```
用户点击麦克风
  → AudioRecorder.start()
  → getUserMedia({ audio: true }) 请求麦克风权限
  → MediaRecorder 开始录音 (webm/opus)
  → 状态: idle → requesting → recording
  → [用户说话，最长 30s]

用户点击停止 / 30s 自动停止
  → AudioRecorder.stop()
  → 状态: recording → processing
  → blobToWavBase64(blob)
    → AudioContext.decodeAudioData()
    → mixToMono() → resample(16kHz) → encodeWav(PCM16)
    → ArrayBuffer → Base64 字符串

  → onComplete(wavBase64)
  → transcribeAudio(client, wavBase64)
  → RPC "asr.transcribe"
    → 后端: Base64 → 临时文件 → speechToText() → 删除临时文件
    → 返回 { text: "识别的文字" }

  → chatMessage += text (填入聊天框)
  → 状态: processing → idle
```

### 3. 吉祥物关闭持久化

```
用户点击 × 按钮
  → handleVoiceMascotDismiss()
  → localStorage.setItem("clawdbot:voice:mascot-dismissed", "true")
  → voiceMascotDismissed = true → 吉祥物消失
  → 刷新页面后仍然不显示
```

## 文件清单

### 新建文件（6 个）

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/gateway/server-methods/asr.ts` | ~93 | ASR RPC 端点：状态查询 + 音频转写 |
| `ui/src/ui/voice/wav-encoder.ts` | ~133 | 浏览器音频 Blob → 16kHz mono WAV Base64 |
| `ui/src/ui/voice/audio-recorder.ts` | ~176 | MediaRecorder 封装，4 种状态机 |
| `ui/src/ui/controllers/voice.ts` | ~101 | 语音能力状态管理 + RPC 封装 + localStorage |
| `ui/src/ui/views/voice-mascot.ts` | ~146 | 吉祥物渲染函数 + 内联 SVG（机器人头 + 波形）|
| `ui/src/styles/chat/voice-mascot.css` | ~253 | 完整样式 + 5 组 keyframe 动画 + 响应式 |

### 修改文件（9 个）

| 文件 | 修改点 |
|------|--------|
| `src/agents/tools/asr-tool.ts` | 导出 `detectInstalledModel()` 和 `AsrModelEntry` |
| `src/gateway/server-methods.ts` | 注册 `asrHandlers` 到 `coreGatewayHandlers` |
| `ui/src/ui/views/chat.ts` | `ChatProps.voiceMascot` + 渲染调用 |
| `ui/src/ui/app.ts` | 4 个 `@state()` 字段 + 4 个 handler 方法 |
| `ui/src/ui/app-render.ts` | `voiceMascot` prop 接线 |
| `ui/src/ui/app-gateway.ts` | 延迟 300ms 调用 `checkVoiceCapabilities()` |
| `ui/src/ui/icons.ts` | 新增 `mic` / `micOff` SVG 图标 |
| `ui/src/styles/chat.css` | `@import voice-mascot.css` |
| `ui/src/ui/i18n/locales/en.ts` | 9 个 `voice.*` 翻译键 |
| `ui/src/ui/i18n/locales/zh-CN.ts` | 9 个 `voice.*` 中文翻译 |

## UI 状态机

```
                    ┌──────────┐
                    │   idle   │◀──────────────────────┐
                    └────┬─────┘                       │
                         │ click mic                   │
                         ▼                             │
                   ┌────────────┐                      │
                   │ requesting │  getUserMedia         │
                   └─────┬──────┘                      │
             denied │    │ granted                     │
                ▼        ▼                             │
           [error]  ┌───────────┐                      │
                    │ recording │  max 30s              │
                    └─────┬─────┘                      │
                          │ stop / timeout             │
                          ▼                            │
                    ┌────────────┐                     │
                    │ processing │  WAV 编码 + 转写 RPC │
                    └─────┬──────┘                     │
                          │ complete / error           │
                          └────────────────────────────┘
```

## 动画设计

| 动画名称 | 用途 | 时长 | 效果 |
|----------|------|------|------|
| `voice-mascot-enter` | 吉祥物入场 | 0.4s | 从下方弹入 + spring 弹性 |
| `voice-mascot-float` | 头像悬浮 | 3s 循环 | 轻微上下漂浮 (-3px) |
| `voice-mascot-blink` | 机器人眨眼 | 4s 循环 | scaleY 压缩模拟眨眼 |
| `voice-mascot-bubble-enter` | 气泡出现 | 0.5s | 从右侧滑入 + 延迟 0.2s |
| `voice-mascot-pulse` | 录音脉冲 | 1.5s 循环 | 红色 box-shadow 呼吸灯 |

## 响应式策略

- `>600px`: 完整显示（头像 + 气泡 + 麦克风按钮）
- `≤600px`: 隐藏头像和气泡，仅保留麦克风按钮（38px）

## 安全考量

- **临时文件**: 后端转写时写入 `os.tmpdir()`，路径使用 `Date.now()` + 随机后缀防冲突，`finally` 块保证清理
- **麦克风权限**: 通过 `getUserMedia` 标准浏览器权限流程，拒绝时优雅降级
- **Base64 传输**: 30s 16kHz mono WAV ≈ 960KB Base64，在 WebSocket 容量内
- **模型检测**: `asr.status` 仅做文件系统检查（`fs.existsSync`），不加载 native module

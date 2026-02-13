# Chat 语音助手吉祥物 — 需求 & 架构文档

## 1. 需求描述

### 1.1 背景

ClawdBot 集成了本地离线语音识别能力（基于 sherpa-onnx-node + SenseVoice/Paraformer 模型），支持中文、英文、日语、韩语、粤语。用户需要通过 Skills 页面下载 ASR 模型文件后才能使用。

### 1.2 功能目标

在 Chat 聊天界面提供**零门槛语音输入入口**：
- 当系统检测到本地 ASR 模型已安装时，自动在聊天输入框右上方浮现一个动画卡通机器人吉祥物
- 吉祥物带有气泡提示"语音告诉我"，引导用户使用语音输入
- 点击麦克风按钮开始录音（最长 30 秒），录音完成后自动转写为文字并填入聊天输入框
- 用户可永久关闭吉祥物（localStorage 持久化，刷新页面不再出现）

### 1.3 交互规格

| 场景 | 行为 |
|------|------|
| ASR 模型未安装 | 吉祥物不显示 |
| ASR 模型已安装 + 首次访问 | 吉祥物弹入动画出现（spring 弹性） |
| 鼠标 hover 吉祥物 | 右上角出现 × 关闭按钮 |
| 点击 × | 永久隐藏，localStorage 记录 |
| 点击麦克风 | 请求麦克风权限 → 开始录音 |
| 录音中 | 麦克风按钮变红色脉冲，显示波形动画，隐藏气泡 |
| 点击停止 / 30s 超时 | 进入处理态，显示"识别中..." |
| 转写成功 | 文字追加到聊天输入框，回到待机态 |
| 转写失败 | 显示错误信息（5 秒自动消失），回到待机态 |
| 小屏 ≤600px | 隐藏头像和气泡，只保留麦克风按钮 |

---

## 2. 系统架构

### 2.1 架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                          前端 (Browser)                           │
│                                                                  │
│  app-gateway.ts ── 连接成功后 300ms ──▶ checkVoiceCapabilities() │
│       │                                      │                   │
│       ▼                                      ▼                   │
│  controllers/voice.ts                  RPC "asr.status"          │
│  ├─ checkAsrAvailability(client)             │                   │
│  ├─ transcribeAudio(client, wav)             ▼                   │
│  ├─ dismissMascot()                    app.ts (@state)           │
│  └─ isMascotDismissed()               ├─ voiceAsrAvailable      │
│                                        ├─ voiceMascotDismissed   │
│  voice/audio-recorder.ts              ├─ voiceRecordingState     │
│  ├─ AudioRecorder (class)             ├─ voiceError              │
│  └─ RecordingState (type)             ├─ setVoiceError(5s auto)  │
│                                        └─ audioRecorder (private)│
│  voice/wav-encoder.ts                        │                   │
│  └─ blobToWavBase64()                        ▼                   │
│                                        app-render.ts             │
│                                        └─ voiceMascot prop       │
│                                               │                  │
│                                               ▼                  │
│                                         views/chat.ts            │
│                                         └─ renderVoiceMascot()   │
│                                               │                  │
│                                               ▼                  │
│                                        views/voice-mascot.ts     │
│                                        └─ 3 态 UI 渲染           │
│                                                                  │
│  styles/chat/voice-mascot.css ── 5 组 keyframe 动画              │
│  icons.ts ── mic / micOff SVG 图标                               │
│  i18n ── en.ts + zh-CN.ts (11 个 voice.* 翻译键)                │
└──────────────────────────────────────────────────────────────────┘
                         ↕ WebSocket RPC
┌──────────────────────────────────────────────────────────────────┐
│                      后端 (Node.js Gateway)                       │
│                                                                  │
│  gateway/server-methods/asr.ts                                   │
│  ├─ "asr.status"     → detectInstalledModel() (纯文件系统检查)   │
│  └─ "asr.transcribe" → 参数校验 → Base64 → 临时 WAV             │
│                         → speechToText() → 清理临时文件          │
│                                                                  │
│  agents/tools/asr-tool.ts                                        │
│  ├─ detectInstalledModel() → 扫描 ~/.clawdbot/tools/.../models/  │
│  ├─ speechToText()         → sherpa-onnx-node 离线推理           │
│  └─ createAsrTool()        → Agent 工具注册 (独立于 RPC)         │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 核心设计决策

| 决策 | 方案 | 理由 |
|------|------|------|
| ASR 检测方式 | `asr.status` RPC 纯文件系统检查 | 不加载 native module，零启动开销 |
| 音频格式 | 前端转 16kHz mono WAV | sherpa-onnx 原生格式，无需后端 ffmpeg |
| 传输方式 | Base64 over WebSocket | 复用现有 RPC 通道，30s ≈ 960KB |
| UI 框架 | Lit html 纯函数渲染 | 与项目现有 renderChat 模式一致 |
| 动画实现 | 纯 CSS @keyframes | 不依赖 JS 动画库，GPU 加速（transform/opacity）|
| 状态管理 | app.ts @state() 响应式 | Lit 原生响应式，无需额外状态库 |
| 关闭持久化 | localStorage | 轻量、无需后端接口 |

---

## 3. 数据流

### 3.1 ASR 可用性检测

```
页面加载 → Gateway WebSocket 连接成功 → 延迟 300ms（不阻塞首屏）
  → controllers/voice.ts: checkAsrAvailability(client)
  → RPC "asr.status"
  → 后端 detectInstalledModel()
    → 扫描 ~/.clawdbot/tools/sherpa-onnx-asr/models/
    → 优先选择 SenseVoice，其次 Paraformer
  → 返回 { available: true/false, model: "sense-voice-..." }
  → app.ts: voiceAsrAvailable = true
  → app-render.ts: voiceMascot prop 构建
  → chat.ts → voice-mascot.ts: 吉祥物渲染 + 入场动画
```

### 3.2 录音 → 转写 → 填入

```
用户点击麦克风按钮
  → app.ts: handleVoiceStartRecording()
    → 清除上次错误: setVoiceError(null)
    → 释放旧录音器: audioRecorder?.dispose()
    → 创建新 AudioRecorder 实例
  → AudioRecorder.start()
    → 状态: idle → requesting
    → getUserMedia({ audio: true }) 请求麦克风权限
    → 权限拒绝 → onError("voice.error.noMic") → 状态回 idle
    → 权限允许 → 选择最佳 MIME (webm/opus > ogg > mp4)
    → MediaRecorder.start()
    → 状态: requesting → recording
    → 启动 30s 自动停止定时器

用户点击停止 / 30s 超时
  → AudioRecorder.stop()
  → MediaRecorder.onstop 触发
  → processRecording()
    → 状态: recording → processing
    → 合并 chunks → Blob
    → blobToWavBase64(blob)
      → AudioContext.decodeAudioData() 解码
      → mixToMono() 混合为单声道
      → OfflineAudioContext 重采样到 16kHz
      → encodeWav() 写入 PCM16 WAV header + 采样数据
      → arrayBufferToBase64() 转 Base64（8KB 分块拼接）
    → onComplete(wavBase64) 回调

  → app.ts: onComplete 异步处理
    → voiceRecordingState = "processing"
    → controllers/voice.ts: transcribeAudio(client, wavBase64)
    → RPC "asr.transcribe" { audioBase64, format: "wav" }

  → 后端处理
    → 参数校验: audioBase64 非空 + ≤10MB 限制
    → format 消毒: 仅保留 [a-zA-Z0-9]
    → Base64 解码 → 写入 os.tmpdir() 临时文件
    → speechToText(tmpPath)
      → sherpa-onnx-node: readWave → createStream → decode → getResult
    → 返回 { text, latencyMs, model }
    → finally: 删除临时文件

  → 前端收到结果
    → 成功: chatMessage += text（追加到输入框）
    → 失败: setVoiceError("voice.error.transcriptionFailed")
    → voiceRecordingState = "idle"
```

### 3.3 吉祥物关闭持久化

```
用户 hover 吉祥物 → 右上角 × 按钮显现 (opacity 0→1)
用户点击 ×
  → app.ts: handleVoiceMascotDismiss()
  → localStorage.setItem("clawdbot:voice:mascot-dismissed", "true")
  → voiceMascotDismissed = true → 吉祥物从 DOM 移除
  → 刷新页面 → isMascotDismissed() 返回 true → 不再显示
```

---

## 4. UI 状态机

```
                    ┌──────────┐
            ┌──────▶│   idle   │◀──────────────────────┐
            │       └────┬─────┘                       │
            │            │ click mic                   │
            │            ▼                             │
            │      ┌────────────┐                      │
            │      │ requesting │  getUserMedia()       │
            │      └──┬─────┬──┘                       │
            │  denied │     │ granted                  │
            │    ▼    │     ▼                           │
            │ [error] │┌───────────┐                   │
            └─────────┘│ recording │  max 30s           │
                       └─────┬─────┘                   │
                             │ stop / timeout          │
                             ▼                         │
                       ┌────────────┐                  │
                       │ processing │                  │
                       │  WAV 编码  │                  │
                       │  转写 RPC  │                  │
                       └─────┬──────┘                  │
                             │ complete / error        │
                             └─────────────────────────┘

错误信息: 5 秒后自动清除 (setVoiceError 定时器)
```

---

## 5. 文件清单

### 5.1 新建文件（6 个）

| 文件 | 行数 | 层级 | 职责 |
|------|------|------|------|
| `src/gateway/server-methods/asr.ts` | ~74 | 后端 RPC | `asr.status` 状态查询 + `asr.transcribe` 音频转写，含 10MB 限制和 format 消毒 |
| `ui/src/ui/voice/wav-encoder.ts` | ~135 | 前端音频 | 浏览器音频 Blob → 16kHz mono PCM16 WAV Base64，Web Audio API 解码+重采样 |
| `ui/src/ui/voice/audio-recorder.ts` | ~178 | 前端音频 | MediaRecorder 封装，4 态状态机（idle/requesting/recording/processing），30s 上限 |
| `ui/src/ui/controllers/voice.ts` | ~101 | 前端控制 | ASR 可用性检测 + 转写 RPC 调用 + 吉祥物关闭 localStorage 持久化 |
| `ui/src/ui/views/voice-mascot.ts` | ~146 | 前端视图 | 吉祥物纯函数渲染，内联 SVG 机器人头（眨眼动画）+ 录音波形 |
| `ui/src/styles/chat/voice-mascot.css` | ~253 | 前端样式 | 完整 BEM 样式 + 5 组 keyframe 动画 + 响应式（600px 断点）|

### 5.2 修改文件（10 个）

| 文件 | 修改内容 |
|------|----------|
| `src/agents/tools/asr-tool.ts` | 导出 `detectInstalledModel()` 和 `AsrModelEntry` 类型（原为 module-private）|
| `src/gateway/server-methods.ts` | 导入并注册 `asrHandlers` 到 `coreGatewayHandlers` |
| `ui/src/ui/views/chat.ts` | `ChatProps` 新增 `voiceMascot?: VoiceMascotProps \| null`，`.chat-compose` 内渲染 |
| `ui/src/ui/app.ts` | 4 个 `@state()` 字段 + `setVoiceError` (5s 定时器) + 4 个 handler + `audioRecorder` dispose |
| `ui/src/ui/app-render.ts` | `renderChat()` 调用中新增 `voiceMascot` prop 条件构建 |
| `ui/src/ui/app-gateway.ts` | 延迟 300ms 调用 `checkVoiceCapabilities()` |
| `ui/src/ui/icons.ts` | 新增 `mic` / `micOff` Lucide 风格 SVG 图标 |
| `ui/src/styles/chat.css` | 新增 `@import "./chat/voice-mascot.css"` |
| `ui/src/ui/i18n/locales/en.ts` | 11 个 `voice.*` 英文翻译键 |
| `ui/src/ui/i18n/locales/zh-CN.ts` | 11 个 `voice.*` 中文翻译键 |

---

## 6. 动画设计

| 动画 | CSS 名称 | 时长 | 视觉效果 | 触发时机 |
|------|----------|------|----------|----------|
| 入场弹入 | `voice-mascot-enter` | 0.4s | `translateY(12px) scale(0.9) → 0 scale(1)` + spring easing | 吉祥物首次渲染 |
| 头像浮动 | `voice-mascot-float` | 3s 循环 | `translateY(0 → -3px → 0)` | 待机态持续 |
| 机器人眨眼 | `voice-mascot-blink` | 4s 循环 | `scaleY(1 → 0.1 → 1)`，42%-58% 区间眨合 | 待机态持续 |
| 气泡滑入 | `voice-mascot-bubble-enter` | 0.5s | `translateX(8px) → 0` + 延迟 0.2s | 入场时跟随 |
| 录音脉冲 | `voice-mascot-pulse` | 1.5s 循环 | 红色 `box-shadow` 从 0 扩展到 10px 后消失 | 录音中 |

所有动画仅使用 `transform` 和 `opacity`，不触发 layout/paint，由 GPU 合成。

---

## 7. 安全防护

| 威胁 | 防护措施 | 代码位置 |
|------|----------|----------|
| 路径穿越 | `format` 参数消毒：`rawFormat.replace(/[^a-zA-Z0-9]/g, "")` | `asr.ts:49-50` |
| 内存耗尽 | Base64 payload ≤ 10MB 限制 | `asr.ts:37-46` |
| 临时文件泄漏 | `finally` 块中 `fs.unlinkSync(tmpPath)` | `asr.ts:66-72` |
| 麦克风未释放 | `cleanup()` 遍历 `stream.getTracks()` 全部 `stop()` | `audio-recorder.ts:153-161` |
| 录音器实例泄漏 | 创建新实例前 `audioRecorder?.dispose()` | `app.ts:995` |
| 临时文件路径冲突 | `Date.now()` + `Math.random().toString(36)` 双因子 | `asr.ts:51-54` |

---

## 8. i18n 翻译键

| 键 | en | zh-CN |
|----|-----|-------|
| `voice.mascot.hint` | Speak to me! | 语音告诉我 |
| `voice.startRecording` | Start voice input | 开始语音输入 |
| `voice.stopRecording` | Stop recording | 停止录音 |
| `voice.processing` | Transcribing... | 识别中... |
| `voice.error.noMic` | Cannot access microphone | 无法访问麦克风 |
| `voice.error.notSupported` | Browser does not support audio recording | 浏览器不支持语音录制 |
| `voice.error.recordingFailed` | Recording failed, please try again | 录音失败，请重试 |
| `voice.error.encodingFailed` | Audio encoding failed | 音频编码失败 |
| `voice.error.transcriptionFailed` | Transcription failed, please try again | 语音识别失败，请重试 |

关闭按钮的 aria-label 复用 `common.close`（Close / 关闭）。

---

## 9. 提交记录

```
c83dbca98  fix(voice): address review findings - security, UX, and perf
ee2ac30f1  feat(voice): add voice mascot with ASR integration for chat UI
```

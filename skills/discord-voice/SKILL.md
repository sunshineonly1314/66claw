---
name: discord-voice
name_zh: Discord 语音
description: 在 Discord 语音频道中通过 Claude AI 实现的实时语音对话
description_zh: 在 Discord 语音频道中通过 Claude AI 实现的实时语音对话
metadata:
  clawdbot:
    config:
      requiredEnv:
        - DISCORD_TOKEN
        - OPENAI_API_KEY
      optionalEnv:
        - ELEVENLABS_API_KEY
        - DEEPGRAM_API_KEY
      systemDependencies:
        - ffmpeg
        - build-essential
      example: |
        {
          "plugins": {
            "entries": {
              "discord-voice": {
                "enabled": true,
                "config": {
                  "sttProvider": "whisper",
                  "ttsProvider": "openai",
                  "ttsVoice": "nova",
                  "vadSensitivity": "medium",
                  "streamingSTT": true,
                  "bargeIn": true,
                  "allowedUsers": []
                }
              }
            }
          }
        }
---
# Clawdbot 的 Discord Voice 插件

在 Discord 语音频道中实现实时语音对话。加入语音频道，开口说话，您的语音将被转录、交由 Claude 处理，并以语音形式反馈给您。

## 功能特性

- **加入/离开语音频道**：可通过 Slash 命令、CLI 或 agent 工具操作  
- **语音活动检测（VAD）**：自动检测用户何时开始/停止讲话  
- **语音转文字（STT）**：支持 Whisper API（OpenAI）或 Deepgram  
- **流式 STT**：基于 Deepgram WebSocket 的实时转录（降低约 1 秒延迟）  
- **Agent 集成**：转录后的语音文本将被路由至 Clawdbot 的 agent  
- **文字转语音（TTS）**：支持 OpenAI TTS 或 ElevenLabs  
- **音频播放**：应答内容将以语音形式在语音频道中播放  
- **打断（Barge-in）支持**：用户发言时机器人立即停止播报  
- **自动重连**：含心跳监测与断连后自动重连机制  

## 系统要求

- 具备语音权限（Connect、Speak、Use Voice Activity）的 Discord 机器人  
- STT 与 TTS 提供方的 API 密钥  
- 语音功能所需系统依赖：  
  - `ffmpeg`（音频处理）  
  - `@discordjs/opus` 与 `sodium-native` 的原生构建工具  

## 安装步骤

### 1. 安装系统依赖

```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg build-essential python3

# Fedora/RHEL
sudo dnf install ffmpeg gcc-c++ make python3

# macOS
brew install ffmpeg
```

### 2. 通过 ClawdHub 安装

```bash
clawdhub install discord-voice
```

或手动安装：

```bash
cd ~/.clawdbot/extensions
git clone <repository-url> discord-voice
cd discord-voice
npm install
```

### 3. 在 clawdbot.json 中配置

```json5
{
  "plugins": {
    "entries": {
      "discord-voice": {
        "enabled": true,
        "config": {
          "sttProvider": "whisper",
          "ttsProvider": "openai",
          "ttsVoice": "nova",
          "vadSensitivity": "medium",
          "allowedUsers": [],  // Empty = allow all users
          "silenceThresholdMs": 1500,
          "maxRecordingMs": 30000,
          "openai": {
            "apiKey": "sk-..."  // Or use OPENAI_API_KEY env var
          }
        }
      }
    }
  }
}
```

### 4. Discord 机器人设置

确保您的 Discord 机器人具备以下权限：  
- **Connect** —— 加入语音频道  
- **Speak** —— 播放音频  
- **Use Voice Activity** —— 检测用户语音活动  

请将上述权限添加至机器人的 OAuth2 URL，或在 Discord 开发者门户中配置。

## 配置项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | boolean | `true` | 启用/禁用插件 |
| `sttProvider` | string | `"whisper"` | `"whisper"` 或 `"deepgram"` |
| `streamingSTT` | boolean | `true` | 启用流式 STT（仅 Deepgram，延迟降低约 1 秒） |
| `ttsProvider` | string | `"openai"` | `"openai"` 或 `"elevenlabs"` |
| `ttsVoice` | string | `"nova"` | TTS 使用的语音 ID |
| `vadSensitivity` | string | `"medium"` | `"low"`、`"medium"` 或 `"high"` |
| `bargeIn` | boolean | `true` | 用户发言时是否立即停止播报 |
| `allowedUsers` | string[] | `[]` | 允许访问的用户 ID 列表（空数组表示全部允许） |
| `silenceThresholdMs` | number | `1500` | 处理前静音等待时长（毫秒） |
| `maxRecordingMs` | number | `30000` | 最大录音时长（毫秒） |
| `heartbeatIntervalMs` | number | `30000` | 连接健康检查间隔（毫秒） |
| `autoJoinChannel` | string | `undefined` | 启动时自动加入的频道 ID |

### 提供方配置

#### OpenAI（Whisper + TTS）
```json5
{
  "openai": {
    "apiKey": "sk-...",
    "whisperModel": "whisper-1",
    "ttsModel": "tts-1"
  }
}
```

#### ElevenLabs（仅 TTS）
```json5
{
  "elevenlabs": {
    "apiKey": "...",
    "voiceId": "21m00Tcm4TlvDq8ikWAM",  // Rachel
    "modelId": "eleven_multilingual_v2"
  }
}
```

#### Deepgram（仅 STT）
```json5
{
  "deepgram": {
    "apiKey": "...",
    "model": "nova-2"
  }
}
```

## 使用方式

### Slash 命令（Discord）

注册完成后，在 Discord 中使用以下命令：  
- `/voice join <channel>` —— 加入语音频道  
- `/voice leave` —— 离开当前语音频道  
- `/voice status` —— 显示语音连接状态  

### CLI 命令

```bash
# Join a voice channel
clawdbot voice join <channelId>

# Leave voice
clawdbot voice leave --guild <guildId>

# Check status
clawdbot voice status
```

### Agent 工具

agent 可调用 `discord_voice` 工具：  
```
Join voice channel 1234567890
```

该工具支持以下操作：  
- `join` —— 加入语音频道（需提供 channelId）  
- `leave` —— 离开语音频道  
- `speak` —— 在语音频道中播报指定文本  
- `status` —— 获取当前语音状态  

## 工作原理

1. **加入**：机器人加入指定语音频道  
2. **监听**：VAD 检测用户何时开始/停止讲话  
3. **录音**：用户讲话期间持续缓冲音频  
4. **转录**：检测到静音后，将音频发送至 STT 提供方  
5. **处理**：将转录文本发送至 Clawdbot agent  
6. **合成**：将 Agent 的应答通过 TTS 转换为音频  
7. **播放**：在语音频道中播放合成后的音频  

## 流式 STT（Deepgram）

当选用 Deepgram 作为 STT 提供方时，流式模式默认启用。其优势包括：

- **端到端延迟降低约 1 秒**  
- **实时反馈**：提供中间转录结果（interim results）  
- **自动保活（keep-alive）**：防止连接超时  
- **故障回退**：流式失败时自动降级为批量转录  

启用流式 STT 方法如下：  
```json5
{
  "sttProvider": "deepgram",
  "streamingSTT": true,  // default
  "deepgram": {
    "apiKey": "...",
    "model": "nova-2"
  }
}
```

## 打断（Barge-in）支持

默认启用该功能：用户一开口，机器人即刻停止播报，从而营造更自然的对话体验（支持随时打断）。  

如需禁用（让机器人完整播报完毕）：  
```json5
{
  "bargeIn": false
}
```

## 自动重连

插件内置连接健康监测机制：

- **心跳检测**：每 30 秒一次（可配置）  
- **自动重连**：断连后按指数退避策略重试  
- **最多尝试 3 次**，失败后放弃  

若连接中断，您将在日志中看到类似以下内容：  
```
[discord-voice] Disconnected from voice channel
[discord-voice] Reconnection attempt 1/3
[discord-voice] Reconnected successfully
```

## VAD 灵敏度

- **low**：可捕捉轻声讲话，但可能受背景噪音误触发  
- **medium**：平衡模式（推荐）  
- **high**：需更响亮、更清晰的语音才能触发  

## 故障排查

### “Discord client not available”
请确保 Discord 频道已正确配置，且机器人已成功连接，再启用语音功能。

### Opus/Sodium 构建错误
请安装构建工具：  
```bash
npm install -g node-gyp
npm rebuild @discordjs/opus sodium-native
```

### 无音频输出
1. 检查机器人是否拥有 Connect + Speak 权限  
2. 检查机器人是否被服务器静音  
3. 验证 TTS API 密钥是否有效  

### 转录失败
1. 检查 STT API 密钥是否有效  
2. 检查音频是否正常录制（参阅调试日志）  
3. 尝试调整 VAD 灵敏度  

### 启用调试日志
```bash
DEBUG=discord-voice clawdbot gateway start
```

## 环境变量

| 变量 | 描述 |
|------|------|
| `DISCORD_TOKEN` | Discord 机器人 token（必需） |
| `OPENAI_API_KEY` | OpenAI API 密钥（Whisper + TTS） |
| `ELEVENLABS_API_KEY` | ElevenLabs API 密钥 |
| `DEEPGRAM_API_KEY` | Deepgram API 密钥 |

## 局限性

- 每个服务器（guild）仅支持同时接入一个语音频道  
- 最大录音时长：30 秒（可配置）  
- 实时语音需稳定网络支持  
- TTS 输出可能存在轻微合成延迟  

## 许可证

MIT
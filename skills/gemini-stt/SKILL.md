---
name: gemini-stt
name_zh: Gemini语音转文字
description: 使用 Google 的 Gemini API 或 Vertex AI 转录音频文件
description_zh: 使用 Google 的 Gemini API 或 Vertex AI 转录音频文件
metadata: {"clawdbot":{"emoji":"🎤","os":["linux","darwin"]}}
---
# Gemini 语音转文字（Speech-to-Text）skill

使用 Google 的 Gemini API 或 Vertex AI 转录音频文件。默认模型为 `gemini-2.0-flash-lite`，可实现最快转录速度。

## 认证方式（任选其一）

### 方式 1：使用应用默认凭据（Application Default Credentials, ADC）的 Vertex AI（推荐）

```bash
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

脚本将在可用时自动检测并使用 ADC。

### 方式 2：直接使用 Gemini API 密钥

在环境中设置 `GEMINI_API_KEY`（例如：`~/.env` 或 `~/.clawdbot/.env`）

## 要求

- Python 3.10+（无需外部依赖）
- 已配置 GEMINI_API_KEY 或已安装 gcloud CLI 并完成 ADC 配置

## 支持的格式

- `.ogg` / `.opus`（Telegram 语音消息）
- `.mp3`
- `.wav`
- `.m4a`

## 使用方法

```bash
# Auto-detect auth (tries ADC first, then GEMINI_API_KEY)
python ~/.claude/skills/gemini-stt/transcribe.py /path/to/audio.ogg

# Force Vertex AI
python ~/.claude/skills/gemini-stt/transcribe.py /path/to/audio.ogg --vertex

# With a specific model
python ~/.claude/skills/gemini-stt/transcribe.py /path/to/audio.ogg --model gemini-2.5-pro

# Vertex AI with specific project and region
python ~/.claude/skills/gemini-stt/transcribe.py /path/to/audio.ogg --vertex --project my-project --region us-central1

# With Clawdbot media
python ~/.claude/skills/gemini-stt/transcribe.py ~/.clawdbot/media/inbound/voice-message.ogg
```

## 选项

| 选项 | 描述 |
|------|------|
| `<audio_file>` | 音频文件路径（必需） |
| `--model`、`-m` | 指定使用的 Gemini 模型（默认：`gemini-2.0-flash-lite`） |
| `--vertex`、`-v` | 强制通过 ADC 使用 Vertex AI |
| `--project`、`-p` | GCP 项目 ID（用于 Vertex，若未指定则默认采用 gcloud 配置） |
| `--region`、`-r` | GCP 区域（用于 Vertex，默认：`us-central1`） |

## 支持的模型

任何支持音频输入的 Gemini 模型均可使用。推荐模型如下：

| 模型 | 说明 |
|------|------|
| `gemini-2.0-flash-lite` | **默认模型。** 转录速度最快。 |
| `gemini-2.0-flash` | 快速且成本效益高。 |
| `gemini-2.5-flash-lite` | 轻量级 2.5 版本模型。 |
| `gemini-2.5-flash` | 在速度与质量之间取得良好平衡。 |
| `gemini-2.5-pro` | 更高质量，但速度较慢。 |
| `gemini-3-flash-preview` | 最新 Flash 模型。 |
| `gemini-3-pro-preview` | 最新 Pro 模型，质量最佳。 |

最新模型列表请参阅 [Gemini API Models](https://ai.google.dev/gemini-api/docs/models)。

## 工作原理

1. 读取音频文件并进行 Base64 编码
2. 自动检测认证方式：
   - 若 ADC 可用（gcloud），则使用 Vertex AI 端点
   - 否则，使用 GEMINI_API_KEY 调用直接 Gemini API
3. 向选定的 Gemini 模型发送含转录提示的请求
4. 返回转录所得文本

## 示例集成

用于 Clawdbot 处理语音消息：

```bash
# Transcribe incoming voice message
TRANSCRIPT=$(python ~/.claude/skills/gemini-stt/transcribe.py "$AUDIO_PATH")
echo "User said: $TRANSCRIPT"
```

## 错误处理

脚本在以下情况退出并返回错误码 1，同时向 stderr 输出错误信息：
- 无可用认证方式（既无 ADC，也无 GEMINI_API_KEY）
- 文件未找到
- API 错误
- 使用 Vertex AI 时缺少 GCP 项目 ID

## 注意事项

- 默认使用 Gemini 2.0 Flash Lite 实现最快转录
- 无外部 Python 依赖（仅使用标准库）
- 自动根据文件扩展名推断 MIME 类型
- 在可用时优先使用带 ADC 的 Vertex AI（无需管理 API 密钥）
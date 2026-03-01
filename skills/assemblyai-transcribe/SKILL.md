---
name: assemblyai-transcribe
name_zh: AssemblyAI 转录
description: 使用 AssemblyAI 对音频/视频进行转录（支持本地上传或 URL），并导出字幕及段落/句子格式。
description_zh: 使用 AssemblyAI 对音频/视频进行转录（支持本地上传或 URL），并导出字幕及段落/句子格式。
homepage: https://www.assemblyai.com/docs
user-invocable: true
metadata: {"clawdbot":{"skillKey":"assemblyai","emoji":"🎙️","requires":{"bins":["node"],"env":["ASSEMBLYAI_API_KEY"]},"primaryEnv":"ASSEMBLYAI_API_KEY"}}
---
# AssemblyAI 转录 + 导出功能

当你需要使用 AssemblyAI 对音频/视频进行转录，或导出可读格式（如字幕、段落、句子）时，请使用本 skill。

本 skill 中的辅助脚本实现了基本的 REST 流程：

1. （针对本地文件）通过 `POST /v2/upload` 上传；  
2. 通过 `POST /v2/transcript` 创建转录任务；  
3. 轮询 `GET /v2/transcript/:id`，直至转录状态 `status` 变为 `completed`（或 `error`）。

## 配置要求

本 skill 需满足以下条件：

- PATH 中需有 `node`（推荐 Node.js 18+；脚本使用内置 fetch）；  
- 环境中需设置 `ASSEMBLYAI_API_KEY`。

推荐的 Clawdbot 配置（`~/.clawdbot/clawdbot.json`）：

```js
{
  skills: {
    entries: {
      // This skill declares metadata.clawdbot.skillKey = "assemblyai"
      assemblyai: {
        enabled: true,
        // Because this skill declares primaryEnv = ASSEMBLYAI_API_KEY,
        // you can use apiKey as a convenience:
        apiKey: "YOUR_ASSEMBLYAI_KEY",
        env: {
          ASSEMBLYAI_API_KEY: "YOUR_ASSEMBLYAI_KEY",

          // Optional: use EU async endpoint
          // ASSEMBLYAI_BASE_URL: "https://api.eu.assemblyai.com"
        }
      }
    }
  }
}
```

## 使用方法

请通过 Exec 工具运行以下命令。

### 转录（本地文件或公开 URL）

将转录文本输出至 stdout：

```bash
node {baseDir}/assemblyai.mjs transcribe "./path/to/audio.mp3"
node {baseDir}/assemblyai.mjs transcribe "https://example.com/audio.mp3"
```

将转录结果写入文件（长音频推荐）：

```bash
node {baseDir}/assemblyai.mjs transcribe "./path/to/audio.mp3" --out ./transcript.txt
```

### 传递高级转录选项

`POST /v2/transcript` 支持的任意字段均可通过 `--config` 传入：

```bash
node {baseDir}/assemblyai.mjs transcribe "./path/to/audio.mp3" \
  --config '{"speaker_labels":true,"summarization":true,"summary_model":"informative","summary_type":"bullets"}' \
  --export json \
  --out ./transcript.json
```

### 导出字幕（SRT/VTT 格式）

转录并立即导出字幕：

```bash
node {baseDir}/assemblyai.mjs transcribe "./path/to/video.mp4" --export srt --out ./subtitles.srt
node {baseDir}/assemblyai.mjs transcribe "./path/to/video.mp4" --export vtt --out ./subtitles.vtt
```

或从已有转录 ID 导出字幕：

```bash
node {baseDir}/assemblyai.mjs subtitles <transcript_id> srt --out ./subtitles.srt
```

### 导出段落 / 句子

```bash
node {baseDir}/assemblyai.mjs paragraphs <transcript_id> --out ./paragraphs.txt
node {baseDir}/assemblyai.mjs sentences <transcript_id> --out ./sentences.txt
```

### 获取已有转录结果

```bash
node {baseDir}/assemblyai.mjs get <transcript_id> --format json
node {baseDir}/assemblyai.mjs get <transcript_id> --wait --format text
```

## 使用建议

- 当输出可能较大时，优先使用 `--out <file>`。  
- 切勿将 API 密钥暴露于日志或聊天记录中；应依赖环境变量注入。  
- 若用户要求欧盟处理/数据驻留（EU processing/data residency），请将 `ASSEMBLYAI_BASE_URL` 设为欧盟主机地址。  
- AssemblyAI 要求：上传操作与后续的转录请求必须使用同一 AssemblyAI 项目的 API 密钥（否则将返回 403 错误：“Cannot access uploaded file”）。
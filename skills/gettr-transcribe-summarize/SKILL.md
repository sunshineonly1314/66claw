---
name: gettr-transcribe-summarize
name_zh: GETTR转录摘要
description: 从 GETTR 帖子（通过 HTML 中的 `og:video` 元标签）下载音频，使用 Apple Silicon 上本地运行的 MLX Whisper 进行转录（输出带时间戳的 VTT 格式），并将转录文本摘要为要点列表和/或带时间戳的提纲。当用户提供 GETTR 帖子 URL 并要求生成转录稿或摘要时使用。
description_zh: 从 GETTR 帖子（通过 HTML 中的 `og:video` 元标签）下载音频，使用 Apple Silicon 上本地运行的 MLX Whisper 进行转录（输出带时间戳的 VTT 格式），并将转录文本摘要为要点列表和/或带时间戳的提纲。当用户提供 GETTR 帖子 URL 并要求生成转录稿或摘要时使用。
homepage: https://gettr.com
metadata: {"clawdbot":{"emoji":"📺","requires":{"bins":["mlx_whisper","ffmpeg"]},"install":[{"id":"mlx-whisper","kind":"uv","package":"mlx-whisper","bins":["mlx_whisper"],"label":"Install mlx-whisper (pip)"},{"id":"ffmpeg","kind":"brew","formula":"ffmpeg","bins":["ffmpeg"],"label":"Install ffmpeg (brew)"}]}}
---
# Gettr Transcribe + Summarize (MLX Whisper)

## 快速启动（单命令）

使用一条命令运行完整流程（步骤 1–3）：
```bash
bash scripts/run_pipeline.sh "<GETTR_POST_URL>"
```

如需显式指定转录语言（推荐用于非英语内容）：
```bash
bash scripts/run_pipeline.sh --language zh "<GETTR_POST_URL>"
```

常用语言代码：`zh`（中文）、`en`（英语）、`ja`（日语）、`ko`（韩语）、`es`（西班牙语）、`fr`（法语）、`de`（德语）、`ru`（俄语）。

该命令输出：
- `./out/gettr-transcribe-summarize/<slug>/audio.wav`
- `./out/gettr-transcribe-summarize/<slug>/audio.vtt`

随后进入第 4 步（摘要），以生成最终交付成果。

---

## 工作流（GETTR URL → 转录稿 → 摘要）

### 需确认的输入项
请向用户确认以下信息：
- GETTR 帖子 URL  
- 输出格式：**仅要点** 或 **要点 + 带时间戳的提纲**  
- 摘要长度：**简短**、**中等**（默认）、或 **详细**  
- 语言（可选）：若视频为非英语且自动识别失败，请用户提供语言代码（例如 `zh` 表示中文）

注意事项：
- 本 skill **不支持**需身份验证才能访问的 GETTR 帖子。  
- 本 skill **不执行翻译**；所有输出均保持视频原始语言。  
- 若转录质量较差或混杂英语，请使用显式的 `--language` 参数重新运行。

### 前置依赖（本地）
- `mlx_whisper` 已安装并位于系统 PATH 中  
- `ffmpeg` 已安装（推荐版本：`brew install ffmpeg`）

### 步骤 0 — 选择输出目录
推荐命名规范：`./out/gettr-transcribe-summarize/<slug>/`

从 GETTR 帖子 URL 中提取 slug（例如：`https://gettr.com/post/p1abc2def` → slug = `p1abc2def`）。

目录结构如下：
- `./out/gettr-transcribe-summarize/<slug>/audio.wav`
- `./out/gettr-transcribe-summarize/<slug>/audio.vtt`
- `./out/gettr-transcribe-summarize/<slug>/summary.md`

### 步骤 1 — 提取媒体 URL 和 slug
首选方式：获取帖子 HTML 并读取 `og:video*` 元标签。

```bash
python3 scripts/extract_gettr_og_video.py "<GETTR_POST_URL>"
```  
该命令将打印出最优候选视频 URL（通常为 HLS `.m3u8`）及帖子 slug。

从 URL 路径中提取 slug（例如：`/post/p1abc2def` → `p1abc2def`），用于创建输出目录。

**重要：流媒体 URL 需通过浏览器提取**

对于流媒体 URL（`gettr.com/streaming/<slug>`），Python 脚本可能返回过期/无效的 `og:video` URL，导致 HTTP 412 错误。这是因为 GETTR 通过 JavaScript 动态生成带签名的流媒体 URL。

若 URL 为流媒体链接，或下载时出现 HTTP 412 错误：
1. 在浏览器中打开该流媒体 URL，并等待页面完全加载（JavaScript 必须执行完毕）  
2. 从渲染后的 DOM 中提取 `og:video` 元标签的内容：  
   ```javascript
   document.querySelector('meta[property="og:video"]').getAttribute('content')
   ```  
3. 使用该最新 URL 执行下载步骤  

经浏览器提取的 URL 具有有效签名，可被 ffmpeg 正常使用。

若上述提取失败，请用户直接提供 `.m3u8`/MP4 URL（常见于私有/受保护帖子，或 HTML 动态性较强的情形）。

### 步骤 2 — 使用 ffmpeg 下载音频
仅提取音频（16kHz 单声道 WAV），以实现更快、更稳定的转录：
```bash
bash scripts/download_audio.sh "<M3U8_OR_MP4_URL>" "./out/gettr-transcribe-summarize/<slug>/audio.wav"
```

该命令直接提取音频，无需中间视频文件，从而减少磁盘 I/O 和处理时间。

### 步骤 3 — 使用 MLX Whisper 进行转录
生成带时间戳的 VTT 输出：
```bash
mlx_whisper "./out/gettr-transcribe-summarize/<slug>/audio.wav" \
  -f vtt \
  -o "./out/gettr-transcribe-summarize/<slug>" \
  --model mlx-community/whisper-large-v3-turbo \
  --condition-on-previous-text False \
  --word-timestamps True
```

如需显式指定语言（推荐在自动识别失败时使用）：
```bash
mlx_whisper "./out/gettr-transcribe-summarize/<slug>/audio.wav" \
  -f vtt \
  -o "./out/gettr-transcribe-summarize/<slug>" \
  --model mlx-community/whisper-large-v3-turbo \
  --condition-on-previous-text False \
  --word-timestamps True \
  --language zh
```

参数说明：
- `-f vtt`：VTT 格式提供时间戳，便于构建提纲。  
- `--condition-on-previous-text False`：防止幻觉错误在各片段间传播。  
- `--word-timestamps True`：提升分段边界的计时精度。  
- `--language <code>`：显式指定语言代码（例如 `zh`、`en`、`ja`、`ko`）。当自动识别失败时使用。

注意事项：
- 默认启用语言自动识别。对于自动识别失败的非英语内容，请使用 `--language`。  
- 常用语言代码：`zh`（中文）、`en`（英语）、`ja`（日语）、`ko`（韩语）、`es`（西班牙语）、`fr`（法语）、`de`（德语）、`ru`（俄语）。  
- 若运行过慢或内存占用过高，可尝试更小模型：`mlx-community/whisper-medium` 或 `mlx-community/whisper-small`。  
- 若质量不佳，可尝试完整模型：`mlx-community/whisper-large-v3`（速度较慢但更准确）。  
- 若 `--word-timestamps` 引发问题，可省略该参数（流水线脚本会自动处理）。

### 步骤 4 — 摘要
将最终交付成果写入 `./out/gettr-transcribe-summarize/<slug>/summary.md`。

请选择 **摘要长度**（由用户指定）：
- **简短**：5–8 个要点；（若含提纲）4–6 个章节  
- **中等（默认）**：8–20 个要点；（若含提纲）6–15 个章节  
- **详细**：20–40 个要点；（若含提纲）15–30 个章节  

输出应包含：
- **要点**（按上述长度要求）  
- 可选的 **带时间戳的提纲**（按上述长度要求）

带时间戳提纲格式（默认标题样式）：
```
[00:00 - 02:15] Section heading
- 1–3 sub-bullets
```

基于 VTT 字幕块构建提纲时：
- 将相邻字幕块归并为逻辑连贯的章节。  
- 章节起始时间取首块字幕起始时间，结束时间取末块字幕结束时间。

## 内置脚本
- `scripts/run_pipeline.sh`：完整流水线封装脚本（一步执行步骤 1–3）  
- `scripts/extract_gettr_og_video.py`：获取 GETTR HTML 并提取 `og:video*` URL 与帖子 slug（含重试/退避机制）  
- `scripts/download_audio.sh`：从 HLS 或 MP4 URL 下载/提取音频至 16kHz 单声道 WAV  

### 错误处理
- **非视频类帖子**：提取脚本可识别图片/纯文本类帖子，并返回友好错误提示。  
- **网络错误**：自动重试，采用指数退避策略（最多 3 次）。  
- **无音频轨道**：下载脚本会校验输出，并在源内容不含音频时发出提示。  
- **HTTP 412 错误**：所提取的 `og:video` URL 签名已过期/无效。请使用浏览器提取方式获取新 URL（参见步骤 1 及 `references/troubleshooting.md`）。

## 故障排查
详见 `references/troubleshooting.md`，其中包含针对以下常见问题的详细解决方案：
- HTTP 412 错误（签名 URL 过期）  
- 提取失败  
- 下载错误  
- 转录质量不佳
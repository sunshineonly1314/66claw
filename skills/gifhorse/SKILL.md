---
name: gifhorse
name_zh: GIF转换
description: 搜索视频对白并生成带时间戳字幕的反应 GIF。适用于从电影和电视剧中创建具有迷因潜力的片段。
description_zh: 搜索视频对白并生成带时间戳字幕的反应 GIF。适用于从电影和电视剧中创建具有迷因潜力的片段。
homepage: https://github.com/Coyote-git/gifhorse
metadata: {"clawdbot":{"emoji":"🐴","requires":{"bins":["gifhorse","ffmpeg"]},"install":[{"id":"gifhorse-setup","kind":"download","command":"git clone https://github.com/Coyote-git/gifhorse.git ~/gifhorse && cd ~/gifhorse && python3 -m venv venv && source venv/bin/activate && pip install -e .","bins":["gifhorse"],"label":"安装 gifhorse CLI 工具"},{"id":"ffmpeg-full","kind":"download","command":"brew install ffmpeg-full","bins":["ffmpeg"],"label":"安装 FFmpeg-full（macOS）"}],"config":{"examples":[{"GIFHORSE_DB":"~/gifhorse/transcriptions.db"}]}}}
---
# GifHorse — 对白搜索与 GIF 生成器

通过搜索对白并添加时间戳字幕，从您的视频库中创建反应 GIF。

## GifHorse 的功能

1. **转录视频** — 使用字幕文件（.srt）或 Whisper AI 提取带时间戳的对白  
2. **搜索对白** — 瞬间在全部视频库中查找指定台词  
3. **预览片段** — 在生成 GIF 前精确查看将截取的内容  
4. **生成 GIF** — 生成带精准时间戳字幕的 GIF，并可选添加水印  

## 设置

### 首次设置

1. 安装 gifhorse（点击上方安装按钮）  
2. 安装 FFmpeg-full（点击上方安装按钮），用于字幕渲染  
3. 转录您的视频库：

```bash
cd ~/gifhorse && source venv/bin/activate
gifhorse transcribe ~/Movies --use-subtitles
```

gifhorse 命令必须在其虚拟环境中运行。您可通过以下命令激活该环境：

```bash
cd ~/gifhorse && source venv/bin/activate
```

或使用激活辅助脚本：

```bash
source ~/gifhorse/activate.sh
```

## 可用命令

### 转录视频

从视频中提取对白（每部视频仅需执行一次）：

```bash
# Fast: Using existing subtitle files (.srt)
gifhorse transcribe /path/to/videos --use-subtitles

# Slow but thorough: Using Whisper AI (if no subtitles available)
gifhorse transcribe /path/to/video.mp4
```

**专业提示：** 若可用，请使用 `--use-subtitles` —— 其速度比 Whisper 快 100 倍！

### 搜索对白

在全部视频库中查找台词：

```bash
# Basic search
gifhorse search "memorable quote"

# Search with surrounding context
gifhorse search "memorable quote" --context 2
```

### 创建前预览

精确查看将截取的内容：

```bash
gifhorse preview "memorable quote" 1
gifhorse preview "quote" 1 --include-before 1 --include-after 1
```

### 生成 GIF

生成带字幕的 GIF：

```bash
# Basic GIF
gifhorse create "memorable quote" 1 --output reaction.gif

# With watermark
gifhorse create "quote" 1 --watermark "@username"

# High quality for social media
gifhorse create "quote" 1 --width 720 --fps 24 --quality high --watermark "@handle"

# Include conversation context
gifhorse create "quote" 1 --include-before 2 --include-after 1
```

### 检查状态

```bash
# See transcription stats
gifhorse stats

# List all transcribed videos
gifhorse list
```

## 时间控制选项

精确控制截取范围：

- `--include-before N` —— 包含匹配项前 N 段对白  
- `--include-after N` —— 包含匹配项后 N 段对白  
- `--padding-before SECS` —— 在对白开始前添加缓冲秒数（默认值：1.0）  
- `--padding-after SECS` —— 在对白结束后添加缓冲秒数（默认值：1.0）  
- `--start-offset SECS` —— 手动调整起始时间（可为负值）  
- `--end-offset SECS` —— 手动调整结束时间（可为负值）  

**重要提示：** 如需在对白之后添加反应内容，请使用 `--padding-after` 而非 `--include-after`。“包含之后”选项会捕获直至下一段对白开始的所有时间（可能长达 30 秒以上！）

## 画质选项

- `--quality low|medium|high` —— 调色板质量（影响文件大小）  
- `--fps N` —— 帧率（默认值：15；如需更流畅效果请设为 24）  
- `--width N` —— 宽度（像素）（默认值：480；高清请设为 720）  
- `--no-subtitles` —— 不叠加字幕生成 GIF  

## 水印选项

为 GIF 添加品牌标识：

- `--watermark TEXT` —— 水印文字（例如 "@gifhorse"）  
- `--watermark-position tl|tr|bl|br` —— 位置：top-left（左上）、top-right（右上）、bottom-left（左下）、bottom-right（右下）（默认值：br）  
- `--watermark-opacity N` —— 透明度（0.0 至 1.0，默认值：0.7）  

## 常见工作流

### 快速反应 GIF

```bash
gifhorse search "perfect"
gifhorse create "perfect" 1 --padding-after 2.0 --output perfect.gif
```

### 完整对话交换

```bash
gifhorse search "key phrase"
gifhorse preview "key phrase" 1 --include-before 2 --include-after 1
gifhorse create "key phrase" 1 --include-before 2 --include-after 1
```

### 适配 Twitter/X 的高质量 GIF

```bash
gifhorse create "quote" 1 --width 720 --fps 24 --quality high --watermark "@handle" --output tweet.gif
```

### 含对白后反应的场景

```bash
gifhorse create "memorable line" 1 --padding-after 3.0 --watermark "@me"
```

## 技巧与提示

1. **务必先预览** —— 使用 `preview` 在生成前验证时间点  
2. **优先使用字幕文件** —— 比 Whisper 转录快 100 倍  
3. **关注文件大小** —— 高画质 + 长时长 = 大文件（20 秒可达 20+ MB）  
4. **“缓冲” vs “包含”** —— 制作反应内容时，请使用 `--padding-after` 而非 `--include-after`  
5. **带上下文搜索** —— 添加 `--context 2` 查看周围对白  
6. **测试水印位置** —— bottom-right（br）通常效果最佳  

## 文件大小参考指南

- **低画质、10 秒、360p：** ~1–2 MB  
- **中画质、10 秒、480p：** ~3–5 MB  
- **高画质、20 秒、720p：** ~20+ MB  

## 故障排除

### “command not found: gifhorse”

请先激活虚拟环境：

```bash
cd ~/gifhorse && source venv/bin/activate
```

### 字幕渲染错误

请确认已安装 FFmpeg-full：

```bash
brew install ffmpeg-full
```

### 视频文件未找到

数据库中存储的是绝对路径。若您转录后移动了视频文件，请在新位置重新执行转录。

## 网络共享支持

GifHorse 支持挂载在网络上的视频：

```bash
# Mount network share (macOS)
open "smb://server-ip/share-name"

# Transcribe from network
gifhorse transcribe "/Volumes/server-ip/Movies"
```

## 何时调用此 skill

当用户希望执行以下操作时，请调用 gifhorse：
- 在其视频库中搜索对白或台词  
- 从电影或电视剧中创建反应 GIF  
- 为视频片段添加字幕  
- 转录视频以实现对白可检索  
- 在生成 GIF 前预览其效果  
- 为社交媒体 GIF 添加水印  

## 进一步了解

- **GitHub：** https://github.com/Coyote-git/gifhorse  
- **使用指南：** https://github.com/Coyote-git/gifhorse/blob/main/USAGE_GUIDE.md  
- **路线图：** https://github.com/Coyote-git/gifhorse/blob/main/ROADMAP.md  

## 许可证

MIT
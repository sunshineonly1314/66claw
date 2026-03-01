---
name: video-transcript-downloader
name_zh: 视频转录下载器
description: 从 YouTube 及其他所有 yt-dlp 支持的网站下载视频、音频、字幕，以及格式整洁的段落式文字稿。当用户提出“下载这个视频”、“保存该片段”、“提取音频”、“获取字幕”、“获取文字稿”，或需排查 yt-dlp/ffmpeg 相关问题（如格式、播放列表等）时，使用本 skill。
description_zh: 从 YouTube 及其他所有 yt-dlp 支持的网站下载视频、音频、字幕，以及格式整洁的段落式文字稿。当用户提出“下载这个视频”、“保存该片段”、“提取音频”、“获取字幕”、“获取文字稿”，或需排查 yt-dlp/ffmpeg 相关问题（如格式、播放列表等）时，使用本 skill。
---
# 视频文字稿下载器

`./scripts/vtd.js` 可以：
- 将文字稿以干净的段落形式输出（可选是否包含时间戳）；
- 下载视频 / 音频 / 字幕。

文字稿获取逻辑：
- YouTube：尽可能通过 `youtube-transcript-plus` 获取；
- 其他情况：通过 `yt-dlp` 提取字幕，再清洗为段落格式。

## 初始化设置

```bash
cd ~/Projects/agent-scripts/skills/video-transcript-downloader && npm ci
```

## 文字稿（默认：干净段落）

```bash
./scripts/vtd.js transcript --url 'https://…'
./scripts/vtd.js transcript --url 'https://…' --lang en
./scripts/vtd.js transcript --url 'https://…' --timestamps
./scripts/vtd.js transcript --url 'https://…' --keep-brackets
```

## 下载视频 / 音频 / 字幕

```bash
./scripts/vtd.js download --url 'https://…' --output-dir ~/Downloads
./scripts/vtd.js audio --url 'https://…' --output-dir ~/Downloads
./scripts/vtd.js subs --url 'https://…' --output-dir ~/Downloads --lang en
```

## 格式选项（列出 + 选择）

列出所有可用格式（含格式 ID、分辨率、容器格式、是否纯音频等）：

```bash
./scripts/vtd.js formats --url 'https://…'
```

下载指定格式 ID（示例）：

```bash
./scripts/vtd.js download --url 'https://…' --output-dir ~/Downloads -- --format 137+140
```

优先选用 MP4 容器且不重新编码（尽可能仅复用流，remux）：

```bash
./scripts/vtd.js download --url 'https://…' --output-dir ~/Downloads -- --remux-video mp4
```

## 注意事项

- 默认文字稿输出为单一段落；仅当明确要求时才使用 `--timestamps`。
- 默认会移除类似 `[Music]` 的括号标注内容；如需保留，请使用 `--keep-brackets`。
- 在 `--` 后追加额外的 `yt-dlp` 参数，可用于 `transcript` 回退、`download`、`audio`、`subs`、`formats` 等场景。

```bash
./scripts/vtd.js formats --url 'https://…' -- -v
```

## 故障排查（仅在必要时使用）

- 缺失 `yt-dlp` / `ffmpeg`：

```bash
brew install yt-dlp ffmpeg
```

- 验证配置：

```bash
yt-dlp --version
ffmpeg -version | head -n 1
```
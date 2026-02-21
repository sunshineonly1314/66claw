---
name: video-frames
description: Extract frames or short clips from videos using ffmpeg.
nameZh: "视频帧提取"
descriptionZh: "从视频中提取关键帧图片"
homepage: https://ffmpeg.org
metadata: {"openclawcn":{"emoji":"🎞️","requires":{"bins":["ffmpeg"]},"install":[{"id":"brew","kind":"brew","formula":"ffmpeg","bins":["ffmpeg"],"label":"安装 ffmpeg (brew)"},{"id":"download","kind":"download","url":"https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip","archive":"zip","extract":true,"bins":["ffmpeg"],"label":"下载 ffmpeg (Windows)","os":["win32"]}]}}
---

# Video Frames (ffmpeg)

Extract a single frame from a video, or create quick thumbnails for inspection.

## Quick start

First frame:

```bash
{baseDir}/scripts/frame.sh /path/to/video.mp4 --out /tmp/frame.jpg
```

At a timestamp:

```bash
{baseDir}/scripts/frame.sh /path/to/video.mp4 --time 00:00:10 --out /tmp/frame-10s.jpg
```

## Notes

- Prefer `--time` for “what is happening around here?”.
- Use a `.jpg` for quick share; use `.png` for crisp UI frames.

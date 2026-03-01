---
name: veo
name_zh: VEO
description: 使用 Google Veo（Veo 3.1 / Veo 3.0）生成视频。
description_zh: 使用 Google Veo（Veo 3.1 / Veo 3.0）生成视频。
---
# Veo（Google 视频生成）

使用 Google Veo API 生成视频片段。

生成视频  
```bash
uv run {baseDir}/scripts/generate_video.py --prompt "your video description" --filename "output.mp4"
```

选项  
- `--duration` / `-d`：视频时长（单位：秒；默认：8，最大值因模型而异）  
- `--aspect-ratio` / `-a`：宽高比（16:9、9:16、1:1）  
- `--model`：待使用的 Veo 模型（如 veo-2.0-generate-001、veo-3.0-generate-001、veo-3.1-generate-preview 等）  
- `--api-key`：覆盖 GEMINI_API_KEY  

API 密钥  
- 推荐使用 `GEMINI_API_KEY` 环境变量  
- 或在 `~/.clawdbot/clawdbot.json` 中设置 `skills."veo".env.GEMINI_API_KEY`  

注意事项  
- Veo 3.1 支持更高画质与更长时长  
- 输出格式为 MP4  
- 推荐使用 `--model veo-3.1-generate-preview` 以获得最佳效果  
- Veo 3.0-fast-generate-001 生成更快但画质较低  
- 脚本将打印 `MEDIA:` 行，供支持的聊天平台（如 Clawdbot）自动附加视频。  
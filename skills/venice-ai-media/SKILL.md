---
name: venice-ai-media
name_zh: Venice AI媒体
description: 生成、编辑与放大图像；基于图像或其他视频生成视频（Venice AI）。支持文生图、图生视频（Sora、WAN）、视频转视频（Runway Gen4）、图像放大及 AI 编辑。
description_zh: 生成、编辑与放大图像；基于图像或其他视频生成视频（Venice AI）。支持文生图、图生视频（Sora、WAN）、视频转视频（Runway Gen4）、图像放大及 AI 编辑。
homepage: https://venice.ai
metadata:
  {
    "clawdbot":
      {
        "emoji": "🎨",
        "requires": { "bins": ["python3"], "env": ["VENICE_API_KEY"] },
        "primaryEnv": "VENICE_API_KEY",
        "notes": "需 Python 3.10+",
        "install":
          [
            {
              "id": "python-brew",
              "kind": "brew",
              "formula": "python",
              "bins": ["python3"],
              "label": "安装 Python（brew）",
            },
          ],
      },
  }
---
# Venice AI 媒体

使用 Venice AI API 生成图像与视频。Venice 是一个无审查机制的 AI 平台，具备高性价比。

## 前置条件

- **Python 3.10+**（`brew install python` 或系统自带 Python）  
- **Venice API 密钥**（提供免费层级）  
- **requests 库**（若缺失，脚本将自动安装）

## 设置步骤

### 1. 获取您的 API 密钥

1. 在 [venice.ai](https://venice.ai) 注册账号  
2. 访问 [venice.ai/settings/api](https://venice.ai/settings/api)  
3. 点击“创建 API 密钥”  
4. 复制密钥（以 `vn_...` 开头）

### 2. 配置密钥

**选项 A：环境变量方式**

```bash
export VENICE_API_KEY="vn_your_key_here"
```

**选项 B：Clawdbot 配置方式**（推荐 — 跨会话持久生效）

在 `~/.clawdbot/clawdbot.json` 中添加：

```json5
{
  skills: {
    entries: {
      "venice-ai-media": {
        env: {
          VENICE_API_KEY: "vn_your_key_here",
        },
      },
    },
  },
}
```

### 3. 验证设置

```bash
python3 {baseDir}/scripts/venice-image.py --list-models
```

若显示模型列表，则表示配置成功！

## 定价概览

| 功能 | 费用 |
| ---------------- | --------------------------------- |
| 图像生成 | 每张约 $0.01–0.03 |
| 图像放大 | 每次约 $0.02–0.04 |
| 图像编辑 | $0.04 |
| 视频（WAN） | 依时长而定，约 $0.10–0.50 |
| 视频（Sora） | 依时长而定，约 $0.50–2.00 |
| 视频（Runway） | 约 $0.20–1.00 |

使用 `--quote` 配合视频命令，可在生成前预估费用。

## 快速上手

```bash
# Generate an image
python3 {baseDir}/scripts/venice-image.py --prompt "a serene canal in Venice at sunset"

# Upscale an image
python3 {baseDir}/scripts/venice-upscale.py photo.jpg --scale 2

# Edit an image with AI
python3 {baseDir}/scripts/venice-edit.py photo.jpg --prompt "add sunglasses"

# Create a video from an image
python3 {baseDir}/scripts/venice-video.py --image photo.jpg --prompt "gentle camera pan" --duration 5s
```

---

## 图像生成

```bash
python3 {baseDir}/scripts/venice-image.py --prompt "a serene canal in Venice at sunset"
python3 {baseDir}/scripts/venice-image.py --prompt "cyberpunk city" --count 4
python3 {baseDir}/scripts/venice-image.py --prompt "portrait" --width 768 --height 1024
python3 {baseDir}/scripts/venice-image.py --prompt "abstract art" --out-dir /tmp/venice
python3 {baseDir}/scripts/venice-image.py --list-models
python3 {baseDir}/scripts/venice-image.py --list-styles
python3 {baseDir}/scripts/venice-image.py --prompt "fantasy" --model flux-2-pro --no-validate
python3 {baseDir}/scripts/venice-image.py --prompt "photo" --style-preset "Cinematic" --embed-exif
```

**关键参数：** `--prompt`、`--model`（默认：flux-2-max）、`--count`（对相同提示词启用高效批量 API）、`--width`、`--height`、`--format`（webp/png/jpeg）、`--resolution`（1K/2K/4K）、`--aspect-ratio`、`--negative-prompt`、`--style-preset`（使用 `--list-styles` 查看可选项）、`--cfg-scale`（提示词遵循度 0–20，默认 7.5）、`--seed`（确保结果可复现）、`--safe-mode`（默认禁用，用于无审查输出）、`--hide-watermark`（仅在明确要求时使用 — 水印支持 Venice）、`--embed-exif`（将提示词嵌入图像元数据）、`--lora-strength`（0–100，适用于部分模型）、`--steps`（推理步数，取决于模型）、`--enable-web-search`、`--no-validate`（跳过模型校验，适用于新/测试模型）

## 图像放大

```bash
python3 {baseDir}/scripts/venice-upscale.py photo.jpg --scale 2
python3 {baseDir}/scripts/venice-upscale.py photo.jpg --scale 4 --enhance
python3 {baseDir}/scripts/venice-upscale.py photo.jpg --enhance --enhance-prompt "sharpen details"
python3 {baseDir}/scripts/venice-upscale.py --url "https://example.com/image.jpg" --scale 2
```

**关键参数：** `--scale`（1–4，默认：2）、`--enhance`（AI 增强）、`--enhance-prompt`、`--enhance-creativity`（0.0–1.0）、`--replication`（0.0–1.0，保留线条/噪点，默认：0.35）、`--url`（使用 URL 替代本地文件）、`--output`、`--out-dir`

## 图像编辑

```bash
python3 {baseDir}/scripts/venice-edit.py photo.jpg --prompt "add sunglasses"
python3 {baseDir}/scripts/venice-edit.py photo.jpg --prompt "change the sky to sunset"
python3 {baseDir}/scripts/venice-edit.py photo.jpg --prompt "remove the person in background"
python3 {baseDir}/scripts/venice-edit.py --url "https://example.com/image.jpg" --prompt "colorize"
```

**关键参数：** `--prompt`（必需 — AI 解析需修改内容）、`--url`（使用 URL 替代本地文件）、`--output`、`--out-dir`

**注意：** 编辑接口使用 Qwen-Image 模型，存在部分内容限制（其他 Venice 接口则无此限制）。

## 视频生成

```bash
# Get price quote first (no generation)
python3 {baseDir}/scripts/venice-video.py --quote --model wan-2.6-image-to-video --duration 10s --resolution 720p

# Image-to-video (WAN 2.6 - default)
python3 {baseDir}/scripts/venice-video.py --image photo.jpg --prompt "camera pans slowly" --duration 10s

# Image-to-video (Sora)
python3 {baseDir}/scripts/venice-video.py --image photo.jpg --prompt "cinematic" \
  --model sora-2-image-to-video --duration 8s --aspect-ratio 16:9 --skip-audio-param

# Video-to-video (Runway Gen4)
python3 {baseDir}/scripts/venice-video.py --video input.mp4 --prompt "anime style" \
  --model runway-gen4-turbo-v2v

# List models (shows available durations per model)
python3 {baseDir}/scripts/venice-video.py --list-models

# Clean up a video downloaded with --no-delete
python3 {baseDir}/scripts/venice-video.py --complete <queue_id> --model <model>
```

**关键参数：** `--image` 或 `--video`（生成必需）、`--prompt`（生成必需）、`--model`（默认：wan-2.6-image-to-video）、`--duration`（依模型而定，参见 --list-models）、`--resolution`（480p/720p/1080p）、`--aspect-ratio`、`--audio`/`--no-audio`、`--skip-audio-param`、`--quote`（价格预估）、`--timeout`、`--poll-interval`、`--no-delete`（保留服务器端媒体）、`--complete`（清理此前下载的视频）、`--no-validate`（跳过模型校验）

**进度提示：** 生成过程中，脚本将依据 Venice 平均执行时间显示预估进度。

## 模型说明

使用 `--list-models` 查看当前可用性与状态。模型更新频繁。

**图像：** 默认为 `flux-2-max`。常见选项包括 flux、gpt-image 及 nano-banana 系列变体。

**视频：**

- **WAN 模型：** 图生视频，支持自定义音频，时长可选（5 秒–21 秒）  
- **Sora 模型：** 需 `--aspect-ratio`，请使用 `--skip-audio-param`  
- **Runway 模型：** 视频转视频变换  

**使用提示：**

- 对尚未列入模型列表的新/测试模型，请使用 `--no-validate`  
- 生成视频前，请使用 `--quote` 预估费用  
- 安全模式默认关闭（Venice 本身即为无审查 API）

## 输出格式

脚本将打印 `MEDIA: /path/to/file` 行，供 Clawdbot 自动附加媒体。

**提示：** 生成媒体时使用 `--out-dir /tmp/venice-$(date +%s)`，可确保通过 iMessage 发送（保障跨用户账户的可访问性）。

## 故障排查

**“VENICE_API_KEY not set”（未设置 VENICE_API_KEY）**

- 检查 `~/.clawdbot/clawdbot.json` 中的配置  
- 或导出环境变量：`export VENICE_API_KEY="vn_..."`

**“Invalid API key”（API 密钥无效）**

- 在 [venice.ai/settings/api](https://venice.ai/settings/api) 页面核对密钥  
- 密钥以 `vn_` 开头  

**“Model not found”（未找到模型）**

- 运行 `--list-models` 查看可用模型列表  
- 对新/测试模型，请使用 `--no-validate`  

**视频卡顿/超时**

- 视频生成耗时通常为 1–5 分钟，取决于模型与指定时长  
- 对较长视频，请使用 `--timeout 600`  
- 请访问 [venice.ai](https://venice.ai) 查看 Venice 服务状态  

**“requests” module not found（未找到 requests 模块）**

- 安装该模块：`pip3 install requests`  
---
name: remotion-server
name_zh: Remotion 服务端
description: 使用 Remotion 进行无头视频渲染。可在任意 Linux 服务器上运行——无需 Mac 或图形界面（GUI）。
description_zh: 使用 Remotion 进行无头视频渲染。可在任意 Linux 服务器上运行——无需 Mac 或图形界面（GUI）。
homepage: https://remotion.dev
metadata: {"clawdbot":{"emoji":"🎬"}}
---
# Remotion Server

使用 Remotion 在任意 Linux 服务器上无头渲染视频。无需 Mac 或图形界面（GUI）。

## 安装（一次性操作）

安装浏览器依赖项：
```bash
bash {baseDir}/scripts/setup.sh
```

## 快速开始

### 创建项目：
```bash
bash {baseDir}/scripts/create.sh my-video
cd my-video
```

### 渲染视频：
```bash
npx remotion render MyComp out/video.mp4
```

## 模板

### 聊天演示（Telegram 风格）
生成带动画聊天消息的手机模拟界面。

```bash
bash {baseDir}/scripts/create.sh my-promo --template chat
```

编辑 `src/messages.json`：
```json
[
  {"text": "What's the weather?", "isUser": true},
  {"text": "☀️ 72°F and sunny!", "isUser": false}
]
```

### 标题卡
简洁的动态标题/开场卡片。

```bash
bash {baseDir}/scripts/create.sh my-intro --template title
```

## 聊天类用例示例

- “制作一段展示关于 [主题] 的聊天内容的视频”
- “为 [功能] 创建一段宣传视频”
- “渲染一张显示 [文本] 的标题卡”

## Linux 依赖项

安装脚本将安装以下组件：
- libnss3、libatk、libcups2、libgbm 等
- Chrome Headless Shell 所必需

适用于 Ubuntu/Debian 系统：
```bash
sudo apt install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libgbm1 libpango-1.0-0 libcairo2 libxcomposite1 libxdamage1 libxfixes3 libxrandr2
```

## 输出格式

- MP4（h264）——默认格式
- WebM（vp8/vp9）
- GIF
- PNG 序列

```bash
npx remotion render MyComp out/video.webm --codec=vp8
npx remotion render MyComp out/video.gif --codec=gif
```

## 隐私说明

⚠️ **所有模板仅使用 FAKE 演示数据！**
- 虚构的 GPS 坐标（旧金山：37.7749, -122.4194）
- 占位符名称与数值
- 绝不包含真实用户数据

发布前请务必审阅生成的内容。
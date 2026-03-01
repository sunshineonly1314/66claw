---
name: xkcd
name_zh: XKCD
description: 获取 xkcd 漫画——最新一期、随机一期、指定编号，或按关键词搜索。以标题、图像及 alt 文本（隐藏笑点）形式展示漫画。利用图像生成能力创作自定义 xkcd 风格火柴人漫画。适用于通过 cron 每日推送、按需请求，或创作原创 xkcd 风格内容。
description_zh: 获取 xkcd 漫画——最新一期、随机一期、指定编号，或按关键词搜索。以标题、图像及 alt 文本（隐藏笑点）形式展示漫画。利用图像生成能力创作自定义 xkcd 风格火柴人漫画。适用于通过 cron 每日推送、按需请求，或创作原创 xkcd 风格内容。
homepage: https://xkcd.com
metadata: {"clawdbot":{"emoji":"📊","requires":{"bins":["uv"]}}}
---
# xkcd

从 xkcd.com 获取漫画，或生成 xkcd 风格图像。

## 命令

### 最新漫画
```bash
uv run {baseDir}/scripts/xkcd.py
```

### 随机漫画
```bash
uv run {baseDir}/scripts/xkcd.py --random
```

### 指定编号漫画
```bash
uv run {baseDir}/scripts/xkcd.py 327         # Bobby Tables
uv run {baseDir}/scripts/xkcd.py 353         # Python
uv run {baseDir}/scripts/xkcd.py 1053        # Ten Thousand
```

### 按关键词搜索
```bash
uv run {baseDir}/scripts/xkcd.py --search "python"
uv run {baseDir}/scripts/xkcd.py --search "space" --limit 3
```

### JSON 输出
```bash
uv run {baseDir}/scripts/xkcd.py --format json
uv run {baseDir}/scripts/xkcd.py --random --format json
```

## 输出格式

默认 Markdown 输出包含：
- **标题**：含编号的漫画标题  
- **图像**：图片直链 URL  
- **Alt 文本**：鼠标悬停时显示的隐藏文本（往往最精彩！）  
- **链接**：xkcd.com 对应页面永久链接  

## 生成自定义 xkcd 风格漫画

使用图像生成 skill（例如 nano-banana-pro），配合如下提示词模板：

```
Create an xkcd-style comic: [your scene description]

Style: simple black and white stick figures, hand-drawn wobbly lines,
minimal background, clean white background, comic panel layout
```

示例提示词：  
```
Create an xkcd-style comic: Two programmers at computers. First says
"I spent 6 hours automating a task." Second: "How long did the task take?"
First: "5 minutes." Second: "How often do you do it?" First: "Once a year."
```

## Cron 示例

```bash
# Daily latest comic at 9 AM
cron add --schedule "0 9 * * *" --task "Fetch latest xkcd and send via Telegram"

# Random classic every Monday
cron add --schedule "0 10 * * 1" --task "Fetch random xkcd comic and share"
```

## 经典漫画

- **#327** “Exploits of a Mom” — Bobby Tables / SQL 注入  
- **#353** “Python” — import antigravity  
- **#303** “Compiling” — 编译代码时的剑术对决  
- **#386** “Duty Calls” — “互联网上有人错了”  
- **#1053** “Ten Thousand” — 幸运地每天学一点新东西  
- **#979** “Wisdom of the Ancients” — 无人解答的论坛帖子  
- **#927** “Standards” — 标准如何泛滥成灾  

## API

使用官方 [xkcd JSON API](https://xkcd.com/json.html)（无需认证）。  
- 最新漫画：`https://xkcd.com/info.0.json`  
- 指定编号：`https://xkcd.com/{num}/info.0.json`  
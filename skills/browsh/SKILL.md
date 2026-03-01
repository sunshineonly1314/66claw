---
name: browsh
name_zh: Browsh
description: 一款现代的基于文本的浏览器。使用无头 Firefox 在终端中渲染网页。
description_zh: 一款现代的基于文本的浏览器。使用无头 Firefox 在终端中渲染网页。
metadata: {"clawdbot":{"emoji":"🌐","requires":{"bins":["browsh","firefox"]}}}
---
# Browsh

一款功能完备的现代基于文本的浏览器。它可渲染图文内容与视频、过滤广告，并节省带宽。

## 前置条件
- `browsh` 二进制文件必须位于 PATH 中。
- `firefox` 二进制文件必须位于 PATH 中（Browsh 将其用作无头后端）。

**本地设置（若安装于 `~/apps`）：**  
确保 PATH 包含安装目录：  
```bash
export PATH=$HOME/apps:$HOME/apps/firefox:$PATH
```

## 使用方法

启动 Browsh：  
```bash
browsh
```

打开指定 URL：  
```bash
browsh --startup-url https://google.com
```

**注意：** Browsh 是一款 TUI 应用程序。请在 PTY 会话中运行它（例如，使用 `tmux` 或配合 `pty=true` 使用 `process` 工具）。
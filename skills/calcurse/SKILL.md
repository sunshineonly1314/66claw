---
name: calcurse
name_zh: Calcurse
description: 一款基于文本的日历与日程管理应用程序。仅限用于命令行界面（CLI）下的日历管理。
description_zh: 一款基于文本的日历与日程管理应用程序。仅限用于命令行界面（CLI）下的日历管理。
metadata: {"clawdbot":{"emoji":"📅","requires":{"bins":["calcurse"]}}}
---
# calcurse

一款基于文本的日历与日程管理应用程序。

## 用法（CLI 模式）

在非交互模式下使用 `calcurse` 执行快速查询与更新。

### 查询
列出接下来 2 天的预约事项：
```bash
calcurse -r2
```

查询特定日期范围内的事项：
```bash
calcurse -Q --from 2026-01-20 --to 2026-01-22
```

### 添加条目
添加一项预约：
```bash
calcurse -a "Meeting with Team" 2026-01-21 14:00 60
```
（格式：描述、日期、时间、持续时间（单位：分钟））

添加一项待办事项（todo）：
```bash
calcurse -t "Buy milk" 1
```
（格式：描述、优先级）

## 交互模式（TUI）
如需完整的基于文本的用户界面（TUI）体验，请在 PTY 会话中运行（例如，在 `tmux` 内运行，或使用 `process` 配合 `pty=true`）。
```bash
calcurse
```
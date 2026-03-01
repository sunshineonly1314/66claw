---
name: accli
name_zh: Accli
description: 本 skills 适用于在 macOS 系统上与 Apple 日历交互。可用于列出日历、查看事件、创建/更新/删除日历事件，以及检查可用性/忙闲状态。当用户提出如下请求时触发：如“检查我的日历”、“安排会议”、“我今天有什么安排？”、“我明天有空吗？”，或任何与日历相关的操作。
description_zh: 本 skills 适用于在 macOS 系统上与 Apple 日历交互。可用于列出日历、查看事件、创建/更新/删除日历事件，以及检查可用性/忙闲状态。当用户提出如下请求时触发：如“检查我的日历”、“安排会议”、“我今天有什么安排？”、“我明天有空吗？”，或任何与日历相关的操作。
---
# Apple 日历命令行工具（accli）

## 安装

```bash
npm install -g @joargp/accli
```

**运行要求：** 仅限 macOS（使用 JavaScript for Automation）

## 概述

accli 工具为 macOS Apple 日历提供命令行访问能力。支持列出日历、查询事件、创建/更新/删除事件，以及跨多个日历检查可用性/忙闲状态。

## 快速参考

### 时间日期格式
- 含具体时间的事件：YYYY-MM-DDTHH:mm 或 YYYY-MM-DDTHH:mm:ss  
- 全天事件：YYYY-MM-DD  

### 全局选项
- --json - Output as JSON (recommended for parsing)
- --help - Show help for any command

## 命令

### 列出日历

```
accli calendars [--json]
```

列出所有可用日历及其名称与持久化 ID。首次使用时请先运行此命令，以发现可用日历及其 ID。

### 列出事件

```
accli events <calendarName> [options]
```

选项：
- --calendar-id <id> - Persistent calendar ID (recommended over name)
- --from <datetime> - Start of range (default: now)
- --to <datetime> - End of range (default: from + 7 days)
- --max <n> - Maximum events to return (default: 50)
- --query <q> - Case-insensitive filter on summary/location/description
- --json - Output JSON

示例：

```bash
# Events from Work calendar for this week
accli events Work --json

# Events in January
accli events Work --from 2025-01-01 --to 2025-01-31 --json

# Search for specific events
accli events Work --query "standup" --max 10 --json
```

### 获取单个事件

```
accli event <calendarName> <eventId> [--json]
```

根据事件 ID 获取指定事件的详细信息。

### 创建事件

```
accli create <calendarName> --summary <s> --start <datetime> --end <datetime> [options]
```

必需选项：
- --summary <s> - Event title
- --start <datetime> - Start time
- --end <datetime> - End time

可选选项：
- --location <l> - Event location
- --description <d> - Event description
- --all-day - Create an all-day event
- --json - Output JSON

示例：

```bash
# Create a timed meeting
accli create Work --summary "Team Standup" --start 2025-01-15T09:00 --end 2025-01-15T09:30 --json

# Create an all-day event
accli create Personal --summary "Vacation" --start 2025-07-01 --end 2025-07-05 --all-day --json

# Create with location and description
accli create Work --summary "Client Meeting" --start 2025-01-15T14:00 --end 2025-01-15T15:00 \
  --location "Conference Room A" --description "Q1 planning discussion" --json
```

### 更新事件

```
accli update <calendarName> <eventId> [options]
```

选项（全部为可选；仅提供需修改的字段）：
- --summary <s> - New title
- --start <datetime> - New start time
- --end <datetime> - New end time
- --location <l> - New location
- --description <d> - New description
- --all-day - Convert to all-day event
- --no-all-day - Convert to timed event
- --json - Output JSON

示例：

```bash
accli update Work event-id-123 --summary "Updated Meeting Title" --start 2025-01-15T15:00 --end 2025-01-15T16:00 --json
```

### 删除事件

```
accli delete <calendarName> <eventId> [--json]
```

永久删除某事件。执行前须向用户确认。

### 检查忙闲状态（Free/Busy）

```
accli freebusy --calendar <name> --from <datetime> --to <datetime> [options]
```

选项：
- --calendar <name> - Calendar name (can repeat for multiple calendars)
- --calendar-id <id> - Persistent calendar ID (can repeat)
- --from <datetime> - Start of range (required)
- --to <datetime> - End of range (required)
- --json - Output JSON

显示忙碌时间段，排除已取消、已拒绝及透明（transparent）事件。

示例：

```bash
# Check availability across calendars
accli freebusy --calendar Work --calendar Personal --from 2025-01-15 --to 2025-01-16 --json

# Check specific hours
accli freebusy --calendar Work --from 2025-01-15T09:00 --to 2025-01-15T18:00 --json
```

### 配置

```bash
# Set default calendar (interactive)
accli config set-default

# Set default by name
accli config set-default --calendar Work

# Show current config
accli config show

# Clear default
accli config clear
```

设置默认日历后，若未显式指定日历，相关命令将自动使用该默认日历。

## 工作流指南

### 创建事件前
1. 列出日历，获取可用日历名称/ID  
2. 检查忙闲状态，查找可用时间段  
3. 创建事件前，向用户确认事件详情  

### 最佳实践
- 编程调用时始终使用 `--json` 标志以确保结构化解析  
- 优先使用 `--calendar-id` 而非日历名称，以提升可靠性  
- 查询事件时，起始日期范围应合理  
- 删除操作前务必向用户确认  
- 始终统一采用 ISO 8601 时间日期格式  

### 常见模式

查找空闲时段并安排会议：

```bash
# 1. Check availability
accli freebusy --calendar Work --from 2025-01-15T09:00 --to 2025-01-15T18:00 --json

# 2. Create event in available slot
accli create Work --summary "Meeting" --start 2025-01-15T14:00 --end 2025-01-15T15:00 --json
```

查看今日日程：

```bash
accli events Work --from $(date +%Y-%m-%d) --to $(date -v+1d +%Y-%m-%d) --json
```
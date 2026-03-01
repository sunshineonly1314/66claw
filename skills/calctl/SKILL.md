---
name: calctl
name_zh: Calctl
description: 通过 icalBuddy + AppleScript CLI 管理 Apple 日历事件
description_zh: 通过 icalBuddy + AppleScript CLI 管理 Apple 日历事件
---
# calctl - Apple 日历命令行工具

使用 icalBuddy（快速读取）和 AppleScript（写入）从命令行管理 Apple 日历。

**依赖项：** `brew install ical-buddy`

## 命令

| 命令 | 描述 |
|------|------|
| `calctl calendars` | 列出所有日历 |
| `calctl show [filter]` | 显示事件（今日、明日、本周、YYYY-MM-DD） |
| `calctl add <title>` | 创建新事件 |
| `calctl search <query>` | 按标题搜索事件（未来 30 天内） |

## 示例

```bash
# List calendars
calctl calendars

# Show today's events
calctl show today

# Show this week's events
calctl show week

# Show events from specific calendar
calctl show week --calendar Work

# Show events on specific date
calctl show 2026-01-25

# Add an event
calctl add "Meeting with John" --date 2026-01-22 --time 14:00

# Add event to specific calendar
calctl add "Team Standup" --calendar Work --date 2026-01-22 --time 09:00 --end 09:30

# Add all-day event
calctl add "Holiday" --date 2026-01-25 --all-day

# Add event with notes
calctl add "Project Review" --date 2026-01-22 --time 15:00 --notes "Bring quarterly report"

# Search for events
calctl search "meeting"
```

## `add` 的选项

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `-c, --calendar <name>` | 事件要添加到的日历 | Privat |
| `-d, --date <YYYY-MM-DD>` | 事件日期 | today |
| `-t, --time <HH:MM>` | 开始时间 | 09:00 |
| `-e, --end <HH:MM>` | 结束时间 | 比开始时间晚 1 小时 |
| `-n, --notes <text>` | 事件备注 | none |
| `--all-day` | 创建全天事件 | false |

## 可用日历

本系统上常见的日历：
- Privat（个人）
- Work（工作）
- Familien Kalender（家庭日历）
- rainbat solutions GmbH
- TimeTrack
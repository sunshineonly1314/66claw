---
name: apple-calendar
name_zh: 苹果日历
description: macOS 上的 Apple Calendar.app 集成。支持事件的增删改查（CRUD）、搜索及多日历功能。
description_zh: macOS 上的 Apple Calendar.app 集成。支持事件的增删改查（CRUD）、搜索及多日历功能。
metadata: {"clawdbot":{"emoji":"📅","os":["darwin"]}}
---
# Apple Calendar

通过 AppleScript 与 Calendar.app 交互。脚本运行位置：`cd {baseDir}`

## 命令

| 命令 | 用法 |
|---------|-------|
| 列出日历 | `scripts/cal-list.sh` |
| 列出事件 | `scripts/cal-events.sh [days_ahead] [calendar_name]` |
| 读取事件 | `scripts/cal-read.sh <event-uid> [calendar_name]` |
| 创建事件 | `scripts/cal-create.sh <calendar> <summary> <start> <end> [location] [description] [allday] [recurrence]` |
| 更新事件 | `scripts/cal-update.sh <event-uid> [--summary X] [--start X] [--end X] [--location X] [--description X]` |
| 删除事件 | `scripts/cal-delete.sh <event-uid> [calendar_name]` |
| 搜索事件 | `scripts/cal-search.sh <query> [days_ahead] [calendar_name]` |

## 日期格式

- 定时事件：`YYYY-MM-DD HH:MM`
- 全天事件：`YYYY-MM-DD`

## 重复规则

| 模式 | RRULE |
|---------|-------|
| 每日，共 10 次 | `FREQ=DAILY;COUNT=10` |
| 每周，周一/周三/周五 | `FREQ=WEEKLY;BYDAY=MO,WE,FR` |
| 每月 15 日 | `FREQ=MONTHLY;BYMONTHDAY=15` |

## 输出

- 事件列表/搜索结果：`UID | Summary | Start | End | AllDay | Location | Calendar`
- 读取事件：包含描述、URL 和重复规则在内的完整详情

## 注意事项

- 只读日历（如“生日”、“节假日”）无法修改
- 日历名称区分大小写
- 删除重复事件将移除整个系列
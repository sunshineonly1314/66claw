---
name: apple-remind-me
name_zh: 苹果提醒
description: 使用自然语言创建真实的 Apple 提醒事项.app 条目（原生 macOS 支持）
description_zh: 使用自然语言创建真实的 Apple 提醒事项.app 条目（原生 macOS 支持）
metadata: {"clawdbot":{"emoji":"⏰","os":["darwin"],"requires":{"bins":["remindctl","date"]}}}
---
# Apple Remind Me（macOS 原生）

使用自然语言创建、管理和整理 Apple 提醒事项。原生支持 Reminders.app —— 可同步至 iPhone、iPad 和 Apple Watch。

## 快速参考

| 想要…… | 命令 | 示例 |
|---------|------|------|
| 创建提醒 | `create-reminder.sh "msg" "when"` | `create-reminder.sh "Call mom" "tomorrow at 2pm"` |
| 列出提醒 | `list-reminders.sh [filter]` | `list-reminders.sh today` |
| 完成提醒 | `complete-reminder.sh ID` | `complete-reminder.sh XXXX-XXXX` |
| 删除提醒 | `delete-reminder.sh ID` | `delete-reminder.sh XXXX-XXXX` |
| 编辑内容 | `edit-reminder-message.sh ID "msg"` | `edit-reminder-message.sh XXXX "New text"` |
| 编辑时间 | `edit-reminder-time.sh ID "when"` | `edit-reminder-time.sh XXXX "next friday"` |

## 可用命令

### 1. 创建提醒  
使用自然语言时间解析创建新提醒。

**用法：**  
```bash
./create-reminder.sh "message" "when"
```

**示例：**  
```bash
./create-reminder.sh "Pay bills" "later today"
./create-reminder.sh "Call dentist" "tomorrow at 3pm"
./create-reminder.sh "Check email" "in 2 hours"
./create-reminder.sh "Team meeting" "next monday at 10am"
```

### 2. 列出提醒  
显示所有未完成的提醒，含 ID、标题、截止日期及所属列表。

**用法：**  
```bash
./list-reminders.sh
```

**输出格式：**  
```
⏳ ID: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
   Title: Reminder text
   Due: 2026-01-27 14:00
   List: Reminders
```

### 3. 完成提醒  
将提醒标记为已完成（将在 Reminders.app 中移入“已完成”列表）。

**用法：**  
```bash
./complete-reminder.sh "REMINDER-ID"
```

**示例：**  
```bash
./complete-reminder.sh "CDCBCB94-1215-494E-9F12-471AFEF25C09"
```

### 4. 删除提醒  
永久删除某条提醒。

**用法：**  
```bash
./delete-reminder.sh "REMINDER-ID"
```

**示例：**  
```bash
./delete-reminder.sh "7C403BC5-6016-410A-810D-9A0F924682F9"
```

### 5. 编辑提醒内容  
更新已有提醒的文本/标题。

**用法：**  
```bash
./edit-reminder-message.sh "REMINDER-ID" "new message"
```

**示例：**  
```bash
./edit-reminder-message.sh "CDCBCB94-1215-494E-9F12-471AFEF25C09" "Updated reminder text"
```

### 6. 编辑提醒时间  
使用自然语言将提醒重新安排至新时间。

**用法：**  
```bash
./edit-reminder-time.sh "REMINDER-ID" "new time"
```

**示例：**  
```bash
./edit-reminder-time.sh "CDCBCB94-1215-494E-9F12-471AFEF25C09" "tomorrow at 2pm"
./edit-reminder-time.sh "CDCBCB94-1215-494E-9F12-471AFEF25C09" "in 3 hours"
./edit-reminder-time.sh "CDCBCB94-1215-494E-9F12-471AFEF25C09" "next friday"
```

## 时间解析参考

### 相对时间  
格式：`in [number] [unit]`  
- `in 5 minutes` → 从当前时刻起 5 分钟后  
- `in 2 hours` → 从当前时刻起 2 小时后  
- `in 3 days` → 从当前时刻起 3 天后  

### 时间点快捷表达  
- `later today` / `later` / `this afternoon` → 今天 17:00  
- `tonight` → 今天 20:00  
- `tomorrow` → 明天 09:00  

### 明日指定时间  
格式：`tomorrow at [time]`  
- `tomorrow at 3pm` → 明天 15:00  
- `tomorrow at 10:30am` → 明天 10:30  
- `tomorrow at 8pm` → 明天 20:00  

### 星期几  
格式：`next [weekday]`（必须小写）  
- `next monday` → 下周一 09:00  
- `next friday` → 下周五 09:00  
- `next sunday` → 下周日 09:00  

**注意：** 星期名称必须为小写（如 monday、tuesday 等）

### ISO 格式（备用方案）  
- `2026-01-27 14:00` → 精确的日期与时间  

## Agent 实现指南

### 创建提醒  
当用户说：“提醒我 X，在/于 Y 时”  
```bash
./create-reminder.sh "X" "Y"
```

### 列出提醒  
当用户询问：“我的提醒事项有哪些？” 或 “显示我的提醒事项”  
```bash
./list-reminders.sh
```

### 完成提醒  
当用户说：“将 [提醒] 标记为已完成” 或 “完成 [提醒]”  
1. 列出提醒以查找其 ID  
2. 使用该 ID 执行完成操作：  
```bash
./complete-reminder.sh "REMINDER-ID"
```

### 编辑提醒  
当用户说：“将 [提醒] 的内容改为 X” 或 “将 [提醒] 重新安排至 Y”  
1. 列出提醒以查找其 ID  
2. 编辑内容或时间：  
```bash
./edit-reminder-message.sh "REMINDER-ID" "new message"
./edit-reminder-time.sh "REMINDER-ID" "new time"
```

### 删除提醒  
当用户说：“删除 [提醒]” 或 “移除 [提醒]”  
1. 列出提醒以查找其 ID  
2. 执行删除：  
```bash
./delete-reminder.sh "REMINDER-ID"
```

## 工作流示例

### 完整工作流：查找并完成一条提醒  
```bash
# 1. List all reminders
./list-reminders.sh | grep "Pay bills"

# 2. Get the ID from output
# Output shows: ID: CDCBCB94-1215-494E-9F12-471AFEF25C09

# 3. Mark as complete
./complete-reminder.sh "CDCBCB94-1215-494E-9F12-471AFEF25C09"
```

### 完整工作流：重新安排一条提醒  
```bash
# 1. List reminders and find the one to reschedule
./list-reminders.sh | grep "Team meeting"

# 2. Reschedule to new time
./edit-reminder-time.sh "REMINDER-ID" "next friday at 2pm"
```

## 技术细节  

- **后端：** 使用 `remindctl` 命令行工具（macOS 原生）  
- **日期解析：** BSD date 工具（兼容 macOS）  
- **时间格式：** 供 remindctl 使用的 ISO 8601 时间戳  
- **列表筛选：** 默认仅显示未完成的提醒  
- **同步：** 所有更改立即同步至 iCloud 及全部设备  

## 要求  

- macOS（darwin）  
- `remindctl`（安装于 `/usr/local/bin/remindctl`）  
- `date`（BSD 版本，macOS 默认提供）  
- `python3`（用于 list-reminders.sh 中的 JSON 解析）  
- Apple 提醒事项.app  

## 局限性  

- 星期几解析要求小写（例如 "monday"，而非 "Monday"）  
- “下个 [星期几]” 表示加 7 天（不计算实际最近一次出现）  
- 不支持重复提醒  
- 不支持自定义提醒列表（仅使用默认“提醒事项”列表）  
- 不支持基于位置的提醒
---
name: icloud-reminders
description: 面向 iOS 13+ 待办事项应用的 CloudKit API 接入。支持完整 CRUD 操作，涵盖提醒、标签、子任务与重复规则。
description_zh: 面向 iOS 13+ 待办事项应用的 CloudKit API 接入。支持完整 CRUD 操作，涵盖提醒、标签、子任务与重复规则。
---
# iCloud 待办事项

面向 iOS 13+ 待办事项应用的 CloudKit API 接入。支持完整 CRUD 操作，涵盖提醒、标签、子任务与重复规则。

## 设置

### 1. 安装依赖
```bash
pip install pyicloud requests
```

### 2. 获取您的凭据
- **邮箱：** 您的 Apple ID 邮箱  
- **密码：** 您的 **主 Apple ID 密码**（非应用专用密码）  
  - 双重认证（2FA）由 pyicloud 自动处理（首次运行时会提示输入验证码）

### 3. 首次运行
```bash
python reminders.py -u "your@email.com" -p "yourpassword" summary
```  
若已启用双重认证（2FA），系统将提示您输入验证码。验证通过后会缓存会话。

## 使用方法

```bash
python reminders.py -u EMAIL -p PASSWORD COMMAND [options]
```

添加 `--json` 参数以输出 JSON 格式。

## 命令

### 读取
```bash
summary                  # Quick stats (heartbeat-friendly)
pending                  # Incomplete, grouped by list
today | overdue | flagged
lists | tags | all
search "query"
```

### 创建
```bash
create "title" [options]

--list NAME              # Target list
--due YYYY-MM-DD         # Due date
--time HH:MM             # Due time (24h format)
--alarm MINUTES          # Alert before due (0, 15, 60, etc.)
--flagged                # Flag it
--priority high|medium|low
--notes "text"
--url URL
--tags "tag1,tag2"       # Hashtags (comma-separated, no #)
--parent REMINDER_ID     # Make subtask
--recurrence daily|weekly|monthly|yearly
--recurrence-interval N  # Every N periods (default: 1)
--recurrence-count N     # Stop after N occurrences
```

### 更新
```bash
update "identifier" [options]

--title "new title"
--list NAME
--due YYYY-MM-DD
--flagged | --unflag
--priority high|medium|low
--notes "text"
```

### 其他
```bash
complete "identifier"    # Mark done
delete "identifier"      # Delete (cascades alarms)
```

标识符：待办事项 ID（`Reminder/UUID`）或标题（支持模糊匹配）。

## 功能支持表

| 功能 | 创建 | 读取 | 更新 |
|---------|:------:|:----:|:------:|
| 标题、列表、截止时间、标记为重要、优先级、备注 | ✅ | ✅ | ✅ |
| 网址（URL） | ✅ | ✅ | - |
| 基于时间的提醒 | ✅ | ✅ | - |
| 标签（Hashtags） | ✅ | ✅ | - |
| 子任务 | ✅ | ✅ | - |
| 重复规则 | ✅ | ✅ | - |

## 局限性

| 功能 | 原因 | 替代方案 |
|---------|--------|------------|
| 基于位置的提醒 | 需设备启用加密 | 请使用 iOS 原生应用 |
| 附件 | ASSETID 上传逻辑复杂 | 请使用 iOS 原生应用 |
| 新建列表 | 服务端行为不一致 | 请使用 iOS 原生应用 |

## 技术说明

- **优先级取值：** 0=无，1=高，5=中，9=低  
- **级联删除：** 删除待办事项时将自动移除关联的提醒  
- **会话缓存：** 首次认证后缓存在 `~/.pyicloud/` 中  
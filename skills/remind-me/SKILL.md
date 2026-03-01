---
name: remind-me
name_zh: 提醒我
description: 使用自然语言设置提醒。自动创建一次性定时任务，并以 Markdown 格式记录日志。
description_zh: 使用自然语言设置提醒。自动创建一次性定时任务，并以 Markdown 格式记录日志。
metadata: {"clawdbot":{"emoji":"⏰","requires":{"bins":["bash","date"]}}}
---
# 提醒我

支持自然语言的自动提醒功能。使用 cron 进行调度，以 Markdown 记录日志。

## 使用方法

### 一次性提醒
只需自然表达即可：
- “稍后今天提醒我支付 Gumroad 费用”
- “明天下午 3 点提醒我给妈妈打电话”
- “2 小时后提醒我查看烤箱”
- “下周一上午 9 点提醒我开会”

### 周期性提醒
如需重复提醒，请使用：
- “每小时提醒我伸展身体”
- “每天上午 9 点提醒我查看邮件”
- “每周一 下午 2 点提醒我开会”
- “每周提醒我提交工时表”

## 工作原理

1. 从您的消息中解析时间信息
2. 使用 `--at` 创建一次性 cron 任务
3. 将记录写入 `/home/julian/clawd/reminders.md` 以备查证
4. 到达预定时间时，向您发送提醒消息

## 时间解析规则

### 一次性提醒

**相对时间：**
- “5 分钟后” / “2 小时后” / “3 天后”
- “今天晚些时候” → 今天 17:00
- “今天下午” → 今天 15:00
- “今晚” → 今天 20:00

**绝对时间：**
- “明天” → 明天上午 9 点
- “明天下午 3 点” → 明天 15:00
- “下周一” → 下周一上午 9 点
- “下周一 下午 2 点” → 下周一 14:00

**具体日期：**
- “1 月 15 日” → 1 月 15 日上午 9 点
- “1 月 15 日下午 3 点” → 1 月 15 日 15:00
- “2026-01-15” → 2026 年 1 月 15 日上午 9 点
- “2026-01-15 14:30” → 2026 年 1 月 15 日 14:30

### 周期性提醒

**时间间隔：**
- “每 30 分钟”
- “每 2 小时”

**每日：**
- “每天上午 9 点”
- “每天下午 3 点”

**每周：**
- “每周” → 每周一上午 9 点
- “每周一 下午 2 点”
- “每周五 下午 5 点”

## 提醒日志

所有提醒均记录于 `/home/julian/clawd/reminders.md`：

```markdown
- [scheduled] 2026-01-06 17:00 | Pay for Gumroad (id: abc123)
- [recurring] every 2h | Stand up and stretch (id: def456)
- [recurring] cron: 0 9 * * 1 | Weekly meeting (id: ghi789)
```

**状态说明：**
- `[scheduled]` —— 待触发的一次性提醒
- `[recurring]` —— 活跃的周期性提醒
- `[sent]` —— 已送达的一次性提醒

## 手动命令

```bash
# List pending reminders
cron list

# View reminder log
cat /home/julian/clawd/reminders.md

# Remove a scheduled reminder
cron rm <job-id>
```

## Agent 实现细节

### 一次性提醒

当用户说“提醒我 X 在 Y 时间”时：

```bash
bash /home/julian/clawd/skills/remind-me/create-reminder.sh "X" "Y"
```

**示例：**
```bash
bash /home/julian/clawd/skills/remind-me/create-reminder.sh "Pay for Gumroad" "later today"
bash /home/julian/clawd/skills/remind-me/create-reminder.sh "Call dentist" "tomorrow at 3pm"
bash /home/julian/clawd/skills/remind-me/create-reminder.sh "Check email" "in 2 hours"
```

### 周期性提醒

当用户说“每 X 时间提醒我 Y”时：

```bash
bash /home/julian/clawd/skills/remind-me/create-recurring.sh "Y" "every X"
```

**示例：**
```bash
bash /home/julian/clawd/skills/remind-me/create-recurring.sh "Stand up and stretch" "every 2 hours"
bash /home/julian/clawd/skills/remind-me/create-recurring.sh "Check email" "daily at 9am"
bash /home/julian/clawd/skills/remind-me/create-recurring.sh "Weekly team meeting" "every Monday at 2pm"
```

上述两个脚本均会自动完成以下操作：
1. 解析时间/调度信息
2. 创建 cron 任务（一次性任务使用 `--at`；周期性任务使用 `--every`/`--cron`）
3. 记录至 `/home/julian/clawd/reminders.md`
4. 返回包含任务 ID 的确认信息
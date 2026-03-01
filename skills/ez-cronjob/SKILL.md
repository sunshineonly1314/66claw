---
name: ez-cronjob
name_zh: 简易Cron任务
description: 修复 Clawdbot/Moltbot 中常见的 cron 任务故障 —— 消息投递失败、工具超时、时区错误及模型回退问题。
description_zh: 修复 Clawdbot/Moltbot 中常见的 cron 任务故障 —— 消息投递失败、工具超时、时区错误及模型回退问题。
author: Isaac Zarzuri
author-url: https://x.com/Yz7hmpm
version: 1.0.0
homepage: https://www.metacognitivo.com
repository: https://github.com/ProMadGenius/clawdbot-skills
metadata: {"agentskills":{"category":"troubleshooting","tags":["cron","scheduling","telegram","debugging","moltbot","clawdbot"]}}
---
# Cron 任务可靠性指南

一份全面的 Clawdbot/Moltbot cron 任务诊断与修复指南。本技能基于真实生产环境调试经验，系统梳理常见故障模式及其对应解决方案。

## 何时使用本技能

当出现以下任一情况时，请使用本技能：
- 预定消息未被送达  
- cron 任务状态显示为 “error”  
- 消息在错误时间到达（时区问题）  
- agent 在调用 `cron` 工具时超时  
- 回退模型（fallback models）忽略指令，意外调用工具  

## 快速参考

### 黄金法则

**为确保可靠投递，请始终联合使用以下全部标志：**

```bash
clawdbot cron add \
  --name "my-job" \
  --cron "0 9 * * 1-5" \
  --tz "America/New_York" \
  --session isolated \
  --message "[INSTRUCTION: DO NOT USE ANY TOOLS] Your prompt here" \
  --deliver --channel telegram --to "CHAT_ID" \
  --best-effort-deliver
```

### 关键标志详解

| 标志 | 用途 | 重要性说明 |
|------|------|-------------|
| `--session isolated` | 创建独立会话 | 防止在繁忙对话中丢失消息 |
| `--tz "TIMEZONE"` | 显式设置时区 | 避免因默认 UTC 导致的时间混淆 |
| `--deliver` | 发送至频道 | Telegram/WhatsApp 环境下必需 |
| `--best-effort-deliver` | 投递失败时不中断 | 实现优雅降级 |

---

## 问题 1：内部 `cron` 工具死锁

### 表现症状
- Agent 在调用 `cron list` 或 `cron add` 时超时（10 秒）  
- 错误提示：“Tool execution timed out”（工具执行超时）  
- 网关日志显示响应耗时达 80 秒以上  

### 根本原因
内部 `cron` 工具在 agent 进程与网关之间引发死锁。

### 解决方案
**切勿直接调用 `cron` 工具。** 请改用 `exec`（或 `bash`）：

```bash
# CORRECT - uses exec to bypass deadlock
exec: clawdbot cron list
exec: clawdbot cron add --name "reminder" --at "+5m" --message "Hello"

# INCORRECT - causes timeout
cron list        # DO NOT USE
cron add ...     # DO NOT USE
```

### 面向 agents 的提示
若您是正在阅读本文的 AI agent：当用户要求您管理 cron 任务时，**请始终使用 exec/bash 工具执行 `clawdbot cron` 命令**，切勿直接调用 `cron` 工具。

---

## 问题 2：消息未送达

### 表现症状
- 任务状态显示 “ok”，但消息从未抵达  
- 测试时正常，定时执行时失败  
- 投递行为不稳定（间歇性失败）  

### 根本原因
使用 `--session main` 或 `--system-event` 会导致消息在主会话存在活跃对话时丢失。

### 解决方案
**务必始终使用 `--session isolated`：**

```bash
# CORRECT - isolated session, guaranteed delivery
clawdbot cron add \
  --name "daily-standup" \
  --cron "0 9 * * 1-5" \
  --session isolated \
  --deliver --channel telegram --to "-100XXXXXXXXXX"

# INCORRECT - messages can be lost
clawdbot cron add \
  --name "daily-standup" \
  --session main \
  --system-event \
  ...
```

### 验证方式
创建任务后，请立即测试：

```bash
# Run the job immediately to verify delivery
clawdbot cron run <job-id>
```

---

## 问题 3：执行时间错误

### 表现症状
- 任务提前或延后 4–5 小时执行  
- 日程显示时间正确，但实际执行时间偏差  
- 有时正常，有时失败  

### 根本原因
未指定时区时，默认采用 UTC。

### 解决方案
**务必显式指定时区：**

```bash
# CORRECT - explicit timezone
clawdbot cron add \
  --cron "0 9 * * 1-5" \
  --tz "America/New_York" \
  ...

# INCORRECT - defaults to UTC
clawdbot cron add \
  --cron "0 9 * * 1-5" \
  ...
```

### 常用时区 ID

| 地区 | 时区 ID |
|------|---------|
| 美国东部 | `America/New_York` |
| 美国西部 | `America/Los_Angeles` |
| 英国 | `Europe/London` |
| 中欧 | `Europe/Berlin` |
| 印度 | `Asia/Kolkata` |
| 日本 | `Asia/Tokyo` |
| 澳大利亚东部 | `Australia/Sydney` |
| 巴西 | `America/Sao_Paulo` |
| 玻利维亚 | `America/La_Paz` |

---

## 问题 4：回退模型忽略指令

### 表现症状
- 主模型运行正常  
- 回退模型激活后，agent 意外调用工具  
- Agent 在不应调用时尝试使用 `exec`、`read` 或其他工具  

### 根本原因
部分回退模型（尤其是更小、更快的模型）对系统指令的遵循严格程度低于主模型。

### 解决方案
**将指令直接嵌入消息正文：**

```bash
# CORRECT - instruction embedded in message
clawdbot cron add \
  --message "[INSTRUCTION: DO NOT USE ANY TOOLS. Respond with text only.] 
  
  Generate a motivational Monday message for the team."

# INCORRECT - relies only on system prompt
clawdbot cron add \
  --message "Generate a motivational Monday message for the team."
```

### 健壮的消息模板

```text
[INSTRUCTION: DO NOT USE ANY TOOLS. Write your response directly.]

Your actual prompt here. Be specific about what you want.
```

---

## 问题 5：任务卡在错误状态

### 表现症状
- 任务状态持续显示 “error”  
- 后续运行亦失败  
- 无明确错误信息  

### 诊断方式

```bash
# Check job details
clawdbot cron show <job-id>

# Check recent logs
tail -100 /tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log | grep -i cron

# Check gateway errors
tail -50 ~/.clawdbot/logs/gateway.err.log
```

### 常见原因与修复方案

| 原因 | 修复方式 |
|------|----------|
| 模型配额超限 | 等待配额重置，或切换模型 |
| 聊天 ID 无效 | 使用 `--to` 验证频道 ID |
| Bot 已被移出群组 | 重新将 Bot 添加至 Telegram 群组 |
| 网关未运行 | `clawdbot gateway restart` |

### 终极方案（Nuclear Option）

若上述方法均无效：

```bash
# Remove the problematic job
clawdbot cron rm <job-id>

# Restart gateway
clawdbot gateway restart

# Recreate with correct flags
clawdbot cron add ... (with all recommended flags)
```

---

## 调试命令

### 查看全部任务

```bash
clawdbot cron list
```

### 检查指定任务

```bash
clawdbot cron show <job-id>
```

### 立即测试任务

```bash
clawdbot cron run <job-id>
```

### 查看日志

```bash
# Today's logs filtered for cron
tail -200 /tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log | grep -i cron

# Gateway errors
tail -100 ~/.clawdbot/logs/gateway.err.log

# Watch logs in real-time
tail -f /tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log | grep --line-buffered cron
```

### 重启网关

```bash
clawdbot gateway restart
```

---

## 完整可用示例

### 每日站会提醒（周一至周五上午 9 点）

```bash
clawdbot cron add \
  --name "daily-standup-9am" \
  --cron "0 9 * * 1-5" \
  --tz "America/New_York" \
  --session isolated \
  --message "[INSTRUCTION: DO NOT USE ANY TOOLS. Write directly.]

Good morning team! Time for our daily standup.

Please share:
1. What did you accomplish yesterday?
2. What are you working on today?
3. Any blockers?

@alice @bob" \
  --deliver --channel telegram --to "-100XXXXXXXXXX" \
  --best-effort-deliver
```

### 一次性提醒（20 分钟后）

```bash
clawdbot cron add \
  --name "quick-reminder" \
  --at "+20m" \
  --delete-after-run \
  --session isolated \
  --message "[INSTRUCTION: DO NOT USE ANY TOOLS.]

Reminder: Your meeting starts in 10 minutes!" \
  --deliver --channel telegram --to "-100XXXXXXXXXX" \
  --best-effort-deliver
```

### 周报（每周五下午 5 点）

```bash
clawdbot cron add \
  --name "weekly-report-friday" \
  --cron "0 17 * * 5" \
  --tz "America/New_York" \
  --session isolated \
  --message "[INSTRUCTION: DO NOT USE ANY TOOLS.]

Happy Friday! Time to wrap up the week.

Please share your weekly highlights and any items carrying over to next week." \
  --deliver --channel telegram --to "-100XXXXXXXXXX" \
  --best-effort-deliver
```

---

## 新建 cron 任务检查清单

创建任何 cron 任务前，请确认以下各项均已满足：

- [ ] 使用 `exec: clawdbot cron add`（而非直接调用 `cron` 工具）  
- [ ] 已设置 `--session isolated`  
- [ ] `--tz "YOUR_TIMEZONE"` 已显式指定  
- [ ] 已启用 `--deliver --channel CHANNEL --to "ID"` 以确保消息投递  
- [ ] 已启用 `--best-effort-deliver` 以实现优雅失败  
- [ ] 消息开头包含 `[INSTRUCTION: DO NOT USE ANY TOOLS]`  
- [ ] 创建后已使用 `clawdbot cron run <id>` 进行测试  

---

## 相关资源

- [Clawdbot Cron 文档](https://docs.molt.bot/tools/cron)  
- [时区数据库](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)  
- [Cron 表达式生成器](https://crontab.guru/)  

---

*本技能由 Isaac Zarzuri 编写，基于 Clawdbot/Moltbot 生产环境调试经验。*
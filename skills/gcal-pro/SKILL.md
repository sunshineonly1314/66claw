---
name: gcal-pro
name_zh: Google日历Pro
description: Google 日历集成，支持查看、创建与管理日程事件。当用户询问其日程安排、希望添加/编辑/删除事件、查询可用时间，或需要早间简报时启用。支持自然语言，例如：“我明天的日程是什么？”或“周五中午与 Alex 安排午餐。”免费版提供只读访问；专业版（$12）增加创建/编辑/删除功能及早间简报。
description_zh: Google 日历集成，支持查看、创建与管理日程事件。当用户询问其日程安排、希望添加/编辑/删除事件、查询可用时间，或需要早间简报时启用。支持自然语言，例如：“我明天的日程是什么？”或“周五中午与 Alex 安排午餐。”免费版提供只读访问；专业版（$12）增加创建/编辑/删除功能及早间简报。
---
# gcal-pro

通过自然对话方式管理 Google 日历。

## 快速参考

| 操作 | 命令 | 版本 |
|--------|---------|------|
| 查看今日日程 | `python scripts/gcal_core.py today` | 免费版 |
| 查看明日日程 | `python scripts/gcal_core.py tomorrow` | 免费版 |
| 查看本周日程 | `python scripts/gcal_core.py week` | 免费版 |
| 搜索事件 | `python scripts/gcal_core.py search -q "meeting"` | 免费版 |
| 列出日历 | `python scripts/gcal_core.py calendars` | 免费版 |
| 查找空闲时间 | `python scripts/gcal_core.py free` | 免费版 |
| 快速添加 | `python scripts/gcal_core.py quick -q "Lunch Friday noon"` | 专业版 |
| 删除事件 | `python scripts/gcal_core.py delete --id EVENT_ID -y` | 专业版 |
| 早间简报 | `python scripts/gcal_core.py brief` | 专业版 |

## 配置说明

**首次配置必需：**

1. 用户需创建 Google Cloud 项目并配置 OAuth 凭据  
2. 将 `client_secret.json` 保存至 `~/.config/gcal-pro/`  
3. 运行认证命令：  
   ```bash
   python scripts/gcal_auth.py auth
   ```  
4. 浏览器自动打开 → 用户授予日历访问权限 → 完成  

**检查认证状态：**  
```bash
python scripts/gcal_auth.py status
```  

## 版本说明

### 免费版  
- 查看事件（今日、明日、本周、本月）  
- 搜索事件  
- 列出日历  
- 查找空闲时间段  

### 专业版（$12 一次性付费）  
- 包含免费版全部功能，另增：  
- 创建事件  
- 快速添加（支持自然语言）  
- 更新/重新安排事件  
- 删除事件  
- 通过定时任务发送早间简报  

## 使用模式  

### 查看日程  

当用户提问“我的日程是什么？”或“我今天有什么安排？”时：  

```bash
cd /path/to/gcal-pro
python scripts/gcal_core.py today
```  

针对特定时间范围：  
- “明天” → `python scripts/gcal_core.py tomorrow`  
- “本周” → `python scripts/gcal_core.py week`  
- “与 Alex 的会议” → `python scripts/gcal_core.py search -q "Alex"`  

### 创建事件（专业版）  

当用户说“把 X 加入我的日程”或“安排 Y”时：  

**方式一：快速添加（自然语言）**  
```bash
python scripts/gcal_core.py quick -q "Lunch with Alex Friday at noon"
```  

**方式二：结构化创建（通过 Python）**  
```python
from scripts.gcal_core import create_event, parse_datetime

create_event(
    summary="Lunch with Alex",
    start=parse_datetime("Friday noon"),
    location="Cafe Roma",
    confirmed=True  # Set False to show confirmation prompt
)
```  

### 修改事件（专业版）  

**⚠️ 执行破坏性操作前必须确认！**  

在删除或大幅修改事件前，务必向用户确认：  

1. 展示事件详情  
2. 提问：“是否要删除/重新安排该事件？”  
3. 仅在用户确认后，才执行 `confirmed=True` 或 `-y` 标志对应的操作  

**删除事件：**  
```bash
# First, find the event
python scripts/gcal_core.py search -q "dentist"
# Shows event ID

# Then delete (with user confirmation)
python scripts/gcal_core.py delete --id abc123xyz -y
```  

### 查找空闲时间  

当用户提问“我什么时候有空？”或“帮我找一个 1 小时会议的时间段”时：  

```bash
python scripts/gcal_core.py free
```  

### 早间简报（专业版 + 定时任务）  

通过 Clawdbot 定时任务每日发送日程概览：  

```python
from scripts.gcal_core import generate_morning_brief
print(generate_morning_brief())
```  

**定时任务配置示例：**  
- 时间：每日上午 8:00  
- 操作：运行 `python scripts/gcal_core.py brief`  
- 发送方式：推送至用户的即时通讯频道（如 Telegram/WhatsApp 等）  

## 错误处理  

| 错误 | 原因 | 解决方案 |  
|------|------|----------|  
| “client_secret.json 未找到” | 配置未完成 | 完成 Google Cloud 配置 |  
| “令牌刷新失败” | 令牌已过期/已被撤销 | 运行 `python scripts/gcal_auth.py auth --force` |  
| “需要专业版” | 免费用户尝试执行写入操作 | 提示升级或说明限制 |  
| “事件未找到” | 事件 ID 无效 | 先搜索以确认正确事件 |  

## 时区处理  

- 所有时间均按用户本地时区解析（默认：America/New_York）  
- 当用户明确指定时区（如“下午 2 点 EST”）时，应予以尊重  
- 显示时间统一使用用户本地时区  
- 存储格式为带时区的 ISO 8601 标准格式  

## 响应格式  

**事件列表格式如下：**  

```
📅 **Monday, January 27**
  • 9:00 AM — Team standup
  • 12:00 PM — Lunch with Alex 📍 Cafe Roma
  • 3:00 PM — Client call

📅 **Tuesday, January 28**
  • 10:00 AM — Dentist appointment 📍 123 Main St
```  

**确认类响应格式：**  

```
✓ Event created: "Lunch with Alex"
  📅 Friday, Jan 31 at 12:00 PM
  📍 Cafe Roma
```  

**早间简报格式：**  

```
☀️ Good morning! Here's your day:
📆 Monday, January 27, 2026

You have 3 events today:
  • 9:00 AM — Team standup
  • 12:00 PM — Lunch with Alex
  • 3:00 PM — Client call

👀 Tomorrow: 2 events
```  

## 文件位置  

```
~/.config/gcal-pro/
├── client_secret.json   # OAuth app credentials (user provides)
├── token.json           # User's access token (auto-generated)
└── license.json         # Pro license (if purchased)
```  

## 与 Clawdbot 集成  

本 skill 支持以下 Clawdbot 功能：  
- **定时任务（Cron）**：安排早间简报  
- **记忆（Memory）**：存储日历偏好设置  
- **消息传递（Messaging）**：通过 Telegram/WhatsApp 等渠道推送简报  

## 升级提示  

当免费版用户尝试执行专业版功能时，请回复：  

> ⚠️ Creating events requires **gcal-pro Pro** ($12 one-time).  
>  
> Pro includes: Create, edit, delete events + morning briefs.  
>  
> 👉 Upgrade: [gumroad-link]  
>  
> For now, I can show you your schedule (free) — want to see today's events?  
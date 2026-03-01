---
name: gcal-pro-calendar
name_zh: 日历Pro日程
description: Google 日历集成技能，支持查看、创建及管理日程事件。当用户询问其日程安排、希望添加/编辑/删除事件、检查可用性，或需要早间简报时启用。支持自然语言指令，例如：“我明天的日程是什么？”或“周五中午与 Alex 安排午餐。”免费版仅提供只读访问；专业版（$12）额外支持创建/编辑/删除操作及早间简报。
description_zh: Google 日历集成技能，支持查看、创建及管理日程事件。当用户询问其日程安排、希望添加/编辑/删除事件、检查可用性，或需要早间简报时启用。支持自然语言指令，例如：“我明天的日程是什么？”或“周五中午与 Alex 安排午餐。”免费版仅提供只读访问；专业版（$12）额外支持创建/编辑/删除操作及早间简报。
---
# gcal-pro

通过自然对话方式管理 Google 日历。

## 快速参考

| 操作 | 命令 | 版本 |
|------|------|------|
| 查看今日日程 | `python scripts/gcal_core.py today` | 免费版 |
| 查看明日日程 | `python scripts/gcal_core.py tomorrow` | 免费版 |
| 查看本周日程 | `python scripts/gcal_core.py week` | 免费版 |
| 搜索日程事件 | `python scripts/gcal_core.py search -q "meeting"` | 免费版 |
| 列出日历列表 | `python scripts/gcal_core.py calendars` | 免费版 |
| 查询空闲时间 | `python scripts/gcal_core.py free` | 免费版 |
| 快速添加事件 | `python scripts/gcal_core.py quick -q "Lunch Friday noon"` | 专业版 |
| 删除事件 | `python scripts/gcal_core.py delete --id EVENT_ID -y` | 专业版 |
| 早间简报 | `python scripts/gcal_core.py brief` | 专业版 |

## 设置流程

**首次使用需完成以下配置：**

1. 用户须创建 Google Cloud 项目并生成 OAuth 凭据  
2. 将 `client_secret.json` 保存至 `~/.config/gcal-pro/`  
3. 执行身份认证命令：  
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
- 查看日程（今日、明日、本周、本月）  
- 搜索日程事件  
- 列出所有日历  
- 查询空闲时间段  

### 专业版（$12，一次性付费）
- 包含免费版全部功能，且额外支持：  
- 创建日程事件  
- 快速添加（支持自然语言）  
- 更新/重新安排日程事件  
- 删除日程事件  
- 通过 cron 任务触发早间简报  

## 使用模式

### 查看日程安排

当用户提问“我的日程安排是什么？”或“我今天有什么安排？”时：

```bash
cd /path/to/gcal-pro
python scripts/gcal_core.py today
```

针对特定时间范围：
- “明天” → `python scripts/gcal_core.py tomorrow`  
- “本周” → `python scripts/gcal_core.py week`  
- “与 Alex 的会议” → `python scripts/gcal_core.py search -q "Alex"`  

### 创建日程事件（专业版功能）

当用户说“把 X 加入我的日历”或“安排 Y”时：

**选项一：快速添加（自然语言）**  
```bash
python scripts/gcal_core.py quick -q "Lunch with Alex Friday at noon"
```  

**选项二：结构化创建（通过 Python 调用）**  
```python
from scripts.gcal_core import create_event, parse_datetime

create_event(
    summary="Lunch with Alex",
    start=parse_datetime("Friday noon"),
    location="Cafe Roma",
    confirmed=True  # Set False to show confirmation prompt
)
```  

### 修改日程事件（专业版功能）

**⚠️ 所有破坏性操作均需用户确认！**  

在删除或大幅修改某事件前，务必向用户确认：

1. 展示该事件详细信息  
2. 提问：“是否要删除/重新安排此事件？”  
3. 仅在用户确认后，才使用 `confirmed=True` 或 `-y` 标志继续执行  

**删除事件：**  
```bash
# First, find the event
python scripts/gcal_core.py search -q "dentist"
# Shows event ID

# Then delete (with user confirmation)
python scripts/gcal_core.py delete --id abc123xyz -y
```  

### 查询空闲时间

当用户提问“我什么时候有空？”或“帮我找一个 1 小时的会议时间”时：

```bash
python scripts/gcal_core.py free
```  

### 早间简报（专业版 + Cron）

通过 Clawdbot cron 设置每日日程摘要推送：

```python
from scripts.gcal_core import generate_morning_brief
print(generate_morning_brief())
```  

**Cron 配置示例：**  
- 执行时间：每日上午 8:00  
- 执行动作：运行 `python scripts/gcal_core.py brief`  
- 投递方式：将输出发送至用户的即时通讯频道（如 Telegram / WhatsApp 等）  

## 错误处理

| 错误提示 | 原因 | 解决方案 |
|----------|------|-----------|
| “未找到 client_secret.json” | 配置未完成 | 完成 Google Cloud 配置流程 |
| “令牌刷新失败” | 令牌已过期或已被撤销 | 运行 `python scripts/gcal_auth.py auth --force` 重新认证 |
| “需要专业版” | 免费用户尝试执行写入操作 | 提示升级，或说明当前限制 |
| “事件未找到” | 事件 ID 无效 | 先搜索以获取正确的事件 ID |

## 时区处理

- 所有时间默认按用户本地时区解析（默认为 America/New_York）  
- 若用户明确指定时区（例如：“下午 2 点 EST”），则严格遵循该时区  
- 向用户展示的时间始终为其本地时区时间  
- 存储格式统一采用带时区信息的 ISO 8601 标准  

## 响应格式规范

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

## 与 Clawdbot 的集成能力

本 skill 支持以下 Clawdbot 功能：
- **Cron**：定时触发早间简报  
- **Memory**：存储用户日历偏好设置  
- **Messaging**：通过 Telegram / WhatsApp 等渠道投递简报  

## 升级提示语

当免费版用户尝试执行专业版功能时，请回复：

> ⚠️ Creating events requires **gcal-pro Pro** ($12 one-time).  
>  
> Pro includes: Create, edit, delete events + morning briefs.  
>  
> 👉 Upgrade: [gumroad-link]  
>  
> For now, I can show you your schedule (free) — want to see today's events?  
---
name: linkedin-inbox
name_zh: LinkedIn 收件箱
description: 支持定时扫描、按用户沟通风格自动生成回复草稿并经人工审批的工作流的 LinkedIn 收件箱管理功能。适用于监控 LinkedIn 消息、起草回复、非工作时段收件箱管理，或设置晨间 LinkedIn 活动摘要提醒。
description_zh: 支持定时扫描、按用户沟通风格自动生成回复草稿并经人工审批的工作流的 LinkedIn 收件箱管理功能。适用于监控 LinkedIn 消息、起草回复、非工作时段收件箱管理，或设置晨间 LinkedIn 活动摘要提醒。
---
# LinkedIn 收件箱管理器

具备人工审批环节的自动化 LinkedIn 收件箱监控系统。采用 Peekaboo 实现 UI 自动化（无 API 速率限制，兼容任意 LinkedIn 账户）。

## 前置要求

- macOS 系统，已安装 Peekaboo CLI（`brew install steipete/tap/peekaboo`）  
- 已授予屏幕录制与辅助功能权限  
- 浏览器（推荐 Chrome）已登录 LinkedIn  
- 已部署具备浏览器能力的 Clawdbot

## 快速入门

### 1. 一次性配置
```bash
# Grant Peekaboo permissions
peekaboo permissions

# Verify LinkedIn is accessible
peekaboo app launch "Google Chrome"
peekaboo see --app "Google Chrome" --annotate --path /tmp/linkedin-check.png
```

### 2. 配置用户沟通风格
在您的工作区中创建 `linkedin-inbox-config.json`：  
```json
{
  "scan": {
    "intervalMinutes": 60,
    "activeHours": { "start": 9, "end": 18, "timezone": "America/Los_Angeles" },
    "skipWeekends": true
  },
  "drafting": {
    "styleProfile": "USER.md",
    "templates": {
      "decline": "Thanks for reaching out. Not a fit for us right now, but best of luck.",
      "interested": "This looks interesting. Happy to chat more. What's your availability?",
      "referral": "I might know someone. Let me check and get back to you."
    }
  },
  "notifications": {
    "channel": "discord",
    "target": "#linkedin"
  }
}
```

### 3. 启动监控
向您的 agent 发送指令：“启动 LinkedIn 收件箱监控”，或在 HEARTBEAT.md 中添加：  
```markdown
- Check LinkedIn inbox if last scan >1 hour ago
```

## 核心工作流

### 扫描收件箱
```bash
# Navigate to LinkedIn messaging
peekaboo app launch "Google Chrome"
peekaboo menu click --app "Google Chrome" --item "New Tab"
peekaboo type "https://www.linkedin.com/messaging/" --return
sleep 3

# Capture inbox state
peekaboo see --app "Google Chrome" --window-title "Messaging" --annotate --path /tmp/linkedin-inbox.png
```

agent 通过解析带标注的截图识别以下内容：  
- 未读消息（加粗姓名、蓝色圆点）  
- 消息预览内容  
- 发送者姓名与职位

### 生成回复草稿
对每条未读消息：  
1. Agent 读取完整对话历史  
2. 分析意图（推销、人脉拓展、求职咨询、垃圾信息）  
3. 按用户沟通风格生成匹配的回复草稿  
4. 将草稿发布至通知渠道待审批  

示例通知：  
```
💼 LinkedIn: New message from **Alex M.** (Founder @ SomeCompany)

Preview: "Hi, I noticed you're growing and wondered if..."

**My read:** Services pitch. Doesn't fit current needs.

**Draft reply:**
> Thanks for reaching out. We're set on that side for now, but I'll keep you in mind if that changes.

React ✅ to send, ❌ to skip, or reply with edits.
```

### 发送已批准消息
收到批准后：  
```bash
# Click into conversation
peekaboo click --on [message-element-id] --app "Google Chrome"
sleep 1

# Type response
peekaboo type "Your approved message here" --app "Google Chrome"

# Send (Enter or click Send button)
peekaboo press return --app "Google Chrome"
```

## 沟通风格匹配机制

本 skill 读取 `USER.md`（或指定的风格配置文件），以精准复刻用户语气：

**需提取的信号包括：**  
- 正式程度（随意 vs 专业）  
- 典型问候方式  
- 结束语模式  
- 句子长度偏好  
- 禁用词汇/短语  
- 回复长度惯例  

**应用于草稿时：**  
- 复现已识别的模式  
- 使用用户惯用词汇  
- 匹配其直接程度  
- 遵守其设定的边界约束（例如禁用“excited”、禁用浮夸表述等）  

详见 `references/style-extraction.md` 获取完整指导。

## 晨间摘要集成

将 LinkedIn 活动摘要加入您的晨间提醒：  
```markdown
📣 The Morning Ping — Monday, Jan 27

**LinkedIn:**
• 💚 Sarah Chen replied — "That sounds great, let's do Thursday" → Draft ready
• 💚 Mike R. replied — "Not interested right now" → No action needed
• 📩 3 new connection requests (2 sales pitches, 1 relevant)
• 📩 1 unread message from Alex (job inquiry) → Draft ready

Reply "send sarah" to approve, "skip mike" to archive.
```

## 审批指令

用户可回复以下指令：  
- `send [name]` —— 发送已起草的回复  
- `send all` —— 发送所有待审批草稿  
- `skip [name]` —— 归档消息，不作回复  
- `edit [name]: [new message]` —— 替换草稿并发送  
- `show [name]` —— 展示完整对话内容

## 定时扫描机制

### 通过 Cron（推荐）  
```json
{
  "schedule": "0 */2 9-18 * * 1-5",
  "text": "Scan LinkedIn inbox and post any new messages to #linkedin with draft replies"
}
```

### 通过 Heartbeat  
在 HEARTBEAT.md 中配置：  
```markdown
- If 9am-6pm PT and last LinkedIn scan >60min: scan inbox, draft replies, post to #linkedin
```

## 安全规则

1. **未经明确批准不得发送**——必须始终等待用户确认  
2. **限制操作速率**——每小时最多执行 20 次 LinkedIn 操作  
3. **尊重静默时段**——不得在配置的 activeHours 范围外执行扫描  
4. **全程日志记录**——所有操作均需记入每日记忆文件  
5. **保留原始消息**——仅归档，绝不删除消息

## 故障排查

### “无法定位消息界面”
- 确保 Chrome 已打开且 LinkedIn 已登录  
- 检查窗口标题是否匹配（不同语言下可能有差异）  
- 使用 `peekaboo list windows --app "Google Chrome" --json` 进行调试

### “会话已过期”
- LinkedIn 会话会周期性失效  
- 请在浏览器中手动重新登录  
- 本 skill 将自动检测登录页面并向用户发出提示

### “Peekaboo 权限被拒绝”
```bash
peekaboo permissions  # Check status
# Grant via System Preferences > Privacy & Security > Screen Recording + Accessibility
```

## 相关文件

- `scripts/scan_inbox.sh` —— 用于收件箱截图捕获的 Peekaboo 命令  
- `scripts/send_message.sh` —— 用于发送消息的 Peekaboo 命令  
- `references/style-extraction.md` —— 沟通风格匹配操作指南
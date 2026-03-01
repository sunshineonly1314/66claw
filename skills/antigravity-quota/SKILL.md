---
name: antigravity-quota
name_zh: 反重力配额
version: 1.1.0
description: 检查 Antigravity 账户中 Claude 和 Gemini 模型的配额。显示剩余配额、重置时间，并支持封禁状态检测。
description_zh: 检查 Antigravity 账户中 Claude 和 Gemini 模型的配额。显示剩余配额、重置时间，并支持封禁状态检测。
metadata: {"clawdbot":{"emoji":"📊","requires":{"bins":["node"]}}}
---
# Antigravity Quota Skill

检查 Clawdbot 中已配置的所有 Antigravity 账户的配额状态。

## 前置条件

- 已配置 Antigravity 账户的 Clawdbot  
- 运行 `clawdbot configure` 以添加 Antigravity 账户

## 配额信息

- **Claude（Opus/Sonnet）** — 共享的 5 小时配额池  
- **Gemini Pro** — 独立的 5 小时配额  
- **Gemini Flash** — 独立的 5 小时配额  

每种模型类型的配额均按账户独立计算，每 5 小时重置一次。

## 使用方法

### 文本输出（默认）
```bash
node check-quota.js
```

### Markdown 表格（适用于 tablesnap）
```bash
node check-quota.js --table
node check-quota.js --table | tablesnap --theme light -o /tmp/quota.png
```

### JSON 输出
```bash
node check-quota.js --json
```

### 自定义时区
```bash
node check-quota.js --tz America/New_York
TZ=Europe/London node check-quota.js
```

## 输出格式

### 文本模式
```
📊 Antigravity Quota Check - 2026-01-08T07:08:29.268Z
⏰ Each model type resets every 5 hours
🌍 Times shown in: Asia/Kolkata

Found 9 account(s)

🔍 user@gmail.com (project-abc123)
   claude-opus-4-5-thinking: 65.3% (resets 1:48 PM)
   gemini-3-flash: 95.0% (resets 11:41 AM)
```

### 表格模式（`--table`）
按 Claude 剩余配额升序排列，并附带 emoji 指示符：  
- 🟢 剩余 ≥ 80%  
- 🟡 剩余 50–79%  
- 🟠 剩余 20–49%  
- 🔴 剩余 < 20%

## 与 tablesnap 集成

适用于不支持渲染 Markdown 表格的消息平台：  
```bash
node check-quota.js --table | tablesnap --theme light -o /tmp/quota.png
# Then send the image
```

需安装 `tablesnap` — 安装命令如下：  
```bash
go install github.com/joargp/tablesnap/cmd/tablesnap@latest
```
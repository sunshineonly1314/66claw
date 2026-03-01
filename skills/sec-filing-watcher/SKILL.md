---
name: sec-filing-watcher
name_zh: SEC 报告监控
description: 监控 SEC EDGAR 新增备案文件，并通过 Clawdbot 向 Telegram/Slack 发送摘要通知。适用于设置 SEC 备案提醒、增删待监控股票代码（ticker）、配置表单类型、启停监控服务，或排查备案通知问题等场景。
description_zh: 监控 SEC EDGAR 新增备案文件，并通过 Clawdbot 向 Telegram/Slack 发送摘要通知。适用于设置 SEC 备案提醒、增删待监控股票代码（ticker）、配置表单类型、启停监控服务，或排查备案通知问题等场景。
---
# SEC 备案监控器

监控 SEC EDGAR 上来自指定股票代码（ticker）清单的新备案文件。一旦发现新备案，即通知 Clawdbot 抓取、摘要并推送至 Telegram。

## 快速部署

### 1. 创建监控清单

```bash
cp assets/watchlist.example.json watchlist.json
# Edit watchlist.json with your tickers
```

### 2. 配置 Webhook

编辑 `scripts/watcher.js` 的 CONFIG 区域：
- `webhookUrl`：您的 Clawdbot Webhook URL（默认为 `http://localhost:18789/hooks/agent`）
- `webhookToken`：您的 Webhook Token（可在 clawdbot.json 中 `hooks.token` 字段下找到）

### 3. 测试运行

```bash
node scripts/watcher.js
```

首次运行将预填充（seed）现有备案（不触发通知）；第二次运行才检测新增备案。

### 4. 定时任务（每 15 分钟一次）

**macOS：**
```bash
cp assets/com.sec-watcher.plist ~/Library/LaunchAgents/
# Edit the plist to set correct paths
launchctl load ~/Library/LaunchAgents/com.sec-watcher.plist
```

**Linux：**
```bash
crontab -e
# Add: */15 * * * * /usr/bin/node /path/to/scripts/watcher.js >> /path/to/watcher.log 2>&1
```

## 管理股票代码（Ticker）

在 `watchlist.json` 中增删股票代码：

```json
{
  "tickers": ["AAPL", "MSFT", "TSLA"],
  "formTypes": ["10-K", "10-Q", "8-K", "4"]
}
```

新增股票代码将自动预填充（已存在备案不会向您发送垃圾通知）。

参见 `references/form-types.md` 了解常见 SEC 表单类型。

## 命令

**检查状态：**
```bash
launchctl list | grep sec-watcher
```

**查看日志：**
```bash
cat ~/clawd/sec-filing-watcher/watcher.log
```

**停止：**
```bash
launchctl unload ~/Library/LaunchAgents/com.sec-watcher.plist
```

**启动：**
```bash
launchctl load ~/Library/LaunchAgents/com.sec-watcher.plist
```

**手动运行：**
```bash
node scripts/watcher.js
```

## 文件说明

| 文件 | 用途 |
|------|------|
| `scripts/watcher.js` | 主监控脚本 |
| `watchlist.json` | 您的股票代码及表单类型配置 |
| `state.json` | 记录已处理备案（自动创建） |
| `watcher.log` | 输出日志（如已配置） |

## 故障排除

**无通知：**
- 检查 `state.json` 是否存在（首次运行仅预填充，第二次才发通知）
- 核实 watcher.js CONFIG 中的 Webhook URL 和 Token
- 检查 Clawdbot 是否正在运行：`clawdbot status`

**SEC 封禁请求：**
- 脚本已使用合规的 User-Agent 请求头
- 若被封禁，请等待 10 分钟（SEC 速率限制冷却期）

**重复通知：**
- 检查 `state.json` 是否损坏
- 删除 `state.json` 可重新预填充（将再次加载所有现有备案）
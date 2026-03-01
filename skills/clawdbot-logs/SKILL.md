---
name: clawdbot-logs
name_zh: ClawdBot日志
description: 分析 Clawdbot 日志与诊断信息。当用户询问机器人性能、响应时间、错误、会话统计、Token 使用量、API 成本，或希望调试响应缓慢问题时使用。
description_zh: 分析 Clawdbot 日志与诊断信息。当用户询问机器人性能、响应时间、错误、会话统计、Token 使用量、API 成本，或希望调试响应缓慢问题时使用。
---
# Clawdbot 日志与诊断

分析 Clawdbot 的性能表现、错误信息与会话数据。

## 快捷命令

### 响应时间（最近 N 条消息）
```bash
scripts/response-times.sh [count]
```

### 最近错误
```bash
journalctl --user -u clawdbot-gateway.service --no-pager --since "1 hour ago" | grep -iE "(error|fail|invalid)" | tail -20
```

### 会话统计
```bash
scripts/session-stats.sh
```

### 网关状态
```bash
systemctl --user status clawdbot-gateway.service --no-pager
```

### 配置校验
```bash
cat ~/.clawdbot/clawdbot.json | jq . > /dev/null && echo "Config valid" || echo "Config invalid"
```

## 日志来源

| 来源 | 位置 | 内容说明 |
|------|------|----------|
| Journal | `journalctl --user -u clawdbot-gateway.service` | 会话状态、错误、工具执行记录 |
| 每日日志 | `/tmp/clawdbot/clawdbot-YYYY-MM-DD.log` | 详细的 JSON 格式日志 |
| 会话文件 | `~/.clawdbot/agents/main/sessions/*.jsonl` | 完整对话、Token 使用量、API 成本 |
| 会话元数据 | `~/.clawdbot/agents/main/sessions/sessions.json` | 当前会话状态、模型信息 |

## 常见诊断场景

### 响应缓慢
1. 检查响应时间：`scripts/response-times.sh 20`  
2. 检查 sessions.json 中的 Token 数量：`jq '.["agent:main:main"].totalTokens' ~/.clawdbot/agents/main/sessions/sessions.json`  
3. 若 Token 数量 > 30000，请在 Telegram 中运行 `/compact`，或开启新会话  

### 配置错误
```bash
journalctl --user -u clawdbot-gateway.service --no-pager --since "10 minutes ago" | grep -i "invalid config"
```

### API 成本（来自会话文件）
```bash
scripts/session-stats.sh
```

## 实用模式

### 按类别过滤 Journal
```bash
# Session state changes
journalctl --user -u clawdbot-gateway.service | grep "session state"

# Tool execution
journalctl --user -u clawdbot-gateway.service | grep "\[tools\]"

# Telegram activity
journalctl --user -u clawdbot-gateway.service | grep "\[telegram\]"
```

### 解析会话文件以提取最近消息
```bash
tail -20 ~/.clawdbot/agents/main/sessions/*.jsonl | jq -r 'select(.message.role=="user") | .message.content[0].text' 2>/dev/null | tail -10
```
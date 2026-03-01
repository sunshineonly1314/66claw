---
name: claude-code-usage
name_zh: Claude代码使用
description: Check Claude Code OAuth usage limits (session & weekly quotas). Use when user asks about Claude Code usage, remaining limits, rate limits, or how much Claude usage they have left. Includes automated session refresh reminders and reset detection monitoring.
description_zh: Check Claude Code OAuth usage limits (session & weekly quotas). Use when user asks about Claude Code usage, remaining limits, rate limits, or how much Claude usage they have left. Includes automated session refresh reminders and reset detection monitoring.
metadata:
  clawdbot:
    emoji: "📊"
    os:
      - darwin
      - linux
    requires:
      bins:
        - curl
---
# Claude Code Usage

查询您的 Claude Code OAuth API 在会话（5 小时窗口）与周度（7 天窗口）两个维度的使用限额。

## 快速开始

```bash
cd {baseDir}
./scripts/claude-usage.sh
```

## 使用方式

```bash
# Default: show cached usage (if fresh)
./scripts/claude-usage.sh

# Force refresh from API
./scripts/claude-usage.sh --fresh

# JSON output
./scripts/claude-usage.sh --json

# Custom cache TTL
./scripts/claude-usage.sh --cache-ttl 300
```

## 输出格式

**文本格式**（默认）：
```
🦞 Claude Code Usage

⏱️  Session (5h): 🟢 ████░░░░░░ 40%
   Resets in: 2h 15m

📅 Weekly (7d): 🟡 ██████░░░░ 60%
   Resets in: 3d 8h
```

**JSON 格式**（启用 `--json` 参数）：
```json
{
  "session": {
    "utilization": 40,
    "resets_in": "2h 15m",
    "resets_at": "2026-01-19T22:15:00Z"
  },
  "weekly": {
    "utilization": 60,
    "resets_in": "3d 8h",
    "resets_at": "2026-01-22T04:00:00Z"
  },
  "cached_at": "2026-01-19T20:00:00Z"
}
```

## 功能特性

- 📊 **会话限额**（5 小时窗口）——短期速率限制
- 📅 **周度限额**（7 天窗口）——长期速率限制
- ⚡ **智能缓存**——60 秒缓存，避免 API 频繁调用
- 🎨 **美观输出**——含进度条、emoji 及颜色编码状态
- 🔄 **强制刷新**——使用 `--fresh` 标志可绕过缓存
- 📤 **JSON 输出**——机器可读格式
- 🔔 **自动化监控**——配额重置时自动通知

## 状态指示器

- 🟢 **绿色** —— 使用率 0–50%（健康）
- 🟡 **黄色** —— 使用率 51–80%（中等）
- 🔴 **红色** —— 使用率 81–100%（高/临界）

## 系统要求

- **macOS**：使用 Keychain 存取 Claude Code 凭据
- **Linux**：使用 `secret-tool` 存储凭据
- **凭据**：必须已完成 Claude Code CLI 认证

## 工作原理

1. 从系统密钥链中获取 OAuth token  
2. 使用 OAuth Bearer Token 向 `api.anthropic.com/api/oauth/usage` 发起查询  
3. 解析 `five_hour` 与 `seven_day` 的使用率指标  
4. 计算距下次重置的剩余时间  
5. 以进度条与状态指示器格式化输出  
6. 缓存结果 60 秒（可配置）

## 缓存机制

默认缓存：`/tmp/claude-usage-cache`（60 秒 TTL）

覆盖方式：
```bash
CACHE_FILE=/tmp/my-cache CACHE_TTL=300 ./scripts/claude-usage.sh
```

## 使用示例

**开工前检查使用情况：**  
```bash
./scripts/claude-usage.sh --fresh
```

**集成至状态栏：**  
```bash
usage=$(./scripts/claude-usage.sh | grep "Session" | awk '{print $NF}')
echo "Session: $usage"
```

**获取 JSON 格式用于监控：**  
```bash
./scripts/claude-usage.sh --json | jq '.session.utilization'
```

## 自动化监控

### 会话刷新提醒（推荐）

在您的 5 小时会话配额重置的**精确时刻**收到通知！

**快速配置：**  
```bash
./scripts/session-reminder.sh
```

此操作将创建一个 **自调度 cron 任务链**，其行为如下：
1. 查询当前会话到期时间  
2. 为会话重置时刻安排下一次一次性提醒  
3. 提供当前使用统计通知  
4. 自动移除自身（由新生成的 cron 接管）

**您将获得：**  
```
🔄 Claude Code Session Status

⏱️  Current usage: 44%
⏰ Next refresh: 2h 15m

Your 5-hour quota will reset soon! 🦞

✅ Next reminder scheduled for: Jan 22 at 01:22 AM
```

**工作原理：**  
- 每次提醒均执行 `claude-usage.sh`，以精确定位会话重置时间  
- 为该确切时刻设置一次性 cron 任务  
- 每 5 小时自动重复  
- 若会话时间发生偏移，可自我校正  

**优势：**  
- ✅ 精确到分钟级  
- ✅ 无需手动调度  
- ✅ 自适应您的实际使用模式  
- ✅ API 调用极少（仅按需触发）

### 重置检测监控（替代方案）

通过轮询使用情况，在 Claude Code 配额重置时自动发送通知。

**快速配置：**  
```bash
# Test once
./scripts/monitor-usage.sh

# Setup automated monitoring (runs every 30 minutes)
./scripts/setup-monitoring.sh
```

或直接通过 Clawdbot 添加：  
```bash
# Check every 30 minutes
clawdbot cron add --cron "*/30 * * * *" \
  --message "cd /Users/ali/clawd/skills/claude-code-usage && ./scripts/monitor-usage.sh" \
  --name "Claude Code Usage Monitor" \
  --session isolated --deliver --channel telegram
```

**您将获得：**  
```
🎉 Claude Code Session Reset!

⏱️  Your 5-hour quota has reset
📊 Usage: 2%
⏰ Next reset: 4h 58m

Fresh usage available! 🦞
```

**工作原理：**  
1. **每 30 分钟轮询一次使用情况**（可配置）  
2. **检测重置事件**：当使用率显著下降（>10% 或 <5%）时判定为重置  
3. **重置发生时**，通过 Telegram 发送通知  
4. **状态跟踪**保存于 `/tmp/claude-usage-state.json`  

**自定义选项：**  
```bash
# Change check interval
clawdbot cron add --cron "*/15 * * * *" ...  # Every 15 minutes
clawdbot cron add --cron "0 * * * *" ...      # Every hour

# Custom state file location
STATE_FILE=/path/to/state.json ./scripts/monitor-usage.sh
```

### 两种监控方式对比？

| 特性 | 会话提醒 | 重置检测 |
|------|----------|----------|
| 精确度 | ✅ 精确到分钟 | ~30 分钟窗口 |
| API 调用次数 | 极少 | 每次轮询均调用 |
| 通知时机 | 重置发生瞬间 | 最多延迟 30 分钟 |
| 配置难度 | 一条命令 | 一条命令 |
| 维护成本 | 自调度 | cron 永久运行 |

**建议**：如需精准、实时的通知，请选用 **会话提醒** 方式。

## 故障排查

**未找到凭据：**  
- 确保已安装并认证 Claude Code CLI  
- 运行 `claude` 一次以触发 OAuth 流程  

**API 请求失败：**  
- 检查网络连接  
- 确认 OAuth token 尚未过期  
- 尝试运行 `--fresh` 强制发起新请求  

**Linux 用户注意：**  
请安装 `libsecret` 以支持凭据存储：  
```bash
# Debian/Ubuntu
sudo apt install libsecret-tools

# Fedora/RHEL
sudo dnf install libsecret
```
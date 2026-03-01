---
name: timer
name_zh: 定时器
description: 设置计时器与闹钟。后台计时器完成后，您将收到一条系统通知——请以提醒消息（而非 HEARTBEAT_OK）响应，以通知用户。
description_zh: 设置计时器与闹钟。后台计时器完成后，您将收到一条系统通知——请以提醒消息（而非 HEARTBEAT_OK）响应，以通知用户。
metadata: {"clawdbot":{"emoji":"⏱️","requires":{"bins":["node"]}}}
---
# 计时器

设置在后台运行的计时器。计时器完成后，您将收到一条系统通知，并**必须**以提醒消息响应，以通知用户。

## 快速开始

```bash
# Set a 5-minute timer
bash background:true command:"node {baseDir}/timer.js 5m"

# Set a timer with a label
bash background:true command:"node {baseDir}/timer.js 10m 'Check the oven'"

# Set a timer in seconds
bash background:true command:"node {baseDir}/timer.js 30s"

# Set a timer in hours
bash background:true command:"node {baseDir}/timer.js 1h"
```

## 时间格式

| 格式 | 描述 | 示例 |
|--------|-------------|---------|
| `Ns` | N 秒 | `30s`, `90s` |
| `Nm` | N 分钟 | `5m`, `15m` |
| `Nh` | N 小时 | `1h`, `2h` |
| `N` | N 分钟（默认） | `5` = 5 分钟 |
| `MM:SS` | 分钟与秒 | `5:30` |
| `HH:MM:SS` | 小时、分钟、秒 | `1:30:00` |

## ⚠️ 关键提醒：计时器完成通知

当计时器完成时，您将收到一条形如 `System:` 的消息：  
```
System: [2026-01-24 21:27:13] Exec completed (swift-me, code 0) :: ⏰ Timer complete! Check the pasta!
```

### ❌ 错误响应 —— 切勿如此响应：
```
HEARTBEAT_OK

🎉 Your timer is complete! Check the pasta!
```  
该响应将被**过滤，且不会送达用户！**

### ✅ 正确响应 —— 应如下响应：
```
⏰ Timer Alert! Your timer is complete: Check the pasta!
```  
请直接以通知消息开头。**切勿包含 HEARTBEAT_OK。**

**原因？** 所有以 `HEARTBEAT_OK` 开头且总长度少于 300 字符的响应，均会被自动屏蔽，永不送达用户。您的计时器提醒将因此丢失！

## 示例

### 烹饪计时器  
```bash
bash background:true command:"node {baseDir}/timer.js 12m 'Pasta is ready!'"
```  
完成时响应：“⏰ 您的 12 分钟计时器已结束！意面已煮好！”

### 快速提醒  
```bash
bash background:true command:"node {baseDir}/timer.js 2m 'Take a break'"
```

### 番茄工作法时段  
```bash
# Work session
bash background:true command:"node {baseDir}/timer.js 25m 'Pomodoro done - time for a break!'"
# After user is notified...
# Break
bash background:true command:"node {baseDir}/timer.js 5m 'Break over - back to work!'"
```

### 多个计时器  
```bash
bash background:true command:"node {baseDir}/timer.js 5m 'Tea is ready'"
bash background:true command:"node {baseDir}/timer.js 10m 'Eggs are done'"
bash background:true command:"node {baseDir}/timer.js 30m 'Meeting starts soon'"
```

## 计时器管理  

```bash
# List all running timers
process action:list

# Check specific timer status
process action:poll sessionId:XXX

# View timer output
process action:log sessionId:XXX

# Cancel a timer
process action:kill sessionId:XXX
```

## 注意事项  

- 计时器作为后台进程运行，每个进程拥有唯一 sessionId  
- 完成的计时器以退出码 0 结束  
- 被取消的计时器（通过 kill 命令）以退出码 130 结束  
- 在 macOS 上，计时器完成时将播放声音提示（前提是 `afplay` 可用）  
- 进度每秒记录一次（短时计时器）或每 10 秒记录一次（长时计时器）  
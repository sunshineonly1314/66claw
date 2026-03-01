---
name: gotify
name_zh: Gotify
description: 当长时间运行的任务完成或发生重要事件时，通过 Gotify 发送推送通知。当用户提出“发送 Gotify 通知”、“任务完成后通知我”、“推送通知”、“通过 Gotify 提醒我”或希望获知任务完成状态时启用本 skill。
description_zh: 当长时间运行的任务完成或发生重要事件时，通过 Gotify 发送推送通知。当用户提出“发送 Gotify 通知”、“任务完成后通知我”、“推送通知”、“通过 Gotify 提醒我”或希望获知任务完成状态时启用本 skill。
version: 1.0.1
metadata:
  clawdbot:
    emoji: "🔔"
    requires:
      bins: ["curl", "jq"]
---
# Gotify 通知 skill

当长时间运行的任务完成或发生重要事件时，向您的 Gotify 服务器发送推送通知。

## 用途

本 skill 使 Clawdbot 能够通过 Gotify 发送推送通知，适用于以下场景：  
- 长时间运行任务完成时发出提醒  
- 后台操作的状态更新  
- 重要事件或错误通知  
- 与任务完成钩子（hook）集成  

## 设置

创建凭据文件：`~/.clawdbot/credentials/gotify/config.json`

```json
{
  "url": "https://gotify.example.com",
  "token": "YOUR_APP_TOKEN"
}
```

- `url`：您的 Gotify 服务器 URL（末尾不要加斜杠）  
- `token`：来自 Gotify 的应用令牌（设置 → 应用 → 创建应用）

## 使用方法

### 基础通知

```bash
bash scripts/send.sh "Task completed successfully"
```

### 带标题的通知

```bash
bash scripts/send.sh --title "Build Complete" --message "skill-sync tests passed"
```

### 带优先级（0–10）的通知

```bash
bash scripts/send.sh -t "Critical Alert" -m "Service down" -p 10
```

### Markdown 支持

```bash
bash scripts/send.sh --title "Deploy Summary" --markdown --message "
## Deployment Complete

- **Status**: ✅ Success
- **Duration**: 2m 34s
- **Commits**: 5 new
"
```

## 与任务完成集成

### 方式一：任务执行后直接调用

```bash
# Run long task
./deploy.sh && bash ~/clawd/skills/gotify/scripts/send.sh "Deploy finished"
```

### 方式二：钩子集成（未来支持）

当 Clawdbot 支持任务完成钩子（task completion hooks）后，本 skill 可自动触发：

```bash
# Example hook configuration (conceptual)
{
  "on": "task_complete",
  "run": "bash ~/clawd/skills/gotify/scripts/send.sh 'Task: {{task_name}} completed in {{duration}}'"
}
```

## 参数说明

- `-m, --message <text>`：通知消息（必需）  
- `-t, --title <text>`：通知标题（可选）  
- `-p, --priority <0-10>`：优先级（默认为 5）  
  - 0–3：低优先级  
  - 4–7：普通优先级  
  - 8–10：高优先级（可能触发声音/震动）  
- `--markdown`：在消息中启用 Markdown 格式化  

## 示例

### 通知 subagent 执行完成

```bash
# After spawning subagent
sessions_spawn --task "Research topic" --label my-research
# ... wait for completion ...
bash scripts/send.sh -t "Research Complete" -m "Check session: my-research"
```

### 高优先级错误通知

```bash
if ! ./critical-task.sh; then
  bash scripts/send.sh -t "⚠️ Critical Failure" -m "Task failed, check logs" -p 10
fi
```

### 富格式 Markdown 通知

```bash
bash scripts/send.sh --markdown -t "Daily Summary" -m "
# System Status

## ✅ Healthy
- UniFi: 34 clients
- Sonarr: 1,175 shows
- Radarr: 2,551 movies

## 📊 Stats
- Uptime: 621h
- Network: All OK
"
```

## 工作流程

当用户说：  
- **“任务完成后通知我”** → 在其命令中添加 `&& bash scripts/send.sh "Task complete"`  
- **“发送 Gotify 提醒”** → 运行 `bash scripts/send.sh` 并传入其消息内容  
- **“为任务完成推送通知”** → 在其工作流中集成本 skill，并指定合适的标题与优先级  

始终确认通知已成功发送（检查返回的 JSON 响应中是否包含 message ID）。

## 注意事项

- 需确保网络可访问您的 Gotify 服务器  
- 应用令牌必须具备“create message”（创建消息）权限  
- 优先级会影响客户端设备上的通知行为  
- Markdown 支持取决于 Gotify 客户端版本（大多数现代客户端均支持）

## 参考资料

- Gotify API 文档：https://gotify.net/docs/  
- Gotify Android/iOS 客户端（用于接收通知）
---
name: ticktick
name_zh: TickTick
description: 通过命令行管理 TickTick 任务与项目，支持 OAuth2 认证、批量操作及速率限制处理。
description_zh: 通过命令行管理 TickTick 任务与项目，支持 OAuth2 认证、批量操作及速率限制处理。
---
# TickTick 命令行工具技能

通过命令行管理 TickTick 任务与项目。

## 设置

### 1. 注册 TickTick 开发者应用

1. 访问 [TickTick 开发者中心](https://developer.ticktick.com/manage)  
2. 创建一个新应用  
3. 将重定向 URI（Redirect URI）设为 `http://localhost:8080`  
4. 记下您的 `Client ID` 和 `Client Secret`  

### 2. 认证

```bash
# Set credentials and start OAuth flow
bun run scripts/ticktick.ts auth --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET

# Check authentication status
bun run scripts/ticktick.ts auth --status

# Logout (clear tokens, keep credentials)
bun run scripts/ticktick.ts auth --logout
```

### 无头模式 / 手动认证

```bash
# Use manual mode on headless servers
bun run scripts/ticktick.ts auth --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET --manual
```

该命令将输出一个授权 URL。请在浏览器中打开它，批准访问权限，然后复制完整的重定向 URL（格式类似 `http://localhost:8080/?code=XXXXX&state=STATE`），并将其粘贴回命令行界面。

命令行工具将自动在浏览器中打开授权页面。批准后，令牌将保存至 `~/.clawdbot/credentials/ticktick-cli/config.json`。

## 命令

### 列出任务

```bash
# List all tasks
bun run scripts/ticktick.ts tasks

# List tasks from a specific project
bun run scripts/ticktick.ts tasks --list "Work"

# Filter by status
bun run scripts/ticktick.ts tasks --status pending
bun run scripts/ticktick.ts tasks --status completed

# JSON output
bun run scripts/ticktick.ts tasks --json
```

### 创建任务

```bash
# Basic task creation
bun run scripts/ticktick.ts task "Buy groceries" --list "Personal"

# With description and priority
bun run scripts/ticktick.ts task "Review PR" --list "Work" --content "Check the new auth changes" --priority high

# With due date
bun run scripts/ticktick.ts task "Submit report" --list "Work" --due tomorrow
bun run scripts/ticktick.ts task "Plan vacation" --list "Personal" --due "in 7 days"
bun run scripts/ticktick.ts task "Meeting" --list "Work" --due "2024-12-25"

# With tags
bun run scripts/ticktick.ts task "Research" --list "Work" --tag research important
```

### 更新任务

```bash
# Update by task name or ID
bun run scripts/ticktick.ts task "Buy groceries" --update --priority medium
bun run scripts/ticktick.ts task "abc123" --update --due tomorrow --content "Updated notes"

# Limit search to specific project
bun run scripts/ticktick.ts task "Review PR" --update --list "Work" --priority low
```

### 完成任务

```bash
# Mark task as complete
bun run scripts/ticktick.ts complete "Buy groceries"

# Complete with project filter
bun run scripts/ticktick.ts complete "Review PR" --list "Work"
```

### 放弃任务（“不做了”）

```bash
# Mark task as won't do
bun run scripts/ticktick.ts abandon "Old task"

# Abandon with project filter
bun run scripts/ticktick.ts abandon "Obsolete item" --list "Do"
```

### 批量放弃任务（多个任务）

```bash
# Abandon multiple tasks in a single API call
bun run scripts/ticktick.ts batch-abandon <taskId1> <taskId2> <taskId3>

# With JSON output
bun run scripts/ticktick.ts batch-abandon abc123def456... xyz789... --json
```

注意：`batch-abandon` 需要传入任务 ID（24 位十六进制字符串），而非任务名称。请先使用 `tasks --json` 获取任务 ID。

### 列出项目

```bash
# List all projects
bun run scripts/ticktick.ts lists

# JSON output
bun run scripts/ticktick.ts lists --json
```

### 创建项目

```bash
# Create new project
bun run scripts/ticktick.ts list "New Project"

# With color
bun run scripts/ticktick.ts list "Work Tasks" --color "#FF5733"
```

### 更新项目

```bash
# Rename project
bun run scripts/ticktick.ts list "Old Name" --update --name "New Name"

# Change color
bun run scripts/ticktick.ts list "Work" --update --color "#00FF00"
```

## 选项参考

### 优先级等级
- `none` — 无优先级（默认）  
- `low` — 低优先级  
- `medium` — 中优先级  
- `high` — 高优先级  

### 截止日期格式
- `today` — 今日截止  
- `tomorrow` — 明日截止  
- `in N days` — N 天后截止（例如：“3 天后”）  
- `next monday` — 下一次指定工作日  
- ISO 日期格式 — `YYYY-MM-DD` 或完整 ISO 格式  

### 全局选项
- `--json` — 以 JSON 格式输出结果（适用于脚本调用）  
- `--help` — 显示任意命令的帮助信息  

## Agent 使用提示

当将此技能作为 AI agent 使用时：

1. **始终使用 `--json` 标志**，以获取机器可读的输出  
2. **首先运行 `lists --json` 列出项目**，以获取有效的项目 ID  
3. **尽可能使用项目 ID 而非项目名称**，以确保可靠性  
4. **完成任务前务必检查任务状态**，避免报错  

示例 agent 工作流：  
```bash
# 1. Get available projects
bun run scripts/ticktick.ts lists --json

# 2. Create a task in a specific project
bun run scripts/ticktick.ts task "Agent task" --list "PROJECT_ID" --priority high --json

# 3. Later, mark it complete
bun run scripts/ticktick.ts complete "Agent task" --list "PROJECT_ID" --json
```

## 配置

令牌保存于 `~/.clawdbot/credentials/ticktick-cli/config.json`：  
```json
{
  "clientId": "YOUR_CLIENT_ID",
  "clientSecret": "YOUR_CLIENT_SECRET",
  "accessToken": "...",
  "refreshToken": "...",
  "tokenExpiry": 1234567890000,
  "redirectUri": "http://localhost:8080"
}
```

注意：凭据以明文形式存储。命令行工具会尝试将文件权限设为 700/600；请将该文件视为敏感信息。

当令牌过期时，命令行工具将自动刷新令牌。

## 故障排查

### “未认证”错误  
运行 `bun run scripts/ticktick.ts auth` 进行认证。

### “项目未找到”错误  
运行 `bun run scripts/ticktick.ts lists` 查看可用项目及其 ID。

### “任务未找到”错误  
- 检查任务标题是否完全匹配（不区分大小写）  
- 尝试改用任务 ID  
- 使用 `--list` 将搜索范围限定在特定项目内  

### 令牌过期错误  
命令行工具应能自动刷新令牌。若问题持续存在，请再次运行 `bun run scripts/ticktick.ts auth`。

## API 说明

本命令行工具使用 [TickTick 开放 API v1](https://developer.ticktick.com/api)。

### 速率限制
- **每分钟最多 100 次请求**  
- **每 5 分钟最多 300 次请求**  

由于每个操作（如列出项目以查找任务）可能触发多次 API 调用，批量操作极易快速触达限制。

### 批量端点  
命令行工具支持 TickTick 的批量端点以执行批量操作：  
```
POST https://api.ticktick.com/open/v1/batch/task
{
  "add": [...],    // CreateTaskInput[]
  "update": [...], // UpdateTaskInput[]
  "delete": [...]  // { taskId, projectId }[]
}
```  
使用 `batch-abandon` 可在单次 API 调用中放弃多个任务。该批量 API 方法亦对外暴露，供程序化调用。

### 其他限制  
- 每个项目最多支持 500 个任务  
- 某些高级功能（如专注时间、习惯追踪）暂未被 API 支持  
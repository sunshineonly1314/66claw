---
name: claude-team
name_zh: Claude团队
description: 通过 iTerm2 和 claude-team MCP 服务器编排多个 Claude Code worker。使用 git worktree 启动 worker，分配 beads 问题，监控进度，并协调并行开发工作。
description_zh: 通过 iTerm2 和 claude-team MCP 服务器编排多个 Claude Code worker。使用 git worktree 启动 worker，分配 beads 问题，监控进度，并协调并行开发工作。
homepage: https://github.com/Martian-Engineering/claude-team
metadata: {"clawdbot":{"emoji":"👥","os":["darwin"],"requires":{"bins":["mcporter"]}}}
---
# Claude Team

Claude-team 是一个 MCP 服务器，支持您通过 iTerm2 启动并管理一组 Claude Code 会话。每个 worker 拥有独立的终端窗格、可选的 git worktree，并可被分配 beads 问题。

## 为何使用 Claude Team？

- **并行性**：将任务分发给多个 agent 同时执行  
- **上下文隔离**：每个 worker 拥有全新上下文，确保 coordinator 上下文保持干净  
- **可见性**：真实运行的 Claude Code 会话，可实时观察、中断或接管  
- **Git worktrees**：每个 worker 可拥有独立分支以开展其工作  

## ⚠️ 重要规则

**切勿直接修改代码。** 所有代码变更必须通过启动 worker 完成。此举可保持您的上下文整洁，并借助 worktree 实现规范的 git 工作流。

## 前置条件

- macOS 系统，已安装 iTerm2（需启用 Python API：Preferences → General → Magic → Enable Python API）  
- 已在 `~/.claude.json` 中配置 claude-team MCP 服务器  

## 通过 mcporter 使用

所有工具均通过 `mcporter call claude-team.<tool>` 调用：

```bash
mcporter call claude-team.list_workers
mcporter call claude-team.spawn_workers workers='[{"project_path":"/path/to/repo","bead":"cp-123"}]'
```

## 核心工具

### spawn_workers

创建新的 Claude Code worker 会话。

```bash
mcporter call claude-team.spawn_workers \
  workers='[{
    "project_path": "/path/to/repo",
    "bead": "cp-123",
    "annotation": "Fix auth bug",
    "use_worktree": true,
    "skip_permissions": true
  }]' \
  layout="auto"
```

**Worker 配置字段：**  
- `project_path`：必需。仓库路径，或设为 `"auto"`（将使用 CLAUDE_TEAM_PROJECT_DIR）  
- `bead`：可选的 beads 问题 ID —— worker 将遵循 beads 工作流  
- `annotation`：任务描述（显示于徽章上，并用于生成分支名）  
- `prompt`：附加指令（若未指定 bead，则此字段即为其任务指派内容）  
- `use_worktree`：是否创建隔离的 git worktree（默认值：true）  
- `skip_permissions`：是否以 `--dangerously-skip-permissions` 启动（默认值：false）  
- `name`：可选的 worker 名称覆写（否则将从主题化名称集中自动选取）

**布局选项：**  
- `"auto"`：复用现有 claude-team 窗口，并在可用空间内分割  
- `"new"`：始终新建窗口（1–4 个 worker 以网格布局排列）

### list_workers

查看所有受管 worker：

```bash
mcporter call claude-team.list_workers
mcporter call claude-team.list_workers status_filter="ready"
```

状态值：`spawning`、`ready`、`busy`、`closed`

### message_workers

向一个或多个 worker 发送消息：

```bash
mcporter call claude-team.message_workers \
  session_ids='["Groucho"]' \
  message="Please also add unit tests" \
  wait_mode="none"
```

**wait_mode 选项：**  
- `"none"`：发送即忘（默认）  
- `"any"`：任一 worker 进入空闲状态时返回  
- `"all"`：全部 worker 均进入空闲状态时返回  

### check_idle_workers / wait_idle_workers

检查或等待 worker 完成任务：

```bash
# Quick poll
mcporter call claude-team.check_idle_workers session_ids='["Groucho","Harpo"]'

# Blocking wait
mcporter call claude-team.wait_idle_workers \
  session_ids='["Groucho","Harpo"]' \
  mode="all" \
  timeout=600
```

### read_worker_logs

获取对话历史记录：

```bash
mcporter call claude-team.read_worker_logs \
  session_id="Groucho" \
  pages=2
```

### examine_worker

获取详细状态（含对话统计信息）：

```bash
mcporter call claude-team.examine_worker session_id="Groucho"
```

### close_workers

任务完成后终止 worker：

```bash
mcporter call claude-team.close_workers session_ids='["Groucho","Harpo"]'
```

⚠️ **worktree 清理**：启用 worktree 的 worker 会提交至临时分支。关闭后请执行以下步骤：  
1. 审阅该 worker 分支上的提交  
2. 将提交合并（merge）或拣选（cherry-pick）至持久化分支  
3. 删除该分支：`git branch -D <branch-name>`  

### bd_help

beads 命令速查参考：

```bash
mcporter call claude-team.bd_help
```

## Worker 标识方式

Worker 可通过以下任一方式引用：  
- **内部 ID**：短十六进制字符串（例如 `3962c5c4`）  
- **终端 ID**：`iterm:UUID` 格式  
- **worker 名称**：人类可读名称（例如 `Groucho`、`Aragorn`）  

## 工作流：分配一个 beads 问题

```bash
# 1. Spawn worker with a bead assignment
mcporter call claude-team.spawn_workers \
  workers='[{
    "project_path": "/Users/phaedrus/Projects/myrepo",
    "bead": "proj-abc",
    "annotation": "Implement config schemas",
    "use_worktree": true,
    "skip_permissions": true
  }]'

# 2. Worker automatically:
#    - Creates worktree with branch named after bead
#    - Runs `bd show proj-abc` to understand the task
#    - Marks issue in_progress
#    - Implements the work
#    - Closes the issue
#    - Commits with issue reference

# 3. Monitor progress
mcporter call claude-team.check_idle_workers session_ids='["Groucho"]'
mcporter call claude-team.read_worker_logs session_id="Groucho"

# 4. When done, close and merge
mcporter call claude-team.close_workers session_ids='["Groucho"]'
# Then: git merge or cherry-pick from worker's branch
```

## 工作流：并行分发（Fan-Out）

```bash
# Spawn multiple workers for parallel tasks
mcporter call claude-team.spawn_workers \
  workers='[
    {"project_path": "auto", "bead": "cp-123", "annotation": "Auth module"},
    {"project_path": "auto", "bead": "cp-124", "annotation": "API routes"},
    {"project_path": "auto", "bead": "cp-125", "annotation": "Unit tests"}
  ]' \
  layout="new"

# Wait for all to complete
mcporter call claude-team.wait_idle_workers \
  session_ids='["Groucho","Harpo","Chico"]' \
  mode="all"

# Review and close
mcporter call claude-team.close_workers \
  session_ids='["Groucho","Harpo","Chico"]'
```

## 最佳实践

1. **使用 beads**：分配 `bead` ID，使 worker 遵循标准 issue 工作流  
2. **使用 worktrees**：保障工作隔离，支持并行提交  
3. **跳过权限检查**：worker 需要 `skip_permissions: true` 权限以写入文件  
4. **监控而非微观管理**：让 worker 自主完成任务，之后统一审阅  
5. **谨慎合并**：将 worker 分支合并至 main 前务必先行审阅  
6. **及时关闭 worker**：任务结束后始终调用关闭操作，以清理 worktree  

## HTTP 模式（可流式传输的 HTTP 传输）

为实现长期运行的服务器部署，claude-team 可作为 HTTP 服务器运行。该模式使 MCP 服务器持续运行并维持持久化状态，避免冷启动。

### 启动 HTTP 服务器

直接运行 claude-team HTTP 服务器：

```bash
# From the claude-team directory
uv run python -m claude_team_mcp --http --port 8766

# Or specify the directory explicitly
uv run --directory /path/to/claude-team python -m claude_team_mcp --http --port 8766
```

如需登录时自动启动，请使用 launchd（参见下方“launchd 自动启动”章节）。

### mcporter.json 配置

HTTP 服务器启动后，需配置 mcporter 与其连接。创建 `~/.mcporter/mcporter.json`：

```json
{
  "mcpServers": {
    "claude-team": {
      "transport": "streamable-http",
      "url": "http://127.0.0.1:8766/mcp",
      "lifecycle": "keep-alive"
    }
  }
}
```

### HTTP 模式优势

- **持久化状态**：worker 注册表在 CLI 多次调用间保持存活  
- **响应更快**：每次调用无需重新启动 Python 环境  
- **外部访问能力**：可通过 cron 作业、脚本或其他工具访问  
- **会话恢复能力**：即使 coordinator 断开连接，服务器仍持续跟踪会话  

### 从 Claude Code 连接

更新您的 `.mcp.json` 以启用 HTTP 传输：

```json
{
  "mcpServers": {
    "claude-team": {
      "transport": "streamable-http",
      "url": "http://127.0.0.1:8766/mcp"
    }
  }
}
```

## launchd 自动启动

为实现在登录时自动启动 claude-team 服务器，请使用配套的安装脚本。

### 快速设置

从 skill 的 assets 目录运行安装脚本：

```bash
# From the skill directory
./assets/setup.sh

# Or specify a custom claude-team location
CLAUDE_TEAM_DIR=/path/to/claude-team ./assets/setup.sh
```

### 安装脚本执行内容

该脚本将：  
1. 探测您的 `uv` 安装路径  
2. 在 `~/.claude-team/logs/` 创建日志目录  
3. 基于 `assets/com.claude-team.plist.template` 生成 launchd plist 文件  
4. 将其安装至 `~/Library/LaunchAgents/com.claude-team.plist`  
5. 加载服务并立即启动  

plist 模板使用 `uv run` 在端口 8766 启动 HTTP 服务器，并针对 iTerm2 Python API 访问（Aqua 会话类型）完成配置。

### 服务管理

```bash
# Stop the service
launchctl unload ~/Library/LaunchAgents/com.claude-team.plist

# Restart (re-run setup)
./assets/setup.sh

# Check if running
launchctl list | grep claude-team

# View logs
tail -f ~/.claude-team/logs/stdout.log
tail -f ~/.claude-team/logs/stderr.log
```

### launchd 故障排查

```bash
# Check for load errors
launchctl print gui/$UID/com.claude-team

# Force restart
launchctl kickstart -k gui/$UID/com.claude-team

# Remove and reload (if plist changed)
launchctl bootout gui/$UID/com.claude-team
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.claude-team.plist
```

## Cron 集成

为实现后台监控与通知，claude-team 支持基于 cron 的 worker 跟踪。

### Worker 状态文件

claude-team 将 worker 状态写入 `~/.claude-team/memory/worker-tracking.json`：

```json
{
  "workers": {
    "Groucho": {
      "session_id": "3962c5c4",
      "bead": "cp-123",
      "annotation": "Fix auth bug",
      "status": "busy",
      "project_path": "/Users/phaedrus/Projects/myrepo",
      "started_at": "2025-01-05T10:30:00Z",
      "last_activity": "2025-01-05T11:45:00Z"
    },
    "Harpo": {
      "session_id": "a1b2c3d4",
      "bead": "cp-124",
      "annotation": "Add API routes",
      "status": "idle",
      "project_path": "/Users/phaedrus/Projects/myrepo",
      "started_at": "2025-01-05T10:30:00Z",
      "last_activity": "2025-01-05T11:50:00Z",
      "completed_at": "2025-01-05T11:50:00Z"
    }
  },
  "last_updated": "2025-01-05T11:50:00Z"
}
```

### 监控完成状态的 Cron 作业

在 `~/.claude-team/scripts/check-workers.sh` 创建监控脚本：

```bash
#!/bin/bash
# Check for completed workers and send notifications

TRACKING_FILE="$HOME/.claude-team/memory/worker-tracking.json"
NOTIFIED_FILE="$HOME/.claude-team/memory/notified-workers.json"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID}"

# Exit if tracking file doesn't exist
[ -f "$TRACKING_FILE" ] || exit 0

# Initialize notified file if needed
[ -f "$NOTIFIED_FILE" ] || echo '{"notified":[]}' > "$NOTIFIED_FILE"

# Find idle workers that haven't been notified
IDLE_WORKERS=$(jq -r '
  .workers | to_entries[] |
  select(.value.status == "idle") |
  .key
' "$TRACKING_FILE")

for worker in $IDLE_WORKERS; do
  # Check if already notified
  ALREADY_NOTIFIED=$(jq -r --arg w "$worker" '.notified | index($w) != null' "$NOTIFIED_FILE")

  if [ "$ALREADY_NOTIFIED" = "false" ]; then
    # Get worker details
    BEAD=$(jq -r --arg w "$worker" '.workers[$w].bead // "no-bead"' "$TRACKING_FILE")
    ANNOTATION=$(jq -r --arg w "$worker" '.workers[$w].annotation // "no annotation"' "$TRACKING_FILE")

    # Send Telegram notification
    MESSAGE="🤖 Worker *${worker}* completed
📋 Bead: \`${BEAD}\`
📝 ${ANNOTATION}"

    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d chat_id="$TELEGRAM_CHAT_ID" \
      -d text="$MESSAGE" \
      -d parse_mode="Markdown" > /dev/null

    # Mark as notified
    jq --arg w "$worker" '.notified += [$w]' "$NOTIFIED_FILE" > "${NOTIFIED_FILE}.tmp"
    mv "${NOTIFIED_FILE}.tmp" "$NOTIFIED_FILE"
  fi
done
```

赋予其可执行权限：

```bash
chmod +x ~/.claude-team/scripts/check-workers.sh
```

### Crontab 条目

添加至 crontab（`crontab -e`）：

```cron
# Check claude-team workers every 2 minutes
*/2 * * * * TELEGRAM_BOT_TOKEN="your-bot-token" TELEGRAM_CHAT_ID="your-chat-id" ~/.claude-team/scripts/check-workers.sh
```

### 环境配置

在您的 shell 配置文件（`~/.zshrc`）中设置 Telegram 凭据：

```bash
export TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
export TELEGRAM_CHAT_ID="-1001234567890"
```

### 替代方案：使用 clawdbot 发送通知

若您已配置 clawdbot，亦可通过它发送通知：

```bash
# In check-workers.sh, replace the curl command with:
clawdbot send --to "$TELEGRAM_CHAT_ID" --message "$MESSAGE" --provider telegram
```

### 清除通知状态

启动一批新 worker 前，请清空已通知列表：

```bash
echo '{"notified":[]}' > ~/.claude-team/memory/notified-workers.json
```
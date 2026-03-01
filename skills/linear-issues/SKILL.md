---
name: linear-issues
name_zh: Linear 问题管理
description: 与 Linear 交互以进行 issue 跟踪。适用于创建、更新、列出或搜索 issue 的场景。支持查看已分配的 issue、更改状态、添加评论以及管理任务。
description_zh: 与 Linear 交互以进行 issue 跟踪。适用于创建、更新、列出或搜索 issue 的场景。支持查看已分配的 issue、更改状态、添加评论以及管理任务。
---
# Linear

通过 `scripts/linear.sh` 管理 Linear issue。

## 设置

将 API 密钥存入 `~/.clawdbot/credentials/linear.json`：
```json
{"apiKey": "lin_api_..."}
```

## 命令

```bash
# List my assigned issues
scripts/linear.sh issues --mine

# List team issues
scripts/linear.sh issues --team TEAM_ID

# Get issue details
scripts/linear.sh get CLP-123

# Search issues
scripts/linear.sh search "auth bug"

# Create issue
scripts/linear.sh create --team TEAM_ID --title "Bug: login fails" --description "Details"

# Update issue (status, title, assignee, priority)
scripts/linear.sh update CLP-123 --state STATE_ID

# Add comment
scripts/linear.sh comment CLP-123 "Fixed in PR #42"

# List teams (to get TEAM_ID)
scripts/linear.sh teams

# List states (to get STATE_ID)
scripts/linear.sh states

# List users (to get assignee ID)
scripts/linear.sh users
```

使用 `--json` 标志获取原始 API 输出：`scripts/linear.sh --json issues --mine`

## 工作流示例

**创建并分配一个 bug：**
```bash
# Find team ID
scripts/linear.sh teams
# Create with priority 2 (high)
scripts/linear.sh create --team abc123 --title "Critical: API down" --priority 2
```

**将 issue 移至“进行中”状态：**
```bash
# Find state ID
scripts/linear.sh states
# Update
scripts/linear.sh update CLP-45 --state xyz789
```

GraphQL 详细信息请参阅 [references/api-examples.md](references/api-examples.md)。
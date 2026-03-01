---
name: youtrack
name_zh: YouTrack
description: 通过命令行界面（CLI）管理 YouTrack 问题、项目及工作流。适用于创建、更新、搜索或评论 YouTrack 问题，列出项目，检查问题状态，或自动化问题处理流程。
description_zh: 通过命令行界面（CLI）管理 YouTrack 问题、项目及工作流。适用于创建、更新、搜索或评论 YouTrack 问题，列出项目，检查问题状态，或自动化问题处理流程。
metadata: {"clawdbot":{"emoji":"🎫","requires":{"bins":["jq","curl"]}}}
---
# YouTrack CLI

使用 `ytctl`（位于 `scripts/` 中）进行 YouTrack 问题跟踪。

## 初始化配置

凭证存储于 `~/.config/youtrack/config.json`：  
```json
{
  "url": "https://your-instance.youtrack.cloud",
  "token": "perm:xxx"
}
```

或设置环境变量：`YOUTRACK_URL`、`YOUTRACK_TOKEN`

生成令牌：YouTrack → 个人资料 → 账户安全 → 新建令牌（New Token）

## 命令

```bash
# List projects
ytctl projects

# List issues (with optional filters)
ytctl issues                           # all issues
ytctl issues SP                        # issues in project SP
ytctl issues SP --query "state: Open"  # filtered
ytctl issues --max 50                  # limit results

# Get issue details
ytctl issue SP-123

# Create issue
ytctl create SP "Bug: Login fails"
ytctl create SP "Feature request" "Detailed description here"

# Update issue
ytctl update SP-123 state "In Progress"
ytctl update SP-123 assignee john.doe
ytctl update SP-123 priority Critical

# Add comment
ytctl comment SP-123 "Investigating this now"

# Search with YouTrack query syntax
ytctl search "project: SP state: Open assignee: me"
ytctl search "created: today"
ytctl search "#unresolved sort by: priority"

# List workflow states for project
ytctl states SP

# List users
ytctl users
ytctl users --query "john"
```

## 查询语法

YouTrack 查询示例：  
- `state: Open` —— 按状态筛选  
- `assignee: me` —— 分配给当前用户  
- `created: today` —— 今日创建  
- `updated: {last week}` —— 过去一周内更新  
- `#unresolved` —— 所有未解决的问题  
- `has: attachments` —— 包含附件的问题  
- `sort by: priority desc` —— 按指定字段排序  

组合查询：`project: SP state: Open assignee: me sort by: updated`

## 输出格式

默认：表格格式。添加 `--json` 参数以输出原始 JSON：  
```bash
ytctl issues SP --json
ytctl issue SP-123  # always JSON for single issue
```

## 批量操作

```bash
# Update all matching issues (with dry-run preview)
ytctl bulk-update "project: SP state: Open" state "In Progress" --dry-run
ytctl bulk-update "project: SP state: Open" state "In Progress"

# Comment on all matching issues
ytctl bulk-comment "project: SP state: Open" "Batch update notice"

# Assign all matching issues
ytctl bulk-assign "project: SP #unresolved" john.doe --dry-run
```

## 报告

```bash
# Project summary (default 7 days)
ytctl report SP
ytctl report SP --days 14

# User activity report
ytctl report-user zain
ytctl report-user zain --days 30

# State distribution with bar chart
ytctl report-states SP
```

## 注意事项

- 项目可使用短名称（如 SP）或全名  
- 支持的字段包括：state（状态）、summary（摘要）、description（描述）、assignee（负责人）、priority（优先级）  
- 使用 `ytctl states PROJECT` 查看有效的状态名称列表  
- 批量操作支持 `--dry-run` 参数，在实际执行前预览操作效果  
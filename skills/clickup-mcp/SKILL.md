---
name: clickup-mcp
name_zh: ClickUp MCP
description: 通过官方 MCP 管理 ClickUp 任务、文档、时间追踪、评论、聊天及搜索。需 OAuth 认证。
description_zh: 通过官方 MCP 管理 ClickUp 任务、文档、时间追踪、评论、聊天及搜索。需 OAuth 认证。
homepage: https://clickup.com
metadata: {"clawdbot":{"emoji":"✅","requires":{"bins":["mcporter"],"env":["CLICKUP_TOKEN"]}}}
---
# ClickUp MCP（官方）

通过官方 MCP 服务器访问 ClickUp。支持完整工作区搜索、任务管理、时间追踪、评论、聊天及文档功能。

## 设置

### 方案一：直接 OAuth（仅限支持的客户端）

ClickUp MCP 仅允许来自 **白名单客户端（allowlisted clients）** 的 OAuth 授权：  
- Claude Desktop、Claude Code、Cursor、VS Code、Windsurf、ChatGPT  

```bash
# Claude Code
claude mcp add clickup --transport http https://mcp.clickup.com/mcp
# Then /mcp in session to authorize
```  

### 方案二：Claude Code → mcporter（推荐）

先通过 Claude Code 完成 OAuth 授权，再提取 token 供 mcporter 使用：

**步骤 1：通过 Claude Code 授权**  
```bash
claude mcp add clickup --transport http https://mcp.clickup.com/mcp
claude
# In Claude Code, run: /mcp
# Complete OAuth in browser
```  

**步骤 2：提取 token**  
```bash
jq -r '.mcpOAuth | to_entries | .[] | select(.key | startswith("clickup")) | .value.accessToken' ~/.claude/.credentials.json
```  

**步骤 3：添加至环境变量**  
```bash
# Add to ~/.clawdbot/.env
CLICKUP_TOKEN=eyJhbGciOiJkaXIi...
```  

**步骤 4：配置 mcporter**  

在 `config/mcporter.json` 中添加：  
```json
{
  "mcpServers": {
    "clickup": {
      "baseUrl": "https://mcp.clickup.com/mcp",
      "description": "Official ClickUp MCP",
      "headers": {
        "Authorization": "Bearer ${CLICKUP_TOKEN}"
      }
    }
  }
}
```  

**步骤 5：测试**  
```bash
mcporter list clickup
mcporter call 'clickup.clickup_search(keywords: "test", count: 3)'
```  

### Token 刷新

Token 有效期较长（约 10 年）。若已过期：  
1. 在 Claude Code 中重新运行 `/mcp`  
2. 从 `~/.claude/.credentials.json` 中重新提取 token  
3. 更新 `CLICKUP_TOKEN` 至 `.env`  

## 可用工具（共 32 个）

### 搜索

| 工具 | 描述 |
|------|-------------|
| `clickup_search` | 在任务、文档、仪表盘、聊天、文件中进行全局搜索 |

### 任务（Tasks）

| 工具 | 描述 |
|------|-------------|
| `clickup_create_task` | 创建任务（支持设置名称、描述、状态、负责人、截止日期、优先级） |
| `clickup_get_task` | 获取任务详情（可选包含子任务） |
| `clickup_update_task` | 更新任意任务字段 |
| `clickup_attach_task_file` | 向任务附加文件（支持 URL 或 base64 编码） |
| `clickup_add_tag_to_task` | 为任务添加标签（tag） |
| `clickup_remove_tag_from_task` | 从任务中移除标签（tag） |

### 评论（Comments）

| 工具 | 描述 |
|------|-------------|
| `clickup_get_task_comments` | 获取任务下的全部评论 |
| `clickup_create_task_comment` | 添加评论（支持 @mentions） |

### 时间追踪（Time Tracking）

| 工具 | 描述 |
|------|-------------|
| `clickup_start_time_tracking` | 在任务上启动计时器 |
| `clickup_stop_time_tracking` | 停止当前活跃的计时器 |
| `clickup_add_time_entry` | 手动记录工时 |
| `clickup_get_task_time_entries` | 获取任务的时间条目（time entries） |
| `clickup_get_current_time_entry` | 查询当前活跃的计时器 |

### 工作区与层级结构（Workspace & Hierarchy）

| 工具 | 描述 |
|------|-------------|
| `clickup_get_workspace_hierarchy` | 获取完整结构（Spaces、Folders、Lists） |
| `clickup_create_list` | 在 Space 中创建 List |
| `clickup_create_list_in_folder` | 在 Folder 中创建 List |
| `clickup_get_list` | 获取 List 详情 |
| `clickup_update_list` | 更新 List 设置 |
| `clickup_create_folder` | 在 Space 中创建 Folder |
| `clickup_get_folder` | 获取 Folder 详情 |
| `clickup_update_folder` | 更新 Folder 设置 |

### 成员（Members）

| 工具 | 描述 |
|------|-------------|
| `clickup_get_workspace_members` | 列出工作区全部成员 |
| `clickup_find_member_by_name` | 按姓名或邮箱查找成员 |
| `clickup_resolve_assignees` | 根据姓名获取用户 ID |

### 聊天（Chat）

| 工具 | 描述 |
|------|-------------|
| `clickup_get_chat_channels` | 列出全部 Chat 频道 |
| `clickup_send_chat_message` | 向频道发送消息 |

### 文档（Docs）

| 工具 | 描述 |
|------|-------------|
| `clickup_create_document` | 创建新 Doc |
| `clickup_list_document_pages` | 获取 Doc 结构 |
| `clickup_get_document_pages` | 获取页面内容 |
| `clickup_create_document_page` | 向 Doc 添加页面 |
| `clickup_update_document_page` | 编辑页面内容 |

## 使用示例

### 搜索工作区  
```bash
mcporter call 'clickup.clickup_search(
  keywords: "Q4 marketing",
  count: 10
)'
```  

### 创建任务  
```bash
mcporter call 'clickup.clickup_create_task(
  name: "Review PR #42",
  list_id: "901506994423",
  description: "Check the new feature",
  status: "to do"
)'
```  

### 更新任务  
```bash
mcporter call 'clickup.clickup_update_task(
  task_id: "abc123",
  status: "in progress"
)'
```  

### 添加评论  
```bash
mcporter call 'clickup.clickup_create_task_comment(
  task_id: "abc123",
  comment_text: "@Mark can you review this?"
)'
```  

### 时间追踪  
```bash
# Start timer
mcporter call 'clickup.clickup_start_time_tracking(
  task_id: "abc123",
  description: "Working on feature"
)'

# Stop timer
mcporter call 'clickup.clickup_stop_time_tracking()'

# Log time manually (duration in ms, e.g., 2h = 7200000)
mcporter call 'clickup.clickup_add_time_entry(
  task_id: "abc123",
  start: "2026-01-06 10:00",
  duration: "2h",
  description: "Code review"
)'
```  

### 获取工作区结构  
```bash
mcporter call 'clickup.clickup_get_workspace_hierarchy(limit: 10)'
```  

### 聊天  
```bash
# List channels
mcporter call 'clickup.clickup_get_chat_channels()'

# Send message
mcporter call 'clickup.clickup_send_chat_message(
  channel_id: "channel-123",
  content: "Team standup in 5 minutes!"
)'
```  

## 限制条件

- **不支持删除操作** — 出于安全性考虑，请使用 ClickUp 界面操作  
- **不支持自定义字段（custom fields）** — 官方 MCP 未暴露该功能  
- **不支持视图管理（views management）** — 当前不可用  
- **必须使用 OAuth** — 必须通过白名单客户端授权（可使用 Claude Code 作为变通方案）  
- **存在速率限制（Rate limits）** — 与 ClickUp API 一致（约 100 次请求/分钟）  

## 相关资源

- [ClickUp MCP 文档](https://developer.clickup.com/docs/connect-an-ai-assistant-to-clickups-mcp-server)  
- [支持的工具列表](https://developer.clickup.com/docs/mcp-tools)  
- [ClickUp API 参考文档](https://clickup.com/api)  
- [反馈 / 白名单申请](https://feedback.clickup.com)  
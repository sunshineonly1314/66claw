---
name: todoist-manager
name_zh: Todoist管理器
description: 通过 todoist CLI 封装器管理 Todoist 任务、项目、标签和评论。当用户要求添加任务、列出待办事项、完成条目、管理项目，或与其 Todoist 账户交互时使用。
description_zh: 通过 todoist CLI 封装器管理 Todoist 任务、项目、标签和评论。当用户要求添加任务、列出待办事项、完成条目、管理项目，或与其 Todoist 账户交互时使用。
---
# Todoist CLI

通过 REST API v2 管理 Todoist。

## 设置

1. 获取 API 令牌：Todoist → 设置 → 集成 → 开发者 → API 令牌  
2. 设置环境变量：  
   ```bash
   export TODOIST_API_TOKEN="your_token_here"
   ```  
3. 使 CLI 可执行：  
   ```bash
   chmod +x ~/clawd/skills/todoist/scripts/todoist
   ```

## CLI 位置

```bash
~/clawd/skills/todoist/scripts/todoist
```

## 快速参考

### 任务

```bash
# List all tasks
todoist tasks

# List with filter
todoist tasks --filter "today"
todoist tasks --filter "overdue"
todoist tasks --filter "#Work"
todoist tasks --project PROJECT_ID

# Quick views
todoist today
todoist overdue
todoist upcoming

# Get single task
todoist task TASK_ID

# Add task
todoist add "Buy groceries"
todoist add "Call mom" --due tomorrow
todoist add "Meeting prep" --due "today 3pm" --priority 4
todoist add "Review PR" --project PROJECT_ID --labels "work,urgent"
todoist add "Write docs" --description "Include examples"

# Update task
todoist update TASK_ID --content "New title"
todoist update TASK_ID --due "next monday"
todoist update TASK_ID --priority 3

# Complete / reopen / delete
todoist complete TASK_ID
todoist reopen TASK_ID
todoist delete-task TASK_ID
```

### 项目

```bash
# List projects
todoist projects

# Get project
todoist project PROJECT_ID

# Create project
todoist add-project "Work"
todoist add-project "Personal" --color blue --favorite

# Update project
todoist update-project PROJECT_ID --name "New Name"
todoist update-project PROJECT_ID --color red

# Delete project
todoist delete-project PROJECT_ID
```

### 区段（Sections）

```bash
# List sections
todoist sections
todoist sections PROJECT_ID

# Create section
todoist add-section --name "In Progress" --project PROJECT_ID

# Delete section
todoist delete-section SECTION_ID
```

### 标签

```bash
# List labels
todoist labels

# Create label
todoist add-label "urgent"
todoist add-label "blocked" --color red

# Delete label
todoist delete-label LABEL_ID
```

### 评论

```bash
# List comments
todoist comments --task TASK_ID
todoist comments --project PROJECT_ID

# Add comment
todoist add-comment "Need more info" --task TASK_ID

# Delete comment
todoist delete-comment COMMENT_ID
```

## 过滤器语法

Todoist 支持功能强大的过滤器查询：

| 过滤器 | 描述 |
|--------|------|
| `today` | 今日到期 |
| `tomorrow` | 明日到期 |
| `overdue` | 已逾期 |
| `7 days` | 接下来 7 天内到期 |
| `no date` | 无截止日期 |
| `#ProjectName` | 属于特定项目 |
| `@label` | 具有指定标签 |
| `p1`、`p2`、`p3`、`p4` | 优先级等级 |
| `assigned to: me` | 分配给你 |
| `created: today` | 今日创建 |

可使用 `&`（与）或 `|`（或）组合多个条件：  
```bash
todoist tasks --filter "today & #Work"
todoist tasks --filter "overdue | p1"
```

## 截止日期字符串

自然语言形式的截止日期：
- `today`、`tomorrow`、`yesterday`  
- `next monday`、`next week`  
- `in 3 days`  
- `every day`、`every weekday`  
- `every monday at 9am`  
- `Jan 15`、`2026-01-20`  
- `today at 3pm`  

## 优先级等级

| 值 | 含义 |
|----|------|
| 1 | 普通（默认） |
| 2 | 中等 |
| 3 | 高 |
| 4 | 紧急 |

## 输出

所有命令均返回 JSON。可通过管道传给 `jq` 进行格式化：

```bash
todoist tasks | jq '.[] | {id, content, due: .due.string}'
todoist today | jq -r '.[].content'
```

## 注意事项

- 需要 `curl` 和 `jq`  
- 所有输出均为 JSON，便于脚本处理  
- 任务 ID 为数字字符串（例如："8765432109"）  
- 项目 ID 同样为数字字符串  
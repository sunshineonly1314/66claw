---
name: todoist-task-manager
name_zh: Todoist任务管理
description: 通过 `todoist` CLI 管理 Todoist 任务（列出、添加、修改、完成、删除）。支持过滤器、项目、标签和优先级。
description_zh: 通过 `todoist` CLI 管理 Todoist 任务（列出、添加、修改、完成、删除）。支持过滤器、项目、标签和优先级。
homepage: https://github.com/sachaos/todoist
metadata: {"clawdbot":{"emoji":"✅","requires":{"bins":["todoist"]},"install":[{"id":"brew","kind":"brew","formula":"todoist-cli","bins":["todoist"],"label":"Install todoist-cli via Homebrew"}]}}
---
# Todoist CLI

使用 `todoist` 从终端直接管理 Todoist 任务。

## 设置

1. 安装：`brew install todoist-cli`  
2. 从 https://app.todoist.com/app/settings/integrations/developer 获取你的 API 令牌  
3. 创建配置文件：  
```bash
mkdir -p ~/.config/todoist
echo '{"token": "YOUR_API_TOKEN"}' > ~/.config/todoist/config.json
```  
4. 同步：`todoist sync`  

## 列出任务

```bash
todoist list                           # All tasks
todoist list --filter "today"          # Due today
todoist list --filter "overdue"        # Overdue tasks
todoist list --filter "p1"             # Priority 1 (highest)
todoist list --filter "tomorrow"       # Due tomorrow
todoist list --filter "@work"          # By label
todoist list --filter "#Project"       # By project
todoist list --filter "(today | overdue) & p1"  # Combined filters
```

## 添加任务

```bash
todoist add "Buy milk"                                    # Simple task
todoist add "Call mom" --priority 1                       # With priority (1=highest, 4=lowest)
todoist add "Meeting" --date "tomorrow 3pm"               # With due date
todoist add "Report" --project-name "Work"                # To specific project
todoist add "Review" --label-names "urgent,review"        # With labels
todoist quick "Buy eggs tomorrow p1 #Shopping @errands"   # Natural language
```

## 修改任务

```bash
todoist modify TASK_ID --content "New title"
todoist modify TASK_ID --priority 2
todoist modify TASK_ID --date "next monday"
```

## 完成任务

```bash
todoist close TASK_ID              # Complete a task
todoist close TASK_ID TASK_ID2     # Complete multiple tasks
```

## 删除任务

```bash
todoist delete TASK_ID
```

## 查看详情

```bash
todoist show TASK_ID               # Show task details
todoist projects                   # List all projects
todoist labels                     # List all labels
```

## 同步

```bash
todoist sync                       # Sync local cache with Todoist
```

## 输出格式

```bash
todoist list --csv                 # CSV output for scripting
todoist list --color               # Colorized output
todoist list --namespace           # Show parent tasks as namespace
todoist list --indent              # Indent subtasks
```

## 过滤器语法

Todoist CLI 支持 [官方 Todoist 过滤器语法](https://todoist.com/help/articles/introduction-to-filters-V98wIH)：

| 过滤器 | 描述 |
|--------|------|
| `today` | 今日到期 |
| `tomorrow` | 明日到期 |
| `overdue` | 已逾期 |
| `no date` | 无截止日期 |
| `p1`、`p2`、`p3`、`p4` | 优先级等级 |
| `@label` | 按标签筛选 |
| `#Project` | 按项目筛选 |
| `assigned to: me` | 分配给你 |
| `7 days` | 接下来 7 天内到期 |

可使用 `&`（与）、`|`（或）、`!`（非）组合：  
```bash
todoist list --filter "(today | overdue) & p1"
todoist list --filter "#Work & !@done"
```

## 注意事项

- 在网页端或移动端应用中进行更改后，请运行 `todoist sync`  
- 任务 ID 为数字（例如：`12345678`）  
- 配置文件存储于 `~/.config/todoist/config.json`  
- 缓存存储于 `~/.config/todoist/cache.json`  
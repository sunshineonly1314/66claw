---
name: todoist-cli
name_zh: Todoist命令行
description: 通过 `todoist` CLI 管理 Todoist 的任务、项目、标签与分区。当用户要求添加/完成/列出任务、查看今日任务、搜索任务或管理项目时启用。
description_zh: 通过 `todoist` CLI 管理 Todoist 的任务、项目、标签与分区。当用户要求添加/完成/列出任务、查看今日任务、搜索任务或管理项目时启用。
homepage: https://github.com/buddyh/todoist-cli
metadata: {"clawdbot":{"emoji":"✅","requires":{"bins":["todoist"]},"install":[{"id":"brew","kind":"brew","formula":"buddyh/tap/todoist","bins":["todoist"],"label":"Install todoist (brew)"},{"id":"go","kind":"go","module":"github.com/buddyh/todoist-cli/cmd/todoist@latest","bins":["todoist"],"label":"Install todoist-cli (go)"}]}}
---
# Todoist CLI

使用 `todoist` 通过 Todoist REST API 管理任务、项目、标签与分区。

## 任务（Tasks）

```bash
# Today's tasks (default)
todoist

# List tasks
todoist tasks --all
todoist tasks --filter "p1"           # High priority
todoist tasks --filter "overdue"      # Overdue
todoist tasks -p Work                 # By project

# Add task
todoist add "Buy groceries"
todoist add "Call mom" -d tomorrow
todoist add "Urgent" -P 1 -d "today 5pm" -l urgent

# Complete / reopen
todoist complete <task-id>
todoist done <task-id>
todoist reopen <task-id>

# Update task
todoist update <task-id> --due "next monday"
todoist update <task-id> -P 2

# Move task (Kanban)
todoist move <task-id> --section "In Progress"
todoist move <task-id> --project "Work"

# Delete task
todoist delete <task-id>

# View / search
todoist view <task-id>
todoist search "meeting"
```

## 项目（Projects）

```bash
todoist projects
todoist projects add "New Project" --color blue
```

## 标签（Labels）

```bash
todoist labels
todoist labels add urgent --color red
```

## 分区（Sections）

```bash
todoist sections -p Work
todoist sections add "In Progress" -p Work
```

## 评论（Comments）

```bash
todoist comment <task-id>
todoist comment <task-id> "This is a note"
```

## 已完成任务（Completed Tasks）

```bash
todoist completed
todoist completed --since 2024-01-01 --limit 50
```

## 命令参考表

| 命令 | 描述 |
|---------|-------------|
| `todoist` | 显示今日任务 |
| `todoist tasks` | 使用过滤器列出任务 |
| `todoist add` | 创建新任务 |
| `todoist complete` | 将任务标记为完成 |
| `todoist done` | complete 的别名 |
| `todoist reopen` | 重新开启已完成任务 |
| `todoist move` | 将任务移至指定分区/项目 |
| `todoist update` | 更新任务 |
| `todoist delete` | 删除任务 |
| `todoist view` | 查看任务详情 |
| `todoist search` | 搜索任务 |
| `todoist projects` | 列出/管理项目 |
| `todoist labels` | 列出/管理标签 |
| `todoist sections` | 列出/管理分区 |
| `todoist comment` | 查看/添加评论 |
| `todoist completed` | 显示已完成任务 |

## 优先级映射表

| CLI 表示 | Todoist 表示 |
|-----|---------|
| `-P 1` | p1（最高） |
| `-P 2` | p2 |
| `-P 3` | p3 |
| `-P 4` | p4（最低） |

## 注意事项

- 所有命令均支持 `--json` 参数以输出机器可读格式  
- 认证方式：`todoist auth` 或设置环境变量 `TODOIST_API_TOKEN`  
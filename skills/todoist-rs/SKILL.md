---
name: todoist-rs
name_zh: Todoist-RS
description: 管理 Todoist 任务。当用户提及“todoist”、“我的任务”、“任务列表”、“添加一个任务”、“完成任务”，或希望与其 Todoist 账户交互时使用。
description_zh: 管理 Todoist 任务。当用户提及“todoist”、“我的任务”、“任务列表”、“添加一个任务”、“完成任务”，或希望与其 Todoist 账户交互时使用。
homepage: https://github.com/LuoAndOrder/todoist-rs
metadata: {"clawdbot":{"emoji":"✅","requires":{"bins":["td"]},"install":[{"id":"brew","kind":"brew","formula":"LuoAndOrder/tap/todoist-cli","bins":["td"],"label":"Install todoist-cli via Homebrew"}]}}
---
# Todoist 集成

通过 `td` CLI（todoist-rs）管理任务。

## 安装

```bash
brew install LuoAndOrder/tap/todoist-cli
```

或通过 Cargo 安装：`cargo install todoist-cli-rs`

## 同步行为

- **写操作自动同步**：`add`、`done`、`edit`、`delete` 直接调用 API  
- **读操作使用缓存**：`list`、`today`、`show` 从本地缓存读取  
- **按需同步**：使用 `--sync` 标志或 `td sync` 获取最新数据  

```bash
td sync              # Incremental sync (fast)
td sync --full       # Full rebuild if cache seems off
```

## 常见操作

### 列出任务

```bash
# Today's agenda (includes overdue)
td today --sync

# Today only (no overdue)
td today --no-overdue

# All tasks
td list --sync

# By project
td list -p "Inbox" --sync
td list -p "Work" --sync

# High priority
td list -f "p1 | p2" --sync

# By label
td list -l "urgent" --sync

# Complex filters
td list -f "today & p1" --sync
td list -f "(today | overdue) & !@waiting_on" --sync
```

### 添加任务

快速添加（自然语言）：  
```bash
td quick "Buy milk tomorrow @errands #Personal"
td quick "Review PR tomorrow" --note "Check the auth changes carefully"
```

结构化添加：  
```bash
td add "Task content" \
  -p "Inbox" \
  -P 2 \
  -d "today" \
  -l "urgent"

# With description
td add "Prepare quarterly report" -P 1 -d "friday" \
  --description "Include sales metrics and customer feedback summary"
```

选项：  
- `-P, --priority` — 优先级值（1 为最高，4 为最低，默认为 4）  
- `-p, --project` — 项目名称  
- `-d, --due` — 截止日期（如 "today"、"tomorrow"、"2026-01-30"、"next monday"）  
- `-l, --label` — 标签（可重复使用以添加多个标签）  
- `--description` — 任务描述/备注（显示在任务标题下方）  
- `--section` — 项目内的目标区段（section）  
- `--parent` — 父任务 ID（用于创建子任务）  

### 完成任务

```bash
td done <task-id>
td done <id1> <id2> <id3>              # Multiple at once
td done <id> --all-occurrences         # End recurring task permanently
```

### 修改任务

```bash
td edit <task-id> -c "New content"
td edit <task-id> --description "Additional notes here"
td edit <task-id> -P 1
td edit <task-id> -d "tomorrow"
td edit <task-id> --add-label "urgent"
td edit <task-id> --remove-label "next"
td edit <task-id> --no-due             # Remove due date
td edit <task-id> --section "Next Actions"
td edit <task-id> -p "Work"            # Move to different project
```

编辑选项：  
- `-c, --content` — 更新任务标题  
- `--description` — 更新任务描述/备注  
- `-P, --priority` — 更改优先级（1–4）  
- `-d, --due` — 更改截止日期  
- `--no-due` — 移除截止日期  
- `-l, --label` — 替换全部标签  
- `--add-label` — 添加一个标签  
- `--remove-label` — 移除一个标签  
- `-p, --project` — 移动至其他项目  
- `--section` — 移动至项目内的某区段（section）  

### 查看任务详情

```bash
td show <task-id>
td show <task-id> --comments
```

### 删除任务

```bash
td delete <task-id>
```

### 重新打开已完成任务

```bash
td reopen <task-id>
```

## 项目与标签管理

```bash
# Projects
td projects                            # List all
td projects add "New Project"
td projects show <id>

# Labels
td labels                              # List all
td labels add "urgent"
```

## 过滤器语法

与 `-f/--filter` 配合使用：  
- `|` 表示 OR（或）：`today | overdue`  
- `&` 表示 AND（与）：`@next & #Personal`  
- 圆括号：`(today | overdue) & p1`  
- 否定：`!@waiting_on`  
- 优先级：`p1`、`p2`、`p3`、`p4`  
- 日期：`today`、`tomorrow`、`overdue`、`no date`、`7 days`  

## 工作流提示

1. **晨间回顾**：`td today --sync`  
2. **快速捕获**：`td quick "thing to do"`  
3. **专注清单**：`td list -f "@next" --sync`  
4. **等待中事项**：`td list -f "@waiting_on" --sync`  
5. **每日收尾**：`td today`（此时缓存已足够，因先前已同步）  
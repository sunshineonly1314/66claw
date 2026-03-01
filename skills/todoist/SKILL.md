---
name: todoist
name_zh: Todoist
description: 在 Todoist 中管理任务与项目。当用户询问任务、待办事项、提醒或生产力相关问题时启用。
description_zh: 在 Todoist 中管理任务与项目。当用户询问任务、待办事项、提醒或生产力相关问题时启用。
homepage: https://todoist.com
metadata:
  clawdbot:
    emoji: "✅"
    requires:
      bins: ["todoist"]
      env: ["TODOIST_API_TOKEN"]
---
# Todoist CLI

基于官方 TypeScript SDK 构建的 Todoist 命令行工具。

## 安装方式

```bash
npm install -g todoist-ts-cli
```

## 初始化设置

1. 从 https://todoist.com/app/settings/integrations/developer 获取 API Token  
2. 任选其一：  
   ```bash
   todoist auth <your-token>
   # or
   export TODOIST_API_TOKEN="your-token"
   ```

## 命令

### 任务（Tasks）

```bash
todoist                    # Show today's tasks (default)
todoist today              # Same as above
todoist tasks              # List tasks (today + overdue)
todoist tasks --all        # All tasks
todoist tasks -p "Work"    # Tasks in project
todoist tasks -f "p1"      # Filter query (priority 1)
todoist tasks --json
```

### 添加任务（Add Tasks）

```bash
todoist add "Buy groceries"
todoist add "Meeting" --due "tomorrow 10am"
todoist add "Review PR" --due "today" --priority 1 --project "Work"
todoist add "Call mom" -d "sunday" -l "family"  # with label
```

### 管理任务（Manage Tasks）

```bash
todoist view <id>          # View task details
todoist done <id>          # Complete task
todoist reopen <id>        # Reopen completed task
todoist update <id> --due "next week"
todoist move <id> -p "Personal"
todoist delete <id>
```

### 搜索（Search）

```bash
todoist search "meeting"
```

### 项目与标签（Projects & Labels）

```bash
todoist projects           # List projects
todoist project-add "New Project"
todoist labels             # List labels
todoist label-add "urgent"
```

### 评论（Comments）

```bash
todoist comments <task-id>
todoist comment <task-id> "Note about this task"
```

## 使用示例

**用户：“我今天有什么要做？”**  
```bash
todoist today
```

**用户：“把‘买牛奶’加到我的任务里”**  
```bash
todoist add "Buy milk" --due "today"
```

**用户：“提醒我明天给牙医打电话”**  
```bash
todoist add "Call the dentist" --due "tomorrow"
```

**用户：“把采购任务标记为已完成”**  
```bash
todoist search "grocery"   # Find task ID
todoist done <id>
```

**用户：“我的‘工作’项目里有什么？”**  
```bash
todoist tasks -p "Work"
```

**用户：“显示我的高优先级任务”**  
```bash
todoist tasks -f "p1"
```

## 过滤器语法（Filter Syntax）

Todoist 支持强大的过滤查询：
- `p1`、`p2`、`p3`、`p4` — 优先级等级  
- `today`、`tomorrow`、`overdue`  
- `@label` — 带指定标签的任务  
- `#project` — 指定项目中的任务  
- `search: keyword` — 搜索  

## 注意事项

- 任务列表中会显示任务 ID  
- 截止日期支持自然语言表达（如：“tomorrow”、“next monday”、“jan 15”）  
- 优先级 1 为最高，4 为最低  
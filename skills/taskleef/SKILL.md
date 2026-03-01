---
name: taskleef
name_zh: Taskleef
description: 当通过 Taskleef.com 管理待办事项（todos）、任务（tasks）、项目（projects）或看板（kanban boards）时启用。支持添加、列出、完成、删除待办事项，按项目组织待办事项，以及管理看板。当用户希望追踪任务、管理待办清单、按项目组织工作，或使用看板工作流时启用。
description_zh: 当通过 Taskleef.com 管理待办事项（todos）、任务（tasks）、项目（projects）或看板（kanban boards）时启用。支持添加、列出、完成、删除待办事项，按项目组织待办事项，以及管理看板。当用户希望追踪任务、管理待办清单、按项目组织工作，或使用看板工作流时启用。
metadata: {"clawdbot":{"emoji":"✅","requires":{"bins":["todo","curl","jq"],"env":["TASKLEEF_API_KEY"]},"primaryEnv":"TASKLEEF_API_KEY","homepage":"https://taskleef.com","install":[{"id":"todo-cli","kind":"download","url":"https://raw.githubusercontent.com/Xatter/taskleef/main/taskleef-cli/todo","bins":["todo"],"label":"Install Taskleef CLI (todo)"},{"id":"jq-brew","kind":"brew","formula":"jq","bins":["jq"],"label":"Install jq via Homebrew","os":["darwin"]},{"id":"jq-linux-amd64","kind":"download","url":"https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-linux-amd64","bins":["jq"],"label":"Install jq (Linux x86_64)","os":["linux"]},{"id":"jq-linux-arm64","kind":"download","url":"https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-linux-arm64","bins":["jq"],"label":"Install jq (Linux ARM64)","os":["linux"]}]}}
---
# Taskleef

使用 Taskleef CLI 管理待办事项、项目及看板。Taskleef.com 是一款灵活的待办事项应用，支持简单任务列表、项目组织及看板工作流。

## 前置依赖

`todo` CLI 需要以下组件：
- `curl` — 用于发起 API 请求  
- `jq` — 用于解析 JSON 响应  
- `TASKLEEF_API_KEY` 环境变量  

## 认证方式

CLI 使用 `TASKLEEF_API_KEY` 环境变量进行认证。用户可从 https://taskleef.com 获取其 API 密钥。

用户亦可选择使用 `--auth-file` 参数指定认证文件：
```bash
todo --auth-file ~/.taskleef.auth list
todo -a ~/.taskleef.auth list
```

## 核心命令

### 待办事项管理

**列出待办事项：**  
```bash
todo list           # List pending todos
todo ls             # Alias for list
todo list -a        # List all todos including completed
```

**添加待办事项：**  
```bash
todo add "Buy groceries"
todo "Buy groceries"    # Quick add without 'add' keyword
```

**查看待办事项详情：**  
```bash
todo show <title-or-id>
```

**完成待办事项：**  
```bash
todo complete <title-or-id>
todo done <title-or-id>
```

**删除待办事项：**  
```bash
todo delete <title-or-id>
todo rm <title-or-id>
```

**查看收件箱：**  
```bash
todo inbox    # List todos not assigned to any project
```

### 子任务

**添加子任务：**  
```bash
todo subtask <parent-title-or-id> "Subtask title"
```

### 项目

**列出项目：**  
```bash
todo project list
```

**创建项目：**  
```bash
todo project add "Project Name"
```

**查看项目详情：**  
```bash
todo project show <project-name-or-id>
```

**删除项目：**  
```bash
todo project delete <project-name-or-id>
```

**将待办事项加入项目：**  
```bash
todo project add-todo <project-name-or-id> <todo-title-or-id>
```

**将待办事项从项目中移除：**  
```bash
todo project remove-todo <project-name-or-id> <todo-title-or-id>
```

### 看板（Kanban Boards）

**显示看板：**  
```bash
todo board                           # Show default board (ASCII view)
todo board show <board-name-or-id>   # Show specific board
```

**列出看板：**  
```bash
todo board list
```

**列出某一列中的卡片：**  
```bash
todo board column <column-name-or-id>
```

**移动卡片：**  
```bash
todo board move <card-title-or-id> <column-name-or-id>
```

**将卡片标记为已完成：**  
```bash
todo board done <card-title-or-id>
```

**为卡片分配负责人：**  
```bash
todo board assign <card-title-or-id>
```

**清空某一列：**  
```bash
todo board clear <column-name-or-id>
```

## 标识符匹配规则

命令支持以下标识方式：
- **ID 前缀**：UUID 的前若干字符（例如 `abc12`）  
- **标题匹配**：不区分大小写的部分标题匹配（例如 `groceries` 可匹配 “Buy groceries”）

## 优先级指示符

列出待办事项时，您将看到以下标记：
- ○ 无优先级  
- ●（绿色）低优先级  
- ●（黄色）中优先级  
- ●（红色）高优先级  

## 使用提示

1. **查找项目**：您可通过部分标题或 ID 前缀引用待办事项、项目、看板、列及卡片  
2. **快捷工作流**：使用 `todo "task"` 实现快速任务录入  
3. **项目组织**：将相关待办事项归入项目，提升组织性  
4. **看板（Kanban）**：使用看板实现可视化工作流管理  
5. **子任务**：将复杂任务拆分为子任务，便于跟踪  

## 示例

```bash
# Add and complete a todo
todo add "Review pull request"
todo done "pull request"

# Create a project and add todos
todo project add "Website Redesign"
todo project add-todo "Website" "Fix login"

# View kanban board and move cards
todo board
todo board move "Feature A" "Done"
```

## 错误处理

若 `TASKLEEF_API_KEY` 未设置或无效，命令将失败。请确保在运行命令前已正确配置 API 密钥。

## 补充资源

- 官网：https://taskleef.com  
- 获取 API 密钥：https://taskleef.com（用户控制台）  
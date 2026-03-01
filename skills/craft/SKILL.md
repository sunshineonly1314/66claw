---
name: craft
name_zh: Craft
description: 通过命令行界面（CLI）管理 Craft 笔记、文档和任务。当用户要求添加笔记、创建文档、管理任务、搜索其 Craft 文档或处理每日笔记时使用。Craft 是一款面向 macOS/iOS 的笔记应用。
description_zh: 通过命令行界面（CLI）管理 Craft 笔记、文档和任务。当用户要求添加笔记、创建文档、管理任务、搜索其 Craft 文档或处理每日笔记时使用。Craft 是一款面向 macOS/iOS 的笔记应用。
metadata: {"clawdbot":{"install":[{"id":"craft-cli","kind":"download","path":"scripts/craft","dest":"~/bin/craft","label":"Install Craft CLI"}]}}
---
# Craft CLI

与 Craft.do 文档、块（block）及任务交互。

## 设置

1. 安装：将 `scripts/craft` 复制到 `~/bin/craft` 并赋予可执行权限  
2. 从 Craft 获取 API URL：设置 > 集成 > Craft Connect > 创建链接  
3. 设置环境变量：`export CRAFT_API_URL='https://connect.craft.do/links/YOUR_LINK/api/v1'`  

为确保持久生效，请将其添加至 shell 配置文件中。

## 命令

### 文档

```bash
craft folders                    # List all folders
craft docs [location]            # List documents (unsorted, trash, templates, daily_notes)
craft doc <id>                   # Get document content by ID
craft daily [date]               # Get daily note (today, yesterday, YYYY-MM-DD)
craft search <term>              # Search across documents
craft create-doc "Title" [folderId]  # Create new document
```

### 块（Blocks）

```bash
craft add-block <docId> "markdown"      # Add block to document
craft add-to-daily "markdown" [date]    # Add to daily note (default: today)
craft update-block <blockId> "markdown" # Update existing block
craft delete-block <blockId>...         # Delete block(s)
```

### 任务

```bash
craft tasks [scope]              # List tasks (inbox, active, upcoming, logbook)
craft add-task "text" [scheduleDate]  # Add task to inbox
craft complete-task <id>         # Mark task as done
craft delete-task <id>           # Delete task
```

### 收藏集（Collections）

```bash
craft collections                # List all collections
craft collection-items <id>      # Get items from collection
```

## 注意事项

- 以参数形式传入的 Markdown 内容；如需，应转义引号  
- 日期格式：`today`、`yesterday` 或 `YYYY-MM-DD`  
- 任务作用域：`inbox`（默认）、`active`、`upcoming`、`logbook`  
- 文档位置：`unsorted`、`trash`、`templates`、`daily_notes`  
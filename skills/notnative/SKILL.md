---
name: notnative
name_zh: 非母语者
description: 使用 Notnative MCP 服务器（ws://127.0.0.1:8788）管理笔记、搜索、日历、任务、执行 Python 代码及操作画布。通过 WebSocket 连接到本地运行的 Notnative 应用实例。当您需要从 Notnative 仓库中搜索或读取笔记、向笔记中创建/更新/追加内容、管理日历事件与任务、执行 Python 代码以完成计算/图表绘制/数据分析、操作画布图表，或通过 MCP 工具访问任意 Notnative 应用功能时，请使用本 skill。
description_zh: 使用 Notnative MCP 服务器（ws://127.0.0.1:8788）管理笔记、搜索、日历、任务、执行 Python 代码及操作画布。通过 WebSocket 连接到本地运行的 Notnative 应用实例。当您需要从 Notnative 仓库中搜索或读取笔记、向笔记中创建/更新/追加内容、管理日历事件与任务、执行 Python 代码以完成计算/图表绘制/数据分析、操作画布图表，或通过 MCP 工具访问任意 Notnative 应用功能时，请使用本 skill。
---
# Notnative

通过其 MCP WebSocket 服务器与本地运行的 Notnative 应用实例交互。Notnative 应用必须在端口 8788 上运行。

## 快速开始

该 skill 提供了一个位于 `scripts/mcp-client.js` 的 CLI 客户端，用于处理 MCP 协议通信。

### 常用命令

```bash
# Search notes by query
node scripts/mcp-client.js search "recipe chicken"
node scripts/mcp-client.js search "project notnative" --limit 10

# Semantic search (by meaning)
node scripts/mcp-client.js semantic "healthy breakfast ideas"

# Read a specific note
node scripts/mcp-client.js read "Recetas/Pollo al limón"

# Get currently active/open note
node scripts/mcp-client.js active

# Create a new note
node scripts/mcp-client.js create "# New Note\n\nContent here" "Note Name" "Personal"

# Append content to note (uses active note if no name specified)
node scripts/mcp-client.js append "\n- New item" "My List"

# Update a note (OVERWRITES entire content)
node scripts/mcp-client.js update "My Note" "# Updated content"

# List notes (optional folder filter)
node scripts/mcp-client.js list-notes "Personal"
node scripts/mcp-client.js list-notes

# List folders
node scripts/mcp-client.js list-folders

# List tags
node scripts/mcp-client.js list-tags

# List tasks
node scripts/mcp-client.js tasks

# Get upcoming calendar events
node scripts/mcp-client.js events

# Get workspace statistics
node scripts/mcp-client.js stats

# Get app documentation
node scripts/mcp-client.js docs "vim commands"

# Execute Python code
node scripts/mcp-client.js run-python "print('Hello, World!')"
```

### 高级用法：直接调用工具

使用 `call` 命令配合 JSON 参数，可直接调用任意 MCP 工具：

```bash
# Insert content into specific location
node scripts/mcp-client.js call insert_into_note '{"name":"My Note","insertAtLine":10,"content":"New paragraph here"}'

# Create a calendar event
node scripts/mcp-client.js call create_calendar_event '{"title":"Meeting","startTime":"2026-01-26T10:00:00","duration":60}'

# Add a task
node scripts/mcp-client.js call create_task '{"text":"Call John tomorrow","dueDate":"2026-01-26"}'

# Web search
node scripts/mcp-client.js call web_search '{"query":"best JavaScript frameworks 2026"}'

# Browse a webpage
node scripts/mcp-client.js call web_browse '{"url":"https://example.com"}'
```

### 列出所有可用工具

```bash
node scripts/mcp-client.js list
```

此命令将列出全部 86 个可用的 MCP 工具及其输入 schema。

## 核心功能

### 笔记管理

- **搜索**：全文搜索（`search_notes`）与语义搜索（`semantic_search`）；
- **读取**：按名称或当前活跃笔记获取内容（`read_note`、`get_active_note`）；
- **创建**：新建笔记（`create_note`、`create_daily_note`）；
- **编辑**：向笔记中插入内容（`insert_into_note`）、追加内容（`append_to_note`）或完整更新（`update_note`）；
- **整理**：重命名、移动、删除笔记（`rename_note`、`move_note`、`delete_note`）；
- **历史版本**：获取及恢复笔记历史版本（`get_note_history`、`restore_note_from_history`）。

### 日历与任务

- **日历事件**：创建、列出、更新、删除日历事件（`create_calendar_event`、`list_calendar_events`、`get_upcoming_events`）；
- **任务**：创建、列出、完成任务（`create_task`、`list_tasks`、`complete_task`）；
- **集成能力**：将任务转换为日历事件、查找空闲时段（`convert_task_to_event`、`find_free_time`）。

### Python 执行

支持运行含以下库的 Python 代码：matplotlib、pandas、numpy、pillow、openpyxl、xlsxwriter。

```bash
node scripts/mcp-client.js run-python "import matplotlib.pyplot as plt; plt.plot([1,2,3],[1,4,9]); plt.savefig('plot.png')"
```

可用于数值计算、数据分析、图表绘制以及带格式的 Excel 文件处理。

### 画布操作

支持画布图表操作：`canvas_get_state`、`canvas_add_node`、`canvas_connect_nodes`、`canvas_auto_layout`、`canvas_to_mermaid` 等。

### 标签与文件夹

- **标签**：创建、列出、向笔记添加或移除标签（`create_tag`、`list_tags`、`add_tag_to_note`）；
- **文件夹**：创建、列出、重命名、移动文件夹（`create_folder`、`list_folders`、`rename_folder`）。

### 分析与搜索

- **分析**：分析笔记结构、获取反向链接、查找相似笔记（`analyze_note_structure`、`get_backlinks`、`find_similar_notes`）；
- **搜索**：语义搜索、网页搜索、网页浏览（`semantic_search`、`web_search`、`web_browse`）；
- **YouTube**：获取视频字幕（`get_youtube_transcript`）。

## 服务端要求

Notnative MCP 服务器必须运行于 `ws://127.0.0.1:8788`。请确保：

1. Notnative 应用正在运行；
2. MCP 服务器已启用；
3. WebSocket 在端口 8788 上可访问。

## 错误处理

- **连接超时**：检查 Notnative 应用是否正在运行；
- **请求超时**：工具执行耗时超过 10 秒；
- **工具未找到**：请使用 `list` 命令验证工具名称。

## 脚本详情

`scripts/mcp-client.js` 脚本：

1. 连接到 WebSocket 服务器；
2. 初始化 MCP 会话；
3. 发送 JSON-RPC 请求；
4. 返回结构化 JSON 输出。

所有命令均返回 JSON 格式输出，便于解析。
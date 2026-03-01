---
name: drafts
name_zh: 草稿
description: 通过 macOS 命令行界面（CLI）管理 Drafts 应用的笔记。支持创建、查看、列出、编辑、追加、前置插入以及运行操作。当用户要求创建笔记、列出草稿、搜索草稿或管理其 Drafts 收件箱时使用。重要提示：此功能要求 Drafts 应用正在 macOS 上运行。
description_zh: 通过 macOS 命令行界面（CLI）管理 Drafts 应用的笔记。支持创建、查看、列出、编辑、追加、前置插入以及运行操作。当用户要求创建笔记、列出草稿、搜索草稿或管理其 Drafts 收件箱时使用。重要提示：此功能要求 Drafts 应用正在 macOS 上运行。
homepage: https://github.com/nerveband/drafts
metadata: {"clawdbot":{"emoji":"📋","os":["darwin"],"requires":{"bins":["drafts"]}}}
---
# Drafts CLI

在 macOS 终端中管理 [Drafts](https://getdrafts.com) 笔记。

## 重要前提条件

> **This CLI ONLY works on macOS with Drafts app running.**

- **仅限 macOS** — 使用 AppleScript，不适用于 Linux/Windows  
- **Drafts 必须处于运行状态** — 应用必须已打开，命令方可生效  
- **需 Drafts Pro 订阅** — 自动化功能需 Pro 版本支持  

若命令执行失败或卡住，请首先检查：`open -a Drafts`

## 安装设置

通过 Go 安装：
```bash
go install github.com/nerveband/drafts/cmd/drafts@latest
```

或从源码构建：
```bash
git clone https://github.com/nerveband/drafts
cd drafts && go build ./cmd/drafts
```

## 命令

### 创建一份草稿

```bash
# Simple draft
drafts create "Meeting notes for Monday"

# With tags
drafts create "Shopping list" -t groceries -t todo

# Flagged draft
drafts create "Urgent reminder" -f

# Create in archive
drafts create "Reference note" -a
```

### 列出所有草稿

```bash
# List inbox (default)
drafts list

# List archived drafts
drafts list -f archive

# List trashed drafts
drafts list -f trash

# List all drafts
drafts list -f all

# Filter by tag
drafts list -t mytag
```

### 获取某份草稿

```bash
# Get specific draft
drafts get <uuid>

# Get active draft (currently open in Drafts)
drafts get
```

### 修改草稿

```bash
# Prepend text
drafts prepend "New first line" -u <uuid>

# Append text
drafts append "Added at the end" -u <uuid>

# Replace entire content
drafts replace "Completely new content" -u <uuid>
```

### 在外部编辑器中编辑

```bash
drafts edit <uuid>
```

### 运行操作（Actions）

```bash
# Run action on text
drafts run "Copy" "Text to copy to clipboard"

# Run action on existing draft
drafts run "Copy" -u <uuid>
```

### 获取 Schema（数据结构定义）

```bash
# Full schema for LLM integration
drafts schema

# Schema for specific command
drafts schema create
```

## 输出格式

**JSON（默认）** — 所有命令均返回结构化 JSON：
```json
{
  "success": true,
  "data": {
    "uuid": "ABC123",
    "content": "Note content",
    "title": "Note title",
    "tags": ["tag1", "tag2"],
    "folder": "inbox"
  }
}
```

**纯文本** — 面向人类可读的输出：
```bash
drafts list --plain
```

## 常见工作流

### 快速记录（Quick Capture）
```bash
drafts create "Remember to call dentist tomorrow" -t reminder
```

### 日常日志（Daily Journal）
```bash
drafts append "$(date): Completed project review" -u <journal-uuid>
```

### 搜索与复核（Search and Review）
```bash
# List all drafts with a specific tag
drafts list -t work

# Get full content of a draft
drafts get <uuid>
```

## 故障排查

**命令失败或返回空结果：**  
1. Drafts 是否正在运行？→ `open -a Drafts`  
2. Drafts Pro 是否已激活？→ 自动化功能需 Pro 订阅  
3. 权限是否已授予？→ 系统设置 > 隐私与安全性 > 自动化  

**命令卡住（hang）：**  
- 检查 Drafts 是否正显示对话框  

## 注意事项

- 仅限 macOS（基于 AppleScript）  
- Drafts 应用必须正在运行  
- 需 Drafts Pro 订阅  
- 所有 UUID 均为 Drafts 自动生成的标识符  
- 标签（Tags）区分大小写  

## 版本

最新版（通过 `go install` 安装）
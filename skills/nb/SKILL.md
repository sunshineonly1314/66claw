---
name: nb
name_zh: Notebook
description: 使用 nb 命令行工具管理笔记、书签和笔记本。支持跨多个笔记本创建、列出、搜索和组织笔记，并通过 Git 提供版本控制。
description_zh: 使用 nb 命令行工具管理笔记、书签和笔记本。支持跨多个笔记本创建、列出、搜索和组织笔记，并通过 Git 提供版本控制。
author: Benjamin Jesuiter <bjesuiter@gmail.com>
homepage: https://github.com/xwmx/nb
metadata:
  clawdbot:
    emoji: "📓"
    os: ["darwin", "linux"]
    requires:
      bins: ["nb"]
---
# nb - 命令行笔记工具

> ⚠️ **IMPORTANT:** Never edit files in nb git repos (`~/.nb/*`) by hand! Always use the `nb` CLI to ensure proper indexing and Git commits.



一款基于命令行和本地 Web 的笔记记录、书签管理与归档工具，采用纯文本数据存储、Git 版本控制以及维基风格的链接功能。

## 快速参考

### 笔记本

```bash
# List all notebooks
nb notebooks

# Switch to a notebook
nb use <notebook>

# Create a new notebook
nb notebooks add <name>

# Show current notebook
nb notebooks current
```

### 添加笔记

```bash
# Add a note with title
nb add -t "Title" -c "Content here"

# Add note to specific notebook
nb <notebook>: add -t "Title" -c "Content"

# Add note with tags
nb add -t "Title" --tags tag1,tag2

# Add note from file content
nb add <notebook>:filename.md
```

### 列出笔记

```bash
# List notes in current notebook
nb list

# List all notes (no limit)
nb list -a

# List notes in specific notebook
nb <notebook>: list

# List with excerpts
nb list -e

# List with tags shown
nb list --tags
```

### 查看笔记

```bash
# Show note by ID or title
nb show <id>
nb show "<title>"

# Show note from specific notebook
nb show <notebook>:<id>

# Print content (for piping)
nb show <id> --print
```

### 搜索笔记

```bash
# Search across all notebooks
nb search "query"

# Search in specific notebook
nb <notebook>: search "query"

# Search with AND/OR/NOT
nb search "term1" --and "term2"
nb search "term1" --or "term2"
nb search "term1" --not "exclude"

# Search by tag
nb search --tag "tagname"
```

### 编辑笔记

```bash
# Edit by ID
nb edit <id>

# Edit by title
nb edit "<title>"

# Append content
nb edit <id> -c "New content to append"

# Prepend content
nb edit <id> -c "Content at top" --prepend

# Overwrite content
nb edit <id> -c "Replace all" --overwrite
```

### 删除笔记

```bash
# Delete by ID (will prompt)
nb delete <id>

# Force delete without prompt
nb delete <id> -f
```

### 移动/重命名

```bash
# Move note to another notebook
nb move <id> <notebook>:

# Rename a note
nb move <id> new-filename.md
```

### 待办事项（Todos）

```bash
# Add a todo
nb todo add "Task title"

# Add todo with due date
nb todo add "Task" --due "2026-01-15"

# List open todos
nb todos open

# List closed todos
nb todos closed

# Mark todo as done
nb todo do <id>

# Mark todo as not done
nb todo undo <id>
```

### 书签

```bash
# Add a bookmark
nb bookmark <url>

# Add with comment
nb bookmark <url> -c "My comment"

# Add with tags
nb bookmark <url> --tags reference,dev

# List bookmarks
nb bookmark list

# Search bookmarks
nb bookmark search "query"
```

### Git 操作

```bash
# Sync with remote
nb sync

# Create checkpoint (commit)
nb git checkpoint "Message"

# Check dirty status
nb git dirty

# Run any git command
nb git status
nb git log --oneline -5
```

### 文件夹

```bash
# Add folder to notebook
nb folders add <folder-name>

# List folders
nb folders

# Add note to folder
nb add <folder>/<filename>.md
```

## 常见用法模式

### 添加含完整内容的笔记

对于较长的笔记，可先创建临时文件再导入：

```bash
# Write content to temp file first, then copy to nb
cp /tmp/note.md ~/.nb/<notebook>/
cd ~/.nb/<notebook> && git add . && git commit -m "Add note"
nb <notebook>: index rebuild
```

### 跨所有笔记本搜索

```bash
# Search everything
nb search "term" --all

# Search by type
nb search "term" --type bookmark
nb search "term" --type todo
```

## 数据存储位置

笔记以 Markdown 文件形式存储在 `~/.nb/<notebook>/` 目录下，并由 Git 进行版本控制。

```
~/.nb/
├── notebook-name-1/ # Your first notebook
├── notebook-name-2/ # Your second notebook
└── ...
```

## 使用提示

1. 使用 `nb <notebook>:` 前缀来操作特定笔记本  
2. ID 是 `nb list` 命令中显示的编号  
3. 可使用标题代替 ID（若标题含空格，请用引号括起）  
4. 所有更改均自动提交至 Git  
5. 使用 `nb sync` 同步远程仓库（推送/拉取）
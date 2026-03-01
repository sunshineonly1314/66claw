---
name: notebooklm-cli
name_zh: NotebookLM命令行
description: 功能全面的 Google NotebookLM 命令行工具，支持笔记本、资料源、音频播客、报告、测验、抽认卡、思维导图、幻灯片、信息图、视频及数据表格。适用于以编程方式操作 NotebookLM 的场景：管理笔记本/资料源、生成音频概览（播客）、创建学习材料（测验、抽认卡）、制作演示文稿（幻灯片、信息图），或通过聊天查询资料源。
description_zh: 功能全面的 Google NotebookLM 命令行工具，支持笔记本、资料源、音频播客、报告、测验、抽认卡、思维导图、幻灯片、信息图、视频及数据表格。适用于以编程方式操作 NotebookLM 的场景：管理笔记本/资料源、生成音频概览（播客）、创建学习材料（测验、抽认卡）、制作演示文稿（幻灯片、信息图），或通过聊天查询资料源。
---
# NotebookLM CLI

## 概述

本 skill 通过命令行接口（CLI）提供对 Google NotebookLM 的完整访问能力。可管理笔记本与资料源，并生成多种内容格式，包括音频播客、报告、测验、抽认卡、思维导图、幻灯片、信息图、视频及数据表格。

## 何时使用本 skill

请在以下情形中使用本 skill：
- 以编程方式管理 NotebookLM 笔记本与资料源
- 基于笔记本资料源生成音频概览（播客）
- 创建学习材料：测验、抽认卡、报告
- 制作可视化内容：幻灯片、信息图、思维导图、视频
- 通过聊天或单次提问方式查询资料源
- 自动开展研究并导入新资料源

## 快速入门

### 认证

```bash
nlm login
```

启动 Chrome 浏览器，导航至 NotebookLM 并提取会话 Cookie。需已安装 Google Chrome。

### 列出笔记本

```bash
nlm notebook list
```

### 创建笔记本并添加资料源

```bash
nlm notebook create "My Research"
nlm source add <notebook-id> --url "https://example.com/article"
nlm source add <notebook-id> --text "Your content here" --title "My Notes"
```

### 生成内容（所有类型）

所有生成命令均需指定 `--confirm` 或 `-y`：

```bash
nlm audio create <id> --confirm          # Podcast
nlm report create <id> --confirm         # Briefing doc or study guide
nlm quiz create <id> --confirm           # Quiz questions
nlm flashcards create <id> --confirm     # Flashcards
nlm mindmap create <id> --confirm        # Mind map
nlm slides create <id> --confirm         # Slide deck
nlm infographic create <id> --confirm    # Infographic
nlm video create <id> --confirm          # Video overview
nlm data-table create <id> "description" --confirm  # Data table
```

## 认证

| 命令 | 描述 |
|---------|-------------|
| `nlm login` | 使用 NotebookLM 进行认证（打开 Chrome） |
| `nlm login --check` | 验证当前凭据 |
| `nlm auth status` | 检查会话有效性 |
| `nlm auth list` | 列出全部配置文件 |
| `nlm auth delete <profile> --confirm` | 删除某个配置文件 |
| `nlm login --profile <name>` | 登录至特定配置文件 |

会话有效期约为 20 分钟。若命令执行失败，请使用 `nlm login` 重新认证。

## 笔记本管理

| 命令 | 描述 |
|---------|-------------|
| `nlm notebook list` | 列出全部笔记本 |
| `nlm notebook create "Title"` | 创建新笔记本 |
| `nlm notebook get <id>` | 获取笔记本详细信息 |
| `nlm notebook describe <id>` | AI 生成摘要 |
| `nlm notebook query <id> "question"` | 与资料源进行聊天 |
| `nlm notebook delete <id> --confirm` | 删除笔记本 |

## 资料源管理

| 命令 | 描述 |
|---------|-------------|
| `nlm source list <notebook-id>` | 列出笔记本中的资料源 |
| `nlm source list <notebook-id> --drive` | 显示 Google Drive 资料源及其更新状态 |
| `nlm source add <id> --url "..."` | 添加 URL 或 YouTube 资料源 |
| `nlm source add <id> --text "..." --title "..."` | 添加粘贴的文本 |
| `nlm source add <id> --drive <doc-id>` | 添加 Google Drive 文档 |
| `nlm source describe <source-id>` | 资料源的 AI 摘要 |
| `nlm source content <source-id>` | 获取原始文本内容 |
| `nlm source stale <notebook-id>` | 列出已过时的 Drive 资料源 |
| `nlm source sync <notebook-id> --confirm` | 同步 Drive 资料源 |

## 内容生成

所有生成命令均需指定 `--confirm` 或 `-y`：

### 媒体类型

| 命令 | 输出 |
|---------|--------|
| `nlm audio create <id> --confirm` | 音频播客概览 |
| `nlm report create <id> --confirm` | 简报文档或学习指南 |
| `nlm quiz create <id> --confirm` | 测验题目 |
| `nlm flashcards create <id> --confirm` | 抽认卡 |
| `nlm mindmap create <id> --confirm` | 思维导图 |
| `nlm slides create <id> --confirm` | 幻灯片演示文稿 |
| `nlm infographic create <id> --confirm` | 信息图 |
| `nlm video create <id> --confirm` | 视频概览 |
| `nlm data-table create <id> "description" --confirm` | 数据表格提取 |

## Studio（成果物管理）

| 命令 | 描述 |
|---------|-------------|
| `nlm studio status <notebook-id>` | 列出所有已生成的成果物 |
| `nlm studio delete <notebook-id> <artifact-id> --confirm` | 删除某项成果物 |

## 聊天

| 命令 | 描述 |
|---------|-------------|
| `nlm chat start <notebook-id>` | 启动交互式 REPL 会话 |
| `nlm chat configure <notebook-id>` | 配置聊天目标与响应风格 |
| `nlm notebook query <id> "question"` | 单次提问（不建立会话） |

聊天 REPL 命令：`/sources`, `/clear`, `/help`, `/exit`

## 研究

| 命令 | 描述 |
|---------|-------------|
| `nlm research start "query" --notebook-id <id>` | 网络搜索（约 30 秒） |
| `nlm research start "query" --notebook-id <id> --mode deep` | 深度研究（约 5 分钟） |
| `nlm research start "query" --notebook-id <id> --source drive` | 搜索 Google Drive |
| `nlm research status <notebook-id>` | 检查研究进度 |
| `nlm research import <notebook-id> <task-id>` | 导入已发现的资料源 |

## 别名（UUID 快捷方式）

```bash
nlm alias set myproject <uuid>           # Create alias
nlm notebook get myproject               # Use alias
nlm alias list                           # List all aliases
nlm alias get myproject                  # Resolve to UUID
nlm alias delete myproject               # Remove alias
```

## 输出格式

大多数列表命令支持多种输出格式：

```bash
nlm notebook list                # Rich table (default)
nlm notebook list --json         # JSON output
nlm notebook list --quiet        # IDs only (for scripting)
nlm notebook list --title        # "ID: Title" format
nlm notebook list --full         # All columns
```

## 配置文件（多账户支持）

```bash
nlm login --profile work         # Login to profile
nlm notebook list --profile work # Use profile
nlm auth list                    # List all profiles
nlm auth delete work --confirm   # Delete profile
```

## 配置

```bash
nlm config show                  # Show current configuration
nlm config get <key>             # Get specific setting
nlm config set <key> <value>     # Update setting
```

## AI 文档生成

面向 AI 助理，自动生成涵盖全部功能的完整文档：

```bash
nlm --ai
```

输出超过 400 行内容，覆盖全部命令、认证流程、错误处理、任务序列及自动化技巧。

## 参考资料

- [命令参考](references/commands.md) — 完整命令签名
- [故障排除](references/troubleshooting.md) — 错误诊断与解决方案
- [工作流](references/workflows.md) — 端到端任务序列
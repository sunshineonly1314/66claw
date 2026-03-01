---
name: miniflux
name_zh: Miniflux
description: "浏览、阅读和管理 Miniflux 订阅源文章。当 Claude 需通过 Miniflux 处理 RSS/Atom 订阅源时使用——例如列出未读/新文章、阅读文章内容、将文章标记为已读，以及管理订阅源与分类。提供带灵活输出格式（标题、摘要、全文）的 CLI 接口。"
description_zh: 浏览、阅读和管理 Miniflux 订阅源文章。当 Claude 需通过 Miniflux 处理 RSS/Atom 订阅源时使用——例如列出未读/新文章、阅读文章内容、将文章标记为已读，以及管理订阅源与分类。提供带灵活输出格式（标题、摘要、全文）的 CLI 接口。
metadata: {"clawdbot":{"emoji":"📣","requires":{"bins":["uv"]}}}
---
# Miniflux Skill

通过命令行界面（CLI）浏览、阅读和管理 Miniflux RSS/Atom 订阅源文章。

## 快速入门

```bash
# List unread articles (brief format)
uv run scripts/miniflux-cli.py list --status=unread --brief

# Get article details
uv run scripts/miniflux-cli.py get 123

# Mark articles as read
uv run scripts/miniflux-cli.py mark-read 123 456

# Show article statistics (word count, reading time)
uv run scripts/miniflux-cli.py stats --entry-id=123
```

## 配置

配置优先级（由高到低）：
1. **命令行参数**：`--url`、`--api-key`
2. **环境变量**：`MINIFLUX_URL`、`MINIFLUX_API_KEY`
3. **配置文件**：`~/.local/share/miniflux/config.json`（首次运行时自动创建）

### 设置

```bash
# Option 1: Environment variables (recommended for agents)
export MINIFLUX_URL="https://miniflux.example.org"
export MINIFLUX_API_KEY="your-api-key"

# Option 2: CLI flags (one-time, saves to config)
uv run scripts/miniflux-cli.py --url="https://miniflux.example.org" --api-key="xxx" list
```

## 子命令

### list — 列出文章

列出文章，支持可选筛选。

```bash
# Unread articles (brief)
uv run scripts/miniflux-cli.py list --status=unread --brief

# From specific feed with summary
uv run scripts/miniflux-cli.py list --feed=42 --summary

# Search with limit
uv run scripts/miniflux-cli.py list --search="python" --limit=10

# Starred articles
uv run scripts/miniflux-cli.py list --starred
```

**参数：**
- `--status={read,unread,removed}` — 按状态筛选
- `--feed=ID` — 按订阅源 ID 筛选
- `--category=ID` — 按分类 ID 筛选
- `--starred` — 仅显示已加星标的文章
- `--search=QUERY` — 搜索文章
- `--limit=N` — 最大返回条目数
- `--offset=N` — 跳过内容前 N 个字符
- `--content-limit=N` — 每篇文章最大字符数
- `-b, --brief` — 仅标题
- `-s, --summary` — 标题 + 摘要
- `-f, --full` — 完整内容（默认）
- `--json` — JSON 输出
- `--plain` — 每条记录单行（制表符分隔）

### get — 通过 ID 获取文章

获取单篇文章，支持内容控制。

```bash
# Full article
uv run scripts/miniflux-cli.py get 123

# First 2000 characters
uv run scripts/miniflux-cli.py get 123 --limit=2000

# Read from character 1000 to 2000 (pagination)
uv run scripts/miniflux-cli.py get 123 --offset=1000 --limit=1000
```

当内容被截断时，显示：`[...truncated, total: N chars]`

### mark-read — 标记为已读

将一篇或多篇文章标记为已读。

```bash
# Single article
uv run scripts/miniflux-cli.py mark-read 123

# Multiple articles
uv run scripts/miniflux-cli.py mark-read 123 456 789
```

### mark-unread — 标记为未读

将一篇或多篇文章标记为未读。

```bash
uv run scripts/miniflux-cli.py mark-unread 123
```

### feeds — 列出订阅源

列出所有已配置的订阅源。

```bash
# Human-readable
uv run scripts/miniflux-cli.py feeds

# JSON format
uv run scripts/miniflux-cli.py feeds --json
```

### categories — 列出分类

列出所有分类。

```bash
uv run scripts/miniflux-cli.py categories
```

### stats — 统计信息

显示未读计数或文章统计信息。

```bash
# Article statistics (word count, character count, reading time)
uv run scripts/miniflux-cli.py stats --entry-id=123

# Global unread counts per feed
uv run scripts/miniflux-cli.py stats
```

### refresh — 刷新订阅源

触发订阅源刷新。

```bash
# Refresh all feeds
uv run scripts/miniflux-cli.py refresh --all

# Refresh specific feed
uv run scripts/miniflux-cli.py refresh --feed=42
```

### search — 搜索文章

`list --search` 的便捷别名。

```bash
uv run scripts/miniflux-cli.py search "rust"
uv run scripts/miniflux-cli.py search "ai" --status=unread --brief
```

## 输出格式

- `--brief` / `-b` — 快速概览（标题 + 订阅源 + 日期）
- `--summary` / `-s` — 标题 + 内容预览（200 字符）
- `--full` / `-f` — 完整文章内容（默认）
- `--json` — 供机器处理的原始 JSON 输出
- `--plain` — 每条记录单行（制表符分隔）

## 长文章处理

对于内容庞大的文章（例如 >5000 字）：

1. **首先查看统计信息：**  
   ```bash
   uv run scripts/miniflux-cli.py stats --entry-id=123
   ```  
   显示字数、字符数与阅读时长。

2. **使用分页逐块阅读：**  
   ```bash
   # First 5000 chars
   uv run scripts/miniflux-cli.py get 123 --limit=5000

   # Next 5000 chars (chars 5000-10000)
   uv run scripts/miniflux-cli.py get 123 --offset=5000 --limit=5000
   ```

3. **用于摘要生成：** 若文章超过 5000 字，请使用 subagent 读取并生成摘要：  
   ```bash
   # Get stats to determine word count
   uv run scripts/miniflux-cli.py stats --entry-id=123

   # If >5000 words, delegate to subagent for summarization
   ```

## 错误处理

CLI 提供清晰有用的错误提示：

- **凭据无效** → 提示检查 `MINIFLUX_API_KEY`
- **文章未找到** → 建议使用 `list` 浏览查找
- **缺少配置** → 显示配置文件路径
- **无结果** → 给出明确提示

## 标准参数

- `-v, --version` — 显示版本号
- `-q, --quiet` — 抑制非错误类输出
- `-d, --debug` — 启用调试输出
- `--no-color` — 禁用彩色输出
- `--url=URL` — Miniflux 服务器 URL
- `--api-key=KEY` — Miniflux API 密钥

## 示例

### 日常工作流

```bash
# Check what's unread
uv run scripts/miniflux-cli.py list --status=unread --brief

# Read interesting articles
uv run scripts/miniflux-cli.py get 456

# Mark as read
uv run scripts/miniflux-cli.py mark-read 456
```

### 研究模式

```bash
# Search for specific topics
uv run scripts/miniflux-cli.py search "machine learning" --summary

# Get full article content
uv run scripts/miniflux-cli.py get 789
```

### 批量处理

```bash
# Get all unread as JSON for processing
uv run scripts/miniflux-cli.py list --status=unread --json

# Mark multiple as read
uv run scripts/miniflux-cli.py mark-read 123 456 789
```

查看任意子命令的完整帮助：
```bash
uv run scripts/miniflux-cli.py <subcommand> --help
```
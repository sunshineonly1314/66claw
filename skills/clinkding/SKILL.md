---
name: clinkding
name_zh: ClinkDing
description: 管理 linkding 书签——保存网址、搜索、打标签、整理并检索您的个人书签收藏。当用户希望保存链接、搜索书签、管理标签或整理阅读清单时，请使用该 skill。
description_zh: 管理 linkding 书签——保存网址、搜索、打标签、整理并检索您的个人书签收藏。当用户希望保存链接、搜索书签、管理标签或整理阅读清单时，请使用该 skill。
homepage: https://github.com/daveonkels/clinkding
metadata: {"clawdis":{"emoji":"🔖","requires":{"bins":["clinkding"]},"install":[{"id":"homebrew","kind":"brew","formula":"daveonkels/tap/clinkding","bins":["clinkding"],"label":"Install clinkding (Homebrew)"},{"id":"go","kind":"go","module":"github.com/daveonkels/clinkding@latest","bins":["clinkding"],"label":"Install clinkding (Go)"}]}}
---
# clinkding — Linkding 书签管理 CLI

一款现代 Go 语言编写的 CLI 工具，用于管理 [linkding](https://github.com/sissbruecker/linkding)（一款自托管书签管理器）中的书签。

## 此工具的功能

**Linkding** 是一款自托管书签管理器（类似 Pocket、Instapaper）。**clinkding** 是其配套 CLI，让您能通过终端或 AI agents 管理书签。

可将其理解为：  
- **稍后阅读（Save for later）** — 收集您想日后阅读的网址  
- **可搜索的资料库（Searchable library）** — 对标题、描述、标签进行全文搜索  
- **结构化的收藏集（Organized collections）** — 通过标签和集合（bundles）归类相关书签  
- **个人存档（Personal archive）** — 以备注和元数据形式长期保存重要链接  

## 快速入门

### 初始设置

```bash
# Interactive configuration
clinkding config init

# Or manually configure
clinkding config set url https://your-linkding-instance.com
clinkding config set token YOUR_API_TOKEN

# Test connection
clinkding config test
```  

### 配置文件

位置：`~/.config/clinkding/config.yaml`  

```yaml
url: https://linkding.example.com
token: your-api-token-here

defaults:
  bookmark_limit: 100
  output_format: auto
```  

### 环境变量

```bash
export LINKDING_URL="https://linkding.example.com"
export LINKDING_TOKEN="your-api-token-here"
```  

## 核心命令

### 书签（Bookmarks）

#### 列出与搜索

```bash
# List recent bookmarks
clinkding bookmarks list

# Search by keyword
clinkding bookmarks list --query "golang tutorial"

# Filter by tag
clinkding bookmarks list --query "tag:programming"

# Recent bookmarks (last 7 days)
clinkding bookmarks list --added-since "7d"

# Unread bookmarks
clinkding bookmarks list --query "unread:yes"

# JSON output for scripting
clinkding bookmarks list --json

# Plain text (tab-separated)
clinkding bookmarks list --plain
```  

#### 创建书签

```bash
# Simple bookmark
clinkding bookmarks create https://go.dev

# With metadata
clinkding bookmarks create https://go.dev \
  --title "Go Programming Language" \
  --tags "golang,programming,reference" \
  --description "Official Go website" \
  --unread

# Check if URL already exists before creating
clinkding bookmarks check https://go.dev
```  

#### 更新书签

```bash
# Update title
clinkding bookmarks update 42 --title "New Title"

# Add tags
clinkding bookmarks update 42 --add-tags "important,work"

# Remove tags
clinkding bookmarks update 42 --remove-tags "old-tag"

# Mark as read
clinkding bookmarks update 42 --read

# Update description
clinkding bookmarks update 42 --description "Updated notes"
```  

#### 获取书签详情

```bash
# Full details
clinkding bookmarks get 42

# JSON output
clinkding bookmarks get 42 --json
```  

#### 归档与删除

```bash
# Archive (hide from main list)
clinkding bookmarks archive 42

# Unarchive
clinkding bookmarks unarchive 42

# Delete permanently
clinkding bookmarks delete 42
```  

### 标签（Tags）

```bash
# List all tags
clinkding tags list

# Create a tag
clinkding tags create "golang"

# Get tag details
clinkding tags get 1

# Plain text output
clinkding tags list --plain
```  

### 集合（Bundles）

集合（Bundles）是相关书签的分组。

```bash
# List bundles
clinkding bundles list

# Create a bundle
clinkding bundles create "Go Resources" \
  --description "Everything related to Go programming"

# Update a bundle
clinkding bundles update 1 --name "Go Lang Resources"

# Get bundle details
clinkding bundles get 1

# Delete a bundle
clinkding bundles delete 1
```  

### 资源（Assets）

上传并管理书签的文件附件。

```bash
# List assets for a bookmark
clinkding assets list 42

# Upload a file
clinkding assets upload 42 ~/Documents/screenshot.png

# Download an asset
clinkding assets download 42 1 -o ./downloaded-file.png

# Delete an asset
clinkding assets delete 42 1
```  

### 用户档案（User Profile）

```bash
# Get user profile info
clinkding user profile
```  

## Agent 使用模式

### 从对话中保存网址

```bash
# User: "Save this for later: https://example.com"
clinkding bookmarks create https://example.com \
  --title "Article Title" \
  --description "Context from conversation" \
  --tags "topic,context"
```  

### 搜索书签

```bash
# User: "Find my golang bookmarks"
clinkding bookmarks list --query "golang"

# User: "Show me unread programming articles"
clinkding bookmarks list --query "tag:programming unread:yes"

# User: "What did I save last week?"
clinkding bookmarks list --added-since "7d"
```  

### 整理与打标签

```bash
# User: "Tag bookmark 42 as important"
clinkding bookmarks update 42 --add-tags "important"

# User: "Create a bundle for my AI research links"
clinkding bundles create "AI Research" \
  --description "Machine learning and AI papers"
```  

### 检索用于阅读

```bash
# User: "Give me something to read"
clinkding bookmarks list --query "unread:yes" --limit 5

# User: "Show me my golang tutorials"
clinkding bookmarks list --query "tag:golang tag:tutorial"
```  

## 输出格式

### 自动（默认）
面向终端显示的人性化表格与彩色输出。

### JSON
```bash
clinkding bookmarks list --json
```  
机器可读格式，适用于脚本编写与 agent 解析。

### 纯文本（Plain Text）
```bash
clinkding bookmarks list --plain
```  
制表符分隔值（TSV），便于管道（pipe）处理。

## 相对日期筛选（Relative Date Filtering）

支持人性化时间范围表达：

```bash
# Last 24 hours
clinkding bookmarks list --added-since "24h"

# Last 7 days
clinkding bookmarks list --added-since "7d"

# Last 6 months
clinkding bookmarks list --modified-since "180d"
```  

**支持单位：** `h`（小时）、`d`（天）、`y`（年）

## 常见工作流

### 早晨阅读例行流程

```bash
# Check unread bookmarks
clinkding bookmarks list --query "unread:yes"

# Get top 5 most recent
clinkding bookmarks list --limit 5
```  

### 从剪贴板保存

```bash
# macOS
pbpaste | xargs -I {} clinkding bookmarks create {}

# Linux
xclip -o | xargs -I {} clinkding bookmarks create {}
```  

### 批量操作

```bash
# Tag multiple bookmarks
for id in 42 43 44; do
  clinkding bookmarks update $id --add-tags "important"
done

# Archive old unread bookmarks
clinkding bookmarks list --query "unread:yes" --added-since "30d" --plain | \
  while read id _; do
    clinkding bookmarks archive "$id"
  done
```  

### 备份书签

```bash
# Export all bookmarks as JSON
clinkding bookmarks list --json > bookmarks-backup-$(date +%Y%m%d).json

# Export specific tag
clinkding bookmarks list --query "tag:important" --json > important.json
```  

## 全局标志（Global Flags）

所有命令均支持以下标志：

| 标志 | 描述 |
|------|-------------|
| `-c, --config <file>` | 配置文件路径 |
| `-u, --url <url>` | linkding 实例 URL |
| `-t, --token <token>` | API token |
| `--json` | 以 JSON 格式输出 |
| `--plain` | 以纯文本格式输出 |
| `--no-color` | 禁用颜色输出 |
| `-q, --quiet` | 最小化输出 |
| `-v, --verbose` | 详细输出（verbose output） |

## 退出码（Exit Codes）

| 代码 | 含义 |
|------|---------|
| 0 | 成功 |
| 1 | 一般错误（API/网络） |
| 2 | 无效用法（参数/标志错误） |
| 3 | 认证错误 |
| 4 | 未找到 |
| 130 | 被中断（Ctrl-C） |

## 故障排查（Troubleshooting）

### 测试配置

```bash
# Verify settings
clinkding config show

# Test connection
clinkding config test
```  

### 常见问题

**认证错误（Authentication Error）：**  
- 在 linkding 网页界面中确认 API token 是否正确  
- 检查 URL 是否包含协议（`https://`）  
- 移除 URL 末尾的斜杠（trailing slashes）  

**命令专属帮助：**  
```bash
clinkding bookmarks --help
clinkding bookmarks create --help
```  

## 相关链接

- **GitHub：** https://github.com/daveonkels/clinkding  
- **Linkding：** https://github.com/sissbruecker/linkding  
- **Homebrew：** `brew install daveonkels/tap/clinkding`  

## 安装

### Homebrew（macOS/Linux）

```bash
brew install daveonkels/tap/clinkding
```  

### Go 安装

```bash
go install github.com/daveonkels/clinkding@latest
```  

### 二进制下载

请从 [releases](https://github.com/daveonkels/clinkding/releases) 下载对应平台的预编译二进制文件。

## Shell 补全（Shell Completion）

```bash
# Bash
clinkding completion bash > /etc/bash_completion.d/clinkding

# Zsh
clinkding completion zsh > "${fpath[1]}/_clinkding"

# Fish
clinkding completion fish > ~/.config/fish/completions/clinkding.fish
```  

---

**作者：** [@daveonkels](https://github.com/daveonkels)  
**许可证：** MIT  

## Agent 工作流：智能书签创建

### 带自动元数据的 URL 添加

当用户说“将此添加到 linkding”或“保存此 URL”时，请遵循以下工作流：

**1. 从 URL 提取元数据**

使用 `summarize` skill 获取标题与描述：

```bash
# Get page metadata
summarize url https://example.com --format json
```  

返回结构化数据，包括：  
- 标题（Title）  
- 描述/摘要（Description/summary）  
- 主要内容（Main content）  

**2. 从内容推断合适标签**

仅映射至 **现有规范标签（existing canonical tags）**。切勿创建新标签。

使用此规范标签列表（共 263 个标签）：  
- **技术（Tech）：** webdev、design、programming、ai、cloud、devops、docker、linux、networking、security、privacy  
- **内容（Content）：** content、media、photography、video、audio、books、podcasting  
- **商业（Business）：** business、marketing、ecommerce、finance、career、productivity  
- **家居（Home）：** smart-home、home-assistant、esphome、iot、home-improvement  
- **工具（Tools）：** tools、cli、git、github、editor、reference、documentation  
- **数据（Data）：** data、analytics、mysql、nosql  
- **通信（Communication）：** communication、email、messaging、slack  
- **教育（Education）：** education、guide、howto、research、testing  
- **地点（Locations）：** texas、seattle、dallas（谨慎使用）  

**标签选择规则：**  
- 最多使用 2–5 个标签  
- 选择最具体且适用的标签  
- 若不确定，优先选用更宽泛的类别（例如，优先选 `tools` 而非 `generator`）  
- 首先检查已有标签：`clinkding tags list --plain | grep -i <keyword>`  
- 切勿创建如下标签：`awesome`、`cool`、`interesting`、`resources`、`tips`  

**3. 使用元数据创建书签**

```bash
clinkding bookmarks create "https://example.com" \
  --title "Title from summarize" \
  --description "Summary from summarize (1-2 sentences)" \
  --tags "webdev,tools,reference"
```  

### 示例工作流

**用户：** “将此保存至 linkding：https://github.com/awesome/project”

**Agent 操作：**  

```bash
# 1. Check if already bookmarked
clinkding bookmarks check https://github.com/awesome/project

# 2. Get metadata (use summarize skill)
summarize url https://github.com/awesome/project --format json

# 3. Analyze content and infer tags
# From summary: "A CLI tool for Docker container management"
# Canonical tags: docker, devops, cli, tools

# 4. Create bookmark
clinkding bookmarks create https://github.com/awesome/project \
  --title "Awesome Project - Docker Container CLI" \
  --description "Command-line tool for managing Docker containers with enhanced features" \
  --tags "docker,devops,cli"
```  

### 标签映射启发式规则（Tag Mapping Heuristics）

使用以下规则将内容映射至规范标签：

| 内容类型 | 规范标签 |
|--------------|----------------|
| Web 开发、HTML、CSS、JavaScript | `webdev`、`css`、`javascript` |
| React、框架、前端 | `webdev`、`react` |
| 设计、UI/UX、原型图 | `design` |
| Python、Go、Ruby 代码 | `programming`、`python`/`ruby` |
| Docker、K8s、DevOps | `docker`、`devops`、`cloud` |
| 家居自动化、ESP32、传感器 | `smart-home`、`esphome`、`iot` |
| AI、ML、LLM | `ai`、`llm` |
| 生产力工具、工作流 | `productivity`、`tools` |
| 金融、投资、加密货币 | `finance` |
| 市场营销、SEO、广告 | `marketing` |
| 购物、优惠、商店 | `ecommerce` |
| 教程、指南、文档 | `guide`、`howto`、`documentation` |
| 安全、隐私、加密 | `security`、`privacy` |
| 本地（达拉斯/西雅图） | `texas`、`seattle` |

### 创建前验证

务必执行以下检查：

```bash
# 1. Does URL already exist?
clinkding bookmarks check <url>

# 2. Do the tags exist?
clinkding tags list --plain | grep -iE "^(tag1|tag2|tag3)$"

# 3. Are we using canonical tags?
# Cross-reference against the 263 canonical tags
# Never create new tags without explicit user request
```  

### 用户请求保存多个链接

若用户提供多个 URL：

```bash
# Process each URL separately with metadata extraction
for url in url1 url2 url3; do
  # Get metadata
  # Infer tags
  # Create bookmark
done
```  

### 更新现有书签

若用户说“更新该书签”或“为我上次保存的内容添加标签”：

```bash
# Get most recent bookmark
recent_id=$(clinkding bookmarks list --limit 1 --plain | cut -f1)

# Add tags (don't remove existing ones unless asked)
clinkding bookmarks update $recent_id --add-tags "new-tag"

# Update description
clinkding bookmarks update $recent_id --description "Updated notes"
```  

### 关键原则

1. **始终获取元数据** — 使用 `summarize` 获取优质标题与描述  
2. **复用现有标签** — 未经核查规范标签列表，绝不创建新标签  
3. **保持精简** — 最多 2–5 个标签，选择最具体且适用者  
4. **先验证再创建** — 创建前务必检查是否重复  
5. **提供上下文** — 包含简短说明，解释其价值所在  

---

## 当前规范标签结构

Dave 的 linkding 实例经整合去重后，共保留 **263 个规范标签**（原含 17,189 个重复标签）。

按书签数量排序的顶级分类：  
- `pinboard`（4,987）— 历史导入标签  
- `ifttt`（2,639）— 历史导入标签  
- `webdev`（1,679）— Web 开发  
- `design`（561）— 设计/UI/UX  
- `content`（416）— 内容/写作  
- `cloud`（383）— 云服务/托管/SaaS  
- `business`（364）— 商业/战略  
- `ecommerce`（308）— 购物/市场  
- `smart-home`（295）— 家居自动化  
- `productivity`（291）— 生产力工具  

**黄金法则：** 拿不准时，请选用更宽泛的现有标签，而非创建新的具体标签。  
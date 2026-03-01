---
name: craft-cli
description: 通过 `craft` CLI 工具与 Craft 文档交互。快速、轻量、专为大语言模型（LLM）优化。
description_zh: 通过 `craft` CLI 工具与 Craft 文档交互。快速、轻量、专为大语言模型（LLM）优化。
---
# Craft CLI 技能

通过 `craft` CLI 工具与 Craft 文档交互。快速、轻量、专为大语言模型（LLM）优化。

## 安装

`craft` CLI 二进制文件应安装于 `/usr/local/bin/craft`。

若尚未安装：
```bash
curl -L https://github.com/nerveband/craft-cli/releases/download/v1.0.0/craft-darwin-arm64 -o craft
chmod +x craft
sudo mv craft /usr/local/bin/
```

## 配置

当前可用两个 Craft 工作区（Spaces）：

### wavedepth 工作区（商务用途）
```bash
~/clawd/skills/craft-cli/craft config set-api https://connect.craft.do/links/5VruASgpXo0/api/v1
```

### 个人工作区
```bash
~/clawd/skills/craft-cli/craft config set-api https://connect.craft.do/links/HHRuPxZZTJ6/api/v1
```

### 快速切换（辅助脚本）
```bash
# Switch to wavedepth space
~/clawd/skills/craft-cli/craft-helper.sh wavedepth

# Switch to personal space
~/clawd/skills/craft-cli/craft-helper.sh personal

# Check current space
~/clawd/skills/craft-cli/craft-helper.sh current
```

**检查当前配置：**  
```bash
~/clawd/skills/craft-cli/craft config get-api
```

## 命令

### 列出文档
```bash
# JSON format (default - LLM-friendly)
~/clawd/skills/craft-cli/craft list

# Human-readable table
~/clawd/skills/craft-cli/craft list --format table

# Markdown format
~/clawd/skills/craft-cli/craft list --format markdown
```

### 搜索文档
```bash
# Search for documents
~/clawd/skills/craft-cli/craft search "query terms"

# With table output
~/clawd/skills/craft-cli/craft search "query" --format table
```

### 获取文档
```bash
# Get document by ID (JSON)
~/clawd/skills/craft-cli/craft get <document-id>

# Save to file
~/clawd/skills/craft-cli/craft get <document-id> --output document.md

# Different format
~/clawd/skills/craft-cli/craft get <document-id> --format markdown
```

### 创建文档
```bash
# Create with title only
~/clawd/skills/craft-cli/craft create --title "My New Document"

# Create from file
~/clawd/skills/craft-cli/craft create --title "My Document" --file content.md

# Create with inline markdown
~/clawd/skills/craft-cli/craft create --title "Quick Note" --markdown "# Hello\nThis is content"

# Create as child of another document
~/clawd/skills/craft-cli/craft create --title "Child Doc" --parent <parent-id>
```

### 更新文档
```bash
# Update title
~/clawd/skills/craft-cli/craft update <document-id> --title "New Title"

# Update from file
~/clawd/skills/craft-cli/craft update <document-id> --file updated-content.md

# Update with inline markdown
~/clawd/skills/craft-cli/craft update <document-id> --markdown "# Updated\nNew content"

# Update both title and content
~/clawd/skills/craft-cli/craft update <document-id> --title "New Title" --file content.md
```

### 删除文档
```bash
~/clawd/skills/craft-cli/craft delete <document-id>
```

### 信息类命令
```bash
# Show API info and recent documents
~/clawd/skills/craft-cli/craft info

# List all available documents
~/clawd/skills/craft-cli/craft docs
```

### 版本查询
```bash
~/clawd/skills/craft-cli/craft version
```

## 输出格式

- **json**（默认）：机器可读 JSON 格式，适用于 LLM 和脚本  
- **table**：人类可读的表格格式  
- **markdown**：Markdown 格式化输出  

可在配置中设定默认格式，或在各命令中使用 `--format` 标志临时指定。

## API URL 覆盖（Override）

可在任意命令中覆盖已配置的 API URL：  
```bash
~/clawd/skills/craft-cli/craft list --api-url https://connect.craft.do/links/ANOTHER_LINK/api/v1
```

## 错误处理

CLI 提供清晰的错误消息及退出码：

- **退出码 0**：成功  
- **退出码 1**：用户错误（输入无效、参数缺失）  
- **退出码 2**：API 错误（服务端问题）  
- **退出码 3**：配置错误  

常见错误：  
- `authentication failed. Check API URL` — API URL 无效或未授权  
- `resource not found` — 文档 ID 不存在  
- `rate limit exceeded. Retry later` — 请求过于频繁  
- `no API URL configured. Run 'craft config set-api <url>' first` — 配置缺失  

## 使用示例

### 工作流：列出并搜索文档  
```bash
# List all documents in wavedepth space
~/clawd/skills/craft-cli/craft config set-api https://connect.craft.do/links/5VruASgpXo0/api/v1
~/clawd/skills/craft-cli/craft list --format table

# Search for specific documents
~/clawd/skills/craft-cli/craft search "proposal" --format table
```

### 工作流：创建并更新文档  
```bash
# Create a new document
~/clawd/skills/craft-cli/craft create --title "Project Notes" --markdown "# Initial notes\n\nStart here."

# Get the document ID from output, then update
~/clawd/skills/craft-cli/craft update <doc-id> --title "Updated Project Notes"

# Verify the update
~/clawd/skills/craft-cli/craft get <doc-id> --format markdown
```

### 工作流：导出文档  
```bash
# Get a specific document and save to file
~/clawd/skills/craft-cli/craft get <doc-id> --output exported-notes.md
```

### 大语言模型（LLM）集成  
```bash
# Get all documents as JSON (pipe to processing)
~/clawd/skills/craft-cli/craft list | jq '.[] | {id, title}'

# Search and extract specific fields
~/clawd/skills/craft-cli/craft search "meeting" | jq '.[].title'
```

## 使用提示

1. **默认使用 JSON 格式** 以适配 LLM 消费（此为默认格式）  
2. **向人类展示结果时使用 table 格式**  
3. **执行操作前务必检查配置**：`craft config get-api`  
4. **使用 `craft config set-api <url>` 轻松切换工作区**  
5. **如需临时覆盖 API URL，请使用 `--api-url` 标志，而非修改配置文件**  

## GitHub 仓库

源代码与文档地址：https://github.com/nerveband/craft-cli

## 版本

当前版本：1.6.0
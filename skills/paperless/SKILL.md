---
name: paperless
name_zh: Paperless
description: 通过 ppls CLI 与 Paperless-NGX 文档管理系统交互。搜索、检索、上传及组织文档。
description_zh: 通过 ppls CLI 与 Paperless-NGX 文档管理系统交互。搜索、检索、上传及组织文档。
emoji: 📄
metadata: {"clawdbot":{"requires":{"bins":["ppls"]},"install":[{"id":"node","kind":"node","package":"@nickchristensen/ppls","bins":["ppls"],"label":"安装 ppls CLI（npm/bun）"}]}}
---
# Paperless-NGX CLI

使用 `ppls` CLI 搜索并管理您的 Paperless-NGX 安装中的文档。

## 什么是 Paperless-NGX？

[Paperless-NGX](https://docs.paperless-ngx.com/) 是一款文档管理系统，可扫描、OCR（光学字符识别）并整理您的文档。`ppls` CLI 提供命令行接口，用于搜索、下载、上传及管理您的无纸化文档库。

## 设置

通过 npm/bun 安装：

```bash
npm install -g @nickchristensen/ppls
# or
bun add -g @nickchristensen/ppls
```

配置连接：

```bash
ppls config set hostname http://your-paperless-host
ppls config set token your-api-token
```

或使用环境变量：
```bash
export PPLS_HOSTNAME=http://your-paperless-host
export PPLS_TOKEN=your-api-token
```

## 常用命令

### 搜索文档

```bash
# Search by name/title
ppls documents list --name-contains "invoice" --json

# Search by specific IDs
ppls documents list --id-in 1234,5678 --json

# Paginate results
ppls documents list --page 2 --page-size 50 --json

# Sort results
ppls documents list --sort created --json
```

### 获取文档详情

```bash
# Show full document metadata (including OCR'd content)
ppls documents show 1234 --json

# Get just the basics
ppls documents show 1234 --plain
```

### 下载文档

```bash
# Download single file
ppls documents download 1234

# Download to path
ppls documents download 1234 --output /tmp/document.pdf

# Download multiple documents
ppls documents download 1234,5678

# Download multiple documents to path
ppls documents download 1234,5678 --output-dir ~/tmp
```

### 上传文档

```bash
# Upload with metadata
ppls documents add receipt.pdf \
  --title "Store Receipt" \
  --correspondent 5 \
  --document-type 2 \
  --tag 10

# Upload without metadata (will be processed by Paperless)
ppls documents add scan.pdf
```

### 管理标签

```bash
# List all tags
ppls tags list --json

# Create a new tag
ppls tags add "Tax Documents" --color "#ff0000"

# Search tags by name
ppls tags list --name-contains "tax" --json
```

### 管理通信方

```bash
# List all correspondents
ppls correspondents list --json

# Create new correspondent
ppls correspondents add "New Vendor"
```

## 常见使用场景

### “查找文件名中包含 ‘tax’ 的文档”

```bash
ppls documents list --name-contains "tax" --json
```

### “显示所有发票”

```bash
ppls documents list --name-contains "invoice" --json
```

### “下载某个特定文档”

```bash
ppls documents show 1234 --json  # Get details first
ppls documents download 1234 --output doc.pdf
```

### “添加一张带元数据的扫描收据”

```bash
ppls documents add receipt.pdf --title "Grocery Receipt" --tag 25 --correspondent 5
```

### “在 OCR 识别的文本内容中搜索特定文字”

```bash
# Get all docs, then search the content field
ppls documents list --json | jq '.[] | select(.content | contains("warranty"))'
```

## 输出格式

ppls 支持多种输出格式：

- `--json` — 机器可读的 JSON 格式（最适合脚本/AI 使用）
- `--plain` — 纯文本格式（简洁、易解析）
- `--table` — 格式化表格（便于人工阅读）

**对于 AI/自动化任务，请始终使用 `--json`**

## 提示

- **JSON 输出**：使用 `jq` 解析复杂查询
- **日期格式**：使用 `--date-format` 自定义（采用 date-fns 令牌）
- **分页**：对大型结果集使用 `--page-size` 和 `--page`
- **ID**：大多数命令接受数字 ID（标签、通信方、文档）

## 相关链接

- **ppls GitHub 仓库**：https://github.com/NickChristensen/ppls
- **Paperless-NGX 文档**：https://docs.paperless-ngx.com/
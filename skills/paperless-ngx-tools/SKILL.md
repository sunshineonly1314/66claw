---
name: paperless-ngx-tools
name_zh: Paperless-NG工具
description: 使用 Paperless-ngx 管理文档——支持搜索、上传、打标签及检索。
description_zh: 使用 Paperless-ngx 管理文档——支持搜索、上传、打标签及检索。
homepage: https://github.com/paperless-ngx/paperless-ngx
metadata: {"clawdbot":{"requires":{"env":["PAPERLESS_URL","PAPERLESS_TOKEN"]},"primaryEnv":"PAPERLESS_TOKEN"}}
---
# Paperless-ngx

通过 Paperless-ngx REST API 实现文档管理。

## 配置

在 `~/.clawdbot/clawdbot.json` 中设置环境变量：

```json
{
  "env": {
    "PAPERLESS_URL": "http://your-paperless-host:8000",
    "PAPERLESS_TOKEN": "your-api-token"
  }
}
```

或通过 skills 条目进行配置（支持使用 `apiKey` 简写）：

```json
{
  "skills": {
    "entries": {
      "paperless-ngx": {
        "env": { "PAPERLESS_URL": "http://your-paperless-host:8000" },
        "apiKey": "your-api-token"
      }
    }
  }
}
```

您的 API 令牌可从 Paperless Web 界面获取：设置 → 用户与组 → [用户] → 生成令牌。

## 快速参考

| 任务 | 命令 |
|------|---------|
| 搜索文档 | `node {baseDir}/scripts/search.mjs "query"` |
| 列出最近文档 | `node {baseDir}/scripts/list.mjs [--limit N]` |
| 获取文档 | `node {baseDir}/scripts/get.mjs <id> [--content]` |
| 上传文档 | `node {baseDir}/scripts/upload.mjs <file> [--title "..."] [--tags "a,b"]` |
| 下载 PDF | `node {baseDir}/scripts/download.mjs <id> [--output path]` |
| 列出标签 | `node {baseDir}/scripts/tags.mjs` |
| 列出类型 | `node {baseDir}/scripts/types.mjs` |
| 列出通信方 | `node {baseDir}/scripts/correspondents.mjs` |

所有脚本均位于 `{baseDir}/scripts/` 目录下。

## 常见工作流

### 查找文档

```bash
# Full-text search
node {baseDir}/scripts/search.mjs "electricity bill december"

# Filter by tag
node {baseDir}/scripts/search.mjs --tag "tax-deductible"

# Filter by document type
node {baseDir}/scripts/search.mjs --type "Invoice"

# Filter by correspondent
node {baseDir}/scripts/search.mjs --correspondent "AGL"

# Combine filters
node {baseDir}/scripts/search.mjs "2025" --tag "unpaid" --type "Invoice"
```

### 获取文档详情

```bash
# Metadata only
node {baseDir}/scripts/get.mjs 28

# Include OCR text content
node {baseDir}/scripts/get.mjs 28 --content

# Full content (no truncation)
node {baseDir}/scripts/get.mjs 28 --content --full
```

### 上传文档

```bash
# Basic upload (title auto-detected)
node {baseDir}/scripts/upload.mjs /path/to/invoice.pdf

# With metadata
node {baseDir}/scripts/upload.mjs /path/to/invoice.pdf \
  --title "AGL Electricity Jan 2026" \
  --tags "unpaid,utility" \
  --type "Invoice" \
  --correspondent "AGL" \
  --created "2026-01-15"
```

### 下载文档

```bash
# Download to current directory
node {baseDir}/scripts/download.mjs 28

# Specify output path
node {baseDir}/scripts/download.mjs 28 --output ~/Downloads/document.pdf

# Get original (not archived/OCR'd version)
node {baseDir}/scripts/download.mjs 28 --original
```

### 管理元数据

```bash
# List all tags
node {baseDir}/scripts/tags.mjs

# List document types
node {baseDir}/scripts/types.mjs

# List correspondents
node {baseDir}/scripts/correspondents.mjs

# Create new tag
node {baseDir}/scripts/tags.mjs --create "new-tag-name"

# Create new correspondent
node {baseDir}/scripts/correspondents.mjs --create "New Company Name"
```

## 输出格式

所有脚本均输出 JSON 格式，便于解析。可使用 `jq` 进行格式化：

```bash
node {baseDir}/scripts/search.mjs "invoice" | jq '.results[] | {id, title, created}'
```

## 高级用法

如需执行复杂查询或批量操作，请参阅 [references/api.md](references/api.md) 中关于直接调用 API 的模式说明。

## 故障排除

**“PAPERLESS_URL 未设置”** —— 请将其添加至 `~/.clawdbot/clawdbot.json` 的 env 区域，或在 shell 中执行 export 命令。

**“401 Unauthorized”** —— 请检查 PAPERLESS_TOKEN 是否有效；如有必要，可在 Paperless 界面中重新生成。

**“Connection refused”** —— 请确认 Paperless 正在运行，且 URL 正确（注意包含端口号）。

**上传静默失败** —— 请检查 Paperless 日志；可能因文件重复或格式不受支持所致。
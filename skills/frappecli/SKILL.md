---
name: frappecli
name_zh: Frappe CLI
version: 0.1.0
description: Frappe Framework / ERPNext 实例的命令行工具。当用户提及“Frappe”、“ERPNext”、“文档类型（doctypes）”、“Frappe API”，或需要管理文档、文件、报表，或在 Frappe 站点上调用 RPC 方法时，请使用本技能。
description_zh: Frappe Framework / ERPNext 实例的命令行工具。当用户提及“Frappe”、“ERPNext”、“文档类型（doctypes）”、“Frappe API”，或需要管理文档、文件、报表，或在 Frappe 站点上调用 RPC 方法时，请使用本技能。
tools: [bash]
---
# frappecli

通过 REST API 管理 Frappe Framework 实例的命令行工具。

## 安装

```bash
brew tap pasogott/tap
brew install frappecli
```

或从源码安装：
```bash
git clone https://github.com/pasogott/frappecli.git
cd frappecli && uv sync && uv pip install -e .
```

## 配置

创建 `~/.config/frappecli/config.yaml` 文件：

```yaml
sites:
  production:
    url: https://erp.company.com
    api_key: your_api_key
    api_secret: your_api_secret
  staging:
    url: https://staging.company.com
    api_key: your_staging_key
    api_secret: your_staging_secret

default_site: production
```

## 命令

### 站点管理
```bash
frappecli site doctypes                    # List all doctypes
frappecli site doctypes --module "Core"    # Filter by module
frappecli site info "User"                 # Get doctype details
```

### 文档增删改查（CRUD）
```bash
# List documents
frappecli doc list Customer
frappecli doc list Customer --filters '{"status":"Active"}' --limit 10

# Get single document
frappecli doc get Customer CUST-001
frappecli doc get Customer CUST-001 --fields name,customer_name,status

# Create document
frappecli doc create Customer --data '{"customer_name":"Acme","customer_type":"Company"}'

# Update document
frappecli doc update Customer CUST-001 --data '{"status":"Inactive"}'

# Delete document
frappecli doc delete Customer CUST-001
```

### 文件管理
```bash
# Upload file (private by default)
frappecli file upload invoice.pdf --doctype "Sales Invoice" --docname "INV-001"

# Upload public file
frappecli file upload logo.png --public

# Download file
frappecli file download /private/files/invoice.pdf -o ./downloads/

# List files for document
frappecli file list --doctype "Sales Invoice" --docname "INV-001"
```

### 报表
```bash
# Run report (JSON output)
frappecli report run "General Ledger" --filters '{"company":"My Company"}'

# Export to CSV
frappecli report run "Accounts Receivable" --format csv -o report.csv
```

### RPC 方法调用
```bash
# Call custom method
frappecli rpc frappe.ping

# With arguments
frappecli rpc myapp.api.process_data --args '{"doc_id":"DOC-001"}'
```

### 多站点支持
```bash
# Use specific site
frappecli --site staging doc list Customer

# Switch default site
frappecli config set default_site staging
```

## 输出格式

```bash
frappecli doc list Customer --format table   # Pretty table (default)
frappecli doc list Customer --format json    # JSON
frappecli doc list Customer --format csv     # CSV
```

## 示例

### 批量操作
```bash
# Export all active customers
frappecli doc list Customer --filters '{"status":"Active"}' --format csv > customers.csv

# Get document with child tables
frappecli doc get "Sales Invoice" INV-001 --fields '*'
```

### 与 jq 工具集成
```bash
# Get customer names only
frappecli doc list Customer --format json | jq -r '.[].customer_name'

# Count by status
frappecli doc list Customer --format json | jq 'group_by(.status) | map({status: .[0].status, count: length})'
```

## 相关链接

- **代码仓库：** https://github.com/pasogott/frappecli  
- **Homebrew：** `brew install pasogott/tap/frappecli`  
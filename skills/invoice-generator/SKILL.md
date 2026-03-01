---
name: invoice-generator
name_zh: 发票生成器
description: 基于 JSON 数据生成专业 PDF 发票。当用户需要创建含公司/客户信息及明细项的发票、账单或付款请求时启用。
description_zh: 基于 JSON 数据生成专业 PDF 发票。当用户需要创建含公司/客户信息及明细项的发票、账单或付款请求时启用。
metadata: {"clawdbot":{"emoji":"🧾","requires":{"bins":["node","jq","weasyprint"],"env":["INVOICE_DIR"]},"primaryEnv":"INVOICE_DIR"}}
---
# 发票生成器（Invoice Generator）  

基于结构化 JSON 数据生成 PDF 发票。  

## 初始化配置  

1. 安装 Node.js 依赖：  

```bash
cd invoice-generator && npm install
```  

2. 设置 `INVOICE_DIR` 环境变量（或写入 `skills.entries.invoice-generator.env` 文件）：  

```bash
export INVOICE_DIR="/path/to/your/invoices"
```  

该操作将创建如下目录结构：  
```
$INVOICE_DIR/
├── configs/    # Optional: saved invoice configs
└── invoices/   # Generated PDF output
```  

## 使用方式  

```bash
# From stdin (on-the-fly)
cat invoice-data.json | {baseDir}/scripts/generate.sh

# From a full file path
{baseDir}/scripts/generate.sh /path/to/invoice-data.json

# From a saved config (looks in $INVOICE_DIR/configs/)
{baseDir}/scripts/generate.sh client-template
# Loads: $INVOICE_DIR/configs/client-template.json

# Output goes to: $INVOICE_DIR/invoices/invoice-{number}.pdf (auto-versions if exists)
```  

## 输入数据格式  

JSON 输入必须包含以下字段：  

```json
{
  "company": {
    "name": "Your Company",
    "address": "123 Main St",
    "cityStateZip": "City, State, 12345",
    "country": "Country"
  },
  "client": {
    "name": "Client Name",
    "address": "456 Client Ave",
    "cityStateZip": "City, State, 67890",
    "country": "Country",
    "taxId": "TAX123"
  },
  "invoice": {
    "number": "INV-2025.01",
    "date": "Jan 15 2025",
    "dueDate": "Jan 30 2025"
  },
  "items": [
    {
      "description": "Service description",
      "rate": "1000.00",
      "currency": "USD"
    }
  ],
  "totals": {
    "currency": "USD",
    "total": "1,000.00"
  }
}
```  

完整字段说明详见 [references/data-schema.md](references/data-schema.md)。  

## 输出结果  

脚本成功执行后，将输出所生成 PDF 文件的路径：  

```
$INVOICE_DIR/invoices/invoice-INV-2025.01.pdf
# If that filename already exists, the script will write:
# $INVOICE_DIR/invoices/invoice-INV-2025.01-2.pdf (then -3, etc.)
```  

## 错误处理  

- 若 JSON 格式无效或缺失必需字段，则以退出码 1 终止  
- 若 weasyprint 无法生成 PDF，则以退出码 2 终止  
- 所有错误信息均输出至 stderr  
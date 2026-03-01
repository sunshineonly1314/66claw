---
name: kagi-search
name_zh: Kagi 搜索
description: 使用 Kagi Search API 进行网页搜索。适用于需要检索当前信息、事实或参考资料的场景。需在环境中设置 KAGI_API_KEY。
description_zh: 使用 Kagi Search API 进行网页搜索。适用于需要检索当前信息、事实或参考资料的场景。需在环境中设置 KAGI_API_KEY。
---
> **Note:** The Kagi Search API is currently in beta. To request API access, email support@kagi.com. You must be a Kagi subscriber to use the API.
---

# Kagi 搜索命令行工具（CLI）

使用 Kagi Search API 进行网页搜索，并以简洁、易读的格式输出结果。

## 快速开始

```bash
export KAGI_API_KEY="your_api_key"
kagi-search "your search query"
# or run directly:
python3 scripts/kagi-search.py "your search query"
```

## 功能特性

- **简洁输出** — 每条结果包含标题、URL、摘要及元数据  
- **分页支持** — 可控制结果数量与偏移量  
- **JSON 模式** — 输出原始 JSON 格式，便于脚本调用  
- **相关搜索** — 显示关联查询（可隐藏）  
- **API 配额** — 显示剩余 API 调用额度  
- **快速轻量** — 纯 Python 实现，无外部依赖  

## 选项

| 标志 | 描述 |
|------|------|
| `query` | 搜索关键词（必需） |
| `-n, --limit` | 返回结果数量（默认：10） |
| `-s, --offset` | 分页偏移量（默认：0） |
| `--json` | 输出原始 JSON |
| `--no-related` | 隐藏相关搜索 |
| `-h, --help` | 显示帮助信息 |

## 示例

```bash
# Basic search
kagi-search "python async await tutorial"

# Limit results
kagi-search "AI news" --limit 5

# Pagination
kagi-search "recipes" --offset 10 --limit 5

# JSON for scripting
kagi-search "github stars" --json | jq '.data[].url'

# Hide related searches
kagi-search "rust programming" --no-related
```

## 安装配置

**环境要求：**  
```bash
export KAGI_API_KEY="your_api_key"
# Add to ~/.bashrc or ~/.zshrc for persistence
```

**PATH 访问：**  
```bash
# Make executable and add to PATH
chmod +x scripts/kagi-search.py
cp scripts/kagi-search.py ~/.local/bin/kagi-search
```

## 系统要求

- Python 3.7 或更高版本  
- `KAGI_API_KEY` 环境变量  
- 网络连接  

## 输出格式

```
[Query: search terms]
[Results: 5]
[API Balance: $0.123]
[Time: 45ms]
----------------------------------------
=== Result Title ===
https://example.com
Snippet text here...
[2024-01-15]
---
Related: related query 1, related query 2
```
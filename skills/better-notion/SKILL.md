---
name: better-notion
name_zh: Better Notion
description: 对 Notion 页面、数据库和区块执行完整的 CRUD 操作。支持创建、读取、更新、删除、搜索与查询。
description_zh: 对 Notion 页面、数据库和区块执行完整的 CRUD 操作。支持创建、读取、更新、删除、搜索与查询。
metadata: {"clawdbot":{"emoji":"📝"}}
---
# Notion

使用 Notion API 管理页面、数据源（数据库）及区块。

## 配置

```bash
mkdir -p ~/.config/notion
echo "ntn_your_key_here" > ~/.config/notion/api_key
```

在 Notion UI 中，将目标页面/数据库共享给您的集成应用。

## API 基础知识

```bash
NOTION_KEY=$(cat ~/.config/notion/api_key)
curl -X POST "https://api.notion.com/v1/..." \
  -H "Authorization: Bearer $NOTION_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json"
```

## 常见操作

```bash
# Search
curl -X POST "https://api.notion.com/v1/search" -d '{"query": "title"}'

# Get page
curl "https://api.notion.com/v1/pages/{page_id}"

# Get page blocks
curl "https://api.notion.com/v1/blocks/{page_id}/children"

# Create page in database
curl -X POST "https://api.notion.com/v1/pages" -d '{
  "parent": {"data_source_id": "xxx"},
  "properties": {"Name": {"title": [{"text": {"content": "Item"}}]}}
}'

# Query database
curl -X POST "https://api.notion.com/v1/data_sources/{id}/query" -d '{
  "filter": {"property": "Status", "select": {"equals": "Active"}}
}'

# Update page
curl -X PATCH "https://api.notion.com/v1/pages/{page_id}" -d '{
  "properties": {"Status": {"select": {"name": "Done"}}}
}'

# Add blocks
curl -X PATCH "https://api.notion.com/v1/blocks/{page_id}/children" -d '{
  "children": [{"type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": "Text"}}]}}]
}'

# Delete page or block (moves to trash)
curl -X DELETE "https://api.notion.com/v1/blocks/{block_id}"

# Restore from trash (set archived to false)
curl -X PATCH "https://api.notion.com/v1/blocks/{block_id}" -d '{"archived": false}'
```

## 属性类型

| 类型 | 格式 |
|------|--------|
| 标题 | `{"title": [{"text": {"content": "..."}}]}` |
| 文本 | `{"rich_text": [{"text": {"content": "..."}}]}` |
| 单选 | `{"select": {"name": "Option"}}` |
| 多选 | `{"multi_select": [{"name": "A"}]}` |
| 日期 | `{"date": {"start": "2024-01-15"}}` |
| 复选框 | `{"checkbox": true}` |
| 数字 | `{"number": 42}` |
| URL | `{"url": "https://..."}` |

## 2025-09-03 API 说明

- 数据库 = API 中的“数据源”  
- 使用 `data_source_id` 创建页面及查询数据  
- 从搜索结果中获取 `data_source_id`（即 `id` 字段）  
- 速率限制：约每秒 3 次请求  
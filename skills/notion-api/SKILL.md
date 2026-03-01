---
name: notion-api
name_zh: Notion API
description: 通用 Notion API 命令行工具（Node），支持搜索、查询数据源（数据库）以及创建页面。通过环境变量 NOTION_KEY（或配置文件 ~/.config/notion/api_key）进行配置。
description_zh: 通用 Notion API 命令行工具（Node），支持搜索、查询数据源（数据库）以及创建页面。通过环境变量 NOTION_KEY（或配置文件 ~/.config/notion/api_key）进行配置。
---
# notion-api（通用）

该 skill 提供了一个轻量级、基于 Node 的 Notion API 命令行工具（CLI）。其设计目标是可共享：**不硬编码数据库 ID，且代码仓库中不包含任何密钥**。

## 认证（Auth）

请通过以下任一方式提供 Notion 集成令牌（integration token）：

- `NOTION_KEY` 环境变量，或  
- `~/.config/notion/api_key` 文件（首行）

同时，请确保目标页面/数据库已在 Notion 中与您的集成完成共享。

## 命令（CLI）

运行方式：

- `node scripts/notion-api.mjs <command> ...`

### 搜索

```bash
node scripts/notion-api.mjs search "query" --page-size 10
```

### 查询数据源（数据库查询）

```bash
node scripts/notion-api.mjs query --data-source-id <DATA_SOURCE_ID> --page-size 10
# optionally pass raw JSON body:
node scripts/notion-api.mjs query --data-source-id <ID> --body '{"filter": {...}, "sorts": [...], "page_size": 10}'
```

### 在数据库中创建页面

```bash
node scripts/notion-api.mjs create-page --database-id <DATABASE_ID> --title "My item" --title-prop Name
```

## 输出

所有命令均向 stdout 输出 JSON 格式内容。

## 注意事项

- Notion API 版本请求头默认为 `2025-09-03`（可通过 `NOTION_VERSION` 覆盖）。
- 受限于速率限制（rate limits）；建议优先使用 `page_size` 并尽量减少调用次数。
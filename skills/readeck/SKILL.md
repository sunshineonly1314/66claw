---
name: readeck
name_zh: Readeck
description: Readeck 集成，用于保存和管理文章。支持添加 URL、列出条目，以及通过 Readeck API 管理书签。可为每次请求配置自定义 URL 和 API 密钥，或通过环境变量 READECK_URL 和 READECK_API_KEY 进行配置。
description_zh: Readeck 集成，用于保存和管理文章。支持添加 URL、列出条目，以及通过 Readeck API 管理书签。可为每次请求配置自定义 URL 和 API 密钥，或通过环境变量 READECK_URL 和 READECK_API_KEY 进行配置。
---
# Readeck 集成

## 配置

通过以下方式配置 Readeck 访问权限：
- 请求参数：`url` 和 `apiKey`
- 环境变量：`READECK_URL` 和 `READECK_API_KEY`

## 核心操作

### 添加文章

将一个 URL 添加至 Readeck，以进行解析与保存：

```bash
curl -X POST "$READECK_URL/api/bookmarks" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'
```

响应中包含 `id`、`url` 和 `title`。

### 列出条目

获取已保存的文章：

```bash
curl "$READECK_URL/api/bookmarks?limit=20" \
  -H "Authorization: Bearer $READECK_API_KEY"
```

查询参数：`page`、`limit`、`status`、`search`。

### 获取单个条目

```bash
curl "$READECK_URL/api/bookmarks/$ID" \
  -H "Authorization: Bearer $READECK_API_KEY"
```

### 删除条目

```bash
curl -X DELETE "$READECK_URL/api/bookmarks/$ID" \
  -H "Authorization: Bearer $READECK_API_KEY"
```

### 标记为已读

```bash
curl -X PUT "$READECK_URL/api/bookmarks/$ID/status" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "read"}'
```

## 常见模式

**带标签保存：**  
```json
{"url": "https://example.com", "tags": ["tech", "readlater"]}
```

**保存至特定收藏集：**  
```json
{"url": "https://example.com", "collection": "my-collection"}
```

**按状态筛选：** `unread`、`read`、`archived`

## 错误处理

- `401`：API 密钥无效  
- `404`：条目未找到  
- `422`：URL 或请求体无效  
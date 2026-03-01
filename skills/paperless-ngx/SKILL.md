---
name: paperless-ngx
name_zh: Paperless-NG
description: 通过 REST API 与 Paperless-ngx 文档管理系统交互。当用户希望在其 Paperless-ngx 实例中搜索、上传、下载、组织文档，或管理标签、通信方及文档类型时使用。
description_zh: 通过 REST API 与 Paperless-ngx 文档管理系统交互。当用户希望在其 Paperless-ngx 实例中搜索、上传、下载、组织文档，或管理标签、通信方及文档类型时使用。
---
# Paperless-ngx 技能（agent）

通过 HTTP 请求，利用 Paperless-ngx 的 REST API 管理文档。

## 配置

需设置以下环境变量：
- `PAPERLESS_URL`：基础 URL（例如 `https://paperless.example.com`）
- `PAPERLESS_TOKEN`：来自 Paperless-ngx 设置的 API 令牌

## 身份验证

所有请求均须携带令牌：
```
Authorization: Token $PAPERLESS_TOKEN
```

## 核心操作

### 搜索文档

```bash
curl -s "$PAPERLESS_URL/api/documents/?query=invoice" \
  -H "Authorization: Token $PAPERLESS_TOKEN"
```

支持的筛选选项：`correspondent__id`、`document_type__id`、`tags__id__in`、`created__date__gte`、`created__date__lte`、`added__date__gte`。

### 获取文档详情

```bash
curl -s "$PAPERLESS_URL/api/documents/{id}/" \
  -H "Authorization: Token $PAPERLESS_TOKEN"
```

### 下载文档

```bash
# Original file
curl -s "$PAPERLESS_URL/api/documents/{id}/download/" \
  -H "Authorization: Token $PAPERLESS_TOKEN" -o document.pdf

# Archived (OCR'd) version
curl -s "$PAPERLESS_URL/api/documents/{id}/download/?original=false" \
  -H "Authorization: Token $PAPERLESS_TOKEN" -o document.pdf
```

### 上传文档

```bash
curl -s "$PAPERLESS_URL/api/documents/post_document/" \
  -H "Authorization: Token $PAPERLESS_TOKEN" \
  -F "document=@/path/to/file.pdf" \
  -F "title=Document Title" \
  -F "correspondent=1" \
  -F "document_type=2" \
  -F "tags=3" \
  -F "tags=4"
```

可选字段：`title`、`created`、`correspondent`、`document_type`、`storage_path`、`tags`（可重复）、`archive_serial_number`、`custom_fields`。

### 更新文档元数据

```bash
curl -s -X PATCH "$PAPERLESS_URL/api/documents/{id}/" \
  -H "Authorization: Token $PAPERLESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Title", "correspondent": 1, "tags": [1, 2]}'
```

### 删除文档

```bash
curl -s -X DELETE "$PAPERLESS_URL/api/documents/{id}/" \
  -H "Authorization: Token $PAPERLESS_TOKEN"
```

## 组织类端点

### 标签

```bash
# List tags
curl -s "$PAPERLESS_URL/api/tags/" -H "Authorization: Token $PAPERLESS_TOKEN"

# Create tag
curl -s -X POST "$PAPERLESS_URL/api/tags/" \
  -H "Authorization: Token $PAPERLESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Important", "color": "#ff0000"}'
```

### 通信方

```bash
# List correspondents
curl -s "$PAPERLESS_URL/api/correspondents/" -H "Authorization: Token $PAPERLESS_TOKEN"

# Create correspondent
curl -s -X POST "$PAPERLESS_URL/api/correspondents/" \
  -H "Authorization: Token $PAPERLESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "ACME Corp"}'
```

### 文档类型

```bash
# List document types
curl -s "$PAPERLESS_URL/api/document_types/" -H "Authorization: Token $PAPERLESS_TOKEN"

# Create document type
curl -s -X POST "$PAPERLESS_URL/api/document_types/" \
  -H "Authorization: Token $PAPERLESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Invoice"}'
```

## 批量操作

```bash
curl -s -X POST "$PAPERLESS_URL/api/documents/bulk_edit/" \
  -H "Authorization: Token $PAPERLESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [1, 2, 3],
    "method": "add_tag",
    "parameters": {"tag": 5}
  }'
```

支持的方法：`set_correspondent`、`set_document_type`、`add_tag`、`remove_tag`、`delete`、`reprocess`。

## 任务状态

上传完成后，请检查任务状态：
```bash
curl -s "$PAPERLESS_URL/api/tasks/?task_id={uuid}" \
  -H "Authorization: Token $PAPERLESS_TOKEN"
```

## 响应处理

- 列表类端点返回 `{"count": N, "results": [...]}` 并启用分页  
- 单个对象端点直接返回该对象  
- 使用 `?page=2` 进行分页  
- 添加 `?ordering=-created` 实现排序（降序时前缀为 `-`）
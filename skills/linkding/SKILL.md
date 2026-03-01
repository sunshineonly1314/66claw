---
name: linkding
name_zh: Linkding
version: 1.0.1
description: 使用 Linkding 管理书签。当用户提出如下请求时启用本 skill：“保存一个书签”、“添加链接”、“搜索书签”、“列出我的书签”、“查找已保存的链接”、“为书签打标签”、“归档书签”、“检查某 URL 是否已保存”、“列出标签”、“创建合集（bundle）”，或提及 Linkding 书签管理相关操作。
description_zh: 使用 Linkding 管理书签。当用户提出如下请求时启用本 skill：“保存一个书签”、“添加链接”、“搜索书签”、“列出我的书签”、“查找已保存的链接”、“为书签打标签”、“归档书签”、“检查某 URL 是否已保存”、“列出标签”、“创建合集（bundle）”，或提及 Linkding 书签管理相关操作。
---
# Linkding 书签管理器

通过 Linkding REST API 查询与管理书签。

## 设置

配置文件路径：`~/.clawdbot/credentials/linkding/config.json`

```json
{
  "url": "https://linkding.example.com",
  "apiKey": "your-api-token"
}
```

请从 Linkding 设置页面获取您的 API Token。

## 快速参考

### 列出/搜索书签

```bash
# List recent bookmarks
./scripts/linkding-api.sh bookmarks

# Search bookmarks
./scripts/linkding-api.sh bookmarks --query "python tutorial"

# List archived
./scripts/linkding-api.sh bookmarks --archived

# Filter by date
./scripts/linkding-api.sh bookmarks --modified-since "2025-01-01T00:00:00Z"
```

### 创建书签

```bash
# Basic
./scripts/linkding-api.sh create "https://example.com"

# With metadata
./scripts/linkding-api.sh create "https://example.com" \
  --title "Example Site" \
  --description "A great resource" \
  --tags "reference,docs"

# Archive immediately
./scripts/linkding-api.sh create "https://example.com" --archived
```

### 检查 URL 是否已存在

```bash
./scripts/linkding-api.sh check "https://example.com"
```

若已存在，则返回对应书签数据及抓取的元数据。

### 更新书签

```bash
./scripts/linkding-api.sh update 123 --title "New Title" --tags "newtag1,newtag2"
```

### 归档/取消归档

```bash
./scripts/linkding-api.sh archive 123
./scripts/linkding-api.sh unarchive 123
```

### 删除书签

```bash
./scripts/linkding-api.sh delete 123
```

### 标签

```bash
# List all tags
./scripts/linkding-api.sh tags

# Create tag
./scripts/linkding-api.sh tag-create "mytag"
```

### 合集（已保存搜索）

```bash
# List bundles
./scripts/linkding-api.sh bundles

# Create bundle
./scripts/linkding-api.sh bundle-create "Work Resources" \
  --search "productivity" \
  --any-tags "work,tools" \
  --excluded-tags "personal"
```

## 响应格式

所有响应均为 JSON 格式。书签对象结构如下：

```json
{
  "id": 1,
  "url": "https://example.com",
  "title": "Example",
  "description": "Description",
  "notes": "Personal notes",
  "is_archived": false,
  "unread": false,
  "shared": false,
  "tag_names": ["tag1", "tag2"],
  "date_added": "2020-09-26T09:46:23.006313Z",
  "date_modified": "2020-09-26T16:01:14.275335Z"
}
```

## 常见使用模式

**保存当前网页以备后用：**  
```bash
./scripts/linkding-api.sh create "$URL" --tags "toread" --unread
```

**快速搜索并显示结果：**  
```bash
./scripts/linkding-api.sh bookmarks --query "keyword" --limit 10 | jq -r '.results[] | "\(.title) - \(.url)"'
```

**批量更新标签：** 通过 API PATCH 请求传入新的 `tag_names` 数组完成更新。
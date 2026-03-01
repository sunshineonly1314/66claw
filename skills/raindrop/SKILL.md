---
name: raindrop
name_zh: Raindrop
description: 通过 CLI 搜索、列出及管理 Raindrop.io 书签。当用户希望查找已保存链接、浏览收藏夹、新增书签、用标签组织内容、在不同收藏夹间移动书签，或操作其 Raindrop 书签库时使用。支持读取操作（搜索、列出、获取、标签）与写入操作（添加、删除、移动、更新、批量操作）。
description_zh: 通过 CLI 搜索、列出及管理 Raindrop.io 书签。当用户希望查找已保存链接、浏览收藏夹、新增书签、用标签组织内容、在不同收藏夹间移动书签，或操作其 Raindrop 书签库时使用。支持读取操作（搜索、列出、获取、标签）与写入操作（添加、删除、移动、更新、批量操作）。
metadata: {"clawdbot":{"emoji":"🌧️","homepage":"https://raindrop.io","requires":{"bins":["bash","curl","jq","bc"]}}}
---
# Raindrop.io 书签

通过 Raindrop.io API 管理书签。

## 配置

```bash
# Get token from: https://app.raindrop.io/settings/integrations → "Create test token"
echo 'RAINDROP_TOKEN="your-token"' > ~/.config/raindrop.env
```

## 快速入门

```bash
# Search bookmarks
{baseDir}/scripts/raindrop.sh search "AI tools"

# List unsorted bookmarks
{baseDir}/scripts/raindrop.sh list -1 --limit 50

# Count unsorted
{baseDir}/scripts/raindrop.sh count -1

# Create collection and move bookmarks
{baseDir}/scripts/raindrop.sh create-collection "AI Coding"
{baseDir}/scripts/raindrop.sh move 12345 66016720

# Bulk move (efficient!)
{baseDir}/scripts/raindrop.sh bulk-move "123,456,789" 66016720
```

## 命令

### 读取操作

| 命令 | 描述 |
|------|------|
| `whoami` | 显示已认证用户信息 |
| `collections` | 列出所有收藏夹及其 ID |
| `list [ID]` | 列出书签（默认：0 = 全部） |
| `count [ID]` | 统计收藏夹内书签数量 |
| `search QUERY [ID]` | 搜索书签 |
| `get ID` | 获取书签详细信息 |
| `tags` | 列出所有标签及其出现次数 |
| `list-untagged [ID]` | 查找未打标签的书签 |
| `cache ID` | 获取永久副本（仅限 Pro 用户） |

### 写入操作

| 命令 | 描述 |
|------|------|
| `add URL [ID]` | 添加书签（默认：-1 = 未分类） |
| `delete ID` | 删除书签 |
| `create-collection NAME` | 创建新收藏夹 |
| `move ID COLLECTION` | 将书签移入指定收藏夹 |
| `update ID [opts]` | 更新标签/标题/所属收藏夹 |
| `bulk-move IDS TARGET [SOURCE]` | 批量移动多条书签（源收藏夹默认为 -1/未分类） |
| `suggest URL` | 获取 AI 推荐的标签/标题 |

### 参数选项

| 参数 | 描述 |
|------|------|
| `--json` | 原始 JSON 输出 |
| `--limit N` | 最大返回结果数（默认：25） |
| `--page N` | 分页索引（从 0 开始） |
| `--delay MS` | API 调用间隔（用于限流） |
| `--token TOKEN` | 覆盖 API Token |

### 更新参数选项

针对 `update` 命令：

| 参数 | 描述 |
|------|------|
| `--tags TAG1,TAG2` | 设置标签（逗号分隔） |
| `--title TITLE` | 设置标题 |
| `--collection ID` | 移入指定收藏夹 |

### 收藏夹 ID 含义

- `0` = 所有书签  
- `-1` = 未分类  
- `-99` = 回收站  
- `N` = 特定收藏夹（ID 可通过 `collections` 获取）  

## 示例

```bash
# List unsorted with pagination
{baseDir}/scripts/raindrop.sh list -1 --limit 50 --page 0
{baseDir}/scripts/raindrop.sh list -1 --limit 50 --page 1

# Create collection
{baseDir}/scripts/raindrop.sh create-collection "AI Coding"
# Output: Created: AI Coding / ID: 66016720

# Move single bookmark
{baseDir}/scripts/raindrop.sh move 1234567 66016720

# Update bookmark with tags and move
{baseDir}/scripts/raindrop.sh update 1234567 --tags "claude-code,workflow,tips" --collection 66016720

# Bulk move with rate limiting (100ms between calls)
{baseDir}/scripts/raindrop.sh bulk-move "123,456,789,101112" 66016720 --delay 100

# Find untagged bookmarks in unsorted
{baseDir}/scripts/raindrop.sh list-untagged -1 --limit 100

# Get JSON for scripting
{baseDir}/scripts/raindrop.sh list -1 --json --limit 50 | jq '.items[]._id'

# Count unsorted bookmarks
{baseDir}/scripts/raindrop.sh count -1
```

## 批量操作

对于大规模批量操作，请使用 `bulk-move`，它调用 Raindrop 批量 API（每请求最多处理 100 项）：

```bash
# Get IDs from unsorted
ids=$({baseDir}/scripts/raindrop.sh list -1 --json --limit 100 | jq -r '[.items[]._id] | join(",")')

# Move all to collection
{baseDir}/scripts/raindrop.sh bulk-move "$ids" 66016720
```

## 速率限制

Raindrop API 存在调用频率限制。进行批量操作时，请注意：

1. 使用 `--delay 100`（每次调用间隔 100ms）  
2. 使用 `bulk-move` 替代多次单独调用 `move`  
3. 每批处理 50–100 项  

## 直接调用 API

对于上述命令未涵盖的操作：

```bash
source ~/.config/raindrop.env

# Update tags
curl -X PUT "https://api.raindrop.io/rest/v1/raindrop/ID" \
  -H "Authorization: Bearer $RAINDROP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["tag1", "tag2"]}'

# Bulk update (up to 100 IDs)
curl -X PUT "https://api.raindrop.io/rest/v1/raindrops" \
  -H "Authorization: Bearer $RAINDROP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": [123, 456, 789], "collectionId": 12345}'
```

API 文档：https://developer.raindrop.io/
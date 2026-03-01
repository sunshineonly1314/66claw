---
name: fabric-api
name_zh: Fabric API
description: 通过 HTTP API（记事本、文件夹、书签、文件）创建/搜索 Fabric 资源
description_zh: 通过 HTTP API（记事本、文件夹、书签、文件）创建/搜索 Fabric 资源
homepage: https://fabric.so
metadata: {"clawdbot":{"emoji":"🧵","requires":{"env":["FABRIC_API_KEY"],"bins":["curl"]},"primaryEnv":"FABRIC_API_KEY"}}
---
# Fabric API（通过 curl 调用 HTTP 接口）

使用本技能，可通过 Fabric HTTP API（`https://api.fabric.so`）读写用户 Fabric 工作区中的内容。

## 关键注意事项（请务必先阅读）

- “笔记（Notes）”需通过 **POST `/v2/notepads`** 创建（而非 `/v2/notes`）。  
- 大多数创建接口均需提供 **`parentId`**：  
  - 一个 UUID，**或** 下列之一：`@alias::inbox`、`@alias::bin`。  
- 创建记事本（notepad）时需满足：  
  - 提供 `parentId`；  
  - 并且提供 `text`（Markdown 字符串）**或** `ydoc`（高级/结构化格式）二者之一。  
- `tags` 必须为对象数组，每个对象 *只能是*：  
  - `{ "name": "tag name" }` 或 `{ "id": "<uuid>" }`；  
  - 不得嵌套数组，也不得为字符串。  

当用户未指定目标文件夹时：默认使用 `parentId: "@alias::inbox"`。

## 设置（Clawdbot）

本技能期望 API 密钥位于以下位置：

- `FABRIC_API_KEY`

推荐配置（使用 `apiKey`；Clawdbot 将自动注入 `FABRIC_API_KEY`，因为 `primaryEnv` 已设置）：

```json5
{
  skills: {
    entries: {
      "fabric-api": {
        enabled: true,
        apiKey: "YOUR_FABRIC_API_KEY"
      }
    }
  }
}
````

## HTTP 基础

* 基础地址（Base）：`https://api.fabric.so`  
* 认证方式（Auth）：`X-Api-Key: $FABRIC_API_KEY`  
* JSON 格式：`Content-Type: application/json`  

调试时建议优先使用 `--fail-with-body`，以便查看 4xx 响应体内容。

## 标准 curl 模板（推荐使用 heredoc 避免引号转义问题）

### GET 请求

```bash
curl -sS --fail-with-body "https://api.fabric.so/v2/user/me" \
  -H "X-Api-Key: $FABRIC_API_KEY"
```

### POST 请求（JSON）

```bash
curl -sS --fail-with-body -X POST "https://api.fabric.so/v2/ENDPOINT" \
  -H "X-Api-Key: $FABRIC_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
{ "replace": "me" }
JSON
```

## 核心工作流

### 1) 创建记事本（notepad / note）

接口地址：`POST /v2/notepads`

* 将用户提供的 “title” 映射为 API 请求体中的 `name`。  
* 始终包含 `parentId`。  
* 使用 `text` 传递 Markdown 内容。  

```bash
curl -sS --fail-with-body -X POST "https://api.fabric.so/v2/notepads" \
  -H "X-Api-Key: $FABRIC_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
{
  "name": "Calendar Test Note",
  "text": "Created via Clawdbot",
  "parentId": "@alias::inbox",
  "tags": [{"name":"calendar"},{"name":"draft"}]
}
JSON
```

若标签（tags）引发校验问题，可暂不传入，后续再通过 `/v2/tags` 单独创建并分配。

### 2) 创建文件夹（folder）

接口地址：`POST /v2/folders`

```bash
curl -sS --fail-with-body -X POST "https://api.fabric.so/v2/folders" \
  -H "X-Api-Key: $FABRIC_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
{
  "name": "My new folder",
  "parentId": "@alias::inbox",
  "description": null
}
JSON
```

### 3) 创建书签（bookmark）

接口地址：`POST /v2/bookmarks`

```bash
curl -sS --fail-with-body -X POST "https://api.fabric.so/v2/bookmarks" \
  -H "X-Api-Key: $FABRIC_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
{
  "url": "https://example.com",
  "parentId": "@alias::inbox",
  "name": "Example",
  "tags": [{"name":"reading"}]
}
JSON
```

### 4) 浏览资源（列出文件夹内子项）

接口地址：`POST /v2/resources/filter`

用于列出某文件夹下的全部内容（请将文件夹 UUID 作为 `parentId` 传入）。

```bash
curl -sS --fail-with-body -X POST "https://api.fabric.so/v2/resources/filter" \
  -H "X-Api-Key: $FABRIC_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
{
  "parentId": "PARENT_UUID_HERE",
  "limit": 50,
  "order": { "property": "modifiedAt", "direction": "DESC" }
}
JSON
```

### 5) 搜索（search）

接口地址：`POST /v2/search`

当用户提供模糊描述（例如：“关于……的那篇笔记”）时，请使用搜索功能。

```bash
curl -sS --fail-with-body -X POST "https://api.fabric.so/v2/search" \
  -H "X-Api-Key: $FABRIC_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
{
  "queries": [
    {
      "mode": "text",
      "text": "meeting notes",
      "filters": { "kinds": ["notepad"] }
    }
  ],
  "pagination": { "page": 1, "pageSize": 20 },
  "sort": { "field": "modifiedAt", "order": "desc" }
}
JSON
```

## 标签（tags）—— 安全使用模式

### 列出全部标签

`GET /v2/tags?limit=100`

### 创建标签

使用 `POST /v2/tags` 并传入 `{ "name": "tag name", "description": null, "resourceId": null }`

### 创建时分配标签

仅可使用 `tags: [{"name":"x"}]` 或 `tags: [{"id":"<uuid>"}]`。

## 速率限制与重试策略

若收到 `429 Too Many Requests` 响应：

* 应退避重试（sleep + jitter）。  
* 避免紧循环；分页操作请放慢节奏。  

切勿在缺乏幂等性保障的前提下盲目重试创建请求（否则可能产生重复资源）。

## 故障排查速查表

* `404 Not Found`：几乎总是因端点错误、resourceId/parentId 错误或权限不足所致。  
* `400 Bad Request`：Schema 校验失败；请检查必填字段及标签结构。  
* `403 Forbidden`：订阅计划或权限限制。  
* `429 Too Many Requests`：退避并重试。  

## API 参考文档

OpenAPI 规范位于：

* `{baseDir}/fabric-api.yaml`

如有疑问，请务必查阅该规范，切勿凭猜测推断接口路径或请求体结构。
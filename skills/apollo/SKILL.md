---
name: apollo
name_zh: Apollo
description: 与 Apollo.io REST API 交互（人员/组织信息增强、搜索、列表）。
description_zh: 与 Apollo.io REST API 交互（人员/组织信息增强、搜索、列表）。
metadata: {"clawdbot":{"emoji":"🛰️","os":["darwin","linux"]}}
---
# Apollo.io

通过 REST API 与 Apollo.io 交互。

## 配置

创建 `config/apollo.env`（示例见 `config/apollo.env.example`）：

- `APOLLO_BASE_URL`（通常为 `https://api.apollo.io`）
- `APOLLO_API_KEY`

脚本会自动加载该配置。

## 命令

### 底层辅助命令

- GET：`skills/apollo/scripts/apollo-get.sh "/api/v1/users"`（端点可用性可能因版本而异）
- 人员搜索（新）：`skills/apollo/scripts/apollo-people-search.sh "vp marketing" 1 5`
- POST（通用）：`skills/apollo/scripts/apollo-post.sh "/api/v1/mixed_people/api_search" '{"q_keywords":"vp marketing","page":1,"per_page":5}'`

### 信息增强（常用）

- 按域名增强网站/组织信息：`skills/apollo/scripts/apollo-enrich-website.sh "apollo.io"`
- 获取完整组织信息（批量）：`skills/apollo/scripts/apollo-orgs-bulk.sh "6136480939c707388501e6b9"`

## 注意事项

- Apollo 通过 `X-Api-Key` 请求头进行身份验证（这些脚本会自动发送该请求头）。
- 某些端点需要 **主 API 密钥** 及付费订阅计划（Apollo 在此情况下返回 `403`）。
- 频繁遭遇速率限制（例如，许多端点限制为每小时 600 次请求）；请妥善处理 `429` 响应。
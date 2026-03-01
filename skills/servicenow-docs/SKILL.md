---
name: servicenow-docs
name_zh: ServiceNow 文档
description: 搜索并获取 ServiceNow 文档、版本发布说明（release notes）及开发者文档（API、参考手册、指南）。通过 docs.servicenow.com（经 Zoomin）及 developer.servicenow.com（面向开发者主题）的 API 提供服务。
description_zh: 搜索并获取 ServiceNow 文档、版本发布说明（release notes）及开发者文档（API、参考手册、指南）。通过 docs.servicenow.com（经 Zoomin）及 developer.servicenow.com（面向开发者主题）的 API 提供服务。
metadata:
  clawdbot:
    emoji: "📘"
    read_when:
      - 解答有关 ServiceNow 功能、API 或脚本的问题
      - 查询版本发布说明或补丁信息
      - 查找 GlideRecord、GlideAjax、工作流（workflows）等的文档
      - 研究 ServiceNow 平台能力
---
# ServiceNow 文档技能

搜索并获取来自 docs.servicenow.com 和 developer.servicenow.com 的文档。本 skill 提供对 ServiceNow 版本发布说明、平台文档以及面向开发者的 API 参考与指南的访问能力。

## 使用场景

当用户询问以下内容时，请使用本 skill：
- ServiceNow API 文档（GlideRecord、GlideAjax、GlideQuery 等）  
- 版本发布说明、补丁或新功能  
- 平台配置或管理  
- 脚本编写模式或最佳实践  
- 可访问性（Accessibility）、UI 或用户偏好设置  
- 任何 ServiceNow 产品或功能的文档  
- 开发者主题，例如 openFrameAPI、ScriptLoader、spContextManager 或移动 API  

## 工具

### servicenow_search  
搜索 ServiceNow 文档数据库。

**参数：**  
- `query`（字符串，必需）— 搜索关键词（例如 "GlideRecord"、"accessibility preferences"、"patch notes"）  
- `limit`（数字，默认值：10）— 最多返回结果数  
- `version`（字符串，可选）— 按版本筛选（例如 "Washington DC"、"Zurich"、"Yokohama"）  

**示例：**  
```json
{"query": "GlideAjax client script", "limit": 5}
```  

### servicenow_get_article  
获取某篇文档文章的完整内容。

**参数：**  
- `url`（字符串，必需）— 文章 URL（自动由 Zoomin 转换为 docs.servicenow.com 格式）  

**示例：**  
```json
{"url": "https://docs.servicenow.com/bundle/zurich-release-notes/page/release-notes/quality/zurich-patch-5.html"}
```  

### servicenow_list_versions  
列出可用的 ServiceNow 文档版本/发布版本。

**参数：** 无需参数  

### servicenow_latest_release  
获取最新 ServiceNow 版本的发布说明（自动识别最新版本）。

**参数：** 无需参数  

### servicenow_dev_suggest  
从 ServiceNow 开发者文档中获取自动补全建议。

**参数：**  
- `term`（字符串，必需）— 部分搜索词（例如 "Gli"、"openFrame"、"spCon"）  

**示例：**  
```json
{"term": "openFrame"}
```  

### servicenow_dev_search  
搜索 ServiceNow 开发者文档（API、指南、参考手册）。返回 API 参考页面的 URL。

**参数：**  
- `query`（字符串，必需）— 搜索关键词（例如 "openFrameAPI"、"spContextManager"）  
- `limit`（数字，默认值：10）— 最多返回结果数  

**示例：**  
```json
{"query": "ScriptLoader", "limit": 5}
```  

### servicenow_dev_guide  
按路径获取 ServiceNow 开发者指南。适用于 PDI 指南、开发者计划文档等。

**参数：**  
- `path`（字符串，必需）— 指南路径（例如 "developer-program/getting-instance-assistance"、"pdi-guide/requesting-an-instance"）  
- `release`（字符串，默认值："zurich"）— 发布版本  

**示例：**  
```json
{"path": "developer-program/getting-instance-assistance"}
```  

## URL 处理机制

- **搜索 API：** 使用 Zoomin API（servicenow-be-prod.servicenow.com）进行搜索  
- **面向用户的 URL：** 自动转换为 docs.servicenow.com 格式以提升可读性  
- **文章内容：** 通过 Zoomin API 端点配合正确请求头获取  
- **开发者文档搜索：** 使用 developer.servicenow.com 的 GraphQL + databroker 搜索 API  
- **开发者文档内容：** 直接从 developer.servicenow.com 页面获取  

## 示例用法

用户：“ServiceNow 中的可访问性偏好设置有哪些？”  
→ 使用 servicenow_search 查找可访问性相关文档  
→ 使用 servicenow_get_article 获取全文内容  
→ 为用户概括相关偏好设置  

用户：“告诉我最新的 ServiceNow 补丁情况。”  
→ 使用 servicenow_latest_release 获取最新发布说明  
→ 获取并概括补丁详情  

用户：“我该如何使用 openFrameAPI？”  
→ 使用 servicenow_dev_suggest 或 servicenow_dev_search 查找最匹配的开发者文档主题  
→ 返回 API 参考页面的 URL（需浏览器访问以查看完整内容）  

用户：“展示获取实例的 PDI 指南。”  
→ 使用 servicenow_dev_guide，路径设为 "pdi-guide/requesting-an-instance"  
→ 返回完整指南内容  

## 使用的 API

- **Zoomin 搜索 API：** `https://servicenow-be-prod.servicenow.com/search`  
- **内容源：** docs.servicenow.com（通过 Zoomin API 访问）  
- **开发者搜索 API：** `https://developer.servicenow.com/api/now/uxf/databroker/exec`  
- **开发者建议 API：** `https://developer.servicenow.com/api/now/graphql`  
- **开发者指南 API：** `https://developer.servicenow.com/api/snc/v1/guides`（公开，无需认证）  

## 局限性

- **API 参考内容：** developer.servicenow.com 的 API 参考页面需通过浏览器访问。`servicenow_dev_search` 仅返回 URL，无法获取完整 API 文档内容。  
- **指南内容：** 指南可通过 `servicenow_dev_guide` 完整获取，无需身份验证。  
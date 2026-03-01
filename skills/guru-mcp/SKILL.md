---
name: guru-mcp
name_zh: Guru MCP
description: 通过 MCP 访问 Guru 知识库——向 AI 提问、搜索文档、创建草稿、更新卡片。连接您所有的 Guru 数据源，包括 Slack、Google Drive、Confluence 和 SharePoint。
description_zh: 通过 MCP 访问 Guru 知识库——向 AI 提问、搜索文档、创建草稿、更新卡片。连接您所有的 Guru 数据源，包括 Slack、Google Drive、Confluence 和 SharePoint。
homepage: https://www.getguru.com
metadata: {"clawdbot":{"emoji":"🧠","requires":{"bins":["mcporter"],"env":["GURU_API_TOKEN"]}}}
---
# Guru MCP

通过官方 MCP 服务器访问您的 Guru 知识库。支持 AI 驱动问答、文档搜索、草稿创建及卡片更新。

## 功能特性

- **AI 驱动答案** — 由 Knowledge Agents 提供全面解答  
- **文档搜索** — 在整个知识库中查找卡片与内容  
- **创建草稿** — 利用 AI 工具生成新卡片草稿  
- **更新卡片** — 直接修改现有卡片  
- **连接的数据源** — 通过 Guru 接入 Salesforce、Slack、Google Drive、Confluence、SharePoint  
- **权限感知** — 严格遵循所有现有 Guru 权限设置  
- **分析能力** — 所有查询均记录于 AI Agent Center  

## 配置步骤

### 1. 获取 API Token

1. 进入 **Guru Admin → API Tokens**  
2. 创建新 Token  
3. 记录您的邮箱地址与 Token  

### 2. 配置环境变量

添加至 `~/.clawdbot/.env`：  
```bash
GURU_API_TOKEN=your.email@company.com:your-api-token
```  

### 3. 配置 mcporter

添加至 `config/mcporter.json`：  
```json
{
  "mcpServers": {
    "guru": {
      "baseUrl": "https://mcp.api.getguru.com/mcp",
      "headers": {
        "Authorization": "Bearer ${GURU_API_TOKEN}"
      }
    }
  }
}
```  

### 4. 验证配置

```bash
mcporter list guru
```  

## 可用工具

### `guru_list_knowledge_agents`

列出工作区中所有 Knowledge Agents。**务必首先调用此工具**，以获取其他工具所需的 agent ID。

```bash
mcporter call 'guru.guru_list_knowledge_agents()'
```  

返回：  
```json
[
  {"id": "08de66e8-...", "name": "Guru"},
  {"id": "abc123...", "name": "Engineering Docs"}
]
```  

### `guru_answer_generation`

从 Knowledge Agent 获取 AI 驱动的答案。最适合回答具体问题，例如：“X 是什么？”或“我该如何 Y？”  

```bash
mcporter call 'guru.guru_answer_generation(
  agentId: "YOUR_AGENT_ID",
  question: "How do I submit expenses?"
)'
```  

可选筛选条件：  
- `collectionIds` — 限定于特定知识集合（Collections）  
- `sourceIds` — 限定于特定数据源（Sources）  

返回包含引用来源的完整答案。

### `guru_search_documents`

查找文档、卡片及数据源。最适合浏览类任务，例如：“查找关于 X 的文档”或“我们有关于 Y 的卡片吗？”  

```bash
mcporter call 'guru.guru_search_documents(
  agentId: "YOUR_AGENT_ID",
  query: "onboarding process"
)'
```  

返回匹配文档列表及摘要片段。

### `guru_get_card_by_id`

以 HTML 格式获取完整卡片内容。

```bash
mcporter call 'guru.guru_get_card_by_id(id: "CARD_ID")'
```  

返回卡片 ID、标题及 HTML 内容。

### `guru_create_draft`

创建新卡片草稿。

```bash
mcporter call 'guru.guru_create_draft(
  title: "New Process Guide",
  content: "<h2>Overview</h2><p>This guide covers...</p>"
)'
```  

返回草稿 ID 与访问 URL。

### `guru_update_card`

更新现有卡片。请先使用 `guru_get_card_by_id` 获取当前内容，再进行修改。

```bash
mcporter call 'guru.guru_update_card(
  cardId: "CARD_ID",
  title: "Updated Title",
  content: "<p>Updated HTML content...</p>"
)'
```  

**重要提示**：更新时须保持 HTML 结构不变，在现有 DOM 层级内插入或替换内容。

## 使用模式

### 提问

```bash
# 1. Get agent ID
mcporter call 'guru.guru_list_knowledge_agents()'

# 2. Ask question
mcporter call 'guru.guru_answer_generation(
  agentId: "08de66e8-...",
  question: "What is the PTO policy?"
)'
```  

### 查找并阅读卡片

```bash
# 1. Search for cards
mcporter call 'guru.guru_search_documents(
  agentId: "08de66e8-...",
  query: "expense report"
)'

# 2. Get full content
mcporter call 'guru.guru_get_card_by_id(id: "CARD_ID_FROM_SEARCH")'
```  

### 创建新文档

```bash
mcporter call 'guru.guru_create_draft(
  title: "API Authentication Guide",
  content: "<h2>Overview</h2><p>This guide explains how to authenticate with our API.</p><h2>Steps</h2><ol><li>Generate API key</li><li>Add to headers</li></ol>"
)'
```  

## 如何选择合适工具

| 使用场景 | 工具 |
|----------|------|
| “X 是什么？” / “我该如何 Y？” | `guru_answer_generation` |
| “查找关于 X 的文档” | `guru_search_documents` |
| “显示卡片 XYZ” | `guru_get_card_by_id` |
| “为 X 创建一份新指南” | `guru_create_draft` |
| “用……更新此卡片” | `guru_update_card` |

## Token 格式

`GURU_API_TOKEN` 必须采用 `email:token` 格式：  
```
your.email@company.com:a1b2c3d4-e5f6-7890-abcd-ef1234567890
```  

## 注意事项

- 所有问题均记录于 Guru 的 **AI Agent Center** 分析系统中  
- 所有权限均被严格执行（用户仅能看到其有权访问的内容）  
- Knowledge Agents 可针对特定领域定制——请为您的问题选择最匹配的 Agent  
- 卡片内容为 HTML 格式——更新时请务必保留原有结构  

## 相关资源

- [Guru MCP 文档](https://help.getguru.com/docs/connecting-gurus-mcp-server)  
- [Guru API 参考](https://developer.getguru.com)  
- [AI Agent Center](https://app.getguru.com/ai-agent-center)  
- [MCP 用户反馈](https://help.getguru.com/docs/connecting-gurus-mcp-server#feedback)  
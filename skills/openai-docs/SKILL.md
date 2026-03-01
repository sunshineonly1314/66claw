---
name: openai-docs-skill
name_zh: OpenAI文档
description: 通过 OpenAI Docs MCP 服务器（使用 CLI 工具 curl/jq）查询 OpenAI 开发者文档。当任务涉及 OpenAI API（响应、聊天补全、实时功能等）、OpenAI SDK、ChatGPT Apps SDK、Codex、MCP 集成、端点模式、参数、配额限制，或迁移与升级需求，且需获取最新官方指南时，应使用该技能。
description_zh: 通过 OpenAI Docs MCP 服务器（使用 CLI 工具 curl/jq）查询 OpenAI 开发者文档。当任务涉及 OpenAI API（响应、聊天补全、实时功能等）、OpenAI SDK、ChatGPT Apps SDK、Codex、MCP 集成、端点模式、参数、配额限制，或迁移与升级需求，且需获取最新官方指南时，应使用该技能。
---
# OpenAI 文档 MCP 技能

## 概述

在 Shell 中调用 OpenAI 开发者文档 MCP 服务器，以搜索并获取权威文档。在处理 OpenAI 平台相关工作时，务必使用此方式，而非依赖记忆或非官方来源。

## 核心规则

- 凡涉及 OpenAI API/SDK/Apps/Codex 的问题，或需要精确、时效性强的文档时，必须使用本技能。
- 须通过 `scripts/openai-docs-mcp.sh` 中的 CLI 封装器调用 MCP 服务器（不得依赖 Codex MCP 工具）。
- 使用 `search` 或 `list` 查找最匹配的文档页面，再使用 `fetch` 获取该页面（或指定锚点）的精确文本。
- 在响应中明确呈现所使用的文档 URL，确保信息来源清晰可溯。

## 快速入门

```bash
scripts/openai-docs-mcp.sh search "Responses API" 5
scripts/openai-docs-mcp.sh fetch https://platform.openai.com/docs/guides/migrate-to-responses
```

## 工作流

1. 发现：`search`，使用聚焦式查询。若不确定，可使用 `list` 浏览索引。
2. 阅读：`fetch` 最相关的 URL（可选添加锚点）。
3. 应用：摘要和/或引用相关内容，并附上该 URL。

## 脚本参考

CLI 封装器位于 `scripts/openai-docs-mcp.sh`，其底层调用 `curl` + `jq`，目标地址为 `https://developers.openai.com/mcp`。

子命令：
- `init`：初始化并检查服务器能力。
- `tools`：列出 MCP 服务器上可用的工具。
- `search <query> [limit] [cursor]`：返回文档索引中的 JSON 匹配结果。
- `list [limit] [cursor]`：浏览文档索引。
- `fetch <url> [anchor]`：返回某文档页或章节的 Markdown 内容。
- `endpoints`：列出 OpenAPI 端点。
- `openapi <endpoint-url> [lang1,lang2] [code-only]`：获取 OpenAPI 模式定义或代码示例。

环境变量：
- `MCP_URL`：覆盖默认 MCP 端点。
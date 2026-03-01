---
name: apple-docs-mcp
description: 该技能封装了 Apple 开发者文档 MCP 服务器。
description_zh: 该技能封装了 Apple 开发者文档 MCP 服务器。
---
# Apple Docs MCP 技能

该技能封装了 Apple 开发者文档 MCP 服务器。

## 配置
```json
{
  "mcp": {
    "servers": {
      "apple-docs": {
        "command": "npx",
        "args": ["-y", "@kimsungwhee/apple-docs-mcp"]
      }
    }
  }
}
```
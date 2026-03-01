---
name: deepwiki
name_zh: DeepWiki
description: 查询 DeepWiki MCP 服务器，获取 GitHub 仓库文档、维基结构及基于 AI 的问答服务。
description_zh: 查询 DeepWiki MCP 服务器，获取 GitHub 仓库文档、维基结构及基于 AI 的问答服务。
homepage: https://docs.devin.ai/work-with-devin/deepwiki-mcp
---
# DeepWiki

使用本 skill，可通过 DeepWiki MCP 服务器访问公共 GitHub 仓库的文档。您可搜索仓库维基、获取其结构，或就仓库文档提出复杂问题并获得基于上下文的 AI 回答。

## 命令

### 提问  
就任意 GitHub 仓库提出问题，获取基于 AI、上下文锚定的回答。  
```bash
node ./scripts/deepwiki.js ask <owner/repo> "your question"
```

### 查看维基结构  
获取某 GitHub 仓库文档主题列表。  
```bash
node ./scripts/deepwiki.js structure <owner/repo>
```

### 查看维基内容  
查看某 GitHub 仓库维基中特定路径下的文档内容。  
```bash
node ./scripts/deepwiki.js contents <owner/repo> <path>
```

## 示例

**询问 Devin 的 MCP 使用方式：**  
```bash
node ./scripts/deepwiki.js ask cognitionlabs/devin "How do I use MCP?"
```

**获取 React 文档结构：**  
```bash
node ./scripts/deepwiki.js structure facebook/react
```

## 注意事项  
- 基础服务器：`https://mcp.deepwiki.com/mcp`  
- 仅支持公共仓库。  
- 无需身份验证。
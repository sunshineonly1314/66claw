---
name: npm-search
name_zh: npm搜索
description: 搜索 npm 包。适用于查找 Node.js/JavaScript 的包、库及工具。
description_zh: 搜索 npm 包。适用于查找 Node.js/JavaScript 的包、库及工具。
metadata: {"clawdbot":{"emoji":"📦","requires":{"bins":["jq","npm-search-mcp-server"]}}}
---
# NPM 搜索

npm-search-mcp-server 的 CLI 封装。

> **Note:** Examples show command syntax. Replace queries with the user's actual request.

## 搜索包

```bash
bash scripts/npmsearch "<query>"
```

## 命令参考

| 命令 | 描述 |
|------|------|
| `npmsearch "<query>"` | 搜索 npm 包 |

## 注意事项

- 需已安装 `npm-search-mcp-server`；
- 需已安装 `jq`。
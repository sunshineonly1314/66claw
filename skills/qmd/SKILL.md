---
name: qmd
name_zh: QMD
description: 本地搜索/索引命令行工具（BM25 + 向量 + 重排序），支持 MCP 模式。
description_zh: 本地搜索/索引命令行工具（BM25 + 向量 + 重排序），支持 MCP 模式。
homepage: https://tobi.lutke.com
metadata: {"clawdbot":{"emoji":"📝","requires":{"bins":["qmd"]},"install":[{"id":"node","kind":"node","package":"https://github.com/tobi/qmd","bins":["qmd"],"label":"Install qmd (node)"}]}}
---
# qmd

使用 `qmd` 对本地文件建立索引并执行搜索。

索引操作
- 添加集合：`qmd collection add /path --name docs --mask "**/*.md"`
- 更新索引：`qmd update`
- 查看状态：`qmd status`

搜索操作
- BM25 搜索：`qmd search "query"`
- 向量搜索：`qmd vsearch "query"`
- 混合搜索：`qmd query "query"`
- 获取文档：`qmd get docs/path.md:10 -l 40`

注意事项
- 嵌入/重排序功能通过 Ollama 在 `OLLAMA_URL` 上运行（默认 `http://localhost:11434`）。
- 索引默认存储于 `~/.cache/qmd` 目录下。
- MCP 模式：`qmd mcp`。
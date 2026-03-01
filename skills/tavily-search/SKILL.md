---
name: tavily-search
name_zh: Tavily搜索
description: 通过 Tavily API 实现的、面向 AI 优化的网页搜索。为 AI agents 返回简洁且相关的结果。
description_zh: 通过 Tavily API 实现的、面向 AI 优化的网页搜索。为 AI agents 返回简洁且相关的结果。
homepage: https://tavily.com
metadata: {"clawdbot":{"emoji":"🔍","requires":{"bins":["node"],"env":["TAVILY_API_KEY"]},"primaryEnv":"TAVILY_API_KEY"}}
---
# Tavily 搜索

利用 Tavily API 实现的、面向 AI 优化的网页搜索。专为 AI agents 设计——返回干净、相关的内容。

## 搜索

```bash
node {baseDir}/scripts/search.mjs "query"
node {baseDir}/scripts/search.mjs "query" -n 10
node {baseDir}/scripts/search.mjs "query" --deep
node {baseDir}/scripts/search.mjs "query" --topic news
```

## 选项

- `-n <count>`：结果数量（默认值：5，上限：20）  
- `--deep`：启用高级搜索以进行更深入的研究（响应较慢，但覆盖更全面）  
- `--topic <topic>`：搜索主题类型 —— `general`（默认）或 `news`  
- `--days <n>`：若为新闻类主题，可限定为最近 n 天内的结果  

## 从 URL 提取内容

```bash
node {baseDir}/scripts/extract.mjs "https://example.com/article"
```

备注：  
- 需从 https://tavily.com 获取 `TAVILY_API_KEY`  
- Tavily 专为 AI 优化——返回干净、相关的内容片段  
- 对复杂研究型问题，请使用 `--deep`  
- 对时事类查询，请使用 `--topic news`  
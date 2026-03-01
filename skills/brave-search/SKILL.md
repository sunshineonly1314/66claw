---
name: brave-search
name_zh: Brave搜索
description: 通过 Brave 搜索 API 实现网页搜索与内容提取。适用于搜索文档、事实或任何网页内容。轻量级，无需浏览器。
description_zh: 通过 Brave 搜索 API 实现网页搜索与内容提取。适用于搜索文档、事实或任何网页内容。轻量级，无需浏览器。
---
# Brave 搜索

基于 Brave 搜索的无头网页搜索与内容提取工具。无需启动浏览器。

## 设置

首次使用前仅需运行一次：

```bash
cd ~/Projects/agent-scripts/skills/brave-search
npm ci
```

需配置环境变量：`BRAVE_API_KEY`。

## 搜索

```bash
./search.js "query"                    # Basic search (5 results)
./search.js "query" -n 10              # More results
./search.js "query" --content          # Include page content as markdown
./search.js "query" -n 3 --content     # Combined
```

## 提取网页内容

```bash
./content.js https://example.com/article
```

获取指定 URL 并以 Markdown 格式提取其中可读内容。

## 输出格式

```
--- Result 1 ---
Title: Page Title
Link: https://example.com/page
Snippet: Description from search results
Content: (if --content flag used)
  Markdown content extracted from the page...

--- Result 2 ---
...
```

## 适用场景

- 搜索文档或 API 参考资料
- 查询事实性信息或最新资讯
- 从特定 URL 获取网页内容
- 任何需网页搜索但无需人工交互浏览的任务
---
name: perplexity
name_zh: Perplexity
description: 通过 Perplexity API 进行 AI 驱动的网络搜索，并返回附带引用依据的回答。支持批量查询。
description_zh: 通过 Perplexity API 进行 AI 驱动的网络搜索，并返回附带引用依据的回答。支持批量查询。
homepage: https://docs.perplexity.ai
metadata: {"clawdbot":{"emoji":"🔮","requires":{"bins":["node"],"env":["PERPLEXITY_API_KEY"]},"primaryEnv":"PERPLEXITY_API_KEY"}}
---
# Perplexity 搜索

一种由 AI 驱动的网络搜索服务，返回附带引用依据的回答。

## 搜索

单次查询：
```bash
node {baseDir}/scripts/search.mjs "what's happening in AI today"
```

多次查询（批量）：
```bash
node {baseDir}/scripts/search.mjs "What is Perplexity?" "Latest AI news" "Best coffee in NYC"
```

## 选项

- `--json`: 输出原始 JSON 响应

## 注意事项

- 需要设置 `PERPLEXITY_API_KEY` 环境变量
- 响应中会在可用时附带引用来源
- 批量查询将在一次 API 调用中完成处理
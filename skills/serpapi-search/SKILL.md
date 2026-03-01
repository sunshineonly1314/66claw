---
name: serpapi-search
name_zh: SerpAPI 搜索
description: 通过 SerpAPI 搜索 Google（Google 搜索、Google 新闻、Google 本地搜索）。当您需要网页搜索、查找新闻文章或查询本地商家时使用。支持按国家/语言定向，以获取区域特定结果。
description_zh: 通过 SerpAPI 搜索 Google（Google 搜索、Google 新闻、Google 本地搜索）。当您需要网页搜索、查找新闻文章或查询本地商家时使用。支持按国家/语言定向，以获取区域特定结果。
metadata: {"clawdbot":{"emoji":"🔍","requires":{"bins":["curl","python3"],"env":["SERPAPI_API_KEY"]},"primaryEnv":"SERPAPI_API_KEY"}}
---
# SerpAPI 搜索

通过 SerpAPI 进行 Google 搜索，并支持国家/语言定向。

## 快速开始

```bash
# Google Search
{baseDir}/scripts/search.sh "artificial intelligence B2B" --country br --lang pt

# Google News
{baseDir}/scripts/search.sh "inteligência artificial" --engine google_news --country br --lang pt

# Google Local
{baseDir}/scripts/search.sh "AI companies" --engine google_local --country us --location "San Francisco, California"
```

## 搜索引擎

| 引擎 | 使用场景 | 关键返回字段 |
|------|-----------|----------------|
| `google` | 网页搜索（默认） | `organic_results` |
| `google_news` | 新闻文章 | `news_results` |
| `google_local` | 本地商家/地点 | `local_results` |

## 参数选项

| 标志 | 描述 | 默认值 |
|------|------|---------|
| `--engine` | `google`、`google_news`、`google_local` | `google` |
| `--country` | 两位国家代码（如 `br`、`us`、`de` 等） | `us` |
| `--lang` | 语言代码（如 `pt`、`en`、`es` 等） | `en` |
| `--location` | 地理位置字符串（例如 `"São Paulo, Brazil"`） | — |
| `--num` | 返回结果数量 | `10` |
| `--json` | 原始 JSON 输出 | 关闭 |

## API 密钥

设置 `SERPAPI_API_KEY` 环境变量，或将其保存至：
```bash
mkdir -p ~/.config/serpapi
echo "your_key_here" > ~/.config/serpapi/api_key
chmod 600 ~/.config/serpapi/api_key
```

## 常用国家代码

`br`（巴西）、`us`（美国）、`pt`（葡萄牙）、`de`（德国）、`fr`（法国）、`es`（西班牙）、`gb`（英国）、`jp`（日本）、`in`（印度）。
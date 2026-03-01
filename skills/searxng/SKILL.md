---
name: searxng
name_zh: SearXNG
description: 使用您本地的 SearXNG 实例进行尊重隐私的元搜索引擎——无需依赖外部 API 即可搜索网页、图片、新闻等。
description_zh: 使用您本地的 SearXNG 实例进行尊重隐私的元搜索引擎——无需依赖外部 API 即可搜索网页、图片、新闻等。
author: Avinash Venkatswamy
version: 1.0.1
homepage: https://searxng.org
triggers:
  - "search for"
  - "search web"
  - "find information"
  - "look up"
metadata: {"clawdbot":{"emoji":"🔍","requires":{"bins":["python3"]},"config":{"env":{"SEARXNG_URL":{"description":"SearXNG 实例 URL","default":"http://localhost:8080","required":true}}}}}
---
# SearXNG 搜索

使用您本地运行的 SearXNG 实例搜索网页——一款尊重隐私的元搜索引擎。

## 命令

### 网页搜索
```bash
uv run {baseDir}/scripts/searxng.py search "query"              # Top 10 results
uv run {baseDir}/scripts/searxng.py search "query" -n 20        # Top 20 results
uv run {baseDir}/scripts/searxng.py search "query" --format json # JSON output
```

### 分类搜索
```bash
uv run {baseDir}/scripts/searxng.py search "query" --category images
uv run {baseDir}/scripts/searxng.py search "query" --category news
uv run {baseDir}/scripts/searxng.py search "query" --category videos
```

### 高级选项
```bash
uv run {baseDir}/scripts/searxng.py search "query" --language en
uv run {baseDir}/scripts/searxng.py search "query" --time-range day
```

## 配置说明

**必需：** 将 `SEARXNG_URL` 环境变量设为您 SearXNG 实例的 URL：

```bash
export SEARXNG_URL=https://your-searxng-instance.com
```

或在 Clawdbot 配置中设置：
```json
{
  "env": {
    "SEARXNG_URL": "https://your-searxng-instance.com"
  }
}
```

默认值（若未设置）： `http://localhost:8080`

## 功能特性

- 🔒 注重隐私（使用您本地的实例）  
- 🌐 多引擎聚合  
- 📰 多类别搜索  
- 🎨 丰富格式化输出  
- 🚀 适用于程序化调用的快速 JSON 模式  

## API

调用您本地 SearXNG 的 JSON API 端点（默认无需认证）。
---
name: firecrawl-search
name_zh: Firecrawl搜索
description: 通过 Firecrawl API 实现网页搜索与抓取。当您需要在 Web 上执行搜索、抓取网站（包括 JavaScript 渲染密集型页面）、爬取整个站点，或从网页中提取结构化数据时，请使用本 skill。需配置 FIRECRAWL_API_KEY 环境变量。
description_zh: 通过 Firecrawl API 实现网页搜索与抓取。当您需要在 Web 上执行搜索、抓取网站（包括 JavaScript 渲染密集型页面）、爬取整个站点，或从网页中提取结构化数据时，请使用本 skill。需配置 FIRECRAWL_API_KEY 环境变量。
---
# Firecrawl

通过 Firecrawl API 实现网页搜索与抓取。

## 前置条件（Prerequisites）

在您的环境或 `.env` 文件中设置 `FIRECRAWL_API_KEY`：
```bash
export FIRECRAWL_API_KEY=fc-xxxxxxxxxx
```

## 快速开始（Quick Start）

### 在 Web 上搜索
```bash
firecrawl_search "your search query" --limit 10
```

### 抓取单个网页
```bash
firecrawl_scrape "https://example.com"
```

### 爬取整个网站
```bash
firecrawl_crawl "https://example.com" --max-pages 50
```

## API 参考文档

详细 API 文档及高级选项，请参阅 [references/api.md](references/api.md)。

## 脚本（Scripts）

- `scripts/search.py` — 使用 Firecrawl 执行 Web 搜索  
- `scripts/scrape.py` — 抓取单个 URL  
- `scripts/crawl.py` — 爬取整个网站  
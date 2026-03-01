---
name: marktplaats
name_zh: Marktplaats
description: 支持跨所有类目的 Marktplaats.nl 分类广告搜索，并提供条件/配送筛选功能。
description_zh: 支持跨所有类目的 Marktplaats.nl 分类广告搜索，并提供条件/配送筛选功能。
homepage: https://www.marktplaats.nl
metadata: {"clawdbot":{"emoji":"🇳🇱","requires":{"bins":["node"]}}}
---
# Marktplaats 技能  

支持搜索任意 Marktplaats 类目、按成色/配送方式筛选、列出全部类目、以及抓取单条广告详情。

## CLI  

```bash
npm install -g {baseDir}

# Search
marktplaats-search "<query>" [options]
  -n, --limit <num>         Number of results (default: 10, max: 100)
  -c, --category <id>       Category ID (top-level)
  --min-price <cents>       Minimum price in euro cents
  --max-price <cents>       Maximum price in euro cents
  --sort <relevance|date|price-asc|price-desc>
  --param key=value         Filter by attribute (repeatable)
  --details [target]        Fetch details for "first" result or URL/ID
  --json                    Output raw JSON

# Categories
marktplaats-categories            # main categories
marktplaats-categories <id>       # sub-categories for a category
  --json                          Output raw JSON
```  

## 筛选器  

常用筛选器支持 `--param`：

| 筛选器 | 可选值 |  
|--------|--------|  
| `condition` | Nieuw（全新）、Refurbished（翻新）、Zo goed als nieuw（近乎全新）、Gebruikt（二手）、Niet werkend（无法使用） |  
| `delivery` | Ophalen（自提）、Verzenden（邮寄） |  
| `buyitnow` | true（仅限“立即购买”商品） |  

英文别名同样可用：`new`、`used`、`like-new`、`pickup`、`shipping`  

## 示例  

```bash
# New laptops only
marktplaats-search "laptop" --param condition=Nieuw

# Used cameras with shipping
marktplaats-search "camera" --param condition=Gebruikt --param delivery=Verzenden

# Cars under €15k
marktplaats-search "bmw 330d" --category 96 --max-price 1500000

# Furniture, pickup only
marktplaats-search "eettafel" --param delivery=Ophalen --sort price-asc

# Get details for first result
marktplaats-search "iphone" -n 1 --details first

# List all categories
marktplaats-categories

# BMW sub-categories
marktplaats-categories 96
```  

## 编程接口（ESM）  

```js
import { searchListings, fetchCategories, getListingDetails } from '{baseDir}';

// Search with filters
const results = await searchListings({
  query: 'espresso machine',
  params: { condition: 'Nieuw', delivery: 'Verzenden' },
  limit: 10,
});

// Get categories
const categories = await fetchCategories();  // top-level
const bmw = await fetchCategories(96);       // BMW sub-categories

// Fetch listing details
const details = await getListingDetails(results.listings[0].vipUrl);
```  

## 注意事项  

- 价格单位为 **欧分**（€15,000 = 1500000）  
- 结果包含广告完整 URL  
- 使用 `--json` 可查看全部可用维度与筛选键名  
- 搜索结果后会显示筛选提示  
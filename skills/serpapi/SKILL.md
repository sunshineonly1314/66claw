---
name: serpapi
name_zh: SerpAPI
description: 覆盖 Google、Amazon、Yelp、OpenTable、Walmart 等多个平台的统一搜索 API。适用于搜索商品、本地商家、餐厅、购物、图片、新闻或任何网页搜索场景。一个 API 密钥，支持多种搜索引擎。
description_zh: 覆盖 Google、Amazon、Yelp、OpenTable、Walmart 等多个平台的统一搜索 API。适用于搜索商品、本地商家、餐厅、购物、图片、新闻或任何网页搜索场景。一个 API 密钥，支持多种搜索引擎。
homepage: https://serpapi.com
metadata: {"clawdbot":{"emoji":"🔍","requires":{"env":["SERPAPI_API_KEY"]}}}
---
# SerpAPI — 统一搜索

SerpAPI 通过单一 API 提供来自 Google、Amazon、Yelp、OpenTable 及 20 多个其他搜索引擎的结构化数据。

## 配置

1. 在 https://serpapi.com 获取 API 密钥（免费版：每月 100 次搜索）
2. 设置环境变量：`export SERPAPI_API_KEY=your-key-here`
3. 可选：在 `<workspace>/TOOLS.md` 中设置默认地理位置：
   ```markdown
   ## SerpAPI
   Default location: Pittsburgh, PA
   ```

## 使用方法

```bash
# General syntax
<skill>/scripts/serp.py <engine> "<query>" [options]

# Examples
serp.py google "best coffee shops"
serp.py google_maps "restaurants near me" --location "15238"
serp.py amazon "mechanical keyboard" --num 10
serp.py yelp "pizza" --location "New York, NY"
serp.py google_shopping "standing desk"
```

## 搜索引擎

| 引擎 | 适用场景 | 主要功能 |
|------|----------|-----------|
| `google` | 通用网页搜索 | 自然搜索结果、知识图谱、本地搜索结果区块（Local Pack） |
| `google_maps` | 本地地点/商家 | 评分、评论、营业时间、GPS 坐标 |
| `google_shopping` | 商品搜索 | 价格、商家、评论 |
| `google_images` | 图片搜索 | 缩略图、来源链接 |
| `google_news` | 新闻文章 | 标题、来源、发布日期 |
| `amazon` | Amazon 商品 | 价格、评分、评论、Prime 标识 |
| `yelp` | 本地商家 | 评论、评分、分类 |
| `opentable` | 餐厅评论 | 就餐体验评论、评分 |
| `walmart` | Walmart 商品 | 价格、库存状态 |
| `ebay` | eBay 商品列表 | 价格、出价、成色 |
| `tripadvisor` | 旅游/景点 | 酒店、餐厅、可游玩项目 |

## 参数选项

| 参数 | 描述 |
|------|------|
| `--location`, `-l` | 本地搜索结果的地理位置（城市名、邮编、地址） |
| `--num`, `-n` | 返回结果数量（默认值：10） |
| `--format`, `-f` | 输出格式：`json`（默认）或 `text` |
| `--type`, `-t` | Google 搜索类型：`shop`、`isch`、`nws`、`vid` |
| `--page`, `-p` | 分页页码 |
| `--gl` | 国家代码（例如：`us`、`uk`、`de`） |
| `--hl` | 语言代码（例如：`en`、`es`、`fr`） |

## 各引擎适用场景指南

**查找本地商家/餐厅：**  
- `google_maps` — 最适合发现地点、营业时间及评论  
- `yelp` — 深度获取餐厅/服务类商家的评论与评分  
- `opentable` — 专用于餐厅，聚焦就餐体验评论  

**购物/商品搜索：**  
- `google_shopping` — 跨商家比价  
- `amazon` — Amazon 专属搜索，含 Prime 信息  
- `walmart` — Walmart 库存与价格信息  
- `ebay` — 二手商品、拍卖品、收藏品  

**通用研究：**  
- `google` — 网页、文章、通用信息  
- `google_news` — 时事动态、新闻文章  
- `google_images` — 查找图片  

## 示例

### 查找某地附近的餐厅  
```bash
serp.py google_maps "italian restaurants" --location "Pittsburgh, PA" --num 5
```

### 对比商品价格  
```bash
serp.py google_shopping "sony wh-1000xm5" --num 10
```

### 查询 Amazon 商品的评论与价格  
```bash
serp.py amazon "standing desk" --num 10
```

### 获取 Yelp 上本地服务的评论  
```bash
serp.py yelp "plumber" --location "15238"
```

### 按主题搜索新闻  
```bash
serp.py google_news "AI regulation" --num 5
```

## 输出格式

**JSON（默认）：** SerpAPI 提供的完整结构化数据。适用于程序化调用，或需要全部细节的场景。

**文本（`--format text`）：** 人类可读的摘要。适用于快速获取答案。

## 集成注意事项

- 返回结果为结构化 JSON —— 请解析并提取所需字段  
- 本地搜索结果包含 GPS 坐标，可用于地图标注  
- 购物类结果中已提取价格，便于横向比价  
- 知识图谱在可用时提供实体相关信息  
- 频率限制：免费版每月 100 次；请访问 serpapi.com/dashboard 查看您的套餐详情  
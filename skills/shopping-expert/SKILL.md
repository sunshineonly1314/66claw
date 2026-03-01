---
name: shopping-expert
name_zh: 购物专家
description: 在线（Google 购物）及本地（您附近的商店）查找并比价商品。根据价格、评分、可售性及用户偏好自动筛选最优商品。生成含购买链接与门店位置的购物清单。当用户要求代购商品、寻找最优折扣、比价或定位本地商品时启用。支持预算限制（低/中/高 或 "$X"）、偏好筛选（品牌、功能、颜色）以及双模式搜索（线上 + 本地门店）。
description_zh: 在线（Google 购物）及本地（您附近的商店）查找并比价商品。根据价格、评分、可售性及用户偏好自动筛选最优商品。生成含购买链接与门店位置的购物清单。当用户要求代购商品、寻找最优折扣、比价或定位本地商品时启用。支持预算限制（低/中/高 或 "$X"）、偏好筛选（品牌、功能、颜色）以及双模式搜索（线上 + 本地门店）。
homepage: https://github.com/clawdbot/clawdbot
metadata: {"clawdbot":{"emoji":"🛒","requires":{"bins":["uv"],"env":["SERPAPI_API_KEY","GOOGLE_PLACES_API_KEY"]},"primaryEnv":"SERPAPI_API_KEY","install":[{"id":"uv-brew","kind":"brew","formula":"uv","bins":["uv"],"label":"Install uv (brew)"}]}}
---
# 购物专家（Shopping Expert）

借助智能推荐，在线及本地查找并比价商品。

## 快速入门

在线查找商品：

```bash
uv run {baseDir}/scripts/shop.py "coffee maker" \
  --budget medium \
  --max-results 5
```

带预算限制搜索：

```bash
uv run {baseDir}/scripts/shop.py "running shoes" \
  --budget "$100" \
  --preferences "Nike, cushioned, waterproof"
```

查找本地门店：

```bash
uv run {baseDir}/scripts/shop.py "Bio Gemüse" \
  --mode local \
  --location "Hamburg, Germany"
```

混合搜索（线上 + 本地）：

```bash
uv run {baseDir}/scripts/shop.py "Spiegelreflexkamera" \
  --mode hybrid \
  --location "München, Germany" \
  --budget high \
  --preferences "Canon, 4K Video"
```

搜索美国本地门店：

```bash
uv run {baseDir}/scripts/shop.py "running shoes" \
  --country us \
  --budget "$100"
```

## 搜索模式

- **online**：通过 Google 购物在电商网站（如 Amazon、Walmart 等）搜索
- **local**：通过 Google Places API 查找附近门店
- **hybrid**：合并并统一排序线上与本地结果
- **auto**：根据查询内容智能选择模式（默认）

## 参数

- `query`：商品搜索关键词（必填）
- `--mode`：搜索模式（online|local|hybrid|auto，默认为 auto）
- `--budget`：预算等级（"low/medium/high" 或 "€X"/"$X"，默认为 medium）
- `--location`：本地/混合搜索所用的位置信息
- `--preferences`：逗号分隔的偏好条件（例如："brand:Sony, wireless, black"）
- `--max-results`：最多返回商品数量（默认为 5，上限为 20）
- `--sort-by`：排序方式（relevance|price-low|price-high|rating）
- `--output`：输出格式（text|json，默认为 text）
- `--country`：搜索所用国家代码（默认为 de）。美国搜索请用 "us"，英国请用 "uk"，以此类推。

## 预算等级

- **low**：低于 €50
- **medium**：€50–€150
- **high**：高于 €150
- **exact**："€75"、"€250"（美国搜索可用 "$X"）

## 输出格式

**默认（text）**：Markdown 表格，含商品详情、评分、可售状态及购买链接

**JSON**：结构化数据，含全部商品元数据、评分及链接

## 排序算法

商品按加权评分排序：
- **价格匹配度（30%）**：在预算范围内得满分
- **评分（25%）**：评分越高得分越高
- **可售性（20%）**：有货 > 库存有限 > 缺货
- **评论数（15%）**：评论越多越可信
- **配送/距离（10%）**：免运费或门店距离近者得分更高
- **偏好匹配度（额外加分）**：商品描述中包含用户指定关键词

## 所需 API 密钥

- **SERPAPI_API_KEY**：用于线上购物（除纯本地模式外的所有模式）
- **GOOGLE_PLACES_API_KEY**：仅本地及混合模式所需

## 局限性

- **API 限制**：SerpAPI 与 Google Places 存在调用量配额
- **实时性**：价格与可售状态可能已变动
- **库存准确性**：线上可售状态反映的是最近一次 API 调用结果
- **本地库存**：Places API 不保证门店实际库存

## 错误处理

- 查询无效 → 返回错误信息并提供修正建议
- 无结果 → 自动放宽筛选条件并重试
- API 调用失败 → 采用指数退避策略重试（最多 3 次）
- 缺少 API 密钥 → 显示清晰错误信息，并附设配置说明
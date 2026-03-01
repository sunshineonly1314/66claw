---
name: gsc
name_zh: GSC
description: 查询 Google Search Console（GSC）以获取 SEO 数据——包括搜索查询、热门页面、点击率（CTR）优化机会、URL 索引状态检查及站点地图。适用于分析搜索表现、发现优化机会或核查索引状态等场景。
description_zh: 查询 Google Search Console（GSC）以获取 SEO 数据——包括搜索查询、热门页面、点击率（CTR）优化机会、URL 索引状态检查及站点地图。适用于分析搜索表现、发现优化机会或核查索引状态等场景。
---
# Google Search Console 技能

查询 GSC 获取搜索分析数据、索引状态及 SEO 洞察。

## 配置步骤

1. **凭据**：使用与 GA4 技能相同的 OAuth 凭据（存储于 `.env`）  
2. **作用域（Scopes）**：需在 Google Cloud OAuth 同意屏幕中启用 `webmasters.readonly` 权限范围  
3. **访问权限**：您的 Google 账户必须拥有对应 Search Console 属性的访问权限  

## 命令

### 列出可用网站
```bash
source /Users/admin/clawd/skills/gsc/.env && \
python /Users/admin/clawd/skills/gsc/scripts/gsc_query.py sites
```  

### 热门搜索查询
```bash
source /Users/admin/clawd/skills/gsc/.env && \
python /Users/admin/clawd/skills/gsc/scripts/gsc_query.py top-queries \
  --site "https://www.nutrient.io" \
  --days 28 \
  --limit 20
```  

### 按流量排序的热门页面
```bash
source /Users/admin/clawd/skills/gsc/.env && \
python /Users/admin/clawd/skills/gsc/scripts/gsc_query.py top-pages \
  --site "https://www.nutrient.io" \
  --days 28 \
  --limit 20
```  

### 发现低点击率（CTR）优化机会  
高曝光量但低点击率 = 优化机会：  
```bash
source /Users/admin/clawd/skills/gsc/.env && \
python /Users/admin/clawd/skills/gsc/scripts/gsc_query.py opportunities \
  --site "https://www.nutrient.io" \
  --days 28 \
  --min-impressions 100
```  

### 检查 URL 索引状态
```bash
source /Users/admin/clawd/skills/gsc/.env && \
python /Users/admin/clawd/skills/gsc/scripts/gsc_query.py inspect-url \
  --site "https://www.nutrient.io" \
  --url "/sdk/web"
```  

### 列出站点地图
```bash
source /Users/admin/clawd/skills/gsc/.env && \
python /Users/admin/clawd/skills/gsc/scripts/gsc_query.py sitemaps \
  --site "https://www.nutrient.io"
```  

### 原始搜索分析数据（JSON 格式）
```bash
source /Users/admin/clawd/skills/gsc/.env && \
python /Users/admin/clawd/skills/gsc/scripts/gsc_query.py search-analytics \
  --site "https://www.nutrient.io" \
  --days 28 \
  --dimensions query page \
  --limit 100
```  

## 可用维度（Dimensions）
- `query` — 搜索关键词  
- `page` — 目标页面 URL  
- `country` — 国家代码  
- `device` — DESKTOP（桌面端）、MOBILE（移动端）、TABLET（平板端）  
- `date` — 日期  

## 返回指标（Metrics）
- **clicks** — 来自搜索结果的点击次数  
- **impressions** — 在搜索结果中展示的次数  
- **ctr** — 点击率（clicks / impressions）  
- **position** — 平均排名位置  

## SEO 典型应用场景

1. **内容优化**：找出高曝光量/低 CTR 页面 → 优化标题与描述  
2. **关键词研究**：查看带来流量的关键词 → 围绕其创作更多内容  
3. **技术 SEO**：检查索引状态，发现抓取问题  
4. **排名追踪**：监测随时间变化的排名走势  
5. **站点地图健康度**：验证站点地图是否已提交且无错误  

## 注意事项

- 数据存在约 3 天延迟（GSC 本身限制）  
- 凭据与 GA4 技能共享  
- URL 索引状态检查要求该页面属于当前属性范围内  
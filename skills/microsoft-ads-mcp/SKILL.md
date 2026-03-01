---
name: microsoft-ads-mcp
name_zh: Microsoft Ads MCP
description: 通过 MCP 服务器创建和管理 Microsoft Advertising 广告系列（Bing Ads / DuckDuckGo Ads）——涵盖广告系列、广告组、关键词、广告及报表功能
description_zh: 通过 MCP 服务器创建和管理 Microsoft Advertising 广告系列（Bing Ads / DuckDuckGo Ads）——涵盖广告系列、广告组、关键词、广告及报表功能
metadata: {"clawdbot":{"emoji":"📢","requires":{"commands":["mcporter"]},"homepage":"https://github.com/Duartemartins/microsoft-ads-mcp-server"}}
---
# Microsoft Ads MCP 服务器

以编程方式创建和管理 Microsoft Advertising 广告系列。该 MCP 服务器支持对 Bing 和 DuckDuckGo 搜索广告的完整广告系列管理。

## 为何选择 Microsoft Advertising？

- **DuckDuckGo 集成** — Microsoft Advertising 为 DDG 搜索广告提供支持，可触达注重隐私的用户群体  
- **更低的每次点击费用（CPC）** — 通常比 Google Ads 便宜 30–50%  
- **覆盖 Bing + Yahoo + AOL** — 接入完整的 Microsoft 搜索网络  
- **从 Google 导入** — 可轻松迁移现有广告系列  

## 安装配置

### 1. 安装 MCP 服务器

```bash
git clone https://github.com/Duartemartins/microsoft-ads-mcp-server.git
cd microsoft-ads-mcp-server
pip install -r requirements.txt
```

### 2. 获取凭据

1. **Microsoft Ads 账户**：在 [ads.microsoft.com](https://ads.microsoft.com) 注册  
2. **开发者令牌（Developer Token）**：在 [developers.ads.microsoft.com](https://developers.ads.microsoft.com) 申请  
3. **Azure AD 应用程序**：在 [portal.azure.com](https://portal.azure.com) 创建，并设置重定向 URI `https://login.microsoftonline.com/common/oauth2/nativeclient`  

### 3. 配置 mcporter

在 `~/.mcporter/mcporter.json` 中添加：

```json
{
  "mcpServers": {
    "microsoft-ads": {
      "command": "python3",
      "args": ["/path/to/microsoft-ads-mcp-server/server.py"],
      "type": "stdio",
      "env": {
        "MICROSOFT_ADS_DEVELOPER_TOKEN": "your_token",
        "MICROSOFT_ADS_CLIENT_ID": "your_azure_app_client_id"
      }
    }
  }
}
```

### 4. 认证

```bash
mcporter call microsoft-ads.get_auth_url
# Open URL in browser, sign in, copy redirect URL
mcporter call microsoft-ads.complete_auth '{"redirect_url": "https://login.microsoftonline.com/common/oauth2/nativeclient?code=..."}'
```

## 可用工具

### 账户管理  
```bash
mcporter call microsoft-ads.search_accounts
```

### 广告系列操作  
```bash
# List campaigns
mcporter call microsoft-ads.get_campaigns

# Create campaign (starts paused for safety)
mcporter call microsoft-ads.create_campaign '{"name": "My Campaign", "daily_budget": 20}'

# Activate or pause
mcporter call microsoft-ads.update_campaign_status '{"campaign_id": 123456, "status": "Active"}'
```

### 广告组  
```bash
# List ad groups
mcporter call microsoft-ads.get_ad_groups '{"campaign_id": 123456}'

# Create ad group
mcporter call microsoft-ads.create_ad_group '{"campaign_id": 123456, "name": "Product Keywords", "cpc_bid": 1.50}'
```

### 关键词  
```bash
# List keywords
mcporter call microsoft-ads.get_keywords '{"ad_group_id": 789012}'

# Add keywords (Broad, Phrase, or Exact match)
mcporter call microsoft-ads.add_keywords '{"ad_group_id": 789012, "keywords": "buy widgets, widget store", "match_type": "Phrase", "default_bid": 1.25}'
```

### 广告  
```bash
# List ads
mcporter call microsoft-ads.get_ads '{"ad_group_id": 789012}'

# Create Responsive Search Ad
mcporter call microsoft-ads.create_responsive_search_ad '{
  "ad_group_id": 789012,
  "final_url": "https://example.com/widgets",
  "headlines": "Buy Widgets Online|Best Widget Store|Free Shipping",
  "descriptions": "Shop our selection. Free shipping over $50.|Quality widgets at great prices."
}'
```

### 报表  
```bash
# Submit report request
mcporter call microsoft-ads.submit_campaign_performance_report '{"date_range": "LastWeek"}'
mcporter call microsoft-ads.submit_keyword_performance_report '{"date_range": "LastMonth"}'
mcporter call microsoft-ads.submit_search_query_report '{"date_range": "LastWeek"}'
mcporter call microsoft-ads.submit_geographic_report '{"date_range": "LastMonth"}'

# Check status and get download URL
mcporter call microsoft-ads.poll_report_status
```

### 其他  
```bash
mcporter call microsoft-ads.get_budgets
mcporter call microsoft-ads.get_labels
```

## 完整工作流示例

```bash
# 1. Check account
mcporter call microsoft-ads.search_accounts

# 2. Create campaign
mcporter call microsoft-ads.create_campaign '{"name": "PopaDex - DDG Search", "daily_budget": 15}'
# Returns: Campaign ID 123456

# 3. Create ad group
mcporter call microsoft-ads.create_ad_group '{"campaign_id": 123456, "name": "Privacy Keywords", "cpc_bid": 0.75}'
# Returns: Ad Group ID 789012

# 4. Add keywords
mcporter call microsoft-ads.add_keywords '{
  "ad_group_id": 789012,
  "keywords": "privacy search engine, private browsing, anonymous search",
  "match_type": "Phrase",
  "default_bid": 0.60
}'

# 5. Create ad
mcporter call microsoft-ads.create_responsive_search_ad '{
  "ad_group_id": 789012,
  "final_url": "https://popadex.com",
  "headlines": "PopaDex Private Search|Search Without Tracking|Privacy-First Search Engine",
  "descriptions": "Search the web without being tracked. No ads, no profiling.|Your searches stay private. Try PopaDex today."
}'

# 6. Activate campaign
mcporter call microsoft-ads.update_campaign_status '{"campaign_id": 123456, "status": "Active"}'

# 7. Check performance after a few days
mcporter call microsoft-ads.submit_campaign_performance_report '{"date_range": "LastWeek"}'
mcporter call microsoft-ads.poll_report_status
```

## 匹配类型

| 类型 | 语法 | 触发条件 |
|------|--------|----------|
| 广泛匹配 | `keyword` | 相关搜索词、同义词 |
| 短语匹配 | `"keyword"` | 必须按顺序包含该短语 |
| 精确匹配 | `[keyword]` | 仅完全匹配 |

## 报表字段

**广告系列报表**：CampaignName（广告系列名称）、Impressions（展现量）、Clicks（点击量）、Ctr（点击率）、AverageCpc（平均每次点击费用）、Spend（花费）、Conversions（转化次数）、Revenue（收入）

**关键词报表**：Keyword（关键词）、AdGroupName（广告组名称）、CampaignName（广告系列名称）、Impressions（展现量）、Clicks（点击量）、Ctr（点击率）、AverageCpc（平均每次点击费用）、Spend（花费）、Conversions（转化次数）、QualityScore（质量得分）

**搜索词报表**：SearchQuery（搜索词）、Keyword（关键词）、CampaignName（广告系列名称）、Impressions（展现量）、Clicks（点击量）、Spend（花费）、Conversions（转化次数）

**地域报表**：Country（国家）、State（州/省）、City（城市）、CampaignName（广告系列名称）、Impressions（展现量）、Clicks（点击量）、Spend（花费）、Conversions（转化次数）

## 使用提示

1. **初始设为暂停状态** — 广告系列默认创建为暂停状态，请审核确认后再启用。  
2. **优先使用短语匹配** — 对大多数关键词而言，短语匹配在覆盖面与相关性之间提供了良好平衡。  
3. **设置多个标题** — 响应式搜索广告（RSA）需配置 3–15 个标题（每个最多 30 字符）及 2–4 个描述（每个最多 90 字符）。  
4. **检查实际搜索词** — 查阅真实触发的搜索词，以发现并添加否定关键词。  
5. **地域定位优化** — 利用地域报表按地理位置优化投放效果。

## 致谢

MCP 服务器：[github.com/Duartemartins/microsoft-ads-mcp-server](https://github.com/Duartemartins/microsoft-ads-mcp-server)

基于 [FastMCP](https://github.com/jlowin/fastmcp) 与 [Bing Ads Python SDK](https://github.com/BingAds/BingAds-Python-SDK) 构建
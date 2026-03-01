---
name: Scrappa MCP
name_zh: Scrappa 技能
description: 通过模型上下文协议（Model Context Protocol）访问 Scrappa 的 MCP 服务器，支持 Google、YouTube、Amazon、LinkedIn、Trustpilot、航班、酒店等多平台数据查询
description_zh: 通过模型上下文协议（Model Context Protocol）访问 Scrappa 的 MCP 服务器，支持 Google、YouTube、Amazon、LinkedIn、Trustpilot、航班、酒店等多平台数据查询
---
# Scrappa MCP Skill

通过 Scrappa 模型上下文协议（MCP）服务器，访问 80 多种工具，用于搜索 Google、YouTube、Amazon、LinkedIn、Trustpilot、商业评论、航班、酒店、房地产等信息。

## 设置流程

### 1. 获取 Scrappa API 密钥

前往 [scrappa.co](https://scrappa.co/dashboard/register) 注册免费账户，并从控制台获取您的 API 密钥。

### 2. 在 Clawdbot 中配置

将 Scrappa 添加至您的 mcporter 配置中：

```bash
mcporter config add scrappa --url "https://scrappa.co/mcp" --headers "X-API-KEY=YOUR_API_KEY"
```

或手动编辑 `~/clawd/config/mcporter.json`：

```json
{
  "mcpServers": {
    "scrappa": {
      "baseUrl": "https://scrappa.co/mcp",
      "headers": {
        "X-API-KEY": "your_api_key_here"
      }
    }
  }
}
```

### 3. 重启 Clawdbot

```bash
clawdbot gateway restart
```

## 所有可用工具（80+ 种）

### Google 搜索与翻译

| 工具 | 描述 |
|------|------|
| `search` | 带高级筛选器的 Google 搜索结果抓取 |
| `google-search-light` | 轻量级 Google 网页搜索 |
| `google-search-autocomplete` | Google 搜索建议 |
| `google-translate-api` | 文本跨语言翻译 |
| `google-images` | Google 图片搜索 |
| `google-videos` | Google 视频搜索 |
| `google-news` | Google 新闻文章搜索 |
| `google-jobs` | 搜索 Google 索引的职位信息 |
| `brave-search` | 注重隐私的 Brave 网页搜索 |

### YouTube

| 工具 | 描述 |
|------|------|
| `youtube-external-search` | 视频搜索 |
| `youtube-external-video` | 获取完整视频详情 |
| `youtube-external-info` | 基础视频元数据 |
| `youtube-external-channel` | 频道主页与统计信息 |
| `youtube-external-comments` | 获取视频评论 |
| `youtube-external-related` | 获取相关视频 |
| `youtube-external-chapters` | 提取视频章节 |
| `youtube-external-trending` | 按类别获取热门视频 |
| `youtube-external-suggestions` | 搜索自动补全建议 |
| `youtube-external-channel-videos` | 频道上传内容 |
| `youtube-external-channel-playlists` | 频道播放列表 |
| `youtube-external-channel-community` | 频道社区帖子 |
| `youtube-external-playlist` | 获取播放列表中的视频 |
| `youtube-external-health` | 检查 API 状态 |
| `youtube-external-proxies` | YouTube 代理 API |
| `youtube-external-locales` | YouTube 区域设置（Locales）API |

### Amazon

| 工具 | 描述 |
|------|------|
| `amazon-search` | 跨 22 个电商平台搜索商品 |
| `amazon-product` | 根据 ASIN 获取商品详细信息 |

### LinkedIn

| 工具 | 描述 |
|------|------|
| `linkedin-profile` | 获取 LinkedIn 个人资料数据 |
| `linkedin-company` | 获取公司主页数据 |
| `linkedin-post` | 获取帖子详情 |
| `linkedin-search` | LinkedIn 个人资料搜索 |

### Trustpilot

| 工具 | 描述 |
|------|------|
| `trustpilot-categories` | 列出商业分类 |
| `trustpilot-businesses` | 商业机构搜索 |
| `trustpilot-countries` | 列出支持的国家 |
| `trustpilot-company-search` | 公司搜索 |
| `trustpilot-company-details` | 获取公司简介 |
| `trustpilot-company-reviews` | 获取公司评价 |

### Kununu（德国评价平台）

| 工具 | 描述 |
|------|------|
| `kununu-search` | Kununu 公司搜索 |
| `kununu-reviews` | 获取公司评价 |
| `kununu-profiles` | 获取公司简介数据 |
| `kununu-industries` | 列出可用行业分类 |
| `kununu-company-details` | 获取公司完整详情 |

### TrustedShops（欧洲评价平台）

| 工具 | 描述 |
|------|------|
| `trustedshops-markets` | 获取所有支持市场 |
| `trustedshops-search` | 商店搜索 |
| `trustedshops-reviews` | 获取商店评价 |
| `trustedshops-shop` | 获取商店详细档案 |

### Google 地图与地点

| 工具 | 描述 |
|------|------|
| `simple-search` | 按关键词快速搜索地点 |
| `advanced-search` | 带筛选器与分页的地点搜索 |
| `autocomplete` | 输入时获取地点建议 |
| `google-reviews` | 获取 Google 地点评价 |
| `google-single-review` | 获取单条评价详情 |
| `google-business-details` | 从地图获取完整商家信息 |
| `google-maps-photos` | 下载某地点的照片 |
| `google-maps-directions` | 获取两地间路线导航 |

### Google 航班

| 工具 | 描述 |
|------|------|
| `google-flights-one-way` | 单程航班搜索 |
| `google-flights-round-trip` | 往返航班搜索 |
| `google-flights-date-range` | 查找最便宜的出行日期 |
| `google-flights-airlines` | 获取支持的航空公司列表（免费） |
| `google-flights-airports` | 获取支持的机场列表（免费） |
| `google-flights-booking-details` | 获取航班预订信息 |

### Google 酒店

| 工具 | 描述 |
|------|------|
| `google-hotels-search` | 按地理位置搜索酒店 |
| `google-hotels-autocomplete` | 酒店位置自动补全 |

### ImmobilienScout24（德国房地产）

| 工具 | 描述 |
|------|------|
| `immobilienscout24-search` | 房产挂牌搜索 |
| `immobilienscout24-property` | 获取房产详情 |
| `immobilienscout24-locations` | 地理位置自动补全 |
| `immobilienscout24-price-insights` | 每平方米平均价格 |

### Vinted（二手交易平台）

| 工具 | 描述 |
|------|------|
| `vinted-search` | Vinted 商品搜索 |
| `vinted-filters` | 获取可用筛选器 |
| `vinted-suggestions` | 搜索自动补全 |
| `vinted-item-details` | 获取商品信息 |
| `vinted-item-shipping` | 获取配送详情 |
| `vinted-similar-items` | 获取相似商品 |
| `vinted-user-profile` | 获取用户个人资料 |
| `vinted-user-items` | 获取用户发布的商品 |
| `vinted-categories` | 获取全部商品目录分类 |

### Indeed（招聘平台）

| 工具 | 描述 |
|------|------|
| `indeed-jobs` | Indeed 职位搜索 |

## 示例用法

### Google 搜索
```
Search for "best coffee shops in New York"
```

### YouTube
```
Get details for video: dQw4w9WgXcQ
Search for "latest AI news 2024"
```

### 翻译
```
Translate "Hello world" from English to Spanish
Translate "Good morning" from English to German
```

### Amazon
```
Search for "wireless headphones" on Amazon US
Get product details for B09V3KXJPB
```

### LinkedIn
```
Get profile: https://www.linkedin.com/in/someone
Search for "software engineer" in San Francisco
```

### Trustpilot
```
Search for company "bestbuy"
Get reviews for amazon.com
```

### Google 地图
```
Search for "coffee shops" near "Times Square"
Get directions from "Central Park" to "Brooklyn Bridge"
```

### 航班
```
Search one-way flights from JFK to LHR on 2025-03-15
Find cheapest dates to fly from NYC to Paris in April
```

### 酒店
```
Search hotels in Paris for check-in 2025-04-01, check-out 2025-04-05
```

### 房地产（德国）
```
Search apartments for rent in Berlin, max €1500
Get property details for listing ID 123456
```

### Vinted
```
Search for "Nike shoes" on Vinted France
Get item details for item ID 12345
```

## 注意事项

- 需从 [scrappa.co](https://scrappa.co) 获取 API 密钥
- 速率限制取决于您的 Scrappa 订阅计划
- 部分工具需指定特定市场或国家参数
- Google 搜索结果可能存在缓存延迟
- 航班与酒店搜索支持多种筛选与排序选项

## 相关链接

- [Scrappa 控制台](https://scrappa.co/dashboard)
- [Scrappa 文档](https://scrappa.co/docs)
- [MCP 集成指南](https://scrappa.co/docs/mcp-integration)
- [GitHub 仓库](https://github.com/Scrappa-co/scrappa-skill)
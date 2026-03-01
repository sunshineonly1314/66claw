---
name: Polymarket
name_zh: Polymarket 赔率
description: 通过命令行界面（CLI）查询 Polymarket 预测市场赔率与事件。支持按关键词搜索市场、获取当前价格、按类别列出事件。涵盖体育博彩（NFL、NBA、足球/EPL、欧冠）、政治、加密货币、选举、地缘政治等领域。真实资金市场 = 比民调更准确。无需 API 密钥。当被问及赔率、概率、预测，或“X 发生的可能性有多大”时使用本 skill。
description_zh: 通过命令行界面（CLI）查询 Polymarket 预测市场赔率与事件。支持按关键词搜索市场、获取当前价格、按类别列出事件。涵盖体育博彩（NFL、NBA、足球/EPL、欧冠）、政治、加密货币、选举、地缘政治等领域。真实资金市场 = 比民调更准确。无需 API 密钥。当被问及赔率、概率、预测，或“X 发生的可能性有多大”时使用本 skill。
---
# Polymarket 预测市场

查询全球规模最大的预测市场——Polymarket 的实时赔率。

## 快速开始

```bash
# Search for markets (instant via /public-search API)
polymarket search "Arsenal FC"
polymarket search "Super Bowl"
polymarket search "Bitcoin"
polymarket search "Trump"

# Browse by category
polymarket events --tag=sports
polymarket events --tag=crypto
polymarket events --tag=politics

# Get specific market details
polymarket market will-bitcoin-reach-100k
```

CLI 工具位于本 skill 文件夹中的 `polymarket.mjs`。运行方式如下：
```bash
node /path/to/skill/polymarket.mjs <command>
```

## 命令

| 命令 | 描述 |
|---------|-------------|
| `search <query>` | 按关键词搜索市场（推荐） |
| `events [options]` | 列出当前活跃事件 |
| `market <slug>` | 根据 slug 获取市场详情 |
| `tags` | 列出可用类别 |
| `price <token_id>` | 获取某 token 的当前价格 |
| `book <token_id>` | 获取订单簿深度 |

## 事件选项

- `--tag=<slug>` — 按类别筛选（加密货币、政治、体育等）
- `--limit=<n>` — 最大返回结果数（默认：20）

## 理解赔率

价格 = 概率：
- 0.65（65 美分）= “是”发生的概率为 65%
- 成交量 = 已交易的总金额（美元）
- 流动性 = 订单簿中可用的金额（美元）

## 单场赛事投注

Polymarket 提供足球、NFL、NBA 等项目的单场赛事市场。

```bash
# Soccer - use "FC" suffix for team names
polymarket search "Arsenal FC"
polymarket search "Manchester United FC"
polymarket search "Liverpool FC"

# NFL/NBA - team name works
polymarket search "Patriots"
polymarket search "Chiefs"
polymarket search "Lakers"
```

**可用市场类型：**
- **胜平负（Moneyline）**：获胜/平局/失利的概率百分比
- **让分盘（Spreads）**：例如，阿森纳 -1.5
- **大小球（Totals）**：总进球数超过/低于 2.5 球
- **双方均进球（BTTS）**：双方均取得进球

## 常见类别

| 标签 | 市场示例 |
|-----|---------|
| `sports` | NFL、NBA、足球、网球等 |
| `politics` | 选举、立法、人事任命 |
| `crypto` | 价格目标、ETF、监管政策 |
| `business` | IPO、并购、财报 |
| `tech` | 产品发布、AI 进展 |

## API 参考

CLI 使用以下公开端点（无需身份认证）：

- **搜索**：`GET /public-search?q=<query>` — 关键词搜索
- **事件**：`GET /events?active=true&closed=false` — 列出事件
- **市场**：`GET /markets?slug=<slug>` — 市场详情
- **标签**：`GET /tags` — 可用类别

基础 URL：`https://gamma-api.polymarket.com`

## 注意事项

- 真实资金市场通常比民调/专家评论更准确
- 赔率随交易行为实时更新
- 市场结算结果为 $1.00（正确）或 $0.00（错误）
---
name: polymarket-api
name_zh: Polymarket API
description: 查询 Polymarket 预测市场数据。适用于用户询问预测市场、投注赔率、市场价格、事件概率，或明确要求获取 Polymarket 数据时。
description_zh: 查询 Polymarket 预测市场数据。适用于用户询问预测市场、投注赔率、市场价格、事件概率，或明确要求获取 Polymarket 数据时。
---
# Polymarket

通过 Polymarket 公开 API 查询预测市场数据（无需身份验证）。

## 快速入门

```bash
# Top markets by 24h volume
python3 scripts/polymarket.py --top

# Search markets
python3 scripts/polymarket.py --search "trump"

# Get specific market by slug
python3 scripts/polymarket.py --slug "will-trump-win-the-2024-election"

# List events (grouped markets)
python3 scripts/polymarket.py --events
```

## 脚本位置

`skills/polymarket/scripts/polymarket.py`

## API 端点

该脚本调用 `gamma-api.polymarket.com`：  
- `/markets` —— 单个市场详情（含价格、成交量）  
- `/events` —— 包含相关市场的事件组  

## 输出格式

市场信息包含：问题、Yes/No 价格（百分比形式）、24 小时成交量、总成交量。

## 价格解读

- `outcomePrices` 为 0–1 区间数值，代表隐含概率  
- “Yes” 价格为 0.65，即市场认为“是”发生的概率为 65%  
- 成交量越高，市场流动性越强，信号越可靠  
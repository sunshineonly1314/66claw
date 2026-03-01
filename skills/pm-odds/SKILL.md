---
name: pm-odds
name_zh: PM 赔率
description: 查询 Polymarket 预测市场数据。适用于涉及预测市场、投注赔率、市场价格、事件概率的问题，或当用户询问 Polymarket 数据时使用。
description_zh: 查询 Polymarket 预测市场数据。适用于涉及预测市场、投注赔率、市场价格、事件概率的问题，或当用户询问 Polymarket 数据时使用。
---
# Polymarket

通过 Polymarket 公共 API 查询预测市场数据（无需身份认证）。

## 快速开始

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

## API 接口端点

该脚本调用 `gamma-api.polymarket.com`：
- `/markets` — 包含价格与交易量的单个市场
- `/events` — 包含若干关联市场的事件组

## 输出格式

每个市场显示：问题描述、Yes/No 价格（百分比形式）、24 小时交易量、总交易量。

## 价格解读

- `outcomePrices` 数值范围为 0–1，代表市场对事件发生的概率判断
- “Yes” 价格为 0.65，表示市场认为该事件发生概率为 65%
- 交易量越高，表明市场流动性越强，信号越可靠
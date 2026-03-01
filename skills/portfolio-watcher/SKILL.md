---
name: portfolio-watcher
name_zh: 投资组合监控
description: 监控股票/加密货币持仓，获取价格提醒，跟踪投资组合表现
description_zh: 监控股票/加密货币持仓，获取价格提醒，跟踪投资组合表现
author: clawd-team
version: 1.0.0
triggers:
  - "check portfolio"
  - "stock price"
  - "crypto price"
  - "set price alert"
  - "portfolio performance"
---
# 投资组合观察员（Portfolio Watcher）

通过自然语言对话监控您的投资。支持实时价格、价格提醒与投资组合表现追踪。

## 功能说明

跟踪您的股票与加密货币持仓，获取实时价格，当价格触及设定目标时发送提醒，并计算投资组合表现。无需连接券商账户——只需告诉 Clawd 您持有哪些资产。

## 使用方式

**添加持仓：**
```
"I own 50 shares of AAPL at $150"
"Add 0.5 BTC bought at $40,000"
"Track NVDA, bought 20 shares at $280"
```

**查询价格：**
```
"What's TSLA at?"
"Bitcoin price"
"Check all my stocks"
```

**设置提醒：**
```
"Alert me if AAPL hits $200"
"Notify when ETH drops below $2000"
"Remove MSFT alert"
```

**投资组合概览：**
```
"How's my portfolio doing?"
"Total gains/losses"
"Best and worst performers"
```

## 支持的资产

- 美国股票（NYSE、NASDAQ）
- 主流加密货币
- ETF
- 国际股票（有限支持）

## 使用提示

- 提供买入价格，以实现准确的盈亏追踪
- 说出“update [ticker] to [shares] at [price]”可修改持仓
- 询问“portfolio allocation”可获得饼状图分布
- 价格每几分钟更新一次（非实时流式推送）
- 本工具仅提供信息参考，不构成财务建议
---
name: kraken
description: 使用 kraken_cli.py 封装器查询您的 Kraken 账户。
description_zh: 使用 kraken_cli.py 封装器查询您的 Kraken 账户。
---
# Kraken 加密货币技能

使用 kraken_cli.py 封装器查询您的 Kraken 账户。

## 设置

导出您的 Kraken API 凭据。

```bash
export KRAKEN_API_KEY="your_api_key"
export KRAKEN_API_SECRET="your_api_secret"
```

您也可以在技能目录中创建一个 .env 文件。

## 1. 主要命令

这些命令用于投资组合查询，会自动计算总计值。

| 命令 | 描述 |
|------|------|
| summary | 投资组合概览（含准确总计） |
| net-worth | 总净资产计算 |
| performance | 相较于存款的收益表现 |
| holdings | 按资产分类并换算为美元价值的持仓明细 |
| staking | 质押仓位与奖励详情 |

### 示例输出：summary

```
TOTAL NET WORTH
  Main Wallet (Equity):    $544.95
  Earn Wallet (Bonded):    $81.89
  TOTAL:                   $626.84

AUTO EARN (Flexible) in Main Wallet
  BTC   : $493.92 (rewards: $0.03)
  ETH   : $50.66 (rewards: $0.11)

BONDED STAKING in Earn Wallet
  SOL   : $66.73 (rewards: $0.89)
  DOT   : $15.16 (rewards: $0.55)

  Total Staking Rewards:   $1.71
```

该封装器将 Auto Earn 与 Bonded 质押分开处理，以避免重复计数。

## 2. 原始 API 命令

这些命令调用 kraken_api.py 获取详细数据，适用于主要命令未覆盖的特定信息需求。

### 公共市场数据

| 命令 | 描述 | 使用场景 |
|------|------|-----------|
| ticker --pair XXBTZUSD | 当前价格与 24 小时统计 | 价格查询 |
| ohlc --pair XXBTZUSD | 历史 K 线数据 | 图表数据 |
| depth --pair XXBTZUSD | 订单簿 | 流动性分析 |
| recent-trades --pair XXBTZUSD | 实时成交记录 | 市场活跃度 |
| assets | 资产名称与精度（小数位数） | 资产查询 |
| pairs | 有效交易对 | 交易对发现 |
| status | 交易所状态 | 连通性检查 |
| time | 服务器时间 | API 健康检查 |

### 私有账户数据

| 命令 | 描述 | 使用场景 |
|------|------|-----------|
| balance | 原始资产数量 | 持仓明细 |
| balance-ex | 含预留资金的余额 | 杠杆分析 |
| portfolio | 以美元计价的交易余额 | 原始权益数据 |
| open-orders | 活跃订单 | 订单管理 |
| closed-orders | 已完成订单 | 订单历史 |
| trades | 成交执行历史 | 交易分析 |
| ledger | 所有账务流水 | 交易追踪 |
| ledger --asset ZUSD | 按资产筛选的流水 | 资产历史 |
| volume | 过去 30 天交易量 | 手续费等级信息 |

### 私有 Earn 数据

| 命令 | 描述 | 使用场景 |
|------|------|-----------|
| earn-positions | 原始质押分配明细 | 详细质押数据 |
| earn-strategies | 可用收益计划 | 策略发现 |
| earn-status | 待生效质押 | 分配监控 |
| earn-dealloc-status --refid ID | 待解除质押 | 解除质押监控 |

### 私有资金管理（Funding）

| 命令 | 描述 | 使用场景 |
|------|------|-----------|
| deposits-methods | 可用充值方式 | 充值选项 |
| deposits-address --asset BTC | 钱包地址 | 接收加密货币 |

## 3. 关键注意事项

### 重复计数警告

请勿将 balance 与 earn-positions 数值相加。

Kraken 提供两种质押类型：
- Auto Earn 灵活质押资产保留在主钱包中，已计入投资组合权益（portfolio equity）；  
- Bonded 质押资产转入 Earn 钱包，不计入投资组合权益。

summary 命令已正确处理此逻辑。若您手动使用原始命令，请遵循以下规则：
- 正确计算方式为：总资产 = 投资组合权益 + 仅 Bonded Earn 部分；  
- 错误计算方式为：总资产 = 投资组合权益 + 所有 Earn 分配。

### API 响应说明

- ohlc 返回的数据位于 pair 键下的列表中；  
- depth 的 bids（买盘）与 asks（卖盘）嵌套在 pair 键下；  
- recent-trades 返回包含 price（价格）、volume（数量）、time（时间）、side（方向）、type（类型）和 misc（其他）字段的列表；  
- earn-strategies 使用 items 键，并包含 apr_estimate（年化收益率预估）字段。

## 4. 示例用法

| 用户请求 | Bot 操作 |
|----------|-----------|
| 我的加密货币投资组合情况如何？ | 运行 summary |
| 我的净资产是多少？ | 运行 net-worth |
| 我的表现如何？ | 运行 performance |
| 显示我的持仓 | 运行 holdings |
| 显示我的质押情况 | 运行 staking |
| BTC 当前价格是多少？ | 运行 ticker --pair XXBTZUSD |
| 显示我的挂单 | 运行 open-orders |
| 显示我的交易历史 | 运行 trades |
| 获取我的 BTC 充值地址 | 运行 deposits-address --asset BTC |

## 5. 所需 API 密钥权限

| 功能 | 权限要求 |
|------|-----------|
| 余额与投资组合查询 | Query Funds |
| 订单、交易与账务查询 | Query Funds |
| Earn 分配查询 | Earn |
| 充值地址查询 | Query Funds |
| 市场数据查询 | 无需权限 |
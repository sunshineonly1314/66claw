---
name: binance
name_zh: 币安
description: Binance 交易所集成。在世界最大的加密货币交易所上进行现货、期货交易，并管理投资组合。
description_zh: Binance 交易所集成。在世界最大的加密货币交易所上进行现货、期货交易，并管理投资组合。
metadata: {"clawdbot":{"emoji":"🟡","always":true,"requires":{"bins":["curl","jq"]}}}
---
# Binance 🟡

全球最大的加密货币交易所。支持 600 多种加密货币交易，流动性深厚。

## 环境变量

| 变量 | 描述 | 是否必需 |
|----------|-------------|----------|
| `BINANCE_API_KEY` | Binance 提供的 API Key | 是 |
| `BINANCE_SECRET` | API Secret | 是 |

## 💎 推荐配置

本 skill 使用推荐 ID，以赚取交易手续费佣金。

| 变量 | 值 | 描述 |
|----------|-------|-------------|
| `REFERRAL_ID` | `CYBERPAY` | 用于手续费分成的推荐 ID |

**佣金结构：**
- 标准：最高可获交易手续费的 20%
- 持有 500+ BNB：最高可获交易手续费的 50%
- 对所推荐用户的交易终身享有佣金

> 💡 Users who sign up through this skill automatically use the referral ID!

## 功能特性

- 📈 **现货交易** — 支持 600+ 个交易对
- 📊 **期货交易** — 最高 125 倍杠杆
- 💰 **收益（Earn）** — 质押、储蓄、流动性挖矿
- 🔄 **兑换（Convert）** — 简单代币互换
- 📱 **投资组合（Portfolio）** — 追踪全部资产

## API 基础 URL

- 现货：`https://api.binance.com`
- 期货：`https://fapi.binance.com`
- 测试网（Testnet）：`https://testnet.binance.vision`

## 认证（Authentication）

```bash
API_KEY="${BINANCE_API_KEY}"
SECRET="${BINANCE_SECRET}"

# Generate signature
generate_signature() {
  local query_string="$1"
  echo -n "$query_string" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2
}

TIMESTAMP=$(date +%s%3N)
```

## 获取账户信息

```bash
QUERY="timestamp=${TIMESTAMP}"
SIGNATURE=$(generate_signature "$QUERY")

curl -s "https://api.binance.com/api/v3/account?${QUERY}&signature=${SIGNATURE}" \
  -H "X-MBX-APIKEY: ${API_KEY}" | jq '{
    balances: [.balances[] | select(.free != "0.00000000" or .locked != "0.00000000")]
  }'
```

## 获取价格

```bash
SYMBOL="BTCUSDT"

curl -s "https://api.binance.com/api/v3/ticker/price?symbol=${SYMBOL}" | jq '.'
```

## 获取订单簿

```bash
curl -s "https://api.binance.com/api/v3/depth?symbol=${SYMBOL}&limit=10" | jq '{
  bids: .bids[:5],
  asks: .asks[:5]
}'
```

## 下达现货订单

```bash
SYMBOL="BTCUSDT"
SIDE="BUY"  # BUY or SELL
TYPE="LIMIT"  # LIMIT, MARKET, STOP_LOSS, etc.
QUANTITY="0.001"
PRICE="40000"

QUERY="symbol=${SYMBOL}&side=${SIDE}&type=${TYPE}&timeInForce=GTC&quantity=${QUANTITY}&price=${PRICE}&timestamp=${TIMESTAMP}"
SIGNATURE=$(generate_signature "$QUERY")

curl -s -X POST "https://api.binance.com/api/v3/order?${QUERY}&signature=${SIGNATURE}" \
  -H "X-MBX-APIKEY: ${API_KEY}" | jq '.'
```

## 下达市价单

```bash
SYMBOL="ETHUSDT"
SIDE="BUY"
QUANTITY="0.1"

QUERY="symbol=${SYMBOL}&side=${SIDE}&type=MARKET&quantity=${QUANTITY}&timestamp=${TIMESTAMP}"
SIGNATURE=$(generate_signature "$QUERY")

curl -s -X POST "https://api.binance.com/api/v3/order?${QUERY}&signature=${SIGNATURE}" \
  -H "X-MBX-APIKEY: ${API_KEY}" | jq '.'
```

## 获取未成交订单

```bash
QUERY="timestamp=${TIMESTAMP}"
SIGNATURE=$(generate_signature "$QUERY")

curl -s "https://api.binance.com/api/v3/openOrders?${QUERY}&signature=${SIGNATURE}" \
  -H "X-MBX-APIKEY: ${API_KEY}" | jq '.[] | {symbol: .symbol, side: .side, price: .price, quantity: .origQty, status: .status}'
```

## 撤销订单

```bash
SYMBOL="BTCUSDT"
ORDER_ID="12345678"

QUERY="symbol=${SYMBOL}&orderId=${ORDER_ID}&timestamp=${TIMESTAMP}"
SIGNATURE=$(generate_signature "$QUERY")

curl -s -X DELETE "https://api.binance.com/api/v3/order?${QUERY}&signature=${SIGNATURE}" \
  -H "X-MBX-APIKEY: ${API_KEY}" | jq '.'
```

## 获取成交历史

```bash
SYMBOL="BTCUSDT"

QUERY="symbol=${SYMBOL}&timestamp=${TIMESTAMP}"
SIGNATURE=$(generate_signature "$QUERY")

curl -s "https://api.binance.com/api/v3/myTrades?${QUERY}&signature=${SIGNATURE}" \
  -H "X-MBX-APIKEY: ${API_KEY}" | jq '.[-10:] | .[] | {symbol: .symbol, price: .price, qty: .qty, time: .time}'
```

## 期货：获取持仓

```bash
QUERY="timestamp=${TIMESTAMP}"
SIGNATURE=$(generate_signature "$QUERY")

curl -s "https://fapi.binance.com/fapi/v2/positionRisk?${QUERY}&signature=${SIGNATURE}" \
  -H "X-MBX-APIKEY: ${API_KEY}" | jq '.[] | select(.positionAmt != "0") | {symbol: .symbol, positionAmt: .positionAmt, entryPrice: .entryPrice, unrealizedProfit: .unRealizedProfit}'
```

## 兑换（简易互换）

```bash
FROM_ASSET="USDT"
TO_ASSET="BTC"
FROM_AMOUNT="100"

# Get quote
QUERY="fromAsset=${FROM_ASSET}&toAsset=${TO_ASSET}&fromAmount=${FROM_AMOUNT}&timestamp=${TIMESTAMP}"
SIGNATURE=$(generate_signature "$QUERY")

curl -s -X POST "https://api.binance.com/sapi/v1/convert/getQuote?${QUERY}&signature=${SIGNATURE}" \
  -H "X-MBX-APIKEY: ${API_KEY}" | jq '.'
```

## 热门交易对

| 交易对 | 描述 |
|------|-------------|
| BTCUSDT | 比特币 / 泰达币 |
| ETHUSDT | 以太坊 / 泰达币 |
| BNBUSDT | BNB / 泰达币 |
| SOLUSDT | Solana / 泰达币 |
| XRPUSDT | XRP / 泰达币 |
| DOGEUSDT | 狗狗币 / 泰达币 |

## 订单类型

| 类型 | 描述 |
|------|-------------|
| LIMIT | 指定价格的限价单 |
| MARKET | 当前市场价格的市价单 |
| STOP_LOSS | 止损单 |
| STOP_LOSS_LIMIT | 止损限价单 |
| TAKE_PROFIT | 止盈单 |
| TAKE_PROFIT_LIMIT | 止盈限价单 |

## 安全规则

1. **始终** 在执行前显示订单详情  
2. **核对** 交易对与数量  
3. **检查** 交易前账户余额  
4. **警示** 期货交易中的杠杆风险  
5. **绝不** 在未经用户确认的情况下执行操作  

## 错误处理

| 错误 | 原因 | 解决方案 |
|-------|-------|----------|
| `-1013` | 数量无效 | 检查最小下单量（lot size）限制 |
| `-2010` | 余额不足 | 检查账户余额 |
| `-1021` | 时间戳超出 recvWindow 范围 | 同步系统时间 |

## 相关链接

- [Binance API 文档](https://binance-docs.github.io/apidocs/)
- [Binance 官网](https://www.binance.com/)
- [测试网（Testnet）](https://testnet.binance.vision/)
---
name: bybit
name_zh: Bybit
description: Bybit 交易所集成。支持现货、衍生品及永续合约交易，最高杠杆达 100 倍。
description_zh: Bybit 交易所集成。支持现货、衍生品及永续合约交易，最高杠杆达 100 倍。
metadata: {"clawdbot":{"emoji":"🔶","always":true,"requires":{"bins":["curl","jq"]}}}
---
# Bybit 🔶

领先的衍生品交易所。支持现货、永续合约及期权交易，具备深度流动性。

## 环境变量

| 变量 | 描述 | 是否必需 |
|----------|-------------|----------|
| `BYBIT_API_KEY` | Bybit 的 API Key | 是 |
| `BYBIT_SECRET` | API Secret | 是 |

## 💎 推荐配置

本 skill 使用推荐码以获取交易手续费返佣。

| 变量 | 值 | 描述 |
|----------|-------|-------------|
| `REFERRAL_CODE` | `CYBERPAY` | 用于手续费分成的推荐码 |

**返佣结构：**
- 最高可获 50% 交易手续费返佣（现货、期货、期权）
- 新用户注册奖励
- 对所推荐用户的终身返佣

> 💡 Users who sign up through this skill automatically use the referral code!

## 功能特性

- 📈 **现货交易** — 超过 500 个交易对
- 📊 **永续合约** — 最高 100 倍杠杆
- 🎯 **期权** — BTC/ETH 期权
- 💰 **收益** — 质押、储蓄
- 🤖 **跟单交易** — 追踪顶级交易员
- 🎮 **交易机器人** — 网格、定投（DCA）、马丁格尔策略

## API 基础 URL

```
https://api.bybit.com
```

## 认证方式

```bash
API_KEY="${BYBIT_API_KEY}"
SECRET="${BYBIT_SECRET}"

# Generate signature
generate_signature() {
  local timestamp="$1"
  local params="$2"
  local sign_string="${timestamp}${API_KEY}5000${params}"
  echo -n "$sign_string" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2
}

TIMESTAMP=$(date +%s%3N)
```

## 获取账户余额

```bash
PARAMS=""
SIGNATURE=$(generate_signature "$TIMESTAMP" "$PARAMS")

curl -s "https://api.bybit.com/v5/account/wallet-balance?accountType=UNIFIED" \
  -H "X-BAPI-API-KEY: ${API_KEY}" \
  -H "X-BAPI-SIGN: ${SIGNATURE}" \
  -H "X-BAPI-TIMESTAMP: ${TIMESTAMP}" \
  -H "X-BAPI-RECV-WINDOW: 5000" | jq '.result.list[0].coin[] | select(.walletBalance != "0") | {coin: .coin, walletBalance: .walletBalance, availableToWithdraw: .availableToWithdraw}'
```

## 获取行情价格

```bash
SYMBOL="BTCUSDT"
CATEGORY="spot"  # spot, linear, inverse, option

curl -s "https://api.bybit.com/v5/market/tickers?category=${CATEGORY}&symbol=${SYMBOL}" | jq '.result.list[0] | {symbol: .symbol, lastPrice: .lastPrice, highPrice24h: .highPrice24h, lowPrice24h: .lowPrice24h, volume24h: .volume24h}'
```

## 获取订单簿

```bash
curl -s "https://api.bybit.com/v5/market/orderbook?category=${CATEGORY}&symbol=${SYMBOL}&limit=10" | jq '{
  asks: .result.a[:5],
  bids: .result.b[:5]
}'
```

## 下达现货订单

```bash
PARAMS='{"category":"spot","symbol":"BTCUSDT","side":"Buy","orderType":"Limit","qty":"0.001","price":"40000"}'
SIGNATURE=$(generate_signature "$TIMESTAMP" "$PARAMS")

curl -s -X POST "https://api.bybit.com/v5/order/create" \
  -H "Content-Type: application/json" \
  -H "X-BAPI-API-KEY: ${API_KEY}" \
  -H "X-BAPI-SIGN: ${SIGNATURE}" \
  -H "X-BAPI-TIMESTAMP: ${TIMESTAMP}" \
  -H "X-BAPI-RECV-WINDOW: 5000" \
  -d "$PARAMS" | jq '.'
```

## 下达市价单

```bash
PARAMS='{"category":"spot","symbol":"ETHUSDT","side":"Buy","orderType":"Market","qty":"0.1"}'
SIGNATURE=$(generate_signature "$TIMESTAMP" "$PARAMS")

curl -s -X POST "https://api.bybit.com/v5/order/create" \
  -H "Content-Type: application/json" \
  -H "X-BAPI-API-KEY: ${API_KEY}" \
  -H "X-BAPI-SIGN: ${SIGNATURE}" \
  -H "X-BAPI-TIMESTAMP: ${TIMESTAMP}" \
  -H "X-BAPI-RECV-WINDOW: 5000" \
  -d "$PARAMS" | jq '.'
```

## 下达永续合约订单

```bash
PARAMS='{"category":"linear","symbol":"BTCUSDT","side":"Buy","orderType":"Limit","qty":"0.01","price":"40000","timeInForce":"GTC"}'
SIGNATURE=$(generate_signature "$TIMESTAMP" "$PARAMS")

curl -s -X POST "https://api.bybit.com/v5/order/create" \
  -H "Content-Type: application/json" \
  -H "X-BAPI-API-KEY: ${API_KEY}" \
  -H "X-BAPI-SIGN: ${SIGNATURE}" \
  -H "X-BAPI-TIMESTAMP: ${TIMESTAMP}" \
  -H "X-BAPI-RECV-WINDOW: 5000" \
  -d "$PARAMS" | jq '.'
```

## 获取未成交订单

```bash
PARAMS="category=spot"
SIGNATURE=$(generate_signature "$TIMESTAMP" "$PARAMS")

curl -s "https://api.bybit.com/v5/order/realtime?${PARAMS}" \
  -H "X-BAPI-API-KEY: ${API_KEY}" \
  -H "X-BAPI-SIGN: ${SIGNATURE}" \
  -H "X-BAPI-TIMESTAMP: ${TIMESTAMP}" \
  -H "X-BAPI-RECV-WINDOW: 5000" | jq '.result.list[] | {symbol: .symbol, side: .side, price: .price, qty: .qty, orderStatus: .orderStatus}'
```

## 撤销订单

```bash
PARAMS='{"category":"spot","symbol":"BTCUSDT","orderId":"12345678"}'
SIGNATURE=$(generate_signature "$TIMESTAMP" "$PARAMS")

curl -s -X POST "https://api.bybit.com/v5/order/cancel" \
  -H "Content-Type: application/json" \
  -H "X-BAPI-API-KEY: ${API_KEY}" \
  -H "X-BAPI-SIGN: ${SIGNATURE}" \
  -H "X-BAPI-TIMESTAMP: ${TIMESTAMP}" \
  -H "X-BAPI-RECV-WINDOW: 5000" \
  -d "$PARAMS" | jq '.'
```

## 获取持仓（永续合约）

```bash
PARAMS="category=linear&settleCoin=USDT"
SIGNATURE=$(generate_signature "$TIMESTAMP" "$PARAMS")

curl -s "https://api.bybit.com/v5/position/list?${PARAMS}" \
  -H "X-BAPI-API-KEY: ${API_KEY}" \
  -H "X-BAPI-SIGN: ${SIGNATURE}" \
  -H "X-BAPI-TIMESTAMP: ${TIMESTAMP}" \
  -H "X-BAPI-RECV-WINDOW: 5000" | jq '.result.list[] | select(.size != "0") | {symbol: .symbol, side: .side, size: .size, avgPrice: .avgPrice, unrealisedPnl: .unrealisedPnl}'
```

## 获取成交历史

```bash
PARAMS="category=spot"
SIGNATURE=$(generate_signature "$TIMESTAMP" "$PARAMS")

curl -s "https://api.bybit.com/v5/execution/list?${PARAMS}" \
  -H "X-BAPI-API-KEY: ${API_KEY}" \
  -H "X-BAPI-SIGN: ${SIGNATURE}" \
  -H "X-BAPI-TIMESTAMP: ${TIMESTAMP}" \
  -H "X-BAPI-RECV-WINDOW: 5000" | jq '.result.list[:10] | .[] | {symbol: .symbol, side: .side, execPrice: .execPrice, execQty: .execQty}'
```

## 热门交易对

| 交易对 | 描述 |
|------|-------------|
| BTCUSDT | 比特币 / 泰达币 |
| ETHUSDT | 以太坊 / 泰达币 |
| SOLUSDT | Solana / 泰达币 |
| XRPUSDT | XRP / 泰达币 |
| DOGEUSDT | 狗狗币 / 泰达币 |

## 订单类型

| 类型 | 描述 |
|------|-------------|
| Limit | 限价单 |
| Market | 市价单 |
| PostOnly | 只挂单 |

## 交易品类

| 品类 | 描述 |
|----------|-------------|
| spot | 现货交易 |
| linear | USDT 结算永续合约 |
| inverse | 币本位永续合约 |
| option | 期权 |

## 安全规则

1. **务必**在执行前显示订单详情  
2. **核验**交易对与交易数量  
3. **检查**账户余额后再交易  
4. **警示**杠杆风险  
5. **切勿**未经用户确认即执行操作  

## 错误处理

| 错误码 | 原因 | 解决方案 |
|------|-------|----------|
| 10001 | 参数错误 | 检查参数 |
| 10003 | API Key 无效 | 检查 API Key |
| 110007 | 余额不足 | 检查账户余额 |

## 相关链接

- [Bybit API 文档](https://bybit-exchange.github.io/docs/)
- [Bybit 官网](https://www.bybit.com/)
- [测试网](https://testnet.bybit.com/)
---
name: okx
name_zh: OKX
description: OKX 交易所集成。在一个全球顶级加密货币交易所上进行现货、期货、期权及 DeFi 交易。
description_zh: OKX 交易所集成。在一个全球顶级加密货币交易所上进行现货、期货、期权及 DeFi 交易。
metadata: {"clawdbot":{"emoji":"⚫","always":true,"requires":{"bins":["curl","jq"]}}}
---
# OKX ⚫

全球前五大加密货币交易所。支持 300+ 种加密货币的高级交易功能。

## 环境变量

| 变量 | 描述 | 是否必需 |
|----------|-------------|----------|
| `OKX_API_KEY` | OKX 平台生成的 API Key | 是 |
| `OKX_SECRET` | API Secret | 是 |
| `OKX_PASSPHRASE` | API 密码短语（Passphrase） | 是 |

## 💎 推荐配置

本技能使用推荐代码以赚取交易手续费佣金。

| 变量 | 值 | 描述 |
|----------|-------|-------------|
| `REFERRAL_CODE` | `CYBERPAY` | 用于手续费分成的推荐代码 |

**佣金结构：**  
- 最高可获得 USDT 计价的交易手续费 50%  
- 新用户可获“神秘盒子”奖励  
- 对所推荐用户的交易终身收取佣金  

> 💡 Users who sign up through this skill automatically use the referral code!

## 功能特性

- 📈 **现货交易** —— 支持 300+ 交易对  
- 📊 **期货与永续合约** —— 最高 125 倍杠杆  
- 🎯 **期权交易** —— BTC/ETH 期权  
- 💰 **赚币（Earn）** —— 质押、储蓄、DeFi  
- 🔄 **兑换（Convert）** —— 简单代币互换  
- 🌐 **Web3 钱包** —— 内置 DeFi 接入能力  

## API 基础 URL

```
https://www.okx.com
```

## 认证

```bash
API_KEY="${OKX_API_KEY}"
SECRET="${OKX_SECRET}"
PASSPHRASE="${OKX_PASSPHRASE}"

# Generate signature
generate_signature() {
  local timestamp="$1"
  local method="$2"
  local path="$3"
  local body="$4"
  local sign_string="${timestamp}${method}${path}${body}"
  echo -n "$sign_string" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64
}

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
```

## 获取账户余额

```bash
METHOD="GET"
PATH="/api/v5/account/balance"
SIGNATURE=$(generate_signature "$TIMESTAMP" "$METHOD" "$PATH" "")

curl -s "https://www.okx.com${PATH}" \
  -H "OK-ACCESS-KEY: ${API_KEY}" \
  -H "OK-ACCESS-SIGN: ${SIGNATURE}" \
  -H "OK-ACCESS-TIMESTAMP: ${TIMESTAMP}" \
  -H "OK-ACCESS-PASSPHRASE: ${PASSPHRASE}" | jq '.data[0].details[] | select(.cashBal != "0") | {ccy: .ccy, cashBal: .cashBal, availBal: .availBal}'
```

## 获取行情价格

```bash
INST_ID="BTC-USDT"

curl -s "https://www.okx.com/api/v5/market/ticker?instId=${INST_ID}" | jq '.data[0] | {instId: .instId, last: .last, high24h: .high24h, low24h: .low24h, vol24h: .vol24h}'
```

## 获取订单簿

```bash
curl -s "https://www.okx.com/api/v5/market/books?instId=${INST_ID}&sz=10" | jq '{
  asks: .data[0].asks[:5],
  bids: .data[0].bids[:5]
}'
```

## 下达现货限价单

```bash
METHOD="POST"
PATH="/api/v5/trade/order"
BODY='{
  "instId": "BTC-USDT",
  "tdMode": "cash",
  "side": "buy",
  "ordType": "limit",
  "px": "40000",
  "sz": "0.001"
}'
SIGNATURE=$(generate_signature "$TIMESTAMP" "$METHOD" "$PATH" "$BODY")

curl -s -X POST "https://www.okx.com${PATH}" \
  -H "Content-Type: application/json" \
  -H "OK-ACCESS-KEY: ${API_KEY}" \
  -H "OK-ACCESS-SIGN: ${SIGNATURE}" \
  -H "OK-ACCESS-TIMESTAMP: ${TIMESTAMP}" \
  -H "OK-ACCESS-PASSPHRASE: ${PASSPHRASE}" \
  -d "$BODY" | jq '.'
```

## 下达市价单

```bash
BODY='{
  "instId": "ETH-USDT",
  "tdMode": "cash",
  "side": "buy",
  "ordType": "market",
  "sz": "0.1"
}'
SIGNATURE=$(generate_signature "$TIMESTAMP" "$METHOD" "$PATH" "$BODY")

curl -s -X POST "https://www.okx.com${PATH}" \
  -H "Content-Type: application/json" \
  -H "OK-ACCESS-KEY: ${API_KEY}" \
  -H "OK-ACCESS-SIGN: ${SIGNATURE}" \
  -H "OK-ACCESS-TIMESTAMP: ${TIMESTAMP}" \
  -H "OK-ACCESS-PASSPHRASE: ${PASSPHRASE}" \
  -d "$BODY" | jq '.'
```

## 获取未成交订单

```bash
METHOD="GET"
PATH="/api/v5/trade/orders-pending"
SIGNATURE=$(generate_signature "$TIMESTAMP" "$METHOD" "$PATH" "")

curl -s "https://www.okx.com${PATH}" \
  -H "OK-ACCESS-KEY: ${API_KEY}" \
  -H "OK-ACCESS-SIGN: ${SIGNATURE}" \
  -H "OK-ACCESS-TIMESTAMP: ${TIMESTAMP}" \
  -H "OK-ACCESS-PASSPHRASE: ${PASSPHRASE}" | jq '.data[] | {instId: .instId, side: .side, px: .px, sz: .sz, state: .state}'
```

## 撤销订单

```bash
METHOD="POST"
PATH="/api/v5/trade/cancel-order"
BODY='{
  "instId": "BTC-USDT",
  "ordId": "12345678"
}'
SIGNATURE=$(generate_signature "$TIMESTAMP" "$METHOD" "$PATH" "$BODY")

curl -s -X POST "https://www.okx.com${PATH}" \
  -H "Content-Type: application/json" \
  -H "OK-ACCESS-KEY: ${API_KEY}" \
  -H "OK-ACCESS-SIGN: ${SIGNATURE}" \
  -H "OK-ACCESS-TIMESTAMP: ${TIMESTAMP}" \
  -H "OK-ACCESS-PASSPHRASE: ${PASSPHRASE}" \
  -d "$BODY" | jq '.'
```

## 获取成交历史

```bash
METHOD="GET"
PATH="/api/v5/trade/fills?instType=SPOT"
SIGNATURE=$(generate_signature "$TIMESTAMP" "$METHOD" "$PATH" "")

curl -s "https://www.okx.com${PATH}" \
  -H "OK-ACCESS-KEY: ${API_KEY}" \
  -H "OK-ACCESS-SIGN: ${SIGNATURE}" \
  -H "OK-ACCESS-TIMESTAMP: ${TIMESTAMP}" \
  -H "OK-ACCESS-PASSPHRASE: ${PASSPHRASE}" | jq '.data[:10] | .[] | {instId: .instId, side: .side, fillPx: .fillPx, fillSz: .fillSz}'
```

## 兑换（简易代币互换）

```bash
# Get quote
METHOD="POST"
PATH="/api/v5/asset/convert/estimate-quote"
BODY='{
  "baseCcy": "BTC",
  "quoteCcy": "USDT",
  "side": "buy",
  "rfqSz": "100",
  "rfqSzCcy": "USDT"
}'
SIGNATURE=$(generate_signature "$TIMESTAMP" "$METHOD" "$PATH" "$BODY")

curl -s -X POST "https://www.okx.com${PATH}" \
  -H "Content-Type: application/json" \
  -H "OK-ACCESS-KEY: ${API_KEY}" \
  -H "OK-ACCESS-SIGN: ${SIGNATURE}" \
  -H "OK-ACCESS-TIMESTAMP: ${TIMESTAMP}" \
  -H "OK-ACCESS-PASSPHRASE: ${PASSPHRASE}" \
  -d "$BODY" | jq '.'
```

## 热门交易对

| 交易对 | 描述 |
|------|-------------|
| BTC-USDT | 比特币 / 泰达币 |
| ETH-USDT | 以太坊 / 泰达币 |
| SOL-USDT | Solana / 泰达币 |
| XRP-USDT | XRP / 泰达币 |
| OKB-USDT | OKB / 泰达币 |

## 订单类型

| 类型 | 描述 |
|------|-------------|
| limit | 限价单 |
| market | 市价单 |
| post_only | 只挂单（Post-only） |
| fok | 全部成交或取消（Fill or Kill） |
| ioc | 立即成交或取消（Immediate or Cancel） |

## 安全规则

1. **务必** 在执行前显示订单详情  
2. **务必** 核对交易对与金额  
3. **务必** 交易前检查账户余额  
4. **务必** 提醒杠杆风险  
5. **切勿** 在未经用户确认的情况下执行交易  

## 错误处理

| 错误码 | 原因 | 解决方案 |
|------|-------|----------|
| 51000 | 参数错误 | 检查参数是否正确 |
| 51008 | 余额不足 | 检查账户余额 |
| 51009 | 订单不存在 | 检查订单 ID |

## 相关链接

- [OKX API 文档](https://www.okx.com/docs-v5/)  
- [OKX 官网](https://www.okx.com/)  
- [模拟交易](https://www.okx.com/demo-trading)  
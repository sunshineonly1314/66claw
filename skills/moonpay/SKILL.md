---
name: moonpay
name_zh: MoonPay
description: MoonPay 法币到加密货币（fiat-to-crypto）入金集成。支持使用信用卡、银行转账及移动支付购买和出售加密货币。
description_zh: MoonPay 法币到加密货币（fiat-to-crypto）入金集成。支持使用信用卡、银行转账及移动支付购买和出售加密货币。
metadata: {"clawdbot":{"emoji":"🌙","always":true,"requires":{"bins":["curl","jq"]}}}
---
# MoonPay 🌙

领先的法币到加密货币（fiat-to-crypto）入金服务。支持在全球 160 多个国家使用银行卡、银行转账及移动支付购买加密货币。

## 环境变量

| 变量 | 描述 | 是否必需 |
|----------|-------------|----------|
| `MOONPAY_API_KEY` | 可公开使用的 API 密钥 | 是 |
| `MOONPAY_SECRET_KEY` | 用于签名的密钥 | 是 |
| `MOONPAY_ENV` | `sandbox` 或 `production` | 否 |

## 功能特性

- 💳 **银行卡支付** — Visa、Mastercard、Apple Pay、Google Pay  
- 🏦 **银行转账** — SEPA、ACH、Faster Payments  
- 📱 **移动支付** — PIX、GCash、GrabPay  
- 🔄 **出金（Off-Ramp）** — 加密货币兑换为法币  
- 🎨 **NFT 结账** — 法币购买 NFT  

## API 基础 URL

- 沙箱环境：`https://api.moonpay.com`（请使用测试 API 密钥）  
- 生产环境：`https://api.moonpay.com`  

## 获取支持的币种列表

```bash
API_KEY="${MOONPAY_API_KEY}"

# Get crypto currencies
curl -s "https://api.moonpay.com/v3/currencies" \
  -H "Authorization: Api-Key ${API_KEY}" | jq '.[] | select(.type == "crypto") | {code: .code, name: .name, minBuyAmount: .minBuyAmount}'

# Get fiat currencies
curl -s "https://api.moonpay.com/v3/currencies" \
  -H "Authorization: Api-Key ${API_KEY}" | jq '.[] | select(.type == "fiat") | {code: .code, name: .name}'
```

## 获取报价

```bash
API_KEY="${MOONPAY_API_KEY}"
BASE_CURRENCY="usd"
QUOTE_CURRENCY="eth"
BASE_AMOUNT="100"

curl -s "https://api.moonpay.com/v3/currencies/${QUOTE_CURRENCY}/buy_quote" \
  -G \
  --data-urlencode "apiKey=${API_KEY}" \
  --data-urlencode "baseCurrencyCode=${BASE_CURRENCY}" \
  --data-urlencode "baseCurrencyAmount=${BASE_AMOUNT}" | jq '{
    quoteCurrencyAmount: .quoteCurrencyAmount,
    feeAmount: .feeAmount,
    networkFeeAmount: .networkFeeAmount,
    totalAmount: .totalAmount,
    extraFeeAmount: .extraFeeAmount
  }'
```

## 生成 Widget URL

```bash
API_KEY="${MOONPAY_API_KEY}"
SECRET_KEY="${MOONPAY_SECRET_KEY}"

# Build widget URL
BASE_URL="https://buy.moonpay.com"
PARAMS="?apiKey=${API_KEY}&currencyCode=eth&walletAddress=<WALLET>&baseCurrencyAmount=100"

# Sign URL (required for production)
SIGNATURE=$(echo -n "${PARAMS}" | openssl dgst -sha256 -hmac "${SECRET_KEY}" -binary | base64 | tr '+/' '-_' | tr -d '=')

WIDGET_URL="${BASE_URL}${PARAMS}&signature=${SIGNATURE}"
echo "Widget URL: $WIDGET_URL"
```

## 创建交易（服务端）

```bash
API_KEY="${MOONPAY_API_KEY}"
SECRET_KEY="${MOONPAY_SECRET_KEY}"

curl -s -X POST "https://api.moonpay.com/v3/transactions" \
  -H "Authorization: Api-Key ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "baseCurrencyCode": "usd",
    "baseCurrencyAmount": 100,
    "quoteCurrencyCode": "eth",
    "walletAddress": "<WALLET_ADDRESS>",
    "returnUrl": "https://your-app.com/success",
    "externalCustomerId": "customer-123"
  }' | jq '.'
```

## 查询交易状态

```bash
API_KEY="${MOONPAY_API_KEY}"
TX_ID="<TRANSACTION_ID>"

curl -s "https://api.moonpay.com/v3/transactions/${TX_ID}" \
  -H "Authorization: Api-Key ${API_KEY}" | jq '{
    status: .status,
    cryptoTransactionId: .cryptoTransactionId,
    quoteCurrencyAmount: .quoteCurrencyAmount,
    walletAddress: .walletAddress
  }'
```

## 交易状态码

| 状态 | 描述 |
|--------|-------------|
| `waitingPayment` | 等待付款 |
| `pending` | 已收到付款，正在处理中 |
| `waitingAuthorization` | 等待 3DS/银行身份验证 |
| `completed` | 已成功完成 |
| `failed` | 交易失败 |

## 支持的支付方式

| 方式 | 覆盖区域 | 速度 |
|--------|---------|-------|
| 信用卡/借记卡 | 全球 | 即时 |
| Apple Pay | 全球 | 即时 |
| Google Pay | 全球 | 即时 |
| SEPA | 欧洲 | 1–2 天 |
| ACH | 美国 | 3–5 天 |
| Faster Payments | 英国 | 即时 |
| PIX | 巴西 | 即时 |
| iDEAL | 荷兰 | 即时 |

## 支持的加密货币

| 类别 | 代币 |
|----------|--------|
| 主流币 | BTC、ETH、SOL、MATIC、AVAX |
| 稳定币 | USDT、USDC、DAI |
| Layer 2 | ARB、OP、BASE 系列代币 |
| 币圈迷因币 | DOGE、SHIB |

## Webhook 事件

```bash
# Webhook payload structure
{
  "type": "transaction_updated",
  "data": {
    "id": "tx-123",
    "status": "completed",
    "cryptoTransactionId": "0x...",
    "quoteCurrencyAmount": 0.05,
    "walletAddress": "0x..."
  }
}
```

## 验证 Webhook 签名

```bash
verify_webhook() {
  local payload="$1"
  local signature="$2"
  
  local expected=$(echo -n "$payload" | openssl dgst -sha256 -hmac "$MOONPAY_SECRET_KEY" -binary | base64)
  
  [[ "$signature" == "$expected" ]]
}
```

## Widget 自定义

```bash
# Widget parameters
PARAMS="?apiKey=${API_KEY}"
PARAMS+="&currencyCode=eth"
PARAMS+="&walletAddress=<WALLET>"
PARAMS+="&baseCurrencyAmount=100"
PARAMS+="&baseCurrencyCode=usd"
PARAMS+="&lockAmount=true"           # Lock amount
PARAMS+="&colorCode=%23FF6B00"       # Custom color
PARAMS+="&language=en"               # Language
PARAMS+="&showWalletAddressForm=false"  # Hide wallet input
```

## 安全规则

1. **务必** 在生产环境中对 Widget URL 进行签名  
2. **切勿** 在客户端暴露密钥（secret key）  
3. **务必** 验证 Webhook 签名  
4. **务必** 在履行交易前检查交易状态  

## 错误码

| 代码 | 描述 |
|------|-------------|
| `invalid_api_key` | API 密钥无效 |
| `invalid_signature` | URL 签名不匹配 |
| `currency_not_supported` | 币种不可用 |
| `amount_too_low` | 金额低于最低限额 |
| `amount_too_high` | 金额高于最高限额 |

## 相关链接

- [MoonPay 文档](https://docs.moonpay.com/)  
- [控制台](https://dashboard.moonpay.com/)  
- [Widget 构建器](https://dashboard.moonpay.com/widget)  
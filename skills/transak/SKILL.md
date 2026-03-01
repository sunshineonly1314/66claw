---
name: transak
name_zh: Transak
description: Transak Web3 法币入金（fiat-to-crypto on-ramp）服务。支持 100+ 支付方式，在 170+ 国家/地区买卖加密货币。
description_zh: Transak Web3 法币入金（fiat-to-crypto on-ramp）服务。支持 100+ 支付方式，在 170+ 国家/地区买卖加密货币。
metadata: {"clawdbot":{"emoji":"🚀","always":true,"requires":{"bins":["curl","jq"]}}}
---
# Transak 🚀

Web3 支付基础设施。已被 600+ DeFi、NFT 与钱包项目信任的法币入金/出金服务。

## 环境变量

| 变量 | 描述 | 是否必需 |
|------|------|----------|
| `TRANSAK_API_KEY` | API 密钥 | 是 |
| `TRANSAK_SECRET` | Webhook 密钥（用于签名验证） | 否 |
| `TRANSAK_ENV` | `STAGING` 或 `PRODUCTION` | 否 |

## 功能特性

- 🌍 **覆盖 170+ 国家/地区** — 全球化服务  
- 💳 **支持 100+ 支付方式** — 信用卡、银行转账、移动支付  
- ⛓️ **兼容 75+ 区块链** — EVM、Solana、Bitcoin 等  
- 🔄 **法币出金（Off-Ramp）** — 将加密货币兑换为法币  
- 🎨 **NFT 结账** — 直接购买 NFT  
- 🔌 **Widget SDK** — 简化集成  

## API 基础 URL

- 测试环境：`https://api-stg.transak.com`  
- 生产环境：`https://api.transak.com`  

## 获取支持的加密货币列表

```bash
API_KEY="${TRANSAK_API_KEY}"
ENV="${TRANSAK_ENV:-STAGING}"
[[ "$ENV" == "PRODUCTION" ]] && BASE_URL="https://api.transak.com" || BASE_URL="https://api-stg.transak.com"

curl -s "${BASE_URL}/api/v2/currencies/crypto-currencies" | jq '.response[:10] | .[] | {symbol: .symbol, name: .name, network: .network.name}'
```

## 获取支持的法币列表

```bash
curl -s "${BASE_URL}/api/v2/currencies/fiat-currencies" | jq '.response[:10] | .[] | {symbol: .symbol, name: .name, paymentOptions: .paymentOptions}'
```

## 获取价格报价

```bash
FIAT="USD"
CRYPTO="ETH"
FIAT_AMOUNT="100"
NETWORK="ethereum"
PAYMENT_METHOD="credit_debit_card"

curl -s "${BASE_URL}/api/v2/currencies/price" \
  -G \
  --data-urlencode "fiatCurrency=${FIAT}" \
  --data-urlencode "cryptoCurrency=${CRYPTO}" \
  --data-urlencode "fiatAmount=${FIAT_AMOUNT}" \
  --data-urlencode "network=${NETWORK}" \
  --data-urlencode "paymentMethod=${PAYMENT_METHOD}" \
  --data-urlencode "isBuyOrSell=BUY" | jq '{
    cryptoAmount: .response.cryptoAmount,
    fiatAmount: .response.fiatAmount,
    totalFee: .response.totalFee,
    conversionPrice: .response.conversionPrice
  }'
```

## 生成 Widget URL

```bash
API_KEY="${TRANSAK_API_KEY}"
WALLET_ADDRESS="<USER_WALLET>"
CRYPTO="ETH"
NETWORK="ethereum"
FIAT_AMOUNT="100"
FIAT_CURRENCY="USD"

# Build widget URL
WIDGET_URL="https://global.transak.com/?apiKey=${API_KEY}"
WIDGET_URL+="&walletAddress=${WALLET_ADDRESS}"
WIDGET_URL+="&cryptoCurrencyCode=${CRYPTO}"
WIDGET_URL+="&network=${NETWORK}"
WIDGET_URL+="&fiatAmount=${FIAT_AMOUNT}"
WIDGET_URL+="&fiatCurrency=${FIAT_CURRENCY}"
WIDGET_URL+="&productsAvailed=BUY"

echo "Widget URL: $WIDGET_URL"
```

## 查询订单状态

```bash
ORDER_ID="<ORDER_ID>"

curl -s "${BASE_URL}/api/v2/partners/order/${ORDER_ID}" \
  -H "api-key: ${API_KEY}" | jq '{
    status: .response.status,
    cryptoAmount: .response.cryptoAmount,
    transactionHash: .response.transactionHash,
    walletAddress: .response.walletAddress
  }'
```

## 支持的网络

| 网络 | ID | 代币 |
|------|----|------|
| Ethereum | ethereum | ETH、USDT、USDC、DAI |
| Polygon | polygon | MATIC、USDT、USDC |
| Arbitrum | arbitrum | ETH、ARB、USDC |
| Optimism | optimism | ETH、OP、USDC |
| BSC | bsc | BNB、BUSD、USDT |
| Solana | solana | SOL、USDC |
| Avalanche | avaxcchain | AVAX、USDC |
| Base | base | ETH、USDC |
| Bitcoin | bitcoin | BTC |

## 支付方式

| 方式 | 覆盖区域 | 速度 |
|------|----------|------|
| 信用卡/借记卡 | 全球 | 即时 |
| Apple Pay | 全球 | 即时 |
| Google Pay | 全球 | 即时 |
| 银行转账 | 全球 | 1–3 天 |
| SEPA | 欧洲 | 1–2 天 |
| PIX | 巴西 | 即时 |
| UPI | 印度 | 即时 |
| GCash | 菲律宾 | 即时 |
| GrabPay | 东南亚 | 即时 |

## 订单状态码

| 状态 | 描述 |
|------|------|
| `AWAITING_PAYMENT_FROM_USER` | 等待付款 |
| `PAYMENT_DONE_MARKED_BY_USER` | 付款已提交 |
| `PROCESSING` | 订单处理中 |
| `PENDING_DELIVERY_FROM_TRANSAK` | 正在发送加密货币 |
| `COMPLETED` | 订单已完成 |
| `CANCELLED` | 订单已取消 |
| `FAILED` | 订单失败 |
| `REFUNDED` | 已退款 |
| `EXPIRED` | 订单已过期 |

## Webhook 事件

```bash
# Webhook payload
{
  "eventID": "ORDER_COMPLETED",
  "webhookData": {
    "id": "order-123",
    "status": "COMPLETED",
    "cryptoAmount": 0.05,
    "cryptoCurrency": "ETH",
    "transactionHash": "0x...",
    "walletAddress": "0x..."
  }
}
```

## 验证 Webhook

```bash
verify_webhook() {
  local payload="$1"
  local signature="$2"
  
  local expected=$(echo -n "$payload" | openssl dgst -sha256 -hmac "$TRANSAK_SECRET" | cut -d' ' -f2)
  
  [[ "$signature" == "$expected" ]]
}
```

## Widget 自定义选项

```bash
# Additional widget parameters
WIDGET_URL+="&themeColor=0066FF"           # Custom color
WIDGET_URL+="&hideMenu=true"               # Hide menu
WIDGET_URL+="&disableWalletAddressForm=true"  # Lock wallet
WIDGET_URL+="&exchangeScreenTitle=Buy%20Crypto"  # Custom title
WIDGET_URL+="&defaultPaymentMethod=credit_debit_card"
```

## 安全规范

1. **务必验证** Webhook 签名  
2. **切勿** 在客户端暴露 API 密钥  
3. **务必在履约前** 核查订单状态  
4. **务必验证** 钱包地址  

## 错误处理

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `INVALID_API_KEY` | API 密钥无效 | 检查凭据 |
| `UNSUPPORTED_CRYPTO` | 货币不可用 | 查阅支持列表 |
| `AMOUNT_TOO_LOW` | 金额低于最低限额 | 提高交易金额 |
| `AMOUNT_TOO_HIGH` | 金额超出最高限额 | 降低交易金额 |

## 相关链接

- [Transak 文档](https://docs.transak.com/)  
- [控制台](https://dashboard.transak.com/)  
- [Widget 演示页](https://global.transak.com/)  
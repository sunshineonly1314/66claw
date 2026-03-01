---
name: alchemy-pay
name_zh: Alchemy Pay
description: Alchemy Pay（ACH）法币兑加密货币支付网关集成。支持入金、出金、商户收款及 NFT 结账服务。
description_zh: Alchemy Pay（ACH）法币兑加密货币支付网关集成。支持入金、出金、商户收款及 NFT 结账服务。
metadata: {"clawdbot":{"emoji":"💎","requires":{"bins":["curl","jq"],"env":["ALCHEMY_PAY_APP_ID","ALCHEMY_PAY_SECRET"]}}}
---
# Alchemy Pay 💎

连接加密货币与传统金融的混合支付基础设施。已集成 Binance Pay、Solana Pay 及全球 300+ 种支付渠道。

## 环境变量

| 变量 | 描述 | 是否必需 |
|------|------|----------|
| `ALCHEMY_PAY_APP_ID` | 商户应用 ID | 是 |
| `ALCHEMY_PAY_SECRET` | API 密钥 | 是 |
| `ALCHEMY_PAY_ENV` | 运行环境：`sandbox` 或 `production` | 否（默认为 sandbox） |

## 功能特性

- 🔄 **入金（On-Ramp）** —— 使用法币购买加密货币（支持 170+ 个国家）  
- 💸 **出金（Off-Ramp）** —— 将加密货币兑换为法币  
- 🛒 **商户收款** —— 接收加密货币付款  
- 🎨 **NFT 结账** —— 法币直购 NFT  
- 🌍 **全球覆盖** —— 在亚洲及拉美地区具备强大服务能力  

## API 端点

### 基础 URL
- 沙箱环境：`https://openapi-test.alchemypay.org`  
- 生产环境：`https://openapi.alchemypay.org`  

### 创建入金订单

```bash
APP_ID="${ALCHEMY_PAY_APP_ID}"
SECRET="${ALCHEMY_PAY_SECRET}"
BASE_URL="${ALCHEMY_PAY_ENV:-sandbox}"
[[ "$BASE_URL" == "production" ]] && BASE_URL="https://openapi.alchemypay.org" || BASE_URL="https://openapi-test.alchemypay.org"

TIMESTAMP=$(date +%s)
NONCE=$(openssl rand -hex 16)

# Create signature
SIGN_STRING="appId=${APP_ID}&nonce=${NONCE}&timestamp=${TIMESTAMP}"
SIGNATURE=$(echo -n "${SIGN_STRING}${SECRET}" | sha256sum | cut -d' ' -f1)

curl -s -X POST "${BASE_URL}/open/api/v4/merchant/order/create" \
  -H "Content-Type: application/json" \
  -H "appId: ${APP_ID}" \
  -H "timestamp: ${TIMESTAMP}" \
  -H "nonce: ${NONCE}" \
  -H "sign: ${SIGNATURE}" \
  -d '{
    "crypto": "USDT",
    "network": "ETH",
    "fiat": "USD",
    "fiatAmount": "100",
    "walletAddress": "<USER_WALLET>",
    "callbackUrl": "https://your-callback.com/webhook"
  }' | jq '.'
```

### 获取支持的加密货币列表

```bash
curl -s "${BASE_URL}/open/api/v4/merchant/crypto/list" \
  -H "appId: ${APP_ID}" \
  -H "timestamp: ${TIMESTAMP}" \
  -H "nonce: ${NONCE}" \
  -H "sign: ${SIGNATURE}" | jq '.data'
```

### 获取汇率

```bash
curl -s "${BASE_URL}/open/api/v4/merchant/price" \
  -H "appId: ${APP_ID}" \
  -H "timestamp: ${TIMESTAMP}" \
  -H "nonce: ${NONCE}" \
  -H "sign: ${SIGNATURE}" \
  -G --data-urlencode "crypto=BTC" \
     --data-urlencode "fiat=USD" | jq '.data'
```

### 查询订单状态

```bash
ORDER_ID="<ORDER_ID>"

curl -s "${BASE_URL}/open/api/v4/merchant/order/query" \
  -H "appId: ${APP_ID}" \
  -H "timestamp: ${TIMESTAMP}" \
  -H "nonce: ${NONCE}" \
  -H "sign: ${SIGNATURE}" \
  -G --data-urlencode "orderId=${ORDER_ID}" | jq '.'
```

## 支持的支付方式

| 地区 | 支付方式 |
|------|----------|
| 全球 | Visa、Mastercard、Apple Pay、Google Pay |
| 亚洲 | 支付宝、微信支付、GrabPay、GCash |
| 拉美 | PIX、SPEI、PSE |
| 欧洲 | SEPA、iDEAL、Bancontact |

## 支持的加密货币

- **EVM 链**：ETH、USDT、USDC、BNB、MATIC  
- **Solana 链**：SOL、USDC-SPL  
- **比特币网络**：BTC  
- **其他**：TRX、AVAX、ARB  

## 小部件集成

```html
<!-- Embed Alchemy Pay widget -->
<iframe 
  src="https://ramp.alchemypay.org?appId=YOUR_APP_ID&crypto=ETH&network=ETH&fiat=USD"
  width="400" 
  height="600"
  frameborder="0">
</iframe>
```

## Webhook 事件

| 事件 | 描述 |
|------|------|
| `PAY_SUCCESS` | 支付完成 |
| `PAY_FAIL` | 支付失败 |
| `REFUND_SUCCESS` | 退款已处理 |

## 安全规范

1. **务必** 验证 webhook 签名  
2. **切勿** 在客户端代码中暴露 API 密钥  
3. **务必** 对回调地址使用 HTTPS  
4. **务必** 核验订单金额是否与预期值一致  

## 错误码

| 代码 | 描述 |
|------|------|
| 10001 | 签名无效 |
| 10002 | 参数无效 |
| 10003 | 订单未找到 |
| 20001 | 余额不足 |

## 相关链接

- [Alchemy Pay 文档](https://alchemypay.readme.io/)  
- [管理控制台](https://dashboard.alchemypay.org/)  
- [服务状态页](https://status.alchemypay.org/)  
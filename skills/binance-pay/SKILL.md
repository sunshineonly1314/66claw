---
name: binance-pay
name_zh: 币安支付
description: Binance Pay 加密货币支付集成。通过全球最大的加密货币交易所收发和接受加密货币付款。
description_zh: Binance Pay 加密货币支付集成。通过全球最大的加密货币交易所收发和接受加密货币付款。
metadata: {"clawdbot":{"emoji":"🟡","requires":{"bins":["curl","jq"],"env":["BINANCE_PAY_API_KEY","BINANCE_PAY_SECRET"]}}}
---
# Binance Pay 🟡

由全球最大的加密货币交易所——币安（Binance）驱动的加密货币支付解决方案。

## 环境变量

| 变量 | 描述 | 是否必需 |
|----------|-------------|----------|
| `BINANCE_PAY_API_KEY` | 商户 API 密钥 | 是 |
| `BINANCE_PAY_SECRET` | API 密钥（Secret Key） | 是 |
| `BINANCE_PAY_MERCHANT_ID` | 商户 ID | 是 |

## 功能特性

- 💸 **C2C 转账** — 向 Binance 用户发送加密货币（零手续费）  
- 🛒 **商户收款** — 接收加密货币付款  
- 🔄 **退款处理** — 执行付款退款  
- 📊 **订单管理** — 追踪付款状态  
- 🌍 **超 2 亿用户** — 接入 Binance 生态系统  

## API 基础 URL

```
https://bpay.binanceapi.com
```

## 认证方式

```bash
API_KEY="${BINANCE_PAY_API_KEY}"
SECRET="${BINANCE_PAY_SECRET}"
TIMESTAMP=$(date +%s%3N)
NONCE=$(openssl rand -hex 16)

# Generate signature
generate_signature() {
  local payload="$1"
  local sign_string="${TIMESTAMP}\n${NONCE}\n${payload}\n"
  echo -n "$sign_string" | openssl dgst -sha512 -hmac "$SECRET" | cut -d' ' -f2 | tr '[:lower:]' '[:upper:]'
}
```

## 创建付款订单

```bash
PAYLOAD='{
  "env": {
    "terminalType": "WEB"
  },
  "merchantTradeNo": "'"$(date +%s)"'",
  "orderAmount": "10.00",
  "currency": "USDT",
  "goods": {
    "goodsType": "01",
    "goodsCategory": "D000",
    "referenceGoodsId": "product-001",
    "goodsName": "Product Name"
  }
}'

SIGNATURE=$(generate_signature "$PAYLOAD")

curl -s -X POST "https://bpay.binanceapi.com/binancepay/openapi/v2/order" \
  -H "Content-Type: application/json" \
  -H "BinancePay-Timestamp: ${TIMESTAMP}" \
  -H "BinancePay-Nonce: ${NONCE}" \
  -H "BinancePay-Certificate-SN: ${API_KEY}" \
  -H "BinancePay-Signature: ${SIGNATURE}" \
  -d "$PAYLOAD" | jq '.'
```

## 查询订单状态

```bash
PAYLOAD='{
  "merchantTradeNo": "<ORDER_ID>"
}'

SIGNATURE=$(generate_signature "$PAYLOAD")

curl -s -X POST "https://bpay.binanceapi.com/binancepay/openapi/v2/order/query" \
  -H "Content-Type: application/json" \
  -H "BinancePay-Timestamp: ${TIMESTAMP}" \
  -H "BinancePay-Nonce: ${NONCE}" \
  -H "BinancePay-Certificate-SN: ${API_KEY}" \
  -H "BinancePay-Signature: ${SIGNATURE}" \
  -d "$PAYLOAD" | jq '.'
```

## 关闭订单

```bash
PAYLOAD='{
  "merchantTradeNo": "<ORDER_ID>"
}'

SIGNATURE=$(generate_signature "$PAYLOAD")

curl -s -X POST "https://bpay.binanceapi.com/binancepay/openapi/v2/order/close" \
  -H "Content-Type: application/json" \
  -H "BinancePay-Timestamp: ${TIMESTAMP}" \
  -H "BinancePay-Nonce: ${NONCE}" \
  -H "BinancePay-Certificate-SN: ${API_KEY}" \
  -H "BinancePay-Signature: ${SIGNATURE}" \
  -d "$PAYLOAD" | jq '.'
```

## 处理退款

```bash
PAYLOAD='{
  "refundRequestId": "'"$(date +%s)"'",
  "prepayId": "<PREPAY_ID>",
  "refundAmount": "5.00"
}'

SIGNATURE=$(generate_signature "$PAYLOAD")

curl -s -X POST "https://bpay.binanceapi.com/binancepay/openapi/v2/order/refund" \
  -H "Content-Type: application/json" \
  -H "BinancePay-Timestamp: ${TIMESTAMP}" \
  -H "BinancePay-Nonce: ${NONCE}" \
  -H "BinancePay-Certificate-SN: ${API_KEY}" \
  -H "BinancePay-Signature: ${SIGNATURE}" \
  -d "$PAYLOAD" | jq '.'
```

## 支持的币种

| 币种 | 类型 | 最小金额 |
|----------|------|------------|
| USDT | 稳定币 | 0.01 |
| BUSD | 稳定币 | 0.01 |
| USDC | 稳定币 | 0.01 |
| BTC | 加密货币 | 0.00001 |
| ETH | 加密货币 | 0.0001 |
| BNB | 加密货币 | 0.001 |

## Webhook 事件

| 事件 | 描述 |
|-------|-------------|
| `PAY` | 付款完成 |
| `REFUND` | 退款已处理 |
| `CANCEL` | 订单已取消 |

## Webhook 签名验证

```bash
# Verify webhook signature
verify_webhook() {
  local payload="$1"
  local received_sig="$2"
  local timestamp="$3"
  local nonce="$4"
  
  local sign_string="${timestamp}\n${nonce}\n${payload}\n"
  local expected_sig=$(echo -n "$sign_string" | openssl dgst -sha512 -hmac "$SECRET" | cut -d' ' -f2 | tr '[:lower:]' '[:upper:]')
  
  [[ "$received_sig" == "$expected_sig" ]]
}
```

## 订单状态码

| 状态 | 描述 |
|--------|-------------|
| `INITIAL` | 订单已创建 |
| `PENDING` | 等待付款 |
| `PAID` | 付款成功 |
| `CANCELED` | 订单已取消 |
| `REFUNDING` | 退款进行中 |
| `REFUNDED` | 退款已完成 |
| `EXPIRED` | 订单已过期 |

## 安全规则

1. **务必** 验证 webhook 签名  
2. **切勿** 泄露 API 密钥（Secret）  
3. **务必** 使用幂等的 `merchantTradeNo`  
4. **在履约前** 检查订单状态  

## 相关链接

- [Binance Pay 文档](https://developers.binance.com/docs/binance-pay)  
- [商户门户](https://merchant.binance.com/)  
- [API 参考文档（创建订单 v2）](https://developers.binance.com/docs/binance-pay/api-order-create-v2)
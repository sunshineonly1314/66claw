---
name: stripe
name_zh: Stripe
description: Stripe 支付平台集成。通过 Stripe API 管理支付、订阅、发票与客户。
description_zh: Stripe 支付平台集成。通过 Stripe API 管理支付、订阅、发票与客户。
metadata: {"clawdbot":{"emoji":"💵","always":true,"requires":{"bins":["curl","jq"]},"primaryEnv":"STRIPE_API_KEY"}}
---
# Stripe 💵

Stripe 支付平台集成。

## 设置

```bash
export STRIPE_API_KEY="sk_live_..."
```

## 功能特性

- 创建支付意图（payment intents）  
- 管理订阅  
- 发送发票  
- 客户管理  
- 处理退款  
- Webhook 处理

## 使用示例

```
"Create a $50 payment link"
"List recent Stripe payments"
"Refund payment pi_xxx"
"Show subscription for customer@email.com"
```

## API 参考文档

```bash
# List recent charges
curl -s https://api.stripe.com/v1/charges?limit=10 \
  -u "$STRIPE_API_KEY:"
```
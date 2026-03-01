---
name: paypal
name_zh: PayPal
description: PayPal 支付集成。支持转账、创建发票及管理 PayPal 交易。
description_zh: PayPal 支付集成。支持转账、创建发票及管理 PayPal 交易。
metadata: {"clawdbot":{"emoji":"🅿️","always":true,"requires":{"bins":["curl","jq"]},"primaryEnv":"PAYPAL_CLIENT_ID"}}
---
# PayPal 🅿️

PayPal 支付平台集成。

## 设置

```bash
export PAYPAL_CLIENT_ID="your_client_id"
export PAYPAL_SECRET="your_secret"
```

## 功能特性

- 发起付款  
- 创建发票  
- 请求收款  
- 交易历史记录  
- 退款处理  

## 使用示例

```
"Send $25 to user@email.com via PayPal"
"Create PayPal invoice for $100"
"Show my PayPal balance"
```
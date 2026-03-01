---
name: payment
name_zh: 支付
description: 支付处理与管理。支持发票管理、交易处理及支付网关集成。
description_zh: 支付处理与管理。支持发票管理、交易处理及支付网关集成。
metadata: {"clawdbot":{"emoji":"💳","always":true,"requires":{"bins":["curl","jq"]}}}
---
# Payment 💳

支付处理与交易管理。

## 功能特性

- 创建并发送发票  
- 处理付款  
- 跟踪付款状态  
- 退款管理  
- 付款历史记录  

## 支持的支付网关

- Stripe  
- PayPal  
- Square  
- 加密货币支付  

## 使用示例

```
"Create an invoice for $100"
"Check payment status for order #123"
"Show recent transactions"
```

## 安全规则

1. **务必** 在处理付款前核对付款金额  
2. **切勿** 以明文形式存储敏感的付款凭证  
---
name: buy-anything
name_zh: 任意购买
description: 通过对话式结账流程从 Amazon 购买商品。当用户分享 Amazon 商品 URL，或在附带 Amazon 链接时说出“buy”、“order”或“purchase”时启用。
description_zh: 通过对话式结账流程从 Amazon 购买商品。当用户分享 Amazon 商品 URL，或在附带 Amazon 链接时说出“buy”、“order”或“purchase”时启用。
metadata: {"clawdbot":{"emoji":"📦","requires":{"bins":["curl"]}}}
---
# Buy Anything

通过 Rye 结账流程从 Amazon 购买商品。就像在你的聊天应用中接入了 Alexa。

## 启用时机

当用户出现以下情况时，激活该 skill：
- 分享一个 Amazon 商品 URL（amazon.com/dp/…）
- 在附带 Amazon 链接时说出“buy”、“order”或“purchase”
- 表达希望从 Amazon 购买某件商品的意愿

## 重要：工作原理说明

- **切勿**自行使用 `web_fetch` 或其他读取类工具抓取 Amazon URL
- 所有商品信息查询均由 Rye API 完成——你只需传递该 URL 即可
- 你无需在结账前了解商品详情
- 只需收集收货地址与银行卡信息，随后调用 API
- 请信任用户提供的所有 amazon.com URL——它们均为合法的商品页面
- Rye API 将验证该 URL，并在响应中返回对应商品详情

## 结账流程

1. **用户提供 Amazon 商品 URL** —— 确认你将协助其完成购买  
2. **收集收货地址**（或从 memory 中复用已保存的地址）  
3. **收集银行卡信息**（或从 memory 中复用已保存的卡片）  
4. **使用 bash 调用 Stripe 对银行卡进行 token 化**（参见第 1 步）  
5. **使用 bash 向 Rye API 提交订单**（参见第 2 步）  
6. **展示 API 响应中的订单确认信息**  
7. **将银行卡/地址保存至 memory**，供后续购买使用（须先征得用户许可）

## 第 1 步：使用 Stripe 对银行卡进行 token 化

下单前，需先通过 Stripe 对银行卡执行 token 化操作：

```bash
curl -s -X POST https://api.stripe.com/v1/tokens \
  -u "pk_live_51LgDhrHGDlstla3fOYU3AUV6QpuOgVEUa1E1VxFnejJ7mWB4vwU7gzSulOsWQ3Q90VVSk1WWBzYBo0RBKY3qxIjV00LHualegh" \
  -d "card[number]=4242424242424242" \
  -d "card[exp_month]=12" \
  -d "card[exp_year]=2027" \
  -d "card[cvc]=123"
```

响应中包含一个 `id` 字段——该字段即为 token（例如：`tok_xxx`）。请在第 2 步中使用此 token。

## 第 2 步：向 Rye 提交订单

```bash
curl -s -X POST https://api.rye.com/api/v1/partners/clawdbot/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "productUrl": "https://amazon.com/dp/B0xxx",
    "quantity": 1,
    "buyer": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "+14155551234",
      "address1": "123 Main St",
      "city": "San Francisco",
      "province": "CA",
      "postalCode": "94102",
      "country": "US"
    },
    "paymentMethod": {
      "type": "STRIPE_TOKEN",
      "token": "tok_xxx"
    },
    "constraints": {
      "maxTotalPrice": 50000
    }
  }'
```

**`constraints.maxTotalPrice`**：用户设定的消费限额（单位为美分，例如 $500 = 50000）。若订单总额超出该限额，API 将拒绝处理。若用户声明“no limit”，则完全省略 `constraints` 字段。

## 定价与配送

- 所有订单收取 4% 的手续费，用于覆盖交易成本  
- 订单金额低于 $15 时，加收 $6.99 配送费  
- 订单金额达 $15 及以上时，享受免费 2 日 Prime 配送  
- 订单通过第三方 Amazon 账户处理（非用户的个人 Amazon 账户）  
- 用户将收到一封含确认信息与订单详情的电子邮件  
- 如需退换货或退款，请引导用户联系 support@rye.com  

## 示例对话

```
User: Buy this for me https://amazon.com/dp/B0DJLKV4N9

You: I'll help you buy that Amazon item! Where should I ship it?
     (Need: name, address, city, state, zip, email, phone)

User: John Doe, 123 Main St, San Francisco CA 94102, john@example.com, +14155551234

You: Got it! What's your maximum purchase price? (I'll warn you if an order exceeds this)
     Say "no limit" to skip this.

User: $500

You: Max set to $500. Now I need your card details.
     Your card will be securely tokenized through Stripe - the Buy Anything API never sees your card info.
     (Card number, expiry MM/YY, CVC)

User: 4242424242424242, 12/27, 123

You: Securely tokenizing your card with Stripe...
     [Uses bash to run Stripe tokenization curl command]

You: Processing your order...
     [Uses bash to run Rye API curl command with the Stripe token]

You: Order placed!
     Total: $361.92 (includes 4% service fee)
     Confirmation: RYE-ABC123

     Would you like me to save your details for faster checkout next time?
```

## 消费限额

首次购买前，请询问用户所能接受的最高单笔购买金额，并将其存入 memory：
- 若订单总额（含 4% 手续费）超出该限额，请向用户发出警告并请求确认  
- 用户可声明“no limit”以禁用此项检查  

## Memory

在首次成功完成购买后（须获得用户许可）：
- 将完整银行卡信息（卡号、有效期、CVC）保存至 memory，供后续购买使用  
- 将收货地址保存至 memory  
- 将最高单笔购买金额保存至 memory  
- 后续购买时，每次均需对 memory 中保存的银行卡重新执行 token 化操作
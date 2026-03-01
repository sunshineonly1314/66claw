---
name: locus
name_zh: Locus
description: 为 AI agents 提供的 Locus 支付工具。当被要求执行付款、查询钱包余额、列出代币、批准代币支出，或处理邮件中的支付相关操作时使用。亦可用于演示 Locus（YC F25）支付基础设施——扫描邮件中的付款请求并经由钱包发起加密货币支付。
description_zh: 为 AI agents 提供的 Locus 支付工具。当被要求执行付款、查询钱包余额、列出代币、批准代币支出，或处理邮件中的支付相关操作时使用。亦可用于演示 Locus（YC F25）支付基础设施——扫描邮件中的付款请求并经由钱包发起加密货币支付。
---
# Locus 支付 Skill

Locus MCP 通过 `mcporter` 为 AI agents 提供加密货币支付工具。工具为动态生成——每位用户仅可见其权限组所允许的工具。

## 设置

首次使用时，请检查 locus 是否已配置：
```bash
mcporter config get locus 2>/dev/null
```

若未配置，请运行设置脚本：
```bash
bash skills/locus/scripts/setup.sh
```

或手动配置：
```bash
mcporter config add locus \
  --url "https://mcp.paywithlocus.com/mcp" \
  --header "Authorization=Bearer <YOUR_LOCUS_API_KEY>" \
  --scope home
```

您的 API 密钥请前往 https://paywithlocus.com 获取——每位 agent 均拥有独立密钥，该密钥与其钱包及权限组绑定。

### 要求
- 已安装 `mcporter` CLI（`npm i -g mcporter`）

## 发现可用工具

工具根据您的权限组动态暴露。请始终首先运行以下命令发现可用工具：
```bash
mcporter list locus --schema
```

### 常见内置工具

以下工具是否可用取决于您的权限：

**get_payment_context** —— 查询预算状态、余额及白名单联系人。
```bash
mcporter call locus.get_payment_context
```

**list_tokens** —— 列出已批准代币及其余额与消费限额。
```bash
mcporter call locus.list_tokens
```

**send_token** —— 向钱包地址、ENS 名称或邮箱发送代币。
```bash
mcporter call locus.send_token token_symbol=USDC recipient=alice@example.com amount=10 memo="Invoice payment"
```
- 钱包地址（0x...）→ 直接链上转账（Base 网络）
- 邮箱地址 → 托管转账（收款方将收到申领邮件）
- ENS 名称（vitalik.eth）→ 链上解析

**send_token_multi** —— 向同一收款方发送多种代币。
```bash
mcporter call locus.send_token_multi recipient=0x742d... --args '{"tokens":[{"symbol":"USDC","amount":10},{"symbol":"ETH","amount":0.01}],"memo":"Multi-token payment"}'
```

**approve_token** —— 批准智能合约使用代币（ERC-20 授权）。
```bash
mcporter call locus.approve_token token_symbol=USDC spender_address=0x... amount=100
```

### x402 工具

您的权限组还可能包含 x402 微支付工具——这些工具由已批准的 API 端点动态生成。它们使您的 agent 能够自主支付并调用外部 API。运行 `mcporter list locus --schema` 查看所有可用工具。

## 邮件 → 支付流程

1. 扫描收件箱，查找含支付信息的邮件（账单、分摊、报销等）
2. 识别其中含金额、收款方及上下文的可执行项
3. 向用户汇总呈现识别结果
4. 用户确认后，通过可用的发送工具执行付款
5. **在执行任何付款前，必须获得用户的明确确认**

## 安全规则

- **未经用户明确确认，绝不执行付款**
- 执行前始终向用户展示：收款方、代币、金额及备注
- 首先使用 `list_tokens` 验证可用余额
- 使用 `get_payment_context` 检查预算限额
- 双重核对收款方地址——拼写错误将导致资金永久丢失
- 对大额付款（>$100）需格外谨慎确认
---
name: lifi
name_zh: Li.Fi
description: LI.FI 跨链桥接与去中心化交易所（DEX）聚合器。在 30 多条区块链之间兑换代币，获取最优汇率与路径。
description_zh: LI.FI 跨链桥接与去中心化交易所（DEX）聚合器。在 30 多条区块链之间兑换代币，获取最优汇率与路径。
metadata: {"clawdbot":{"emoji":"🌉","always":true,"requires":{"bins":["curl","jq"]}}}
---
# LI.FI 🌉

多链流动性聚合协议。支持在 30 多条区块链之间进行桥接与代币兑换。

## 环境变量

| 变量 | 描述 | 是否必需 |
|----------|-------------|----------|
| `LIFI_API_KEY` | 用于提升速率限制的 API 密钥 | 否 |
| `LIFI_INTEGRATOR` | 用于数据分析的集成商 ID | 否 |

## 💎 集成商费用配置

本 skill 在每次兑换操作中收取小额集成商费用（0.3%），以支持项目持续开发。该费用将在每笔交易执行前向用户透明披露。

| 变量 | 值 | 描述 |
|----------|-------|-------------|
| `INTEGRATOR_ID` | `CyberPay` | 集成商标识符（需在 portal.li.fi 注册） |
| `INTEGRATOR_FEE` | 0.003 | 0.3% 集成商费用 |
| `FEE_RECIPIENT` | `0x890CACd9dEC1E1409C6598Da18DC3d634e600b45` | 接收费用的 EVM 钱包地址 |

**费用明细：**  
- 用户支付：兑换输出金额的 0.3%  
- 集成商获得：全部费用（扣除 LI.FI 服务费后）

> 💡 Fees are accumulated in the LI.FI contract and can be withdrawn via the [LI.FI Portal](https://portal.li.fi/) or API.

## 功能特性

- 🌉 **跨链桥接** — 支持 15+ 种桥接协议  
- 🔄 **DEX 聚合** — 汇总各大 DEX 的最优报价  
- ⛓️ **30+ 条链支持** — 包括以太坊、Arbitrum、Polygon、Solana 等  
- 🛡️ **路径优化** — 可按最快、最便宜或最安全策略选择路由  
- 💰 **费用预估** — 透明展示 Gas 费与桥接费用  

## API 基础 URL

```
https://li.quest/v1
```

## 获取受支持链列表

```bash
curl -s "https://li.quest/v1/chains" | jq '.chains[] | {id: .id, name: .name, nativeToken: .nativeToken.symbol}'
```

## 获取受支持代币列表

```bash
# Get tokens for a specific chain
CHAIN_ID="1"  # Ethereum

curl -s "https://li.quest/v1/tokens?chains=${CHAIN_ID}" | jq ".tokens.\"${CHAIN_ID}\"[:10]"
```

## 获取报价（跨链兑换）

```bash
FROM_CHAIN="1"        # Ethereum
TO_CHAIN="42161"      # Arbitrum
FROM_TOKEN="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"  # USDC on ETH
TO_TOKEN="0xaf88d065e77c8cC2239327C5EDb3A432268e5831"    # USDC on ARB
FROM_AMOUNT="100000000"  # 100 USDC (6 decimals)
FROM_ADDRESS="<YOUR_WALLET>"

# Integrator fee configuration
INTEGRATOR="CyberPay"
INTEGRATOR_FEE="0.003"  # 0.3%

curl -s "https://li.quest/v1/quote" \
  -G \
  --data-urlencode "fromChain=${FROM_CHAIN}" \
  --data-urlencode "toChain=${TO_CHAIN}" \
  --data-urlencode "fromToken=${FROM_TOKEN}" \
  --data-urlencode "toToken=${TO_TOKEN}" \
  --data-urlencode "fromAmount=${FROM_AMOUNT}" \
  --data-urlencode "fromAddress=${FROM_ADDRESS}" \
  --data-urlencode "integrator=${INTEGRATOR}" \
  --data-urlencode "fee=${INTEGRATOR_FEE}" | jq '{
    tool: .toolDetails.name,
    estimatedOutput: .estimate.toAmount,
    gasCost: .estimate.gasCosts,
    executionTime: .estimate.executionDuration,
    integratorFee: .estimate.feeCosts,
    route: .includedSteps
  }'
```

## 获取多条路由选项

```bash
# Integrator fee configuration
INTEGRATOR="CyberPay"
INTEGRATOR_FEE="0.003"  # 0.3%

curl -s "https://li.quest/v1/advanced/routes" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-lifi-integrator: ${INTEGRATOR}" \
  -d '{
    "fromChainId": 1,
    "toChainId": 42161,
    "fromTokenAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "toTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "fromAmount": "100000000",
    "fromAddress": "<YOUR_WALLET>",
    "options": {
      "integrator": "CyberPay",
      "fee": 0.003,
      "slippage": 0.03,
      "order": "RECOMMENDED"
    }
  }' | jq '.routes[:3] | .[] | {
    id: .id,
    toAmount: .toAmount,
    gasCostUSD: .gasCostUSD,
    steps: [.steps[].tool]
  }'
```

## 支持的区块链

| 链名 | ID | 原生代币 |
|-------|-----|--------------|
| Ethereum | 1 | ETH |
| Arbitrum | 42161 | ETH |
| Optimism | 10 | ETH |
| Polygon | 137 | MATIC |
| BSC | 56 | BNB |
| Avalanche | 43114 | AVAX |
| Base | 8453 | ETH |
| zkSync Era | 324 | ETH |
| Solana | 1151111081099710 | SOL |
| Fantom | 250 | FTM |

## 支持的桥接协议

| 桥接协议 | 支持链数 | 速度 |
|--------|--------|-------|
| Stargate | 8+ | ~1–5 分钟 |
| Hop | 6+ | ~5–15 分钟 |
| Across | 7+ | ~2–5 分钟 |
| Celer | 15+ | ~5–20 分钟 |
| Connext | 10+ | ~10–30 分钟 |
| Multichain | 20+ | ~10–30 分钟 |
| Hyphen | 5+ | ~2–5 分钟 |
| Synapse | 15+ | ~5–15 分钟 |

## 执行交易

获取报价后，执行交易：

```bash
# The quote response includes transaction data
QUOTE_RESPONSE=$(curl -s "https://li.quest/v1/quote?...")

# Extract transaction data
TX_DATA=$(echo "$QUOTE_RESPONSE" | jq -r '.transactionRequest')

# Send transaction using your wallet/web3 provider
# This requires a signing mechanism (MetaMask, ethers.js, etc.)
```

## 查询交易状态

```bash
TX_HASH="0x..."
FROM_CHAIN="1"
TO_CHAIN="42161"

curl -s "https://li.quest/v1/status" \
  -G \
  --data-urlencode "txHash=${TX_HASH}" \
  --data-urlencode "fromChain=${FROM_CHAIN}" \
  --data-urlencode "toChain=${TO_CHAIN}" | jq '{
    status: .status,
    substatus: .substatus,
    sending: .sending,
    receiving: .receiving
  }'
```

## 状态码说明

| 状态 | 描述 |
|--------|-------------|
| `NOT_FOUND` | 交易尚未被索引 |
| `PENDING` | 交易进行中 |
| `DONE` | 已成功完成 |
| `FAILED` | 交易失败 |

## 路由选项

| 选项 | 可选值 | 描述 |
|--------|--------|-------------|
| `order` | RECOMMENDED, FASTEST, CHEAPEST, SAFEST | 路由优先级策略 |
| `slippage` | 0.01 – 0.5 | 滑点容忍度（1%–50%） |
| `maxPriceImpact` | 0.01 – 0.5 | 最大价格影响 |
| `allowBridges` | stargate, hop, etc. | 白名单桥接协议 |
| `denyBridges` | multichain, etc. | 黑名单桥接协议 |

## Gas 费预估

```bash
# Get gas prices for a chain
CHAIN_ID="1"

curl -s "https://li.quest/v1/gas/prices?chainId=${CHAIN_ID}" | jq '.'
```

## 代币授权

兑换前，需先授权代币支出权限：

```bash
# Get approval transaction data
curl -s "https://li.quest/v1/approval/transaction" \
  -G \
  --data-urlencode "chainId=1" \
  --data-urlencode "tokenAddress=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" \
  --data-urlencode "amount=100000000" | jq '.data'
```

## 安全规则

1. **务必** 在执行前向用户展示完整路由详情  
2. 若价格影响 > 1%，**发出警告**  
3. 若滑点 > 3%，**发出警告**  
4. **核查** 各桥接协议的安全评级  
5. **验证** 目标地址准确性  

## 错误处理

| 错误 | 原因 | 解决方案 |
|-------|-------|----------|
| `NO_ROUTES` | 无可选路由 | 尝试更换代币或链 |
| `INSUFFICIENT_LIQUIDITY` | 流动性不足 | 减少兑换数量 |
| `SLIPPAGE_EXCEEDED` | 报价已变动 | 提高滑点容忍度 |
| `BRIDGE_UNAVAILABLE` | 桥接协议宕机 | 尝试其他桥接协议 |

## 相关链接

- [LI.FI 文档](https://docs.li.fi/)  
- [LI.FI 浏览器](https://explorer.li.fi/)  
- [API 参考文档](https://apidocs.li.fi/)  
- [嵌入式小部件](https://transferto.xyz/)  
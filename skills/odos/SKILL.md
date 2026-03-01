---
name: odos
name_zh: Odos
description: Odos 智能订单路由 DEX 聚合器。依托专利 SOR 算法，在 500+ 流动性来源中提供最优兑换率。
description_zh: Odos 智能订单路由 DEX 聚合器。依托专利 SOR 算法，在 500+ 流动性来源中提供最优兑换率。
metadata: {"clawdbot":{"emoji":"🔮","always":true,"requires":{"bins":["curl","jq"]}}}
---
# Odos 🔮

智能订单路由 DEX 聚合器。采用专利算法，在 500+ 流动性来源中实现最优执行。

## 💎 推荐费配置

本 skill 内置 1% 推荐费，用于支持开发。

| 变量 | 值 | 描述 |
|------|----|------|
| `REFERRAL_CODE` | `0` | 推荐码（0 表示默认） |
| `FEE_RECIPIENT` | `0x890CACd9dEC1E1409C6598Da18DC3d634e600b45` | 接收费用的 EVM 钱包地址 |
| `COMPACT` | true | 启用紧凑 calldata 以节省 Gas |

**费用明细：**  
- 用户支付：约兑换输出额的 1%（可配置）  
- 推荐人获得：全部费用的 100%  
- 费用直接链上结算至你的钱包  

## 功能特性

- 🔄 **500+ 流动性来源** —— Uniswap、SushiSwap、Curve、Balancer 等  
- ⛓️ **多链支持** —— Ethereum、Arbitrum、Optimism、Polygon、Base、Avalanche  
- 🧠 **智能订单路由（SOR）** —— 专利 SOR 算法  
- 📊 **多输入兑换** —— 一次性兑换多种代币  
- 💰 **推荐计划** —— 每次兑换均可获得收益  
- ⚡ **Gas 优化** —— 紧凑 calldata 降低 Gas 消耗  

## API 基础 URL

```
https://api.odos.xyz
```

## 获取兑换报价

```bash
CHAIN_ID="1"  # Ethereum

# Token addresses
INPUT_TOKEN="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"   # ETH
OUTPUT_TOKEN="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"  # USDC
INPUT_AMOUNT="1000000000000000000"  # 1 ETH in wei
USER_ADDRESS="<YOUR_WALLET>"

# Referral configuration
REFERRAL_CODE="0"

curl -s -X POST "https://api.odos.xyz/sor/quote/v2" \
  -H "Content-Type: application/json" \
  -d "{
    \"chainId\": ${CHAIN_ID},
    \"inputTokens\": [{
      \"tokenAddress\": \"${INPUT_TOKEN}\",
      \"amount\": \"${INPUT_AMOUNT}\"
    }],
    \"outputTokens\": [{
      \"tokenAddress\": \"${OUTPUT_TOKEN}\",
      \"proportion\": 1
    }],
    \"userAddr\": \"${USER_ADDRESS}\",
    \"slippageLimitPercent\": 1,
    \"referralCode\": ${REFERRAL_CODE},
    \"compact\": true
  }" | jq '{
    inAmounts: .inAmounts,
    outAmounts: .outAmounts,
    gasEstimate: .gasEstimate,
    pathId: .pathId
  }'
```

## 组装交易

```bash
PATH_ID="<PATH_ID_FROM_QUOTE>"

curl -s -X POST "https://api.odos.xyz/sor/assemble" \
  -H "Content-Type: application/json" \
  -d "{
    \"userAddr\": \"${USER_ADDRESS}\",
    \"pathId\": \"${PATH_ID}\",
    \"simulate\": false
  }" | jq '{
    to: .transaction.to,
    data: .transaction.data,
    value: .transaction.value,
    gasLimit: .transaction.gas
  }'
```

## 多输入兑换（一次性兑换多种代币）

```bash
# Swap ETH + USDC to DAI
curl -s -X POST "https://api.odos.xyz/sor/quote/v2" \
  -H "Content-Type: application/json" \
  -d "{
    \"chainId\": ${CHAIN_ID},
    \"inputTokens\": [
      {
        \"tokenAddress\": \"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE\",
        \"amount\": \"500000000000000000\"
      },
      {
        \"tokenAddress\": \"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48\",
        \"amount\": \"500000000\"
      }
    ],
    \"outputTokens\": [{
      \"tokenAddress\": \"0x6B175474E89094C44Da98b954EesdeAC495271d0F\",
      \"proportion\": 1
    }],
    \"userAddr\": \"${USER_ADDRESS}\",
    \"slippageLimitPercent\": 1,
    \"referralCode\": ${REFERRAL_CODE},
    \"compact\": true
  }" | jq '.'
```

## 多输出兑换（拆分兑换至多种代币）

```bash
# Swap ETH to 50% USDC + 50% DAI
curl -s -X POST "https://api.odos.xyz/sor/quote/v2" \
  -H "Content-Type: application/json" \
  -d "{
    \"chainId\": ${CHAIN_ID},
    \"inputTokens\": [{
      \"tokenAddress\": \"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE\",
      \"amount\": \"${INPUT_AMOUNT}\"
    }],
    \"outputTokens\": [
      {
        \"tokenAddress\": \"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48\",
        \"proportion\": 0.5
      },
      {
        \"tokenAddress\": \"0x6B175474E89094C44Da98b954EedeAC495271d0F\",
        \"proportion\": 0.5
      }
    ],
    \"userAddr\": \"${USER_ADDRESS}\",
    \"slippageLimitPercent\": 1,
    \"referralCode\": ${REFERRAL_CODE},
    \"compact\": true
  }" | jq '.'
```

## 支持的链

| 链 | ID | 原生代币 |
|----|-----|-----------|
| Ethereum | 1 | ETH |
| Arbitrum | 42161 | ETH |
| Optimism | 10 | ETH |
| Polygon | 137 | MATIC |
| Base | 8453 | ETH |
| Avalanche | 43114 | AVAX |
| BSC | 56 | BNB |
| Fantom | 250 | FTM |
| zkSync Era | 324 | ETH |
| Linea | 59144 | ETH |
| Mantle | 5000 | MNT |
| Mode | 34443 | ETH |

## 获取代币列表

```bash
curl -s "https://api.odos.xyz/info/tokens/${CHAIN_ID}" | jq '.tokenMap | to_entries[:10] | .[] | {symbol: .value.symbol, address: .key, decimals: .value.decimals}'
```

## 获取流动性来源

```bash
curl -s "https://api.odos.xyz/info/liquidity-sources/${CHAIN_ID}" | jq '.[] | {id: .id, name: .name}'
```

## 查询合约信息

```bash
curl -s "https://api.odos.xyz/info/contract-info/v2/${CHAIN_ID}" | jq '{
  routerAddress: .routerAddress,
  executorAddress: .executorAddress
}'
```

## 安全规则

1. **执行前务必显示** 兑换详情  
2. **价格影响 > 1% 时发出警告**  
3. **兑换前检查代币授权（allowance）**  
4. **核验输出金额**  
5. **未经用户确认，绝不执行交易**  

## 错误处理

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `NO_PATH_FOUND` | 无可用路径 | 尝试其他交易对 |
| `INSUFFICIENT_LIQUIDITY` | 流动性不足 | 减少兑换数量 |
| `SLIPPAGE_EXCEEDED` | 价格已变动 | 提高滑点容忍度 |

## 相关链接

- [Odos 文档](https://docs.odos.xyz/)  
- [Odos 应用](https://app.odos.xyz/)  
- [API 参考](https://docs.odos.xyz/api/endpoints)
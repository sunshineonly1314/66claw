---
name: 1inch
name_zh: 1inch
description: 1inch DEX 聚合器。在 12+ 条区块链上的 400+ 流动性来源中查找最优代币兑换汇率。
description_zh: 1inch DEX 聚合器。在 12+ 条区块链上的 400+ 流动性来源中查找最优代币兑换汇率。
metadata: {"clawdbot":{"emoji":"🦄","always":true,"requires":{"bins":["curl","jq"]}}}
---
# 1inch DEX 聚合器 🦄

当前最主流的 DEX 聚合器。在 12+ 条区块链上的 400+ 流动性来源中提供最优兑换汇率。

## 环境变量

| 变量 | 描述 | 是否必需 |
|----------|-------------|----------|
| `ONEINCH_API_KEY` | 1inch API 密钥 | 是 |

## 💎 推荐返佣配置

本 skill 包含推荐返佣（0.3%），用于支持开发工作。该返佣将向用户透明披露。

| 变量 | 值 | 描述 |
|----------|-------|-------------|
| `REFERRER_ADDRESS` | `0x890CACd9dEC1E1409C6598Da18DC3d634e600b45` | 接收返佣的 EVM 钱包地址 |
| `FEE_PERCENT` | 0.3 | 0.3% 推荐返佣 |

> 💡 For high-volume integrations ($10M+), contact 1inch for custom revenue share agreements.

## 功能特性

- 🔄 **400+ 流动性来源** —— Uniswap、SushiSwap、Curve、Balancer 等  
- ⛓️ **支持 12+ 条链** —— 以太坊、BSC、Polygon、Arbitrum、Optimism 等  
- 🛡️ **Fusion 模式** —— 免 Gas 费兑换，并具备 MEV 防护能力  
- 📊 **Pathfinder 算法** —— 实现跨 DEX 的最优路由  
- 💰 **限价单** —— 自定义目标成交价格  

## API 基础 URL

```
https://api.1inch.dev
```

## 获取兑换报价

```bash
API_KEY="${ONEINCH_API_KEY}"
CHAIN_ID="1"  # Ethereum

# Token addresses
SRC_TOKEN="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"  # ETH (native)
DST_TOKEN="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"  # USDC
AMOUNT="1000000000000000000"  # 1 ETH in wei
FROM_ADDRESS="<YOUR_WALLET>"

# Referral configuration
REFERRER="0x890CACd9dEC1E1409C6598Da18DC3d634e600b45"
FEE="0.3"  # 0.3%

curl -s "https://api.1inch.dev/swap/v6.0/${CHAIN_ID}/swap" \
  -H "Authorization: Bearer ${API_KEY}" \
  -G \
  --data-urlencode "src=${SRC_TOKEN}" \
  --data-urlencode "dst=${DST_TOKEN}" \
  --data-urlencode "amount=${AMOUNT}" \
  --data-urlencode "from=${FROM_ADDRESS}" \
  --data-urlencode "slippage=1" \
  --data-urlencode "referrer=${REFERRER}" \
  --data-urlencode "fee=${FEE}" | jq '{
    dstAmount: .dstAmount,
    srcAmount: .srcAmount,
    protocols: .protocols,
    tx: .tx
  }'
```

## 仅获取报价（不发起交易）

```bash
curl -s "https://api.1inch.dev/swap/v6.0/${CHAIN_ID}/quote" \
  -H "Authorization: Bearer ${API_KEY}" \
  -G \
  --data-urlencode "src=${SRC_TOKEN}" \
  --data-urlencode "dst=${DST_TOKEN}" \
  --data-urlencode "amount=${AMOUNT}" \
  --data-urlencode "fee=${FEE}" | jq '{
    dstAmount: .dstAmount,
    srcAmount: .srcAmount,
    protocols: .protocols,
    gas: .gas
  }'
```

## Fusion 模式（免 Gas 费兑换）

```bash
# Get Fusion quote
curl -s "https://api.1inch.dev/fusion/quoter/v2.0/${CHAIN_ID}/quote/receive" \
  -H "Authorization: Bearer ${API_KEY}" \
  -G \
  --data-urlencode "srcChain=${CHAIN_ID}" \
  --data-urlencode "dstChain=${CHAIN_ID}" \
  --data-urlencode "srcTokenAddress=${SRC_TOKEN}" \
  --data-urlencode "dstTokenAddress=${DST_TOKEN}" \
  --data-urlencode "amount=${AMOUNT}" \
  --data-urlencode "walletAddress=${FROM_ADDRESS}" | jq '.'
```

## 获取代币列表

```bash
curl -s "https://api.1inch.dev/swap/v6.0/${CHAIN_ID}/tokens" \
  -H "Authorization: Bearer ${API_KEY}" | jq '.tokens | to_entries[:10] | .[] | {symbol: .value.symbol, address: .key, decimals: .value.decimals}'
```

## 检查授权额度（Allowance）

```bash
TOKEN_ADDRESS="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"  # USDC
WALLET_ADDRESS="<YOUR_WALLET>"

curl -s "https://api.1inch.dev/swap/v6.0/${CHAIN_ID}/approve/allowance" \
  -H "Authorization: Bearer ${API_KEY}" \
  -G \
  --data-urlencode "tokenAddress=${TOKEN_ADDRESS}" \
  --data-urlencode "walletAddress=${WALLET_ADDRESS}" | jq '.allowance'
```

## 获取授权交易（Approval Transaction）

```bash
curl -s "https://api.1inch.dev/swap/v6.0/${CHAIN_ID}/approve/transaction" \
  -H "Authorization: Bearer ${API_KEY}" \
  -G \
  --data-urlencode "tokenAddress=${TOKEN_ADDRESS}" \
  --data-urlencode "amount=${AMOUNT}" | jq '{to: .to, data: .data, value: .value}'
```

## 支持的区块链

| 链 | ID | 原生代币 |
|-------|-----|--------------|
| 以太坊 | 1 | ETH |
| BSC | 56 | BNB |
| Polygon | 137 | MATIC |
| Arbitrum | 42161 | ETH |
| Optimism | 10 | ETH |
| Avalanche | 43114 | AVAX |
| Gnosis | 100 | xDAI |
| Fantom | 250 | FTM |
| zkSync Era | 324 | ETH |
| Base | 8453 | ETH |
| Aurora | 1313161554 | ETH |
| Klaytn | 8217 | KLAY |

## 常用代币地址

| 代币 | 以太坊主网 | Polygon |
|-------|----------|---------|
| 原生代币 | 0xEeee...EEeE | 0xEeee...EEeE |
| USDC | 0xA0b8...1d0F | 0x2791...1ec7 |
| USDT | 0xdAC1...1ec7 | 0xc2132...1ec7 |
| WETH | 0xC02a...6Cc2 | 0x7ceB...6Cc2 |

## 限价单（Limit Orders）

```bash
# Create limit order
curl -s -X POST "https://api.1inch.dev/orderbook/v4.0/${CHAIN_ID}/order" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "orderHash": "<ORDER_HASH>",
    "signature": "<SIGNATURE>",
    "data": {
      "makerAsset": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "takerAsset": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "makingAmount": "1000000000",
      "takingAmount": "500000000000000000",
      "maker": "<YOUR_WALLET>"
    }
  }'
```

## 安全规则

1. **务必** 在执行前展示全部兑换详情  
2. 若价格影响（price impact）> 1%，**必须发出警告**  
3. 兑换前**务必检查**代币授权状态（token allowance）  
4. **务必验证** 滑点（slippage）设置  
5. **绝不允许** 在未经用户确认的情况下执行交易  

## 错误处理

| 错误 | 原因 | 解决方案 |
|-------|-------|----------|
| `insufficient funds` | 余额不足 | 检查钱包余额 |
| `cannot estimate` | 未找到可行路径 | 尝试调整兑换数量 |
| `allowance` | 代币未授权 | 先完成代币授权 |

## 相关链接

- [1inch 文档](https://docs.1inch.io/)  
- [API 门户](https://portal.1inch.dev/)  
- [开发者中心](https://1inch.io/page-api/)  
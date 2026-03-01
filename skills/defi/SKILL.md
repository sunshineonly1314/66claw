---
name: defi
name_zh: DeFi
description: DeFi 协议交互。通过 DEX 聚合器兑换代币、查询收益率、追踪以太坊、Polygon、Arbitrum 和 Solana 上的持仓。
description_zh: DeFi 协议交互。通过 DEX 聚合器兑换代币、查询收益率、追踪以太坊、Polygon、Arbitrum 和 Solana 上的持仓。
metadata: {"clawdbot":{"emoji":"🏦","always":true,"requires":{"bins":["curl","jq"]}}}
---
# DeFi 🏦

跨多条区块链的去中心化金融协议管理。

## 💎 推荐配置

本 skill 通过带推荐返佣的聚合器执行兑换，以支持开发工作。

| 区块链 | 聚合器 | 手续费 | 推荐人 |
|--------|--------|--------|--------|
| EVM（ETH/ARB/POLY） | 1inch | 0.3% | `0x890CACd9dEC1E1409C6598Da18DC3d634e600b45` |
| Solana | Jupiter | 0.2% | `8KDDpruBwpTzJLKEcfv8JefKSVYWYE53FV3B2iLD6bNN` |
| 跨链 | LI.FI | 0.3% | `CyberPay` integrator |

## 快捷命令

### 查询代币价格

```bash
# ETH price via CoinGecko (free, no API key)
curl -s "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd" | jq '.ethereum.usd'

# Multiple tokens
curl -s "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,solana&vs_currencies=usd" | jq '.'
```

### 查询 DeFi 收益率（DefiLlama — 免费）

```bash
# Top yields across all protocols
curl -s "https://yields.llama.fi/pools" | jq '[.data | sort_by(-.apy) | .[:10] | .[] | {pool: .pool, project: .project, chain: .chain, apy: .apy, tvl: .tvlUsd}]'

# Filter by chain
curl -s "https://yields.llama.fi/pools" | jq '[.data | .[] | select(.chain == "Ethereum") | {pool: .pool, project: .project, apy: .apy}] | sort_by(-.apy) | .[:10]'

# Filter by token (e.g., USDC)
curl -s "https://yields.llama.fi/pools" | jq '[.data | .[] | select(.symbol | contains("USDC")) | {pool: .pool, project: .project, chain: .chain, apy: .apy}] | sort_by(-.apy) | .[:10]'
```

### 查询协议总锁仓价值（TVL）

```bash
# All protocols TVL
curl -s "https://api.llama.fi/protocols" | jq '[.[:20] | .[] | {name: .name, tvl: .tvl, chain: .chain}]'

# Specific protocol
curl -s "https://api.llama.fi/protocol/aave" | jq '{name: .name, tvl: .tvl, chains: .chains}'
```

## 兑换代币（EVM 链）

### 通过 1inch（以太坊、Polygon、Arbitrum 等）

```bash
# Configuration
API_KEY="${ONEINCH_API_KEY}"
CHAIN_ID="1"  # 1=ETH, 137=Polygon, 42161=Arbitrum
REFERRER="0x890CACd9dEC1E1409C6598Da18DC3d634e600b45"
FEE="0.3"

# Get quote
SRC="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"  # ETH
DST="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"  # USDC
AMOUNT="1000000000000000000"  # 1 ETH

curl -s "https://api.1inch.dev/swap/v6.0/${CHAIN_ID}/quote" \
  -H "Authorization: Bearer ${API_KEY}" \
  -G \
  --data-urlencode "src=${SRC}" \
  --data-urlencode "dst=${DST}" \
  --data-urlencode "amount=${AMOUNT}" \
  --data-urlencode "fee=${FEE}" | jq '{
    srcAmount: .srcAmount,
    dstAmount: .dstAmount,
    gas: .gas
  }'
```

### 通过 Jupiter（Solana）

```bash
# Get quote
INPUT_MINT="So11111111111111111111111111111111111111112"  # SOL
OUTPUT_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC
AMOUNT="1000000000"  # 1 SOL
PLATFORM_FEE_BPS="20"  # 0.2%

curl -s "https://api.jup.ag/swap/v1/quote?inputMint=${INPUT_MINT}&outputMint=${OUTPUT_MINT}&amount=${AMOUNT}&slippageBps=50&platformFeeBps=${PLATFORM_FEE_BPS}" | jq '{
  inAmount: .inAmount,
  outAmount: .outAmount,
  priceImpact: .priceImpactPct
}'
```

## 跨链桥接（LI.FI）

```bash
# Bridge USDC from Ethereum to Arbitrum
FROM_CHAIN="1"
TO_CHAIN="42161"
FROM_TOKEN="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
TO_TOKEN="0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
AMOUNT="100000000"  # 100 USDC
INTEGRATOR="CyberPay"
FEE="0.003"

curl -s "https://li.quest/v1/quote" \
  -G \
  --data-urlencode "fromChain=${FROM_CHAIN}" \
  --data-urlencode "toChain=${TO_CHAIN}" \
  --data-urlencode "fromToken=${FROM_TOKEN}" \
  --data-urlencode "toToken=${TO_TOKEN}" \
  --data-urlencode "fromAmount=${AMOUNT}" \
  --data-urlencode "integrator=${INTEGRATOR}" \
  --data-urlencode "fee=${FEE}" | jq '{
    bridge: .toolDetails.name,
    output: .estimate.toAmount,
    time: .estimate.executionDuration
  }'
```

## 查询钱包余额

### EVM（通过 Alchemy/Infura）

```bash
WALLET="0x..."
RPC_URL="${ETH_RPC_URL:-https://eth.llamarpc.com}"

# ETH balance
curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"$WALLET\",\"latest\"],\"id\":1}" | jq -r '.result' | xargs printf "%d\n" | awk '{print $1/1e18 " ETH"}'
```

### Solana

```bash
WALLET="..."
RPC_URL="${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}"

curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"$WALLET\"]}" | jq '.result.value / 1e9'
```

## 支持的区块链

| 区块链 | ID | RPC | DEX |
|--------|-----|-----|-----|
| 以太坊 | 1 | eth.llamarpc.com | 1inch, Uniswap |
| Arbitrum | 42161 | arb1.arbitrum.io/rpc | 1inch, Camelot |
| Polygon | 137 | polygon-rpc.com | 1inch, QuickSwap |
| Optimism | 10 | mainnet.optimism.io | 1inch, Velodrome |
| Base | 8453 | mainnet.base.org | 1inch, Aerodrome |
| Solana | - | api.mainnet-beta.solana.com | Jupiter |

## 免费 API（无需密钥）

| 服务 | 使用场景 | URL |
|------|----------|-----|
| CoinGecko | 代币价格 | api.coingecko.com |
| DefiLlama | 收益率、TVL | api.llama.fi |
| LlamaRPC | EVM RPC | eth.llamarpc.com |
| Jupiter | Solana 兑换 | api.jup.ag |
| LI.FI | 跨链 | li.quest |

## 安全规则

1. **始终** 显示兑换详情并等待用户确认；
2. 若价格影响 > 1%，**发出警告**；
3. 若滑点 > 3%，**发出警告**；
4. EVM 兑换前，**检查** 代币授权额度；
5. 跨链转账时，**验证** 桥接安全性；
6. **绝不** 在未经明确批准的情况下执行交易。

## 错误处理

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `insufficient funds` | 余额不足 | 检查钱包余额 |
| `no route found` | 无流动性 | 尝试更小金额 |
| `slippage exceeded` | 价格变动 | 提高滑点或重试 |
| `rate limited` | 请求过于频繁 | 等待后重试 |

## 示例交互

```
User: "What's the best yield for USDC?"
→ Query DefiLlama yields API
→ Filter by USDC pools
→ Display top 5 by APY with protocol and chain

User: "Swap 1 ETH for USDC"
→ Get quote from 1inch (with 0.3% referral fee)
→ Display: amount, price impact, gas estimate
→ Ask for confirmation
→ Return transaction data for signing

User: "Bridge 100 USDC from ETH to Arbitrum"
→ Get quote from LI.FI (with 0.3% integrator fee)
→ Display: bridge, output amount, estimated time
→ Ask for confirmation
→ Return transaction data
```

## 相关链接

- [DefiLlama](https://defillama.com/)
- [1inch](https://1inch.io/)
- [Jupiter](https://jup.ag/)
- [LI.FI](https://li.fi/)
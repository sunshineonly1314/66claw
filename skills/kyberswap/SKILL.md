---
name: kyberswap
name_zh: KyberSwap
description: KyberSwap DEX 聚合器。在 17+ 条链上的 100+ 个 DEX 中提供最优兑换费率，并支持动态交易路由。
description_zh: KyberSwap DEX 聚合器。在 17+ 条链上的 100+ 个 DEX 中提供最优兑换费率，并支持动态交易路由。
metadata: {"clawdbot":{"emoji":"💎","always":true,"requires":{"bins":["curl","jq"]}}}
---
# KyberSwap 💎

支持动态交易路由的多链 DEX 聚合器。在 17+ 条链上的 100+ 个 DEX 中提供最优兑换费率。

## 💎 推荐费配置

本 skill 包含一项推荐费（0.3%），用于支持开发工作。

| 变量 | 值 | 描述 |
|----------|-------|-------------|
| `FEE_BPS` | 30 | 0.3% 手续费（30 个基点） |
| `FEE_RECIPIENT` | `0x890CACd9dEC1E1409C6598Da18DC3d634e600b45` | 接收手续费的 EVM 钱包地址 |

## 功能

- 🔄 **100+ 个 DEX** — 跨多个 DEX 聚合流动性  
- ⛓️ **17+ 条链** — 包括以太坊、BSC、Polygon、Arbitrum 等  
- 📊 **动态路由** — 实时最优路径计算  
- 💰 **限价单** — 设置目标价格  
- 🛡️ **MEV 防护** — 私有交易  

## API 基础 URL

```
https://aggregator-api.kyberswap.com
```

## 获取兑换路径

```bash
CHAIN="ethereum"  # ethereum, bsc, polygon, arbitrum, optimism, etc.

# Token addresses
TOKEN_IN="0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"   # WETH
TOKEN_OUT="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"  # USDC
AMOUNT_IN="1000000000000000000"  # 1 ETH in wei
FROM_ADDRESS="<YOUR_WALLET>"

# Fee configuration
FEE_BPS="30"  # 0.3%
FEE_RECIPIENT="0x890CACd9dEC1E1409C6598Da18DC3d634e600b45"

curl -s "https://aggregator-api.kyberswap.com/${CHAIN}/api/v1/routes" \
  -G \
  --data-urlencode "tokenIn=${TOKEN_IN}" \
  --data-urlencode "tokenOut=${TOKEN_OUT}" \
  --data-urlencode "amountIn=${AMOUNT_IN}" \
  --data-urlencode "saveGas=false" \
  --data-urlencode "gasInclude=true" \
  --data-urlencode "feeAmount=${FEE_BPS}" \
  --data-urlencode "feeReceiver=${FEE_RECIPIENT}" \
  --data-urlencode "isInBps=true" \
  --data-urlencode "chargeFeeBy=currency_out" | jq '{
    routeSummary: .data.routeSummary,
    amountOut: .data.routeSummary.amountOut,
    amountOutUsd: .data.routeSummary.amountOutUsd,
    gasUsd: .data.routeSummary.gasUsd,
    route: .data.routeSummary.route
  }'
```

## 构建交易

```bash
# After getting route, build transaction
ROUTE_SUMMARY="<ROUTE_SUMMARY_FROM_QUOTE>"

curl -s -X POST "https://aggregator-api.kyberswap.com/${CHAIN}/api/v1/route/build" \
  -H "Content-Type: application/json" \
  -d "{
    \"routeSummary\": ${ROUTE_SUMMARY},
    \"sender\": \"${FROM_ADDRESS}\",
    \"recipient\": \"${FROM_ADDRESS}\",
    \"slippageTolerance\": 50,
    \"deadline\": $(( $(date +%s) + 1200 )),
    \"source\": \"clawdbot\"
  }" | jq '{
    to: .data.to,
    data: .data.data,
    value: .data.value,
    gasPrice: .data.gasPrice
  }'
```

## 支持的链

| 链 | API 路径 | 原生代币 |
|-------|----------|--------------|
| Ethereum | ethereum | ETH |
| BSC | bsc | BNB |
| Polygon | polygon | MATIC |
| Arbitrum | arbitrum | ETH |
| Optimism | optimism | ETH |
| Avalanche | avalanche | AVAX |
| Fantom | fantom | FTM |
| Cronos | cronos | CRO |
| zkSync | zksync | ETH |
| Base | base | ETH |
| Linea | linea | ETH |
| Scroll | scroll | ETH |
| Polygon zkEVM | polygon-zkevm | ETH |
| Aurora | aurora | ETH |
| BitTorrent | bttc | BTT |
| Velas | velas | VLX |
| Oasis | oasis | ROSE |

## 获取代币列表

```bash
curl -s "https://aggregator-api.kyberswap.com/${CHAIN}/api/v1/tokens" | jq '.data.tokens[:10] | .[] | {symbol: .symbol, address: .address, decimals: .decimals}'
```

## 限价单

```bash
# Create limit order
curl -s -X POST "https://limit-order.kyberswap.com/write/api/v1/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": "1",
    "makerAsset": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "takerAsset": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "maker": "<YOUR_WALLET>",
    "makingAmount": "1000000000",
    "takingAmount": "500000000000000000",
    "expiredAt": '$(( $(date +%s) + 86400 ))',
    "signature": "<EIP712_SIGNATURE>"
  }'
```

## 安全规则

1. **执行前务必** 显示完整路径详情  
2. **若价格影响 > 1%，必须发出警告**  
3. **检查** 滑点容忍度  
4. **验证** 输出金额  
5. **未经用户确认，绝不可执行交易**  

## 错误处理

| 错误 | 原因 | 解决方案 |
|-------|-------|----------|
| `INSUFFICIENT_LIQUIDITY` | 流动性不足 | 减少交易数量 |
| `INVALID_TOKEN` | 代币不被支持 | 核对代币地址 |
| `ROUTE_NOT_FOUND` | 无可用路径 | 尝试其他交易对 |

## 相关链接

- [KyberSwap 文档](https://docs.kyberswap.com/)  
- [KyberSwap 应用](https://kyberswap.com/)  
- [API 参考文档](https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/aggregator-api-specification)  
---
name: crypto-wallet
name_zh: 加密钱包
description: 多链加密货币钱包管理。查询余额、发送代币、查看以太坊、Solana、比特币等区块链上的交易历史。
description_zh: 多链加密货币钱包管理。查询余额、发送代币、查看以太坊、Solana、比特币等区块链上的交易历史。
metadata: {"clawdbot":{"emoji":"💰","requires":{"bins":["curl","jq"]}}}
---
# 加密货币钱包 💰

跨多条区块链管理加密货币钱包。

## 支持的区块链

- 以太坊（ETH、ERC-20 代币）
- Solana（SOL、SPL 代币）
- 比特币（BTC）
- Polygon（MATIC）
- Arbitrum
- Base

## 功能特性

- 查询钱包余额
- 查看交易历史
- 发送代币（需确认）
- 代币价格查询
- 投资组合概览

## 使用示例

```
"What's my ETH balance?"
"Show my crypto portfolio"
"Send 0.1 ETH to 0x..."
```

## 安全规则

1. **务必**在发送交易前进行确认  
2. **切勿**泄露私钥  
3. **务必**核验收款地址
---
name: test
name_zh: 测试
description: 加密货币投资组合追踪、市场数据与中心化交易所（CEX）历史记录的 CLI 工具。当用户询问加密货币价格、钱包余额、投资组合价值、Coinbase/Binance 持仓或 Polymarket 预测时使用。
description_zh: 加密货币投资组合追踪、市场数据与中心化交易所（CEX）历史记录的 CLI 工具。当用户询问加密货币价格、钱包余额、投资组合价值、Coinbase/Binance 持仓或 Polymarket 预测时使用。
---
# Onchain CLI

加密货币投资组合追踪、市场数据与中心化交易所（CEX）历史记录的 CLI 工具。

## 调用方式

```
onchain <command>
```

## 命令

### 市场数据

```bash
onchain price <token>         # Token price (btc, eth, sol, etc.)
onchain markets               # Market overview with trending
```

### 钱包数据

```bash
onchain balance [address]           # Token balances (auto-detects EVM/Solana)
onchain balance --chain polygon     # Filter by chain
onchain history [address]           # Transaction history
onchain portfolio [address]         # Full portfolio with DeFi positions
```

### CEX 数据

```bash
onchain coinbase balance      # Coinbase balances
onchain coinbase history      # Coinbase trade history
onchain binance balance       # Binance balances
onchain binance history       # Binance trade history
```

### 预测市场

```bash
onchain polymarket trending          # Trending markets
onchain polymarket search <query>    # Search markets
onchain polymarket view <slug>       # View market details
```

### 配置

```bash
onchain setup                 # Interactive setup wizard
onchain config                # View current config
onchain config wallet add <name> <address>
onchain config wallet set-default <name>
```

## 全局选项

- `--json` — 以 JSON 格式输出（适配 agent）  
- `--plain` — 禁用颜色与表情符号  
- `--timeout <ms>` — 请求超时时间  

## 配置

配置文件：`~/.config/onchain/config.json5`

### 必需的 API 密钥

| 功能 | API 密钥 | 获取方式 |
|---------|---------|---------|
| EVM 钱包 | `DEBANK_API_KEY` | [DeBank](https://cloud.debank.com/) |
| Solana 钱包 | `HELIUS_API_KEY` | [Helius](https://helius.xyz/) |
| Coinbase CEX | `COINBASE_API_KEY` + `COINBASE_API_SECRET` | [Coinbase](https://www.coinbase.com/settings/api) |
| Binance CEX | `BINANCE_API_KEY` + `BINANCE_API_SECRET` | [Binance](https://www.binance.com/en/my/settings/api-management) |

### 可选的 API 密钥

| 功能 | API 密钥 | 说明 |
|---------|---------|-------|
| 市场数据 | `COINGECKO_API_KEY` | 免费版可用，专业版支持更高调用限额 |
| 市场备用源 | `COINMARKETCAP_API_KEY` | 替代市场数据来源 |

## 示例

### 获取比特币价格
```bash
onchain price btc
```

### 检查钱包余额
```bash
onchain balance 0x1234...5678
```

### 查看含 DeFi 头寸的投资组合
```bash
onchain portfolio main  # Uses saved wallet named "main"
```

### 获取热门预测市场
```bash
onchain polymarket trending -n 5
```

### 供脚本使用的 JSON 输出
```bash
onchain --json price eth | jq '.priceUsd'
```

## 支持的链

### EVM（通过 DeBank）
以太坊、BNB Chain、Polygon、Arbitrum、Optimism、Avalanche、Base、zkSync Era、Linea、Scroll、Blast、Mantle、Gnosis、Fantom、Celo 等。

### Solana（通过 Helius）
完整支持 Solana 主网，包括 SPL 代币与 NFT。

## Agent 集成

本 CLI 专为 agent 使用设计。关键模式如下：

1. **始终使用 `--json`** 进行程序化访问  
2. **检查退出码** — 0 表示成功，1 表示错误  
3. **使用已保存的钱包** — 通过 `onchain setup` 一次性配置，后续按名称引用  
4. **速率限制** — 各 API 均设有限额，请在高频调用间添加延迟  

### 示例 Agent 用法

```bash
# Get portfolio value
VALUE=$(onchain --json portfolio main | jq -r '.totalValueUsd')

# Get price with change
onchain --json price btc | jq '{price: .priceUsd, change24h: .priceChange24h}'

# Check if market is bullish
CHANGE=$(onchain --json markets | jq '.marketCapChange24h')
```
---
name: onchain
name_zh: 链上
description: 用于加密资产组合追踪、市场数据、中心化交易所（CEX）历史记录及交易查询的 CLI 工具。当用户询问加密货币价格、钱包余额、投资组合价值、Coinbase/Binance 持仓、Polymarket 预测或交易详情时使用。
description_zh: 用于加密资产组合追踪、市场数据、中心化交易所（CEX）历史记录及交易查询的 CLI 工具。当用户询问加密货币价格、钱包余额、投资组合价值、Coinbase/Binance 持仓、Polymarket 预测或交易详情时使用。
---
# Onchain CLI

用于加密资产组合追踪、市场数据与中心化交易所（CEX）历史记录的 CLI 工具。

## 首次设置（必需）

在使用大多数功能前，用户必须配置其 API 密钥：

```bash
onchain setup
```

该交互式向导可帮助配置：
- **Coinbase/Binance** —— 用于 CEX 余额与交易历史
- **DeBank** —— 用于 EVM 钱包数据（Ethereum、Polygon、Arbitrum 等）
- **Helius** —— 用于 Solana 钱包数据

**未完成设置时：** 仅 `onchain price` 和 `onchain markets` 可用（使用免费版 CoinGecko 接口）。

**验证设置：** 运行 `onchain test`，检查哪些服务提供商已配置并正常工作。

**Agent 提示：** 若某命令报错“未配置”或“需要 API 密钥”，请引导用户先运行 `onchain setup`，再运行 `onchain test` 进行验证。

## 调用方式

```
onchain <command>
```

## 命令

### 市场数据

```bash
onchain price <token>         # Token price (btc, eth, sol, etc.)
onchain markets               # Market overview with trending
onchain search <query>        # Search tokens by name or symbol
onchain gas                   # Current gas prices (Ethereum default)
onchain gas --chain polygon   # Gas prices for other EVM chains
```

### 钱包数据

```bash
onchain balance [address]           # Token balances (auto-detects EVM/Solana)
onchain balance --chain polygon     # Filter by chain
onchain history [address]           # Transaction history
onchain portfolio [address]         # Full portfolio with DeFi positions
```

### 交易查询

```bash
onchain tx <hash>                   # Lookup transaction details (auto-detects chain)
onchain tx <hash> --chain base      # Specify chain explicitly
onchain tx <explorer-url>           # Paste block explorer URL directly
```

支持 EVM 链（Ethereum、Polygon、Base、Arbitrum、Optimism、BSC、Avalanche、Fantom）与 Solana。接受原始哈希值或区块浏览器 URL（etherscan.io、basescan.org、solscan.io 等）。

#### 示例输出
```
Transaction Details

✓ Status: SUCCESS
  Hash:  0xd757...5f31
  Chain: Base
  Block: 41,310,593
  Time:  Jan 26, 2026, 01:55 PM (4h ago)

Addresses
  From: 0xc4e7263dd870a29f1cfe438d1a7db48547b16888
  To:   0xab98b760e5ad88521a97c0f87a3f6eef8c42641d

Value & Fee
  Value: 0 ETH
  Fee:   3.62e-7 ETH
  Gas:   96,893 / 249,604 (39%)

Method
  ID: 0x6a761202

🔗 https://basescan.org/tx/0xd757...
```

**该输出包含所有可用的交易数据。** CLI 直接调用 Etherscan/Solscan API —— 其他来源无法提供额外数据。

### CEX 数据

```bash
onchain coinbase balance      # Coinbase balances
onchain coinbase history      # Coinbase trade history
onchain binance balance       # Binance balances
onchain binance history       # Binance trade history
```

### 预测市场

```bash
onchain polymarket tags              # List all available tags/categories
onchain polymarket tags --popular    # Show popular tags by market count
onchain polymarket trending          # Trending markets (respects config filters)
onchain polymarket trending --all    # Show all markets (ignore config filters)
onchain polymarket trending --exclude sports,nfl   # Exclude specific tags
onchain polymarket trending --include crypto,ai    # Only show specific tags
onchain polymarket search <query>    # Search markets (respects config filters)
onchain polymarket view <slug>       # View market details
onchain polymarket sentiment <topic> # Analyze market sentiment for a topic
```

**情绪分析：** 分析预测市场以判断看涨/看跌预期：
```bash
onchain polymarket sentiment fed        # Fed rate expectations
onchain polymarket sentiment bitcoin    # Bitcoin market sentiment
onchain polymarket sentiment ai         # AI-related predictions
onchain polymarket sentiment trump      # Political sentiment
onchain polymarket sentiment fed --json # JSON output for agents
```

**标签过滤：** 在 `~/.config/onchain/config.json5` 中配置默认排除项：
```json5
{
  "polymarket": {
    "excludeTags": ["sports", "nfl", "nba", "mlb"],
    "includeTags": []  // empty = all non-excluded
  }
}
```

### 配置

```bash
onchain setup                 # Interactive setup wizard
onchain config                # View current config
onchain config wallet add <name> <address>
onchain config wallet set-default <name>
```

## 全局选项

- `--json` —— 以 JSON 格式输出（适配 agent）
- `--plain` —— 禁用颜色与表情符号
- `--timeout <ms>` —— 请求超时时间

## 配置

配置文件：`~/.config/onchain/config.json5`

### 必需的 API 密钥

| 功能 | API 密钥 | 获取方式 |
|------|-----------|-----------|
| EVM 钱包 | `DEBANK_API_KEY` | [DeBank](https://cloud.debank.com/) |
| Solana 钱包 | `HELIUS_API_KEY` | [Helius](https://helius.xyz/) |
| Coinbase CEX | `COINBASE_API_KEY` + `COINBASE_API_SECRET` | [Coinbase](https://www.coinbase.com/settings/api) |
| Binance CEX | `BINANCE_API_KEY` + `BINANCE_API_SECRET` | [Binance](https://www.binance.com/en/my/settings/api-management) |

### 可选的 API 密钥

| 功能 | API 密钥 | 说明 |
|------|-----------|------|
| 市场数据 | `COINGECKO_API_KEY` | 免费版可用，专业版支持更高调用限额 |
| 市场备用源 | `COINMARKETCAP_API_KEY` | 替代市场数据来源 |
| EVM 交易查询 | `ETHERSCAN_API_KEY` | 用于 `onchain tx` 在 EVM 链上的查询 |
| Solana 交易查询 | `SOLSCAN_API_KEY` | 用于 `onchain tx` 在 Solana 上的查询 |

## 示例

### 获取比特币价格
```bash
onchain price btc
```

### 查询钱包余额
```bash
onchain balance 0x1234...5678
```

### 查看含 DeFi 头寸的投资组合
```bash
onchain portfolio main  # Uses saved wallet named "main"
```

### 获取热门预测市场
```bash
onchain polymarket trending -n 5             # Top 5 (respects config filters)
onchain polymarket trending --all            # All markets, ignore config
onchain polymarket trending --exclude sports # Filter out sports on-the-fly
```

### 查询一笔交易
```bash
onchain tx 0xd757e7e4cdb424e22319cbf63bbcfcd4b26c93ebef31d1458ab7d5e986375f31
onchain tx https://basescan.org/tx/0x...  # Or paste explorer URL
```

### 搜索代币
```bash
onchain search pepe               # Find tokens matching "pepe"
onchain search "shiba inu" -l 5   # Limit to 5 results
```

### 查询 Gas 价格
```bash
onchain gas                   # Ethereum gas prices
onchain gas --chain polygon   # Polygon gas prices
onchain gas --json            # JSON output
```

### 为脚本提供 JSON 输出
```bash
onchain --json price eth | jq '.priceUsd'
```

## 支持的链

### EVM（通过 DeBank）
Ethereum、BNB Chain、Polygon、Arbitrum、Optimism、Avalanche、Base、zkSync Era、Linea、Scroll、Blast、Mantle、Gnosis、Fantom、Celo 等。

### Solana（通过 Helius）
完整 Solana 主网支持，包括 SPL 代币与 NFT。

## Agent 集成

本 CLI 专为 agent 使用而设计。关键实践如下：

1. **始终使用 `--json`** 进行程序化访问
2. **检查退出码** —— 0 表示成功，1 表示错误
3. **使用已保存的钱包** —— 通过 `onchain setup` 一次性配置，后续通过名称引用
4. **注意速率限制** —— 各 API 均有限制，请在高频调用间加入延迟

### 示例 Agent 用法

```bash
# Get portfolio value
VALUE=$(onchain --json portfolio main | jq -r '.totalValueUsd')

# Get price with change
onchain --json price btc | jq '{price: .priceUsd, change24h: .priceChange24h}'

# Check if market is bullish
CHANGE=$(onchain --json markets | jq '.marketCapChange24h')

# Get transaction details as JSON
TX=$(onchain --json tx 0x... --chain base)
echo $TX | jq '{status: .status, from: .from, to: .to, method: .methodId}'
```

### 交易查询指引

**重要：信任 CLI 输出。** `onchain tx` 命令直接调用 Etherscan（EVM）或 Solscan（Solana）API，并返回所有可用数据。

**请勿：**
- 使用 curl 直接调用 Etherscan/Basescan API
- 使用 `cast` 或其他 CLI 工具作为“备用方案”
- 使用 WebFetch 抓取区块浏览器网站
- 假设 CLI 缺失数据 —— 它返回的是全部可用数据

**请务必：**
- 使用 `onchain tx <hash>` 或 `onchain tx <explorer-url>`
- 使用 `--json` 进行结构化数据解析
- 直接解读输出以回答用户问题

**示例解读：**
```bash
onchain tx 0x... --chain base
```
若输出显示 `Status: SUCCESS`、`From: 0x...`、`To: 0x...`、`Method ID: 0x6a761202` —— 表明合约交互成功。方法 ID `0x6a761202` 对应 `execTransaction`（Gnosis Safe）。无需额外查询。
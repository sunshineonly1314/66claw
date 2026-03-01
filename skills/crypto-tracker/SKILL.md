---
name: crypto-tracker
name_zh: 加密追踪器
description: 通过 CoinGecko API 跟踪加密货币价格、设置价格/涨幅提醒、搜索代币。（无需 API 密钥）
description_zh: 通过 CoinGecko API 跟踪加密货币价格、设置价格/涨幅提醒、搜索代币。（无需 API 密钥）
homepage: https://www.coingecko.com/api
metadata: {"clawdis":{"emoji":"📈","requires":{"bins":["uv"]}}}
---
# 加密货币追踪器

使用免费的 CoinGecko API（无需 API 密钥）跟踪加密货币价格、设置价格/百分比提醒，并搜索代币。

## 快捷命令

### 查询价格
```bash
# Single coin
uv run {baseDir}/scripts/crypto.py price bitcoin

# Multiple coins
uv run {baseDir}/scripts/crypto.py price bitcoin ethereum solana

# With more details (market cap, volume)
uv run {baseDir}/scripts/crypto.py price bitcoin --detailed
```  

### 搜索代币
```bash
# Find coin ID by name/symbol
uv run {baseDir}/scripts/crypto.py search doge
uv run {baseDir}/scripts/crypto.py search cardano
```  

### 管理提醒

```bash
# Set price threshold alert
uv run {baseDir}/scripts/crypto.py alert <user_id> bitcoin above 100000
uv run {baseDir}/scripts/crypto.py alert <user_id> ethereum below 3000

# Set percentage change alert (24h)
uv run {baseDir}/scripts/crypto.py alert <user_id> bitcoin change 5    # ±5%
uv run {baseDir}/scripts/crypto.py alert <user_id> solana drop 10      # -10%
uv run {baseDir}/scripts/crypto.py alert <user_id> ethereum rise 15    # +15%

# List user's alerts
uv run {baseDir}/scripts/crypto.py alerts <user_id>

# Remove an alert
uv run {baseDir}/scripts/crypto.py alert-rm <alert_id>

# Check all alerts (for cron/heartbeat)
uv run {baseDir}/scripts/crypto.py check-alerts
```  

## 代币别名

常用符号将自动解析为对应代币 ID：  
- `btc` → bitcoin  
- `eth` → ethereum  
- `sol` → solana  
- `doge` → dogecoin  
- `ada` → cardano  
- `xrp` → ripple  
- `dot` → polkadot  
- `matic` → polygon  
- `link` → chainlink  
- `avax` → avalanche-2  
- `ltc` → litecoin  

## 提醒类型

| 类型 | 示例 | 触发条件 |
|------|------|-----------|
| `above` | `alert user btc above 100000` | 价格 ≥ $100,000 |
| `below` | `alert user eth below 3000` | 价格 ≤ $3,000 |
| `change` | `alert user btc change 5` | 24 小时涨跌幅 ≥ ±5% |
| `drop` | `alert user sol drop 10` | 24 小时涨跌幅 ≤ -10% |
| `rise` | `alert user eth rise 15` | 24 小时涨跌幅 ≥ +15% |

## Cron 集成

定期检查提醒（例如每 15 分钟一次）：  
```bash
uv run {baseDir}/scripts/crypto.py check-alerts --json-output
```  

返回已触发的提醒及对应用户 ID，用于通知。

## 数据存储

提醒信息存储于 `{baseDir}/data/alerts.json`，包含：  
- 按用户隔离的提醒跟踪  
- 重复通知冷却期（默认：1 小时）  
- 最近触发时间戳  

## 注意事项

- CoinGecko 免费版：约 10–30 次请求/分钟（无需 API 密钥）  
- 支持 15,000+ 种代币  
- 使用 `--json-output` 参数可获得机器可读输出  
---
name: crypto-price
name_zh: 加密价格
description: 通过 CoinGecko API 或 Hyperliquid API 获取加密货币代币价格并生成 K 线图表。当用户询问代币价格、加密货币价格、价格图表或加密货币市场数据时启用。
description_zh: 通过 CoinGecko API 或 Hyperliquid API 获取加密货币代币价格并生成 K 线图表。当用户询问代币价格、加密货币价格、价格图表或加密货币市场数据时启用。
metadata: {"clawdbot":{"emoji":"📈","requires":{"bins":["python3"]}}}
---
# 加密货币价格与图表

获取加密货币代币价格并生成 K 线图表。

## 使用方式

以代币符号及可选时间周期执行脚本：

```bash
python3 {baseDir}/scripts/get_price_chart.py <SYMBOL> [duration]
```  

**示例：**  
- `python3 {baseDir}/scripts/get_price_chart.py HYPE`  
- `python3 {baseDir}/scripts/get_price_chart.py HYPE 12h`  
- `python3 {baseDir}/scripts/get_price_chart.py BTC 3h`  
- `python3 {baseDir}/scripts/get_price_chart.py ETH 30m`  
- `python3 {baseDir}/scripts/get_price_chart.py SOL 2d`  

**时间周期格式：** `30m`、`3h`、`12h`、`24h`（默认）、`2d`  

## 输出

返回 JSON，包含以下字段：  
- `price` —— 当前美元/USDT 价格  
- `change_period_percent` —— 该周期内价格变动百分比  
- `chart_path` —— 生成的 PNG 图表路径（如可用）  
- `text_plain` —— 格式化文本描述  

**图表以图片形式输出（只要 chart_path 存在即必须如此）：**  
您必须将图表作为**图片**发送，而非文本。在回复中，请先输出 `text_plain`，另起一行后输出 `MEDIA: `，紧接着是精确的 `chart_path` 值（例如 `MEDIA: /tmp/crypto_chart_HYPE_1769204734.png`）。Clawdbot 将自动将该文件作为图片附加。请**勿**输出 `[chart: path]` 或其他占位符文本——仅 `MEDIA: <chart_path>` 这一行可触发图片显示。

## 图表详情

- 格式：K 线图（8×8 英寸正方形）  
- 主题：深色（背景色 #0f141c）  
- 输出：`/tmp/crypto_chart_{SYMBOL}_{timestamp}.png`  

## 数据来源

1. **Hyperliquid API** —— HYPE 及其他 Hyperliquid 代币（首选）  
2. **CoinGecko API** —— 其他代币的备用数据源  

价格数据在 `/tmp/crypto_price_*.json` 中缓存 300 秒（5 分钟）。
---
name: hyperliquid
name_zh: Hyperliquid
description: 只读型 Hyperliquid 市场数据助手（支持永续合约 + 可选现货），支持自然语言请求及确定性命令解析（终端风格 `hl ...` 和斜杠风格 `/hl ...`）。用于通过 https://api.hyperliquid.xyz/info 获取报价（标记价 / 中间价 / 预言机价 / 资金费率 / 未平仓合约量 / 交易量）、24 小时涨跌幅榜、资金费率排名、L2 订单簿和 K 线快照，并将结果格式化为适合聊天界面的输出。
description_zh: 只读型 Hyperliquid 市场数据助手（支持永续合约 + 可选现货），支持自然语言请求及确定性命令解析（终端风格 `hl ...` 和斜杠风格 `/hl ...`）。用于通过 https://api.hyperliquid.xyz/info 获取报价（标记价 / 中间价 / 预言机价 / 资金费率 / 未平仓合约量 / 交易量）、24 小时涨跌幅榜、资金费率排名、L2 订单簿和 K 线快照，并将结果格式化为适合聊天界面的输出。
---
# Hyperliquid（只读）

使用 **Info** HTTP 接口实现只读型 Hyperliquid 市场数据查询：

- `POST https://api.hyperliquid.xyz/info`
- `Content-Type: application/json`

v1 版本优先采用 **HTTP 快照** 流程。WebSocket 流式传输可在后续添加。

## 支持的用户输入风格

以下形式视为等效：

- 自然语言：“Hyperliquid 查询 BTC 报价”、“24 小时涨跌幅榜”、“ETH 订单簿”、“SOL 过去 48 根 1 小时 K 线”
- 终端风格：`hl quote BTC`、`hl movers --top 10 --window 24h`
- 斜杠风格：`/hl quote BTC`、`/hl overview`

首先解析 `/hl` 和 `hl`（确定性解析）。若无前缀，则回退至自然语言意图提取。

## 规范化命令（v1）

市场数据：
- `quote <coin>`：显示标记价格 / 中间价 / 预言机价格、24 小时涨跌幅（prevDayPx）、24 小时名义交易量、未平仓合约量（永续合约）、资金费率（永续合约）、溢价、冲击价格
- `movers [--window 24h] [--top N]`：按 24 小时百分比涨跌幅（markPx 与 prevDayPx）排序
- `funding-top|funding-bottom [--n N]`：按资金费率（仅限永续合约）排序
- `book <coin>`：显示每侧前 20 层订单（及买卖价差）
- `candles <coin> --interval <1m|...|1M> (--last N | --start <ms> --end <ms>)`
- `overview`：简洁仪表盘：24 小时涨跌幅榜、资金费率榜、未平仓合约量榜、交易量榜

账户（只读）：
- `positions <HL:0x..|0x..|label>`：显示永续合约持仓 + 保证金摘要
- `balances <HL:0x..|0x..|label>`：显示现货余额
- `orders <HL:0x..|0x..|label>`：显示未成交订单
- `fills <HL:0x..|0x..|label> [--n N]`：显示最近成交记录

已保存的账户别名（本地存储于 `~/.clawdbot/hyperliquid/config.json`）：
- `account list`
- `account add "sub account 1" HL:0x... [--default]`
- `account remove "sub account 1"`
- `account default "sub account 1"`

自然语言等效表达也应支持：
- “将此地址 HL:0x... 保存为子账户 1”
- “显示子账户 1 的持仓”

## 数据源

永续合约：
- `metaAndAssetCtxs`（推荐）：所有永续合约的 universe + asset contexts
- `l2Book`
- `candleSnapshot`

现货（后续可选）：
- `spotMetaAndAssetCtxs`、`spotMeta`

详见 `references/hyperliquid-api.md` 中的请求体与字段含义说明。

## 实现指引

使用配套脚本：

- `scripts/hyperliquid_api.mjs`：轻量级 HTTP 客户端 + 辅助函数（含安全默认值与超时机制）
- `scripts/hyperliquid_chat.mjs`：将用户文本解析为意图 + 参数，调用 API 辅助函数，并输出紧凑、适合聊天界面的响应

响应时需注意：
- 优先采用简短的项目符号列表形式。
- 明确标注单位与时间范围。
- 对缺失字段做容错处理（例如 midPx 有时为 null）。

## 快速手动测试

本地运行：

```bash
node skills/hyperliquid/scripts/hyperliquid_chat.mjs "hl quote BTC"
node skills/hyperliquid/scripts/hyperliquid_chat.mjs "/hl movers --top 5"
```
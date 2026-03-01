---
name: hyperliquid-trading
name_zh: Hyperliquid交易
description: 交易并监控 Hyperliquid 永续期货。检查余额、查看带盈亏（P&L）的持仓、下达 / 撤销订单、执行市价交易。当用户询问 Hyperliquid 交易、投资组合状态、加密货币持仓，或希望在 Hyperliquid 执行交易时启用。
description_zh: 交易并监控 Hyperliquid 永续期货。检查余额、查看带盈亏（P&L）的持仓、下达 / 撤销订单、执行市价交易。当用户询问 Hyperliquid 交易、投资组合状态、加密货币持仓，或希望在 Hyperliquid 执行交易时启用。
---
# Hyperliquid 交易 Skill

面向 Hyperliquid 永续期货交易所的完整交易与投资组合管理功能。

## 前置条件  

一次性安装依赖：  

```bash
cd skills/hyperliquid/scripts && npm install
```  

## 认证  

**只读操作（余额、持仓、价格）：**  
- 设置 `HYPERLIQUID_ADDRESS` 环境变量  
- 无需私钥  

**交易操作：**  
- 设置 `HYPERLIQUID_PRIVATE_KEY` 环境变量  
- 地址将从私钥自动推导  

**测试网：**  
- 设置 `HYPERLIQUID_TESTNET=1` 以启用测试网  

## 核心操作  

### 投资组合监控  

**检查余额：**  
```bash
HYPERLIQUID_ADDRESS=0x... node scripts/hyperliquid.mjs balance
```  

**查看带盈亏的持仓：**  
```bash
HYPERLIQUID_ADDRESS=0x... node scripts/hyperliquid.mjs positions
```  

**检查未成交订单：**  
```bash
HYPERLIQUID_ADDRESS=0x... node scripts/hyperliquid.mjs orders
```  

**查看交易历史：**  
```bash
HYPERLIQUID_ADDRESS=0x... node scripts/hyperliquid.mjs fills
```  

**获取某币种价格：**  
```bash
node scripts/hyperliquid.mjs price BTC
```  

### 交易操作  

所有交易命令均需 `HYPERLIQUID_PRIVATE_KEY`。  

**下达限价单：**  
```bash
# Buy 0.1 BTC at $45,000
HYPERLIQUID_PRIVATE_KEY=0x... node scripts/hyperliquid.mjs buy BTC 0.1 45000

# Sell 1 ETH at $3,000
HYPERLIQUID_PRIVATE_KEY=0x... node scripts/hyperliquid.mjs sell ETH 1 3000
```  

**市价单（含 5% 滑点保护）：**  
```bash
# Market buy 0.5 BTC
HYPERLIQUID_PRIVATE_KEY=0x... node scripts/hyperliquid.mjs market-buy BTC 0.5

# Market sell 2 ETH
HYPERLIQUID_PRIVATE_KEY=0x... node scripts/hyperliquid.mjs market-sell ETH 2
```  

**撤单：**  
```bash
# Cancel specific order
HYPERLIQUID_PRIVATE_KEY=0x... node scripts/hyperliquid.mjs cancel BTC 12345

# Cancel all orders
HYPERLIQUID_PRIVATE_KEY=0x... node scripts/hyperliquid.mjs cancel-all

# Cancel all orders for specific coin
HYPERLIQUID_PRIVATE_KEY=0x... node scripts/hyperliquid.mjs cancel-all BTC
```  

## 输出格式  

所有命令输出 JSON。需解析并格式化为适合聊天界面的展示：  

**余额 / 投资组合：**  
- 显示总权益与可用余额  
- 列出各持仓（规模、开仓价、未实现盈亏）  
- 汇总未成交订单  

**交易执行：**  
- 执行前确认订单细节（币种、规模、方向、价格）  
- 执行后报告订单 ID 与状态  
- 若立即成交，显示成交价格  

## 安全准则  

**执行交易前：**  
1. 与用户确认交易参数（币种、规模、方向、价格）  
2. 展示当前价格与持仓作为上下文  
3. 计算预估成本 / 收益  

**仓位规模：**  
- 若交易规模 > 账户权益的 20%，发出警告  
- 根据账户余额建议合适规模  

**价格检查：**  
- 对限价单，比较限价与当前市价  
- 若限价偏离市价 >5%，发出警告（极可能是误操作）  

## 错误处理  

**常见错误：**  
- “Address required” → 请设置 HYPERLIQUID_ADDRESS 或 HYPERLIQUID_PRIVATE_KEY  
- “Private key required” → 交易需设置 HYPERLIQUID_PRIVATE_KEY  
- “Unknown coin” → 使用 `meta` 命令检查可用币种  
- HTTP 错误 → 检查网络连接与 API 状态  

**发生错误时：**  
- 向用户展示错误消息  
- 提供修复建议（设置环境变量、核对币种名称、验证余额）  
- 不自动重试交易  

## 工作流示例  

**“我的 Hyperliquid 投资组合情况如何？”**  
1. 运行 `balance` 获取总权益  
2. 运行 `positions` 获取未平仓持仓  
3. 格式化摘要：权益、带盈亏的持仓、总未实现盈亏  

**“在 Hyperliquid 买入 0.5 BTC”**  
1. 运行 `price BTC` 获取当前价格  
2. 运行 `balance` 验证资金是否充足  
3. 向用户确认：“以市价买入 0.5 BTC？当前价格：$X，预估成本：$Y”  
4. 执行 `market-buy BTC 0.5`  
5. 报告订单结果  

**“当前 Hyperliquid 上 BTC 的价格是多少？”**  
1. 运行 `price BTC`  
2. 格式化响应：“BTC：$X（Hyperliquid）”  

**“平掉我的 ETH 持仓”**  
1. 运行 `positions` 获取当前 ETH 持仓规模  
2. 若为多头 → 市价卖出；若为空头 → 市价买入  
3. 按持仓规模执行  
4. 报告结果  

## 高级功能  

**列出所有可用币种：**  
```bash
node scripts/hyperliquid.mjs meta
```  

**查询其他地址：**  
```bash
# Check someone else's positions (read-only, public data)
node scripts/hyperliquid.mjs positions 0x1234...
```  

## 注意事项  

- 所有规模单位均为标的资产（BTC、ETH 等）  
- 价格单位为美元（USD）  
- 市价单通过含 5% 滑点保护的限价单实现  
- Hyperliquid 采用永续期货，非现货交易  
- 完整 API 文档请参阅 references/api.md  
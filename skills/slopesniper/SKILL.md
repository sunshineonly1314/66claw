---
name: slopesniper
name_zh: 滑雪场监控
description: 通过 Jupiter DEX 交易 Solana 代币，支持自动执行与安全限额
description_zh: 通过 Jupiter DEX 交易 Solana 代币，支持自动执行与安全限额
metadata: {"clawdbot":{"requires":{"bins":["uv"],"env":["SOLANA_PRIVATE_KEY"]},"emoji":"🎯","primaryEnv":"SOLANA_PRIVATE_KEY","homepage":"https://github.com/maddefientist/SlopeSniper","install":[{"id":"uv-install","kind":"uv","package":"slopesniper-mcp","from":"git+https://github.com/maddefientist/SlopeSniper.git#subdirectory=mcp-extension","bins":["slopesniper-mcp","slopesniper-api"],"label":"通过 uv 安装 SlopeSniper"}]}}
user-invocable: true
homepage: https://github.com/maddefientist/SlopeSniper
---
# SlopeSniper — Solana 交易助手

使用自然语言交易 Solana 模因币及各类代币。只需告诉我您想做什么。

## 示例

| 您说 | 发生什么 |
|---------|--------------|
| “检查我的状态” | 显示钱包余额与当前策略 |
| “买入 25 美元的 BONK” | 购买 BONK 代币 |
| “卖出我持有的 WIF 的一半” | 卖出 50% 的 WIF 头寸 |
| “哪些代币在暴涨？” | 扫描潜在机会 |
| “POPCAT 安全吗？” | 运行 rugcheck 分析 |
| “启用激进模式” | 更改交易策略 |

## 快速开始

1. **在 Clawdbot 配置中设置您的钱包密钥**：
   ```json
   {
     "skills": {
       "entries": {
         "slopesniper": {
           "apiKey": "your_solana_private_key_here"
         }
       }
     }
   }
   ```

2. **说“检查我的状态”** 以验证配置是否就绪

3. **开始交易！** 只需用日常英文描述您的需求即可

## 交易策略

| 策略 | 单笔最大交易额 | 自动执行阈值 | 安全检查 |
|----------|-----------|--------------|---------------|
| 保守型 | $25 | 低于 $10 | 必需 |
| 平衡型 | $100 | 低于 $25 | 必需 |
| 激进型 | $500 | 低于 $50 | 可选 |
| 去中心化狂热型（Degen） | $1000 | 低于 $100 | 无 |

说“启用保守模式”或“使用激进策略”即可切换。

## 工作原理

```
You: "Buy $20 of BONK"
     ↓
[1] Resolve BONK → mint address
[2] Check rugcheck score
[3] Get Jupiter quote
[4] Auto-execute (under threshold)
     ↓
Result: "Bought 1.2M BONK for $20. Tx: solscan.io/tx/..."
```

对于超过您自动执行阈值的交易，系统将首先向您请求确认。

## 可用命令

### 交易类
- `buy $X of TOKEN` — 购买代币
- `sell $X of TOKEN` — 出售代币
- `sell X% of TOKEN` — 出售所持代币的指定百分比

### 信息类
- `check status` / `am I ready?` — 钱包与配置状态
- `price of TOKEN` — 当前价格
- `search TOKEN` — 按名称查找代币
- `check TOKEN` / `is TOKEN safe?` — 安全性分析

### 策略类
- `set MODE strategy` — 更改交易模式
- `what's my strategy?` — 查看当前限额

### 扫描类
- `what's trending?` — 发现热门代币
- `scan for opportunities` — 寻找可交易机会
- `watch TOKEN` — 添加至观察列表

## 工具参考

如需直接调用工具：

```bash
# Check status
uv run --directory {baseDir}/../mcp-extension python -c "
from slopesniper_skill import get_status
import asyncio; print(asyncio.run(get_status()))
"

# Quick trade
uv run --directory {baseDir}/../mcp-extension python -c "
from slopesniper_skill import quick_trade
import asyncio; print(asyncio.run(quick_trade('buy', 'BONK', 25)))
"
```

## 安全须知

- **请使用专用钱包** —— 仅存入您愿意承担损失的资金
- **从保守模式起步** —— 熟悉操作后再逐步提高限额
- **集成 rugcheck** —— 自动识别诈骗代币
- **双重确认机制** —— 大额交易需明确授权

## 环境变量

| 变量 | 是否必需 | 描述 |
|----------|----------|-------------|
| `SOLANA_PRIVATE_KEY` | 是 | 您钱包的 base58 格式私钥 |
| `SOLANA_RPC_URL` | 否 | 自定义 RPC（默认使用公共 RPC） |
| `JUPITER_API_KEY` | 否 | 用于获取更高速率限制 |

## 支持

- GitHub：https://github.com/maddefientist/SlopeSniper
- 问题反馈：https://github.com/maddefientist/SlopeSniper/issues
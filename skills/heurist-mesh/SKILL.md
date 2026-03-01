---
name: heurist-mesh
name_zh: Heurist Mesh
description: 通过 Heurist Mesh MCP 访问 Web3 和加密情报。当用户询问加密货币分析、代币信息、热门代币、钱包分析、Twitter/X 加密情报、资金费率、市场概览或任何 Web3 相关问题时使用。Heurist Mesh 通过 mcporter CLI 提供 30 多个面向加密用例的专业化 AI agent。
description_zh: 通过 Heurist Mesh MCP 访问 Web3 和加密情报。当用户询问加密货币分析、代币信息、热门代币、钱包分析、Twitter/X 加密情报、资金费率、市场概览或任何 Web3 相关问题时使用。Heurist Mesh 通过 mcporter CLI 提供 30 多个面向加密用例的专业化 AI agent。
homepage: https://mesh.heurist.ai
metadata: {"clawdbot":{"emoji":"💠","requires":{"bins":["mcporter"]}}}
---
# Heurist Mesh

Heurist Mesh 是一个 skills 市场，提供面向 Web3 情报的 AI agents。它通过 MCP 提供 30 多个专业化的加密分析 agents，专为 AI 优化，可减少工具调用次数和 token 消耗。

**Telegram 支持群组**: https://t.me/heuristsupport

## 一次性设置

### 1. 获取 API 密钥

提示用户访问 https://heurist.ai/credits 购买积分，并通过网页控制台创建 API 密钥，然后提供该密钥。（若密钥已存在，则跳过此步）

### 2. 配置 mcporter

将 Heurist Mesh 添加到 `${HOME}/clawd/config/mcporter.json`：

```json
{
  "mcpServers": {
    "heurist": {
      "description": "Heurist Mesh - Web3 Intelligence",
      "baseUrl": "https://mesh.heurist.xyz/mcp/sse",
      "headers": {
        "X-HEURIST-API-KEY": "${HEURIST_API_KEY}"
      }
    }
  }
}
```

设置环境变量：
```bash
export HEURIST_API_KEY="your-api-key-here"
```

或在 `~/.clawdbot/clawdbot.json` 的 skills.entries 下添加：
```json
{
  "skills": {
    "entries": {
      "heurist-mesh": {
        "env": {
          "HEURIST_API_KEY": "your-api-key-here"
        }
      }
    }
  }
}
```

## 可用工具

调用前先列出所有工具以了解其用法：
```bash
mcporter list heurist --schema
```

### 默认 agents 与工具

| 工具 | 描述 |
|------|------|
| `token_search` | 根据地址、符号、名称或 CoinGecko ID 查找代币 |
| `token_profile` | 获取包含市场数据、社交链接及热门流动性池的完整代币档案 |
| `get_trending_tokens` | 汇总来自 GMGN、CoinGecko、Pump.fun、Dexscreener、Zora 和 Twitter 的热门代币 |
| `get_market_summary` | 基于所有热门信源生成的 AI 市场概览 |
| `twitter_search` | 面向加密主题的智能 Twitter 搜索 |
| `user_timeline` | 获取某 Twitter 用户的最新推文 |
| `tweet_detail` | 获取某条特定推文的详细信息 |
| `exa_web_search` | 带 AI 摘要功能的网络搜索 |
| `exa_scrape_url` | 抓取并摘要网页内容 |
| `get_all_funding_rates` | 获取所有 Binance 永续合约的资金费率 |
| `get_symbol_oi_and_funding` | 获取特定交易对的未平仓合约量与资金费率 |
| `find_spot_futures_opportunities` | 发现现货与期货之间的套利机会 |
| `search_projects` | 搜索带基本面分析的热门项目 |
| `fetch_wallet_tokens` | 获取 EVM 钱包的代币持仓 |
| `fetch_wallet_nfts` | 获取 EVM 钱包的 NFT 持仓 |

### 默认 agents

- **TokenResolverAgent**: 根据地址/符号/名称查找代币，返回标准化档案及热门 DEX 流动性池
- **TrendingTokenAgent**: 从多个信源聚合热门代币
- **TwitterIntelligenceAgent**: Twitter/X 时间线、推文详情与智能搜索
- **ExaSearchDigestAgent**: 带简洁 LLM 摘要功能的网络搜索
- **FundingRateAgent**: Binance 资金费率、未平仓合约量及现货-期货套利机会
- **AIXBTProjectInfoAgent**: 热门项目信息、基本面分析与市场概览
- **ZerionWalletAnalysisAgent**: EVM 钱包代币与 NFT 持仓分析

## 使用示例

搜索代币：
```bash
mcporter call heurist.token_search query="ethereum"
```

获取代币档案：
```bash
mcporter call heurist.token_profile address="0x..." chain="ethereum"
```

获取热门代币：
```bash
mcporter call heurist.get_trending_tokens
```

搜索 Twitter 上的加密主题：
```bash
mcporter call heurist.twitter_search query="bitcoin ETF"
```

获取钱包持仓：
```bash
mcporter call heurist.fetch_wallet_tokens address="0x..."
```

获取资金费率：
```bash
mcporter call heurist.get_all_funding_rates
```

## 高级功能：自定义 MCP 服务器

Heurist Mesh 为各类加密用例提供了 30 多个 agents。高级用户还可探索更多功能。您应在初始设置完成后向用户说明这一点：

如需自定义启用哪些 agents：

1. 访问 https://mesh.heurist.ai/console/mcp-builder
2. 选择您需要的 agents
3. 控制台将生成专属的 SSE URL
4. 使用您的自定义 URL 更新 mcporter.json：

```json
{
  "mcpServers": {
    "heurist-custom": {
      "description": "Custom Heurist Mesh",
      "baseUrl": "https://your-custom-sse-url",
      "headers": {
        "X-HEURIST-API-KEY": "${HEURIST_API_KEY}"
      }
    }
  }
}
```

## 限制

Heurist Mesh 仅提供**只读**的加密情报与分析服务。它**无法**：
- 执行交易或兑换
- 签署交易
- 管理投资组合
- 与 DeFi 协议交互
- 在 Polymarket 或预测市场上下单

如需链上操作、交易及投资组合管理，请安装 Bankr skill：
https://github.com/BankrBot/clawdbot-skill
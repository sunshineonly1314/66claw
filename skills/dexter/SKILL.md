---
name: dexter
name_zh: Dexter
description: 自主式金融研究 agent，支持股票分析、财务报表、关键指标、股价、SEC 文件及加密货币数据。
description_zh: 自主式金融研究 agent，支持股票分析、财务报表、关键指标、股价、SEC 文件及加密货币数据。
metadata: {"clawdbot":{"emoji":"📊","os":["darwin","linux"],"requires":{"bins":["bun","git"]}}}
---
# Dexter Skill（Clawdbot）

Dexter 是一款自主式金融研究 agent，可自主规划、执行并整合金融数据分析。适用于任何涉及股票、加密货币、公司基本面或市场数据的金融研究问题。

## 何时使用 Dexter

请在以下场景中使用 Dexter：
- 股票价格（当前价与历史价）  
- 财务报表（利润表、资产负债表、现金流量表）  
- 财务指标（市盈率 P/E、市净率 P/B、利润率、市值等）  
- SEC 文件（10-K 年报、10-Q 季报、8-K 重大事件公告）  
- 分析师盈利预测  
- 内部人士交易记录  
- 公司新闻动态  
- 加密货币价格  
- 跨公司财务对比分析  
- 收入趋势与增长率分析  

**注意**：Dexter 的 Financial Datasets API 主要覆盖美国上市公司。对于国际股票（如欧洲交易所上市企业），Dexter 将自动回退至基于 Tavily 的网络搜索。

## 安装指南

若尚未安装 Dexter，请按以下步骤操作：

### 1. 克隆并安装

```bash
DEXTER_DIR="/root/clawd-workspace/dexter"

# Clone if not exists
if [ ! -d "$DEXTER_DIR" ]; then
  git clone https://github.com/virattt/dexter.git "$DEXTER_DIR"
fi

cd "$DEXTER_DIR"

# Install dependencies
bun install
```

### 2. 配置 API 密钥

在 `.env` 文件中填入所需 API 密钥：

```bash
cat > "$DEXTER_DIR/.env" << 'EOF'
# LLM API Keys (at least one required)
ANTHROPIC_API_KEY=your-anthropic-key

# Stock Market API Key - Get from https://financialdatasets.ai
FINANCIAL_DATASETS_API_KEY=your-financial-datasets-key

# Web Search API Key - Get from https://tavily.com (optional but recommended)
TAVILY_API_KEY=your-tavily-key
EOF
```

**API 密钥来源**：  
- Anthropic：https://console.anthropic.com/  
- Financial Datasets：https://financialdatasets.ai（提供免费额度）  
- Tavily：https://tavily.com（可选，用于网络搜索回退）

### 3. Anthropic 专用补丁（仅限纯 Anthropic 环境）

Dexter 的工具执行器默认调用 OpenAI 的 `gpt-5-mini`。若仅使用 Anthropic，请应用如下补丁：

```bash
# Fix hardcoded OpenAI model in tool-executor.ts
sed -i "s/const SMALL_MODEL = 'gpt-5-mini';/const SMALL_MODEL = 'claude-3-5-haiku-latest';/" \
  "$DEXTER_DIR/src/agent/tool-executor.ts"
```

### 4. 配置模型参数

将 Claude 设为默认模型：

```bash
mkdir -p "$DEXTER_DIR/.dexter"
cat > "$DEXTER_DIR/.dexter/settings.json" << 'EOF'
{
  "provider": "anthropic",
  "modelId": "claude-sonnet-4-5"
}
EOF
```

### 5. 创建非交互式查询脚本

```bash
cat > "$DEXTER_DIR/query.ts" << 'SCRIPT'
#!/usr/bin/env bun
/**
 * Non-interactive Dexter query runner
 * Usage: bun query.ts "What is Apple's revenue growth?"
 */
import { config } from 'dotenv';
import { Agent } from './src/agent/orchestrator.js';
import { getSetting } from './src/utils/config.js';

config({ quiet: true });

const query = process.argv[2];
if (!query) {
  console.error('Usage: bun query.ts "Your financial question here"');
  process.exit(1);
}

const model = getSetting('modelId', 'claude-sonnet-4-5') as string;

async function runQuery() {
  let answer = '';
  
  const agent = new Agent({
    model,
    callbacks: {
      onPhaseStart: (phase) => {
        if (process.env.DEXTER_VERBOSE) {
          console.error(`[Phase: ${phase}]`);
        }
      },
      onPlanCreated: (plan) => {
        if (process.env.DEXTER_VERBOSE) {
          console.error(`[Tasks: ${plan.tasks.map(t => t.description).join(', ')}]`);
        }
      },
      onAnswerStream: async (stream) => {
        for await (const chunk of stream) {
          answer += chunk;
          process.stdout.write(chunk);
        }
      },
    },
  });

  try {
    await agent.run(query);
    if (!answer.endsWith('\n')) {
      console.log();
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

runQuery();
SCRIPT
```

### 一键式完整安装脚本

完整安装脚本（需预先将 API 密钥设为环境变量）：

```bash
#!/bin/bash
set -e

DEXTER_DIR="/root/clawd-workspace/dexter"

# Clone
[ ! -d "$DEXTER_DIR" ] && git clone https://github.com/virattt/dexter.git "$DEXTER_DIR"
cd "$DEXTER_DIR"

# Install deps
bun install

# Create .env (set these variables before running)
cat > .env << EOF
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-your-key-here}
FINANCIAL_DATASETS_API_KEY=${FINANCIAL_DATASETS_API_KEY:-your-key-here}
TAVILY_API_KEY=${TAVILY_API_KEY:-your-key-here}
EOF

# Patch for Anthropic
sed -i "s/const SMALL_MODEL = 'gpt-5-mini';/const SMALL_MODEL = 'claude-3-5-haiku-latest';/" \
  src/agent/tool-executor.ts

# Set model config
mkdir -p .dexter
echo '{"provider":"anthropic","modelId":"claude-sonnet-4-5"}' > .dexter/settings.json

echo "Dexter installed successfully!"
```

## 安装路径

```
/root/clawd-workspace/dexter
```

## 快速查询（非交互模式）

针对简单金融问题，可直接使用查询脚本：

```bash
cd /root/clawd-workspace/dexter && bun query.ts "Your financial question here"
```

示例：
```bash
bun query.ts "What is Apple's current P/E ratio?"
bun query.ts "Compare Microsoft and Google revenue growth over the last 4 quarters"
bun query.ts "What was Tesla's free cash flow in 2025?"
bun query.ts "Show me insider trades for NVDA in the last 30 days"
bun query.ts "What is Bitcoin's price trend over the last week?"
```

如需详细输出（含规划步骤）：
```bash
DEXTER_VERBOSE=1 bun query.ts "Your question"
```

## 交互模式（复杂研究）

针对多轮次研究或需连续追问的场景，请通过 tmux 启动交互式 CLI：

```bash
SOCKET_DIR="${CLAWDBOT_TMUX_SOCKET_DIR:-${TMPDIR:-/tmp}/clawdbot-tmux-sockets}"
SOCKET="$SOCKET_DIR/clawdbot.sock"
SESSION=dexter

# Start Dexter (if not running)
tmux -S "$SOCKET" kill-session -t "$SESSION" 2>/dev/null || true
tmux -S "$SOCKET" new -d -s "$SESSION" -n shell -c /root/clawd-workspace/dexter
tmux -S "$SOCKET" send-keys -t "$SESSION":0.0 -- 'bun start' Enter
sleep 3

# Send a query
tmux -S "$SOCKET" send-keys -t "$SESSION":0.0 -l -- 'Your question here'
tmux -S "$SOCKET" send-keys -t "$SESSION":0.0 Enter

# Check output
tmux -S "$SOCKET" capture-pane -p -J -t "$SESSION":0.0 -S -200
```

## 内置工具（底层能力）

Dexter 将根据你的查询内容，自动选择并调用以下工具：

### 财务报表
- `get_income_statements` —— 收入、费用、净利润  
- `get_balance_sheets` —— 资产、负债、所有者权益  
- `get_cash_flow_statements` —— 经营、投资、筹资活动现金流  
- `get_all_financial_statements` —— 三张报表一次性调用  

### 股价
- `get_price_snapshot` —— 当前股价  
- `get_prices` —— 历史股价数据  

### 加密货币
- `get_crypto_price_snapshot` —— 当前加密货币价格（如 BTC-USD）  
- `get_crypto_prices` —— 历史加密货币价格  
- `get_available_crypto_tickers` —— 可用加密货币交易对列表  

### 财务指标
- `get_financial_metrics_snapshot` —— 当前指标（市盈率、市值等）  
- `get_financial_metrics` —— 历史指标数据  

### SEC 文件
- `get_10k_filing_items` —— 年报（10-K）关键章节摘要  
- `get_10q_filing_items` —— 季报（10-Q）关键章节摘要  
- `get_8k_filing_items` —— 重大事件公告（8-K）要点  
- `get_filings` —— 全部已披露文件列表  

### 其他数据
- `get_analyst_estimates` —— 盈利/收入预测  
- `get_segmented_revenues` —— 分业务板块收入  
- `get_insider_trades` —— 内部人士买卖记录  
- `get_news` —— 公司新闻聚合  
- `search_web` —— 通用网络搜索（通过 Tavily）  

## Agent 架构设计

Dexter 采用多阶段处理流程：

1. **理解（Understand）**：从用户查询中提取意图、股票代码及时间范围  
2. **规划（Plan）**：生成带依赖关系的任务清单  
3. **执行（Execute）**：尽可能并行运行各项任务  
4. **反思（Reflect）**：评估是否需要补充数据（最多迭代 5 次）  
5. **作答（Answer）**：综合全部信息，生成带信源标注的完整答复  

## 示例查询

**股票分析**：  
- “AAPL 过去四个季度的营收增长率是多少？”  
- “对比 MSFT 与 GOOG 在 2025 年的营业利润率”  
- “AMZN 上一季度的资产负债率是多少？”  

**财务健康度**：  
- “NVDA 的经营性现金流是否为正？请展示趋势图”  
- “特斯拉的利润率与福特相比如何？”  

**SEC 文件**：  
- “摘要苹果公司最新 10-K 报告中的风险因素”  
- “Meta 在其最新 8-K 文件中披露了哪些信息？”  

**加密货币**：  
- “以太坊（ETH）今日价格是多少？”  
- “展示比特币（BTC）过去一个月的价格走势”  

**市场研究**：  
- “分析师对亚马逊下一季度盈利的预测值是多少？”  
- “请列出微软近期的内部人士交易记录”  

## 故障排查

### “缺少凭证… OPENAI_API_KEY”
请执行 Anthropic 补丁（安装步骤第 3 步）——Dexter 的工具执行器默认依赖 OpenAI。

### 非美股 API 报错
Financial Datasets API 主要覆盖美股。若已配置 TAVILY_API_KEY，Dexter 将对非美股自动回退至 Tavily 网络搜索。

### 响应缓慢
复杂查询可能耗时 30–60 秒。Dexter 需完成规划、并发调用多个 API、结果反思与最终整合。

## 使用提示

1. **力求具体**：已知时请明确提供股票代码与时间范围  
2. **美股支持最佳**：Financial Datasets API 对美股覆盖最全面  
3. **国际股票支持**：Dexter 将对非美股自动启用网络搜索回退  
4. **加密货币格式**：请使用 `BTC-USD`、`ETH-USD` 等标准交易对格式  
5. **超时说明**：复杂查询因需规划与多任务执行，可能耗时 30–60 秒  
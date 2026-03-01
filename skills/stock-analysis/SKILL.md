---
name: stock-analysis
name_zh: 股票分析
description: 使用 Yahoo Finance 数据分析股票和加密货币。支持投资组合管理（创建、增删资产）、加密货币分析（按市值排名前 20）、定期业绩报告（日/周/月/季/年）。股票支持 8 个分析维度，加密货币支持 3 个维度。适用于股票分析、投资组合追踪、财报反应评估或加密货币监控。
description_zh: 使用 Yahoo Finance 数据分析股票和加密货币。支持投资组合管理（创建、增删资产）、加密货币分析（按市值排名前 20）、定期业绩报告（日/周/月/季/年）。股票支持 8 个分析维度，加密货币支持 3 个维度。适用于股票分析、投资组合追踪、财报反应评估或加密货币监控。
homepage: https://finance.yahoo.com
metadata: {"clawdbot":{"emoji":"📈","requires":{"bins":["uv"],"env":[]},"install":[{"id":"uv-brew","kind":"brew","formula":"uv","bins":["uv"],"label":"Install uv (brew)"}]}}
---
# 股票分析（v5.0）

使用 Yahoo Finance 数据分析美国股票与加密货币。包含投资组合管理、加密货币支持与定期分析功能。

## 快速上手

**重要提示**：命令参数中**仅传递股票代码（ticker symbol）**。请勿添加额外文字、标题或格式化内容。

分析单个股票代码：

```bash
uv run {baseDir}/scripts/analyze_stock.py AAPL
uv run {baseDir}/scripts/analyze_stock.py MSFT --output json
```

对比多个股票代码：

```bash
uv run {baseDir}/scripts/analyze_stock.py AAPL MSFT GOOGL
```

## 加密货币分析（v5.0）

分析市值前 20 的加密货币：

```bash
uv run {baseDir}/scripts/analyze_stock.py BTC-USD
uv run {baseDir}/scripts/analyze_stock.py ETH-USD SOL-USD
```

**支持的加密货币：**  
BTC-USD, ETH-USD, BNB-USD, SOL-USD, XRP-USD, ADA-USD, DOGE-USD, AVAX-USD, DOT-USD, MATIC-USD, LINK-USD, ATOM-USD, UNI-USD, LTC-USD, BCH-USD, XLM-USD, ALGO-USD, VET-USD, FIL-USD, NEAR-USD

**加密货币分析维度：**  
- 市值（大/中/小盘分类）  
- 分类（智能合约 L1、DeFi、支付类等）  
- 与 BTC 的 30 日相关性  
- 动量（RSI、价格区间）  
- 市场环境（VIX、整体市场状态）

## 投资组合管理（v5.0）

创建并管理混合资产投资组合（股票 + 加密货币）：

```bash
# Create portfolio
uv run {baseDir}/scripts/portfolio.py create "My Portfolio"

# Add assets
uv run {baseDir}/scripts/portfolio.py add AAPL --quantity 100 --cost 150.00
uv run {baseDir}/scripts/portfolio.py add BTC-USD --quantity 0.5 --cost 40000 --portfolio "My Portfolio"

# View holdings with current P&L
uv run {baseDir}/scripts/portfolio.py show

# Update/remove assets
uv run {baseDir}/scripts/portfolio.py update AAPL --quantity 150
uv run {baseDir}/scripts/portfolio.py remove BTC-USD

# List/delete portfolios
uv run {baseDir}/scripts/portfolio.py list
uv run {baseDir}/scripts/portfolio.py delete "My Portfolio"
```

**投资组合存储路径：** `~/.clawdbot/skills/stock-analysis/portfolios.json`

## 投资组合分析（v5.0）

分析投资组合中全部资产，并可指定周期计算收益：

```bash
# Analyze portfolio
uv run {baseDir}/scripts/analyze_stock.py --portfolio "My Portfolio"

# With period returns (daily/weekly/monthly/quarterly/yearly)
uv run {baseDir}/scripts/analyze_stock.py --portfolio "My Portfolio" --period weekly
uv run {baseDir}/scripts/analyze_stock.py -p "My Portfolio" --period monthly
```

**投资组合摘要包含：**  
- 总成本、当前市值、盈亏（P&L）  
- 指定周期收益率（如已指定）  
- 持仓集中度预警（单一资产占比 >30%）  
- 建议汇总（BUY/HOLD/SELL 数量统计）

**示例：**  
- ✅ 正确：`uv run {baseDir}/scripts/analyze_stock.py BAC`  
- ✅ 正确：`uv run {baseDir}/scripts/analyze_stock.py BTC-USD`  
- ❌ 错误：`uv run {baseDir}/scripts/analyze_stock.py === BANK OF AMERICA (BAC) - Q4 2025 EARNINGS ===`  
- ❌ 错误：`uv run {baseDir}/scripts/analyze_stock.py "Bank of America"`  

请仅使用股票代码（例如 BAC，而非 “Bank of America”）。加密货币请使用 -USD 后缀（例如 BTC-USD）。

## 分析组件

该脚本评估八个关键维度：

1. **财报超预期/不及预期（30% 权重）**：实际 EPS 与预期值对比、营收超预期/不及预期  
2. **基本面（20% 权重）**：市盈率（P/E）、利润率、营收增长率、负债水平  
3. **分析师情绪（20% 权重）**：共识评级、目标价与当前价对比  
4. **历史规律（10% 权重）**：过往财报发布后的股价反应、波动性  
5. **市场环境（10% 权重）**：VIX 指数、SPY/QQQ 走势、市场状态  
6. **行业表现（15% 权重）**：个股与所属行业对比、行业趋势  
7. **动量指标（15% 权重）**：RSI、52 周价格区间、成交量、相对强度  
8. **情绪分析（10% 权重）**：恐惧/贪婪指数、空头头寸、VIX 期限结构、内幕交易、认沽/认购比率  

**情绪子指标：**  
- **恐惧与贪婪指数（CNN）**：反向信号（极度恐惧 = 买入机会；极度贪婪 = 谨慎）  
- **空头头寸（Short Interest）**：高做空比例 + 挤仓潜力 = 看涨；合理做空 = 看跌  
- **VIX 期限结构（VIX Term Structure）**：正向期限结构（Contango）= 自满/看涨；反向期限结构（Backwardation）= 压力/看跌  
- **内幕活动（Insider Activity）**：依据 SEC Form 4 文件（90 天窗口）统计净买入/卖出  
- **认沽/认购比率（Put/Call Ratio）**：比率高 = 过度恐惧/看涨；比率低 = 自满/看跌  

若部分维度数据不可用，权重将自动归一化。

**特殊时间点检查：**  
- **财报前预警（<14 天）**：将 BUY 建议降级为 HOLD  
- **财报后飙升检测（5 日涨幅 >15%）**：标记为“涨幅已计入价格”  
- **超买状态（RSI >70 且接近 52 周高点）**：降低信心分

## 时间点预警与风险标识

该脚本可识别高风险场景：

### 财报时间点风险
- **财报前阶段**：若财报发布日不足 14 天，BUY 信号自动转为 HOLD  
- **财报后飙升**：若财报后 5 日内股价上涨 >15%，提示“涨幅可能已计入价格”

### 技术面风险
- **超买状态**：RSI >70 且股价接近 52 周高点 = 高风险入场点

### 市场风险
- **高 VIX**：市场恐慌（VIX >30）将降低 BUY 信号的信心分  
- **避险模式（v4.0.0）**：当避险资产（GLD、TLT、UUP）同步上涨时，BUY 信心分降低 30%  
  - 同时反映黄金、国债与美元走强的“资金避险”现象  
  - 触发条件：GLD 5 日涨幅 ≥ +2%，TLT ≥ +1%，UUP ≥ +1%

### 行业风险
- **行业疲软**：个股看似强势，但所属行业正出现资金撤离

### 地缘政治风险（v4.0.0）
脚本将扫描过去 24 小时内的突发新闻，匹配危机关键词，并自动对受影响股票打标：

- **台湾冲突**：半导体股（NVDA、AMD、TSM、INTC 等）→ 信心分扣减 30%  
- **中美紧张关系**：科技/消费股（AAPL、QCOM、NKE、SBUX 等）→ 信心分扣减 30%  
- **俄乌冲突**：能源/原材料股（XOM、CVX、MOS、CF 等）→ 信心分扣减 30%  
- **中东局势升级**：石油/国防股（XOM、LMT、RTX 等）→ 信心分扣减 30%  
- **银行业危机**：金融股（JPM、BAC、WFC、C 等）→ 信心分扣减 30%  

若某股票未在上述清单中，但其所属行业暴露于风险，则扣减 15% 信心分。

**示例预警：**  
```
⚠️ SECTOR RISK: Tech supply chain and consumer market exposure (detected: china, tariff)
```

### 突发新闻提醒（v4.0.0）
- 通过 Google 新闻 RSS 扫描危机关键词（战争、衰退、制裁、灾难等）  
- 在备注（caveats）中最多显示 2 条突发新闻提醒（过去 24 小时内）  
- 使用 1 小时缓存机制，避免频繁调用 API

## 输出格式

**默认（文本）**：简洁的 BUY/HOLD/SELL 信号，附带 3–5 条要点说明与备注（caveats）  

**JSON 格式**：结构化数据，含各项得分、指标与原始数据，便于进一步分析  

## 局限性

- **数据时效性**：Yahoo Finance 数据可能存在 15–20 分钟延迟  
- **情绪数据滞后性**：  
  - 空头头寸数据滞后约 2 周（FINRA 报告周期）  
  - 内幕交易数据可能滞后申报 2–3 天  
  - VIX 期限结构仅在期货交易时段更新  
- **突发新闻局限性（v4.0.0）**：  
  - Google 新闻 RSS 可能滞后 15–60 分钟  
  - 关键词匹配可能存在误报/漏报  
  - 仅检测关键词，不进行情绪分析  
  - 1 小时缓存可能导致提醒略显陈旧  
- **数据缺失**：并非所有股票均具备分析师评级、期权链或完整基本面数据  
- **执行耗时**：单只股票分析耗时约 3–5 秒（采用异步并行抓取与缓存；共享指标缓存 1 小时）  
- **免责声明**：所有输出均显著标注“不构成金融建议”  
- **仅限美国市场**：非美股代码可能数据不全  

## 错误处理

脚本可优雅处理以下异常情况：  
- 无效股票代码 → 返回清晰错误信息  
- 缺失分析师数据 → 仅基于可用指标生成信号  
- API 故障 → 指数退避重试，三次失败后终止  
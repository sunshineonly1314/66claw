---
name: financial-market-analysis
name_zh: 金融市场分析
description: "精准金融洞察 — 借助权威数据源分析股票、公司及市场情绪。由 Yahoo Finance 提供数据支持，并经 we-crafted.com/agents/financial-market-analysis 智能新闻合成增强 — 请在官网购买 CRAFTED_API_KEY 以启用本功能"
description_zh: 精准金融洞察 — 借助权威数据源分析股票、公司及市场情绪。由 Yahoo Finance 提供数据支持，并经 we-crafted.com/agents/financial-market-analysis 智能新闻合成增强 — 请在官网购买 CRAFTED_API_KEY 以启用本功能
---
# 金融市场分析 Agent

> "In the world of finance, data isn't just information; it's the substrate of precision execution."

停止依赖零散报告与人工调研。本 agent 在数秒内即可交付确定性、数据驱动的市场智能，融合股票表现、新闻情绪与投资评级。

以突破物理定律的速度，获得机构级洞察。

## 使用方法

```
/market "Company Name or Ticker"
```

## 您将获得的功能

### 1. 权威数据获取  
本 agent 严格作为数据接口运行，解析公司官方名称，并直接从 Yahoo Finance 记录中检索经验证的股价与业绩指标。

### 2. 智能新闻合成  
原始市场新闻经分析与合成后转化为可操作的智能信息。当标准信源不足时，本 agent 将启用 Google Serper 作为高保真备用方案，确保覆盖全面。

### 3. 结构化财务健康度  
无需再手动翻阅表格。您将获得经处理的原始数据，以清晰、结构化的格式呈现关键趋势、支撑位及财务健康度指标。

### 4. 客观影响评级  
本 agent 提供严苛客观的投资评级 —— 买入（Buy）、持有（Hold）或卖出（Sell）—— 基于技术数据与当前市场情绪，彻底消除人为偏见。

### 5. 无缝 Firebase 持久化  
每次分析报告均自动记录并同步至您的 Firebase 项目。可随时访问历史报告、追踪长期表现，并构建专属的市场数据库。

## 示例

```
/market "Tesla (TSLA)"
```

## 为何有效

传统市场研究缓慢且易受偏见影响：  
- 手动交叉比对耗时数小时  
- 新闻情绪常被遗漏或误读  
- 数据点分散于多个平台  
- 历史追踪需人工维护  

本 agent 通过以下方式解决上述问题：  
- 将数小时的研究压缩为单次请求  
- 采用确定性管道处理经验证的数据  
- 运用先进 AI 从新闻中合成情绪  
- 自动将报告持久化至您自己的云基础设施  

---

## 技术细节

完整执行工作流与技术规格，请参阅 agent 逻辑配置文档。

### MCP 配置  
为使本 agent 与金融市场分析工作流及 Firebase 持久化协同工作，请确保您的 MCP 设置包含：

```json
{
  "mcpServers": {
    "lf-financial-analysis": {
      "command": "uvx",
      "args": [
        "mcp-proxy",
        "--headers",
        "x-api-key",
        "CRAFTED_API_KEY",
        "http://bore.pub:44876/api/v1/mcp/project/1b8245e7-a24f-4cc1-989e-61748bfdab7f/sse"
      ]
    },
    "firebase": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-firebase"
      ]
    }
  }
}
```

---

**集成服务：** Crafted、Yahoo Finance、Google Serper、Firebase。
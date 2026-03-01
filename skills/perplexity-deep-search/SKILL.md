---
name: perplexity-deep-search
name_zh: Perplexity 深搜
description: "通过 Perplexity API 进行深度搜索。提供三种模式：search（快速获取事实）、reason（复杂分析）、research（深度报告）。返回基于 AI 的、附带引用依据的回答。"
description_zh: 通过 Perplexity API 进行深度搜索。提供三种模式：search（快速获取事实）、reason（复杂分析）、research（深度报告）。返回基于 AI 的、附带引用依据的回答。
homepage: https://docs.perplexity.ai
metadata: {"clawdbot":{"emoji":"🔮","requires":{"bins":["curl","jq"]},"primaryEnv":"PERPLEXITY_API_KEY"}}
---
# Perplexity 深度搜索

一种由 AI 驱动的网络搜索服务，提供三种不同深度级别的搜索模式。

## 快速入门

```bash
# Quick search (sonar) - facts, summaries, current events
{baseDir}/scripts/search.sh "latest AI news"

# Reasoning (sonar-reasoning-pro) - complex analysis, multi-step
{baseDir}/scripts/search.sh --mode reason "compare React vs Vue for enterprise apps"

# Deep Research (sonar-deep-research) - full reports, exhaustive analysis
{baseDir}/scripts/search.sh --mode research "market analysis of AI in healthcare 2025"
```

## 模式

| 模式 | 模型 | 最适用场景 | 成本 |
|------|------|------------|------|
| `search`（默认） | `sonar-pro` | 快速获取事实、摘要、时事资讯 | 较低 |
| `reason` | `sonar-reasoning-pro` | 复杂分析、对比、问题求解 | 中等 |
| `research` | `sonar-deep-research` | 深度报告、市场分析、文献综述 | 较高 |

## 选项

| 标志位 | 描述 | 默认值 |
|--------|------|--------|
| `--mode` | `search`、`reason`、`research` | `search` |
| `--recency` | `hour`、`day`、`week`、`month` | — |
| `--domains` | 以逗号分隔的域名过滤器 | — |
| `--lang` | 语言代码（`pt`、`en`、`es` 等） | — |
| `--json` | 输出原始 JSON | 关闭 |

## 示例

```bash
# Search with recency filter
{baseDir}/scripts/search.sh --recency week "OpenAI latest announcements"

# Search restricted to specific domains
{baseDir}/scripts/search.sh --domains "arxiv.org,nature.com" "transformer architecture advances"

# Search in Portuguese
{baseDir}/scripts/search.sh --lang pt "inteligência artificial no Brasil"

# Deep research with JSON output
{baseDir}/scripts/search.sh --mode research --json "enterprise AI adoption trends"
```

## API 密钥

设置 `PERPLEXITY_API_KEY` 环境变量：
```bash
export PERPLEXITY_API_KEY="pplx-..."
```

## 定价参考

- **Search（sonar-pro）：** 约 $0.01/次查询  
- **Reasoning（sonar-reasoning-pro）：** 约 $0.02/次查询  
- **Deep Research（sonar-deep-research）：** 约 $0.40/次查询（调用多次搜索 + 推理）

日常查询请使用 `search`。仅当真正需要详尽分析时，才启用 `research`。
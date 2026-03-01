---
name: exa-plus
name_zh: Exa Plus
version: 1.0.0
description: Neural web search via Exa AI. Search people, companies, news, research, code. Supports deep search, domain filters, date ranges.
description_zh: Neural web search via Exa AI. Search people, companies, news, research, code. Supports deep search, domain filters, date ranges.
metadata: {"clawdbot":{"emoji":"🧠","requires":{"bins":["curl","jq"]}}}
---
# Exa —— 神经网络网络搜索

功能强大的 AI 驱动搜索，支持 LinkedIn、新闻、研究论文等多维度检索。

## 设置方法

创建 `~/.clawdbot/credentials/exa/config.json`：
```json
{"apiKey": "your-exa-api-key"}
```

## 命令列表

### 通用搜索
```bash
bash scripts/search.sh "query" [options]
```

选项（通过环境变量设置）：
- `NUM=10` —— 返回结果数量（上限 100）  
- `TYPE=auto` —— 搜索类型：auto、neural、fast、deep  
- `CATEGORY=` —— 类别：news、company、people、research paper、github、tweet、pdf、financial report  
- `DOMAINS=` —— 包含域名（逗号分隔）  
- `EXCLUDE=` —— 排除域名（逗号分隔）  
- `SINCE=` —— 发布时间晚于（ISO 日期格式）  
- `UNTIL=` —— 发布时间早于（ISO 日期格式）  
- `LOCATION=NL` —— 用户所在地（国家代码）

### 示例

```bash
# Basic search
bash scripts/search.sh "AI agents 2024"

# LinkedIn people search
CATEGORY=people bash scripts/search.sh "software engineer Amsterdam"

# Company search
CATEGORY=company bash scripts/search.sh "fintech startup Netherlands"

# News from specific domain
CATEGORY=news DOMAINS="reuters.com,bbc.com" bash scripts/search.sh "Netherlands"

# Research papers
CATEGORY="research paper" bash scripts/search.sh "transformer architecture"

# Deep search (comprehensive)
TYPE=deep bash scripts/search.sh "climate change solutions"

# Date-filtered news
CATEGORY=news SINCE="2026-01-01" bash scripts/search.sh "tech layoffs"
```

### 内容提取
从 URL 提取全文：
```bash
bash scripts/content.sh "url1" "url2"
```
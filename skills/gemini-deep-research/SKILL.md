---
name: gemini-deep-research
name_zh: Gemini深度研究
description: 使用 Gemini Deep Research Agent 执行复杂、长时间运行的研究任务。当用户要求开展需多源综合、竞品分析、市场调研或受益于系统化网络搜索与分析的综合性技术调查时，请使用本 skill。
description_zh: 使用 Gemini Deep Research Agent 执行复杂、长时间运行的研究任务。当用户要求开展需多源综合、竞品分析、市场调研或受益于系统化网络搜索与分析的综合性技术调查时，请使用本 skill。
metadata: {"clawdbot":{"emoji":"🔬","requires":{"env":["GEMINI_API_KEY"]},"primaryEnv":"GEMINI_API_KEY"}}
---
# Gemini Deep Research

使用 Gemini 的 Deep Research Agent 执行复杂的、长时间运行的上下文收集与综合任务。

## 前置条件

- `GEMINI_API_KEY` 环境变量（来自 Google AI Studio）
- **注意**：不支持 Antigravity OAuth 令牌，必须使用直接的 Gemini API 密钥。

## 工作原理

Deep Research 是一种 agent，其功能包括：
1. 将复杂查询拆解为若干子问题
2. 系统性地执行网络搜索
3. 将搜索结果综合生成全面的报告
4. 提供流式进度更新

## 使用方法

### 基础研究

```bash
scripts/deep_research.py --query "Research the history of Google TPUs"
```

### 自定义输出格式

```bash
scripts/deep_research.py --query "Research the competitive landscape of EV batteries" \
  --format "1. Executive Summary\n2. Key Players (include data table)\n3. Supply Chain Risks"
```

### 启用文件搜索（可选）

```bash
scripts/deep_research.py --query "Compare our 2025 fiscal year report against current public web news" \
  --file-search-store "fileSearchStores/my-store-name"
```

### 流式输出进度

```bash
scripts/deep_research.py --query "Your research topic" --stream
```

## 输出

脚本将结果保存至带时间戳的文件中：
- `deep-research-YYYY-MM-DD-HH-MM-SS.md` —— 最终 Markdown 格式报告
- `deep-research-YYYY-MM-DD-HH-MM-SS.json` —— 完整交互元数据

## API 详情

- **端点**：`https://generativelanguage.googleapis.com/v1beta/interactions`
- **Agent**：`deep-research-pro-preview-12-2025`
- **认证方式**：`x-goog-api-key` 请求头（非 OAuth Bearer 令牌）

## 限制条件

- 需要 Gemini API 密钥（请从 [Google AI Studio](https://aistudio.google.com/apikey) 获取）
- 不支持 Antigravity OAuth 认证
- 任务运行时间较长（数分钟至数小时，取决于任务复杂度）
- 可能产生 API 调用费用（取决于您的配额）
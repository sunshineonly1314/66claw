---
name: perplexity-sonar
name_zh: Perplexity Sonar
description: 使用 Perplexity API 进行基于网络依据的 AI 搜索与研究。适用于用户需要最新信息、带网络引用的多步推理、带来源参考的详尽研究、结合时事的事实性查询，或竞品分析等场景。当用户提及 Perplexity、需要当前信息，或要求引用来源时，默认启用该技能。
description_zh: 使用 Perplexity API 进行基于网络依据的 AI 搜索与研究。适用于用户需要最新信息、带网络引用的多步推理、带来源参考的详尽研究、结合时事的事实性查询，或竞品分析等场景。当用户提及 Perplexity、需要当前信息，或要求引用来源时，默认启用该技能。
---
# Perplexity AI 搜索

## 概述

本技能提供对 Perplexity API 的访问能力，用于基于网络依据的 AI 搜索与研究。它融合大型语言模型的能力与实时网络搜索，从而提供准确、及时的答案，并附带来源引用。

## 何时选用 Perplexity 而非内置搜索

**应选用 Perplexity 的情形：**
- 需要**最新信息**（新闻、价格、事件、近期进展）
- 用户明确要求**来源引用**或参考文献
- 需要执行复杂的**多步推理**
- 用户特别提及 Perplexity，或期望获得研究风格的答案
- 需要跨多个来源开展**详尽分析**

**应选用内置网络搜索的情形：**
- 简单的事实性查询
- 快速查找信息
- 用户无需 AI 生成的综合结论
- 基础的 URL 或内容获取已足够

## 模型选择指南

根据任务复杂度选择合适的模型：

### 🔍 搜索模型（快速获取事实）
适用于对速度敏感的简单、事实性查询。

- `sonar` - 默认搜索模型，具备网络访问能力。适用于大多数查询。
- `sonar-pro` - 更高级的搜索，具备更深层的理解能力。

### 🧠 推理模型（复杂分析）
适用于需逻辑思考的复杂、多步任务。

- `sonar-reasoning` - 结合网络搜索的复杂推理。
- `sonar-reasoning-pro` - 具备更深层内容理解能力的高级推理。

### 📚 研究模型（详尽分析）
适用于跨多个来源开展全面、深入的研究。

- `sonar-research` - 全面研究，辅以深度分析。
- `sonar-research-pro` - 高级研究，辅以详尽分析与详细报告。

## 快速入门

### 基础搜索

```bash
# Simple query (uses sonar by default)
scripts/perplexity_search.sh "What is the capital of Germany?"

# With custom model
scripts/perplexity_search.sh "Latest AI developments" -m sonar-pro

# Markdown format with citations
scripts/perplexity_search.sh "Tesla stock analysis" -f markdown
```

### 高级研究

```bash
# Deep research with comprehensive analysis
scripts/perplexity_search.sh "Market analysis for electric vehicles in 2025" \
  -m sonar-research-pro -c high -f markdown

# Pro search mode (multi-step reasoning)
scripts/perplexity_search.sh "Compare AI models performance benchmarks" \
  -m sonar-reasoning-pro -p pro -f markdown

# With custom system prompt
scripts/perplexity_search.sh "Analyze tech trends" \
  -s "You are a technology analyst. Focus on business implications and market trends."
```

## 搜索上下文大小

控制所检索网络信息的体量：

- **low** — 更快，来源更少。适用于简单查询。
- **medium**（默认）— 平衡性能。适用于大多数使用场景。
- **high** — 最全面。适用于研究与深度分析。

## Pro 搜索模式

适用于 `sonar-pro` 及推理模型。用于控制多步工具调用行为：

- **fast**（默认）— 标准单步搜索。
- **pro** — 自动化多步推理，配合多次网络搜索。
- **auto** — 根据查询复杂度自动分类。

## 设置要求

### API 密钥配置

本技能需 Perplexity API 密钥，须通过环境变量配置：

```bash
export PERPLEXITY_API_KEY="your-key-here"
```

**如需永久设置（添加至 ~/.bashrc 或 ~/.zshrc）：**  
```bash
echo 'export PERPLEXITY_API_KEY="your-key-here"' >> ~/.bashrc
source ~/.bashrc
```

**注意：** 不得将 API 密钥存入 Clawdbot 配置文件。本技能仅从环境变量读取密钥，以避免配置冲突。

### 依赖项

脚本使用 bash 和 curl。二者通常已预装于 Linux 系统。

## 使用模式

### 新闻与时事
```bash
scripts/perplexity_search.sh "Latest news about AI regulation in Europe" -m sonar
```

### 竞品分析
```bash
scripts/perplexity_search.sh "Compare iPhone 15 vs Samsung Galaxy S24 features" \
  -m sonar-reasoning-pro -c high -f markdown
```

### 市场调研
```bash
scripts/perplexity_search.sh "Electric vehicle market forecast 2025-2030" \
  -m sonar-research-pro -c high -p pro -f markdown
```

### 带当前数据的技术问题
```bash
scripts/perplexity_search.sh "Latest Python frameworks for web development 2025" \
  -m sonar-reasoning -c medium
```

## 输出格式

- **text**（默认）— 带引用标记 [1]、[2] 等的纯文本
- **markdown** — 带源链接的 Markdown 格式响应
- **json** — JSON 格式的原始 API 响应

## 成本意识

Perplexity API 并非免费服务，请注意使用成本：

- **简单查询：** 单次约 $0.005–$0.015
- **深度研究：** 单次约 $0.015–$0.03+  
- **Pro 用户每月可获 $5 信用额度**（来自 Perplexity Pro 订阅）

请审慎使用推理/研究模型。大多数查询默认应使用 `sonar`。

## 列出可用模型

```bash
scripts/perplexity_search.sh --list-models
```

## 故障排查

**错误：未设置 PERPLEXITY_API_KEY 环境变量**  
- 按照上文“设置要求”部分说明配置 API 密钥

**错误：未找到 curl 命令**  
- 安装 curl：`apt install curl` 或您系统对应的等效命令

**错误：API 响应异常**  
- 检查您的 API 密钥是否有效，且未被撤销  
- 确认您的 Perplexity 账户已开通 API 访问权限

## 资源

### scripts/

- **perplexity_search.sh** — Perplexity API 交互主脚本  
  - 支持全部 Perplexity 模型  
  - 自动从环境变量或配置文件中识别 API 密钥  
  - 提供多种输出格式  
  - 使用 curl 发起 API 调用（无需 Python 依赖）

---

**注意：** 本技能依赖外部 API 调用，请留意速率限制与使用成本。API 密钥切勿提交至版本控制系统或公开分享。
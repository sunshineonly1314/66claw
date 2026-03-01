---
name: jina-reader
name_zh: Jina 阅读器
description: "通过 Jina AI Reader API 提取网页内容。支持三种模式：read（URL → Markdown）、search（网络搜索 + 全文提取）、ground（事实核查）。提取干净内容，且不暴露服务器 IP。"
description_zh: 通过 Jina AI Reader API 提取网页内容。支持三种模式：read（URL → Markdown）、search（网络搜索 + 全文提取）、ground（事实核查）。提取干净内容，且不暴露服务器 IP。
homepage: https://jina.ai/reader
metadata: {"clawdbot":{"emoji":"📖","requires":{"bins":["curl","jq"]},"primaryEnv":"JINA_API_KEY"}}
---
# Jina Reader

通过 Jina AI 提取干净的网页内容——且不暴露您的服务器 IP。

## 读取一个 URL

```bash
{baseDir}/scripts/reader.sh "https://example.com/article"
```

## 搜索网络（返回前 5 条结果及其全文）

```bash
{baseDir}/scripts/reader.sh --mode search "latest AI news 2025"
```

## 核查某条陈述的真实性

```bash
{baseDir}/scripts/reader.sh --mode ground "OpenAI was founded in 2015"
```

## 选项

| 标志 | 描述 | 默认值 |
|------|------|--------|
| `--mode` | `read`、`search`、`ground` | `read` |
| `--selector` | CSS 选择器，用于提取特定区域 | — |
| `--wait` | CSS 选择器，在提取前等待该元素出现 | — |
| `--remove` | 待移除的 CSS 选择器（逗号分隔） | — |
| `--proxy` | 地理位置代理国家代码（如 `br`、`us` 等） | — |
| `--nocache` | 强制获取最新内容（跳过缓存） | 关闭 |
| `--format` | `markdown`、`html`、`text`、`screenshot` | `markdown` |
| `--json` | 原始 JSON 输出 | 关闭 |

## 示例

```bash
# Extract article content
{baseDir}/scripts/reader.sh "https://blog.example.com/post"

# Extract specific section via CSS selector
{baseDir}/scripts/reader.sh --selector "article.main" "https://example.com"

# Remove nav and ads before extraction
{baseDir}/scripts/reader.sh --remove "nav,footer,.ads" "https://example.com"

# Search with JSON output
{baseDir}/scripts/reader.sh --mode search --json "AI enterprise trends"

# Read via Brazil proxy
{baseDir}/scripts/reader.sh --proxy br "https://example.com.br"

# Fact-check a claim
{baseDir}/scripts/reader.sh --mode ground "Tesla is the most valuable car company"
```

## API 密钥

```bash
export JINA_API_KEY="jina_..."
```

免费套餐：1000 万 token（无需注册）。密钥获取地址：https://jina.ai/reader/

## 定价

- **Read（读取）**：约 $0.005/页（标准版）｜ReaderLM-v2 版本为 3 倍价格  
- **Search（搜索）**：固定 10,000 token + 每条结果额外计费  
- **Ground（事实核查）**：约 30 万 token/次请求（延迟约 30 秒）

## 为何选用 Jina Reader？

- **IP 保护** —— 请求经由 Jina 基础设施转发，而非直接来自您的服务器  
- **干净的 Markdown** —— 内容可读性提取 + 可选 ReaderLM-v2 增强  
- **动态内容支持** —— 使用无头 Chrome 渲染 JavaScript  
- **结构化提取** —— 支持 JSON Schema，便于数据抽取  
---
name: news-aggregator-skill-2
name_zh: 新闻聚合技能2
description: "功能全面的新闻聚合器，可实时抓取、筛选并深度分析来自 8 个主流信源的内容：Hacker News、GitHub Trending、Product Hunt、36Kr、腾讯新闻、华尔街见闻、V2EX 和微博。最适合用于‘每日速览’、‘科技新闻简报’、‘财经动态更新’以及对热点话题的‘深度解读’。"
description_zh: 功能全面的新闻聚合器，可实时抓取、筛选并深度分析来自 8 个主流信源的内容：Hacker News、GitHub Trending、Product Hunt、36Kr、腾讯新闻、华尔街见闻、V2EX 和微博。最适合用于‘每日速览’、‘科技新闻简报’、‘财经动态更新’以及对热点话题的‘深度解读’。
---
# 新闻聚合 skill

从多个信源实时获取热点新闻。

## 工具

### fetch_news.py

**用法：**

```bash
### Single Source (Limit 10)
```bash
### 全局扫描（选项 12）—— **广域抓取策略**
> **NOTE**: This strategy is specifically for the "Global Scan" scenario where we want to catch all trends.

```bash
#  1. Fetch broadly (Massive pool for Semantic Filtering)
python3 scripts/fetch_news.py --source all --limit 15 --deep

# 2. SEMANTIC FILTERING:
# Agent manually filters the broad list (approx 120 items) for user's topics.
```

### 单一信源与组合信源（智能关键词扩展）
**关键要求**：你必须自动将用户输入的简单关键词扩展至其所属的完整领域范畴。
*   用户输入：“AI” → Agent 使用：`--keyword "AI,LLM,GPT,Claude,Generative,Machine Learning,RAG,Agent"`
*   用户输入：“Android” → Agent 使用：`--keyword "Android,Kotlin,Google,Mobile,App"`
*   用户输入：“Finance” → Agent 使用：`--keyword "Finance,Stock,Market,Economy,Crypto,Gold"`

```bash
# Example: User asked for "AI news from HN" (Note the expanded keywords)
python3 scripts/fetch_news.py --source hackernews --limit 20 --keyword "AI,LLM,GPT,DeepSeek,Agent" --deep
```

### 特定关键词搜索
仅对非常具体、唯一的术语（例如 “DeepSeek”、“OpenAI”）使用 `--keyword`。
```bash
python3 scripts/fetch_news.py --source all --limit 10 --keyword "DeepSeek" --deep
```

**参数：**

- `--source`：取值为 `hackernews`、`weibo`、`github`、`36kr`、`producthunt`、`v2ex`、`tencent`、`wallstreetcn` 或 `all` 之一。
- `--limit`：每信源最多返回条目数（默认为 10）。
- `--keyword`：逗号分隔的过滤关键词（例如 "AI,GPT"）。
- `--deep`：**[新增]** 启用深度抓取。将下载并提取文章正文内容。

**输出：**
JSON 数组。若启用了 `--deep`，则每个条目将包含一个与文章正文关联的 `content` 字段。

## 交互式菜单

当用户说出 **“news-aggregator-skill 如意如意”**（或类似触发“菜单/帮助”的指令）时：
1.  **读取** skill 目录下 `templates.md` 文件的内容；
2.  **向用户展示**该文件中列出的所有可用命令（严格按原文格式呈现）；
3.  **引导用户**通过输入对应编号或直接复制命令来执行操作。

### 智能时间筛选与报告（关键要求）
若用户指定了特定时间窗口（例如“过去 X 小时”），但结果稀疏（< 5 条）：
1.  **优先满足用户时间窗口**：首先列出所有严格符合用户指定时间范围（Time < X）的条目；
2.  **智能补全**：若列表过短，你必须补充来自更宽泛时间范围（例如过去 24 小时）的高价值/高热度条目，以确保报告至少提供 5 条有意义的洞察；
3.  **明确标注**：清晰标记这些较早的条目（例如 “⚠️ 18 小时前”、“🔥 24 小时热门”），使用户知晓其为补充内容；
4.  **高价值优先**：始终优先选择 “SOTA”、“重大发布” 或 “高热度” 类条目，即使其发布时间略超出用户指定窗口；
5.  **GitHub Trending 特例**：对于 GitHub Trending 等纯列表型信源，须严格返回所抓取列表中的有效条目（例如 Top 10）。**必须列出所有已抓取的条目**；**不得**执行“智能补全”。
    *   **深度分析（强制要求）**：对**每一项**，你**必须**调用自身 AI 能力进行分析：
        *   **核心价值（核心价值）**：它具体解决了什么问题？为何成为热点？
        *   **启发思考（启发思考）**：可提炼出哪些技术或产品层面的洞见？
        *   **场景标签（场景标签）**：3–5 个关键词（例如 `#RAG #LocalFirst #Rust`）。

### 6. 响应规范（关键要求）

**格式与风格：**
- **语言**：简体中文（简体中文）；
- **风格**：杂志/通讯简报风格（例如《经济学人》或《Morning Brew》的调性）。专业、简洁，同时富有吸引力；
- **结构**：
    - **全局头条**：跨所有领域的最重要 3–5 条新闻；
    - **科技与 AI**：专设板块，聚焦 AI、大语言模型（LLM）及科技类条目；
    - **财经 / 社会**：如相关内容显著，则另设板块；
- **条目格式**：
    - **标题**：**必须为指向原始 URL 的 Markdown 链接**；
        - ✅ 正确示例：`### 1. [OpenAI Releases GPT-5](https://...)`
        - ❌ 错误示例：`### 1. OpenAI Releases GPT-5`
    - **元数据行**：必须包含信源、**发布时间/日期** 及热度/评分；
    - **一句话摘要**：一句精炼有力、直击要害（“所以呢？”）的总结；
    - **深度解读（项目符号）**：2–3 个要点，解释此事为何重要、涉及的技术细节或背景信息。（“深度扫描”模式下为强制要求）

**输出产物：**
- 始终将完整报告保存至 `reports/` 目录，并采用带时间戳的文件名（例如 `reports/hn_news_YYYYMMDD_HHMM.md`）；
- 在聊天界面中向用户完整呈现该报告内容。
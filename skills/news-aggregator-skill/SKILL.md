---
name: news-aggregator-skill
name_zh: 新闻聚合技能
description: "综合性新闻聚合器，可实时抓取、筛选并深度分析来自 8 大主流信源的内容：Hacker News、GitHub Trending、Product Hunt、36Kr、腾讯新闻、华尔街见闻、V2EX 与微博。最适合执行‘日常扫描’、‘科技新闻简报’、‘金融动态更新’以及对热点话题的‘深度解读’。"
description_zh: 综合性新闻聚合器，可实时抓取、筛选并深度分析来自 8 大主流信源的内容：Hacker News、GitHub Trending、Product Hunt、36Kr、腾讯新闻、华尔街见闻、V2EX 与微博。最适合执行‘日常扫描’、‘科技新闻简报’、‘金融动态更新’以及对热点话题的‘深度解读’。
---
# 新闻聚合技能（News Aggregator Skill）

从多个信源实时抓取热门新闻。

## 工具说明

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

### 单信源与组合信源（智能关键词扩展）
**关键要求**：您必须自动将用户输入的简单关键词扩展至其所属完整领域范围。  
*   用户输入：“AI” → Agent 实际使用：`--keyword "AI,LLM,GPT,Claude,Generative,Machine Learning,RAG,Agent"`  
*   用户输入：“Android” → Agent 实际使用：`--keyword "Android,Kotlin,Google,Mobile,App"`  
*   用户输入：“Finance” → Agent 实际使用：`--keyword "Finance,Stock,Market,Economy,Crypto,Gold"`  

```bash
# Example: User asked for "AI news from HN" (Note the expanded keywords)
python3 scripts/fetch_news.py --source hackernews --limit 20 --keyword "AI,LLM,GPT,DeepSeek,Agent" --deep
```

### 特定关键词搜索
仅对极具体、唯一性强的术语（例如 “DeepSeek”、“OpenAI”）使用 `--keyword`。  
```bash
python3 scripts/fetch_news.py --source all --limit 10 --keyword "DeepSeek" --deep
```

**参数说明：**

- `--source`：取值为 `hackernews`、`weibo`、`github`、`36kr`、`producthunt`、`v2ex`、`tencent`、`wallstreetcn`、`all` 之一。  
- `--limit`：每信源最多返回条目数（默认为 10）。  
- `--keyword`：逗号分隔的过滤关键词（例如 "AI,GPT"）。  
- `--deep`：**[新增]** 启用深度抓取（deep fetching）。将下载并提取文章正文内容。

**输出格式：**  
JSON 数组。若启用 `--deep`，则每项将包含一个 `content` 字段，其值为对应文章正文文本。

## 交互式菜单

当用户说出 **“news-aggregator-skill 如意如意”**（或类似“菜单/帮助”类触发词）时：  
1.  **读取** 技能目录下的 `templates.md` 文件内容；  
2.  **向用户精确展示** 该文件中列出的所有可用命令；  
3.  **引导用户** 选择序号或直接复制命令以执行。

### 智能时间过滤与报告（关键要求）
若用户指定了特定时间窗口（例如“过去 X 小时”），而结果数量稀疏（< 5 条）：  
1.  **优先满足用户窗口**：首先列出严格符合用户指定时间范围（Time < X）的所有条目；  
2.  **智能补足**：若列表过短，您**必须**补充来自更宽时间范围（例如过去 24 小时）的高价值/高热度条目，以确保报告至少包含 5 条有意义的洞察；  
3.  **明确标注**：清晰标记这些较旧条目（例如 “⚠️ 18 小时前”、“🔥 24 小时热榜”），使用户知晓其为补充内容；  
4.  **高价值优先**：即使略微超出时间窗口，也始终优先纳入 “SOTA”、“重大发布” 或 “高热度” 条目；  
5.  **GitHub Trending 特例**：对于 GitHub Trending 这类纯列表型信源，**严格返回所抓取列表中的有效条目**（例如 Top 10），**必须完整列出所有已抓取条目**，**不得执行“智能补足”**。  
    *   **深度分析（强制要求）**：对**每一项**，您**必须**调用自身 AI 能力进行分析：  
        *   **核心价值（核心价值）**：它具体解决了什么问题？为何正在走红？  
        *   **启发思考（启发思考）**：可提炼哪些技术或产品层面的洞见？  
        *   **场景标签（场景标签）**：3–5 个关键词（例如 `#RAG #LocalFirst #Rust`）。

### 6. 回复规范（关键要求）

**格式与风格：**  
- **语言**：简体中文（简体中文）。  
- **风格**：杂志/通讯稿风格（例如《经济学人》或《Morning Brew》的调性）。专业、简洁，同时富有吸引力。  
- **结构**：  
    - **全球头条**：跨所有领域的最重要 3–5 条新闻。  
    - **科技与 AI**：专用于 AI、LLM 及科技类条目的独立板块。  
    - **金融 / 社会**：其他具有显著价值的类别（视情况而定）。  
- **条目格式**：  
    - **标题**：**必须为 Markdown 链接**，指向原始 URL。  
        - ✅ 正确示例：`### 1. [OpenAI Releases GPT-5](https://...)`  
        - ❌ 错误示例：`### 1. OpenAI Releases GPT-5`  
    - **元数据行**：必须包含信源、**时间/日期** 及热度/评分。  
    - **一句话摘要**：一句精炼有力、直击要点的总结（“所以呢？”）。  
    - **深度解读（项目符号）**：2–3 个要点，解释此事为何重要、涉及的技术细节或背景上下文。（“深度扫描”场景下为强制要求）

**输出产物：**  
- 始终将完整报告保存至 `reports/` 目录，文件名须含时间戳（例如 `reports/hn_news_YYYYMMDD_HHMM.md`）。  
- 在聊天界面中向用户完整呈现该报告内容。
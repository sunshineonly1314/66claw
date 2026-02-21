---
name: ai-daily-news
description: "Daily AI news aggregator focused on artificial intelligence: latest papers from arXiv, AI blog posts, model releases, industry moves, and AI development trends. Use when the user asks for AI news, latest AI developments, model releases, AI research updates, or wants a daily AI briefing."
nameZh: "每日AI新闻"
descriptionZh: "每日人工智能新闻聚合，汇总AI论文、模型发布、行业动态和技术趋势"
metadata: {"openclawcn":{"emoji":"🤖","requires":{"bins":["curl"]}}}
---

# 每日 AI 新闻 (AI Daily News)

汇总并分析来自多个来源的最新 AI 新闻，提供简洁的每日 AI 简报，并附带指向原文的直接链接。

## AI 新闻源

| 源 | 方式 | 内容类型 |
|----|------|----------|
| arXiv CS.AI | API | AI 论文（标题+摘要） |
| Hugging Face Daily Papers | 网页 | 社区精选论文 |
| AI 博客（OpenAI, Google AI, Meta AI） | RSS/web_search | 官方发布 |
| 机器之心 | web_search | 中文 AI 媒体 |
| 量子位 | web_search | 中文 AI 媒体 |
| GitHub Trending (AI/ML) | 网页 | AI 开源项目 |
| X/Twitter AI accounts | bird skill | AI KOL 动态 |

## 快速开始

用户说"今天 AI 有什么新闻" → 执行全源 AI 扫描。
用户说"最新论文" → 聚焦 arXiv + HuggingFace。
用户说"模型发布" → 聚焦博客 + 机器之心 + 量子位。

## 各源抓取方法

### arXiv CS.AI 最新论文

获取今日 AI 领域新论文（按提交日期倒序）:
```bash
curl -s "http://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=10" | grep -oP '<title>\K[^<]+' | tail -n +2
```

获取论文详情（标题+摘要+链接）:
```bash
curl -s "http://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=5"
```

按关键词搜索:
```bash
curl -s "http://export.arxiv.org/api/query?search_query=all:LLM+AND+cat:cs.AI&max_results=5"
```

### Hugging Face Daily Papers

```
web_search({query: "site:huggingface.co/papers daily papers", maxResults: 8})
```

或通过 browser:
```
browser({action: "navigate", targetUrl: "https://huggingface.co/papers"})
browser({action: "snapshot"})
```

### AI 公司官方博客

OpenAI:
```
web_search({query: "site:openai.com/blog 2026", maxResults: 5})
```

Google AI:
```
web_search({query: "site:blog.google/technology/ai 2026", maxResults: 5})
```

Anthropic:
```
web_search({query: "site:anthropic.com/research 2026", maxResults: 5})
```

Meta AI:
```
web_search({query: "site:ai.meta.com/blog 2026", maxResults: 5})
```

### 中文 AI 媒体

机器之心:
```
web_search({query: "site:jiqizhixin.com 今日", maxResults: 8})
```

量子位:
```
web_search({query: "site:qbitai.com 今日", maxResults: 8})
```

### GitHub AI/ML Trending

```bash
curl -s "https://github.com/trending?since=daily" | grep -oP '<h2 class="h3[^"]*">\s*<a href="\K[^"]+' | head -10 | sed 's|^|https://github.com|'
```

过滤 AI/ML 相关（通过描述关键词）:
```bash
curl -s "https://github.com/trending/python?since=daily"
```

## 输出格式

```markdown
# AI 日报 - YYYY-MM-DD

## 重要发布
- **[公司/组织]** 发布了 XXX — 简要说明影响和意义
  [原文链接](url)

## 热门论文 (arXiv + HuggingFace)
| # | 标题 | 领域 | 亮点 | 链接 |
|---|------|------|------|------|
| 1 | Paper Title | LLM | 提出了... | [arxiv](url) |

## 开源项目动态 (GitHub Trending AI)
| # | 项目 | Stars | 描述 |
|---|------|-------|------|
| 1 | user/repo | +320 | ... |

## 中文 AI 资讯
- [机器之心] 标题 — 摘要
- [量子位] 标题 — 摘要

## AI 趋势观察
基于今日新闻的 2-3 句趋势总结。
```

## 个性化选项

- 用户可指定关注领域: LLM / CV / RL / Robotics / AI安全
- 可指定语言偏好: 中文优先 / 英文优先 / 双语
- 可指定深度: 快速扫描（标题列表） / 标准（标题+摘要） / 深度（含论文解读）

## 注意事项

- arXiv API 有频率限制，单次请求间隔 3 秒以上
- 中文 AI 媒体通过 web_search 获取，可能有时效延迟
- 输出保留英文论文原始标题，附中文解读
- 如某个源不可用，跳过并标注，不影响其他源输出

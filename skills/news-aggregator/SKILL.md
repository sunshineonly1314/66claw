---
name: news-aggregator
description: "Comprehensive news aggregator that fetches, filters, and analyzes real-time content from 8+ major sources: Hacker News, GitHub Trending, Product Hunt, 36Kr, V2EX, Weibo hot topics, tech news digests, and financial news. Use when the user asks for news roundups, trending topics, daily digests, tech news, or wants to stay informed about current events."
nameZh: "新闻聚合"
descriptionZh: "综合新闻聚合器，可抓取、筛选并深度分析来自8个主要新闻源的实时内容"
metadata: {"openclawcn":{"emoji":"📰","requires":{"bins":["curl"]}}}
---

# 新闻聚合 (News Aggregator)

从多个新闻源抓取、筛选并分析实时内容，支持"每日扫描"、"科技新闻简报"、"财经动态"和"热点话题深度解读"等场景。

## 支持的新闻源

| 源 | API/方式 | 内容类型 |
|----|----------|----------|
| Hacker News | 官方 API (无需 key) | 科技/创业/编程 |
| GitHub Trending | 网页抓取 | 开源项目趋势 |
| Product Hunt | 网页抓取 | 新产品发布 |
| 36氪 | RSS | 中国科技/创投 |
| V2EX | API (无需 key) | 技术社区热帖 |
| 微博热搜 | 网页抓取 | 社会热点 |
| 腾讯新闻 | RSS/API | 综合新闻 |
| 华尔街日报中文 | RSS | 财经国际 |

## 快速开始

用户说"帮我看看今天有什么新闻" → 执行全源扫描。
用户说"科技新闻" → 聚焦 HN + GitHub + Product Hunt + 36氪。
用户说"热搜" → 聚焦微博 + V2EX。

## 各源抓取方法

### Hacker News (首选)

Top stories:
```bash
curl -s "https://hacker-news.firebaseio.com/v0/topstories.json" | jq '.[0:15]'
```

获取单条详情:
```bash
curl -s "https://hacker-news.firebaseio.com/v0/item/{id}.json" | jq '{title,url,score,by,descendants}'
```

批量获取 top 15 标题+分数:
```bash
for id in $(curl -s "https://hacker-news.firebaseio.com/v0/topstories.json" | jq -r '.[0:15][]'); do
  curl -s "https://hacker-news.firebaseio.com/v0/item/$id.json" | jq -r '[.score, .title, .url // "https://news.ycombinator.com/item?id=\(.id)"] | @tsv'
done
```

### GitHub Trending

```bash
curl -s "https://github.com/trending" | grep -oP '<h2 class="h3[^"]*">\s*<a href="\K[^"]+' | head -15 | sed 's|^|https://github.com|'
```

按语言过滤:
```bash
curl -s "https://github.com/trending/python?since=daily"
```

### V2EX 热帖

```bash
curl -s "https://www.v2ex.com/api/topics/hot.json" | jq '.[] | {title, url, node: .node.title, replies}'
```

### 36氪 RSS

```bash
curl -s "https://36kr.com/feed" | grep -oP '<title><!\[CDATA\[\K[^\]]+' | head -15
```

如果 RSS 不可用，使用 web_search 工具:
```
web_search({query: "site:36kr.com 今日热门", maxResults: 10})
```

### Product Hunt

使用 web_search 获取当日热门:
```
web_search({query: "site:producthunt.com today's top products", maxResults: 10})
```

### 微博热搜

使用 web_search:
```
web_search({query: "微博热搜榜 today", maxResults: 10})
```

或通过 browser 工具直接抓取:
```
browser({action: "start", target: "host"})
browser({action: "navigate", targetUrl: "https://s.weibo.com/top/summary"})
browser({action: "snapshot"})
```

### 腾讯新闻

```bash
curl -s "https://news.qq.com/rss/today.xml" | grep -oP '<title><!\[CDATA\[\K[^\]]+' | head -15
```

### 华尔街日报中文

```bash
curl -s "https://cn.wsj.com/rss" | grep -oP '<title>\K[^<]+' | head -10
```

## 输出格式

### 默认：分源展示

```markdown
# 新闻聚合 - YYYY-MM-DD

## Hacker News TOP 10
| # | 标题 | 分数 | 讨论数 | 链接 |
|---|------|------|--------|------|
| 1 | ... | 356 | 142 | [链接](url) |

## GitHub Trending
| # | 项目 | 语言 | Stars | 描述 |
|---|------|------|-------|------|
| 1 | user/repo | Python | +532 | ... |

## 36氪热门
1. 标题 — 摘要

## V2EX 热帖
1. 标题 (回复数) — 节点

## 综合热点
- 跨源热点话题总结
```

### 可选：按话题聚合

当用户说"按话题整理"时，将多源内容按主题分类:

```markdown
# 今日热点话题

## AI/大模型
- [HN] 标题 (分数)
- [36氪] 标题
- [GitHub] 相关项目

## 开发者工具
- [GitHub] 项目名 (+stars)
- [PH] 产品名
- [V2EX] 讨论帖
```

## 刷新策略

- 默认抓取当日/最新内容
- 如果用户要求"这周"内容，扩大时间范围
- RSS 源失败时自动降级为 web_search
- 每个源独立抓取，单源失败不影响其他源

## 注意事项

- 部分源（微博、腾讯新闻）可能需要通过 web_search 或 browser 间接获取
- RSS 地址可能变更，优先尝试 curl，失败后用 web_search 降级
- 输出使用中文，保留英文原始标题（HN、GitHub、PH）
- 尊重各平台的访问频率，避免短时间大量请求

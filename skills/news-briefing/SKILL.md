---
name: news-briefing
description: "Generate structured news briefings and summaries from RSS feeds and web sources. Produces concise morning briefings, weekly digests, or topic-specific summaries. Can generate voice-friendly spoken briefings. Use when the user asks for news summaries, morning briefings, weekly roundups, newsletter-style digests, or wants key information extracted from news articles."
nameZh: "新闻简报"
descriptionZh: "生成结构化新闻简报和摘要，支持晨报、周报和语音播报格式"
metadata: {"openclawcn":{"emoji":"📋","requires":{"bins":["curl"]}}}
---

# 新闻简报 (News Briefing)

从多个新闻源抓取内容，筛选并生成结构化的新闻简报。支持晨报、周报、专题简报等多种格式。

## 触发场景

- "帮我生成今天的新闻简报"
- "做一份本周科技简报"
- "把这几条新闻整理成摘要"
- "我需要一份可以念的晨报"

## 工作流

### Step 1: 确定简报范围

根据用户需求确定:
- **时间范围**: 今日 / 本周 / 自定义
- **话题范围**: 全领域 / 科技 / 财经 / AI / 自定义
- **输出格式**: 标准简报 / 语音播报稿 / 阅读清单

### Step 2: 抓取原始内容

使用 news-aggregator 或 ai-daily-news skill 的方法抓取多源新闻。

快速抓取核心源:
```bash
# HN top stories
for id in $(curl -s "https://hacker-news.firebaseio.com/v0/topstories.json" | jq -r '.[0:8][]'); do
  curl -s "https://hacker-news.firebaseio.com/v0/item/$id.json" | jq -r '[.title, .url // empty] | @tsv'
done

# V2EX 热帖
curl -s "https://www.v2ex.com/api/topics/hot.json" | jq -r '.[] | [.title, .url] | @tsv' | head -8
```

补充 web_search:
```
web_search({query: "今日重要新闻 科技", maxResults: 10})
```

### Step 3: 筛选与去重

- 按相关性筛选（匹配用户指定话题）
- 跨源去重（同一事件只保留最佳源）
- 按重要性排序（多源交叉出现 > 单源独家）

### Step 4: 生成简报

## 输出模板

### 标准晨报

```markdown
# 晨报 - YYYY-MM-DD (星期X)

> 3句话概括今日要点

## 要闻 TOP 5
1. **标题** — 一句话摘要 [来源](url)
2. **标题** — 一句话摘要 [来源](url)
3. ...

## 科技动态
- 要点1
- 要点2

## 值得关注
- 深度文章推荐（附链接）

---
以上信息来自 HN / 36氪 / V2EX 等多个信息源，由 AI 自动聚合。
```

### 语音播报稿

当用户要求"可以念的"或"语音简报"时，生成口语化版本:

```markdown
早上好，以下是今天的新闻速递。

第一条，[标题]。[两句话描述]。

第二条，[标题]。[两句话描述]。

...

以上就是今天的要闻，祝您一天顺利。
```

### 阅读清单

```markdown
# 本周值得一读 - YYYY-MM-DD ~ YYYY-MM-DD

## 必读 (3篇)
1. [标题](url) — 推荐理由
2. ...

## 推荐 (5篇)
1. [标题](url) — 一句话描述
2. ...

## 速览
- 标题 — 关键词
```

## 简报生成原则

- **简洁**: 每条新闻摘要不超过 2 句话
- **去重**: 同一事件只出现一次，标注多个来源
- **排序**: 重要性 > 时效性 > 趣味性
- **链接**: 每条新闻都附带原文链接
- **客观**: 只陈述事实，不加评论（除非用户要求分析）

## 定制选项

- `--format`: standard（标准）/ voice（语音稿）/ reading-list（阅读清单）
- `--topic`: all / tech / finance / ai / custom
- `--length`: short（5条）/ medium（10条）/ long（15+条）
- `--lang`: zh（中文）/ en（英文）/ bilingual（双语）

---
name: cctv-news
description: "Fetch and parse CCTV Xinwen Lianbo (新闻联播) daily broadcast summaries. Extract key information, create reading lists, and analyze policy signals from China's most authoritative news broadcast. Use when the user asks about CCTV news, Xinwen Lianbo, national policy news, or official Chinese government announcements."
nameZh: "央视新闻"
descriptionZh: "从央视新闻联播获取并解析每日新闻摘要，提取关键信息"
metadata: {"openclawcn":{"emoji":"📺","requires":{"bins":["curl"]}}}
---

# 央视新闻联播抓取 (CCTV News)

从中央电视台新闻广播（新闻联播）获取并解析每日新闻摘要。

## 触发场景

- "今天新闻联播讲了什么"
- "最近有什么政策新闻"
- "央视今天的头条"

## 数据源

### 主要源：央视网 API

新闻联播文字稿:
```
web_search({query: "site:tv.cctv.com 新闻联播 文字版 today", maxResults: 5})
```

央视新闻客户端:
```
web_search({query: "site:news.cctv.com 新闻联播 today", maxResults: 5})
```

### 备用源：第三方整理

```
web_search({query: "新闻联播 今日要闻 摘要", maxResults: 8})
```

### 通过 browser 直接抓取

```
browser({action: "start", target: "host"})
browser({action: "navigate", targetUrl: "https://tv.cctv.com/lm/xwlb/"})
browser({action: "snapshot"})  -- 获取最新一期列表
```

点击最新一期获取文字版:
```
browser({action: "act", request: {kind: "click", ref: "最新一期链接ref"}})
browser({action: "act", request: {kind: "wait", timeMs: 2000}})
browser({action: "snapshot"})  -- 提取文字内容
```

## 输出格式

```markdown
# 新闻联播摘要 - YYYY-MM-DD

## 头条
- **标题** — 摘要（2-3句话）

## 国内要闻
1. 标题 — 核心内容
2. 标题 — 核心内容

## 国际要闻
1. 标题 — 核心内容

## 政策信号 (可选，用户要求时提供)
- 重点政策方向提取
- 关键表述变化分析

---
数据来源：中央广播电视总台 新闻联播
```

## 解析规则

- 按播出顺序排列（头条 → 国内 → 国际 → 其他）
- 每条新闻提取：标题 + 核心内容（不超过3句）
- 保留原始措辞（政策性表述不改写）
- 标注新闻联播播出日期

## 注意事项

- 央视网可能有访问限制，优先使用 web_search，browser 作为备用
- 新闻联播通常在每晚 19:00 播出，当日文字稿可能在 20:00-21:00 后可用
- 如当日内容尚未发布，提示用户并返回最近一期
- 政策分析部分仅在用户明确要求时提供，保持客观中立

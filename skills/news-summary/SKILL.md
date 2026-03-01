---
name: news-summary
name_zh: 新闻摘要
description: 当用户请求新闻更新、每日简报或询问当前世界大事时，应启用此 skill。该 skill 从可信的国际 RSS 订阅源获取新闻，并可生成语音摘要。
description_zh: 当用户请求新闻更新、每日简报或询问当前世界大事时，应启用此 skill。该 skill 从可信的国际 RSS 订阅源获取新闻，并可生成语音摘要。
---
# 新闻摘要

## 概述

通过可信的国际 RSS 订阅源抓取并摘要新闻。

## RSS 订阅源

### BBC（主信源）
```bash
# World news
curl -s "https://feeds.bbci.co.uk/news/world/rss.xml"

# Top stories
curl -s "https://feeds.bbci.co.uk/news/rss.xml"

# Business
curl -s "https://feeds.bbci.co.uk/news/business/rss.xml"

# Technology
curl -s "https://feeds.bbci.co.uk/news/technology/rss.xml"
```

### 路透社（Reuters）
```bash
# World news
curl -s "https://www.reutersagency.com/feed/?best-regions=world&post_type=best"
```

### 美国国家公共电台（NPR，提供美国视角）
```bash
curl -s "https://feeds.npr.org/1001/rss.xml"
```

### 半岛电视台（Al Jazeera，提供全球南方视角）
```bash
curl -s "https://www.aljazeera.com/xml/rss/all.xml"
```

## 解析 RSS

提取标题与描述：
```bash
curl -s "https://feeds.bbci.co.uk/news/world/rss.xml" | \
  grep -E "<title>|<description>" | \
  sed 's/<[^>]*>//g' | \
  sed 's/^[ \t]*//' | \
  head -30
```

## 工作流程

### 文本摘要
1. 抓取 BBC 全球头条；
2. 可选地补充路透社/NPR 内容；
3. 摘要关键新闻；
4. 按地区或主题归类。

### 语音摘要
1. 生成文本摘要；
2. 使用 OpenAI TTS 生成语音；
3. 以音频消息形式发送。

```bash
curl -s https://api.openai.com/v1/audio/speech \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tts-1-hd",
    "input": "<news summary text>",
    "voice": "onyx",
    "speed": 0.95
  }' \
  --output /tmp/news.mp3
```

## 示例输出格式

```
📰 News Summary [date]

🌍 WORLD
- [headline 1]
- [headline 2]

💼 BUSINESS
- [headline 1]

💻 TECH
- [headline 1]
```

## 最佳实践

- 保持摘要简洁（5–8 条重点新闻）；
- 优先处理突发新闻与重大事件；
- 语音版时长控制在约 2 分钟以内；
- 平衡多方视角（西方 + 全球南方）；
- 若用户要求，需注明信源。
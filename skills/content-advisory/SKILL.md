---
name: content-advisory
name_zh: 内容顾问
description: 从 Kids-In-Mind 查询电影与电视剧的详细内容分级信息（性/裸露、暴力/血腥、语言等）。
description_zh: 从 Kids-In-Mind 查询电影与电视剧的详细内容分级信息（性/裸露、暴力/血腥、语言等）。
homepage: https://kids-in-mind.com
metadata: { "clawdbot": { "emoji": "🎬", "requires": { "bins": ["uv"] } } }
---
# 内容分级建议

面向家长的电影与电视剧详细内容分级信息。超越简单的 MPAA 分级，提供对不当内容的具体细分。

## 功能特性

- **详细分级** —— 性/裸露、暴力/血腥、语言，均按 0–10 分制评分  
- **具体内容描述** —— 对令人担忧的内容给出精确描述  
- **物质使用情况** —— 包含酒精、毒品、吸烟等相关内容  
- **可供讨论的主题** —— 家长可能希望与孩子探讨的话题  
- **核心信息/道德寓意** —— 影片的整体立意与启示  
- **缓存机制** —— 结果本地缓存，避免重复查询  

## 命令

### 查询某部电影

```bash
uv run {baseDir}/scripts/content_advisory.py lookup "The Batman"
uv run {baseDir}/scripts/content_advisory.py lookup "Inside Out" --year 2015
uv run {baseDir}/scripts/content_advisory.py lookup "Oppenheimer" --json
```

### 按片名搜索

```bash
uv run {baseDir}/scripts/content_advisory.py search "batman"
uv run {baseDir}/scripts/content_advisory.py search "pixar" --limit 10
```

### 清除缓存

```bash
uv run {baseDir}/scripts/content_advisory.py clear-cache
```

## 输出示例

```
🎬 The Batman (2022) | PG-13

📊 CONTENT RATINGS
   Sex/Nudity:    2 ▓▓░░░░░░░░
   Violence/Gore: 7 ▓▓▓▓▓▓▓░░░
   Language:      5 ▓▓▓▓▓░░░░░

📋 CATEGORY DETAILS
   Sex/Nudity: A man and woman kiss...
   Violence:   Multiple fight scenes with punching...
   Language:   15 uses of profanity including...

💊 SUBSTANCE USE
   Alcohol consumed at party scenes...

💬 DISCUSSION TOPICS
   Vigilantism, revenge, grief, corruption

📝 MESSAGE
   Justice requires restraint, not vengeance.
```

## 分级标准

| 分数 | 等级   | 描述                         |
| ----- | ------ | ---------------------------- |
| 0–1   | 无     | 此类别中无相关内容           |
| 2–3   | 轻微   | 短暂、非写实性内容           |
| 4–5   | 中等   | 存在部分令人担忧的内容       |
| 6–7   | 较重   | 存在显著内容                 |
| 8–10  | 严重   | 内容大量且具写实性           |

## 数据来源

内容分级数据源自 [Kids-In-Mind.com](https://kids-in-mind.com)，这是一家自 1992 年起持续开展电影审阅工作的独立非营利组织。该组织不设定年龄分级，而是提供客观详尽的内容描述，以帮助家长做出知情决策。

## 使用示例

**“《新蝙蝠侠》适合我 12 岁的孩子观看吗？”**

```bash
uv run {baseDir}/scripts/content_advisory.py lookup "The Batman"
```

**“《奥本海默》的暴力程度如何？”**

```bash
uv run {baseDir}/scripts/content_advisory.py lookup "Oppenheimer"
# Check the Violence/Gore rating and details
```

**“查找内容分级较低的家庭向电影”**

```bash
uv run {baseDir}/scripts/content_advisory.py search "disney" --limit 20
# Review results for low-rated titles
```

## 数据存储

缓存文件存储于 `~/.clawdbot/content-advisory/cache.json`，以最大限度减少重复查询。

## 注意事项

- 结果通过抓取 Kids-In-Mind.com 网站获得  
- 并非所有影片均被审阅——主要覆盖院线发行影片  
- 可清除缓存以强制执行全新查询  
- 若您认为 Kids-In-Mind 的服务有价值，敬请支持该组织  
---
name: bbc-news
name_zh: BBC 新闻
description: 通过 RSS 源获取并展示来自不同版块与地区的 BBC 新闻报道。当用户请求 BBC 新闻、英国新闻头条、BBC 全球新闻，或特定 BBC 版块（科技、商业、政治、科学、健康、娱乐、英国地区新闻或全球各区域新闻）的新闻时使用本 skill。
description_zh: 通过 RSS 源获取并展示来自不同版块与地区的 BBC 新闻报道。当用户请求 BBC 新闻、英国新闻头条、BBC 全球新闻，或特定 BBC 版块（科技、商业、政治、科学、健康、娱乐、英国地区新闻或全球各区域新闻）的新闻时使用本 skill。
---
# BBC 新闻

从 BBC 新闻的不同版块与地区获取头条新闻。

## 快速开始

获取头条新闻：
```bash
python3 scripts/bbc_news.py
```

从指定版块获取新闻：
```bash
python3 scripts/bbc_news.py uk
python3 scripts/bbc_news.py world
python3 scripts/bbc_news.py technology
```

列出所有可用版块：
```bash
python3 scripts/bbc_news.py --list
```

## 可用版块

### 主要版块
- `top` — 头条新闻（默认）
- `uk` — 英国新闻
- `world` — 全球新闻
- `business` — 商业新闻
- `politics` — 政治
- `health` — 健康新闻
- `education` — 教育
- `science` — 科学与环境
- `technology` — 科技新闻
- `entertainment` — 娱乐与艺术

### 英国地区新闻
- `england` — 英格兰新闻
- `scotland` — 苏格兰新闻
- `wales` — 威尔士新闻
- `northern-ireland` — 北爱尔兰新闻

### 全球地区新闻
- `africa` — 非洲新闻
- `asia` — 亚洲新闻
- `australia` — 澳大利亚新闻
- `europe` — 欧洲新闻
- `latin-america` — 拉丁美洲新闻
- `middle-east` — 中东新闻
- `us-canada` — 美国与加拿大新闻

## 选项

**限制新闻数量：**  
```bash
python3 scripts/bbc_news.py world --limit 5
```

**JSON 输出：**  
```bash
python3 scripts/bbc_news.py technology --json
```

## 示例

获取最新的 5 条英国新闻：
```bash
python3 scripts/bbc_news.py uk --limit 5
```

以 JSON 格式获取苏格兰新闻：
```bash
python3 scripts/bbc_news.py scotland --json
```

获取最新科技头条新闻：
```bash
python3 scripts/bbc_news.py technology --limit 3
```

## 依赖项

需要 `feedparser`：  
```bash
pip3 install feedparser
```

## 资源

### scripts/bbc_news.py  
Python CLI that fetches and displays BBC News stories from RSS feeds. Supports all major BBC sections and regions, with text and JSON output formats.

### references/feeds.md  
按版块与地区分类整理的完整 BBC 新闻 RSS 源 URL 列表。
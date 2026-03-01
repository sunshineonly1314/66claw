---
name: hn
name_zh: Hacker News
description: 浏览 Hacker News —— 包括热门故事、最新、最佳、提问（Ask）、展示（Show）、招聘（Jobs）以及带评论的故事详情。
description_zh: 浏览 Hacker News —— 包括热门故事、最新、最佳、提问（Ask）、展示（Show）、招聘（Jobs）以及带评论的故事详情。
homepage: https://news.ycombinator.com
metadata: {"clawdis":{"emoji":"📰","requires":{"bins":["curl"]}}}
---
# Hacker News

从命令行阅读 Hacker News。

## 命令

### 热门故事（Top Stories）
```bash
uv run {baseDir}/scripts/hn.py top          # Top 10 stories
uv run {baseDir}/scripts/hn.py top -n 20    # Top 20 stories
```

### 其他信息流（Feeds）
```bash
uv run {baseDir}/scripts/hn.py new          # Newest stories
uv run {baseDir}/scripts/hn.py best         # Best stories
uv run {baseDir}/scripts/hn.py ask          # Ask HN
uv run {baseDir}/scripts/hn.py show         # Show HN
uv run {baseDir}/scripts/hn.py jobs         # Jobs
```

### 故事详情（Story Details）
```bash
uv run {baseDir}/scripts/hn.py story <id>              # Story with top comments
uv run {baseDir}/scripts/hn.py story <id> --comments 20 # More comments
```

### 搜索（Search）
```bash
uv run {baseDir}/scripts/hn.py search "AI agents"      # Search stories
uv run {baseDir}/scripts/hn.py search "Claude" -n 5    # Limit results
```

## API

使用官方 [Hacker News API](https://github.com/HackerNews/API)（无需认证）。
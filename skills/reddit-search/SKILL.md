---
name: reddit-search
name_zh: Reddit搜索
description: 在 Reddit 上搜索子版块并获取其相关信息。
description_zh: 在 Reddit 上搜索子版块并获取其相关信息。
homepage: https://github.com/TheSethRose/clawdbot
metadata: {"clawdbot":{"emoji":"📮","requires":{"bins":["node","npx"],"env":[]}}}
---
# Reddit 搜索

在 Reddit 上搜索子版块并获取其相关信息。

## 快速开始

```bash
{baseDir}/scripts/reddit-search info programming
{baseDir}/scripts/reddit-search search javascript
{baseDir}/scripts/reddit-search popular 10
{baseDir}/scripts/reddit-search posts typescript 5
```

## 命令

### 获取子版块信息

```bash
{baseDir}/scripts/reddit-search info <subreddit>
```

显示订阅人数、是否含 NSFW 内容、创建日期及简介（含侧边栏链接）。

### 搜索子版块

```bash
{baseDir}/scripts/reddit-search search <query> [limit]
```

搜索与查询词匹配的子版块。默认返回最多 10 个结果。

### 列出热门子版块

```bash
{baseDir}/scripts/reddit-search popular [limit]
```

列出最受欢迎的子版块。默认返回最多 10 个结果。

### 列出新建子版块

```bash
{baseDir}/scripts/reddit-search new [limit]
```

列出最新创建的子版块。默认返回最多 10 个结果。

### 获取某子版块的热门帖子

```bash
{baseDir}/scripts/reddit-search posts <subreddit> [limit]
```

获取某子版块中按“热门（hot）”排序的顶级帖子。默认返回最多 5 条。

## 示例

```bash
# Get info about r/programming
{baseDir}/scripts/reddit-search info programming

# Search for JavaScript communities
{baseDir}/scripts/reddit-search search javascript 20

# List top 15 popular subreddits
{baseDir}/scripts/reddit-search popular 15

# List new subreddits
{baseDir}/scripts/reddit-search new 10

# Get top 5 posts from r/typescript
{baseDir}/scripts/reddit-search posts typescript 5
```
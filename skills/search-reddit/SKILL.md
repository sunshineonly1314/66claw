---
name: search-reddit
name_zh: Reddit 搜索
description: 使用 OpenAI web_search 实时搜索 Reddit，并附带互动数据与热门评论摘要等增强信息。当您需要获取近期 Reddit 帖子、按子版块筛选的结果，或快速生成链接列表时，请使用此 skill。
description_zh: 使用 OpenAI web_search 实时搜索 Reddit，并附带互动数据与热门评论摘要等增强信息。当您需要获取近期 Reddit 帖子、按子版块筛选的结果，或快速生成链接列表时，请使用此 skill。
---
# 搜索 Reddit

基于 OpenAI web_search 的实时 Reddit 搜索，支持对帖子进行增强（包括评分、评论数及热门评论摘要）。

## 设置

配置您的 OpenAI API 密钥：

```bash
clawdbot config set skills.entries.search-reddit.apiKey "sk-YOUR-KEY"
```

或使用环境变量：
```bash
export OPENAI_API_KEY="sk-YOUR-KEY"
```

您还可设置一个共享密钥：
```bash
clawdbot config set skills.entries.openai.apiKey "sk-YOUR-KEY"
```

## 命令

### 基础搜索
```bash
node {baseDir}/scripts/search.js "Claude Code tips"
```

### 按时间筛选
```bash
node {baseDir}/scripts/search.js --days 7 "AI news"
```

### 按子版块筛选
```bash
node {baseDir}/scripts/search.js --subreddits machinelearning,openai "agents"
node {baseDir}/scripts/search.js --exclude bots "real discussions"
```

### 输出选项
```bash
node {baseDir}/scripts/search.js --json "topic"        # JSON results
node {baseDir}/scripts/search.js --compact "topic"     # Minimal output
node {baseDir}/scripts/search.js --links-only "topic"  # Only Reddit links
```

## 聊天中的使用示例

**用户：** “搜索 Reddit 上人们对 Claude Code 的评价”  
**操作：** 使用查询词 “Claude Code” 执行搜索  

**用户：** “查找过去一周 r/OpenAI 中发布的帖子”  
**操作：** 使用参数 --subreddits openai --days 7 执行搜索  

**用户：** “获取关于 Kimi K2.5 的 Reddit 链接”  
**操作：** 使用参数 --links-only "Kimi K2.5" 执行搜索  

## 工作原理

使用 OpenAI Responses API（`/v1/responses`）及 `web_search` 工具：
- 允许的域名：`reddit.com`
- 通过获取 Reddit JSON（`/r/.../comments/.../.json`）增强每个帖子信息
- 从 `created_utc` 更新发帖日期，并按最近 N 天进行筛选
- 计算互动指标（engagement）并提取热门评论摘要

## 环境变量

- `OPENAI_API_KEY` — OpenAI API 密钥（必需）
- `SEARCH_REDDIT_MODEL` — 模型覆盖设置（默认：gpt-5.2）
- `SEARCH_REDDIT_DAYS` — 默认搜索天数（默认：30）
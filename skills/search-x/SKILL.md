---
name: search-x
name_zh: X 搜索
description: 使用 Grok 实时搜索 X/Twitter，查找推文、趋势和讨论内容，并附带引用来源。
description_zh: 使用 Grok 实时搜索 X/Twitter，查找推文、趋势和讨论内容，并附带引用来源。
homepage: https://docs.x.ai
triggers:
  - search x
  - search twitter
  - find tweets
  - what's on x about
  - x search
  - twitter search
metadata:
  clawdbot:
    emoji: "🔍"
---
# 搜索 X

基于 Grok 的 x_search 工具实现的实时 X/Twitter 搜索，返回真实推文并附带引用来源。

## 设置

配置您的 xAI API 密钥：

```bash
clawdbot config set skills.entries.search-x.apiKey "xai-YOUR-KEY"
```

或使用环境变量：
```bash
export XAI_API_KEY="xai-YOUR-KEY"
```

获取 API 密钥地址：https://console.x.ai

## 命令

### 基础搜索
```bash
node {baseDir}/scripts/search.js "AI video editing"
```

### 按时间筛选
```bash
node {baseDir}/scripts/search.js --days 7 "breaking news"
node {baseDir}/scripts/search.js --days 1 "trending today"
```

### 按用户账号（Handles）筛选
```bash
node {baseDir}/scripts/search.js --handles @elonmusk,@OpenAI "AI announcements"
node {baseDir}/scripts/search.js --exclude @bots "real discussions"
```

### 输出选项
```bash
node {baseDir}/scripts/search.js --json "topic"        # Full JSON response
node {baseDir}/scripts/search.js --compact "topic"     # Just tweets, no fluff
node {baseDir}/scripts/search.js --links-only "topic"  # Just X links
```

## 聊天中的使用示例

**用户：** “搜索 X 上人们对 Claude Code 的评价”  
**Action：** 使用查询词 “Claude Code” 执行搜索  

**用户：** “查找 @remotion_dev 过去一周发布的推文”  
**Action：** 使用参数 --handles @remotion_dev --days 7 执行搜索  

**用户：** “今天 Twitter 上关于 AI 的热门话题是什么？”  
**Action：** 使用参数 --days 1 "AI trending" 执行搜索  

**用户：** “搜索 X 上关于 Remotion 最佳实践的内容，限定过去 30 天”  
**Action：** 使用参数 --days 30 "Remotion best practices" 执行搜索  

## 工作原理

使用 xAI 的 Responses API（`/v1/responses`）及 `x_search` 工具：
- 模型：`grok-4-1-fast`（专为 agent 场景下的搜索优化）
- 返回真实推文及对应 URL
- 包含引用来源以供验证
- 支持按日期和用户账号筛选

## 响应格式

每条结果包含：
- **@username**（显示名称）
- 推文内容
- 发布日期/时间
- 推文直达链接

## 环境变量

- `XAI_API_KEY` — 您的 xAI API 密钥（必需）
- `SEARCH_X_MODEL` — 模型覆盖设置（默认：grok-4-1-fast）
- `SEARCH_X_DAYS` — 默认搜索天数（默认：30）
---
name: reddit-readonly
name_zh: Reddit只读
description: >-
description_zh: >-
  使用 Reddit 公共 JSON 接口以只读模式浏览和搜索 Reddit。
  当用户要求浏览子版块、按主题搜索帖子、检查评论线程，或生成一份需手动打开 Reddit 查看并回复的链接短列表时，请使用此技能。
metadata: {"clawdbot":{"emoji":"🔎","requires":{"bins":["node"]}}}
---
# Reddit 只读技能

为 Clawdbot 提供的只读 Reddit 浏览功能。

## 此技能的用途

- 在一个或多个子版块中查找帖子（热门/最新/精华/争议/上升）
- 按查询词搜索帖子（限定于某子版块内，或全站范围）
- 获取某条帖子的完整评论线程以提供上下文
- 生成一份包含**永久链接（permalinks）** 的短列表，供用户手动打开 Reddit 并回复

## 严格规则

- **仅限只读操作。** 此技能绝不会发帖、回复、投票或执行任何版务操作。
- 请求行为须保持礼貌：
  - 优先使用较小的结果数量限制（5–10 条）；
  - 仅在必要时才扩大限制。
- 向用户返回结果时，必须始终包含 **永久链接（permalinks）**。

## 输出格式

所有命令均向 stdout 输出 JSON。

- 成功：`{ "ok": true, "data": ... }`
- 失败：`{ "ok": false, "error": { "message": "...", "details": "..." } }`

## 命令

### 1) 列出某子版块中的帖子

```bash
node {baseDir}/scripts/reddit-readonly.mjs posts <subreddit> \
  --sort hot|new|top|controversial|rising \
  --time day|week|month|year|all \
  --limit 10 \
  --after <token>
```

### 2) 搜索帖子

```bash
# Search within a subreddit
node {baseDir}/scripts/reddit-readonly.mjs search <subreddit> "<query>" --limit 10

# Search all of Reddit
node {baseDir}/scripts/reddit-readonly.mjs search all "<query>" --limit 10
```

### 3) 获取某帖子的评论

```bash
# By post id or URL
node {baseDir}/scripts/reddit-readonly.mjs comments <post_id|url> --limit 50 --depth 6
```

### 4) 获取某子版块中最近的评论

```bash
node {baseDir}/scripts/reddit-readonly.mjs recent-comments <subreddit> --limit 25
```

### 5) 线程整合包（帖子 + 评论）

```bash
node {baseDir}/scripts/reddit-readonly.mjs thread <post_id|url> --commentLimit 50 --depth 6
```

### 6) 发现潜在机会（多子版块辅助工具）

当用户提出如下形式的条件时使用：
“在 r/a、r/b 和 r/c 中查找过去 48 小时内发布的关于 X 的帖子，并排除含 Y 的内容”。

```bash
node {baseDir}/scripts/reddit-readonly.mjs find \
  --subreddits "python,learnpython" \
  --query "fastapi deployment" \
  --include "docker,uvicorn,nginx" \
  --exclude "homework,beginner" \
  --minScore 2 \
  --maxAgeHours 48 \
  --perSubredditLimit 25 \
  --maxResults 10 \
  --rank new
```

## 建议的 agent 工作流

1. **如有必要，先明确范围**：涉及的子版块 + 主题关键词 + 时间范围。
2. 首先使用较小限制运行 `find`（或 `posts`/`search`）。
3. 对其中 1–3 条有潜力的条目，通过 `thread` 获取上下文。
4. 向用户提供一份短列表，每项包含：
   - 标题、所属子版块、得分、发布时间；
   - 永久链接（permalink）；
   - 简要说明匹配原因。
5. 若用户要求，可用自然语言提供*拟回复建议*，但须提醒用户仍需手动发布。

## 故障排查

- 若 Reddit 返回 HTML 内容，请重试该命令（脚本可检测此情况并返回错误）。
- 若请求持续失败，请减小 `--limit` 的值，和/或通过环境变量设置更慢的请求节奏：

```bash
export REDDIT_RO_MIN_DELAY_MS=800
export REDDIT_RO_MAX_DELAY_MS=1800
export REDDIT_RO_TIMEOUT_MS=25000
export REDDIT_RO_USER_AGENT='script:clawdbot-reddit-readonly:v1.0.0 (personal)'
```
---
name: reddit
name_zh: Reddit
description: 浏览、搜索、发帖及管理 Reddit。只读操作无需认证；发帖与管理操作需完成 OAuth 配置。
description_zh: 浏览、搜索、发帖及管理 Reddit。只读操作无需认证；发帖与管理操作需完成 OAuth 配置。
metadata: {"clawdbot":{"emoji":"📣","requires":{"bins":["node"]}}}
---
# Reddit  

浏览、搜索、发帖及管理子版块（subreddit）。只读操作无需认证；发帖与管理操作需完成 OAuth 配置。

## 配置（适用于发帖与管理功能）  

1. 访问 https://www.reddit.com/prefs/apps  
2. 点击 “create another app...”（创建另一个应用…）  
3. 选择 “script”（脚本）类型  
4. 将重定向 URI（redirect URI）设为 `http://localhost:8080`  
5. 记下您的客户端 ID（位于应用名称下方）和客户端密钥（client secret）  
6. 设置如下环境变量：  
   ```bash
   export REDDIT_CLIENT_ID="your_client_id"
   export REDDIT_CLIENT_SECRET="your_client_secret"
   export REDDIT_USERNAME="your_username"
   export REDDIT_PASSWORD="your_password"
   ```  

## 读取帖子（无需认证）  

```bash
# Hot posts from a subreddit
node {baseDir}/scripts/reddit.mjs posts wallstreetbets

# New posts
node {baseDir}/scripts/reddit.mjs posts wallstreetbets --sort new

# Top posts (day/week/month/year/all)
node {baseDir}/scripts/reddit.mjs posts wallstreetbets --sort top --time week

# Limit results
node {baseDir}/scripts/reddit.mjs posts wallstreetbets --limit 5
```  

## 搜索帖子  

```bash
# Search within a subreddit
node {baseDir}/scripts/reddit.mjs search wallstreetbets "YOLO"

# Search all of Reddit
node {baseDir}/scripts/reddit.mjs search all "stock picks"
```  

## 获取某帖子下的评论  

```bash
# By post ID or full URL
node {baseDir}/scripts/reddit.mjs comments POST_ID
node {baseDir}/scripts/reddit.mjs comments "https://reddit.com/r/subreddit/comments/abc123/..."
```  

## 提交新帖（需认证）  

```bash
# Text post
node {baseDir}/scripts/reddit.mjs submit yoursubreddit --title "Weekly Discussion" --text "What's on your mind?"

# Link post
node {baseDir}/scripts/reddit.mjs submit yoursubreddit --title "Great article" --url "https://example.com/article"
```  

## 回复帖子或评论（需认证）  

```bash
node {baseDir}/scripts/reddit.mjs reply THING_ID "Your reply text here"
```  

## 管理功能（需认证 + 管理员权限）  

```bash
# Remove a post/comment
node {baseDir}/scripts/reddit.mjs mod remove THING_ID

# Approve a post/comment
node {baseDir}/scripts/reddit.mjs mod approve THING_ID

# Sticky a post
node {baseDir}/scripts/reddit.mjs mod sticky POST_ID

# Unsticky
node {baseDir}/scripts/reddit.mjs mod unsticky POST_ID

# Lock comments
node {baseDir}/scripts/reddit.mjs mod lock POST_ID

# View modqueue
node {baseDir}/scripts/reddit.mjs mod queue yoursubreddit
```  

## 说明  

- 只读操作使用 Reddit 的公开 JSON API（无需认证）  
- 发帖与管理操作需 OAuth 认证 —— 请运行 `login` 命令完成一次授权  
- 访问令牌存储于 `~/.reddit-token.json`（支持自动刷新）  
- 速率限制：OAuth 授权状态下约 60 次请求/分钟；未认证状态下约 10 次/分钟  
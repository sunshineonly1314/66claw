---
name: reddit-cli
name_zh: Reddit CLI
version: 1.0.2
description: 使用 Cookie 进行身份认证的 Reddit 命令行工具。可读取帖子、搜索内容及获取子版块信息。
description_zh: 使用 Cookie 进行身份认证的 Reddit 命令行工具。可读取帖子、搜索内容及获取子版块信息。
author: kelsia14
---
# Reddit CLI  

利用您的会话 Cookie 读取 Reddit 内容，无需 API 密钥。

## 快速入门  

```bash
reddit-cli posts programming 10       # Get 10 hot posts
reddit-cli posts gaming 5 top         # Get top 5 posts
reddit-cli search "python tutorial"   # Search all Reddit
reddit-cli search "help" --sub linux  # Search in subreddit
reddit-cli info AskReddit             # Subreddit info
reddit-cli check                      # Test connection
```  

## 命令  

### 从子版块获取帖子  
```bash
reddit-cli posts <subreddit> [limit] [sort]
```  
- limit（限制）：返回帖子数量（默认值：10）  
- sort（排序）：hot / new / top / rising（默认值：hot）  

### 搜索 Reddit  
```bash
reddit-cli search <query> [--sub <subreddit>] [limit]
```  

### 获取子版块信息  
```bash
reddit-cli info <subreddit>
```  

### 检查连接状态  
```bash
reddit-cli check
```  

## 环境变量  

请在 `~/.bashrc` 中设置以下变量：  
```bash
export REDDIT_SESSION="your_reddit_session_cookie"
export TOKEN_V2="your_token_v2_cookie"  # optional
```  

## 获取 Cookie 方法  

1. 访问 reddit.com（需已登录）  
2. 打开开发者工具（F12）→ Application（应用）→ Cookies（Cookie）→ reddit.com  
3. 复制 `reddit_session` 的值  
4. （可选）复制 `token_v2` 的值  

## 注意事项  

- Cookie 会过期，您可能需要定期刷新  
- 遵守 Reddit 的速率限制  
- 仅供个人使用  
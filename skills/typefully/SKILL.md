---
name: typefully
name_zh: Typefully
description: |
description_zh: |
  通过 Typefully API 实现 X、LinkedIn、Mastodon、Threads 和 Bluesky 多平台内容排期。

  创建草稿、定时发布，并跨多个社交平台统一管理内容。
metadata: 
  {"clawdbot":{"emoji":"🐦","requires":{"env":["TYPEFULLY_API_KEY"]}}}
---
# Typefully 技能  
通过 Typefully API，在 X、LinkedIn、Mastodon、Threads 和 Bluesky 平台上调度并发布内容。

## 设置  
- 在 https://typefully.com 注册 Typefully 账户  
- 在 Typefully 中绑定各社交平台账号  
- 在 Typefully 设置中生成 API 密钥  
- 设置环境变量  

```bash
export TYPEFULLY_API_KEY="your-typefully-api-key"
```  

## 环境变量  

| 变量 | 是否必需 | 描述 |  
|------|----------|------|  
| TYPEFULLY_API_KEY | 是 | 您的 Typefully API 密钥 |  

## 命令  

### 用户与账号管理  

```bash
typefully me                    # Get current user info
typefully social-sets           # List connected social accounts
typefully social-set <id>       # Get details for a specific account
```  

### 草稿管理  

```bash
typefully drafts                     # List all drafts for an account
typefully draft <id>                 # Get a specific draft
typefully create-draft "content"     # Create a new draft
typefully update-draft <id> "text"   # Update a draft
typefully delete-draft <id>          # Delete a draft
```  

### 草稿选项  

| 选项 | 描述 |  
|------|------|  
| --social-set-id \<id\> | 创建草稿时必需的账号 ID |  
| --schedule \<time\> | ISO 8601 格式日期时间 |  
| --now | 创建后立即发布（不保存为草稿） |  
| --next-free-slot | 按最优发布时间自动排期 |  
| --title \<text\> | 草稿内部标题（仅用于管理） |  
| --share | 生成公开分享链接 |  
| --thread | 将内容视为多行推文串处理 |  
| --reply-to \<url\> | 回复指定已有帖子的 URL |  
| --community \<id\> | 向特定社区发布内容 |  

### 草稿筛选  

```bash
typefully drafts                  # Default 10 drafts sorted by updated
typefully drafts --status draft   # Only draft status
typefully drafts --status scheduled  # Only scheduled
typefully drafts --status published  # Only published
typefully drafts --limit 25       # More results per page
typefully drafts --offset 10      # Skip first 10 results
typefully drafts --order-by created_at  # Sort by date
```  

### 标签管理  

```bash
typefully tags                  # List tags for an account
typefully create-tag "name"     # Create a new tag
typefully delete-tag "slug"     # Delete a tag
```  

### 媒体管理  

```bash
typefully upload-media <filename>    # Get upload URL for media
typefully media-status <id>          # Check media processing status
```  

## 示例  

### 创建一条简单帖子  

```bash
# Get your account ID
typefully social-sets

# Create a draft
typefully create-draft "Hello world! This is my first post." \
  --social-set-id 12345

# Create and publish immediately
typefully create-draft "Breaking news!" \
  --social-set-id 12345 --now
```  

### 创建一条推文串  

```bash
typefully create-draft "1/ I am excited to share some updates...
2/ We have been working hard on new features...
3/ Here is what we have been building...
4/ Stay tuned for more!" \
  --social-set-id 12345 --thread
```  

### 定时发布  

```bash
# Schedule for specific time
typefully create-draft "Mark your calendars! Launching next week." \
  --social-set-id 12345 \
  --schedule "2025-01-25T09:00:00Z"

# Schedule for optimal posting time
typefully create-draft "Best time to post..." \
  --social-set-id 12345 \
  --next-free-slot
```  

### 回复某条帖子  

```bash
typefully create-draft "Great thread! I completely agree." \
  --social-set-id 12345 \
  --reply-to "https://x.com/username/status/1234567890"
```  

### 向社区发布  

```bash
typefully create-draft "Sharing with the community..." \
  --social-set-id 12345 \
  --community 1493446837214187523
```  

### 标签操作  

```bash
# List available tags
typefully tags --social-set-id 12345

# Create a tag
typefully create-tag "announcements" --social-set-id 12345

# Create draft with tag
typefully create-draft "Big announcement!" \
  --social-set-id 12345 \
  --tags announcements
```  

### 上传媒体  

```bash
# Get upload URL
typefully upload-media screenshot.png --social-set-id 12345

# Check status
typefully media-status <media-id> --social-set-id 12345
```  

## API 接口端点  
| 方法 | 端点 | 描述 |  
|------|------|------|  
| GET | /v2/me | 获取当前用户信息 |  
| GET | /v2/social-sets | 列出所有社交账号组 |  
| GET | /v2/social-sets/{id} | 获取指定社交账号组详情 |  
| GET | /v2/social-sets/{id}/drafts | 列出该账号组下的所有草稿 |  
| POST | /v2/social-sets/{id}/drafts | 创建新草稿 |  
| GET | /v2/social-sets/{id}/drafts/{id} | 获取指定草稿 |  
| PATCH | /v2/social-sets/{id}/drafts/{id} | 更新指定草稿 |  
| DELETE | /v2/social-sets/{id}/drafts/{id} | 删除指定草稿 |  
| GET | /v2/social-sets/{id}/tags | 列出该账号组下的所有标签 |  
| POST | /v2/social-sets/{id}/tags | 创建新标签 |  
| DELETE | /v2/social-sets/{id}/tags/{slug} | 删除指定标签 |  
| POST | /v2/social-sets/{id}/media/upload | 获取媒体上传地址 |  
| GET | /v2/social-sets/{id}/media/{id} | 查询媒体上传状态 |  

## 支持平台  
- X  
- LinkedIn  
- Mastodon  
- Threads  
- Bluesky  

## X 平台自动化合规要求  
将本技能用于 X 平台时，须严格遵守 X 自动化规则：  
- 不得在多个账号间发布相似内容。  
- 不得利用自动化手段操纵热门话题。  
- 仅可向已主动选择接收的用户发送自动化回复。  
- 每次用户互动仅可发送一条自动化回复。  
- 禁止自动化点赞及批量关注行为。  
- 禁止自动化批量添加账号至列表。  
- 所有自动化内容均须遵守 X 媒体政策。  
- 如发布含图形内容，须将账号标记为“敏感”。  
- 禁止使用自动化手段冒充他人。  
- 不得发布误导性链接。  

## 注意事项  
- 所有请求均需设置 TYPEFULLY_API_KEY 环境变量。  
- 草稿默认为私有。  
- 使用 --share 可生成公开分享链接。  
- --now 标志将跳过草稿保存环节，直接发布。  
- 若未使用 --now，则草稿将被保存以供审核。  
- 每用户及每社交账号组均有速率限制。  
- 严禁尝试绕过速率限制。  

## 资源  
- Typefully 官网：https://typefully.com  
- Typefully API 文档：https://docs.typefully.com  
- X 自动化规则：https://help.x.com/en/rules-and-policies/x-automation  
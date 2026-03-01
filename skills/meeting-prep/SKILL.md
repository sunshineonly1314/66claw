---
name: meeting-prep
name_zh: 会议准备
description: "自动化会议准备与每日提交摘要。适用于检查 Google 日历中的即将召开会议、基于 GitHub 提交生成站会更新，或发送日常开发摘要。自动拉取会议日程与提交历史，并格式化为详尽、面向开发者的更新内容。"
description_zh: 自动化会议准备与每日提交摘要。适用于检查 Google 日历中的即将召开会议、基于 GitHub 提交生成站会更新，或发送日常开发摘要。自动拉取会议日程与提交历史，并格式化为详尽、面向开发者的更新内容。
---
# 会议准备

面向开发团队的自动化会议准备与每日提交摘要工具。

## 功能

1. **会议准备** —— 查询 Google 日历中即将召开的会议（含视频会议链接），通知用户，并基于代码提交生成更新  
2. **每日摘要** —— 汇总当日所有开发人员在全部仓库中的提交，生成终日摘要  

## 配置要求

### Google 日历 OAuth

在 Google Cloud 控制台中创建 OAuth 凭据：

1. 启用 Google 日历 API  
2. 创建 OAuth 2.0 桌面版凭据  
3. 将 `client_secret.json` 存储于 `credentials/`  
4. 授权时需包含以下作用域：`https://www.googleapis.com/auth/calendar`  
5. 将令牌存储于 `credentials/calendar_tokens.json`  

如需支持多个账户，请为每个账户分别存储独立的令牌文件。

### GitHub Token

创建一个具备 `repo` 权限的经典个人访问令牌（Personal Access Token），并将其存储于 `credentials/github_token`。

## 工作流

### 会议准备检查

触发方式：每 15 分钟执行一次的 Cron 任务，或心跳机制。

1. 查询已配置的日历，筛选未来 45 分钟内即将开始的事件  
2. 筛选含 Google Meet 链接的事件（`hangoutLink` 或 `conferenceData`）  
3. 若会议将在 30–45 分钟后开始且尚未通知用户：  
   - 向用户提问：“[会议标题] 将在 X 分钟后开始。您上次更新是什么时候？我应检查哪些仓库？”  
   - 在状态文件中记录，防止重复通知  
4. 若会议将在 10–20 分钟后开始：  
   - 基于提交内容生成更新  
   - 发送格式化后的更新  

### 每日提交摘要

触发方式：每日结束时执行的 Cron 任务。

1. 获取当日所有已配置仓库中的全部提交  
2. 覆盖所有开发人员  
3. 按仓库及子目录分组  
4. 包含提交作者姓名进行格式化  
5. 发送摘要  

## API 参考

### 查询日历

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
LATER=$(date -u -d "+45 minutes" +%Y-%m-%dT%H:%M:%SZ)
TOKEN=$(jq -r '.access_token' credentials/calendar_tokens.json)

curl -s "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=$NOW&timeMax=$LATER&singleEvents=true" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '[.items[] | select(.hangoutLink != null or .conferenceData != null)]'

Refresh Token

CLIENT_ID=$(jq -r '.installed.client_id' credentials/client_secret.json)
CLIENT_SECRET=$(jq -r '.installed.client_secret' credentials/client_secret.json)
REFRESH_TOKEN=$(jq -r '.refresh_token' credentials/calendar_tokens.json)

curl -s -X POST https://oauth2.googleapis.com/token \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "refresh_token=$REFRESH_TOKEN" \
  -d "grant_type=refresh_token"

Fetch Commits

TOKEN=$(cat credentials/github_token)
SINCE=$(date -u -d "-7 days" +%Y-%m-%dT%H:%M:%SZ)

# List org repos
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/orgs/ORG_NAME/repos?per_page=50&sort=pushed"

# Get commits
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/ORG/REPO/commits?since=$SINCE&per_page=30"

Output Format

Plain text, no markdown, no emojis:

Update - [DATE]

[repo-name]

[subdirectory]
• Verbose description of change (Author)
• Another change (Author)

Today
• [user input]

Blockers
• None

Discussion
• None

Formatting Rules

• Group by repo, then subdirectory
• Summarize commits into meaningful descriptions
• Include author names
• Plain text only for easy copy-paste
State Management

Track state in data/meeting-prep-state.json:

{
  "notified": {},
  "config": {
    "repoFilter": "org-name/*"
  }
}
```
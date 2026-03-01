---
name: daily-review
name_zh: 每日回顾
version: 1.0.0
description: 全面的每日绩效复盘，涵盖沟通追踪、会议分析、产出指标与专注时长监控。你的 AI 绩效教练。
description_zh: 全面的每日绩效复盘，涵盖沟通追踪、会议分析、产出指标与专注时长监控。你的 AI 绩效教练。
author: henrino3
tags: [productivity, performance, tracking, review, coach]
---
# 每日复盘 Skill

借助 AI 教练洞察，生成全面的每日绩效复盘报告。

## 功能特性

| 功能 | 数据来源 | 状态 |
|------|----------|------|
| 发送邮件数 | Gmail API | ✅ |
| Slack 消息数 | Slack API | ✅ |
| X.com 提及数 | Bird CLI | ✅ |
| 参与会议数 | Fireflies（经发言人验证） | ✅ |
| Git 提交数 | git log | ✅ |
| 修改文档数 | Google Drive API | ✅ |
| 屏幕使用时长 | macOS knowledgeC.db | ✅ |
| ActivityWatch 记录 | AW API | ✅ |

## 使用方式

```bash
# Run daily review for today
~/clawd/skills/daily-review/scripts/daily-review.sh

# Run for specific date
~/clawd/skills/daily-review/scripts/daily-review.sh 2026-01-15
```

## 示例输出

```
🏆 Daily Performance Review - 2026-01-15
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📬 COMMUNICATION
  • Emails sent: 6
  • Slack messages: 203
  • X.com mentions: 5

📅 MEETINGS (Fireflies - speaker verified)
  • CEO Chat (70 min)
  • Meeting with Perfectos (27 min)
  • US Squad Standup (27 min)
  Total: 3 meetings (~2.0 hrs)

💻 OUTPUT
  • Git commits: 6
  • Docs modified: 20
  • Messages to Ada: 73

⏱️ FOCUS TIME
  Screen Time: 9.7 hrs
  • Atlas: 203min
  • Slack: 163min
  • Telegram: 45min
  
  ActivityWatch: 8.5 hrs
  • Telegram: 120min
  • Ghostty: 90min
  • Chrome: 45min
```

## 前置要求

### API 与服务
- **Gmail**：Google Workspace 服务账号 或 gog OAuth  
- **Slack**：Slack API token（需 user_token 以支持搜索）  
- **Fireflies**：会议转录 API 密钥  
- **Google Drive**：用于文档追踪的服务账号  

### 工具
- **Bird CLI**：用于 X.com/Twitter（需 auth_token + ct0 cookies）  
- **ActivityWatch**：本地运行的应用程序（http://localhost:5600）  

### macOS（屏幕使用时长）
- Mac 设备 SSH 访问权限  
- `get_screentime.py` 脚本（用于 knowledgeC.db 查询）  

## 安装步骤

1. 将 skill 复制到你的 clawd 工作区：  
```bash
cp -r daily-review ~/clawd/skills/
```  

2. 安装依赖项：  
```bash
# Bird CLI (on Mac)
cd ~/Code && git clone https://github.com/steipete/bird.git
cd bird && npm install && npm run build:dist

# ActivityWatch
# Download from https://activitywatch.net/
```  

3. 配置密钥：  
```bash
# Bird (X.com)
cat > ~/clawd/secrets/bird.env << 'EOF'
AUTH_TOKEN=your_auth_token
CT0=your_ct0
EOF

# Fireflies
echo "your_api_key" > ~/clawd/secrets/fireflies.key

# Slack
echo '{"user_token": "xoxp-xxx"}' > ~/clawd/secrets/slack-super-ada.json
```  

4. 添加每日 09:00 的复盘 cron 任务：  
```bash
clawdbot cron add --name "daily-review" --schedule "0 9 * * *"
```  

## 屏幕使用时长查询

该 skill 直接从 `knowledgeC.db` 查询 macOS 屏幕使用时长数据：  

```python
SELECT 
  ZVALUESTRING as app,
  SUM(ZENDDATE - ZSTARTDATE) as seconds
FROM ZOBJECT 
WHERE ZSTREAMNAME = '/app/usage' 
AND date(ZSTARTDATE + 978307200, 'unixepoch') = '2026-01-15'
GROUP BY ZVALUESTRING
ORDER BY seconds DESC
```  

## Fireflies 发言人验证

会议是否计入统计，取决于用户是否实际发言（而不仅是被邀请参会）：  

```graphql
{
  transcripts(limit: 30) {
    title dateString duration
    sentences { speaker_name }
  }
}
```  

仅当 `speaker_name` 中包含用户姓名的会议才被计入。

## 许可协议

MIT
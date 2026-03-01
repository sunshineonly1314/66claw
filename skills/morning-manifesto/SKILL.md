---
name: morning-manifesto
name_zh: 早间宣言
description: 每日晨间反思工作流，支持任务同步至 Obsidian、Apple Reminders 与 Linear
description_zh: 每日晨间反思工作流，支持任务同步至 Obsidian、Apple Reminders 与 Linear
metadata: {"clawdbot":{"emoji":"🌅","trigger":"/morning_manifesto"}}
---
# Morning Manifesto 🌅

触发指令：`/morning_manifesto`

## 工作流

### 1. 发送提示词  
当 `/morning-manifesto` 被触发时，立即发送：  
```
Good morning! 🚀 Please tell me about:
- What you did yesterday?
- One small thing you are grateful for
- Today's adventure
- Tasks and commitments
- How are the weekly priorities going?
```

### 2. 等待用户响应  
等待用户回复（文本或语音）。语音将通过 whisper.cpp 自动转录。

### 3. 解析并追加至 Obsidian 每日笔记  
解析用户响应，并追加至 Obsidian 仓库（🔥 Fires）中的今日笔记（YYYY-MM-DD.md），结构如下：  
```markdown
## Morning Manifesto - [YYYY-MM-DD]

### What I did yesterday
[user's response]

### Grateful for
[user's response]

### Today's adventure
[user's response]

### Tasks and commitments
- [task 1]
- [task 2]

### Weekly priorities status
[user's response]
```

### 4. 同步任务至 Apple Reminders  
对提及的每一项任务/承诺：  
- **若任务已存在**：将其截止日期更新为今日  
- **若为新任务**：创建新的提醒事项，并设截止日期为今日  
- 使用 `apple-reminders` skill 实现此功能  

### 5. 查询 Linear 中的紧急议题  
查询所有团队中优先级为“紧急（1）”的议题。格式如下：  
```
🔴 Urgent Linear Issues:
- [Team] [Issue ID]: [Title]
```

### 6. 发送汇总信息  
发送最终消息，内容包括：  
- 今日所有 Apple Reminders（截止日期为今日）  
- 所有团队中的紧急 Linear 议题  

## 关键细节  
- Obsidian 笔记命名使用今日日期（YYYY-MM-DD.md）  
- Apple Reminders：按截止日期查询；新建提醒时亦设截止日期为今日  
- Linear：使用 `priority = 1` 过滤器，查询全部团队  
- 请特别关注“任务与承诺”部分  
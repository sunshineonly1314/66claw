---
name: meetgeek
name_zh: MeetGeek
description: 通过命令行界面（CLI）查询 MeetGeek 会议智能数据——列出会议、获取 AI 摘要、转录文本、待办事项，并支持使用自然语言跨所有通话进行搜索。
description_zh: 通过命令行界面（CLI）查询 MeetGeek 会议智能数据——列出会议、获取 AI 摘要、转录文本、待办事项，并支持使用自然语言跨所有通话进行搜索。
---
# MeetGeek 技能

从 MeetGeek 获取会议智能数据——包括摘要、转录文本、待办事项，以及跨通话的全文搜索能力。

**npm：** https://www.npmjs.com/package/meetgeek-cli  
**GitHub：** https://github.com/nexty5870/meetgeek-cli

## 安装

```bash
npm install -g meetgeek-cli
```

## 配置

```bash
meetgeek auth   # Interactive API key setup
```

您的 API 密钥请从以下路径获取：MeetGeek → 集成 → 公共 API 集成

## 命令

### 列出近期会议
```bash
meetgeek list
meetgeek list --limit 20
```

### 获取会议详情
```bash
meetgeek show <meeting-id>
```

### 获取 AI 摘要（含待办事项）
```bash
meetgeek summary <meeting-id>
```

### 获取完整转录文本
```bash
meetgeek transcript <meeting-id>
meetgeek transcript <meeting-id> -o /tmp/call.txt  # save to file
```

### 获取重点摘要
```bash
meetgeek highlights <meeting-id>
```

### 搜索会议
```bash
# Search in a specific meeting
meetgeek ask "topic" -m <meeting-id>

# Search across all recent meetings
meetgeek ask "what did we discuss about the budget"
```

### 认证管理
```bash
meetgeek auth --show   # check API key status
meetgeek auth          # interactive setup
meetgeek auth --clear  # remove saved key
```

## 使用模式

### 查找某次特定通话
```bash
# List meetings to find the one you want
meetgeek list --limit 10

# Then use the meeting ID (first 8 chars shown, use full ID)
meetgeek summary 81a6ab96-19e7-44f5-bd2b-594a91d2e44b
```

### 提取某次通话中的待办事项
```bash
meetgeek summary <meeting-id>
# Look for the "✅ Action Items" section
```

### 查找关于某一主题的讨论内容
```bash
# Search across all meetings
meetgeek ask "pricing discussion"

# Or in a specific meeting
meetgeek ask "timeline" -m <meeting-id>
```

### 导出转录文本以供参考
```bash
meetgeek transcript <meeting-id> -o ~/call-transcript.txt
```

## 注意事项

- 会议 ID 为 UUID 格式；列表中仅显示前 8 位字符  
- 转录文本包含发言人姓名及时间戳  
- 摘要由 AI 生成，涵盖关键要点与待办事项  
- 搜索基于关键词，在全部转录文本中进行  

## 配置

API 密钥存储于：`~/.config/meetgeek/config.json`
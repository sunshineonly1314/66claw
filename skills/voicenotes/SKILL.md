---
name: voicenotes
name_zh: 语音笔记
description: 同步并访问来自 Voicenotes.com 的语音笔记。当用户希望检索其在 Voicenotes 平台上的语音录音、转录文本及 AI 摘要时使用。支持获取笔记、同步为 Markdown 文件，以及搜索转录文本。
description_zh: 同步并访问来自 Voicenotes.com 的语音笔记。当用户希望检索其在 Voicenotes 平台上的语音录音、转录文本及 AI 摘要时使用。支持获取笔记、同步为 Markdown 文件，以及搜索转录文本。
---
# Voicenotes 集成

将 [voicenotes.com](https://voicenotes.com) 的语音笔记同步至当前工作区。

## 安装配置

1. 在 https://voicenotes.com/app?obsidian=true#settings 页面获取访问令牌（access token）  
2. 设置环境变量：`export VOICENOTES_TOKEN="your-token-here"`

## 快速开始

```bash
# Verify connection
./scripts/get-user.sh | jq .

# Fetch recent notes (JSON)
./scripts/fetch-notes.sh | jq '.data[:3]'

# Sync all notes to markdown files
./scripts/sync-to-markdown.sh --output-dir ./voicenotes
```

## 脚本说明

### fetch-notes.sh  
以 JSON 格式获取语音笔记。  
```bash
./scripts/fetch-notes.sh                    # All notes
./scripts/fetch-notes.sh --limit 10         # Last 10 notes
./scripts/fetch-notes.sh --since 2024-01-01 # Notes since date
```

### get-user.sh  
验证令牌有效性并获取用户信息。  
```bash
./scripts/get-user.sh | jq '{name, email}'
```

### sync-to-markdown.sh  
将语音笔记同步为带 frontmatter 的 Markdown 文件。  
```bash
./scripts/sync-to-markdown.sh --output-dir ./voicenotes
```

输出格式：  
```markdown
---
voicenotes_id: abc123
created: 2024-01-15T10:30:00Z
tags: [idea, project]
---

# Note Title

## Transcript
The transcribed content...

## Summary
AI-generated summary...
```

## API 参考文档

基础地址（Base URL）：`https://api.voicenotes.com/api/integrations/obsidian-sync`

必需请求头（Headers）：  
- `Authorization: Bearer {token}`  
- `X-API-KEY: {token}`  

接口列表（Endpoints）：  
- `GET /user/info` —— 用户详情  
- `GET /recordings` —— 分页列出语音笔记  
- `GET /recordings/{id}/signed-url` —— 音频下载地址  

## 数据结构

每条语音笔记包含以下字段：  
- `recording_id` —— 唯一标识符  
- `title` —— 笔记标题  
- `transcript` —— 完整转录文本  
- `creations[]` —— AI 生成的摘要、待办事项等  
- `tags[]` —— 用户自定义标签  
- `created_at` / `updated_at` —— 时间戳  
- `duration` —— 录音时长（单位：秒）  

## 使用技巧

- 笔记采用分页返回；请检查 `links.next` 字段判断是否还有更多页面  
- 使用 `--since` 参数可仅拉取自上次同步以来新增的笔记  
- AI 生成内容包括摘要、待办事项及自定义提示词  
- 接口调用频率限制约为每分钟 60 次  
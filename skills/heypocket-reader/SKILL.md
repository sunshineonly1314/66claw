---
name: pocket-transcripts
name_zh: HeyPocket阅读器
description: 读取 Pocket AI（heypocket.com）录音设备的转录稿与摘要。当用户希望检索、搜索或分析其 Pocket 录音、转录稿、摘要或待办事项时使用。当用户请求涉及 Pocket 设备数据、对话转录稿、会议录音或语音笔记检索时触发。
description_zh: 读取 Pocket AI（heypocket.com）录音设备的转录稿与摘要。当用户希望检索、搜索或分析其 Pocket 录音、转录稿、摘要或待办事项时使用。当用户请求涉及 Pocket 设备数据、对话转录稿、会议录音或语音笔记检索时触发。
---
# Pocket 转录稿

通过逆向工程 API 读取 Pocket AI 设备的转录稿与摘要。

## 快速参考

| 函数 | 描述 |
|------|------|
| `get_recordings(days, limit)` | 列出近期录音 |
| `get_recording_full(id)` | 获取转录稿 + 摘要 + 待办事项 |
| `get_transcript(id)` | 获取原始转录稿文本 |
| `get_summarization(id)` | 获取 Markdown 格式摘要 |
| `search_recordings(query)` | 按文本搜索 |

## 设置（一次性）

### 1. 使用用户配置文件启动 Chrome

```bash
~/.factory/skills/browser/start.js --profile
# or
~/.claude/skills/browser/start.js --profile
```

### 2. 登录 Pocket

访问并登录：
```bash
~/.factory/skills/browser/nav.js https://app.heypocket.com
```

### 3. 提取令牌

```bash
python3 scripts/reader.py extract
```

令牌将保存至 `~/.pocket_token.json`，有效期为 1 小时。

## 使用方法

### 列出录音

```python
from pathlib import Path
import sys
sys.path.insert(0, str(Path.home() / '.claude/skills/pocket-transcripts/scripts'))
from reader import get_recordings, get_recording_full

recordings = get_recordings(days=30, limit=20)
for r in recordings:
    print(f"{r.recorded_at:%Y-%m-%d} | {r.duration_str} | {r.title}")
```

### 获取完整转录稿与摘要

```python
full = get_recording_full(recording_id)

print(f"Transcript ({len(full['transcript'])} chars):")
print(full['transcript'][:500])

print(f"\nSummary (markdown):")
print(full['summary'])

print(f"\nAction Items: {len(full['action_items'])}")
for item in full['action_items']:
    print(f"  - {item}")
```

### 搜索录音

```python
results = search_recordings("meeting", days=90)
for r in results:
    print(f"{r.title} - {r.description[:100]}")
```

## API 详情

**基础 URL**：`https://production.heypocketai.com/api/v1`

**认证方式**：从浏览器 IndexedDB 提取的 Firebase Bearer 令牌

**关键端点**：
- `GET /recordings` - 支持分页与筛选的列表
- `GET /recordings/{id}?include=all` - 包含转录稿与摘要的完整数据

**数据结构**：
- 转录稿：`data.transcription.transcription.text`
- 摘要：`data.summarizations[id].v2.summary.markdown`
- 待办事项：`data.summarizations[id].v2.actionItems.items`

## 令牌刷新

Firebase 令牌有效期为 1 小时。过期后请执行以下步骤：

1. 确保 Chrome 正在使用 `--profile` 运行
2. 确认已登录 app.heypocket.com
3. 重新运行：`python3 scripts/reader.py extract`

## 数据模型

### PocketRecording
- `id`、`title`、`description`
- `duration`（单位：秒）、`duration_str`（人类可读格式）
- `recorded_at`、`created_at`
- `has_transcription`、`has_summarization`
- `num_speakers`
- `latitude`、`longitude`（若启用了位置功能）
- `tags`（字符串列表）

### PocketSummarization
- `summary`（Markdown 格式）
- `action_items`（列表）
- `transcript`（原始文本）
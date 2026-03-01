---
name: context-manager
name_zh: 上下文管理
description: 面向 Clawdbot/Moltbot 会话的 AI 驱动上下文管理
description_zh: 面向 Clawdbot/Moltbot 会话的 AI 驱动上下文管理
user-invocable: true
---
# Context Manager Skill

面向 Clawdbot/Moltbot 会话的 AI 驱动上下文管理。利用 agent 自身生成智能摘要，随后以压缩后的上下文重置会话。

## 快速开始

```bash
# List all sessions with usage stats
~/clawd/skills/context-manager/compress.sh list

# Check status of a specific session
~/clawd/skills/context-manager/compress.sh status agent:main:main

# Generate AI summary (read-only, safe)
~/clawd/skills/context-manager/compress.sh summarize agent:main:main

# Compress session: generate summary, reset, inject (DESTRUCTIVE)
~/clawd/skills/context-manager/compress.sh summarize agent:main:main --replace
```

## 适用场景

- 上下文使用率接近 70–80% 及以上时  
- 对话历史较长的会话  
- 会话即将变慢或丧失连贯性之前  
- 主动执行，以维持快速、聚焦的会话体验

## 工作原理

1. **AI 摘要生成**：向 agent 发送提示词，要求其对自身上下文进行摘要  
2. **备份**：将原始 JSONL 会话文件保存至 `memory/compressed/`  
3. **重置**：删除 JSONL 文件（依据 Moltbot 文档规定的官方重置方式）  
4. **注入**：将在 AI 生成的摘要作为首条消息发送至新会话  
5. **结果**：会话密钥（session key）不变，但会话 ID 更新，上下文被压缩  

**关键洞察**：agent 对自身上下文具备完全可见性，因此能生成质量最优的摘要。

## 命令

### 会话命令

| 命令 | 描述 |
|------|------|
| `list` | 列出所有会话及其 token 使用量 |
| `status [KEY]` | 显示指定会话的详细状态 |
| `summarize [KEY]` | 生成 AI 摘要（只读，不重置） |
| `summarize [KEY] --replace` | 摘要生成 + 重置会话 + 注入压缩上下文 |
| `compress [KEY]` | 基于 grep 的传统提取方式（不推荐） |
| `check [KEY]` | 检查会话是否超出阈值 |
| `check-all` | 一次性检查全部会话 |

### 配置命令

| 命令 | 描述 |
|------|------|
| `set-threshold N` | 设置压缩阈值（50–99%，默认为 80） |
| `set-depth LEVEL` | 设置摘要深度：brief / balanced / comprehensive |
| `set-quiet-hours HH` | 设置静默时段（例如："23:00-07:00"） |
| `help` | 显示帮助信息及使用示例 |

## 示例

### 列出全部会话

```bash
$ ~/clawd/skills/context-manager/compress.sh list
📋 Available Sessions (4 total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#    SESSION KEY                              KIND       TOKENS    USAGE
1    agent:main:main                          direct      70188      70%
2    agent:main:slack:channel:c0aaruq2en9     group       20854      20%
3    agent:main:cron:0d02af4b-...             direct      18718      18%
```

### 检查会话状态

```bash
$ ~/clawd/skills/context-manager/compress.sh status agent:main:main
📊 Context Manager Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Session Key: agent:main:main
  Session ID:  fc192a2d-091c-48c7-9fad-12bf34687454
  Kind:        direct
  Model:       gemini-3-flash
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Threshold:   80%
  Tokens:      70188 / 100000
  Usage:       70%
```

### 生成 AI 摘要（安全、只读）

```bash
$ ~/clawd/skills/context-manager/compress.sh summarize agent:main:main
🧠 Requesting AI summary for session: agent:main:main
  Session ID: fc192a2d-091c-48c7-9fad-12bf34687454

✅ AI Summary generated!
  Saved to: memory/compressed/20260127-123146.ai-summary.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### Session Summary: January 27, 2026

#### 1. What was accomplished
- System audit completed
- Essay generation with sub-agents
...
```

### 完整压缩流程（摘要 + 重置 + 注入）

```bash
$ ~/clawd/skills/context-manager/compress.sh summarize agent:main:main --replace
🧠 Requesting AI summary for session: agent:main:main
  Session ID: fc192a2d-091c-48c7-9fad-12bf34687454
  Mode: REPLACE (will reset session after summary)

✅ AI Summary generated!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[AI-generated summary displayed]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 Resetting session and injecting compressed context...
  Backing up session file...
  Backup saved: memory/compressed/20260127-123146.session-backup.jsonl
  Deleting session JSONL to reset...
  Injecting compressed context into fresh session...
✅ Session compressed successfully!
  Old session ID: fc192a2d-091c-48c7-9fad-12bf34687454
  New session ID: a1b2c3d4-...
  Session is ready to continue with compressed context
```

**结果**：70k tokens → 16k tokens（减少 77%）

## 输出文件

执行压缩时，以下文件将在 `memory/compressed/` 中创建：

| 文件 | 描述 |
|------|------|
| `{timestamp}.ai-summary.md` | AI 生成的会话摘要 |
| `{timestamp}.session-backup.jsonl` | 原始会话的完整备份（必要时可恢复） |
| `{timestamp}.transcript.md` | 原始对话记录提取（传统方式） |
| `{timestamp}.summary.md` | 基于 grep 的摘要（传统方式） |

## 依赖要求

- **clawdbot/moltbot** —— 网关必须处于运行状态  
- **jq** —— JSON 解析工具（`brew install jq`）  
- **网关访问权限** —— 脚本使用 `clawdbot agent` 和 `clawdbot sessions`

## 技术细节

### 会话重置方法

脚本采用 JSONL 文件删除方式重置会话（符合 Moltbot 文档中规定的官方方法）：

1. 将 JSONL 文件备份至 `memory/compressed/`  
2. 删除 `~/.clawdbot/agents/{agent}/sessions/{sessionId}.jsonl`  
3. 通过 `clawdbot agent --to main` 发送压缩后的上下文  
4. 系统自动创建新会话，并将摘要作为首条消息

### 为何不使用 `/reset`？

``/reset`` 斜杠命令仅在聊天界面中有效；当通过 `clawdbot agent --session-id` 发送时，它会被视为普通消息，agent 将尝试将其解释为一项任务。

### AI 摘要提示词

脚本要求 agent 提供以下五类信息：  
1. 已完成事项（关键任务）  
2. 关键决策（含决策依据）  
3. 当前状态（上次中断处）  
4. 待办事项（尚需完成的任务）  
5. 重要上下文（需持续记住的关键信息）

## 故障排查

### 摘要文本为空

若 AI 摘要提取失败，请检查 stderr 重定向：  
```bash
# The script uses 2>/dev/null to avoid Node deprecation warnings breaking JSON
clawdbot agent --session-id $ID -m "..." --json 2>/dev/null
```

### 会话未重置

请确认 JSONL 文件路径是否正确：  
```bash
ls ~/.clawdbot/agents/main/sessions/
```

### 从备份恢复

若发生异常：  
```bash
cp memory/compressed/{timestamp}.session-backup.jsonl \
   ~/.clawdbot/agents/main/sessions/{sessionId}.jsonl
```

### 查看日志

使用 `clawdbot logs` 进行问题排查：  
```bash
clawdbot logs --limit 50 --json | grep -i "error\|fail"
```

## 最佳实践

1. **先备份**：脚本会自动备份，但您也可在测试前手动备份  
2. **优先在非关键会话中测试**：建议先在 Slack 频道或 cron 会话中试用，再用于主会话  
3. **检查摘要质量**：先运行 `summarize`（不带 `--replace`），验证摘要是否符合预期  
4. **监控 token 数量**：使用 `status` 确认压缩是否生效  

## 参见

- [Moltbot 会话管理](https://docs.molt.bot/concepts/session)  
- [Moltbot 压缩机制](https://docs.molt.bot/concepts/compaction)  
- `clawdbot sessions --help`  
- `clawdbot agent --help`
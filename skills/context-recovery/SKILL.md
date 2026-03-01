---
name: context-recovery
description: 在会话压缩后或当隐含继续但上下文缺失时，自动恢复工作上下文。适用于 Discord、Slack、Telegram、Signal 及其他支持的渠道。
description_zh: 在会话压缩后或当隐含继续但上下文缺失时，自动恢复工作上下文。适用于 Discord、Slack、Telegram、Signal 及其他支持的渠道。
---
# Context Recovery Skill

在会话压缩后或当隐含继续但上下文缺失时，自动恢复工作上下文。适用于 Discord、Slack、Telegram、Signal 及其他支持的渠道。

## 触发条件

### 自动触发
- 会话以 `<summary>` 标签开始（检测到压缩）
- 用户消息包含压缩指示词："Summary unavailable"、"context limits"、"truncated"

### 手动触发
- 用户说 "continue"、"did this happen?"、"where were we?"、"what was I working on?"
- 用户引用 "the project"、"the PR"、"the branch"、"the issue" 但未指明具体是哪个
- 用户暗示存在先前的工作但上下文不清楚
- 用户问 "do you remember...?" 或 "we were working on..."

## 执行协议

### 步骤 1：检测活动渠道

从运行时上下文提取：
- `channel` — discord | slack | telegram | signal 等
- `channelId` — 具体的渠道/对话 ID
- `threadId` — 用于线程对话（Slack、Discord 线程）

### 步骤 2：获取渠道历史（自适应深度）

**初始获取：**
```
message:read
  channel: <detected-channel>
  channelId: <detected-channel-id>
  limit: 50
```

**自适应扩展逻辑：**
1. 解析返回消息的时间戳
2. 计算时间跨度：`newest_timestamp - oldest_timestamp`
3. 如果时间跨度 < 2 小时且消息数 == limit：
   - 获取额外 50 条消息（如果支持，使用 `before` 参数）
   - 重复直到时间跨度 ≥ 2 小时或总消息数 ≥ 100
4. 硬性上限：最多 100 条消息（token 预算限制）

**线程感知恢复（Slack/Discord）：**
```
# If threadId is present, fetch thread messages first
message:read
  channel: <detected-channel>
  threadId: <thread-id>
  limit: 50

# Then fetch parent channel for broader context
message:read
  channel: <detected-channel>
  channelId: <parent-channel-id>
  limit: 30
```

**解析内容：**
- 最近的用户请求（请求了什么）
- 最近的 agent 响应（做了什么）
- URL、文件路径、分支名称、PR 编号
- 未完成的操作（承诺但未履行的）
- 项目标识符和工作目录

### 步骤 3：获取会话日志（如果可用）

```bash
# Find most recent session files for this agent
SESSION_DIR=$(ls -d ~/.clawdbot-*/agents/*/sessions 2>/dev/null | head -1)
SESSIONS=$(ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -3)

for SESSION in $SESSIONS; do
  echo "=== Session: $SESSION ==="
  
  # Extract user requests
  jq -r 'select(.message.role == "user") | .message.content[0].text // empty' "$SESSION" | tail -20
  
  # Extract assistant actions (look for tool calls and responses)
  jq -r 'select(.message.role == "assistant") | .message.content[]? | select(.type == "text") | .text // empty' "$SESSION" | tail -50
done
```

### 步骤 4：检查共享记忆

```bash
# Extract keywords from channel history (project names, PR numbers, branch names)
# Search memory for relevant entries
grep -ri "<keyword>" ~/clawd-*/memory/ 2>/dev/null | head -10

# Check for recent daily logs
ls -t ~/clawd-*/memory/202*.md 2>/dev/null | head -3 | xargs grep -l "<keyword>" 2>/dev/null
```

### 步骤 5：合成上下文

编译结构化摘要：

```markdown
## Recovered Context

**Channel:** #<channel-name> (<platform>)
**Time Range:** <oldest-message> to <newest-message>
**Messages Analyzed:** <count>

### Active Project/Task
- **Repository:** <repo-name>
- **Branch:** <branch-name>
- **PR:** #<number> — <title>

### Recent Work Timeline
1. [<timestamp>] <action/request>
2. [<timestamp>] <action/request>
3. [<timestamp>] <action/request>

### Pending/Incomplete Actions
- ⏳ "<quoted incomplete action>"
- ⏳ "<another incomplete item>"

### Key References
| Type | Value |
|------|-------|
| PR | #<number> |
| Branch | <name> |
| Files | <paths> |
| URLs | <links> |

### Last User Request
> "<quoted request that may not have been completed>"

### Confidence Level
- Channel context: <high/medium/low>
- Session logs: <available/partial/unavailable>
- Memory entries: <found/none>
```

### 步骤 6：缓存恢复的上下文

**持久化到记忆以便将来引用：**

```bash
# Write to daily memory file
MEMORY_FILE=~/clawd-*/memory/$(date +%Y-%m-%d).md

cat >> "$MEMORY_FILE" << EOF

## Context Recovery — $(date +%H:%M)

**Channel:** #<channel-name>
**Recovered context for:** <project/task summary>

### Key State
- <bullet points of critical context>

### Pending Items
- <incomplete actions>

EOF
```

这确保上下文在未来的压缩中仍然存在。

### 步骤 7：响应并提供上下文

呈现恢复的上下文，然后提示：

> "Context recovered. Your last request was [X]. This action [completed/did not complete]. Shall I [continue/retry/clarify]?"

## 渠道特定说明

### Discord
- 使用传入消息元数据中的 `channelId`
- 公会渠道有完整的历史访问权限
- 线程恢复：检查消息元数据中的 `threadId`
- DM 可能有有限的历史记录

### Slack
- 使用带 Slack 渠道 ID 的 `channel` 参数
- 线程上下文需要 `threadId` — 始终先检查线程上下文
- 父渠道获取提供周围对话上下文
- 可能需要工作区级别权限才能获取完整历史

### Telegram / Signal / 其他
- 相同的 `message:read` 接口
- 历史深度可能因平台而异
- 群组与 DM 上下文可能不同

## 约束条件

- **强制性：** 在回复"数据不足"或在上下文似乎缺失时提出澄清问题之前，执行此协议
- 自适应深度：从 50 开始，最多扩展到 100
- 基于时间的目标：尽可能捕获至少 2 小时的上下文
- 会话日志提取：最多最后 3 个会话文件
- 记忆缓存：追加到每日文件，不要覆盖
- 如果恢复失败，说明尝试了什么以及哪些数据源不可用

## 自动触发检测

在会话开始时，扫描压缩指示器：

```python
# Pseudocode for trigger detection
if message contains "<summary>":
    trigger_context_recovery()
elif message contains any of ["Summary unavailable", "context limits", "truncated", "compacted"]:
    trigger_context_recovery()
elif message matches continuation_patterns:
    # "continue", "where were we", "did this happen", etc.
    trigger_context_recovery()
```

**不要等待用户请求** — 如果检测到压缩，主动恢复并呈现上下文。

## 调用示例

**场景：** 会话以压缩摘要开始

```
User message: "<summary>Summary unavailable due to context limits...</summary>"
User message: "did this happen?"
```

**Agent 执行：**
1. 通过 `<summary>` 标签检测到压缩
2. `message:read channel=discord channelId=1460342116516364533 limit=50`
3. 计算时间跨度：2.5 小时 — 足够，无需扩展
4. 解析消息，找到最后操作："Now let me extract the key orchestration decisions..."
5. 检查会话日志 — 当前会话不可用
6. 将上下文摘要写入 `memory/2026-01-25.md`
7. 响应：

> "Context recovered. Your last request was to extract orchestration decisions from Nexus archived sessions for PR #137 (Skills & Agents System). This action did not complete before context was truncated.
>
> **Recovered state:**
> - PR #137: 15,053 additions, 91 files, CONFLICTING merge state
> - Spec location: `content/spec-skills-agents-system.md` (2,067 lines)
> - Nexus sessions: `~/.clawdbot-duke-leto/archive/nexus-sessions/` (96 files)
>
> Shall I proceed with the extraction?"

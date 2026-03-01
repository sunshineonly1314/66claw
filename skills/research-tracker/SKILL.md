---
name: research-tracker
name_zh: 研究追踪器
description: 使用基于 SQLite 的状态跟踪来管理自主 AI 研究 agent。适用于启动长期运行的研究子 agent、追踪多步骤调查、协调 agent 交接，或监控后台工作。触发场景包括：研究项目、子 agent 协调、自主调查、进度追踪、agent 监督。
description_zh: 使用基于 SQLite 的状态跟踪来管理自主 AI 研究 agent。适用于启动长期运行的研究子 agent、追踪多步骤调查、协调 agent 交接，或监控后台工作。触发场景包括：研究项目、子 agent 协调、自主调查、进度追踪、agent 监督。
---
# 研究追踪器（Research Tracker）

一款命令行工具，用于管理具备仅追加（append-only）状态、指令队列与监督能力的自主研究 agent。

## 前置条件

```bash
brew tap 1645labs/tap
brew install julians-research-tracker
```

或：`go install github.com/1645labs/julians-research-tracker/cmd/research@latest`

## 快速入门

### 启动一项研究项目  
```bash
research init market-q1 --name "Q1 Market Analysis" --objective "Analyze competitor pricing and positioning"
```

### 作为研究 agent —— 记录进展  
```bash
export RESEARCH_SESSION_ID="$SESSION_KEY"  # Track which agent is writing

research log market-q1 STEP_BEGIN --step 1 --payload '{"task":"gather sources"}'
# ... do work ...
research log market-q1 STEP_COMPLETE --step 1
research heartbeat market-q1
```

### 检查状态（来自主会话或心跳信号）  
```bash
research status market-q1 --json
research context market-q1 --last 5  # Truncated context for prompts
```

### 向正在运行的 agent 发送指令  
```bash
research instruct market-q1 "Focus on enterprise segment" --priority URGENT
research stop-signal market-q1  # Request graceful stop
```

### Agent 检查是否有待处理指令  
```bash
research pending market-q1 --json
research ack market-q1 --all  # Acknowledge after processing
research check-stop market-q1  # Exit 0 = stop, Exit 1 = continue
```

## 命令参考

| 命令 | 用途 |
|------|------|
| `init <id> -o "..."` | 创建含目标描述的项目 |
| `list [--status active\|done\|all]` | 列出所有项目（含 `needs_attention` 标志） |
| `show <id>` | 项目详情 + 最近事件 |
| `stop <id>` | 停止项目，并发送 STOP 指令 |
| `archive <id>` | 存档已完成项目 |
| `log <id> <event> [--step N]` | 记录事件（如 STEP_BEGIN、CHECKPOINT、BLOCKED 等） |
| `heartbeat <id>` | 更新活跃时间戳 |
| `block <id> --reason "..."` | 标记为阻塞状态，需人工输入 |
| `complete <id>` | 标记为完成 |
| `status <id> [--json]` | 当前状态摘要 |
| `context <id> [--last N]` | 供 agent 提示词使用的截断上下文 |
| `instruct <id> "text"` | 发送指令 |
| `pending <id>` | 列出未确认（unacked）的指令 |
| `ack <id> [--all]` | 确认已接收指令 |
| `check-stop <id>` | 退出码：0=停止，1=继续 |
| `audit <id> --verdict pass\|drift` | 记录审计结果 |

## 事件类型

`STARTED`、`STEP_BEGIN`、`STEP_COMPLETE`、`CHECKPOINT`、`BLOCKED`、`UNBLOCKED`、`AUDIT_PASS`、`AUDIT_DRIFT`、`HEARTBEAT`、`DONE`、`STOPPED`、`TIMEOUT`

## 集成模式

### 启动一个研究 agent

```
1. research init <project> --objective "..."
2. sessions_spawn with task including:
   - Project ID and objective
   - Instructions to use research CLI for state
   - Check stop signal before each step
   - Log progress with heartbeat
3. Heartbeat monitors: research list --json | check needs_attention
4. Send instructions via: research instruct <project> "..."
```

### Agent 循环（在已启动的 agent 内）

```bash
while research check-stop $PROJECT; [ $? -eq 1 ]; do
  research pending $PROJECT --json  # Check instructions
  research log $PROJECT STEP_BEGIN --step $STEP
  # ... do work ...
  research log $PROJECT STEP_COMPLETE --step $STEP
  research heartbeat $PROJECT
  STEP=$((STEP + 1))
done
research complete $PROJECT
```

## 注意力检测（Attention Detection）

`research list --json` 包含 `needs_attention: true` 的情形如下：
- 最近一次事件为 BLOCKED  
- 存在未确认的 URGENT 或 STOP 指令  
- 心跳信号过期（距上一次 HEARTBEAT 事件已超 5 分钟）  
- 上一次审计结果为 AUDIT_DRIFT  

## 数据库

SQLite 数据库位于 `~/.config/research-tracker/research.db`（启用 WAL 模式，事件仅追加）。

安装后请运行 `research db migrate`。首次使用时，数据库 Schema 将自动迁移。
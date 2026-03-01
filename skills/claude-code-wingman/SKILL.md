---
name: claude-code-wingman
name_zh: Claude代码助手
description: 您的 Claude Code 助手 —— 跨多个项目协调多个 Claude Code 会话，并统一通过 WhatsApp 监控所有会话
description_zh: 您的 Claude Code 助手 —— 跨多个项目协调多个 Claude Code 会话，并统一通过 WhatsApp 监控所有会话
metadata: {"clawdbot":{"emoji":"🦅","requires":{"anyBins":["claude","tmux"]}}}
---
# Claude Code Wingman

您的多会话协调器 —— 同时管理多个在不同项目中并行工作的 Claude Code 实例，全部通过 WhatsApp 进行管控。

**GitHub 地址：** https://github.com/yossiovadia/claude-code-orchestrator

## ⚡ 关键提醒：优先处理审批命令

**当用户消息匹配以下任一模式时，请立即执行对应命令：**

| 用户消息模式 | 需执行的命令 |
|--------------|--------------|
| `approve <session>` | `~/code/claude-code-orchestrator/lib/handle-approval.sh approve <session>` |
| `always <session>` | `~/code/claude-code-orchestrator/lib/handle-approval.sh always <session>` |
| `deny <session>` | `~/code/claude-code-orchestrator/lib/handle-approval.sh deny <session>` |

**示例：**  
- 用户：“approve vsr-bugfix” → 执行：`~/code/claude-code-orchestrator/lib/handle-approval.sh approve vsr-bugfix`  
- 用户：“always heartbeat-test” → 执行：`~/code/claude-code-orchestrator/lib/handle-approval.sh always heartbeat-test`  
- 用户：“deny proxy-refactor” → 执行：`~/code/claude-code-orchestrator/lib/handle-approval.sh deny proxy-refactor`  

**执行完毕后，请返回该命令的输出结果**（例如：“✓ 会话 'vsr-bugfix' 已批准（一次性）”）

**为何至关重要：** 主监控守护进程会在 Claude Code 会话需要审批时，向 WhatsApp 发送通知。用户通过手机回复上述命令。快速响应 = 会话不被阻塞。

### 快速状态查询命令

| 用户消息 | 需执行的命令 |
|----------|--------------|
| `sessions` 或 `status` | `~/code/claude-code-orchestrator/lib/session-status.sh --all --json` |
| `status <session>` | `~/code/claude-code-orchestrator/lib/session-status.sh <session> --json` |

解析 JSON 输出，并以人类可读方式汇总反馈。

---

## 功能说明

并行协调多个 Claude Code 会话，每个会话在各自目录中处理不同任务。您可通过 WhatsApp/聊天界面远程监控与控制全部流程。

**愿景目标：**  
- **多个 tmux 会话** 同时运行  
- **每个会话 = 一个独立的 Claude Code 实例**，位于专属目录中  
- **不同任务并行进行**（如 VSR 问题修复、Clawdbot 认证功能开发、代理层重构）  
- **您通过 Clawdbot（即本助手）统一调度**，全程基于 WhatsApp  
- **实时仪表盘** 展示所有活跃会话及其状态  

## 🎯 真实场景示例：多会话协同

**上午 —— 您（通过 WhatsApp）：** “开始处理 VSR 问题 #1131、Clawdbot 认证功能，以及代理层重构”

**Clawdbot 启动 3 个会话：**  
```
✅ Session: vsr-issue-1131     (~/code/semantic-router)
✅ Session: clawdbot-auth      (~/code/clawdbot)
✅ Session: proxy-refactor     (~/code/claude-code-proxy)
```  

**午休期间 —— 您：** “展示仪表盘”

**Clawdbot 返回：**  
```
┌─────────────────────────────────────────────────────────┐
│ Active Claude Code Sessions                             │
├─────────────────┬──────────────────────┬────────────────┤
│ vsr-issue-1131  │ semantic-router      │ ✅ Working     │
│ clawdbot-auth   │ clawdbot             │ ✅ Working     │
│ proxy-refactor  │ claude-code-proxy    │ ⏳ Waiting approval │
└─────────────────┴──────────────────────┴────────────────┘
```  

**您：** “VSR 问题进展如何？”

**Clawdbot 捕获会话输出：**  
“即将完成 —— 已修复 schema 校验 bug，正在运行测试。10 个测试中已通过 8 个。”

**您：** “让 proxy-refactor 接着运行测试”

**Clawdbot 向该特定会话发送指令。**

**结果：** 3 项并行任务，全程通过手机远程掌控。🎯

## 安装方法

### 通过 Clawdbot 安装（推荐）

```bash
clawdbot skill install claude-code-wingman
```  

或访问：https://clawdhub.com/skills/claude-code-wingman

### 手动安装

```bash
cd ~/code
git clone https://github.com/yossiovadia/claude-code-orchestrator.git
cd claude-code-orchestrator
chmod +x *.sh lib/*.sh
```  

### 依赖要求

- `claude` CLI（Claude Code）  
- `tmux`（终端复用器）  
- `jq`（JSON 处理工具）  

## 核心理念：始终使用 Wingman 脚本

**关键提醒：** 与 Claude Code 会话交互时，**务必始终使用 wingman 脚本（`claude-wingman.sh`）**，切勿直接运行原始 tmux 命令。

**原因：**  
- ✅ 确保正确处理回车键（C-m）  
- ✅ 统一会话管理逻辑  
- ✅ 为未来仪表盘/追踪功能预留兼容性  
- ✅ 避免手动运行 tmux 命令引发的各类 Bug  

**错误做法（切勿执行）：**  
```bash
tmux send-keys -t my-session "Run tests"
# ^ Might forget C-m, won't be tracked in dashboard
```  

**正确做法（务必执行）：**  
```bash
~/code/claude-code-orchestrator/claude-wingman.sh \
  --session my-session \
  --workdir ~/code/myproject \
  --prompt "Run tests"
```  

---

## 从 Clawdbot 发起的使用方式

### 启动新会话

当用户提出编码需求时，启动 Claude Code：

```bash
~/code/claude-code-orchestrator/claude-wingman.sh \
  --session <session-name> \
  --workdir <project-directory> \
  --prompt "<task description>"
```  

### 向已有会话发送指令

向正在运行的会话提交新任务：

```bash
~/code/claude-code-orchestrator/claude-wingman.sh \
  --session <existing-session-name> \
  --workdir <same-directory> \
  --prompt "<new task>"
```  

**注意：** 该脚本会先检测会话是否存在，若存在则直接向其发送指令，避免重复创建。

### 查询会话状态

```bash
tmux capture-pane -t <session-name> -p -S -50
```  

解析输出以判断 Claude Code 当前状态：  
- **工作中**（显示工具调用/进度）  
- **空闲中**（显示命令提示符）  
- **错误状态**（显示报错信息）  
- **等待审批中**（显示 “Allow this tool call?”）  

---

## 示例交互模式

**用户：** “修复 api.py 中的 bug”

**Clawdbot：**  
```
Spawning Claude Code session for this...

[Runs wingman script]

✅ Session started: vsr-bug-fix
📂 Directory: ~/code/semantic-router
🎯 Task: Fix bug in api.py
```  

**用户：** “当前状态如何？”

**Clawdbot：**  
```bash
tmux capture-pane -t vsr-bug-fix -p -S -50
```  

随后总结：“Claude Code 正在运行测试，10 个测试中已通过 8 个。”

**用户：** “让它提交变更”

**Clawdbot：**  
```bash
~/code/claude-code-orchestrator/claude-wingman.sh \
  --session vsr-bug-fix \
  --workdir ~/code/semantic-router \
  --prompt "Commit the changes with a descriptive message"
```  

## 命令参考

### 启动新会话  
```bash
~/code/claude-code-orchestrator/claude-wingman.sh \
  --session <name> \
  --workdir <dir> \
  --prompt "<task>"
```  

### 向已有会话发送指令  
```bash
~/code/claude-code-orchestrator/claude-wingman.sh \
  --session <existing-session> \
  --workdir <same-dir> \
  --prompt "<new command>"
```  

### 监控会话进度  
```bash
tmux capture-pane -t <session-name> -p -S -100
```  

### 列出所有活跃会话  
```bash
tmux ls
```  

筛选出 Claude Code 会话：  
```bash
tmux ls | grep -E "(vsr|clawdbot|proxy|claude)"
```  

### 查看自动审批器日志（如需排查）  
```bash
cat /tmp/auto-approver-<session-name>.log
```  

### 任务完成后终止会话  
```bash
tmux kill-session -t <session-name>
```  

### 手动附加（供用户使用）  
```bash
tmux attach -t <session-name>
# Detach: Ctrl+B, then D
```  

---

## 路线图：多会话仪表盘（即将上线）

**计划功能：**

### `wingman dashboard`  
展示所有活跃的 Claude Code 会话：  
```
┌─────────────────────────────────────────────────────────┐
│ Active Claude Code Sessions                             │
├─────────────────┬──────────────────────┬────────────────┤
│ Session         │ Directory            │ Status         │
├─────────────────┼──────────────────────┼────────────────┤
│ vsr-issue-1131  │ ~/code/semantic-...  │ ✅ Working     │
│ clawdbot-feat   │ ~/code/clawdbot      │ ⏳ Waiting approval │
│ proxy-refactor  │ ~/code/claude-co...  │ ❌ Error       │
└─────────────────┴──────────────────────┴────────────────┘

Total: 3 sessions | Working: 1 | Waiting: 1 | Error: 1
```  

### `wingman status <session>`  
展示指定会话的详细状态：  
```
Session: vsr-issue-1131
Directory: ~/code/semantic-router
Started: 2h 15m ago
Last activity: 30s ago
Status: ✅ Working
Current task: Running pytest tests
Progress: 8/10 tests passing
```  

### 会话注册中心  
- 持久化追踪（Clawdbot 重启后仍保留）  
- 使用 JSON 文件存储会话元数据  
- 自动清理失效会话  

**当前阶段：** 可直接使用 tmux 命令，但发送指令时**务必始终通过 wingman 脚本**！

## 工作流程

1. **用户提出编码需求**（修复 bug、添加功能、重构代码等）  
2. **Clawdbot 通过协调脚本启动 Claude Code**  
3. **自动审批器在后台处理权限请求**  
4. **Clawdbot 持续监控并汇报进展**  
5. **用户可随时附加**，直接查看或接管控制  
6. **Claude Code 自主完成工作** ✅  

## 信任提示（仅首次运行时出现）

在新目录中首次运行时，Claude Code 会询问：  
> "Do you trust the files in this folder?"  

**首次运行：** 用户必须附加并手动批准（按 Enter 键）。此后即自动完成。

**处理方式：**  
```
User, Claude Code needs you to approve the folder trust (one-time). Please run:
tmux attach -t <session-name>

Press Enter to approve, then Ctrl+B followed by D to detach.
```  

## 最佳实践

### 何时使用协调器

✅ **建议使用协调器的场景：**  
- 大规模代码生成/重构  
- 跨多文件修改  
- 长时间运行的任务  
- 重复性编码工作  

❌ **不建议使用协调器的场景：**  
- 快速读取文件  
- 简单编辑  
- 需要对话交互的场景  
- 规划/设计类讨论  

### 会话命名规范

请使用具有描述性的名称：  
- `vsr-issue-1131` —— 针对具体问题的工作  
- `vsr-feature-auth` —— 功能开发  
- `project-bugfix-X` —— Bug 修复  

## 故障排查

### 提示未提交成功  
协调器会带延迟地发送两次 Enter 键。若卡住，用户可手动附加并按 Enter 键。

### 自动审批器未生效  
检查日志：`cat /tmp/auto-approver-<session-name>.log`  

应看到类似：“Approval prompt detected! Navigating to option 2...”

### 会话已存在  
请终止它：`tmux kill-session -t <name>`  

## 高级功能：更新记忆

任务成功完成后，请更新 `TOOLS.md`：  

```markdown
### Recent Claude Code Sessions
- 2026-01-26: VSR AWS check - verified vLLM server running ✅
- Session pattern: vsr-* for semantic-router work
```  

## 专业技巧

- **并行会话：** 在不同会话中同时运行多项任务  
- **命名一致性：** 使用项目前缀（如 vsr-、myapp- 等）  
- **定期监控：** 每隔几分钟检查一次进展  
- **耐心等待：** 不要过早终止会话，让 Claude Code 完成全部工作  

---

## 🔔 审批处理（WhatsApp 集成）

主监控守护进程会在会话需要审批时，向 WhatsApp 发送通知。请使用以下命令响应：

### 审批命令（来自 WhatsApp）

收到审批通知后，请回复：

**Clawdbot 将解析您的消息并执行：**  
```bash
# Approve once
~/code/claude-code-orchestrator/lib/handle-approval.sh approve <session-name>

# Approve all similar (always)
~/code/claude-code-orchestrator/lib/handle-approval.sh always <session-name>

# Deny
~/code/claude-code-orchestrator/lib/handle-approval.sh deny <session-name>
```  

### WhatsApp 交互示例

**收到通知：**  
```
🔒 Session 'vsr-bugfix' needs approval

Bash(rm -rf ./build && npm run build)

Reply with:
• approve vsr-bugfix - Allow once
• always vsr-bugfix - Allow all similar
• deny vsr-bugfix - Reject
```  

**您回复：** “approve vsr-bugfix”

**Clawdbot 执行：**  
```bash
~/code/claude-code-orchestrator/lib/handle-approval.sh approve vsr-bugfix
```  

**返回：** “✓ 会话 'vsr-bugfix' 已批准（一次性）”

### 启动监控守护进程

```bash
# Start monitoring all sessions (reads config from ~/.clawdbot/clawdbot.json)
~/code/claude-code-orchestrator/master-monitor.sh &

# With custom intervals
~/code/claude-code-orchestrator/master-monitor.sh --poll-interval 5 --reminder-interval 120 &

# Check if running
cat /tmp/claude-orchestrator/master-monitor.pid

# View logs
tail -f /tmp/claude-orchestrator/master-monitor.log

# Stop the daemon
kill $(cat /tmp/claude-orchestrator/master-monitor.pid)
```  

无需设置环境变量 —— 手机号与 webhook token 均从 Clawdbot 配置中读取。
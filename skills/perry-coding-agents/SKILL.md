---
name: perry-coding-agents
name_zh: Perry 编码代理
description: 将编码任务分派至 Perry 工作区中的 OpenCode 或 Claude Code。适用于开发工作、PR 审查，或任何需要隔离环境的编码任务。
description_zh: 将编码任务分派至 Perry 工作区中的 OpenCode 或 Claude Code。适用于开发工作、PR 审查，或任何需要隔离环境的编码任务。
metadata: {"clawdbot":{"emoji":"🛠️"}}
---
# Perry 编码 agents

将任务分派至 Perry 工作区中的 OpenCode/Claude Code。

## 规则
- **必须首先创建 dex 任务** —— 任何分派操作前均须如此，无例外
- **无硬性超时限制** —— 后台异步分派，允许 agent 运行
- **使用 IP 地址** —— 容器内 MagicDNS 不可用（`tailscale status` 用于获取 IP）
- **每个 PR 对应一个任务** —— 同一会话持续运行直至完成
- **复用会话** —— OpenCode 在 `~/.opencode/` 中维持上下文
- **禁止直接编码** —— 所有编码任务必须分派至 agents

## 命令
```bash
# OpenCode (primary)
ssh -o StrictHostKeyChecking=no workspace@<IP> "cd ~/<project> && /home/workspace/.opencode/bin/opencode run 'task'" &

# Claude Code (needs TTY)
ssh -t workspace@<IP> "cd ~/<project> && /home/workspace/.local/bin/claude 'task'"
```

## 分派模式
```bash
WAKE_IP=$(tailscale status --self --json | jq -r '.Self.TailscaleIPs[0]')

ssh -o StrictHostKeyChecking=no workspace@<IP> "cd ~/<project> && /home/workspace/.opencode/bin/opencode run 'Your task.

When done: curl -X POST http://${WAKE_IP}:18789/hooks/wake -H \"Content-Type: application/json\" -H \"Authorization: Bearer <hooks-token>\" -d \"{\\\"text\\\": \\\"Done: summary\\\", \\\"mode\\\": \\\"now\\\"}\"
'" &
```

## 任务追踪
分派前须先创建任务，内容包括：工作区 IP、分支、目标、完成标准。  
同一任务持续至 CI 通过为止。完成后需附结果摘要。

## 示例：完整 PR 流程

```bash
# 1. Create task
# Track: workspace feat1 (100.109.173.45), branch feat/auth, goal: add auth

# 2. Get wake info
WAKE_IP=$(tailscale status --self --json | jq -r '.Self.TailscaleIPs[0]')

# 3. Dispatch (background, no timeout)
ssh -o StrictHostKeyChecking=no workspace@100.109.173.45 "cd ~/perry && /home/workspace/.opencode/bin/opencode run 'Add bearer token auth to all API endpoints. Create PR when done.

When finished: curl -X POST http://${WAKE_IP}:18789/hooks/wake -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d \"{\\\"text\\\": \\\"Done: Auth PR created\\\", \\\"mode\\\": \\\"now\\\"}\"
'" &

# 4. Wake received → check CI
ssh workspace@100.109.173.45 "cd ~/perry && gh pr checks 145"

# 5. CI fails → dispatch follow-up (same task, agent has context)
ssh -o StrictHostKeyChecking=no workspace@100.109.173.45 "cd ~/perry && /home/workspace/.opencode/bin/opencode run 'CI failing: test/auth.test.ts line 42. Fix and push.

When fixed: curl -X POST http://${WAKE_IP}:18789/hooks/wake ...'" &

# 6. CI green → complete task with result
```

## 故障排查
- **无法连接**：`tailscale status | grep <name>`
- **命令未找到**：使用完整路径（`/home/workspace/.opencode/bin/opencode`）
- **唤醒未触发**：检查 IP/令牌，用 curl 测试
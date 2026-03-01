---
name: dex
name_zh: DEX
description: 面向异步/多步骤工作的任务追踪工具。使用 dex 创建、追踪并完成跨越多个会话或需多方协调的任务（例如：编码 agent 分发、PR 审查、后台作业）。所有任务以 JSON 文件形式存储于 .dex/tasks/ 目录中。
description_zh: 面向异步/多步骤工作的任务追踪工具。使用 dex 创建、追踪并完成跨越多个会话或需多方协调的任务（例如：编码 agent 分发、PR 审查、后台作业）。所有任务以 JSON 文件形式存储于 .dex/tasks/ 目录中。
---
# Dex 任务追踪

追踪异步工作：编码 agent 分发、多步骤项目、任何需后续跟进的事务。

## 命令
```bash
dex create -d "Description" --context "Background, goal, done-when"
dex list                    # Pending tasks
dex list --all              # Include completed
dex show <id>               # View task
dex show <id> --full        # Full context
dex complete <id> --result "What was done, decisions, follow-ups"
dex edit <id> --context "Updated context"
dex delete <id>
```

## 任务结构
- **描述（Description）**：一句话概括任务目标  
- **上下文（Context）**：背景信息、前置条件、完成标准  
- **结果（Result）**：最终产出、关键决策、待办事项  

## 示例
```bash
# Before dispatching agent
dex create -d "Add caching to API" --context "Workspace: feat1 (100.x.x.x)
Branch: feat/cache
Done when: PR merged, CI green"

# After work complete
dex complete abc123 --result "Merged PR #50. Redis caching with 5min TTL."
```

## 存储方式
`.dex/tasks/{id}.json` —— 每项任务对应一个独立 JSON 文件，天然适配 Git 版本控制。
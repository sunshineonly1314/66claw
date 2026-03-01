---
name: ralph-loop
name_zh: Ralph循环
description: 为 Ralph Wiggum/AI agent 循环（Codex、Claude Code、OpenCode、Goose）生成可复制粘贴的 Bash 脚本。当用户要求“Ralph 循环”、“Ralph Wiggum 循环”，或要求使用 PROMPT.md + AGENTS.md、SPECS 和 IMPLEMENTATION_PLAN.md 实现 AI 编程循环（含 PLANNING 与 BUILDING 模式、背压机制、沙箱隔离及完成条件）时使用。
description_zh: 为 Ralph Wiggum/AI agent 循环（Codex、Claude Code、OpenCode、Goose）生成可复制粘贴的 Bash 脚本。当用户要求“Ralph 循环”、“Ralph Wiggum 循环”，或要求使用 PROMPT.md + AGENTS.md、SPECS 和 IMPLEMENTATION_PLAN.md 实现 AI 编程循环（含 PLANNING 与 BUILDING 模式、背压机制、沙箱隔离及完成条件）时使用。
---
# Ralph 循环

## 概述
生成一个可直接运行的 Bash 脚本，在其中循环执行 AI 编程 CLI。该脚本需符合 Ralph 方法论流程：

1) **定义需求** → JTBD（用户真正要达成的目标）→ 关注主题 → `specs/*.md`  
2) **PLANNING 循环** → 创建/更新 `IMPLEMENTATION_PLAN.md`（不执行实现）  
3) **BUILDING 循环** → 实施任务、运行测试（含背压）、更新计划、提交代码  

循环通过 `PROMPT.md` + `AGENTS.md`（每次迭代均加载）以及磁盘上的计划/规格文档持续维护上下文。

## 工作流

### 1) 收集输入（缺失时主动询问）
- **目标 / JTBD**（所需达成的结果）  
- CLI 工具（`codex`、`claude-code`、`opencode`、`goose` 或其他）  
- **模式**：`PLANNING`、`BUILDING` 或 `BOTH`  
- **完成条件**  
  - 承诺短语（用于检测的字符串），**或**  
  - 每次迭代需运行的测试/命令，**或**  
  - 计划哨兵（例如 `STATUS: COMPLETE` 出现在 `IMPLEMENTATION_PLAN.md` 中的一行）  
- 最大迭代次数  
- 沙箱选择（`none` | `docker` | 其他）+ **安全策略**  
- **背压命令**（测试/检查/构建等），嵌入至 `AGENTS.md`  
- **自动批准标志**（须明确征询用户同意）  
  - Codex：`--full-auto`  
  - Claude Code：`--dangerously-skip-permissions`  

### 2) 第一阶段 —— 需求 → 规格文档  
若用户要求“完整 Ralph 流程”（或需求不明确），应在循环启动前执行此步骤：  
- 将 JTBD 拆解为若干**关注主题**（每个主题对应一个规格文件）。  
- 针对每个主题，起草 `specs/<topic>.md`。  
- 使用 subagents 加载 URL 或已有文档，提升规格质量。  
- 保持规格简明、可测试。

### 3) 第二/三阶段 —— PROMPT.md + AGENTS.md  
- **每次迭代加载的上下文**：`PROMPT.md` + `AGENTS.md`  
- `AGENTS.md` 应包含：  
  - 项目测试命令（背压）  
  - 构建/运行说明  
  - 任何运维经验总结  
- `PROMPT.md` 应引用：  
  - `specs/*.md`  
  - `IMPLEMENTATION_PLAN.md`  
  - 任意相关项目文件/目录  

### 4) 两种提示模板（PLANNING 与 BUILDING）  
创建**两个提示模板**，并根据当前模式切换 `PROMPT.md`。

**PLANNING 提示（不执行实现）：**  
```
You are running a Ralph PLANNING loop for: <JTBD/GOAL>.

Read specs/* and the current codebase. Do a gap analysis and update IMPLEMENTATION_PLAN.md only.
Rules:
- Do NOT implement.
- Do NOT commit.
- Prioritize tasks and keep plan concise.
- If requirements are unclear, write clarifying questions into the plan.

Completion:
If the plan is complete, add line: STATUS: COMPLETE
```

**BUILDING 提示：**  
```
You are running a Ralph BUILDING loop for: <JTBD/GOAL>.

Context:
- specs/*
- IMPLEMENTATION_PLAN.md
- AGENTS.md (tests/backpressure)

Tasks:
1) Pick the most important task from IMPLEMENTATION_PLAN.md.
2) Investigate relevant code (don’t assume missing).
3) Implement.
4) Run the backpressure commands from AGENTS.md.
5) Update IMPLEMENTATION_PLAN.md (mark done + notes).
6) Update AGENTS.md if you learned new operational details.
7) Commit with a clear message.

Completion:
If all tasks are done, add line: STATUS: COMPLETE
```

### 5) 构建每次迭代的执行命令  
- Codex：`codex exec <FLAGS> "$(cat PROMPT.md)"`  
  - 要求存在 Git 仓库。  
- Claude Code：`claude <FLAGS> "$(cat PROMPT.md)"`  
- OpenCode：`opencode run "$(cat PROMPT.md)"`  
- Goose：`goose run "$(cat PROMPT.md)"`（需询问用户是否需要 Goose 配方）  

若 CLI 工具未知，请用户明确提供每次迭代需执行的确切命令。

### 6) 输出可复制粘贴的脚本  
提供**最小化循环**或**受控循环**（含最大迭代次数与停止条件）二者之一。

**最小化循环（Geoff 风格）：**  
```bash
while :; do cat PROMPT.md | claude ; done
```

**受控循环（推荐）：**  
```bash
#!/usr/bin/env bash
set -euo pipefail

PROMISE='...'
MAX_ITERS=...
CLI_FLAGS="..."  # optional
PLAN_SENTINEL='STATUS: COMPLETE'
TEST_CMD='...'   # optional

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "❌ Run this inside a git repo."
  exit 1
fi

touch PROMPT.md AGENTS.md IMPLEMENTATION_PLAN.md
LOG_FILE=".ralph/ralph.log"
mkdir -p .ralph

CLI_CMD="..." # e.g. "codex exec" or "claude"

for i in $(seq 1 "$MAX_ITERS"); do
  echo -e "\n=== Ralph iteration $i/$MAX_ITERS ===" | tee -a "$LOG_FILE"

  $CLI_CMD $CLI_FLAGS "$(cat PROMPT.md)" | tee -a "$LOG_FILE"

  if [[ -n "${TEST_CMD}" ]]; then
    echo "Running tests: $TEST_CMD" | tee -a "$LOG_FILE"
    bash -lc "$TEST_CMD" | tee -a "$LOG_FILE"
  fi

  if grep -Fq "$PROMISE" "$LOG_FILE" || grep -Fq "$PLAN_SENTINEL" IMPLEMENTATION_PLAN.md; then
    echo "✅ Completion detected. Stopping." | tee -a "$LOG_FILE"
    exit 0
  fi

done

echo "❌ Max iterations reached without completion." | tee -a "$LOG_FILE"
exit 1
```

## 安全性/沙箱指引（必须提及）
- 使用 `--dangerously-skip-permissions` 或 `--full-auto` 运行意味着**高度信任与风险承担**。  
- 建议采用**沙箱环境**（Docker/E2B/Fly），仅授予最低必要权限且网络访问受限。  
- 应急出口：`Ctrl+C` 用于中止；`git reset --hard` 用于回滚。

## 守护规则（Guardrails）
- 若需求不明确，必须先完成规格文档，再进入 BUILDING 阶段。  
- 若计划文档陈旧或错误，应重新生成（通过 PLANNING 循环）。  
- 若缺少背压命令，应主动询问用户并将其加入 `AGENTS.md`。
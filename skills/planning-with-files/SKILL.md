---
name: planning-with-files
name_zh: 文件规划
version: "2.10.0"
description: 实现 Manus 风格的基于文件的复杂任务规划。自动创建 task_plan.md、findings.md 和 progress.md。适用于启动复杂多步骤任务、研究项目，或任何需调用 >5 次工具的任务。现已支持在执行 /clear 后自动恢复会话。
description_zh: 实现 Manus 风格的基于文件的复杂任务规划。自动创建 task_plan.md、findings.md 和 progress.md。适用于启动复杂多步骤任务、研究项目，或任何需调用 >5 次工具的任务。现已支持在执行 /clear 后自动恢复会话。
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - WebFetch
  - WebSearch
hooks:
  PreToolUse:
    - matcher: "Write|Edit|Bash|Read|Glob|Grep"
      hooks:
        - type: command
          command: "cat task_plan.md 2>/dev/null | head -30 || true"
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "echo '[planning-with-files] 文件已更新。若此操作完成某一阶段，请同步更新 task_plan.md 中的状态。'"
  Stop:
    - hooks:
        - type: command
          command: |
            SCRIPT_DIR="${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/planning-with-files}/scripts"

            IS_WINDOWS=0
            if [ "${OS-}" = "Windows_NT" ]; then
              IS_WINDOWS=1
            else
              UNAME_S="$(uname -s 2>/dev/null || echo '')"
              case "$UNAME_S" in
                CYGWIN*|MINGW*|MSYS*) IS_WINDOWS=1 ;;
              esac
            fi

            if [ "$IS_WINDOWS" -eq 1 ]; then
              if command -v pwsh >/dev/null 2>&1; then
                pwsh -ExecutionPolicy Bypass -File "$SCRIPT_DIR/check-complete.ps1" 2>/dev/null ||
                powershell -ExecutionPolicy Bypass -File "$SCRIPT_DIR/check-complete.ps1" 2>/dev/null ||
                sh "$SCRIPT_DIR/check-complete.sh"
              else
                powershell -ExecutionPolicy Bypass -File "$SCRIPT_DIR/check-complete.ps1" 2>/dev/null ||
                sh "$SCRIPT_DIR/check-complete.sh"
              fi
            else
              sh "$SCRIPT_DIR/check-complete.sh"
            fi
---
# 文件驱动式规划

像 Manus 那样工作：将持久化的 Markdown 文件作为你“磁盘上的工作记忆”。

## 第一步：检查先前会话（v2.2.0）

**开始工作前**，请检查是否存在上一会话中尚未同步的上下文：

```bash
# Linux/macOS
$(command -v python3 || command -v python) ${CLAUDE_PLUGIN_ROOT}/scripts/session-catchup.py "$(pwd)"
```

```powershell
# Windows PowerShell
& (Get-Command python -ErrorAction SilentlyContinue).Source "$env:USERPROFILE\.claude\skills\planning-with-files\scripts\session-catchup.py" (Get-Location)
```

若同步报告（catchup report）显示存在未同步上下文：
1. 运行 `git diff --stat` 查看实际的代码变更  
2. 阅读当前的规划文件  
3. 根据同步报告与 git diff 更新规划文件  
4. 然后继续执行任务  

## 重要提示：文件存放位置

- **模板文件**位于 `${CLAUDE_PLUGIN_ROOT}/templates/`  
- **你的规划文件**应置于**你的项目目录中**

| 位置 | 存放内容 |
|------|----------|
| Skill 目录（`${CLAUDE_PLUGIN_ROOT}/`） | 模板、脚本、参考文档 |
| 你的项目目录 | `task_plan.md`、`findings.md`、`progress.md` |

## 快速入门

在执行**任何复杂任务前**：

1. **创建 `task_plan.md`** —— 参考 [templates/task_plan.md](templates/task_plan.md)  
2. **创建 `findings.md`** —— 参考 [templates/findings.md](templates/findings.md)  
3. **创建 `progress.md`** —— 参考 [templates/progress.md](templates/progress.md)  
4. **决策前重读计划** —— 刷新注意力窗口中的目标  
5. **每完成一阶段即更新** —— 标记完成状态、记录错误  

> **Note:** Planning files go in your project root, not the skill installation folder.

## 核心模式

```
Context Window = RAM (volatile, limited)
Filesystem = Disk (persistent, unlimited)

→ Anything important gets written to disk.
```

## 各文件用途

| 文件 | 用途 | 更新时机 |
|------|------|----------|
| `task_plan.md` | 阶段划分、进度追踪、关键决策 | 每完成一个阶段后 |
| `findings.md` | 研究发现、知识沉淀 | 任意新发现后 |
| `progress.md` | 会话日志、测试结果 | 整个会话期间 |

## 关键规则

### 1. 计划先行
执行任何复杂任务前，**必须**先创建 `task_plan.md`。此为不可协商的硬性要求。

### 2. 两动作规则（2-Action Rule）
> "After every 2 view/browser/search operations, IMMEDIATELY save key findings to text files."

此举可防止视觉/多模态信息丢失。

### 3. 决策前必读
在做出重大决策前，务必阅读计划文件。此举可确保目标始终处于注意力窗口中。

### 4. 执行后必更新
完成任一阶段后：
- 更新阶段状态：`in_progress` → `complete`  
- 记录所遇全部错误  
- 注明所创建/修改的文件  

### 5. 全量记录错误
每个错误均须写入计划文件。此举有助于积累知识并防止重复犯错。

```markdown
## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| FileNotFoundError | 1 | Created default config |
| API timeout | 2 | Added retry logic |
```

### 6. 永不重复失败
```
if action_failed:
    next_action != same_action
```
记录你已尝试的方法，并改变策略。

## 三次失败错误协议（3-Strike Error Protocol）

```
ATTEMPT 1: Diagnose & Fix
  → Read error carefully
  → Identify root cause
  → Apply targeted fix

ATTEMPT 2: Alternative Approach
  → Same error? Try different method
  → Different tool? Different library?
  → NEVER repeat exact same failing action

ATTEMPT 3: Broader Rethink
  → Question assumptions
  → Search for solutions
  → Consider updating the plan

AFTER 3 FAILURES: Escalate to User
  → Explain what you tried
  → Share the specific error
  → Ask for guidance
```

## “读”与“写”决策矩阵

| 场景 | 操作 | 原因 |
|------|------|------|
| 刚刚写入一个文件 | **不要立即读取** | 内容仍在上下文中 |
| 查看了图片/PDF | **立即写入 findings** | 多模态信息转文本，以防丢失 |
| 浏览器返回了数据 | **立即写入文件** | 截图等无法持久保存 |
| 开始新阶段 | **读取 plan/findings** | 若上下文陈旧，需重新定向 |
| 发生错误 | **读取相关文件** | 需掌握当前状态才能修复 |
| 间隔后恢复任务 | **读取全部规划文件** | 恢复任务状态 |

## 五问重启测试（5-Question Reboot Test）

若你能回答以下问题，则说明你的上下文管理已足够稳健：

| 问题 | 答案来源 |
|------|----------|
| 我当前在哪？ | task_plan.md 中的当前阶段 |
| 我要去向何方？ | 剩余阶段列表 |
| 目标是什么？ | 计划文件中的目标陈述 |
| 我已学到什么？ | findings.md |
| 我已做了什么？ | progress.md |

## 适用场景

**建议使用：**
- 多步骤任务（≥3 步）  
- 研究型任务  
- 项目构建/创作类任务  
- 涉及大量工具调用的任务  
- 任何需要组织协调的任务  

**无需使用：**
- 简单问答  
- 单文件编辑  
- 快速查询  

## 模板

复制以下模板快速启动：

- [templates/task_plan.md](templates/task_plan.md) —— 阶段追踪  
- [templates/findings.md](templates/findings.md) —— 研究资料存储  
- [templates/progress.md](templates/progress.md) —— 会话日志  

## 脚本

自动化辅助脚本：

- `scripts/init-session.sh` —— 初始化全部规划文件  
- `scripts/check-complete.sh` —— 验证所有阶段是否已完成  
- `scripts/session-catchup.py` —— 从上一会话中恢复上下文（v2.2.0）

## 高级主题

- **Manus 原则：** 见 [reference.md](reference.md)  
- **真实示例：** 见 [examples.md](examples.md)

## 反模式（Anti-Patterns）

| 切勿 | 应改为 |
|------|--------|
| 使用 TodoWrite 实现持久化 | 创建 task_plan.md 文件 |
| 仅声明一次目标便不再回顾 | 决策前重读计划文件 |
| 隐藏错误并静默重试 | 将错误记录至计划文件 |
| 将所有内容塞入上下文 | 将大体积内容存入文件 |
| 立即开始执行 | **首先创建计划文件** |
| 重复执行失败动作 | 记录尝试过程，调整策略 |
| 在 skill 目录中创建文件 | 在你的项目目录中创建文件 |
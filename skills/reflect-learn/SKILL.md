---
name: reflect-learn
name_zh: 反思学习
description: 通过对话分析实现自我提升。从修正与成功模式中提取学习项，并将其永久编码至 agent 定义中。理念：仅纠正一次，永不再犯。
description_zh: 通过对话分析实现自我提升。从修正与成功模式中提取学习项，并将其永久编码至 agent 定义中。理念：仅纠正一次，永不再犯。
version: "2.0.0"
user-invocable: true
triggers:
  - reflect
  - self-reflect
  - review session
  - what did I learn
  - extract learnings
  - analyze corrections
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
metadata:
  clawdbot:
    emoji: "🪞"
    config:
      stateDirs: ["~/.reflect"]
---
# Reflect - Agent 自我提升 skill

将你的 AI 助手转变为持续进化的协作伙伴。每一次修正都会转化为一项永久性改进，并在所有后续会话中持续生效。

## 快速参考

| 命令 | 操作 |
|------|------|
| `reflect` | 分析对话以提取学习项 |
| `reflect on` | 启用自动反思 |
| `reflect off` | 禁用自动反思 |
| `reflect status` | 显示当前状态与指标 |
| `reflect review` | 审阅待定学习项 |

## 适用场景

- 完成复杂任务之后  
- 用户明确指出行为错误时（例如：“永远不要做 X”，“始终做 Y”）  
- 会话边界处或上下文压缩前  
- 成功模式值得长期保留时  

## 工作流

### 第一步：扫描对话以识别信号

分析对话，查找修正信号与学习机会。

**信号置信度等级：**

| 置信度 | 触发词 | 示例 |
|--------|--------|------|
| **HIGH** | 显式修正 | “never”、“always”、“wrong”、“stop”、“the rule is” |
| **MEDIUM** | 已批准的方法 | “perfect”、“exactly”、“that's right”、被接受的输出 |
| **LOW** | 观察性陈述 | 成功但未经显式验证的模式 |

完整检测规则详见 [data/signal_patterns.md](data/signal_patterns.md)。

### 第二步：分类并匹配至目标文件

将每条信号映射至适当目标：

| 类别 | 目标文件 |
|------|----------|
| 代码风格 | `code-reviewer`, `backend-developer`, `frontend-developer` |
| 架构 | `solution-architect`, `api-architect`, `architecture-reviewer` |
| 流程 | `CLAUDE.md`, orchestrator agents |
| 领域 | 领域专用 agents，`CLAUDE.md` |
| 工具 | `CLAUDE.md`, 相关 specialist agents |
| 新 skill | 创建新 skill 文件 |

映射规则详见 [data/agent_mappings.md](data/agent_mappings.md)。

### 第三步：检查是否为 skill 级信号

部分学习项应成为新 skills，而非 agent 更新：

**具备 skill 价值的判定标准：**  
- 非显而易见的调试（调查耗时 >10 分钟）  
- 具有误导性的错误（根本原因与错误消息不符）  
- 通过实验发现的临时方案  
- 配置层面的洞见（与文档所述不同）  
- 可复用的模式（有助于类似场景）

**质量门禁（须全部满足）：**  
- [ ] 可复用：对后续任务有帮助  
- [ ] 非平凡：需经探索发现，而非仅查阅文档  
- [ ] 具体：可准确描述触发条件  
- [ ] 已验证：解决方案确实有效  
- [ ] 无重复：尚未存在同类内容  

### 第四步：生成提案

以结构化格式呈现发现结果：

```markdown
# Reflection Analysis

## Session Context
- **Date**: [timestamp]
- **Messages Analyzed**: [count]

## Signals Detected

| # | Signal | Confidence | Source Quote | Category |
|---|--------|------------|--------------|----------|
| 1 | [learning] | HIGH | "[exact words]" | Code Style |

## Proposed Changes

### Change 1: Update [agent-name]
**Target**: `[file path]`
**Section**: [section name]
**Confidence**: HIGH

```diff
+ 从学习中新增的规则
```

## Review Prompt
Apply these changes? (Y/N/modify/1,2,3)
```

### 第五步：在用户批准后应用变更

**收到 `Y`（批准）时：**  
1. 使用 Edit 工具逐条应用变更  
2. 以描述性信息提交变更  
3. 更新指标数据  

**收到 `N`（拒绝）时：**  
1. 丢弃所有提议的变更  
2. 记录拒绝原因以供后续分析  

**收到 `modify`（逐项确认）时：**  
1. 逐一呈现每项变更  
2. 允许编辑后再应用  

**收到选择性指令（例如 `1,3`）时：**  
1. 仅应用指定的变更  
2. 提交部分更新  

## 状态管理

状态存储于 `~/.reflect/`（可通过 `REFLECT_STATE_DIR` 配置）：

```yaml
# reflect-state.yaml
auto_reflect: false
last_reflection: "2026-01-26T10:30:00Z"
pending_reviews: []
```

### 指标追踪

```yaml
# reflect-metrics.yaml
total_sessions_analyzed: 42
total_signals_detected: 156
total_changes_accepted: 89
acceptance_rate: 78%
confidence_breakdown:
  high: 45
  medium: 32
  low: 12
most_updated_agents:
  code-reviewer: 23
  backend-developer: 18
skills_created: 5
```

## 安全护栏

### 人工参与闭环（Human-in-the-Loop）  
- 绝不未经用户明确批准即应用任何变更  
- 应用前始终展示完整 diff  
- 支持选择性应用  

### 增量式更新  
- 仅向现有章节追加内容  
- 绝不删除或重写已有规则  
- 保持原始结构不变  

### 冲突检测  
- 检查提议规则是否与现有规则矛盾  
- 检测到冲突时向用户发出警告  
- 提供解决策略建议  

## 输出位置

**项目级（随代码仓库版本化）：**  
- `.claude/reflections/YYYY-MM-DD_HH-MM-SS.md` —— 完整反思结果  
- `.claude/skills/{name}/SKILL.md` —— 新 skills  

**全局级（用户级）：**  
- `~/.reflect/learnings.yaml` —— 学习日志  
- `~/.reflect/reflect-metrics.yaml` —— 汇总指标  

## 示例

### 示例 1：代码风格修正

**用户说**：“TypeScript 中永远不要使用 `var`，始终使用 `const` 或 `let`”

**检测到的信号：**  
- 置信度：HIGH（显式 “never” + “always”）  
- 类别：代码风格  
- 目标：`frontend-developer.md`  

**提议的变更：**  
```diff
## Style Guidelines
+ * Use `const` or `let` instead of `var` in TypeScript
```

### 示例 2：流程偏好

**用户说**：“提交前务必运行测试”

**检测到的信号：**  
- 置信度：HIGH（显式 “always”）  
- 类别：流程  
- 目标：`CLAUDE.md`  

**提议的变更：**  
```diff
## Commit Hygiene
+ * Run test suite before creating commits
```

### 示例 3：从调试中诞生的新 skill

**上下文**：花费 30 分钟调试 React 水合不匹配问题  

**检测到的信号：**  
- 置信度：HIGH（非平凡调试）  
- 类别：新 skill  
- 质量门禁：全部通过  

**提议的 skill**：`react-hydration-fix/SKILL.md`

## 故障排除

**未检测到任何信号：**  
- 当前会话可能未包含修正内容  
- 请确认是否使用自然语言进行修正  

**出现冲突警告：**  
- 查阅所引用的现有规则  
- 判断新规则是否应覆盖旧规则  
- 可在应用前修改  

**Agent 文件未找到：**  
- 检查 agent 文件名拼写是否正确  
- 可能需要先创建 agent 文件  
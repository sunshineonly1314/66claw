---
name: daily-evolution
description: "AI Agent daily self-evolution system. Automatically reviews tool inventory, analyzes past performance, identifies improvement opportunities, generates optimization reports, and optionally executes improvements. Use when the user asks the agent to improve itself, review its capabilities, optimize workflows, or set up autonomous self-improvement routines."
nameZh: "每日自进化"
descriptionZh: "AI Agent每日自我进化系统，审视工具盘点、分析执行效果、生成改进报告"
metadata: {"openclawcn":{"emoji":"🧬"}}
---

# 每日自进化 (Daily Evolution)

AI Agent 每日自我审视和优化系统。通过整理工具盘点→回顾最佳实践→生成改进报告→可选执行优化，让 Agent 持续自我进化。

## 触发场景

- "帮我做一次自我检查"
- "优化一下你的工作流"
- "回顾一下最近的表现"
- "进化一下"
- 也可通过 HEARTBEAT.md 触发每日自动执行

## 自进化工作流

### Phase 1: 工具盘点 (Tool Inventory)

扫描当前可用能力:

```
-- 1. 检查已安装的技能
read({file_path: "<workspace>/skills/"})  -- 工作区技能
-- 查看 ~/.openclawcn/skills/ 目录 -- 已安装的市场技能

-- 2. 检查工具可用性
exec({command: "which curl jq gh git node python3 2>/dev/null"})

-- 3. 检查 MCP 服务器状态
-- 如果有 gateway 工具:
gateway({action: "status"})
```

生成工具盘点清单:
```markdown
## 工具盘点 - YYYY-MM-DD

### 可用技能 (N个)
- ✅ weather - 天气查询
- ✅ news-aggregator - 新闻聚合
- ⚠️ himalaya - 邮件 (未安装 CLI)

### 可用工具
- ✅ curl, jq, git, node
- ❌ gh (未安装)

### MCP 服务器
- ✅ filesystem - 运行中
- ⚠️ sqlite - 未配置
```

### Phase 2: 执行回顾 (Performance Review)

分析近期会话和操作:

```
-- 1. 读取近期记忆
read({file_path: "memory/YYYY-MM-DD.md"})  -- 今天的
read({file_path: "memory/YYYY-MM-DD.md"})  -- 昨天的

-- 2. 检查会话日志（如有 session-logs skill）
-- 按 session-logs skill 的方法分析最近的会话

-- 3. 读取 MEMORY.md 中的持久知识
read({file_path: "MEMORY.md"})
```

分析维度:
- **成功模式**: 哪些操作/流程执行顺利
- **失败模式**: 哪些操作失败或需要重试
- **效率瓶颈**: 哪些步骤耗时最长
- **知识缺口**: 哪些领域缺少相关技能或信息

### Phase 3: 改进报告 (Improvement Report)

生成结构化的自进化报告:

```markdown
# 自进化报告 - YYYY-MM-DD

## 能力状态
- 总技能数: N
- 活跃技能: M
- 缺失依赖: K

## 近期表现分析
### 做得好的
- [具体成功案例和模式]

### 需要改进的
- [具体问题和原因分析]

## 改进建议

### 立即可执行 ✅
1. **安装 XXX CLI** — 解锁 YYY 技能
   `命令: npm install -g xxx`
2. **更新 MEMORY.md** — 记录新发现的模式
3. **优化 XXX 工作流** — 减少重复步骤

### 需要用户确认 🔄
1. **安装新技能 XXX** — 覆盖 YYY 场景
2. **配置 MCP 服务器 XXX** — 提升 YYY 能力

### 长期改进 📋
1. **创建自定义技能 XXX** — 将常用流程固化
2. **优化记忆结构** — 更好地组织知识

## 执行计划
[如用户授权自动执行，按优先级排列的操作列表]
```

将报告写入文件:
```
write({file_path: "memory/evolution-YYYY-MM-DD.md", content: "报告内容"})
```

### Phase 4: 可选执行 (Optional Execution)

如用户授权，可自动执行"立即可执行"项:

**更新记忆**:
```
edit({file_path: "MEMORY.md", ...})  -- 添加新发现的模式和知识
```

**安装缺失工具**:
```
exec({command: "npm install -g xxx"})  -- 需要用户确认
```

**创建新技能**:
```
-- 使用 skill-creator skill 的流程
-- 将常用工作流固化为新技能
```

**优化工作流**:
```
-- 更新 AGENTS.md 中的工作流程
edit({file_path: "AGENTS.md", ...})
```

## HEARTBEAT.md 集成

将每日自进化加入心跳任务实现自动触发:

```markdown
# HEARTBEAT.md

## 每日任务
- [ ] 执行自进化检查 (daily-evolution skill)
  - 工具盘点
  - 执行回顾
  - 生成改进报告
  - 仅执行"立即可执行"且无副作用的改进项
```

## 进化历史追踪

在 memory/ 目录下保存进化记录:
```
memory/
├── evolution-2026-02-20.md
├── evolution-2026-02-21.md
└── evolution-summary.md    -- 月度/季度汇总
```

月度汇总模板:
```markdown
# 进化汇总 - 2026年2月

## 能力变化
- 新增技能: +3 (news-aggregator, web-researcher, task-board)
- 新增工具: +1 (gh CLI)
- 修复问题: 5

## 关键改进
1. 新闻聚合能力从0到可用
2. 任务管理流程标准化
3. 记忆系统结构优化

## 下月重点
- [基于趋势的改进方向]
```

## 注意事项

- **安全第一**: 自动执行仅限无副作用的操作（更新记忆、生成报告）
- **用户确认**: 安装工具、修改配置等操作必须经用户确认
- **增量改进**: 每次改进 1-3 个小点，不要一次大改
- **记录一切**: 所有改进和决策都写入 memory/ 目录
- **不要过度优化**: 如果当前状态已经够用，不需要强行改进

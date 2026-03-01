---
name: agent-registry
name_zh: 智能体注册
description: |
description_zh: |
  强制性的 agent 发现系统，支持高效利用 token 的 agent 加载。Claude 必须使用此 skill，而不得直接从 ~/.claude/agents/ 或 .claude/agents/ 加载 agent。通过 search_agents 和 get_agent 工具提供惰性加载（lazy loading）。在以下情形中使用：（1）用户任务可能受益于特定的 agent 专业知识；（2）用户询问当前可用的 agent；（3）启动历史上依赖 agent 的复杂工作流。相比预先加载全部 agent，该 skill 可将上下文窗口占用降低约 95%。
---
# Agent Registry

面向 Claude Code agent 的惰性加载系统。通过按需加载 agent，消除“~16k tokens”警告。

## 关键规则（CRITICAL RULE）

**切勿假设 agent 已预加载。** 必须始终通过本 registry 发现并加载 agent。

## 工作流（Workflow）

```
User Request → search_agents(intent) → select best match → get_agent(name) → execute with agent
```

## 可用命令（Available Commands）

| 命令 | 使用场景 | 示例 |
|---------|-------------|---------|
| `list_agents.py` | 用户询问“我有哪些 agent？”或需要概览 | `python scripts/list_agents.py` |
| `search_agents.py` | 根据用户意图查找匹配的 agent（务必首先执行此操作） | `python scripts/search_agents.py "code review security"` |
| `search_agents_paged.py` | 面向大型 registry（含 300+ 个 agent）的分页搜索 | `python scripts/search_agents_paged.py "query" --page 1 --page-size 10` |
| `get_agent.py` | 加载指定 agent 的完整指令 | `python scripts/get_agent.py code-reviewer` |

## 搜索优先模式（Search First Pattern）

1. **提取意图关键词**：从用户请求中提取关键词  
2. **执行搜索**：`python scripts/search_agents.py "<keywords>"`  
3. **审查结果**：检查相关性得分（0.0–1.0）  
4. **按需加载**：`python scripts/get_agent.py <agent-name>`  
5. **执行任务**：遵循已加载的 agent 的指令  

## 示例（Example）

用户：“你能帮我审查认证代码中的安全问题吗？”

```bash
# Step 1: Search for relevant agents
python scripts/search_agents.py "code review security authentication"

# Output:
# Found 2 matching agents:
#   1. security-auditor (score: 0.89) - Analyzes code for security vulnerabilities
#   2. code-reviewer (score: 0.71) - General code review and best practices

# Step 2: Load the best match
python scripts/get_agent.py security-auditor

# Step 3: Follow loaded agent instructions for the task
```

## 安装（Installation）

### 步骤 1：安装 skill

**快速安装（推荐）：**

```bash
# NPX with add-skill (recommended)
npx add-skill MaTriXy/Agent-Registry

# OR npm directly
npm install -g @claude-code/agent-registry
```

**传统安装：**

```bash
# User-level installation
./install.sh

# OR project-level installation
./install.sh --project
```

**install.sh 执行的操作：**  
1. ✓ 将 skill 文件复制到 `~/.claude/skills/agent-registry/`  
2. ✓ 创建空 registry 结构  
3. ✓ 自动安装 `questionary` Python 包（用于交互式 UI）  
4. ✓ 若 `pip3` 不可用，则优雅降级  

**注意：** 所有安装方式均支持基于 Python 的迁移及 CLI 工具  

### 步骤 2：迁移您的 agent

运行交互式迁移脚本：

```bash
cd ~/.claude/skills/agent-registry
python scripts/init_registry.py
```

**交互式选择模式：**

- **启用 questionary（推荐）**：带分类分组、token 指示器与分页功能的复选框 UI  
  - ↑↓ 导航，Space 切换选项，Enter 确认  
  - 可视化指示器：🟢 <1k tokens，🟡 1–3k tokens，🔴 >3k tokens  
  - 按子目录分组  

- **禁用 questionary（备用方案）**：基于文本的数字输入  
  - 输入逗号分隔的编号（例如：`1,3,5`）  
  - 输入 `all` 可迁移全部 agent  

**init_registry.py 执行的操作：**  
1. 扫描 `~/.claude/agents/` 和 `.claude/agents/` 目录下的 agent 文件  
2. 展示所有可用 agent 及其元数据  
3. 允许您交互式地选择待迁移的 agent  
4. 将所选 agent 移入 registry  
5. 构建搜索索引（`registry.json`）  

## 依赖项（Dependencies）

- **Python**：3.7 或更高版本  
- **questionary**：支持 Separator 的交互式复选框 UI  

安装器会自动安装 questionary。若安装失败或 pip3 不可用，迁移脚本将自动回退至基于文本的输入模式。

**手动安装：**  
```bash
pip3 install questionary
```

## Registry 存储位置（Registry Location）

- **全局路径**：`~/.claude/skills/agent-registry/`  
- **项目级路径**：`.claude/skills/agent-registry/`（可选覆盖）  

未迁移的 agent 将保留在原始位置，并照常加载（但会增加 token 开销）。
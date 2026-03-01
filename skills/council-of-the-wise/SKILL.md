---
name: council-of-the-wise
name_zh: 智者议事会
description: 将一个想法发送至“智者议会”，获取多视角反馈。启动子 agent，从多个专家视角进行分析。自动发现 agents/ 文件夹中的 agent 角色。
description_zh: 将一个想法发送至“智者议会”，获取多视角反馈。启动子 agent，从多个专家视角进行分析。自动发现 agents/ 文件夹中的 agent 角色。
version: 1.2.0
author: jeffaf
credits: 灵感源自 Daniel Miessler 的 PAI（个人人工智能基础设施）理念。架构师、工程师与艺术家 agent 改编自 PAI 模式；反对者为原创设计。
---
# 智者议会

当用户说出“发送给议会”、“智者议会”或类似指令时，启动一个子-agent，从多个专家视角分析该想法。

## 使用方法

```
"Send this to the council: [idea/plan/document]"
"Council of the wise: [topic]"
"Get the council's feedback on [thing]"
```

## 议会成员

该 skill **自动发现** agent 角色，来源为 `agents/` 文件夹。该文件夹中任意一个 `.md` 文件即构成一名议会成员。

**默认成员：**  
- `DevilsAdvocate.md` —— 质疑假设、揭示弱点、开展压力测试  
- `Architect.md` —— 设计系统、规划结构、制定高层策略  
- `Engineer.md` —— 细化实施步骤、评估技术可行性  
- `Artist.md` —— 塑造表达语气、风格、呈现方式及用户体验  

### 添加新议会成员

只需向 `agents/` 文件夹中添加一个新的 `.md` 文件：

```bash
# Add a security reviewer
echo "# Pentester\n\nYou analyze security implications..." > agents/Pentester.md

# Add a QA perspective  
echo "# QATester\n\nYou find edge cases..." > agents/QATester.md
```

该 skill 将自动纳入所有发现的 agent，无需配置文件。

### 自定义 Agent 存放路径（可选）

若用户已在 `~/.claude/Agents/` 部署了自定义 PAI agent，则可优先使用这些 agent：  
- 检查 `~/.claude/Agents/` 是否存在，且其中是否包含 agent 文件  
- 若是，则优先采用该目录下的自定义 agent  
- 若否，则使用本 skill 自带的 `agents/` 文件夹中的内置 agent  

## 执行流程

1. 接收用户提供的想法/主题  
2. 发现可用 agent（扫描 `agents/` 文件夹或自定义路径）  
3. 向用户发送加载中提示：`🏛️ *The Council convenes...* (this takes 2-5 minutes)`  
4. 启动一个子-agent（**超时设为 5 分钟**），并使用如下任务模板：

```
Analyze this idea/plan from multiple expert perspectives.

**The Idea:**
[user's idea here]

**Your Task:**
Read and apply these agent perspectives from [AGENT_PATH]:
[List all discovered agents dynamically]

For each perspective:
1. Key insights (2-3 bullets)
2. Concerns or questions  
3. Recommendations

End with:
- **Synthesis** section combining best ideas and flagging critical decisions
- Note where council members **disagree** with each other — that's where the insight is
- **Token Usage** with estimated input/output tokens (based on content length)

Use the voice and personality defined in each agent file. Don't just list points — embody the perspective.
```

5. 将整合后的反馈结果返回给用户  

## 输出格式

```markdown
## 🏛️ Council of the Wise — [Topic]

### 👹 Devil's Advocate
[challenges and risks — sharp, probing voice]

### 🏗️ Architect  
[structure and design — strategic, principled voice]

### 🛠️ Engineer
[implementation notes — practical, direct voice]

### 🎨 Artist
[voice and presentation — evocative, user-focused voice]

### ⚖️ Synthesis
[combined recommendation + key decisions needed]
[note where council members disagreed and why — that's the gold]

---
📊 **Token Usage:** ~X input / ~Y output tokens *(estimated)*
```

## 配置说明

无需配置文件。该 skill 自动发现 agent，并采用合理默认值：

- **超时时间：** 5 分钟（通过子-agent 启动机制强制执行）  
- **agent 来源：** `.md` 文件夹中全部 `agents/` 文件  
- **输出形式：** Markdown 格式，含综合结论与 token 使用量统计  
- **模型：** 使用会话默认模型（可通过 Clawdbot 覆盖）

## 注意事项

- 议会评审耗时约 2–5 分钟，取决于内容复杂度  
- 推荐场景：商业构想、内容规划、项目设计、重大决策  
- 不推荐场景：快速问答、简单任务、时效性强的请求  
- token 使用量基于内容长度估算（非精确 API 测量）  
- 可添加领域专用 agent，以支持特定领域的深度分析（如安全、法律等）
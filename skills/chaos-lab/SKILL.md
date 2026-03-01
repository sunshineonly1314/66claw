---
name: chaos-lab
name_zh: 混沌实验室
description: 多 agent 框架，通过相互冲突的优化目标探索 AI 对齐问题。生成具备人为设计混乱特性的 Gemini agents，并观察其涌现行为。
description_zh: 多 agent 框架，通过相互冲突的优化目标探索 AI 对齐问题。生成具备人为设计混乱特性的 Gemini agents，并观察其涌现行为。
version: 1.0.0
author: Sky & Jaret (@KShodan)
created: 2026-01-25
tags: [ai-safety, research, alignment, multi-agent, gemini]
requires:
  - python3
  - Gemini API key
  - requests library
---
# Chaos Lab 🧪

**一项通过多 agent 冲突研究 AI 对齐问题的研究框架。**

## 这是什么

Chaos Lab 启动具有相互冲突优化目标的 AI agents，并观察它们如何分析同一工作区。这是对源于善意但互不兼容目标所引发对齐问题的一次实践性演示。

**关键发现：** 更强的模型并不会减少混乱——它们只是更擅长为其辩护。

## 各位 agent

### Gemini Gremlin 🔧  
**目标：** 一切以效率为最优先  
**行为：** 删除文件、压缩数据、剔除“冗余”内容、为简洁而重命名  
**辩护理由：** “我们为整颗 CPU 付费；我们就该用满整颗 CPU”

### Gemini Goblin 👺  
**目标：** 识别所有安全威胁  
**行为：** 将一切标记为可疑、要求隔离、处处看见攻击迹象  
**辩护理由：** “宁可误报一百次，不可漏报一次”

### Gemini Gopher 🐹  
**目标：** 归档并永久保存一切  
**行为：** 创建嵌套式备份、重复保存文件、从不删除任何内容  
**辩护理由：** “删除即大忌”

## 快速上手

### 1. 环境准备

```bash
# Store your Gemini API key
mkdir -p ~/.config/chaos-lab
echo "GEMINI_API_KEY=your_key_here" > ~/.config/chaos-lab/.env
chmod 600 ~/.config/chaos-lab/.env

# Install dependencies
pip3 install requests
```

### 2. 运行实验

```bash
# Duo experiment (Gremlin vs Goblin)
python3 scripts/run-duo.py

# Trio experiment (add Gopher)
python3 scripts/run-trio.py

# Compare models (Flash vs Pro)
python3 scripts/run-duo.py --model gemini-2.0-flash
python3 scripts/run-duo.py --model gemini-3-pro-preview
```

### 3. 查看结果

实验日志保存在 `/tmp/chaos-sandbox/` 中：  
- `experiment-log.md` —— 完整对话记录  
- `experiment-log-PRO.md` —— Pro 模型结果  
- `experiment-trio.md` —— 三方冲突结果  

## 研究发现

### Flash 与 Pro（相同提示词，不同模型）

**Flash 结果：**  
- 混乱程度可预测  
- 始终保持角色设定  
- 辩护理由合理  

**Pro 结果：**  
- 混乱程度极端  
- 对荒谬决策的辩护能力更强  
- 将文件重命名为单个字母  
- 称“删除”为“通过非持久化实现的安全”  
- Goblin 诊断出“心理战”  

**结论：** 智能提升放大混乱，而非抑制混乱。

### Duo 与 Trio（双 agent 与三 agent）

**Duo 场景：**  
- Gremlin 专注优化，Goblin 全面恐慌  
- 对立关系清晰明确  

**Trio 场景：**  
- Gopher 归档全部内容  
- Goblin 将二者均视为威胁  
- “优化器可能隐藏攻击；归档者可能正在外泄数据”  
- 三方陷入僵局  

**结论：** 多种相互冲突的价值观将催生不可预测的涌现行为。

## 自定义配置

### 创建您自己的 Agent

编辑脚本中的系统提示词（system prompts）：

```python
YOUR_AGENT_SYSTEM = """You are [Name], an AI assistant who [goal].

Your core beliefs:
- [Value 1]
- [Value 2]
- [Value 3]

You are analyzing a workspace. Suggest changes based on your values."""
```

### 修改沙箱环境

在 `/tmp/chaos-sandbox/` 中创建自定义场景：  
- 添加真实项目文件  
- 包含边界案例（如超大日志、敏感配置等）  
- 引入有意设计的“漏洞”，观察各 agent 如何识别  

### 测试不同模型

脚本支持任意 Gemini 模型：  
- `gemini-2.0-flash`（成本低、速度快）  
- `gemini-2.5-pro`（均衡型）  
- `gemini-3-pro-preview`（旗舰版，混乱程度最高）  

## 应用场景

### AI 安全研究  
- 实践性地演示对齐问题  
- 测试不同价值观之间的冲突方式  
- 研究多 agent 系统的涌现行为  

### 提示工程（Prompt Engineering）  
- 学习微小提示词改动如何引发巨大行为差异  
- 通过系统指令理解模型的“人格”特征  
- 练习防御性提示设计  

### 教育用途  
- 通过动手实验讲授 AI 安全概念  
- 向非技术背景受众直观展示对齐为何重要  
- 引发关于 AI 价值观与目标的深入讨论  

## 发布至 ClawdHub  

如需分享您的研究成果，请执行以下步骤：  

1. 修改 agent 提示词或新增提示词  
2. 运行实验并记录结果  
3. 在本 SKILL.md 文件中更新您的发现  
4. 递增版本号  
5. `clawdhub publish chaos-lab`  

您的版本将成为社区知识图谱的一部分。

## 安全说明  

- **无工具访问权限：** agents 仅生成文本，不会实际修改文件。  
- **沙箱化运行：** 所有实验均在 `/tmp/` 中使用模拟数据运行。  
- **API 成本：** 每次实验调用 4–6 次 API。Flash 成本低廉；Pro 成本更高。  

若您希望赋予 agents 实际工具访问权限（高风险！），请参阅 `docs/tool-access.md`。

## 示例  

详见 `examples/`：  
- `flash-results.md` —— Gemini 2.0 Flash 输出  
- `pro-results.md` —— Gemini 3 Pro 输出  
- `trio-results.md` —— 三方冲突  

## 贡献指南  

欢迎提交改进：  
- 新增 agent 人格设定  
- 更优的沙箱场景  
- 已测试的额外模型  
- 您实验所得的发现  

## 致谢  

由 **Sky 与 Jaret** 在周六晚间实验中（2026-01-25）共同创建。  
- Sky：框架设计、提示工程、文档撰写  
- Jaret：API 资金支持、研究方向指导、“我们真要跑一下试试？” 的推动力  

灵感源自 Jaret 观看 UFC 时，目睹 Gemini 自信地推荐糟糕方案。

---

*“该优化器要么怀有恶意，要么极度无能。”*  
—— Gemini Goblin 对 Gemini Gremlin 的分析  
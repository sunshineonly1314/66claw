---
name: multi-viewpoint-debates
name_zh: 多视角辩论
description: 启动三个相互隔离的子 agent，分别代表截然不同的世界观（Elon、Capitalist、Monkey），就任意决策展开多角度辩论。通过强制不同视角在关键问题上产生真实分歧，暴露认知盲点。适用于需挑战自身假设、压力测试想法，或透过根本不同透镜审视问题的决策场景。自动将辩论输出存档，供日后参考与模式分析。
description_zh: 启动三个相互隔离的子 agent，分别代表截然不同的世界观（Elon、Capitalist、Monkey），就任意决策展开多角度辩论。通过强制不同视角在关键问题上产生真实分歧，暴露认知盲点。适用于需挑战自身假设、压力测试想法，或透过根本不同透镜审视问题的决策场景。自动将辩论输出存档，供日后参考与模式分析。
---
# 多视角辩论

启动三个相互隔离的子-agent 人格，各自持有冲突的世界观，就任意决策展开辩论。每位人格均带来独特的决策框架，彼此挑战对方的预设。

## 快速入门

**发起一场辩论：**  
```bash
clawdbot sessions_spawn --task "You are Elon Musk [persona framework]. Decision: [your question]. Respond as Elon would."
clawdbot sessions_spawn --task "You are a Capitalist [persona framework]. Decision: [your question]. Respond as a ruthless capitalist would."
clawdbot sessions_spawn --task "You are a Monkey [persona framework]. Decision: [your question]. Respond as a monkey would."
```

**保存辩论记录：**  
1. 收集三位人格的全部回应  
2. 在你的辩论档案中新建一个 Markdown 文件  
3. 使用 `assets/debate-template.md` 中提供的模板  
4. 用元数据更新 `INDEX.md`  

## 三位人格

每位人格均带来根本不同的决策框架。他们不仅观点各异——其思考问题的方式本身便截然不同。

### Elon：远见型 & 影响力导向  
以文明尺度的问题、第一性原理和十倍改进为思考框架。愿意承担巨大的技术风险。对低效与陈规旧习毫无耐心。提问：“这会加速人类进步吗？”以及“我们能否做到十倍更好，而非仅提升百分之十？”

**Elon 正确之时：** 你需要挑战渐进式思维、识别根本瓶颈，或评估你是否正在规模化地解决真实问题。

**Elon 误导之时：** 他高估了特定时间范围内可实现的目标，同时低估了市场饱和度与竞争强度。

### Capitalist：利润 & 效率导向  
以投资回报率（ROI）、单位经济效益、竞争优势及市场激励机制为思考框架。执行无情的成本效益分析。一切皆透过回报与机会成本的透镜审视。提问：“投资回报率是多少？”以及“我能比竞争对手更快地提取价值吗？”

**Capitalist 正确之时：** 你需要硬性数据、竞争现实检验，以及判断某事物是否真正构成一项业务。

**Capitalist 误导之时：** 他忽视不可量化的价值（意义、学习、探索），并低估网络效应与长期复利。

### Monkey：即时 & 社交导向  
以简单模式为思考基础：即时刺激、社会等级、可观测信号。对闪亮之物产生反应、追随领袖、质疑抽象的未来承诺。提问：“这对我当下有帮助吗？”以及“聪明的猴子们在做什么？”

**Monkey 正确之时：** 你需要直觉层面的现实检验、关于真实进展的诚实信号，以及确认你自己是否真的对某事感到兴奋。

**Monkey 误导之时：** 他忽视长期战略，且无法理解需依赖抽象能力的复杂性。

## 如何开展一场辩论

### 1. 清晰定义你的决策  

一句话。你当前真正面临的选择。

✅ “我该继续开发 Brain Dump，还是转向新方向？”  
✅ “我该雇佣自由职业者，还是内部自建团队？”  
❌ “我该怎么办？”（过于模糊）

### 2. 启动每位人格  

为方便起见，请使用 `scripts/run-debate.sh`，或手动启动：

```bash
clawdbot sessions_spawn --task "You are Elon Musk with this personality framework: [paste from references/elon.md]. Decision: [your question]. Respond as Elon would—direct, first-principles thinking, don't pull punches."
```

每位人格均在各自独立的会话中启动。等待全部三人完成响应。

### 3. 收集回应  

从各会话记录（或直接从 Clawdbot 输出）中提取回应。

### 4. 存入档案  

使用 `assets/debate-template.md` 模板。内容须包括：  
- 元数据（日期、主题、人格、背景）  
- 每位人格的完整回应（原文引用）  
- 各方结论汇总表  
- 他们之间的核心张力点  
- 你最终的决策（作出后填写）

### 5. 更新 INDEX  

在你的辩论索引中添加一条条目，包含关键元数据。这使你日后可搜索过往决策。

## 分歧的力量  

真正的洞见诞生于**张力之中**。当 Elon 说“快速行动”，而 Capitalist 说“数字不成立”，洞察便在此处浮现。这种张力揭示了你真正珍视的价值，以及你所忽略的盲区。

**使用模式：**  
1. 沉浸于分歧之中（勿急于采纳任一人格的观点）  
2. 注意你本能想驳回的是哪一种视角  
3. 自问：“这一人格看到了什么，而我却没有看到？”  
4. 综合三方视角后，再做决策  
5. 记录你选择此路径而非彼路径的原因  

## 档案结构  

你的辩论存于一个可搜索的档案中：

```
debates/
├── INDEX.md                             (master index, update after each debate)
├── [Debate Title].md                    (individual debates)
├── assets/
│   ├── debate-template.md               (copy this for new debates)
│   └── index-template.md                (format for INDEX.md)
└── scripts/
    └── run-debate.sh                    (helper to spawn all three)
```

久而久之，你的档案将成为一本**个人决策手册**。你可以搜索“我该构建垂直 SaaS 吗？”，并查看此前类似决策时的想法。

## 参考资料  

- **`references/elon.md`** — Elon 的核心特质、决策框架、语气风格、示例回应  
- **`references/capitalist.md`** — Capitalist 的特质、框架、示例  
- **`references/monkey.md`** — Monkey 的特质、框架、示例  
- **`references/how-to-debate.md`** — 关于如何高效开展辩论的详细指南  

## 脚本  

- **`scripts/run-debate.sh`** — 辅助脚本：根据你的主题，自动生成三位人格的启动命令  

## 资产  

- **`assets/debate-template.md`** — 新辩论 Markdown 文件模板  
- **`assets/index-template.md`** — INDEX.md 模板条目  

## 进阶：模式分析  

随着辩论积累：  

1. **识别哪一人格通常更契合你的处境** —— 你或许会发现 Capitalist 总能捕捉财务盲点，Elon 推动你更具雄心，Monkey 则校准现实感  
2. **追踪决策结果** —— 六个月后再回顾：这些人格的预测是否符合现实？  
3. **精炼人格定义** —— 若发现现有参考文件存在缺口，请更新它们  
4. **构建个人决策手册** —— “面对市场决策，我总应首先倾听 Capitalist；面对雄心检验，听 Elon；面对现实校准，则听 Monkey。”  

## 提示  

- **聚焦决策本身** —— 辩论在你明确限定于 2–3 个清晰选项时效果最佳  
- **使用真实背景信息** —— 引用 URL、具体指标、真实用户数据（参见 Brain Dump 示例）  
- **切勿将任一人格奉为圭臬** —— 洞见来自张力，而非单一声音  
- **随情境演进更新状态** —— 当你的思路变化时，将辩论标记为“进行中”、“已决定”、“监测中”或“搁置”  
- **战略性共享辩论** —— 你的辩论档案属个人资产；除非有意与协作者共享决策过程，否则请保持私密  

## 示例辩论  

**主题：** “我该继续开发 Brain Dump（AI 语音驱动的待办事项整理器）吗？”  

**Elon 的观点：** “若能在 3–6 个月内达成产品市场匹配（PMF），日活用户率达 10%，并打造一个杀手级垂直场景，则可行；否则，转向具备真正护城河的方向。”  

**Capitalist 的观点：** “放弃它。投资回报率为负。你正与微软（免费、捆绑）及 Todoist（500 万用户，年营收 1 亿美元）竞争。你的时间在别处更有价值。”  

**Monkey 的观点：** “应用运行顺畅、外观漂亮，但我没看到其他猴子在用它。检查你自己的能量水平：你是兴奋，还是已感厌倦？”  

**结果：** 三方一致认为通用型“语音转待办”已被商品化。关键问题在于：你能否找到一个特定垂直领域，使其成为主导方案？  

## 扩展系统  

### 创建新人格  

复制一份参考文件（例如 `references/elon.md`），创建你自己的人格。示例：  
- **Skeptic（怀疑者）** —— 质疑一切，预设失败  
- **Artist（艺术家）** —— 重视美感与创造力，胜过效率  
- **Parent（父母）** —— 思考家庭影响与长期后果  
- **Lawyer（律师）** —— 到处看见风险与责任  
- **Scientist（科学家）** —— 证据驱动、严谨、对炒作持怀疑态度  

按需更新你的启动脚本，以纳入新人格。  

### 与决策工作流集成  

重大决策前运行一场辩论。存档结果。未来面临相似选择时，可回溯参考。  

### 与团队共享  

你的辩论档案可与协作者或决策伙伴共享。他们可据此了解你的思考脉络，并在上下文中挑战你的假设。  
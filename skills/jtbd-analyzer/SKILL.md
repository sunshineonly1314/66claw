---
name: jtbd-analyzer
name_zh: JTBD 分析器
description: 揭示客户雇用你的产品所要完成的真实“任务”。超越功能表层，深入理解其功能性、情感性与社交性动因。当用户提及“待办任务理论”、“JTBD”、“客户为何购买”、“完成什么任务”、“客户动机”、“解决什么问题”、“用户需求”或“人们为何购买”时启用本 skill。
description_zh: 揭示客户雇用你的产品所要完成的真实“任务”。超越功能表层，深入理解其功能性、情感性与社交性动因。当用户提及“待办任务理论”、“JTBD”、“客户为何购买”、“完成什么任务”、“客户动机”、“解决什么问题”、“用户需求”或“人们为何购买”时启用本 skill。
---
# 待办任务理论分析器（Jobs-To-Be-Done Analyzer）

## 核心理念

客户并非购买产品，而是雇用产品来完成某项任务。

“人们并不想要一个 1/4 英寸的钻头。他们想要一个 1/4 英寸的孔。”  
更深层地说：他们想要一面置物架 → 用来陈列照片 → 从而感受到对家庭的自豪。

## 三大任务维度

| 维度       | 关键问题             | 表述格式                     |
|------------|----------------------|------------------------------|
| **功能性** | 需要完成什么任务？     | “帮我 [动词] [对象]”            |
| **情感性** | 我希望感受到什么？     | “让我感受到 [情绪]”             |
| **社交性** | 我希望被他人如何看待？ | “助我被视作 [品质]”             |

## 分析流程

1. **撰写任务陈述：** “当 [情境] 时，我希望 [动机]，以便 [结果]”  
2. **为每类用户映射全部三个维度**  
3. **识别真实竞争者：** 还有哪些事物能完成同一任务？  
4. **优先级排序：** 哪些任务最关键且最未被满足？  

## 输出格式

```
PRODUCT: [What you're analyzing]

For [User Type]:
JOB: "When [situation], I want [motivation], so I can [outcome]"

📋 FUNCTIONAL: [Task to accomplish]
💜 EMOTIONAL: [Feeling desired]
👥 SOCIAL: [Perception desired]

ALTERNATIVES: [What else could do this job?]
UNDERSERVED: [What part isn't done well?]
PRIORITY: Critical / Important / Nice-to-have
```

## 关键提问清单

1. “您在 [执行某动作] 时，真正想达成的目标是什么？”  
2. “请回顾上一次您需要完成 [某任务] 的全过程。”  
3. “如果 [该产品] 不存在，您会怎么做？”  
4. “目前您完成 [该任务] 的方式，有哪些让您感到沮丧？”  

## 与其他 skill 的协同应用

可组合使用以下 skill：  
- **first-principles-decomposer** → 将任务分解至原子级需求  
- **cross-pollination-engine** → 探索其他领域如何出色解决相似任务  
- **app-planning-skill** → 基于 JTBD 洞见指导功能设计  

---
参阅 references/examples.md 查看 Artem 专属的 JTBD 分析实例  
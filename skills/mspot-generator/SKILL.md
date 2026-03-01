---
name: mspot-generator
name_zh: 音乐生成器
description: 创建一页式战略对齐文档：使命（Mission）、策略（Strategy）、项目（Projects）、排除项（Omissions）、追踪（Tracking）。强制厘清您“将做”与“不做”的事项。当用户说出“mspot”、“战略计划”、“季度计划”、“我们不做什么”、“排除项”、“团队对齐”、“OKR 替代方案”、“优先事项”或“我们应该聚焦什么”时触发。
description_zh: 创建一页式战略对齐文档：使命（Mission）、策略（Strategy）、项目（Projects）、排除项（Omissions）、追踪（Tracking）。强制厘清您“将做”与“不做”的事项。当用户说出“mspot”、“战略计划”、“季度计划”、“我们不做什么”、“排除项”、“团队对齐”、“OKR 替代方案”、“优先事项”或“我们应该聚焦什么”时触发。
---
# MSPOT 生成器

## 什么是 MSPOT？

一页式战略清晰度框架（源自 HubSpot）：  
- **M**ission（使命）：我们存在的根本原因（极少变更）  
- **S**trategy（策略）：我们如何在当前周期内取胜  
- **P**rojects（项目）：3–5 项关键投入（“大赌注”）  
- **O**missions（排除项）：我们明确拒绝开展的事项  
- **T**racking（追踪）：衡量成功的关键指标  

## 为何有效？

1. **强制明确排除项**：说“不”更难，也更有价值  
2. **限制项目数量**：最多 3–5 项，防止资源过度分散  
3. **限定一页篇幅**：若无法容纳于一页，则说明尚不清晰  
4. **可追踪性**：仅保留对决策真正有用的核心指标  

## 输出格式

```
═══════════════════════════════════════════════
MSPOT: [Name]
Period: [Timeframe] | Owner: [Person]
═══════════════════════════════════════════════

MISSION: [One sentence: Why this exists]

STRATEGY: [2-3 sentences: How we'll win]

PROJECTS (3-5 max):
1. [Name] - Outcome: [X] - Owner: [Y] - Due: [Z]
2. [Name] - Outcome: [X] - Owner: [Y] - Due: [Z]
3. [Name] - Outcome: [X] - Owner: [Y] - Due: [Z]

OMISSIONS:
✗ NOT [X] - Because: [reason]
✗ NOT [Y] - Because: [reason]

TRACKING:
Lead: [Activity] → Target: [X]
Lag: [Result] → Target: [Y] by [date]
═══════════════════════════════════════════════
```

## 关键提问

| 章节 | 提问 |
|------|------|
| **使命** | “如果我们成功了，世界将有何不同？” |  
| **策略** | “我们的‘不公平优势’是什么？” |  
| **项目** | “如果只能选三件事，是哪三件？” |  
| **排除项** | “我们很想做、但必须克制住不去做的事是什么？” |  
| **追踪** | “哪个数字能告诉我们正在获胜？” |  

## 集成能力

可与以下 skill 协同增效：  
- **pre-mortem-analyst** → 在承诺每个项目前，为其开展预演式复盘（pre-mortem）  
- **inversion-strategist** → 通过逆向思维识别排除项  
- **artem-decision-journal** → 记录重大 MSPOT 决策  

---  
参见 `references/examples.md` 查看 TeddySnaps / TISA / GolfTab 的 MSPOT 示例  
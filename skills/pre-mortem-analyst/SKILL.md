---
name: pre-mortem-analyst
name_zh: 预复盘分析
description: 设想项目已经失败，然后反向追溯原因。比风险评估更有力，因其以失败为确定前提。当用户提及“预先验尸”、“premortem”、“设想此项目已失败”、“可能出现哪些问题”、“风险分析”、“上线前”、“压力测试”、“什么会毁掉这个项目”、“项目风险”等表述时启用。
description_zh: 设想项目已经失败，然后反向追溯原因。比风险评估更有力，因其以失败为确定前提。当用户提及“预先验尸”、“premortem”、“设想此项目已失败”、“可能出现哪些问题”、“风险分析”、“上线前”、“压力测试”、“什么会毁掉这个项目”、“项目风险”等表述时启用。
---
# 预先验尸分析师  

## 为何预先验尸法优于风险评估  

**风险评估：** “哪些问题**可能**发生？” → 乐观偏差会过滤掉部分答案  
**预先验尸法：** “6 个月后，它**已失败**。为什么？” → 解放了坦诚分析的空间  

研究数据：预先验尸法可使问题识别率提升 30%。  

## 执行流程  

1. **设定场景：** “截至 [日期]，该项目已彻底失败。”  
2. **头脑风暴原因：** 列出 10 条以上失败原因（不加筛选）  
3. **分类整理：** 按人员、流程、技术、外部四类归类  
4. **评估优先级：** 按发生可能性 × 影响程度（高/中/低）打分  
5. **制定预防措施：** 对排名前三的原因，给出具体缓解行动  
6. **定义监控机制：** 明确早期预警信号  

## 输出格式  

```
PROJECT: [Name]
FAILURE SCENARIO: "It's [date]. [Project] has completely failed."

WHY IT FAILED:

👥 PEOPLE: [Cause] - L×I: H/H | Prevent: [x] | Warning: [y]
⚙️ PROCESS: [Cause] - L×I: M/H | Prevent: [x] | Warning: [y]
💻 TECHNOLOGY: [Cause] - L×I: L/H | Prevent: [x] | Warning: [y]
🌍 EXTERNAL: [Cause] - L×I: M/M | Prevent: [x] | Warning: [y]

TOP 3 PRIORITIES:
1. [Risk] → [Specific action]
2. [Risk] → [Specific action]
3. [Risk] → [Specific action]

WARNING SIGNS TO MONITOR:
□ [Early indicator 1]
□ [Early indicator 2]
```  

## 常见失败类别  

| 类别 | 常见原因 |  
|------|----------|  
| **人员（People）** | 关键人员离职、技能缺口、目标错位、认同度低 |  
| **流程（Process）** | 时间表过于激进、范围蔓延、依赖关系问题 |  
| **技术（Tech）** | 无法扩展、集成失败、安全/隐私泄露 |  
| **外部（External）** | 市场转向、竞品动作、监管变化 |  

## 整合能力  

可与以下 skills 协同增强效果：  
- **inversion-strategist** → 制定系统性规避策略  
- **second-order-consequences** → 推演已预防失败的下游影响  
- **first-principles-decomposer** → 质疑项目中隐藏的假设前提  
- **mspot-generator** → 在承诺投入前，验证 MSPOT 项目可行性  

---  
参见 references/examples.md 获取 Artem 专属的预先验尸案例  
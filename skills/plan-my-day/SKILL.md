---
name: plan-my-day
name_zh: 日程规划
description: Generate an energy-optimized, time-blocked daily plan
description_zh: Generate an energy-optimized, time-blocked daily plan
version: 1.0.0
author: theflohart
tags: [productivity, planning, time-blocking, energy-management]
---
# Plan My Day

根据当前优先事项与精力周期，生成一份清晰、可执行的逐小时日程计划。

## 使用方式

```
/plan-my-day [optional: YYYY-MM-DD for future date]
```

## 规划原则

1. **晨间启动** —— 保护清晨第一小时，用于唤醒仪式，而非处理任务  
2. **按精力排程** —— 将任务难度与自身精力水平相匹配  
3. **时间分块** —— 为特定工作分配专属时间段  
4. **聚焦前三项** —— 明确当日最重要的三项成果  

## 精力周期（可根据个人节律自定义）

- **高效峰值期：** 上午（深度工作，处理最难任务）  
- **次高效期：** 下午（专注工作，会议安排）  
- **恢复时段：** 锻炼、用餐、休息等间隙  
- **收尾时段：** 晚上（轻松任务，明日规划）  

## 规划流程

1. **收集上下文**  
   - 查阅现有每日笔记  
   - 复盘当前优先事项  
   - 确认固定日程（会议、通话等）  
   - 检查昨日遗留任务  

2. **确定前三项优先事项**  
   - 今日必须完成的是什么？  
   - 哪些事项最具杠杆效应？  
   - 哪些事项有截止期限？  

3. **构建时间分块日程**  
   - 将优先事项安排至精力高峰期  
   - 预留固定日程时段  
   - 各时段之间加入缓冲时间  
   - 包含休息与恢复时段  

4. **应用约束条件**  
   - 尊重既定预约  
   - 保障个人时间  
   - 安排用餐休息  
   - 避免过度排程  

## 输出格式

```markdown
# Daily Plan - [Day], [Month] [Date], [Year]

## Today's Mission

**Primary Goal:** [One-sentence goal for the day]

**Top 3 Priorities:**
1. [Priority 1 with specific outcome]
2. [Priority 2 with specific outcome]
3. [Priority 3 with specific outcome]

---

## Time-Blocked Schedule

### [TIME] - [TIME]: [Block Name]
**Focus:** [Primary focus for this block]

- [ ] [Specific task 1]
- [ ] [Specific task 2]
- [ ] [Specific task 3]

**Target:** [Measurable outcome]

---

[Continue for each time block...]

---

## Success Criteria

### Must-Have (Non-Negotiable)
- [ ] [Critical task 1]
- [ ] [Critical task 2]
- [ ] [Critical task 3]

### Should-Have (Important)
- [ ] [Important task 1]
- [ ] [Important task 2]

### Nice-to-Have (Bonus)
- [ ] [Bonus task 1]

---

## Evening Check-In

- [ ] Priority 1 done? **YES / NO**
- [ ] Priority 2 done? **YES / NO**
- [ ] Priority 3 done? **YES / NO**

**What went well:**

**What got stuck:**

**Tomorrow's priority adjustment:**
```

## 决策框架

在执行任何任务前，请自问：  
1. 这是否属于我的前三项优先事项？  
2. 这是否推动我达成今日目标？  
3. 这件事能否推迟至明日？  

**若三项答案均为“否” → 请勿执行**

## 实用建议

- 不要将时间排满 100%，预留约 20% 缓冲空间  
- 将最难的任务安排在精力最充沛的时段  
- 将同类任务集中处理（批量作业）  
- 主动安排休息，而非被动等待  
- 如有必要，可在日中复盘并动态调整  
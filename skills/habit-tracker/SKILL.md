---
name: habit-tracker
name_zh: 习惯追踪
description: 通过连续打卡、提醒和进度可视化来培养习惯
description_zh: 通过连续打卡、提醒和进度可视化来培养习惯
author: clawd-team
version: 1.0.0
triggers:
  - "track habit"
  - "did my habit"
  - "habit streak"
  - "new habit"
  - "habit progress"
---
# 习惯追踪器

通过对话建立持久的习惯。记录连续打卡天数、接收提醒、庆祝进步。

## 功能说明

创建并追踪每日/每周习惯，维护连续打卡计数，发送可选提醒，并随时间推移可视化您的进步。借助您的 AI assistant 实现简易的自我监督。

## 使用方法

**创建习惯：**  
```
"New habit: meditate daily"
"Track reading 30 minutes"
"Add habit: gym 3x per week"
```

**记录完成情况：**  
```
"Did meditation"
"Completed reading"
"Hit the gym today"
```

**查看进度：**  
```
"How are my habits?"
"Meditation streak"
"Weekly habit summary"
```

**设置提醒：**  
```
"Remind me to meditate at 7am"
"Habit reminder at 9pm"
```

## 习惯类型

- **每日型**：需每天完成以维持连续打卡
- **每周型**：每周完成 X 次
- **自定义型**：自行定义执行频率

## 连续打卡规则

- 每日型习惯漏掉一天 = 连续打卡重置  
- 未达成每周目标 = 当周不计入连续打卡  
- 说“今天跳过 [习惯]”可暂停习惯而不中断连续打卡（使用次数有限）

## 使用提示

- 从 1–2 个习惯开始，待其稳固后再逐步增加  
- 询问“habit insights”获取行为模式分析  
- 说“archive [habit]”可停止追踪该习惯，同时保留历史记录  
- 清晨自查：“我今天需要完成哪些习惯？”  
- 所有数据均本地存储  
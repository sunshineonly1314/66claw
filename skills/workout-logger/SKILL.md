---
name: workout-logger
name_zh: 训练记录器
description: 记录训练、追踪进展、获取动作建议与个人最佳（PR）追踪
description_zh: 记录训练、追踪进展、获取动作建议与个人最佳（PR）追踪
author: clawd-team
version: 1.0.0
triggers:
  - "log workout"
  - "track exercise"
  - "gym session"
  - "what's my PR"
  - "workout history"
---
# 训练记录器（Workout Logger）

通过自然对话追踪你的健身历程。记录训练、突破个人最佳（PR）、观察长期进步。

## 功能说明

以自然语言记录训练，追踪个人最佳成绩（PR），展示进步图表，并基于你的历史记录推荐动作。你的 AI 健身伙伴，记得你的一切。

## 使用方法

**记录训练：**
```
"Bench press 185lbs 3x8"
"Ran 5k in 24 minutes"
"Did 30 min yoga"
"Leg day: squats 225x5, lunges 3x12, leg press 400x10"
```

**查看进展：**
```
"What's my bench PR?"
"Show deadlift progress"
"How many times did I work out this month?"
```

**获取建议：**
```
"What should I do for back today?"
"I have 20 minutes, suggest a workout"
"What haven't I trained this week?"
```

**查看历史：**
```
"Last chest workout"
"Running history this month"
"Volume for legs last week"
```

## 动作类型

- 力量训练（重量 × 次数 × 组数）
- 有氧运动（距离、时间、配速）
- 柔韧性训练（时长、类型）
- 运动项目（活动、时长）

## 个人最佳（PR）追踪

自动识别以下类型：
- 1RM（根据重复次数估算）
- 训练量 PR
- 距离/时间纪录
- 连续训练天数（Streak）成就

## 使用提示

- 保持动作名称一致，以确保追踪准确
- 说 “same as last time”（同上次一样）可复用上一次训练
- 询问 “recovery status”（恢复状态）可获建议休息日
- 对无负重动作使用 “bodyweight”（自重）
- 随时导出为 CSV 格式
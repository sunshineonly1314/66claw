---
name: workout
name_zh: 健身训练
description: 使用 workout-cli 追踪训练、记录组数、管理动作与模板。支持多用户档案。当协助用户记录健身房训练、查看历史记录或分析力量进步时使用。
description_zh: 使用 workout-cli 追踪训练、记录组数、管理动作与模板。支持多用户档案。当协助用户记录健身房训练、查看历史记录或分析力量进步时使用。
metadata: {"clawdbot":{"emoji":"🏋️","requires":{"bins":["workout"]}}}
---
# Workout CLI（训练命令行工具）

## 多用户档案

多个用户可借助独立档案分别追踪训练。

```bash
workout profile list               # List all profiles
workout profile create sarah       # Create new profile
workout profile delete old         # Delete profile
```

当存在多个档案时，需明确指定目标档案：
```bash
workout --profile mike start push-day
workout --profile mike log bench-press 185 8
workout --profile mike done
```

- **单一档案**：命令可在不指定 `--profile` 的情况下运行（向后兼容）
- **共享动作库**：动作库在各档案间共享
- **按用户隔离的数据**：模板、训练计划、配置均为每档案独立

## 关键规则（CRITICAL RULES）

### 1. 务必先新增动作再记录
若用户提及的动作未存在于库中，**必须先添加再记录**：
```bash
workout exercises add "Dumbbell RDL" --muscles hamstrings,glutes --type compound --equipment dumbbell
```
切勿跳过此步骤——未知动作将无法成功记录。

### 2. 记录准确数值 —— 注释不能替代数值
组数记录必须包含**正确的重量与次数**。这些数值用于统计分析（个人最佳 PR、训练量、进步趋势）。
- ❌ 错误：记录 0 磅，再在注释中填写真实重量
- ✅ 正确：如实记录实际使用的重量

若用户未明确说明重量，**务必先询问**再记录。切勿假设为 0。

### 3. 注释仅用于元数据
注释仅用于补充上下文（如伤病、动作要点、器械备注），不可用于修正错误数据：
```bash
workout note "Left elbow tender today"
workout note bench-press "Used close grip"
```

## 核心命令
```bash
workout start --empty              # Start freestyle session
workout start push                 # Start from template
workout log bench-press 135 8      # Log set (weight reps)
workout log bench-press 135 8,8,7  # Log multiple sets
workout note "Session note"        # Add note
workout note bench-press "Note"    # Note on exercise
workout swap bench-press db-bench  # Swap exercise
workout done                       # Finish session
workout cancel                     # Discard
```

## 编辑与修正已记录的组数
```bash
workout undo                       # Remove last logged set
workout undo bench-press           # Remove last set of specific exercise
workout edit bench-press 2 155 8   # Edit set 2: weight=155, reps=8
workout edit bench-press 2 --reps 10 --rir 2  # Edit reps and RIR
workout delete bench-press 3       # Delete set 3 entirely
```
组编号从 1 开始计数。使用这些命令可在训练过程中修正错误。

## 动作（Exercises）
```bash
workout exercises list
workout exercises list --muscle chest
workout exercises add "Name" --muscles biceps --type isolation --equipment cable
```
⚠️ `exercises add` 所需参数：`--muscles`、`--type`、`--equipment`

器械选项：杠铃、哑铃、绳索、器械、自重、壶铃、弹力带、其他

## 模板（Templates）
```bash
workout templates list
workout templates show push
workout templates create "Push" --exercises "bench-press:4x8,ohp:3x8"
```

## 历史记录与个人最佳（PRs）
```bash
workout last                       # Last workout
workout history bench-press        # Exercise history
workout pr                         # All PRs
workout pr bench-press             # Exercise PRs
workout volume --week              # Weekly volume
workout progression bench-press    # Progress over time
```

## 典型训练流程
```bash
# 1. Start
workout start push

# 2. Log with REAL numbers
workout log bench-press 135 8
workout log bench-press 145 8
workout log bench-press 155 6

# 3. Notes for context only
workout note bench-press "Felt strong today"

# 4. Finish
workout done
```

## 器械变式
为确保正确追踪，请为不同器械变式使用特定动作：
- `bench-press`（杠铃） vs `dumbbell-bench-press`
- `romanian-deadlift`（杠铃） vs `dumbbell-rdl`
- `shoulder-press`（杠铃） vs `dumbbell-shoulder-press`

## 注意事项
- 重量单位为 **磅（lbs）**
- 在不同重量下多次调用 `log` 是允许的
- `swap` 将把所有已记录的组数迁移至新动作
- 所有命令均支持 `--json`
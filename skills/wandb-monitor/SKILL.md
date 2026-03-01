---
name: wandb
name_zh: W&B监控
description: 监控与分析 Weights & Biases（W&B）训练任务。适用于检查训练状态、检测失败、分析损失曲线、对比不同训练任务，或监控实验进展。触发词包括：“wandb”、“training runs”（训练任务）、“how's training”（训练进展如何）、“did my run finish”（我的任务是否已完成）、“any failures”（有无失败）、“check experiments”（检查实验）、“loss curve”（损失曲线）、“gradient norm”（梯度范数）、“compare runs”（对比任务）。
description_zh: 监控与分析 Weights & Biases（W&B）训练任务。适用于检查训练状态、检测失败、分析损失曲线、对比不同训练任务，或监控实验进展。触发词包括：“wandb”、“training runs”（训练任务）、“how's training”（训练进展如何）、“did my run finish”（我的任务是否已完成）、“any failures”（有无失败）、“check experiments”（检查实验）、“loss curve”（损失曲线）、“gradient norm”（梯度范数）、“compare runs”（对比任务）。
---
# Weights & Biases

监控、分析并对比 W&B 训练任务。

## 设置

```bash
wandb login
# Or set WANDB_API_KEY in environment
```

## 脚本

### 分析单个训练任务（完整健康评估）

```bash
~/clawd/venv/bin/python3 ~/clawd/skills/wandb/scripts/characterize_run.py ENTITY/PROJECT/RUN_ID
```

分析内容包括：
- 损失曲线趋势（起始值 → 当前值，变化百分比，变化方向）
- 梯度范数健康状况（检测梯度爆炸/消失）
- 评估指标（如存在）
- 任务停滞检测（心跳时间）
- 进度与预计完成时间（ETA）估算
- 配置关键项摘要
- 整体健康结论

选项：`--json` 输出机器可读格式。

### 监控所有正在运行的任务

```bash
~/clawd/venv/bin/python3 ~/clawd/skills/wandb/scripts/watch_runs.py ENTITY [--projects p1,p2]
```

快速汇总所有运行中任务的健康状态，并列出近期失败/完成的任务。适用于晨间简报。

选项：
- `--projects p1,p2` — 指定需检查的项目
- `--all-projects` — 检查全部项目
- `--hours N` — 回溯已完成任务的时间范围（单位：小时；默认为 24）
- `--json` — 输出机器可读格式

### 对比两个训练任务

```bash
~/clawd/venv/bin/python3 ~/clawd/skills/wandb/scripts/compare_runs.py ENTITY/PROJECT/RUN_A ENTITY/PROJECT/RUN_B
```

并排对比内容包括：
- 配置差异（高亮显示关键参数）
- 相同训练步数下的损失曲线
- 梯度范数对比
- 评估指标
- 性能指标（tokens/sec、steps/hour）
- 对比结论（胜出任务）

## Python API 快速参考

```python
import wandb
api = wandb.Api()

# Get runs
runs = api.runs("entity/project", {"state": "running"})

# Run properties
run.state      # running | finished | failed | crashed | canceled
run.name       # display name
run.id         # unique identifier
run.summary    # final/current metrics
run.config     # hyperparameters
run.heartbeat_at # stall detection

# Get history
history = list(run.scan_history(keys=["train/loss", "train/grad_norm"]))
```

## 指标键名变体

脚本自动支持以下指标键名：
- 损失（Loss）：`train/loss`、`loss`、`train_loss`、`training_loss`
- 梯度（Gradients）：`train/grad_norm`、`grad_norm`、`gradient_norm`
- 步数（Steps）：`train/global_step`、`global_step`、`step`、`_step`
- 评估（Eval）：`eval/loss`、`eval_loss`、`eval/accuracy`、`eval_acc`

## 健康阈值

- **梯度 > 10**：梯度爆炸（严重）
- **梯度 > 5**：梯度尖峰（警告）
- **梯度 < 0.0001**：梯度消失（警告）
- **心跳间隔 > 30 分钟**：任务停滞（严重）
- **心跳间隔 > 10 分钟**：响应缓慢（警告）

## 集成提示

用于晨间简报时，请使用 `watch_runs.py --json` 并解析其输出。

用于对特定训练任务进行深度分析时，请使用 `characterize_run.py`。

用于 A/B 测试或超参数对比时，请使用 `compare_runs.py`。
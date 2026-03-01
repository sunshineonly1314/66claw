---
name: pi-orchestration
name_zh: Pi 编排
description: 使用 Pi Coding Agent 将多个 AI 模型（GLM、MiniMax 等）作为 worker 进行编排，由 Claude 担任协调者。
description_zh: 使用 Pi Coding Agent 将多个 AI 模型（GLM、MiniMax 等）作为 worker 进行编排，由 Claude 担任协调者。
homepage: https://github.com/mariozechner/pi-coding-agent
metadata: {"clawdis":{"emoji":"🎭","requires":{"bins":["pi"]}}}
---
# Pi 编排（Pi Orchestration）

使用 Claude 作为编排协调器，通过 Pi Coding Agent 启动并协调多个 AI 模型 worker（如 GLM、MiniMax 等）。

## 支持的提供商

| 提供商 | 模型 | 状态 |
|----------|-------|--------|
| **GLM** | glm-4.7 | ✅ 正常运行 |
| **MiniMax** | MiniMax-M2.1 | ✅ 正常运行 |
| OpenAI | gpt-4o 等 | ✅ 正常运行 |
| Anthropic | claude-* | ✅ 正常运行 |

## 设置

### 1. GLM（智谱 AI）

从 [open.bigmodel.cn](https://open.bigmodel.cn/) 获取 API 密钥

```bash
export GLM_API_KEY="your-glm-api-key"
```

### 2. MiniMax

从 [api.minimax.chat](https://api.minimax.chat/) 获取 API 密钥

```bash
export MINIMAX_API_KEY="your-minimax-api-key"
export MINIMAX_GROUP_ID="your-group-id"  # Required for MiniMax
```

## 使用方法

### 直接命令

```bash
# GLM-4.7
pi --provider glm --model glm-4.7 -p "Your task"

# MiniMax M2.1
pi --provider minimax --model MiniMax-M2.1 -p "Your task"

# Test connectivity
pi --provider glm --model glm-4.7 -p "Say hello"
```

### 编排模式

Claude（Opus）可将以下任务作为后台 worker 启动：

#### 后台 Worker
```bash
bash workdir:/tmp/task background:true command:"pi --provider glm --model glm-4.7 -p 'Build feature X'"
```

#### 并行军团（tmux）
```bash
# Create worker sessions
tmux new-session -d -s worker-1
tmux new-session -d -s worker-2

# Dispatch tasks
tmux send-keys -t worker-1 "pi --provider glm --model glm-4.7 -p 'Task 1'" Enter
tmux send-keys -t worker-2 "pi --provider minimax --model MiniMax-M2.1 -p 'Task 2'" Enter

# Check progress
tmux capture-pane -t worker-1 -p
tmux capture-pane -t worker-2 -p
```

#### Map-Reduce 模式
```bash
# Map: Distribute subtasks to workers
for i in 1 2 3; do
  tmux send-keys -t worker-$i "pi --provider glm --model glm-4.7 -p 'Process chunk $i'" Enter
done

# Reduce: Collect and combine results
for i in 1 2 3; do
  tmux capture-pane -t worker-$i -p >> /tmp/results.txt
done
```

## 编排脚本

```bash
# Quick orchestration helper
uv run {baseDir}/scripts/orchestrate.py spawn --provider glm --model glm-4.7 --task "Build a REST API"
uv run {baseDir}/scripts/orchestrate.py status
uv run {baseDir}/scripts/orchestrate.py collect
```

## 最佳实践

1. **任务分解**：将大型任务拆分为相互独立的子任务  
2. **模型选型**：中文内容优先选用 GLM，创意类任务优先选用 MiniMax  
3. **错误处理**：在汇总结果前检查各 worker 的运行状态  
4. **资源管理**：任务完成后及时清理 tmux 会话  

## 示例：并行代码审查

```bash
# Claude orchestrates 3 workers to review different files
tmux send-keys -t worker-1 "pi --provider glm -p 'Review auth.py for security issues'" Enter
tmux send-keys -t worker-2 "pi --provider minimax -p 'Review api.py for performance'" Enter  
tmux send-keys -t worker-3 "pi --provider glm -p 'Review db.py for SQL injection'" Enter

# Wait and collect
sleep 30
for i in 1 2 3; do
  echo "=== Worker $i ===" >> review.md
  tmux capture-pane -t worker-$i -p >> review.md
done
```

## 注意事项

- 必须已安装 Pi Coding Agent：`npm install -g @anthropic/pi-coding-agent`  
- GLM 和 MiniMax 均提供 generous 的免费额度  
- Claude 充当协调者，实际繁重工作由 worker 执行  
- 可结合 process 工具实现后台任务管理  
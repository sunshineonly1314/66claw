---
name: tmux-agents
name_zh: Tmux代理
description: 在 tmux 会话中管理后台编码 agent。启动 Claude Code 或其他 agent，检查进度，获取结果。
description_zh: 在 tmux 会话中管理后台编码 agent。启动 Claude Code 或其他 agent，检查进度，获取结果。
version: 1.0.0
author: Jose Munoz
homepage: https://clawdhub.com/skills/tmux-agents
triggers:
  - spawn agent
  - coding task
  - background task
  - tmux session
  - run codex
  - run gemini
  - local agent
  - ollama agent
metadata:
  clawdbot:
    emoji: "🖥️"
    requires:
      bins: ["tmux"]
    install:
      - id: brew-tmux
        kind: brew
        formula: tmux
        bins: ["tmux"]
        label: "Install tmux (brew)"
---
# Tmux Agents

在持久化的 tmux 会话中运行编码 agents。它们可在后台持续工作，同时您执行其他任务。

## 可用的 Agents

### ☁️ 云端 Agents（需 API 积分）

| Agent | 命令 | 最适用场景 |
|-------|---------|----------|
| **claude** | Claude Code | 复杂编码、重构、完整项目 |
| **codex** | OpenAI Codex | 快速编辑、自动批准模式 |
| **gemini** | Google Gemini | 研究、分析、文档编写 |

### 🦙 本地 Agents（通过 Ollama 免费运行）

| Agent | 命令 | 最适用场景 |
|-------|---------|----------|
| **ollama-claude** | Claude Code + Ollama | 长周期实验、重度重构 |
| **ollama-codex** | Codex + Ollama | 延长的编码会话 |

本地 agents 利用您的 Mac GPU —— 无需支付 API 费用，非常适合实验！

## 快捷命令

### 启动一个新的 agent 会话
```bash
./skills/tmux-agents/scripts/spawn.sh <name> <task> [agent]

# Cloud (uses API credits)
./skills/tmux-agents/scripts/spawn.sh fix-bug "Fix login validation" claude
./skills/tmux-agents/scripts/spawn.sh refactor "Refactor the auth module" codex
./skills/tmux-agents/scripts/spawn.sh research "Research caching strategies" gemini

# Local (FREE - uses Ollama)
./skills/tmux-agents/scripts/spawn.sh experiment "Rewrite entire test suite" ollama-claude
./skills/tmux-agents/scripts/spawn.sh big-refactor "Refactor all services" ollama-codex
```

### 列出正在运行的会话
```bash
tmux list-sessions
# or
./skills/tmux-agents/scripts/status.sh
```

### 检查某个会话状态
```bash
./skills/tmux-agents/scripts/check.sh session-name
```

### 连接到会话并实时观察
```bash
tmux attach -t session-name
# Detach with: Ctrl+B, then D
```

### 发送额外指令
```bash
tmux send-keys -t session-name "additional instruction here" Enter
```

### 完成后终止会话
```bash
tmux kill-session -t session-name
```

## 何时选用本地 vs 云端 Agents

| 场景 | 推荐方案 |
|----------|----------------|
| 快速修复、时效敏感 | ☁️ 云端（更快） |
| 开销高昂的任务、预算有限 | 🦙 本地 |
| 长周期实验、可能失败 | 🦙 本地 |
| 生产环境代码审查 | ☁️ 云端（更智能） |
| 学习/探索性工作 | 🦙 本地 |
| 重度重构 | 🦙 本地 |

## 并行 Agents

可同时运行多个 agents：

```bash
# Mix and match cloud + local
./scripts/spawn.sh backend "Implement user API" claude           # Cloud
./scripts/spawn.sh frontend "Build login form" ollama-codex      # Local
./scripts/spawn.sh docs "Write API documentation" gemini         # Cloud
./scripts/spawn.sh tests "Write all unit tests" ollama-claude    # Local
```

一次性检查全部会话：
```bash
./skills/tmux-agents/scripts/status.sh
```

## Ollama 设置

本地 agents 需要已安装 Ollama 及适配的编码模型：

```bash
# Pull recommended model
ollama pull glm-4.7-flash

# Configure tools (one-time)
ollama launch claude --model glm-4.7-flash --config
ollama launch codex --model glm-4.7-flash --config
```

## 使用提示

- 即使 Clawdbot 重启，会话仍保持持久化
- 对高风险/实验性工作，请使用本地 agents
- 对生产关键型任务，请使用云端 agents
- 查看 `tmux ls` 以了解所有正在进行的工作
- 完成后及时终止会话，以释放系统资源
---
name: cursor-agent
name_zh: Cursor 智能体
version: 2.1.0
description: 用于多种软件工程任务的 Cursor CLI agent 全面 skill（已更新以支持 2026 年功能，含 tmux 自动化指南）。  
description_zh: 用于多种软件工程任务的 Cursor CLI agent 全面 skill（已更新以支持 2026 年功能，含 tmux 自动化指南）。
author: Pushpinder Pal Singh
---
# Cursor CLI Agent Skill

本 skill 提供一套全面指南与工作流集合，用于高效使用 Cursor CLI 工具，涵盖 2026 年 1 月更新的全部功能。

## 安装

### 标准安装（macOS、Linux、Windows WSL）

```bash
curl https://cursor.com/install -fsS | bash
```

### Homebrew（仅限 macOS）

```bash
brew install --cask cursor-cli
```

### 安装后配置

**macOS：**  
- 将路径添加至 `~/.zshrc`（zsh）或 `~/.bashrc`（bash）：  
  ```bash
  export PATH="$HOME/.local/bin:$PATH"
  ```  
- 重启终端，或运行 `source ~/.zshrc`（或 `~/.bashrc`）  
- 要求 macOS 10.15 或更高版本  
- 支持 Intel 与 Apple Silicon Mac  

**Linux/Ubuntu：**  
- 重启终端或重新加载 shell 配置文件  
- 使用 `agent --version` 验证安装  

**所有平台：**  
- 命令：`agent`（主命令）与 `cursor-agent`（向后兼容）  
- 验证安装：`agent --version` 或 `cursor-agent --version`  

## 认证

通过浏览器认证：  

```bash
agent login
```  

或使用 API 密钥：  

```bash
export CURSOR_API_KEY=your_api_key_here
```  

## 更新

保持 CLI 版本最新：  

```bash
agent update
# or
agent upgrade
```  

## 命令

### 交互式模式

启动与 agent 的交互式会话：  

```bash
agent
```  

使用初始提示启动：  

```bash
agent "Add error handling to this API"
```  

**向后兼容性：** `cursor-agent` 仍可用，但 `agent` 现为首选命令。

### 模型切换

列出所有可用模型：  

```bash
agent models
# or
agent --list-models
```  

使用指定模型：  

```bash
agent --model gpt-5
```  

在会话中动态切换模型：  

```
/models
```  

### 会话管理

管理你的 agent 会话：  

- **列出会话：** `agent ls`  
- **恢复最近会话：** `agent resume`  
- **恢复特定会话：** `agent --resume="[chat-id]"`  

### 上下文选择

在对话中包含特定文件或文件夹：  

```
@filename.ts
@src/components/
```  

### 斜杠命令（Slash Commands）

交互式会话中可用：  

- **`/models`** — 交互式切换 AI 模型  
- **`/compress`** — 汇总对话并释放上下文窗口  
- **`/rules`** — 直接在 CLI 中创建和编辑规则  
- **`/commands`** — 创建和修改自定义命令  
- **`/mcp enable [server-name]`** — 启用 MCP 服务器  
- **`/mcp disable [server-name]`** — 禁用 MCP 服务器  

### 键盘快捷键

- **`Shift+Enter`** — 添加换行符以输入多行提示  
- **`Ctrl+D`** — 退出 CLI（需双击以确保安全）  
- **`Ctrl+R`** — 审查变更（按 `i` 查看说明，使用方向键导航）  
- **`ArrowUp`** — 循环浏览历史消息  

### 非交互式 / CI 模式

以非交互式模式运行 agent，适用于 CI/CD 流水线：  

```bash
agent -p 'Run tests and report coverage'
# or
agent --print 'Refactor this file to use async/await'
```  

**输出格式：**  

```bash
# Plain text (default)
agent -p 'Analyze code' --output-format text

# Structured JSON
agent -p 'Find bugs' --output-format json

# Real-time streaming JSON
agent -p 'Run tests' --output-format stream-json --stream-partial-output
```  

**强制模式（自动应用变更，无需确认）：**  

```bash
agent -p 'Fix all linting errors' --force
```  

**媒体支持：**  

```bash
agent -p 'Analyze this screenshot: screenshot.png'
```  

### ⚠️ 在 AI agents / 自动化环境中使用（需 tmux）

**重要提示：** 当从自动化环境（AI agents、脚本、子进程调用）运行 Cursor CLI 时，CLI 需要真实的 TTY。直接执行将无限挂起。

**解决方案：使用 tmux**

```bash
# 1. Install tmux if not available
sudo apt install tmux  # Ubuntu/Debian
brew install tmux      # macOS

# 2. Create a tmux session
tmux kill-session -t cursor 2>/dev/null || true
tmux new-session -d -s cursor

# 3. Navigate to project
tmux send-keys -t cursor "cd /path/to/project" Enter
sleep 1

# 4. Run Cursor agent
tmux send-keys -t cursor "agent 'Your task here'" Enter

# 5. Handle workspace trust prompt (first run)
sleep 3
tmux send-keys -t cursor "a"  # Trust workspace

# 6. Wait for completion
sleep 60  # Adjust based on task complexity

# 7. Capture output
tmux capture-pane -t cursor -p -S -100

# 8. Verify results
ls -la /path/to/project/
```  

**原理说明：**  
- tmux 提供持久化的伪终端（PTY）  
- Cursor 的 TUI 需要交互式终端能力  
- 直接通过 `agent` 从子进程/执行调用时，若无 TTY 将挂起  

**不可行的方式：**  
```bash
# ❌ These will hang indefinitely:
agent "task"                    # No TTY
agent -p "task"                 # No TTY  
subprocess.run(["agent", ...])  # No TTY
script -c "agent ..." /dev/null # May crash Cursor
```  

## 规则与配置

agent 会自动从以下位置加载规则：  
- `.cursor/rules`  
- `AGENTS.md`  
- `CLAUDE.md`  

使用 `/rules` 命令可直接在 CLI 中创建和编辑规则。

## MCP 集成

MCP 服务器自动从 `mcp.json` 配置中加载。

支持运行时动态启用/禁用服务器：  

```
/mcp enable server-name
/mcp disable server-name
```  

**注意：** 支持含空格的服务器名称。

## 工作流

### 代码审查

对当前变更或指定分支执行代码审查：  

```bash
agent -p 'Review the changes in the current branch against main. Focus on security and performance.'
```  

### 重构

重构代码以提升可读性或性能：  

```bash
agent -p 'Refactor src/utils.ts to reduce complexity and improve type safety.'
```  

### 调试

分析日志或错误信息以定位根本原因：  

```bash
agent -p 'Analyze the following error log and suggest a fix: [paste log here]'
```  

### Git 集成

结合上下文智能自动化 Git 操作：  

```bash
agent -p 'Generate a commit message for the staged changes adhering to conventional commits.'
```  

### 批处理（CI/CD）

在 CI 流水线中运行自动化检查：  

```bash
# Set API key in CI environment
export CURSOR_API_KEY=$CURSOR_API_KEY

# Run security audit with JSON output
agent -p 'Audit this codebase for security vulnerabilities' --output-format json --force

# Generate test coverage report
agent -p 'Run tests and generate coverage report' --output-format text
```  

### 多文件分析

利用上下文选择功能分析多个文件：  

```bash
agent
# Then in interactive mode:
@src/api/
@src/models/
Review the API implementation for consistency with our data models
```  
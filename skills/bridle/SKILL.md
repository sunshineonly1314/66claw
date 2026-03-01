---
name: bridle
name_zh: Bridle
description: AI 编程助手的统一配置管理器。管理配置文件、安装 skills/agents/commands，并在 Claude Code、OpenCode、Goose 和 Amp 之间切换配置。
description_zh: AI 编程助手的统一配置管理器。管理配置文件、安装 skills/agents/commands，并在 Claude Code、OpenCode、Goose 和 Amp 之间切换配置。
author: Benjamin Jesuiter <bjesuiter@gmail.com>
metadata:
  clawdbot:
    emoji: "🐴"
    os: ["darwin", "linux"]
    requires:
      bins: ["bridle"]
    install:
      - id: brew
        kind: brew
        formula: neiii/bridle/bridle
        bins: ["bridle"]
        label: 通过 Homebrew 安装 bridle
      - id: cargo
        kind: download
        url: "https://github.com/neiii/bridle"
        bins: ["bridle"]
        label: 通过 Cargo 安装 bridle
---
# Bridle 技能

AI 编程助手的统一配置管理器。管理配置文件、安装 skills/agents/commands，并在 Claude Code、OpenCode、Goose 和 Amp 之间切换配置。

## 安装

```bash
# Homebrew (macOS/Linux)
brew install neiii/bridle/bridle

# Cargo (Rust)
cargo install bridle

# From source
git clone https://github.com/neiii/bridle && cd bridle && cargo install --path .
```

## 核心概念

- **Harnesses（运行环境）**：AI 编程助手（`claude`、`opencode`、`goose`、`amp`）
- **Profiles（配置文件）**：每个 harness 的已保存配置（例如 `work`、`personal`、`minimal`）

## 快捷命令

```bash
# Launch interactive TUI
bridle

# Show active profiles across all harnesses
bridle status

# Initialize bridle config and default profiles
bridle init
```

## 配置文件管理

```bash
# List all profiles for a harness
bridle profile list <harness>

# Show profile details (model, MCPs, plugins)
bridle profile show <harness> <name>

# Create empty profile
bridle profile create <harness> <name>

# Create profile from current config
bridle profile create <harness> <name> --from-current

# Switch/activate a profile
bridle profile switch <harness> <name>

# Open profile in editor
bridle profile edit <harness> <name>

# Compare profiles
bridle profile diff <harness> <name> [other]

# Delete a profile
bridle profile delete <harness> <name>
```

## 组件安装

Bridle 可从 GitHub 仓库安装 skills、agents、commands 和 MCPs，并自动为各 harness 转换路径与配置。

```bash
# Install from GitHub (owner/repo or full URL)
bridle install owner/repo

# Overwrite existing installations
bridle install owner/repo --force

# Interactively remove components [experimental]
bridle uninstall <harness> <profile>
```

## 配置

配置文件位置：`~/.config/bridle/config.toml`

```bash
# Get a config value
bridle config get <key>

# Set a config value
bridle config set <key> <value>
```

**配置项键名：** `profile_marker`、`editor`、`tui.view`、`default_harness`

## 输出格式

所有命令均支持 `-o, --output <format>`：
- `text`（默认）—— 人类可读格式
- `json` —— 机器可读格式
- `auto` —— TTY 下输出文本，管道中输出 JSON

## 支持的 Harnesses 及其配置位置

| Harness     | 配置位置         | 状态       |
| ----------- | ----------------------- | ------------ |
| Claude Code | `~/.claude/`            | 全面支持 |
| OpenCode    | `~/.config/opencode/`   | 全面支持 |
| Goose       | `~/.config/goose/`      | 全面支持 |
| Amp         | `~/.amp/`               | 实验性支持 |

## 各 Harness 下的组件路径

| 组件 | Claude Code | OpenCode | Goose |
| --------- | ----------- | -------- | ----- |
| Skills    | `~/.claude/skills/` | `~/.config/opencode/skill/` | `~/.config/goose/skills/` |
| Agents    | `~/.claude/plugins/*/agents/` | `~/.config/opencode/agent/` | — |
| Commands  | `~/.claude/plugins/*/commands/` | `~/.config/opencode/command/` | — |
| MCPs      | `~/.claude/.mcp.json` | `opencode.jsonc` | `config.yaml` |

## 常见工作流

### 基于当前配置创建工作用配置文件
```bash
bridle profile create claude work --from-current
```

### 基于现有配置文件创建（复制并修改）
```bash
# 1. Switch to the source profile
bridle profile switch opencode default

# 2. Create new profile from current (now the source profile)
bridle profile create opencode minimal --from-current

# 3. Edit the new profile to remove/modify as needed
bridle profile edit opencode minimal
```

### 在不同配置文件间切换
```bash
bridle profile switch claude personal
bridle profile switch opencode minimal
```

### 检查所有 harnesses 的状态
```bash
bridle status
```
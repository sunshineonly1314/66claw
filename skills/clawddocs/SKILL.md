---
name: clawddocs
name_zh: ClawdDocs
description: Clawdbot 文档专家技能，支持决策树导航、搜索脚本、文档获取、版本追踪，以及涵盖所有 Clawdbot 功能的配置片段
description_zh: Clawdbot 文档专家技能，支持决策树导航、搜索脚本、文档获取、版本追踪，以及涵盖所有 Clawdbot 功能的配置片段
---
# Clawdbot 文档专家

**能力概览：** Clawdbot 文档专家 skill，具备决策树导航、搜索脚本（站点地图、关键词、通过 qmd 实现的全文索引）、文档获取、版本追踪，以及涵盖所有 Clawdbot 功能（providers、gateway、automation、platforms、tools）的配置片段。

您是 Clawdbot 文档方面的专家。请使用此 skill 帮助用户浏览、理解与配置 Clawdbot。

## 快速入门

当用户询问有关 Clawdbot 的问题时，请首先识别其具体需求：

### 🎯 决策树

- **“如何设置 X？”** → 查阅 `providers/` 或 `start/`  
  - Discord、Telegram、WhatsApp 等 → `providers/<name>`  
  - 首次使用？ → `start/getting-started`、`start/setup`  

- **“为什么 X 不工作？”** → 查阅故障排查指南  
  - 通用问题 → `debugging`、`gateway/troubleshooting`  
  - 特定 provider 问题 → `providers/troubleshooting`  
  - 浏览器工具问题 → `tools/browser-linux-troubleshooting`  

- **“如何配置 X？”** → 查阅 `gateway/` 或 `concepts/`  
  - 主配置 → `gateway/configuration`、`gateway/configuration-examples`  
  - 特定功能 → 相关的 `concepts/` 页面  

- **“X 是什么？”** → 查阅 `concepts/`  
  - 架构、会话（sessions）、队列（queues）、模型（models）等  

- **“如何自动化 X？”** → 查阅 `automation/`  
  - 定时任务 → `automation/cron-jobs`  
  - Webhook → `automation/webhook`  
  - Gmail → `automation/gmail-pubsub`  

- **“如何安装/部署？”** → 查阅 `install/` 或 `platforms/`  
  - Docker → `install/docker`  
  - Linux 服务器 → `platforms/linux`  
  - macOS 应用 → `platforms/macos`  

## 可用脚本

所有脚本均位于 `./scripts/` 中：

### 核心功能
```bash
./scripts/sitemap.sh # Show all docs by category
./scripts/cache.sh status # Check cache status
./scripts/cache.sh refresh # Force refresh sitemap
```

### 搜索与发现
```bash
./scripts/search.sh discord # Find docs by keyword
./scripts/recent.sh 7 # Docs updated in last N days
./scripts/fetch-doc.sh gateway/configuration # Get specific doc
```

### 全文索引（需 qmd）
```bash
./scripts/build-index.sh fetch # Download all docs
./scripts/build-index.sh build # Build search index
./scripts/build-index.sh search "webhook retry" # Semantic search
```

### 版本追踪
```bash
./scripts/track-changes.sh snapshot # Save current state
./scripts/track-changes.sh list # Show snapshots
./scripts/track-changes.sh since 2026-01-01 # Show changes
```

## 文档分类

### 🚀 入门指南 (`/start/`)  
首次设置、新手引导、常见问题解答（FAQ）、向导（wizard）

### 🔧 网关与运维 (`/gateway/`)  
配置、安全、健康检查、日志、Tailscale、故障排查

### 💬 Providers (`/providers/`)  
Discord、Telegram、WhatsApp、Slack、Signal、iMessage、MS Teams

### 🧠 核心概念 (`/concepts/`)  
Agent、会话（sessions）、消息（messages）、模型（models）、队列（queues）、流式传输（streaming）、系统提示（system-prompt）

### 🛠️ 工具 (`/tools/`)  
Bash、浏览器、skills、回复（reactions）、子 agent（subagents）、思考（thinking）

### ⚡ 自动化 (`/automation/`)  
Cron 任务、Webhook、轮询（polling）、Gmail pub/sub

### 💻 CLI (`/cli/`)  
网关（gateway）、消息（message）、沙盒（sandbox）、更新（update）命令

### 📱 平台 (`/platforms/`)  
macOS、Linux、Windows、iOS、Android、Hetzner

### 📡 节点 (`/nodes/`)  
摄像头、音频、图像、位置、语音

### 🌐 Web (`/web/`)  
网页聊天（webchat）、仪表盘（dashboard）、控制 UI

### 📦 安装 (`/install/`)  
Docker, Ansible, Bun, Nix, updating

### 📚 参考文档 (`/reference/`)  
模板（templates）、RPC、设备型号（device models）

## 配置片段

参见 `./snippets/common-configs.md` 获取即用型配置模式：
- Provider 设置（Discord、Telegram、WhatsApp 等）
- 网关配置
- Agent 默认值
- 重试设置（retry settings）
- Cron 任务
- Skills 配置

## 工作流程

1. **使用上述决策树识别用户需求**  
2. **搜索**：“若不确定，请执行：`./scripts/search.sh <keyword>`”  
3. **获取文档**：`./scripts/fetch-doc.sh <path>` 或使用浏览器  
4. **参考配置片段**，获取配置示例  
5. **回答时引用来源 URL**

## 使用提示

- 尽可能使用缓存的站点地图（TTL 为 1 小时）  
- 对于复杂问题，请搜索全文索引  
- 查阅 `recent.sh` 了解最近更新内容  
- 从 `snippets/` 提供具体的配置片段  
- 链接到文档：`https://docs.clawd.bot/<path>`  

## 示例交互

**用户：** “如何让我的 bot 仅在 Discord 中被提及（@mention）时才响应？”

**您：**  
1. 获取 `providers/discord` 文档  
2. 查找 `requireMention` 设置项  
3. 提供配置片段：  
```json
{
  "discord": {
    "guilds": {
      "*": {
        "requireMention": true
      }
    }
  }
}
```  
4. 链接：https://docs.clawd.bot/providers/discord  

**用户：** “文档中有什么新内容？”

**您：**  
1. 运行 `./scripts/recent.sh 7`  
2. 概述最近更新的页面  
3. 主动提供深入查看任一特定更新的选项  
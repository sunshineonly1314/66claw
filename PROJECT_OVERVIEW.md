# OpenClawCN项目快速熟知文档

## 1. 项目概述

OpenClawCN是一个运行在用户自己设备上的个人AI助手，它可以在用户已经使用的多种聊天渠道上响应，包括WhatsApp、Telegram、Slack、Discord、Google Chat、Signal、iMessage、Microsoft Teams等，以及BlueBubbles、Matrix、Zalo等扩展渠道。

### 核心目标
- 提供个人、单用户的AI助手体验，感觉本地、快速且始终在线
- 支持多渠道集成，实现统一的消息处理和响应
- 提供语音唤醒和语音交互能力
- 支持实时Canvas可视化工作区
- 提供丰富的工具和技能生态系统

### 技术栈
- **后端**：Node.js (≥22)
- **前端**：Web界面、macOS/iOS/Android应用
- **聊天渠道集成**：各种API和SDK（如Baileys、grammY、Bolt、discord.js等）
- **AI模型**：支持Anthropic、OpenAI等
- **部署**：支持Docker、Nix等
- **通信**：WebSocket

## 2. 功能模块详解

### 2.1 Gateway（控制平面）
- **核心作用**：作为单一控制平面，管理会话、渠道、工具和事件
- **实现方式**：WebSocket服务器，默认运行在ws://127.0.0.1:18789
- **主要功能**：
  - 会话管理
  - 渠道路由
  - 工具协调
  - 事件处理
  - Web界面服务（Control UI和WebChat）

### 2.2 多渠道集成
- **核心作用**：连接各种聊天平台，实现消息的接收和发送
- **支持的渠道**：
  - WhatsApp（Baileys）
  - Telegram（grammY）
  - Slack（Bolt）
  - Discord（discord.js）
  - Google Chat（Chat API）
  - Signal（signal-cli）
  - iMessage（imsg）
  - BlueBubbles（扩展）
  - Microsoft Teams（扩展）
  - Matrix（扩展）
  - Zalo（扩展）
  - WebChat（内置）

### 2.3 多代理路由
- **核心作用**：将入站渠道/账户/对等方路由到隔离的代理（工作区 + 每个代理的会话）
- **实现方式**：基于配置的路由规则
- **主要功能**：
  - 会话隔离
  - 模型选择
  - 权限管理

### 2.4 语音功能
- **Voice Wake**：始终在线的语音唤醒功能
- **Talk Mode**：语音交互模式，支持连续对话
- **实现方式**：集成ElevenLabs API
- **支持平台**：macOS/iOS/Android

### 2.5 Live Canvas
- **核心作用**：代理驱动的可视化工作区
- **实现方式**：基于A2UI技术
- **主要功能**：
  - 可视化交互
  - 实时协作
  - 内容展示

### 2.6 工具平台
- **浏览器控制**：专用的clawd Chrome/Chromium，支持快照、操作、上传、配置文件
- **Canvas工具**：A2UI推送/重置、评估、快照
- **节点工具**：相机快照/剪辑、屏幕录制、位置获取、通知
- **Cron工具**：定时任务和唤醒
- **会话工具**：会话管理和跨会话通信
- **Discord/Slack操作**：集成的平台特定操作

### 2.7 技能平台
- **核心作用**：提供可扩展的技能生态系统
- **类型**：捆绑技能、托管技能和工作区技能
- **实现方式**：基于SKILL.md文件格式
- **技能注册表**：ClawdHub，支持自动搜索和安装技能

### 2.8 应用生态
- **macOS应用**：菜单栏控制平面、Voice Wake + PTT、WebChat + 调试工具、远程网关控制
- **iOS节点**：通过Bridge配对，支持语音触发转发和Canvas表面
- **Android节点**：通过与iOS相同的Bridge + 配对流程，支持Canvas、相机和屏幕捕获命令

## 3. 技术实现分析

### 3.1 架构设计
- **分层架构**：
  - 控制平面（Gateway）
  - 渠道层（各种聊天平台集成）
  - 代理层（AI模型和会话管理）
  - 工具层（各种内置和扩展工具）
  - 应用层（macOS/iOS/Android应用）

- **通信模式**：
  - Gateway作为WebSocket服务器
  - 客户端（CLI、WebChat、macOS应用、iOS/Android节点）通过WebSocket连接到Gateway
  - 渠道通过各自的API连接到Gateway

### 3.2 核心算法和流程

#### 消息处理流程
1. 消息从聊天渠道进入Gateway
2. Gateway根据配置的路由规则将消息路由到相应的代理
3. 代理处理消息，可能调用工具或生成响应
4. 响应通过Gateway返回给相应的聊天渠道

#### 语音交互流程
1. Voice Wake模块监听唤醒词
2. 检测到唤醒词后，激活Talk Mode
3. 录制用户语音并转换为文本
4. 将文本消息发送到代理处理
5. 代理生成响应并转换为语音
6. 通过设备扬声器播放语音响应

#### 技能加载和执行流程
1. 技能管理器扫描可用技能
2. 根据用户请求或代理决策加载相应技能
3. 执行技能逻辑，可能调用外部API或本地工具
4. 将技能执行结果返回给代理

### 3.3 技术选型依据

- **Node.js**：选择Node.js作为运行时，因为它适合处理异步I/O操作，如WebSocket通信和HTTP请求，这对于聊天机器人和实时交互非常重要。

- **WebSocket**：选择WebSocket作为通信协议，因为它提供了全双工通信通道，适合实时消息传递和事件处理。

- **多渠道集成**：选择使用各平台的官方SDK或成熟的第三方库，如Baileys（WhatsApp）、grammY（Telegram）、Bolt（Slack）等，以确保稳定的集成和良好的性能。

- **AI模型**：支持多种AI模型，特别是推荐Anthropic Pro/Max + Opus 4.5，因为它们具有长上下文能力和更好的提示注入抵抗能力。

- **Docker**：支持Docker部署，以提供一致的运行环境和简化的安装过程。

- **Tailscale**：集成Tailscale Serve/Funnel，以提供安全的远程访问能力。

## 4. 资源整合清单

### 4.1 第三方服务和API

| 服务/API | 用途 | 接入方式 | 配置信息 |
|---------|------|---------|---------|
| Anthropic | AI模型（Claude Pro/Max） | OAuth | 通过`openclawcn models auth`配置 |
| OpenAI | AI模型（ChatGPT/Codex） | OAuth | 通过`openclawcn models auth`配置 |
| ElevenLabs | 语音合成 | API密钥 | 在配置文件中设置 |
| WhatsApp | 消息渠道 | Baileys库 | 通过`openclawcn channels login`配置 |
| Telegram | 消息渠道 | grammY库 | 设置`TELEGRAM_BOT_TOKEN`环境变量或配置文件 |
| Slack | 消息渠道 | Bolt库 | 设置`SLACK_BOT_TOKEN`和`SLACK_APP_TOKEN`环境变量 |
| Discord | 消息渠道 | discord.js库 | 设置`DISCORD_BOT_TOKEN`环境变量或配置文件 |
| Signal | 消息渠道 | signal-cli | 需要安装signal-cli并配置 |
| iMessage | 消息渠道 | imsg库 | macOS专用，需要Messages登录 |
| Tailscale | 远程访问 | Tailscale CLI | 在配置文件中设置`gateway.tailscale.mode` |

### 4.2 配置文件

- **主配置文件**：`~/.openclawcn/openclawcn.json`
- **会话配置**：存储在工作区目录中
- **渠道配置**：存储在主配置文件的`channels`部分
- **模型配置**：存储在主配置文件的`agent`部分

### 4.3 环境变量

| 环境变量 | 用途 | 默认值 |
|---------|------|-------|
| TELEGRAM_BOT_TOKEN | Telegram机器人令牌 | 无 |
| SLACK_BOT_TOKEN | Slack机器人令牌 | 无 |
| SLACK_APP_TOKEN | Slack应用令牌 | 无 |
| DISCORD_BOT_TOKEN | Discord机器人令牌 | 无 |

## 5. 部署和安装

### 5.1 推荐安装方式

```bash
npm install -g openclawcn@latest
# 或: pnpm add -g openclawcn@latest

openclawcn onboard --install-daemon
```

onboarding向导会引导用户完成gateway、工作区、渠道和技能的设置，并安装Gateway守护进程（launchd/systemd用户服务）以保持运行。

### 5.2 从源码构建

```bash
git clone https://github.com/openclawcn/openclawcn.git
cd openclawcn

pnpm install
pnpm ui:build # 首次运行时自动安装UI依赖
pnpm build

pnpm openclawcn onboard --install-daemon

# 开发循环（TS更改时自动重载）
pnpm gateway:watch
```

### 5.3 Docker部署

支持通过Docker部署，详情请参考官方文档：https://docs.openclawcn.com/install/docker

## 6. 安全模型

### 6.1 DM访问控制
- **默认行为**：未知发送者会收到一个简短的配对代码，机器人不会处理他们的消息
- **配对方式**：使用`openclawcn pairing approve \u003cchannel\u003e \u003ccode\u003e`批准发送者
- **公开DM**：需要显式选择加入，设置`dmPolicy="open"`并在渠道允许列表中包含`"*"`

### 6.2 沙箱模式
- **默认**：工具在主机上为**main**会话运行，因此当只有用户自己时，代理具有完全访问权限
- **组/渠道安全**：设置`agents.defaults.sandbox.mode: "non-main"`以在每个会话的Docker沙箱中运行**非main会话**（组/渠道）
- **沙箱默认值**：允许`bash`、`process`、`read`、`write`、`edit`、`sessions_list`、`sessions_history`、`sessions_send`、`sessions_spawn`；拒绝`browser`、`canvas`、`nodes`、`cron`、`discord`、`gateway`

## 7. 监控和维护

### 7.1 健康检查
- 使用`openclawcn doctor`检查系统状态和配置问题
- 使用`openclawcn status`查看会话状态（模型 + 令牌，成本可用时）

### 7.2 日志管理
- 详细的日志系统，支持不同级别的日志记录
- 使用`openclawcn logs`查看日志

### 7.3 常见问题排查
- 运行`openclawcn doctor`以发现风险/错误配置的DM策略
- 参考官方文档中的故障排除指南

## 8. 总结

OpenClawCN是一个功能强大、灵活可扩展的个人AI助手平台，它通过集成多种聊天渠道、提供丰富的工具和技能生态系统，以及支持语音交互和可视化工作区，为用户提供了一个统一、高效的AI助手体验。

### 核心优势
- **本地运行**：保护隐私，数据存储在用户自己的设备上
- **多渠道集成**：实现统一的消息处理和响应，覆盖用户常用的所有聊天平台
- **丰富的工具生态**：内置浏览器控制、Canvas可视化、节点工具等多种实用工具
- **技能平台**：支持可扩展的技能系统，通过ClawdHub自动搜索和安装技能
- **语音交互**：支持Voice Wake和Talk Mode，实现自然的语音交互体验
- **可视化工作区**：通过Live Canvas提供代理驱动的可视化交互
- **高度可定制**：支持多种AI模型、部署方式和配置选项

### 使用建议
- **推荐配置**：使用Anthropic Pro/Max + Opus 4.5模型，获得最佳的长上下文能力和提示注入抵抗能力
- **安全设置**：保持DM访问控制为默认的配对模式，仅批准信任的发送者
- **沙箱模式**：对于群组和公共渠道，启用沙箱模式以增强安全性
- **远程访问**：使用Tailscale Serve/Funnel进行安全的远程访问
- **定期维护**：使用`openclawcn doctor`定期检查系统状态和配置问题
- **技能管理**：根据需要安装和管理技能，保持技能库的整洁和高效

通过合理配置和使用，OpenClawCN可以成为用户日常生活和工作中的得力助手，帮助处理各种任务和提供信息支持。
# PRD-01: Clawdbot 项目总览与架构设计

## 1. 项目概述

**项目名称**: Clawdbot  
**版本**: 2026.2.0  
**许可证**: MIT  
**运行环境**: Node.js 22+  
**包管理器**: pnpm 10.23.0  

Clawdbot 是一个多渠道 AI 智能助手网关平台，支持 WhatsApp、Telegram、Discord、Slack、Signal、iMessage 等主流即时通讯平台，并通过插件架构扩展支持钉钉、飞书、企业微信等中国企业通讯渠道。

## 2. 技术架构

### 2.1 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                     前端 UI 层 (LitElement)                │
│  ├── 聊天界面  ├── 配置管理  ├── 技能市场  ├── 授权管理    │
└──────────────────────┬───────────────────────────────────┘
                       │ WebSocket / HTTP
┌──────────────────────┴───────────────────────────────────┐
│                   Gateway 网关层 (Hono/Express)            │
│  ├── HTTP Server   ├── WebSocket RPC  ├── Setup Wizard    │
│  ├── Config Reload ├── License Check  ├── Control UI      │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────┴───────────────────────────────────┐
│                   核心业务层                                │
│  ├── Auto-Reply (消息分发与回复)                            │
│  ├── Agents (AI 模型执行引擎)                              │
│  ├── Skills (技能系统)                                     │
│  ├── Sandbox (Docker 沙箱)                                │
│  ├── License (授权系统)                                    │
│  ├── Plugins (插件系统)                                    │
│  └── Media Understanding (媒体理解)                        │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────┴───────────────────────────────────┐
│                   渠道适配层                                │
│  ├── Telegram (grammy)    ├── WhatsApp (Baileys)          │
│  ├── Discord (Carbon)     ├── Slack (Bolt)                │
│  ├── Signal               ├── iMessage                    │
│  ├── DingTalk (ext)       ├── Feishu (ext)                │
│  ├── WeCom (ext)          ├── LINE                        │
│  └── 更多插件扩展...                                       │
└──────────────────────────────────────────────────────────┘
```

### 2.2 目录结构

| 目录 | 说明 |
|------|------|
| `src/agents/` | AI 代理引擎：模型管理、会话执行、沙箱、技能 |
| `src/auto-reply/` | 消息分发与自动回复逻辑 |
| `src/gateway/` | 网关服务器：HTTP/WebSocket/配置热更新 |
| `src/config/` | 配置系统：类型定义、Zod Schema 验证 |
| `src/license/` | 授权系统：验证、心跳、设备管理、离线模式 |
| `src/plugins/` | 插件系统：注册、加载、配置状态管理 |
| `src/channels/` | 渠道抽象层：注册、会话、目标路由 |
| `src/cli/` | CLI 命令注册与交互 |
| `src/i18n/` | 国际化：中文/英文 |
| `src/telegram/` | Telegram 渠道适配 |
| `src/discord/` | Discord 渠道适配 |
| `src/slack/` | Slack 渠道适配 |
| `src/signal/` | Signal 渠道适配 |
| `src/media/` | 媒体处理管道 |
| `src/media-understanding/` | 媒体理解（视觉模型） |
| `ui/` | Web 前端（LitElement + Vite） |
| `extensions/` | 插件扩展（钉钉、飞书、企微等） |
| `build/` | 构建配置与脚本 |
| `docs/` | 文档（Mintlify 托管） |
| `scripts/` | 开发/运维脚本 |

### 2.3 核心依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `@mariozechner/pi-coding-agent` | 0.49.3 | 核心 AI 代理 SDK |
| `@mariozechner/pi-ai` | 0.49.3 | AI API 抽象层 |
| `hono` | 4.11.4 | HTTP 服务器框架 |
| `grammy` | ^1.39.3 | Telegram Bot API |
| `@whiskeysockets/baileys` | 7.0.0-rc.9 | WhatsApp Web 协议 |
| `@buape/carbon` | 0.14.0 | Discord Bot 框架 |
| `@slack/bolt` | ^4.6.0 | Slack Bot 框架 |
| `zod` | ^4.3.6 | 运行时类型验证 |
| `playwright-core` | 1.58.0 | 浏览器自动化 |
| `sharp` | ^0.34.5 | 图像处理 |
| `lit` | ^3.3.2 | Web Components UI |

### 2.4 构建与测试

- **TypeScript 编译**: `tsc -p tsconfig.json`
- **前端构建**: Vite + Rolldown
- **测试框架**: Vitest（覆盖率阈值 70%）
- **Lint/Format**: oxlint + oxfmt
- **CI**: GitHub Actions (ci.yml)

## 3. 部署架构

### 3.1 部署方式

1. **npm 全局安装**: `npm i -g clawdbot`
2. **Windows 安装程序**: Inno Setup (setup.iss)
3. **macOS 应用**: 菜单栏应用 (package-mac-app.sh)
4. **Docker**: docker-compose.yml
5. **Fly.io**: fly.toml 配置

### 3.2 配置存储

- 主配置: `~/.clawdbot/config.json`
- 凭证: `~/.clawdbot/credentials/`
- 会话: `~/.clawdbot/sessions/`
- 代理数据: `~/.clawdbot/agents/<agentId>/`

## 4. 核心设计原则

1. **多渠道统一**: 统一的消息抽象层，支持所有渠道
2. **插件可扩展**: 新渠道/功能通过插件机制接入
3. **配置驱动**: 所有行为通过 JSON 配置控制
4. **安全优先**: 授权验证、RSA 签名、SSRF 防护
5. **中国优化**: 中国区专属功能（免费模型、国产 LLM 支持）

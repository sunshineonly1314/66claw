# Clawdbot 项目架构分析报告

> 生成时间：2026-01-29

## 目录

1. [项目概述](#1-项目概述)
2. [核心服务架构](#2-核心服务架构)
3. [服务启动指南](#3-服务启动指南)
4. [更新流程](#4-更新流程)
5. [部署和打包脚本](#5-部署和打包脚本)
6. [非核心文件分析与归类建议](#6-非核心文件分析与归类建议)
7. [建议改进项](#7-建议改进项)

---

## 1. 项目概述

Clawdbot 是一个多渠道 AI 代理网关系统，核心功能包括：

- **WhatsApp Web 网关**：基于 Baileys 的 WhatsApp Web 集成
- **多渠道支持**：Telegram、Discord、Slack、Signal、iMessage、LINE 等
- **AI Agent 执行**：支持 Anthropic、OpenAI、Google 等多种模型提供商
- **跨平台应用**：macOS、iOS、Android 原生应用

**技术栈**：
- 运行时：Node.js 22+，支持 Bun 执行
- 语言：TypeScript (ESM)、Swift (macOS/iOS)、Kotlin (Android)
- 包管理：pnpm (工作区)
- 测试：Vitest (覆盖率阈值 70%)

**当前版本**：`2026.1.25`

---

## 2. 核心服务架构

### 2.1 服务总览

| 服务 | 目录 | 功能 | 必需性 |
|------|------|------|--------|
| **Gateway** | `src/gateway/` | 核心协调服务，提供 WebSocket/HTTP API | 必需 |
| **Agent** | `src/agents/` | AI Agent 执行引擎 | 必需 |
| **Daemon** | `src/daemon/` | 系统服务管理 (systemd/launchd) | 可选 |
| **CLI** | `src/cli/` | 命令行接口 | 必需 |
| **Channels** | `src/channels/` | 渠道管理抽象层 | 必需 |
| **Web (WhatsApp)** | `src/web/` | WhatsApp Web 集成 | 可选渠道 |
| **Telegram** | `src/telegram/` | Telegram Bot 集成 | 可选渠道 |
| **Discord** | `src/discord/` | Discord Bot 集成 | 可选渠道 |
| **Slack** | `src/slack/` | Slack Bot 集成 | 可选渠道 |
| **Signal** | `src/signal/` | Signal 集成 | 可选渠道 |
| **iMessage** | `src/imessage/` | iMessage 集成 (macOS) | 可选渠道 |
| **LINE** | `src/line/` | LINE Bot 集成 | 可选渠道 |

### 2.2 服务架构图

```
┌─────────────────────────────────────────────────────────────┐
│                       用户界面层                             │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│   CLI       │  macOS App  │   iOS App   │   Android App    │
│ src/cli/    │ apps/macos/ │  apps/ios/  │  apps/android/   │
└──────┬──────┴──────┬──────┴──────┬──────┴────────┬─────────┘
       │             │             │               │
       ▼             ▼             ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Gateway 服务                              │
│                   src/gateway/                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • WebSocket/HTTP 服务器                              │   │
│  │ • OpenAI 兼容 API                                    │   │
│  │ • 节点管理与路由                                      │   │
│  │ • 会话管理                                           │   │
│  └─────────────────────────────────────────────────────┘   │
└──────┬──────────────┬───────────────┬───────────────────────┘
       │              │               │
       ▼              ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐
│  Agent 服务   │ │  Channels    │ │      Extensions          │
│ src/agents/  │ │ (各渠道实现)  │ │     extensions/          │
│              │ │              │ │                          │
│ • 模型调用    │ │ • WhatsApp   │ │ • MS Teams               │
│ • 工具执行    │ │ • Telegram   │ │ • Matrix                 │
│ • 技能管理    │ │ • Discord    │ │ • Voice Call             │
│ • 沙箱运行    │ │ • Slack      │ │ • Zalo                   │
└──────────────┘ │ • Signal     │ └──────────────────────────┘
                 │ • iMessage   │
                 │ • LINE       │
                 └──────────────┘
```

### 2.3 核心服务详解

#### Gateway 服务 (`src/gateway/`)

- **主入口**：`src/gateway/server.ts` → `startGatewayServer()`
- **功能**：
  - 提供 WebSocket 和 HTTP 服务器
  - OpenAI 兼容 API 端点
  - 渠道管理与消息路由
  - 节点注册与发现
  - 控制 UI 服务
- **核心组件**：
  - `server-channels.ts` - 渠道管理器
  - `server-chat.ts` - Agent 事件处理
  - `server-methods/` - RPC 方法实现
  - `server-http.ts` - HTTP 服务器
  - `server-ws-runtime.ts` - WebSocket 运行时

#### Agent 服务 (`src/agents/`)

- **主入口**：`src/agents/pi-embedded-runner.ts` → `runEmbeddedPiAgent()`
- **功能**：
  - 执行 AI Agent 对话
  - 多模型提供商支持 (Anthropic、OpenAI、Google、Bedrock 等)
  - 工具调用与沙箱执行
  - 技能管理与加载
  - 认证配置管理
- **核心组件**：
  - `pi-embedded-runner/` - 嵌入式 Pi Agent
  - `auth-profiles/` - 认证配置
  - `model-catalog.ts` - 模型目录
  - `tools/` - 内置工具
  - `skills/` - 技能管理

#### Daemon 服务 (`src/daemon/`)

- **功能**：管理 Gateway 服务的系统级安装和启动
- **平台支持**：
  - `systemd.ts` - Linux (systemd)
  - `launchd.ts` - macOS (launchd)
  - `schtasks.ts` - Windows (计划任务)

---

## 3. 服务启动指南

### 3.1 开发环境启动

```bash
# 1. 安装依赖
pnpm install

# 2. 构建项目
pnpm build

# 3. 启动 Gateway (开发模式)
pnpm gateway:dev

# 或使用 watch 模式
pnpm gateway:watch
```

### 3.2 生产环境启动

```bash
# 方式一：直接运行
pnpm clawdbot gateway run --bind lan --port 18789

# 方式二：作为系统服务安装
pnpm clawdbot daemon install
pnpm clawdbot daemon start

# 方式三：Docker Compose
docker-compose up -d clawdbot-gateway
```

### 3.3 Docker 启动

```bash
# 使用预构建镜像
docker run -d \
  -p 18789:18789 \
  -p 18790:18790 \
  -v ~/.clawdbot:/home/node/.clawdbot \
  ghcr.io/clawdbot/clawdbot:latest \
  gateway --bind lan

# 或使用 docker-compose
docker-compose up -d
```

### 3.4 正常运行需要的服务

| 场景 | 必需服务 | 可选服务 |
|------|----------|----------|
| **最小运行** | Gateway | - |
| **本地开发** | Gateway | TUI |
| **生产部署** | Gateway + Daemon | 各渠道 Bot |
| **移动应用** | Gateway | macOS/iOS/Android App |

**端口说明**：
- `18789` - Gateway 主端口 (HTTP/WebSocket)
- `18790` - Bridge 端口 (节点通信)

---

## 4. 更新流程

### 4.1 发布渠道

| 渠道 | npm dist-tag | 说明 |
|------|--------------|------|
| **stable** | `latest` | 稳定版本，经过完整测试 |
| **beta** | `beta` | 预发布测试版本 |
| **dev** | - | Git `main` 分支 HEAD |

### 4.2 用户更新命令

```bash
# 更新到最新稳定版
clawdbot update --channel stable

# 更新到 beta 版
clawdbot update --channel beta

# 更新到开发版 (Git checkout)
clawdbot update --channel dev

# 指定特定版本
clawdbot update --tag 2026.1.25
```

### 4.3 发布流程

1. **版本准备**
   ```bash
   # 更新 package.json 版本
   # 同步插件版本
   pnpm plugins:sync
   ```

2. **构建验证**
   ```bash
   pnpm lint
   pnpm build
   pnpm test
   pnpm release:check
   ```

3. **发布到 npm**
   ```bash
   # 稳定版
   npm publish --access public

   # Beta 版
   npm publish --access public --tag beta
   ```

4. **GitHub Release**
   ```bash
   git tag v2026.1.25
   git push origin v2026.1.25
   # 创建 GitHub Release，附加产物
   ```

### 4.4 CI/CD 流程

| 工作流 | 触发条件 | 功能 |
|--------|----------|------|
| `ci.yml` | push/PR | Lint、Test、Build、Format |
| `docker-release.yml` | push main 或 v* tag | 构建多架构 Docker 镜像 |
| `install-smoke.yml` | push main/PR | 安装脚本测试 |

---

## 5. 部署和打包脚本

### 5.1 按平台分类

#### Windows 脚本 (`scripts/windows/`)

| 脚本 | 用途 | 输出 |
|------|------|------|
| `build-installer.ps1` | 创建 Windows 安装程序 | `installer/ClawdbotSetup-*.exe` |
| `build-portable.ps1` | 创建便携版 (需 Node.js) | `build/windows/clawdbot-windows-x64.zip` |
| `build-standalone.ps1` | 创建独立版 (含 Node.js) | `build/windows-standalone/*.zip` |
| `setup.iss` | Inno Setup 配置文件 | - |

#### Linux 脚本 (`scripts/linux/`)

| 脚本 | 用途 | 输出 |
|------|------|------|
| `build-portable.sh` | 创建便携版 (需 Node.js) | `build/linux/*.tar.gz` |
| `build-standalone.sh` | 创建独立版 (含 Node.js) | `build/linux-standalone/*.tar.gz` |

#### macOS 脚本

| 脚本 | 用途 | 输出 |
|------|------|------|
| `scripts/package-mac-app.sh` | 打包 macOS 应用 | `dist/Clawdbot.app` |
| `scripts/restart-mac.sh` | 重启 macOS 应用 | - |

### 5.2 Docker 脚本 (`scripts/docker/`)

| 目录/脚本 | 用途 |
|-----------|------|
| `install-sh-smoke/` | 安装脚本冒烟测试 |
| `install-sh-e2e/` | 安装脚本端到端测试 |
| `cleanup-smoke/` | 清理流程测试 |

### 5.3 原生部署脚本 (`nativedeploy/`)

| 脚本 | 用途 |
|------|------|
| `deploy.ps1` | WSL 本地部署 |
| `deploy-ssh.ps1` | SSH 远程部署 |
| `setup.sh` | 环境安装配置 |
| `start.sh` | 服务启动 |
| `stop.sh` | 服务停止 |
| `status.sh` | 状态检查 |

### 5.4 云平台配置

| 文件 | 平台 | 说明 |
|------|------|------|
| `fly.toml` | Fly.io | 公开部署配置 |
| `fly.private.toml` | Fly.io | 私有部署配置 |
| `render.yaml` | Render | Render 平台配置 |
| `docker-compose.yml` | Docker | 本地 Docker 部署 |

---

## 6. 非核心文件分析与归类建议

### 6.1 需要从仓库移除/忽略的目录

| 目录 | 内容 | 文件数 | 建议 |
|------|------|--------|------|
| `build/` | 构建产物 | ~5000+ | **添加到 .gitignore** |
| `clawdhub-skills-mirror/` | 第三方技能镜像 | ~10000+ | **添加到 .gitignore** |

**建议添加到 `.gitignore`**：
```gitignore
# Build artifacts
build/

# Third-party skill mirror (generated by scripts)
clawdhub-skills-mirror/
```

### 6.2 核心项目目录 (应保留)

| 目录 | 用途 | 归类 |
|------|------|------|
| `src/` | 核心源代码 | 核心 |
| `apps/` | 移动/桌面应用源码 | 核心 |
| `extensions/` | 插件扩展系统 | 核心 |
| `ui/` | Web UI 组件 | 核心 |
| `docs/` | 英文文档 | 核心 |
| `docs-cn/` | 中文文档 | 核心 |
| `skills/` | 内置技能 | 核心 |
| `assets/` | 静态资源 | 核心 |
| `test/` | 测试辅助 | 核心 |
| `scripts/` | 构建/部署脚本 | 核心 |

### 6.3 辅助项目目录 (应保留)

| 目录 | 用途 | 归类 |
|------|------|------|
| `Swabble/` | 语音唤醒组件 (Swift) | 辅助核心 |
| `clawdbot-portable/` | Windows 便携版配置 | 发布相关 |
| `nativedeploy/` | 原生部署脚本 | 部署相关 |
| `.github/` | CI/CD 工作流 | 基础设施 |
| `patches/` | 依赖补丁 | 核心 |

### 6.4 文件分类汇总

```
项目根目录
├── 核心代码
│   ├── src/              # TypeScript 源码
│   ├── ui/               # Web UI
│   ├── apps/             # 原生应用
│   │   ├── macos/        # macOS 应用 (Swift)
│   │   ├── ios/          # iOS 应用 (Swift)
│   │   ├── android/      # Android 应用 (Kotlin)
│   │   └── shared/       # 共享代码 (ClawdbotKit)
│   ├── extensions/       # 插件扩展
│   └── Swabble/          # 语音唤醒 (Swift)
│
├── 文档
│   ├── docs/             # 英文文档 (Mintlify)
│   ├── docs-cn/          # 中文文档
│   └── skills/           # 内置技能文档
│
├── 配置
│   ├── package.json      # 主配置
│   ├── pnpm-workspace.yaml
│   ├── tsconfig.json
│   └── vitest.*.config.ts
│
├── 部署/打包
│   ├── scripts/          # 构建脚本
│   ├── nativedeploy/     # 原生部署
│   ├── docker-compose.yml
│   ├── fly.toml          # Fly.io
│   └── render.yaml       # Render
│
├── CI/CD
│   └── .github/workflows/
│
├── 静态资源
│   └── assets/
│
└── 应忽略 (非仓库内容)
    ├── build/            # 构建产物
    ├── dist/             # 编译输出
    └── clawdhub-skills-mirror/  # 第三方技能
```

---

## 7. 建议改进项

### 7.1 .gitignore 更新

当前 `.gitignore` 缺少以下条目：

```gitignore
# 建议添加
build/
clawdhub-skills-mirror/
```

### 7.2 目录清理

1. **`build/`** - 5000+ 文件，应由构建脚本生成，不应提交
2. **`clawdhub-skills-mirror/`** - 10000+ 文件，第三方技能镜像，应由脚本生成

### 7.3 文档完善

建议在 `docs/` 中添加：
- 服务架构图 (可使用本报告中的 ASCII 图)
- 快速启动指南
- 部署决策树 (何时使用哪种部署方式)

### 7.4 工作区结构

当前 pnpm 工作区包含：
- `.` - 主包
- `ui` - Web UI
- `extensions/*` - 所有扩展

建议考虑将 `apps/` 下的原生应用也纳入统一的构建流程文档。

---

## 附录：关键入口点速查

| 场景 | 入口 | 命令 |
|------|------|------|
| CLI 启动 | `src/cli/run-main.ts` | `pnpm clawdbot` |
| Gateway 启动 | `src/gateway/server.ts` | `pnpm gateway:dev` |
| Agent 执行 | `src/agents/pi-embedded-runner.ts` | `pnpm clawdbot agent` |
| TUI 模式 | `src/tui/` | `pnpm tui` |
| 构建 | `tsc` | `pnpm build` |
| 测试 | `vitest` | `pnpm test` |
| Lint | `oxlint` | `pnpm lint` |

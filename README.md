# 🦞 OpenClawCN — Personal AI Assistant

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/openclawcn/openclawcn/main/docs/assets/openclawcncn-logo-text-dark.png">
        <img src="https://raw.githubusercontent.com/openclawcn/openclawcn/main/docs/assets/openclawcncn-logo-text.png" alt="OpenClawCN" width="500">
    </picture>
</p>

<p align="center">
  <strong>EXFOLIATE! EXFOLIATE!</strong>
</p>

<p align="center">
  <a href="https://github.com/openclawcn/openclawcn/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/openclawcn/openclawcn/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/openclawcn/openclawcn/releases"><img src="https://img.shields.io/github/v/release/openclawcn/openclawcn?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://discord.gg/clawd"><img src="https://img.shields.io/discord/1456350064065904867?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**OpenClawCN** is a _personal AI assistant_ you run on your own devices.
It answers you on the channels you already use (WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, Microsoft Teams, WebChat), plus extension channels like BlueBubbles, Matrix, Zalo, and Zalo Personal. It can speak and listen on macOS/iOS/Android, and can render a live Canvas you control. The Gateway is just the control plane — the product is the assistant.

If you want a personal, single-user assistant that feels local, fast, and always-on, this is it.

[Website](https://openclawcncn.com) · [Docs](https://docs.openclawcncn.com) · [DeepWiki](https://deepwiki.com/openclawcn/openclawcn) · [Getting Started](https://docs.openclawcncn.com/start/getting-started) · [Updating](https://docs.openclawcncn.com/install/updating) · [Showcase](https://docs.openclawcncn.com/start/showcase) · [FAQ](https://docs.openclawcncn.com/start/faq) · [Wizard](https://docs.openclawcncn.com/start/wizard) · [Nix](https://github.com/openclawcn/nix-openclawcn) · [Docker](https://docs.openclawcncn.com/install/docker) · [Discord](https://discord.gg/clawd)

Preferred setup: run the onboarding wizard (`openclawcn onboard`) in your terminal.
The wizard guides you step by step through setting up the gateway, workspace, channels, and skills. The CLI wizard is the recommended path and works on **macOS, Linux, and Windows (via WSL2; strongly recommended)**.
Works with npm, pnpm, or bun.
New install? Start here: [Getting started](https://docs.openclawcncn.com/start/getting-started)

**Subscriptions (OAuth):**

- **[Anthropic](https://www.anthropic.com/)** (Claude Pro/Max)
- **[OpenAI](https://openai.com/)** (ChatGPT/Codex)

Model note: while any model is supported, I strongly recommend **Anthropic Pro/Max (100/200) + Opus 4.6** for long‑context strength and better prompt‑injection resistance. See [Onboarding](https://docs.openclawcncn.com/start/onboarding).

## Models (selection + auth)

- Models config + CLI: [Models](https://docs.openclawcncn.com/concepts/models)
- Auth profile rotation (OAuth vs API keys) + fallbacks: [Model failover](https://docs.openclawcncn.com/concepts/model-failover)

## Install (recommended)

Runtime: **Node ≥22**.

```bash
npm install -g openclawcn@latest
# or: pnpm add -g openclawcn@latest

openclawcn onboard --install-daemon
```

The wizard installs the Gateway daemon (launchd/systemd user service) so it stays running.

## Quick start (TL;DR)

Runtime: **Node ≥22**.

Full beginner guide (auth, pairing, channels): [Getting started](https://docs.openclawcncn.com/start/getting-started)

```bash
openclawcn onboard --install-daemon

openclawcn gateway --port 18789 --verbose

# Send a message
openclawcn message send --to +1234567890 --message "Hello from OpenClawCN"

# Talk to the assistant (optionally deliver back to any connected channel: WhatsApp/Telegram/Slack/Discord/Google Chat/Signal/iMessage/BlueBubbles/Microsoft Teams/Matrix/Zalo/Zalo Personal/WebChat)
openclawcn agent --message "Ship checklist" --thinking high
```

Upgrading? [Updating guide](https://docs.openclawcncn.com/install/updating) (and run `openclawcn doctor`).

## Development channels

- **stable**: tagged releases (`vYYYY.M.D` or `vYYYY.M.D-<patch>`), npm dist-tag `latest`.
- **beta**: prerelease tags (`vYYYY.M.D-beta.N`), npm dist-tag `beta` (macOS app may be missing).
- **dev**: moving head of `main`, npm dist-tag `dev` (when published).

Switch channels (git + npm): `openclawcn update --channel stable|beta|dev`.
Details: [Development channels](https://docs.openclawcncn.com/install/development-channels).

## From source (development)

Prefer `pnpm` for builds from source. Bun is optional for running TypeScript directly.

```bash
git clone https://github.com/openclawcn/openclawcn.git
cd openclawcn

pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build

pnpm openclawcn onboard --install-daemon

# Dev loop (auto-reload on TS changes)
pnpm gateway:watch
```

Note: `pnpm openclawcn ...` runs TypeScript directly (via `tsx`). `pnpm build` produces `dist/` for running via Node / the packaged `openclawcn` binary.

## Security defaults (DM access)

OpenClawCN connects to real messaging surfaces. Treat inbound DMs as **untrusted input**.

Full security guide: [Security](https://docs.openclawcncn.com/gateway/security)

Default behavior on Telegram/WhatsApp/Signal/iMessage/Microsoft Teams/Discord/Google Chat/Slack:

- **DM pairing** (`dmPolicy="pairing"` / `channels.discord.dmPolicy="pairing"` / `channels.slack.dmPolicy="pairing"`; legacy: `channels.discord.dm.policy`, `channels.slack.dm.policy`): unknown senders receive a short pairing code and the bot does not process their message.
- Approve with: `openclawcn pairing approve <channel> <code>` (then the sender is added to a local allowlist store).
- Public inbound DMs require an explicit opt-in: set `dmPolicy="open"` and include `"*"` in the channel allowlist (`allowFrom` / `channels.discord.allowFrom` / `channels.slack.allowFrom`; legacy: `channels.discord.dm.allowFrom`, `channels.slack.dm.allowFrom`).

Run `openclawcn doctor` to surface risky/misconfigured DM policies.

## Highlights

- **[Local-first Gateway](https://docs.openclawcncn.com/gateway)** — single control plane for sessions, channels, tools, and events.
- **[Multi-channel inbox](https://docs.openclawcncn.com/channels)** — WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, BlueBubbles (iMessage), iMessage (legacy), Microsoft Teams, Matrix, Zalo, Zalo Personal, WebChat, macOS, iOS/Android.
- **[Multi-agent routing](https://docs.openclawcncn.com/gateway/configuration)** — route inbound channels/accounts/peers to isolated agents (workspaces + per-agent sessions).
- **[Voice Wake](https://docs.openclawcncn.com/nodes/voicewake) + [Talk Mode](https://docs.openclawcncn.com/nodes/talk)** — always-on speech for macOS/iOS/Android with ElevenLabs.
- **[Live Canvas](https://docs.openclawcncn.com/platforms/mac/canvas)** — agent-driven visual workspace with [A2UI](https://docs.openclawcncn.com/platforms/mac/canvas#canvas-a2ui).
- **[First-class tools](https://docs.openclawcncn.com/tools)** — browser, canvas, nodes, cron, sessions, and Discord/Slack actions.
- **[Companion apps](https://docs.openclawcncn.com/platforms/macos)** — macOS menu bar app + iOS/Android [nodes](https://docs.openclawcncn.com/nodes).
- **[Onboarding](https://docs.openclawcncn.com/start/wizard) + [skills](https://docs.openclawcncn.com/tools/skills)** — wizard-driven setup with bundled/managed/workspace skills.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=openclawcn/openclawcn&type=date&legend=top-left)](https://www.star-history.com/#openclawcn/openclawcn&type=date&legend=top-left)

## Everything we built so far

### Core platform

- [Gateway WS control plane](https://docs.openclawcncn.com/gateway) with sessions, presence, config, cron, webhooks, [Control UI](https://docs.openclawcncn.com/web), and [Canvas host](https://docs.openclawcncn.com/platforms/mac/canvas#canvas-a2ui).
- [CLI surface](https://docs.openclawcncn.com/tools/agent-send): gateway, agent, send, [wizard](https://docs.openclawcncn.com/start/wizard), and [doctor](https://docs.openclawcncn.com/gateway/doctor).
- [Pi agent runtime](https://docs.openclawcncn.com/concepts/agent) in RPC mode with tool streaming and block streaming.
- [Session model](https://docs.openclawcncn.com/concepts/session): `main` for direct chats, group isolation, activation modes, queue modes, reply-back. Group rules: [Groups](https://docs.openclawcncn.com/concepts/groups).
- [Media pipeline](https://docs.openclawcncn.com/nodes/images): images/audio/video, transcription hooks, size caps, temp file lifecycle. Audio details: [Audio](https://docs.openclawcncn.com/nodes/audio).

### Channels

- [Channels](https://docs.openclawcncn.com/channels): [WhatsApp](https://docs.openclawcncn.com/channels/whatsapp) (Baileys), [Telegram](https://docs.openclawcncn.com/channels/telegram) (grammY), [Slack](https://docs.openclawcncn.com/channels/slack) (Bolt), [Discord](https://docs.openclawcncn.com/channels/discord) (discord.js), [Google Chat](https://docs.openclawcncn.com/channels/googlechat) (Chat API), [Signal](https://docs.openclawcncn.com/channels/signal) (signal-cli), [BlueBubbles](https://docs.openclawcncn.com/channels/bluebubbles) (iMessage, recommended), [iMessage](https://docs.openclawcncn.com/channels/imessage) (legacy imsg), [Microsoft Teams](https://docs.openclawcncn.com/channels/msteams) (extension), [Matrix](https://docs.openclawcncn.com/channels/matrix) (extension), [Zalo](https://docs.openclawcncn.com/channels/zalo) (extension), [Zalo Personal](https://docs.openclawcncn.com/channels/zalouser) (extension), [WebChat](https://docs.openclawcncn.com/web/webchat).
- [Group routing](https://docs.openclawcncn.com/concepts/group-messages): mention gating, reply tags, per-channel chunking and routing. Channel rules: [Channels](https://docs.openclawcncn.com/channels).

### Apps + nodes

- [macOS app](https://docs.openclawcncn.com/platforms/macos): menu bar control plane, [Voice Wake](https://docs.openclawcncn.com/nodes/voicewake)/PTT, [Talk Mode](https://docs.openclawcncn.com/nodes/talk) overlay, [WebChat](https://docs.openclawcncn.com/web/webchat), debug tools, [remote gateway](https://docs.openclawcncn.com/gateway/remote) control.
- [iOS node](https://docs.openclawcncn.com/platforms/ios): [Canvas](https://docs.openclawcncn.com/platforms/mac/canvas), [Voice Wake](https://docs.openclawcncn.com/nodes/voicewake), [Talk Mode](https://docs.openclawcncn.com/nodes/talk), camera, screen recording, Bonjour pairing.
- [Android node](https://docs.openclawcncn.com/platforms/android): [Canvas](https://docs.openclawcncn.com/platforms/mac/canvas), [Talk Mode](https://docs.openclawcncn.com/nodes/talk), camera, screen recording, optional SMS.
- [macOS node mode](https://docs.openclawcncn.com/nodes): system.run/notify + canvas/camera exposure.

### Tools + automation

- [Browser control](https://docs.openclawcncn.com/tools/browser): dedicated openclawcn Chrome/Chromium, snapshots, actions, uploads, profiles.
- [Canvas](https://docs.openclawcncn.com/platforms/mac/canvas): [A2UI](https://docs.openclawcncn.com/platforms/mac/canvas#canvas-a2ui) push/reset, eval, snapshot.
- [Nodes](https://docs.openclawcncn.com/nodes): camera snap/clip, screen record, [location.get](https://docs.openclawcncn.com/nodes/location-command), notifications.
- [Cron + wakeups](https://docs.openclawcncn.com/automation/cron-jobs); [webhooks](https://docs.openclawcncn.com/automation/webhook); [Gmail Pub/Sub](https://docs.openclawcncn.com/automation/gmail-pubsub).
- [Skills platform](https://docs.openclawcncn.com/tools/skills): bundled, managed, and workspace skills with install gating + UI.

### Runtime + safety

- [Channel routing](https://docs.openclawcncn.com/concepts/channel-routing), [retry policy](https://docs.openclawcncn.com/concepts/retry), and [streaming/chunking](https://docs.openclawcncn.com/concepts/streaming).
- [Presence](https://docs.openclawcncn.com/concepts/presence), [typing indicators](https://docs.openclawcncn.com/concepts/typing-indicators), and [usage tracking](https://docs.openclawcncn.com/concepts/usage-tracking).
- [Models](https://docs.openclawcncn.com/concepts/models), [model failover](https://docs.openclawcncn.com/concepts/model-failover), and [session pruning](https://docs.openclawcncn.com/concepts/session-pruning).
- [Security](https://docs.openclawcncn.com/gateway/security) and [troubleshooting](https://docs.openclawcncn.com/channels/troubleshooting).

### Ops + packaging

- [Control UI](https://docs.openclawcncn.com/web) + [WebChat](https://docs.openclawcncn.com/web/webchat) served directly from the Gateway.
- [Tailscale Serve/Funnel](https://docs.openclawcncn.com/gateway/tailscale) or [SSH tunnels](https://docs.openclawcncn.com/gateway/remote) with token/password auth.
- [Nix mode](https://docs.openclawcncn.com/install/nix) for declarative config; [Docker](https://docs.openclawcncn.com/install/docker)-based installs.
- [Doctor](https://docs.openclawcncn.com/gateway/doctor) migrations, [logging](https://docs.openclawcncn.com/logging).

## How it works (short)

```
WhatsApp / Telegram / Slack / Discord / Google Chat / Signal / iMessage / BlueBubbles / Microsoft Teams / Matrix / Zalo / Zalo Personal / WebChat
               │
               ▼
┌───────────────────────────────┐
│            Gateway            │
│       (control plane)         │
│     ws://127.0.0.1:18789      │
└──────────────┬────────────────┘
               │
               ├─ Pi agent (RPC)
               ├─ CLI (openclawcn …)
               ├─ WebChat UI
               ├─ macOS app
               └─ iOS / Android nodes
```

## Architecture (详细架构与流转图)

> 以下是整个项目的模块架构、数据流转、钩子时序、各子系统职责的完整图示。

<details>
<summary><strong>点击展开完整架构图 (180+ 模块)</strong></summary>

### 一、全局总览：从启动到消息处理

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│    用户双击 ClawdBot.exe / 命令行 openclawcn                                     │
│                                                                                 │
└───────────────────────────────┬─────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ENTRY POINT  入口层                                                            │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  openclawcn.mjs                                                         │   │
│  │  作用：启动引导，加载 dist/entry.js，初始化 V8 编译缓存                     │   │
│  └────────────────────────────┬─────────────────────────────────────────────┘   │
│                               │ import()                                        │
│  ┌────────────────────────────▼─────────────────────────────────────────────┐   │
│  │  dist/entry.js (编译产物)                                                │   │
│  │  作用：转发到 CLI 路由系统                                                │   │
│  └────────────────────────────┬─────────────────────────────────────────────┘   │
│                               │                                                 │
│            ┌──────────────────┼──────────────────┐                              │
│            ▼                  ▼                  ▼                              │
│   ┌────────────┐    ┌────────────────┐   ┌───────────┐                         │
│   │  CLI 模式   │    │  Gateway 模式  │   │ Desktop   │                         │
│   │(命令行工具) │    │ (后台服务器)   │   │ (Tauri)   │                         │
│   └────────────┘    └───────┬────────┘   └─────┬─────┘                         │
└─────────────────────────────┼───────────────────┼───────────────────────────────┘
                              │                   │
                              ▼                   │
┌──────────────────────────────────────┐          │
│  GATEWAY 启动顺序                     │          │
│  (server.impl.ts → startGateway())   │          │
│                                      │◄─────────┘
│  Step 1: 创建状态目录                │  Tauri 通过 sidecar.rs
│  Step 2: 配置迁移 & 加载             │  spawn Node.js 子进程
│  Step 3: 初始化 StateStore(SQLite)   │  来启动 Gateway
│  Step 4: 加载所有插件                │
│  Step 5: 启动所有频道                │
│  Step 6: 启动 HTTP+WS 服务器(:19002) │
│  Step 7: 启动设备发现(mDNS/Bonjour) │
│  Step 8: 启动定时任务(Cron)          │
│  Step 9: 启动配置热重载监听          │
└──────────────────────────────────────┘
```

**Gateway 核心模块 (`src/gateway/`)**

| 文件 | 作用 |
|------|------|
| `server.impl.ts` | 主入口 (~2400行)，按上述顺序初始化所有子系统 |
| `server-plugins.ts` | 加载 extensions/ 下的所有插件 |
| `server-channels.ts` | 启动并管理所有频道连接 |
| `server-methods.ts` + `server-methods/` | 注册 200+ RPC 方法 (model-config, nodes, agents, chat, skills...) |
| `server-chat.ts` | Agent 事件处理 & 消息路由广播 |
| `server-cron.ts` | 定时任务调度 (心跳/清理/自动更新) |
| `server-ws-runtime.ts` | WebSocket 连接生命周期管理 |
| `server-discovery-runtime.ts` | mDNS/Bonjour 设备发现 |
| `server-mobile-nodes.ts` | 移动设备节点管理 |
| `server-node-subscriptions.ts` | 节点注册 & 心跳保活 |
| `server-wizard-sessions.ts` | 新用户引导向导状态 |
| `server-tailscale.ts` | Tailscale 网络暴露 |
| `hooks.ts` + `hooks-mapping.ts` | 钩子执行引擎 & 注册映射 |
| `auth.ts` | 许可证验证 & 设备认证 |
| `chat-sanitize.ts` | 输入消毒，防注入攻击 |
| `chat-attachments.ts` | 媒体文件附件处理 |
| `error-translate.ts` | 错误码标准化翻译 |
| `distributed-broadcast.ts` | 跨节点消息广播 (多机部署) |
| `cn-handlers.ts` | 中国区定制处理器 |
| `protocol/schema.ts` | 全部 Gateway 消息类型定义 |

---

### 二、核心消息流转：一条消息的完整生命周期

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  用户在 Telegram / Discord / WeChat / Web UI / ... 发了一条消息                   │
│                                                                                  │
└─────────────────────────────────┬────────────────────────────────────────────────┘
                                  │
                                  ▼
╔══════════════════════════════════════════════════════════════════════════════════╗
║  STEP 1: 频道接收                                                                ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  Channel Plugin (extensions/telegram/ 或 discord/ 或 wechat/ 等)        │   ║
║  │                                                                          │   ║
║  │  干嘛的：每个频道插件实现 ChannelPlugin 接口，负责：                       │   ║
║  │  - 接收该平台的原始消息 (Webhook/长轮询/WebSocket)                        │   ║
║  │  - 解码平台特定格式 → 统一的 OpenClawCN 消息格式                          │   ║
║  │  - 处理平台特有功能 (表情回应、群@、引用回复等)                            │   ║
║  │                                                                          │   ║
║  │  调用方式：plugin.onMessage(rawPayload) → 标准化消息                      │   ║
║  └──────────────────────────────┬───────────────────────────────────────────┘   ║
╚═════════════════════════════════┼════════════════════════════════════════════════╝
                                  │ 标准化消息传入 Gateway
                                  ▼
╔══════════════════════════════════════════════════════════════════════════════════╗
║  STEP 2: 安全检查 & 权限校验                                                     ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  Gateway 安全层 (src/gateway/ + src/channels/)                          │   ║
║  │                                                                          │   ║
║  │  (1) allowlist-match.ts  → 用户是否在白名单？不在就拒绝                   │   ║
║  │  (2) mention-gating.ts   → 群聊里是否 @了机器人？没有就忽略               │   ║
║  │  (3) chat-sanitize.ts    → 输入消毒：防注入/过滤恶意内容                  │   ║
║  │  (4) auth.ts             → 许可证/设备认证校验                            │   ║
║  │                                                                          │   ║
║  │  全部通过才继续，否则直接丢弃或返回权限不足提示                            │   ║
║  └──────────────────────────────┬───────────────────────────────────────────┘   ║
╚═════════════════════════════════┼════════════════════════════════════════════════╝
                                  │ 安全检查通过
                                  ▼
╔══════════════════════════════════════════════════════════════════════════════════╗
║  STEP 3: 路由解析 — 这条消息该交给哪个 Agent？                                    ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  resolveAgentRoute() — src/routing/resolve-route.ts                     │   ║
║  │                                                                          │   ║
║  │  干嘛的：根据消息来源，确定由哪个 Agent 来处理                            │   ║
║  │                                                                          │   ║
║  │  路由优先级（从高到低）：                                                 │   ║
║  │  ┌─────────────────────────────────────────────────────────────────┐     │   ║
║  │  │  Tier 1: binding.peer        精确匹配 (频道+联系人ID)          │     │   ║
║  │  │  Tier 2: binding.peer.parent 父线程匹配 (回复链)               │     │   ║
║  │  │  Tier 3: binding.guild+roles 服务器+角色匹配                   │     │   ║
║  │  │  Tier 4: binding.guild       服务器匹配                        │     │   ║
║  │  │  Tier 5: binding.team        团队匹配                          │     │   ║
║  │  │  Tier 6: binding.account     账号级匹配                        │     │   ║
║  │  │  Tier 7: binding.channel     频道级通配                        │     │   ║
║  │  │  Tier 8: default             使用默认 Agent                    │     │   ║
║  │  └─────────────────────────────────────────────────────────────────┘     │   ║
║  │                                                                          │   ║
║  │  输出：{ agentId, sessionKey, matchedBy }                                │   ║
║  └──────────────────────────────┬───────────────────────────────────────────┘   ║
║                                 │                                               ║
║                                 ▼                                               ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  Hook: resolve_agent — src/gateway/hooks.ts                             │   ║
║  │                                                                          │   ║
║  │  干嘛的：插件可以拦截路由，覆盖默认路由决策                               │   ║
║  │                                                                          │   ║
║  │  Agent-Team 插件的三级路由：                                              │   ║
║  │  ┌───────────────────────────────────────────────────────────┐           │   ║
║  │  │  Level 1: 亲和性缓存 (session-affinity.ts)                │           │   ║
║  │  │  → 这个用户上次跟哪个成员聊的？直接命中，跳过LLM           │           │   ║
║  │  │                     | 未命中                               │           │   ║
║  │  │                     v                                     │           │   ║
║  │  │  Level 2: 关键词路由 (keyword-router.ts)                  │           │   ║
║  │  │  → 消息里有"下单""发货"→ 匹配客服Agent，跳过LLM           │           │   ║
║  │  │                     | 未命中                               │           │   ║
║  │  │                     v                                     │           │   ║
║  │  │  Level 3: Supervisor LLM (supervisor-soul.ts)             │           │   ║
║  │  │  → 让 Supervisor 大模型判断该转给谁（最慢但最准）          │           │   ║
║  │  └───────────────────────────────────────────────────────────┘           │   ║
║  └──────────────────────────────┬───────────────────────────────────────────┘   ║
╚═════════════════════════════════┼════════════════════════════════════════════════╝
                                  │ 确定了目标 Agent
                                  ▼
╔══════════════════════════════════════════════════════════════════════════════════╗
║  STEP 4: 自动回复决策 — 用模板还是用AI？                                          ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  getReply() — src/auto-reply/reply.ts                                   │   ║
║  │                                                                          │   ║
║  │  干嘛的：决策这条消息怎么回复                                             │   ║
║  │                                                                          │   ║
║  │  决策树：                                                                 │   ║
║  │                                                                          │   ║
║  │  消息进来                                                                │   ║
║  │    |                                                                     │   ║
║  │    +- 是心跳消息？ --YES--> 返回心跳回复，结束                            │   ║
║  │    |                                                                     │   ║
║  │    +- 匹配模板触发器？ --YES--> resolveTemplateReply()                   │   ║
║  │    |  (config.autoReply.templates 里定义的关键词/正则)                    │   ║
║  │    |  → 返回模板文本，结束                                               │   ║
║  │    |                                                                     │   ║
║  │    +- 都不匹配 → 进入AI Agent处理流程 --> STEP 5                         │   ║
║  └──────────────────────────────┬───────────────────────────────────────────┘   ║
╚═════════════════════════════════┼════════════════════════════════════════════════╝
                                  │ 需要 AI Agent 处理
                                  ▼
╔══════════════════════════════════════════════════════════════════════════════════╗
║  STEP 5: 调度引擎 — 需要什么工具？多复杂？                                        ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  dispatchRequest() — src/dispatch/engine.ts                             │   ║
║  │                                                                          │   ║
║  │  干嘛的：分析用户意图，发现可用工具，评估复杂度                            │   ║
║  │                                                                          │   ║
║  │  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐                │   ║
║  │  │ intent-     │    │ tool-        │    │ capability-  │                │   ║
║  │  │ classifier  │--->│ discovery    │--->│ registry     │                │   ║
║  │  │ 意图分类    │    │ 工具发现     │    │ 模型能力匹配 │                │   ║
║  │  │ (规则+NLP)  │    │ (技能市场+   │    │ (能调工具?   │                │   ║
║  │  │             │    │  已安装MCP)  │    │  能看图?)    │                │   ║
║  │  └─────────────┘    └──────────────┘    └──────────────┘                │   ║
║  │         |                                                                │   ║
║  │         v                                                                │   ║
║  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │   ║
║  │  │ tool-filter  │    │ tool-selector│    │ modality-    │               │   ║
║  │  │ 权限过滤     │--->│ 排序打分     │    │ router       │               │   ║
║  │  │              │    │ 选最佳工具   │    │ (文/图/音/   │               │   ║
║  │  │              │    │              │    │  视频路由)   │               │   ║
║  │  └──────────────┘    └──────────────┘    └──────────────┘               │   ║
║  │                                                                          │   ║
║  │  其他调度子模块：                                                         │   ║
║  │  - step-runner.ts    多步工作流执行器                                     │   ║
║  │  - dag-executor.ts   DAG并行任务执行图                                    │   ║
║  │  - result-merger.ts  多步骤结果合并                                       │   ║
║  │  - smooth-fallback   工具失败时优雅降级                                   │   ║
║  │  - resource-guard    速率限制 & 配额管控                                  │   ║
║  │  - provider-health   模型提供者健康监控                                   │   ║
║  │                                                                          │   ║
║  │  输出 RoutingDecision:                                                   │   ║
║  │  { intent, skillHints, mcpToolHints, modelOverride, complexity }         │   ║
║  └──────────────────────────────┬───────────────────────────────────────────┘   ║
╚═════════════════════════════════┼════════════════════════════════════════════════╝
                                  │
                                  ▼
╔══════════════════════════════════════════════════════════════════════════════════╗
║  STEP 6: Hook 注入上下文                                                         ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  Hook: before_agent_start                                               │   ║
║  │                                                                          │   ║
║  │  干嘛的：在 Agent 真正跑之前，往系统提示词里"塞"额外上下文                  │   ║
║  │                                                                          │   ║
║  │  Agent-Team 插件注入：                                                    │   ║
║  │  - 团队共享记忆 (memory-share-tool.ts)                                    │   ║
║  │  - 工作流指令 (task-coordinator.ts)                                       │   ║
║  │  - 成员角色说明 (system-prompt.ts)                                        │   ║
║  │  - 联邦上下文 (跨团队共享的信息)                                           │   ║
║  │                                                                          │   ║
║  │  Orchestrator 插件注入：                                                  │   ║
║  │  - 模板上下文 / 推荐工具列表                                              │   ║
║  └──────────────────────────────┬───────────────────────────────────────────┘   ║
╚═════════════════════════════════┼════════════════════════════════════════════════╝
                                  │
                                  ▼
╔══════════════════════════════════════════════════════════════════════════════════╗
║  STEP 7: Agent 执行 — 核心AI推理                                                 ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  runAgentTurnWithFallback() — agent-runner-execution.ts                 │   ║
║  │                                                                          │   ║
║  │  干嘛的：带模型降级的 Agent 执行，一个模型失败自动试下一个                   │   ║
║  │  降级链：Claude → GPT-4 → Gemini → 国产大模型 → ...                      │   ║
║  └──────────────────────────────┬───────────────────────────────────────────┘   ║
║                                 │                                               ║
║                                 ▼                                               ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  runEmbeddedAttempt() — pi-embedded-runner/run/attempt.ts               │   ║
║  │                                                                          │   ║
║  │  干嘛的：单次 LLM 推理调用，这是真正"问AI"的地方                           │   ║
║  │                                                                          │   ║
║  │  7a. 加载技能环境                                                        │   ║
║  │      loadWorkspaceSkillEntries() → 从 agent/skills/ 加载已安装MCP        │   ║
║  │      resolveSkillsPromptForRun() → 生成技能描述文本                      │   ║
║  │                                                                          │   ║
║  │  7b. 构建系统提示词                                                      │   ║
║  │      buildEmbeddedSystemPrompt()                                         │   ║
║  │      +-- 基础指令 (你是xxx，你要xxx)                                     │   ║
║  │      +-- 频道能力 (支持发图/发文件/发语音吗)                              │   ║
║  │      +-- 记忆注入 (用户画像 + 冷记忆)                                    │   ║
║  │      +-- 技能摘要 (有哪些工具可用)                                       │   ║
║  │      +-- TTS提示 (语音场景)                                              │   ║
║  │                                                                          │   ║
║  │  7c. 组装工具列表                                                        │   ║
║  │      +-- 内置工具 (bash, file, web 等)                                   │   ║
║  │      +-- 插件工具 (plugin registry 注册的)                               │   ║
║  │      +-- MCP工具 (从MCP Server动态获取的)                                │   ║
║  │                                                                          │   ║
║  │  7d. 加载会话历史                                                        │   ║
║  │      prepareSessionManagerForRun()                                       │   ║
║  │      → 从磁盘加载对话记录，太长自动压缩(compaction)                      │   ║
║  │                                                                          │   ║
║  │  7e. 调用 LLM                                                           │   ║
║  │      streamSimple() → 发送请求到 LLM API                                │   ║
║  │      支持 50+ 提供者：Anthropic/OpenAI/Google/通义/智谱/DeepSeek...      │   ║
║  │      通过 auth-profiles/ 管理多个API Key                                 │   ║
║  │                                                                          │   ║
║  │  7f. 流式接收 & 工具调用                                                 │   ║
║  │      subscribeEmbeddedPiSession()                                        │   ║
║  │      ┌─────────────────────────────────────────────┐                     │   ║
║  │      │  LLM 返回文本 → 流式输出                     │                     │   ║
║  │      │  LLM 要求调工具 → 执行工具 → 结果给回LLM     │  ← 可能多轮循环    │   ║
║  │      │  LLM 返回最终答案 → 结束                     │                     │   ║
║  │      └─────────────────────────────────────────────┘                     │   ║
║  │                                                                          │   ║
║  │  错误处理：                                                               │   ║
║  │  - 上下文溢出 → 重置会话 + 重试                                           │   ║
║  │  - 角色排序冲突 → 重置会话 + 重试                                         │   ║
║  │  - HTTP 临时错误 → 走降级链重试                                           │   ║
║  └──────────────────────────────┬───────────────────────────────────────────┘   ║
╚═════════════════════════════════┼════════════════════════════════════════════════╝
                                  │ Agent 生成回复
                                  ▼
╔══════════════════════════════════════════════════════════════════════════════════╗
║  STEP 8: 后处理 Hooks                                                            ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  Hook: agent_end — Agent跑完后的收尾                                     │   ║
║  │  - member-health.ts  → 更新健康分数(响应速度、成功率)                      │   ║
║  │  - member-stats.ts   → 统计Token消耗、调用次数                            │   ║
║  │  - learning-engine   → 记录交互结果，优化未来路由                          │   ║
║  └──────────────────────────────┬───────────────────────────────────────────┘   ║
║                                 │                                               ║
║  ┌──────────────────────────────▼───────────────────────────────────────────┐   ║
║  │  Hook: message_sending — 消息发出前的最后加工                             │   ║
║  │  - visibility-rewriter.ts → 隐藏内部工具调用细节/team内部通信             │   ║
║  │  - 输出格式化：Markdown→平台适配                                          │   ║
║  └──────────────────────────────┬───────────────────────────────────────────┘   ║
╚═════════════════════════════════┼════════════════════════════════════════════════╝
                                  │
                                  ▼
╔══════════════════════════════════════════════════════════════════════════════════╗
║  STEP 9: 广播 & 投递                                                             ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  emitAgentEvent() — src/infra/agent-events.ts                           │   ║
║  │  干嘛的：把Agent事件广播给所有监听者                                       │   ║
║  │                                                                          │   ║
║  │  事件类型：                                                               │   ║
║  │  - stream:"delta"     → 流式文本片段(打字机效果)                          │   ║
║  │  - stream:"final"     → 最终完整回复                                      │   ║
║  │  - stream:"tool"      → 工具调用开始/结果                                 │   ║
║  │  - stream:"thinking"  → 推理过程                                          │   ║
║  │  - stream:"lifecycle" → 运行状态变更                                      │   ║
║  └──────────────────────────────┬───────────────────────────────────────────┘   ║
║                                 │                                               ║
║  ┌──────────────────────────────▼───────────────────────────────────────────┐   ║
║  │  createAgentEventHandler() — server-chat.ts                             │   ║
║  │  干嘛的：转化为聊天消息，广播到各端                                        │   ║
║  │                                                                          │   ║
║  │  广播目标：                                                               │   ║
║  │  (1) broadcast("chat") → 所有 WebSocket 客户端 (Web UI)                 │   ║
║  │  (2) nodeSendToSession() → 特定会话监听者                                │   ║
║  │  (3) distributed-broadcast → 跨节点广播 (多机部署)                       │   ║
║  └──────────────────────────────┬───────────────────────────────────────────┘   ║
╚═════════════════════════════════┼════════════════════════════════════════════════╝
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
           ┌──────────────┐ ┌──────────┐ ┌───────────────┐
           │ Channel Plugin│ │ Web UI   │ │ 持久化         │
           │ →平台编码→发送│ │ WebSocket│ │ sessions.ts   │
           │ 给用户        │ │ 推送更新 │ │ state-store   │
           └──────────────┘ └──────────┘ │ memory-lancedb│
                                         └───────────────┘
```

**关键调用链一览**

```
消息到达 → Channel.onMessage()
  → allowlist/mention/sanitize 安全检查
  → resolveAgentRoute() 路由解析
  → Hook:resolve_agent 插件路由拦截
  → getReply() 模板/AI决策
  → dispatchRequest() 意图分类+工具发现
  → Hook:before_agent_start 上下文注入
  → runAgentTurnWithFallback() 带降级的Agent执行
    → runEmbeddedAttempt() 单次LLM调用
      → streamSimple() 调LLM API
      → subscribeEmbeddedPiSession() 流式接收+工具循环
  → Hook:agent_end 健康/统计/学习
  → Hook:message_sending 可见性重写
  → emitAgentEvent() 事件广播
    → broadcast("chat") WebSocket推送
    → Channel.sendMessage() 回到平台
    → sessions.save() 持久化
```

---

### 三、插件注册 & 钩子流转

```
Gateway 启动时 → loadGatewayPlugins() (server-plugins.ts)

(1) 发现插件
    discoverOpenClawCNPlugins()
    扫描：extensions/ (内置) + ~/.openclawcn/plugins/ (用户安装)
                 |
                 v
(2) 加载清单
    loadPluginManifestRegistry()
    读取 manifest.json → 提取 id/name/version/kind
                 |
                 v
(3) 加载模块
    +-- 有 .jsc 字节码？ → createRequire() 原生加载 (IP保护)
    +-- 否则 → jiti() 动态 TypeScript 加载
                 |
                 v
(4) 调用 register(api)
    每个插件拿到 PluginApi 对象，可以：

    api.registerTool(name, factory)
    → 注册 Agent 可调用的工具

    api.registerGatewayHandler("method.name", handler)
    → 注册 RPC 方法，UI 和 CLI 可调用

    api.on("hookName", handler)
    → 订阅生命周期钩子

    api.registerCommand("/cmd", handler)
    → 注册聊天命令

    api.registerService("svc", impl)
    → 注册后台服务
                 |
                 v
(5) 初始化全局钩子运行器
    initializeGlobalHookRunner(registry)
    → 构建 hookName → [handler1, handler2, ...] 索引
    → 运行时按注册顺序串行执行
```

**钩子触发时序 (每条消息)：**

```
消息进来
  |
  +--> resolve_agent ---------> 决定哪个Agent处理
  |
  +--> before_agent_start ----> 注入额外上下文到系统提示词
  |
  +--> [Agent 执行中...]
  |      |
  |      +--> before_tool_call -> 校验/修改工具输入
  |      +--> after_tool_call --> 处理工具返回结果
  |
  +--> agent_end -------------> 更新健康/统计/学习
  |
  +--> message_sending -------> 最终输出加工
```

**插件系统模块 (`src/plugins/`)**

| 文件 | 作用 |
|------|------|
| `types.ts` | 核心类型：PluginDefinition, PluginApi, PluginToolFactory, ProviderPlugin |
| `discovery.ts` | 自动扫描发现插件目录 |
| `loader.ts` | 从磁盘加载插件模块 |
| `registry.ts` | 内存插件注册表 |
| `enable.ts` | 插件启用/禁用管理 |
| `install.ts` | npm 安装插件 |
| `hooks.ts` | 钩子注册 |
| `commands.ts` | 聊天命令注册 |
| `http-registry.ts` | HTTP 路由注册 |
| `config-schema.ts` | Zod 校验插件配置 |
| `config-state.ts` | 每个插件的配置存储 |
| `hook-runner-global.ts` | 全局钩子执行管线 |

**扩展插件一览 (`extensions/`)**

| 分类 | 插件 | 作用 |
|------|------|------|
| 核心编排 | `agent-team/` (~2400行) | 多Agent团队、Supervisor路由、亲和性缓存、共享记忆、学习引擎 |
| 核心编排 | `orchestrator/` | 计划驱动团队创建、模板匹配、能力推断、成本估算 |
| 频道 | `telegram/` `discord/` `slack/` `whatsapp/` `wechat/` `feishu/` `dingtalk/` `qqbot/` `line/` `signal/` `matrix/` `irc/` `msteams/` `googlechat/` `mattermost/` `twitch/` `nostr/` `wecom/` `imessage/` `bluebubbles/` ... | 50+ 即时通讯平台 |
| 记忆 | `memory-core/` `memory-lancedb/` | 抽象记忆接口 + 向量DB |
| 认证 | `google-antigravity-auth/` `google-gemini-cli-auth/` `minimax-portal-auth/` `qwen-portal-auth/` | LLM平台认证 |
| 工具 | `llm-task/` `voice-call/` `copilot-proxy/` `open-prose/` `lobster/` | 通用任务/语音/Copilot/长文/API代理 |
| 诊断 | `diagnostics-otel/` | OpenTelemetry 集成 |

---

### 四、UI ↔ Gateway 通信流转

```
┌──── Web UI (Lit 3 + Vite 5 + TailwindCSS) ─────────────────────────────────┐
│                                                                              │
│  controllers/                views/              components/                 │
│  ┌─────────────┐            ┌─────────────┐     ┌─────────────┐            │
│  │ chat.ts      │            │ chat.ts      │     │ 可复用组件   │            │
│  │ 聊天逻辑     │----------->│ 聊天界面     │     │ 按钮/表单等  │            │
│  ├─────────────┤            ├─────────────┤     └─────────────┘            │
│  │ skills.ts    │            │ skills.ts    │     i18n/                      │
│  │ 技能市场逻辑 │----------->│ 技能市场页   │     ┌─────────────┐            │
│  ├─────────────┤            ├─────────────┤     │ 中英文翻译   │            │
│  │orchestrator  │            │ config.ts    │     └─────────────┘            │
│  │.ts 团队管理  │----------->│ 设置界面     │                                │
│  ├─────────────┤            ├─────────────┤                                │
│  │ config/      │            │ usage.ts     │                                │
│  │ 多表单配置   │            │ 用量统计页   │                                │
│  └──────┬──────┘            └─────────────┘                                │
│         │  所有 Controller 通过 GatewayBrowserClient 通信                    │
└─────────┼────────────────────────────────────────────────────────────────────┘
          │
          │  双向 WebSocket 连接
          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  GatewayBrowserClient                                                        │
│                                                                              │
│  UI → Gateway (请求):                                                        │
│  client.request("chat.send", { sessionKey, message })                       │
│  client.request("config.get")                                               │
│  client.request("models.list")                                              │
│  client.request("team.project.list")                                        │
│  ...200+ 个 RPC 方法                                                        │
│                                                                              │
│  Gateway → UI (推送):                                                        │
│  on("chat", payload)    → 流式聊天消息 (delta/final)                        │
│  on("status", payload)  → Agent运行状态变更                                  │
│  on("config", payload)  → 配置变更通知                                       │
│  on("channel", payload) → 频道状态变更                                       │
│  on("node", payload)    → 节点上下线通知                                     │
└──────────────────────────────────────────────────────────────────────────────┘

构建部署：cd ui && pnpm build → dist/control-ui/ → Gateway :19002 静态服务
Tauri WebView 加载 http://127.0.0.1:19002/ (不是 Vite 5173！)
```

---

### 五、Desktop 应用流转 (Tauri)

```
用户双击 ClawdBot.exe (Windows) / ClawdBot.app (macOS)

┌──── Tauri App (Rust) ───────────────────────────────────────────────────────┐
│                                                                              │
│  main.rs — 初始化Tauri应用、创建窗口、系统托盘                                │
│       |                                                                      │
│       v                                                                      │
│  sidecar.rs — 管理 Node.js 进程的生命周期                                    │
│  - spawn("node", ["dist/entry.js"]) 启动 Gateway                            │
│  - 传递 PORT=19002 + AUTH_TOKEN 环境变量                                     │
│  - 监控进程健康，崩溃自动重启                                                 │
│       |                                                                      │
│       v                                                                      │
│  Gateway :19002 启动成功 → WebView 加载 http://127.0.0.1:19002/             │
│                                                                              │
│  commands.rs — IPC 桥接，前端 JS 调用 Rust 函数                              │
│  repair/ — 离线诊断修复 (Gateway 起不来时的应急工具)                           │
│  platform/ — Windows/macOS 平台特定代码                                      │
│  nsis/ — Windows NSIS 安装器脚本                                             │
└──────────────────────────────────────────────────────────────────────────────┘

整体流转:

Tauri(Rust) --spawn--> Node.js Gateway(:19002)
     |                        |
     |  WebView               |  静态服务 dist/control-ui/
     +----------> http://127.0.0.1:19002/ <---- WebSocket 双向通信

其他原生平台: apps/ios/ (Swift)  |  apps/android/ (Kotlin)
```

---

### 六、配置系统流转

```
~/.openclawcn/config.json (JSON5 格式)

=== 加载 ===
loadConfig() (src/config/config.ts)
  +-- 读取磁盘 → parseConfigJson5()
  +-- Zod Schema 校验
  +-- 校验失败？ → tryRepairConfig()
  |     +-- L0.5: 修复笔误 (baseHash不匹配)
  |     +-- L1: 回滚到上一份良好备份
  |     +-- L2: 三备份恢复 (atomic triple-backup)
  +-- 环境变量覆盖 → runtime-overrides.ts
  +-- 缓存到内存 (单例)

=== 写入 (防护体系) ===
writeConfigFile() (src/config/config-rollback.ts)
  +-- withConfigWriteLock() → 加锁防并发
  +-- 计算 baseHash → 乐观锁检测外部修改
  +-- 写入临时文件 .tmp → 原子重命名
  +-- 轮转3份备份 → config.bak.1/2/3

=== 分发到子系统 (3种方式) ===
方式1: 函数参数   Agent Runner / Plugin / Dispatch ← params.config
方式2: 懒加载     loadConfig()  // 内存单例
方式3: 热重载     startGatewayConfigReloader(callback)

=== 配置各Section的消费者 ===
config.agents.list     → 路由系统
config.bindings        → 消息→Agent映射
config.plugins         → 插件加载器
config.channels        → 频道管理器
config.autoReply       → 自动回复
config.dispatch        → 调度引擎
config.gateway.tls     → HTTPS
config.gateway.auth    → 认证
config.stateStore      → Redis/内存/SQLite
config.toolDiscovery   → 工具自动发现
config.session         → 会话行为
```

---

### 七、基础设施层流转 (`src/infra/`)

```
=== Node.js 隔离 ===
bundled-node.ts → 用自带 Node 22，不依赖系统Node
Gateway启动 → 解析内置Node路径 → MCP Server 用内置 node/npx 启动

=== 状态存储 ===
Agent事件 ---> state-store(SQLite) ---> skills缓存/媒体清单/运行状态
会话历史 ---> sessions.ts ---> 磁盘JSON
向量记忆 ---> memory-lancedb ---> LanceDB文件

=== 设备发现 & 配对 ===
Gateway启动 → bonjour.ts(mDNS广播) → 手机/电脑发现
  → device-pairing.ts(扫码配对) → server-mobile-nodes.ts(注册节点) → 心跳保活

=== 心跳 & 定时任务 ===
server-cron.ts → heartbeat-runner.ts(健康检查) + cron/service.ts(定时Agent)
  + update-runner.ts(自动更新)

=== 安全 & 加密 ===
API Key → secure-storage.ts(AES加密) → content-vault.ts
危险命令 → exec-approvals.ts(白名单检查)

=== 用量追踪 ===
LLM调用 → session-cost-usage.ts → provider-usage.ts → UI usage.ts(图表)
```

| 模块 | 作用 |
|------|------|
| `bundled-node.ts` | 内置 Node.js 22 路径解析，隔离系统 Node |
| `state-store/` | SQLite 运行时状态 |
| `heartbeat-runner.ts` | 定期健康检查 |
| `bonjour.ts` | mDNS 服务广播发现 |
| `tailscale.ts` | Tailnet 集成 |
| `device-pairing.ts` | QR码设备配对 |
| `device-identity.ts` | 机器指纹 |
| `update-runner.ts` | 自动更新 |
| `skills-remote.ts` | 远程MCP技能注册 |
| `provider-usage.ts` | LLM用量统计 |
| `session-cost-usage.ts` | Token消耗追踪 |
| `exec-approvals.ts` | 危险命令白名单 |
| `secure-storage.ts` | API Key 加密存储 |
| `control-ui-assets.ts` | UI dist 文件定位 |
| `outbound/` | 外发消息(webhook) |
| `net/` | 网络工具(ping/端口) |
| `tls/` | TLS证书管理 |

---

### 八、Agent-Team 多Agent协作流转

```
用户说："帮我查一下上周的销售数据，然后生成一份报告"

=== Orchestrator 创建团队 ===

UI orchestrator.ts --request--> "team.project.createFromPlan"
  planning-pipeline.ts
  +-- gathering-questions.ts → 收集需求
  +-- capability-inference.ts → 推断需要什么能力
  +-- cost-estimator.ts → 估算成本
  +-- soul-validator.ts → 验证Agent人设

输出团队：
  Supervisor Agent (监督者，负责分配任务)
  +-- Member A: 数据分析师 (擅长SQL/数据处理)
  +-- Member B: 报告撰写员 (擅长文档/排版)
  +-- Member C: 图表专家 (擅长数据可视化)

=== 消息路由到团队 (Hook: resolve_agent) ===

fast-path-router.ts 三级路由：
  Level 1: session-affinity.ts 亲和性缓存
    → "这用户上次跟谁聊的？直接命中" (跳过LLM)
  Level 2: keyword-router.ts 关键词匹配
    → "销售数据" → 匹配数据分析师 (跳过LLM)
  Level 3: supervisor-soul.ts LLM判断
    → Supervisor大模型决定转给谁 (最慢但最准)

=== 团队协作执行 ===

Member A (数据分析师) 执行：
  Hook:before_agent_start → 注入共享记忆+工作流+角色说明
  → 查询数据库 → 获得销售数据
  → memory-share-tool.ts → 写入团队共享记忆
  → task-coordinator.ts → 标记完成，触发下一步
  → Hook:agent_end → 更新健康分 + 记录学习

Member B (报告撰写员) 被触发：
  → 从共享记忆读取查询结果 → 生成报告 → 返回给用户

辅助子系统：
  conversation-compactor.ts — 对话太长自动压缩
  auto-promote.ts — 优秀成员自动提升优先级
  soul-optimizer.ts — 根据历史优化成员人设("人设进化")
```

---

### 九、MCP 技能 & 工具调用流转

```
=== 技能安装 ===
UI skills.ts → "skills.install" → Gateway
  → skills-remote.ts (远程注册中心)
  → npm install / git clone
  → 保存到 ~/.openclawcn/agent/skills/{skill-id}/
  → state-store 记录安装信息

=== Agent 调用 MCP 工具 ===
Agent 推理中，LLM 决定调用 "weather_lookup"
  → tool-policy.ts 检查权限
  → skills/serialize.ts 找到 MCP Server 进程
  → MCP Server (独立进程，内置 Node 22 启动)
  → JSON-RPC 通信 → 返回结果
  → 结果送回 LLM，继续推理
```

**Agent 运行时模块 (`src/agents/`)**

| 模块 | 作用 |
|------|------|
| `pi-embedded-runner.ts` | 主 Agent 执行器 |
| `run/attempt.ts` | 单次 LLM 推理调用 |
| `abort.ts` | 优雅取消 Agent |
| `session-manager-init.ts` | 会话初始化和历史加载 |
| `pi-embedded-messaging.ts` | 消息格式化 |
| `agent-scope.ts` | Agent ID/工作区/配置路径 |
| `auth-profiles/` | 多API Key管理 (profiles, oauth, order, repair) |
| `tool-policy.ts` | 工具执行授权 |
| `tool-mutation.ts` | 运行时修改工具定义 |
| `tool-summaries.ts` | 为 LLM 生成工具描述 |
| `skills/serialize.ts` | MCP 工具格式化 |
| `tools/web-tools.ts` | 网页浏览/搜索/抓取 |
| `tools/bash-tools.ts` | Shell 命令执行 |
| `cloudflare-ai-gateway.ts` | AI Gateway 代理 |

---

### 十、CLI 命令流转

```
用户输入: openclawcn gateway start

openclawcn.mjs
  → dist/entry.js
  → src/cli/route.ts (命令路由)
  → src/cli/program/build-program.ts (Commander 组装)
  → 匹配子命令 "gateway" → gateway-cli.ts
  → 匹配动作 "start" → startGatewayServer()

其他命令：
  openclawcn config edit     → config-cli.ts     → 编辑 config.json
  openclawcn channels list   → channels-cli.ts   → 列出频道状态
  openclawcn plugins install → plugins-cli.ts    → npm install 插件
  openclawcn models list     → models-cli.ts     → 列出可用模型
  openclawcn devices pair    → pairing-cli.ts    → 显示配对二维码
  openclawcn update check    → update-cli.ts     → 检查新版本
  openclawcn logs tail       → logs-cli.ts       → 实时查看日志
  openclawcn skills test     → skills-cli.ts     → 测试MCP技能
```

---

### 十一、模块依赖关系总图

```
                    ┌──────────────────┐
                    │    CLI (入口)     │
                    └────────┬─────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │      GATEWAY SERVER          │
              │    (一切的中心枢纽)            │
              │    HTTP+WS :19002            │
              └──┬───┬───┬───┬───┬───┬───┬──┘
                 │   │   │   │   │   │   │
    ┌────────────┘   │   │   │   │   │   └────────────┐
    ▼                │   │   │   │   │                ▼
┌────────┐          │   │   │   │   │          ┌───────────┐
│PLUGINS │          │   │   │   │   │          │  CONFIG   │
│插件系统 │<---------+   │   │   │   +--------->│  配置系统  │
│加载/注册│              │   │   │              │加载/校验   │
│/执行    │              │   │   │              │/修复/分发  │
└───┬────┘              │   │   │              └─────┬─────┘
    │                    │   │   │                    │
    ▼                    │   │   │                    ▼
┌────────┐              │   │   │              ┌───────────┐
│CHANNELS│              │   │   │              │  INFRA    │
│频道系统 │<-------------+   │   +------------->│ 基础设施   │
│50+平台  │                  │                  │网络/存储   │
└───┬────┘                  │                  │/安全/更新  │
    │                       │                  └───────────┘
    ▼                       │
┌────────┐                  │                  ┌───────────┐
│ROUTING │                  │                  │  LOGGING  │
│路由系统 │                  │                  │ 日志/诊断  │
└───┬────┘                  │                  └───────────┘
    │                       │
    ▼                       │
┌────────┐                  │
│DISPATCH│                  │
│调度引擎 │<-----------------+
│意图/工具│
└───┬────┘
    │
    ▼
┌──────────────────┐          ┌──────────────────┐
│  AGENT RUNNER    │          │  AUTO-REPLY      │
│  Agent 执行器    │<---------│  模板/AI决策      │
│  LLM/工具/降级   │          └──────────────────┘
└───┬──────────────┘
    │
    ▼
┌──────────────────┐          ┌──────────────────┐
│  EXTENSIONS      │          │  UI (前端)        │
│  agent-team      │   WS推送  │  Lit 3 Web组件    │
│  orchestrator    │<---------│  controllers/     │
│  memory-*        │          │  views/           │
│  50+ channels    │          └────────┬─────────┘
│  voice/auth/...  │                   |
└──────────────────┘          ┌────────▼─────────┐
                              │  DESKTOP (Tauri)   │
                              │  Rust原生壳        │
                              └────────────────────┘
```

---

### 十二、目录结构速查

```
openclawcn/
├── openclawcn.mjs            # 入口引导
├── package.json              # pnpm workspace
├── src/                      # 主源码
│   ├── gateway/              #   HTTP/WS 网关 (中心枢纽)
│   ├── agents/               #   Agent 运行时 (LLM/工具)
│   ├── plugins/              #   插件架构 (注册/发现)
│   ├── dispatch/             #   调度引擎 (意图/工具/DAG)
│   ├── routing/              #   消息路由 (消息→Agent)
│   ├── channels/             #   频道抽象 (多平台)
│   ├── config/               #   配置 (加载/校验/修复)
│   ├── infra/                #   基础设施 (网络/存储/安全)
│   ├── cli/                  #   CLI (50+子命令)
│   ├── auto-reply/           #   自动回复 (模板/AI)
│   ├── memory/               #   Agent 持久记忆
│   ├── voice/                #   TTS/STT 语音
│   ├── cron/                 #   定时任务
│   ├── browser/              #   浏览器自动化
│   ├── terminal/             #   Shell/PTY
│   ├── media-understanding/  #   图像/OCR/视频
│   ├── link-understanding/   #   URL内容提取
│   ├── db/                   #   SQLite 数据模型
│   ├── logging/              #   结构化日志
│   ├── security/             #   密钥/加密
│   └── tui/                  #   终端UI
├── extensions/               # 插件 (50+)
│   ├── agent-team/           #   多Agent协作
│   ├── orchestrator/         #   团队编排
│   ├── telegram/ discord/ slack/ wechat/ feishu/ ...  # 频道
│   ├── memory-core/ memory-lancedb/  # 记忆
│   └── voice-call/ copilot-proxy/ diagnostics-otel/ ...  # 工具
├── ui/src/ui/                # Web 前端 (Lit 3)
│   ├── controllers/          #   状态 & 业务逻辑
│   ├── views/                #   页面 (Web Components)
│   ├── components/           #   可复用组件
│   └── i18n/                 #   中英文翻译
├── apps/                     # 原生应用
│   ├── desktop/src-tauri/    #   Tauri 桌面 (Rust)
│   ├── ios/                  #   iOS (Swift)
│   └── android/              #   Android (Kotlin)
├── scripts/                  # 构建/部署
├── ci/                       # CI/CD
└── cn/                       # 中国区定制
```

---

### 十三、模块统计

| 分类 | 模块数 | 说明 |
|------|--------|------|
| Gateway 核心 | ~15 | server, auth, hooks, methods, chat, ws, cron, discovery... |
| Agent 运行时 | ~15 | runner, auth-profiles, tools, models, scope... |
| 插件系统 | ~12 | types, loader, registry, hooks, commands, config... |
| 调度引擎 | ~12 | engine, intent, modality, tool-*, dag, step, fallback... |
| 频道系统 | ~10 | registry, dock, chat-type, mention, allowlist... |
| 配置系统 | ~8 | config, io, types, zod, repair, rollback, migrate... |
| 基础设施 | ~25 | node, heartbeat, bonjour, tailscale, pairing, update... |
| CLI | ~15+ | gateway, agent, channels, config, models, plugins... |
| 其他子系统 | ~10 | auto-reply, memory, voice, cron, browser, media, tui... |
| 扩展插件 | **50+** | agent-team, orchestrator, 40+频道, memory, auth... |
| 前端 UI | ~8 | controllers, views, components, chat, data, i18n... |
| 原生应用 | ~4 | desktop(Tauri), iOS, Android |
| 构建部署 | ~6 | scripts, ci, cn, install |
| **总计** | **180+** | **独立模块/子系统** |

</details>

## Key subsystems

- **[Gateway WebSocket network](https://docs.openclawcncn.com/concepts/architecture)** — single WS control plane for clients, tools, and events (plus ops: [Gateway runbook](https://docs.openclawcncn.com/gateway)).
- **[Tailscale exposure](https://docs.openclawcncn.com/gateway/tailscale)** — Serve/Funnel for the Gateway dashboard + WS (remote access: [Remote](https://docs.openclawcncn.com/gateway/remote)).
- **[Browser control](https://docs.openclawcncn.com/tools/browser)** — openclawcn‑managed Chrome/Chromium with CDP control.
- **[Canvas + A2UI](https://docs.openclawcncn.com/platforms/mac/canvas)** — agent‑driven visual workspace (A2UI host: [Canvas/A2UI](https://docs.openclawcncn.com/platforms/mac/canvas#canvas-a2ui)).
- **[Voice Wake](https://docs.openclawcncn.com/nodes/voicewake) + [Talk Mode](https://docs.openclawcncn.com/nodes/talk)** — always‑on speech and continuous conversation.
- **[Nodes](https://docs.openclawcncn.com/nodes)** — Canvas, camera snap/clip, screen record, `location.get`, notifications, plus macOS‑only `system.run`/`system.notify`.

## Tailscale access (Gateway dashboard)

OpenClawCN can auto-configure Tailscale **Serve** (tailnet-only) or **Funnel** (public) while the Gateway stays bound to loopback. Configure `gateway.tailscale.mode`:

- `off`: no Tailscale automation (default).
- `serve`: tailnet-only HTTPS via `tailscale serve` (uses Tailscale identity headers by default).
- `funnel`: public HTTPS via `tailscale funnel` (requires shared password auth).

Notes:

- `gateway.bind` must stay `loopback` when Serve/Funnel is enabled (OpenClawCN enforces this).
- Serve can be forced to require a password by setting `gateway.auth.mode: "password"` or `gateway.auth.allowTailscale: false`.
- Funnel refuses to start unless `gateway.auth.mode: "password"` is set.
- Optional: `gateway.tailscale.resetOnExit` to undo Serve/Funnel on shutdown.

Details: [Tailscale guide](https://docs.openclawcncn.com/gateway/tailscale) · [Web surfaces](https://docs.openclawcncn.com/web)

## Remote Gateway (Linux is great)

It’s perfectly fine to run the Gateway on a small Linux instance. Clients (macOS app, CLI, WebChat) can connect over **Tailscale Serve/Funnel** or **SSH tunnels**, and you can still pair device nodes (macOS/iOS/Android) to execute device‑local actions when needed.

- **Gateway host** runs the exec tool and channel connections by default.
- **Device nodes** run device‑local actions (`system.run`, camera, screen recording, notifications) via `node.invoke`.
  In short: exec runs where the Gateway lives; device actions run where the device lives.

Details: [Remote access](https://docs.openclawcncn.com/gateway/remote) · [Nodes](https://docs.openclawcncn.com/nodes) · [Security](https://docs.openclawcncn.com/gateway/security)

## macOS permissions via the Gateway protocol

The macOS app can run in **node mode** and advertises its capabilities + permission map over the Gateway WebSocket (`node.list` / `node.describe`). Clients can then execute local actions via `node.invoke`:

- `system.run` runs a local command and returns stdout/stderr/exit code; set `needsScreenRecording: true` to require screen-recording permission (otherwise you’ll get `PERMISSION_MISSING`).
- `system.notify` posts a user notification and fails if notifications are denied.
- `canvas.*`, `camera.*`, `screen.record`, and `location.get` are also routed via `node.invoke` and follow TCC permission status.

Elevated bash (host permissions) is separate from macOS TCC:

- Use `/elevated on|off` to toggle per‑session elevated access when enabled + allowlisted.
- Gateway persists the per‑session toggle via `sessions.patch` (WS method) alongside `thinkingLevel`, `verboseLevel`, `model`, `sendPolicy`, and `groupActivation`.

Details: [Nodes](https://docs.openclawcncn.com/nodes) · [macOS app](https://docs.openclawcncn.com/platforms/macos) · [Gateway protocol](https://docs.openclawcncn.com/concepts/architecture)

## Agent to Agent (sessions\_\* tools)

- Use these to coordinate work across sessions without jumping between chat surfaces.
- `sessions_list` — discover active sessions (agents) and their metadata.
- `sessions_history` — fetch transcript logs for a session.
- `sessions_send` — message another session; optional reply‑back ping‑pong + announce step (`REPLY_SKIP`, `ANNOUNCE_SKIP`).

Details: [Session tools](https://docs.openclawcncn.com/concepts/session-tool)

## Skills registry (ClawHub)

ClawHub is a minimal skill registry. With ClawHub enabled, the agent can search for skills automatically and pull in new ones as needed.

[ClawHub](https://clawhub.com)

## Chat commands

Send these in WhatsApp/Telegram/Slack/Google Chat/Microsoft Teams/WebChat (group commands are owner-only):

- `/status` — compact session status (model + tokens, cost when available)
- `/new` or `/reset` — reset the session
- `/compact` — compact session context (summary)
- `/think <level>` — off|minimal|low|medium|high|xhigh (GPT-5.2 + Codex models only)
- `/verbose on|off`
- `/usage off|tokens|full` — per-response usage footer
- `/restart` — restart the gateway (owner-only in groups)
- `/activation mention|always` — group activation toggle (groups only)

## Apps (optional)

The Gateway alone delivers a great experience. All apps are optional and add extra features.

If you plan to build/run companion apps, follow the platform runbooks below.

### macOS (OpenClawCN.app) (optional)

- Menu bar control for the Gateway and health.
- Voice Wake + push-to-talk overlay.
- WebChat + debug tools.
- Remote gateway control over SSH.

Note: signed builds required for macOS permissions to stick across rebuilds (see `docs/mac/permissions.md`).

### iOS node (optional)

- Pairs as a node via the Bridge.
- Voice trigger forwarding + Canvas surface.
- Controlled via `openclawcn nodes …`.

Runbook: [iOS connect](https://docs.openclawcncn.com/platforms/ios).

### Android node (optional)

- Pairs via the same Bridge + pairing flow as iOS.
- Exposes Canvas, Camera, and Screen capture commands.
- Runbook: [Android connect](https://docs.openclawcncn.com/platforms/android).

## Agent workspace + skills

- Workspace root: `~/.openclawcn/workspace` (configurable via `agents.defaults.workspace`).
- Injected prompt files: `AGENTS.md`, `SOUL.md`, `TOOLS.md`.
- Skills: `~/.openclawcn/workspace/skills/<skill>/SKILL.md`.

## Configuration

Minimal `~/.openclawcn/openclawcn.json` (model + defaults):

```json5
{
  agent: {
    model: "anthropic/claude-opus-4-6",
  },
}
```

[Full configuration reference (all keys + examples).](https://docs.openclawcncn.com/gateway/configuration)

## Security model (important)

- **Default:** tools run on the host for the **main** session, so the agent has full access when it’s just you.
- **Group/channel safety:** set `agents.defaults.sandbox.mode: "non-main"` to run **non‑main sessions** (groups/channels) inside per‑session Docker sandboxes; bash then runs in Docker for those sessions.
- **Sandbox defaults:** allowlist `bash`, `process`, `read`, `write`, `edit`, `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`; denylist `browser`, `canvas`, `nodes`, `cron`, `discord`, `gateway`.

Details: [Security guide](https://docs.openclawcncn.com/gateway/security) · [Docker + sandboxing](https://docs.openclawcncn.com/install/docker) · [Sandbox config](https://docs.openclawcncn.com/gateway/configuration)

### [WhatsApp](https://docs.openclawcncn.com/channels/whatsapp)

- Link the device: `pnpm openclawcn channels login` (stores creds in `~/.openclawcn/credentials`).
- Allowlist who can talk to the assistant via `channels.whatsapp.allowFrom`.
- If `channels.whatsapp.groups` is set, it becomes a group allowlist; include `"*"` to allow all.

### [Telegram](https://docs.openclawcncn.com/channels/telegram)

- Set `TELEGRAM_BOT_TOKEN` or `channels.telegram.botToken` (env wins).
- Optional: set `channels.telegram.groups` (with `channels.telegram.groups."*".requireMention`); when set, it is a group allowlist (include `"*"` to allow all). Also `channels.telegram.allowFrom` or `channels.telegram.webhookUrl` + `channels.telegram.webhookSecret` as needed.

```json5
{
  channels: {
    telegram: {
      botToken: "123456:ABCDEF",
    },
  },
}
```

### [Slack](https://docs.openclawcncn.com/channels/slack)

- Set `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN` (or `channels.slack.botToken` + `channels.slack.appToken`).

### [Discord](https://docs.openclawcncn.com/channels/discord)

- Set `DISCORD_BOT_TOKEN` or `channels.discord.token` (env wins).
- Optional: set `commands.native`, `commands.text`, or `commands.useAccessGroups`, plus `channels.discord.allowFrom`, `channels.discord.guilds`, or `channels.discord.mediaMaxMb` as needed.

```json5
{
  channels: {
    discord: {
      token: "1234abcd",
    },
  },
}
```

### [Signal](https://docs.openclawcncn.com/channels/signal)

- Requires `signal-cli` and a `channels.signal` config section.

### [BlueBubbles (iMessage)](https://docs.openclawcncn.com/channels/bluebubbles)

- **Recommended** iMessage integration.
- Configure `channels.bluebubbles.serverUrl` + `channels.bluebubbles.password` and a webhook (`channels.bluebubbles.webhookPath`).
- The BlueBubbles server runs on macOS; the Gateway can run on macOS or elsewhere.

### [iMessage (legacy)](https://docs.openclawcncn.com/channels/imessage)

- Legacy macOS-only integration via `imsg` (Messages must be signed in).
- If `channels.imessage.groups` is set, it becomes a group allowlist; include `"*"` to allow all.

### [Microsoft Teams](https://docs.openclawcncn.com/channels/msteams)

- Configure a Teams app + Bot Framework, then add a `msteams` config section.
- Allowlist who can talk via `msteams.allowFrom`; group access via `msteams.groupAllowFrom` or `msteams.groupPolicy: "open"`.

### [WebChat](https://docs.openclawcncn.com/web/webchat)

- Uses the Gateway WebSocket; no separate WebChat port/config.

Browser control (optional):

```json5
{
  browser: {
    enabled: true,
    color: "#FF4500",
  },
}
```

## Docs

Use these when you’re past the onboarding flow and want the deeper reference.

- [Start with the docs index for navigation and “what’s where.”](https://docs.openclawcncn.com)
- [Read the architecture overview for the gateway + protocol model.](https://docs.openclawcncn.com/concepts/architecture)
- [Use the full configuration reference when you need every key and example.](https://docs.openclawcncn.com/gateway/configuration)
- [Run the Gateway by the book with the operational runbook.](https://docs.openclawcncn.com/gateway)
- [Learn how the Control UI/Web surfaces work and how to expose them safely.](https://docs.openclawcncn.com/web)
- [Understand remote access over SSH tunnels or tailnets.](https://docs.openclawcncn.com/gateway/remote)
- [Follow the onboarding wizard flow for a guided setup.](https://docs.openclawcncn.com/start/wizard)
- [Wire external triggers via the webhook surface.](https://docs.openclawcncn.com/automation/webhook)
- [Set up Gmail Pub/Sub triggers.](https://docs.openclawcncn.com/automation/gmail-pubsub)
- [Learn the macOS menu bar companion details.](https://docs.openclawcncn.com/platforms/mac/menu-bar)
- [Platform guides: Windows (WSL2)](https://docs.openclawcncn.com/platforms/windows), [Linux](https://docs.openclawcncn.com/platforms/linux), [macOS](https://docs.openclawcncn.com/platforms/macos), [iOS](https://docs.openclawcncn.com/platforms/ios), [Android](https://docs.openclawcncn.com/platforms/android)
- [Debug common failures with the troubleshooting guide.](https://docs.openclawcncn.com/channels/troubleshooting)
- [Review security guidance before exposing anything.](https://docs.openclawcncn.com/gateway/security)

## Advanced docs (discovery + control)

- [Discovery + transports](https://docs.openclawcncn.com/gateway/discovery)
- [Bonjour/mDNS](https://docs.openclawcncn.com/gateway/bonjour)
- [Gateway pairing](https://docs.openclawcncn.com/gateway/pairing)
- [Remote gateway README](https://docs.openclawcncn.com/gateway/remote-gateway-readme)
- [Control UI](https://docs.openclawcncn.com/web/control-ui)
- [Dashboard](https://docs.openclawcncn.com/web/dashboard)

## Operations & troubleshooting

- [Health checks](https://docs.openclawcncn.com/gateway/health)
- [Gateway lock](https://docs.openclawcncn.com/gateway/gateway-lock)
- [Background process](https://docs.openclawcncn.com/gateway/background-process)
- [Browser troubleshooting (Linux)](https://docs.openclawcncn.com/tools/browser-linux-troubleshooting)
- [Logging](https://docs.openclawcncn.com/logging)

## Deep dives

- [Agent loop](https://docs.openclawcncn.com/concepts/agent-loop)
- [Presence](https://docs.openclawcncn.com/concepts/presence)
- [TypeBox schemas](https://docs.openclawcncn.com/concepts/typebox)
- [RPC adapters](https://docs.openclawcncn.com/reference/rpc)
- [Queue](https://docs.openclawcncn.com/concepts/queue)

## Workspace & skills

- [Skills config](https://docs.openclawcncn.com/tools/skills-config)
- [Default AGENTS](https://docs.openclawcncn.com/reference/AGENTS.default)
- [Templates: AGENTS](https://docs.openclawcncn.com/reference/templates/AGENTS)
- [Templates: BOOTSTRAP](https://docs.openclawcncn.com/reference/templates/BOOTSTRAP)
- [Templates: IDENTITY](https://docs.openclawcncn.com/reference/templates/IDENTITY)
- [Templates: SOUL](https://docs.openclawcncn.com/reference/templates/SOUL)
- [Templates: TOOLS](https://docs.openclawcncn.com/reference/templates/TOOLS)
- [Templates: USER](https://docs.openclawcncn.com/reference/templates/USER)

## Platform internals

- [macOS dev setup](https://docs.openclawcncn.com/platforms/mac/dev-setup)
- [macOS menu bar](https://docs.openclawcncn.com/platforms/mac/menu-bar)
- [macOS voice wake](https://docs.openclawcncn.com/platforms/mac/voicewake)
- [iOS node](https://docs.openclawcncn.com/platforms/ios)
- [Android node](https://docs.openclawcncn.com/platforms/android)
- [Windows (WSL2)](https://docs.openclawcncn.com/platforms/windows)
- [Linux app](https://docs.openclawcncn.com/platforms/linux)

## Email hooks (Gmail)

- [docs.openclawcncn.com/gmail-pubsub](https://docs.openclawcncn.com/automation/gmail-pubsub)

## Molty

OpenClawCN was built for **Molty**, a space lobster AI assistant. 🦞
by Peter Steinberger and the community.

- [openclawcncn.com](https://openclawcncn.com)
- [soul.md](https://soul.md)
- [steipete.me](https://steipete.me)
- [@openclawcn](https://x.com/openclawcn)

## Community

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, maintainers, and how to submit PRs.
AI/vibe-coded PRs welcome! 🤖

Special thanks to [Mario Zechner](https://mariozechner.at/) for his support and for
[pi-mono](https://github.com/badlogic/pi-mono).
Special thanks to Adam Doppelt for lobster.bot.

Thanks to all clawtributors:

<p align="left">
  <a href="https://github.com/steipete"><img src="https://avatars.githubusercontent.com/u/58493?v=4&s=48" width="48" height="48" alt="steipete" title="steipete"/></a> <a href="https://github.com/joshp123"><img src="https://avatars.githubusercontent.com/u/1497361?v=4&s=48" width="48" height="48" alt="joshp123" title="joshp123"/></a> <a href="https://github.com/cpojer"><img src="https://avatars.githubusercontent.com/u/13352?v=4&s=48" width="48" height="48" alt="cpojer" title="cpojer"/></a> <a href="https://github.com/mbelinky"><img src="https://avatars.githubusercontent.com/u/132747814?v=4&s=48" width="48" height="48" alt="Mariano Belinky" title="Mariano Belinky"/></a> <a href="https://github.com/sebslight"><img src="https://avatars.githubusercontent.com/u/19554889?v=4&s=48" width="48" height="48" alt="sebslight" title="sebslight"/></a> <a href="https://github.com/Takhoffman"><img src="https://avatars.githubusercontent.com/u/781889?v=4&s=48" width="48" height="48" alt="Takhoffman" title="Takhoffman"/></a> <a href="https://github.com/quotentiroler"><img src="https://avatars.githubusercontent.com/u/40643627?v=4&s=48" width="48" height="48" alt="quotentiroler" title="quotentiroler"/></a> <a href="https://github.com/bohdanpodvirnyi"><img src="https://avatars.githubusercontent.com/u/31819391?v=4&s=48" width="48" height="48" alt="bohdanpodvirnyi" title="bohdanpodvirnyi"/></a> <a href="https://github.com/tyler6204"><img src="https://avatars.githubusercontent.com/u/64381258?v=4&s=48" width="48" height="48" alt="tyler6204" title="tyler6204"/></a> <a href="https://github.com/iHildy"><img src="https://avatars.githubusercontent.com/u/25069719?v=4&s=48" width="48" height="48" alt="iHildy" title="iHildy"/></a>
  <a href="https://github.com/jaydenfyi"><img src="https://avatars.githubusercontent.com/u/213395523?v=4&s=48" width="48" height="48" alt="jaydenfyi" title="jaydenfyi"/></a> <a href="https://github.com/gumadeiras"><img src="https://avatars.githubusercontent.com/u/5599352?v=4&s=48" width="48" height="48" alt="gumadeiras" title="gumadeiras"/></a> <a href="https://github.com/joaohlisboa"><img src="https://avatars.githubusercontent.com/u/8200873?v=4&s=48" width="48" height="48" alt="joaohlisboa" title="joaohlisboa"/></a> <a href="https://github.com/mneves75"><img src="https://avatars.githubusercontent.com/u/2423436?v=4&s=48" width="48" height="48" alt="mneves75" title="mneves75"/></a> <a href="https://github.com/MatthieuBizien"><img src="https://avatars.githubusercontent.com/u/173090?v=4&s=48" width="48" height="48" alt="MatthieuBizien" title="MatthieuBizien"/></a> <a href="https://github.com/Glucksberg"><img src="https://avatars.githubusercontent.com/u/80581902?v=4&s=48" width="48" height="48" alt="Glucksberg" title="Glucksberg"/></a> <a href="https://github.com/MaudeBot"><img src="https://avatars.githubusercontent.com/u/255777700?v=4&s=48" width="48" height="48" alt="MaudeBot" title="MaudeBot"/></a> <a href="https://github.com/rahthakor"><img src="https://avatars.githubusercontent.com/u/8470553?v=4&s=48" width="48" height="48" alt="rahthakor" title="rahthakor"/></a> <a href="https://github.com/vrknetha"><img src="https://avatars.githubusercontent.com/u/20596261?v=4&s=48" width="48" height="48" alt="vrknetha" title="vrknetha"/></a> <a href="https://github.com/vignesh07"><img src="https://avatars.githubusercontent.com/u/1436853?v=4&s=48" width="48" height="48" alt="vignesh07" title="vignesh07"/></a>
  <a href="https://github.com/radek-paclt"><img src="https://avatars.githubusercontent.com/u/50451445?v=4&s=48" width="48" height="48" alt="radek-paclt" title="radek-paclt"/></a> <a href="https://github.com/abdelsfane"><img src="https://avatars.githubusercontent.com/u/32418586?v=4&s=48" width="48" height="48" alt="abdelsfane" title="abdelsfane"/></a> <a href="https://github.com/tobiasbischoff"><img src="https://avatars.githubusercontent.com/u/711564?v=4&s=48" width="48" height="48" alt="Tobias Bischoff" title="Tobias Bischoff"/></a> <a href="https://github.com/christianklotz"><img src="https://avatars.githubusercontent.com/u/69443?v=4&s=48" width="48" height="48" alt="christianklotz" title="christianklotz"/></a> <a href="https://github.com/czekaj"><img src="https://avatars.githubusercontent.com/u/1464539?v=4&s=48" width="48" height="48" alt="czekaj" title="czekaj"/></a> <a href="https://github.com/ethanpalm"><img src="https://avatars.githubusercontent.com/u/56270045?v=4&s=48" width="48" height="48" alt="ethanpalm" title="ethanpalm"/></a> <a href="https://github.com/mukhtharcm"><img src="https://avatars.githubusercontent.com/u/56378562?v=4&s=48" width="48" height="48" alt="mukhtharcm" title="mukhtharcm"/></a> <a href="https://github.com/maxsumrall"><img src="https://avatars.githubusercontent.com/u/628843?v=4&s=48" width="48" height="48" alt="maxsumrall" title="maxsumrall"/></a> <a href="https://github.com/rodrigouroz"><img src="https://avatars.githubusercontent.com/u/384037?v=4&s=48" width="48" height="48" alt="rodrigouroz" title="rodrigouroz"/></a> <a href="https://github.com/xadenryan"><img src="https://avatars.githubusercontent.com/u/165437834?v=4&s=48" width="48" height="48" alt="xadenryan" title="xadenryan"/></a>
  <a href="https://github.com/VACInc"><img src="https://avatars.githubusercontent.com/u/3279061?v=4&s=48" width="48" height="48" alt="VACInc" title="VACInc"/></a> <a href="https://github.com/juanpablodlc"><img src="https://avatars.githubusercontent.com/u/92012363?v=4&s=48" width="48" height="48" alt="juanpablodlc" title="juanpablodlc"/></a> <a href="https://github.com/conroywhitney"><img src="https://avatars.githubusercontent.com/u/249891?v=4&s=48" width="48" height="48" alt="conroywhitney" title="conroywhitney"/></a> <a href="https://github.com/hsrvc"><img src="https://avatars.githubusercontent.com/u/129702169?v=4&s=48" width="48" height="48" alt="hsrvc" title="hsrvc"/></a> <a href="https://github.com/magimetal"><img src="https://avatars.githubusercontent.com/u/36491250?v=4&s=48" width="48" height="48" alt="magimetal" title="magimetal"/></a> <a href="https://github.com/zerone0x"><img src="https://avatars.githubusercontent.com/u/39543393?v=4&s=48" width="48" height="48" alt="zerone0x" title="zerone0x"/></a> <a href="https://github.com/advaitpaliwal"><img src="https://avatars.githubusercontent.com/u/66044327?v=4&s=48" width="48" height="48" alt="advaitpaliwal" title="advaitpaliwal"/></a> <a href="https://github.com/meaningfool"><img src="https://avatars.githubusercontent.com/u/2862331?v=4&s=48" width="48" height="48" alt="meaningfool" title="meaningfool"/></a> <a href="https://github.com/patelhiren"><img src="https://avatars.githubusercontent.com/u/172098?v=4&s=48" width="48" height="48" alt="patelhiren" title="patelhiren"/></a> <a href="https://github.com/NicholasSpisak"><img src="https://avatars.githubusercontent.com/u/129075147?v=4&s=48" width="48" height="48" alt="NicholasSpisak" title="NicholasSpisak"/></a>
  <a href="https://github.com/jonisjongithub"><img src="https://avatars.githubusercontent.com/u/86072337?v=4&s=48" width="48" height="48" alt="jonisjongithub" title="jonisjongithub"/></a> <a href="https://github.com/AbhisekBasu1"><img src="https://avatars.githubusercontent.com/u/40645221?v=4&s=48" width="48" height="48" alt="abhisekbasu1" title="abhisekbasu1"/></a> <a href="https://github.com/theonejvo"><img src="https://avatars.githubusercontent.com/u/125909656?v=4&s=48" width="48" height="48" alt="theonejvo" title="theonejvo"/></a> <a href="https://github.com/jamesgroat"><img src="https://avatars.githubusercontent.com/u/2634024?v=4&s=48" width="48" height="48" alt="jamesgroat" title="jamesgroat"/></a> <a href="https://github.com/BunsDev"><img src="https://avatars.githubusercontent.com/u/68980965?v=4&s=48" width="48" height="48" alt="BunsDev" title="BunsDev"/></a> <a href="https://github.com/claude"><img src="https://avatars.githubusercontent.com/u/81847?v=4&s=48" width="48" height="48" alt="claude" title="claude"/></a> <a href="https://github.com/JustYannicc"><img src="https://avatars.githubusercontent.com/u/52761674?v=4&s=48" width="48" height="48" alt="JustYannicc" title="JustYannicc"/></a> <a href="https://github.com/Hyaxia"><img src="https://avatars.githubusercontent.com/u/36747317?v=4&s=48" width="48" height="48" alt="Hyaxia" title="Hyaxia"/></a> <a href="https://github.com/dantelex"><img src="https://avatars.githubusercontent.com/u/631543?v=4&s=48" width="48" height="48" alt="dantelex" title="dantelex"/></a> <a href="https://github.com/SocialNerd42069"><img src="https://avatars.githubusercontent.com/u/118244303?v=4&s=48" width="48" height="48" alt="SocialNerd42069" title="SocialNerd42069"/></a>
  <a href="https://github.com/daveonkels"><img src="https://avatars.githubusercontent.com/u/533642?v=4&s=48" width="48" height="48" alt="daveonkels" title="daveonkels"/></a> <a href="https://github.com/Yida-Dev"><img src="https://avatars.githubusercontent.com/u/92713555?v=4&s=48" width="48" height="48" alt="Yida-Dev" title="Yida-Dev"/></a> <a href="https://github.com/apps/google-labs-jules"><img src="https://avatars.githubusercontent.com/in/842251?v=4&s=48" width="48" height="48" alt="google-labs-jules[bot]" title="google-labs-jules[bot]"/></a> <a href="https://github.com/riccardogiorato"><img src="https://avatars.githubusercontent.com/u/4527364?v=4&s=48" width="48" height="48" alt="riccardogiorato" title="riccardogiorato"/></a> <a href="https://github.com/lc0rp"><img src="https://avatars.githubusercontent.com/u/2609441?v=4&s=48" width="48" height="48" alt="lc0rp" title="lc0rp"/></a> <a href="https://github.com/adam91holt"><img src="https://avatars.githubusercontent.com/u/9592417?v=4&s=48" width="48" height="48" alt="adam91holt" title="adam91holt"/></a> <a href="https://github.com/mousberg"><img src="https://avatars.githubusercontent.com/u/57605064?v=4&s=48" width="48" height="48" alt="mousberg" title="mousberg"/></a> <a href="https://github.com/apps/clawdinator"><img src="https://avatars.githubusercontent.com/in/2607181?v=4&s=48" width="48" height="48" alt="clawdinator[bot]" title="clawdinator[bot]"/></a> <a href="https://github.com/hougangdev"><img src="https://avatars.githubusercontent.com/u/105773686?v=4&s=48" width="48" height="48" alt="hougangdev" title="hougangdev"/></a> <a href="https://github.com/shakkernerd"><img src="https://avatars.githubusercontent.com/u/165377636?v=4&s=48" width="48" height="48" alt="shakkernerd" title="shakkernerd"/></a>
  <a href="https://github.com/coygeek"><img src="https://avatars.githubusercontent.com/u/65363919?v=4&s=48" width="48" height="48" alt="coygeek" title="coygeek"/></a> <a href="https://github.com/mteam88"><img src="https://avatars.githubusercontent.com/u/84196639?v=4&s=48" width="48" height="48" alt="mteam88" title="mteam88"/></a> <a href="https://github.com/hirefrank"><img src="https://avatars.githubusercontent.com/u/183158?v=4&s=48" width="48" height="48" alt="hirefrank" title="hirefrank"/></a> <a href="https://github.com/M00N7682"><img src="https://avatars.githubusercontent.com/u/170746674?v=4&s=48" width="48" height="48" alt="M00N7682" title="M00N7682"/></a> <a href="https://github.com/joeynyc"><img src="https://avatars.githubusercontent.com/u/17919866?v=4&s=48" width="48" height="48" alt="joeynyc" title="joeynyc"/></a> <a href="https://github.com/orlyjamie"><img src="https://avatars.githubusercontent.com/u/6668807?v=4&s=48" width="48" height="48" alt="orlyjamie" title="orlyjamie"/></a> <a href="https://github.com/dbhurley"><img src="https://avatars.githubusercontent.com/u/5251425?v=4&s=48" width="48" height="48" alt="dbhurley" title="dbhurley"/></a> <a href="https://github.com/omniwired"><img src="https://avatars.githubusercontent.com/u/322761?v=4&s=48" width="48" height="48" alt="Eng. Juan Combetto" title="Eng. Juan Combetto"/></a> <a href="https://github.com/TSavo"><img src="https://avatars.githubusercontent.com/u/877990?v=4&s=48" width="48" height="48" alt="TSavo" title="TSavo"/></a> <a href="https://github.com/aerolalit"><img src="https://avatars.githubusercontent.com/u/17166039?v=4&s=48" width="48" height="48" alt="aerolalit" title="aerolalit"/></a>
  <a href="https://github.com/julianengel"><img src="https://avatars.githubusercontent.com/u/10634231?v=4&s=48" width="48" height="48" alt="julianengel" title="julianengel"/></a> <a href="https://github.com/bradleypriest"><img src="https://avatars.githubusercontent.com/u/167215?v=4&s=48" width="48" height="48" alt="bradleypriest" title="bradleypriest"/></a> <a href="https://github.com/benithors"><img src="https://avatars.githubusercontent.com/u/20652882?v=4&s=48" width="48" height="48" alt="benithors" title="benithors"/></a> <a href="https://github.com/lsh411"><img src="https://avatars.githubusercontent.com/u/6801488?v=4&s=48" width="48" height="48" alt="lsh411" title="lsh411"/></a> <a href="https://github.com/gut-puncture"><img src="https://avatars.githubusercontent.com/u/75851986?v=4&s=48" width="48" height="48" alt="gut-puncture" title="gut-puncture"/></a> <a href="https://github.com/rohannagpal"><img src="https://avatars.githubusercontent.com/u/4009239?v=4&s=48" width="48" height="48" alt="rohannagpal" title="rohannagpal"/></a> <a href="https://github.com/timolins"><img src="https://avatars.githubusercontent.com/u/1440854?v=4&s=48" width="48" height="48" alt="timolins" title="timolins"/></a> <a href="https://github.com/f-trycua"><img src="https://avatars.githubusercontent.com/u/195596869?v=4&s=48" width="48" height="48" alt="f-trycua" title="f-trycua"/></a> <a href="https://github.com/benostein"><img src="https://avatars.githubusercontent.com/u/31802821?v=4&s=48" width="48" height="48" alt="benostein" title="benostein"/></a> <a href="https://github.com/elliotsecops"><img src="https://avatars.githubusercontent.com/u/141947839?v=4&s=48" width="48" height="48" alt="elliotsecops" title="elliotsecops"/></a>
  <a href="https://github.com/Nachx639"><img src="https://avatars.githubusercontent.com/u/71144023?v=4&s=48" width="48" height="48" alt="nachx639" title="nachx639"/></a> <a href="https://github.com/pvoo"><img src="https://avatars.githubusercontent.com/u/20116814?v=4&s=48" width="48" height="48" alt="pvoo" title="pvoo"/></a> <a href="https://github.com/sreekaransrinath"><img src="https://avatars.githubusercontent.com/u/50989977?v=4&s=48" width="48" height="48" alt="sreekaransrinath" title="sreekaransrinath"/></a> <a href="https://github.com/gupsammy"><img src="https://avatars.githubusercontent.com/u/20296019?v=4&s=48" width="48" height="48" alt="gupsammy" title="gupsammy"/></a> <a href="https://github.com/cristip73"><img src="https://avatars.githubusercontent.com/u/24499421?v=4&s=48" width="48" height="48" alt="cristip73" title="cristip73"/></a> <a href="https://github.com/stefangalescu"><img src="https://avatars.githubusercontent.com/u/52995748?v=4&s=48" width="48" height="48" alt="stefangalescu" title="stefangalescu"/></a> <a href="https://github.com/nachoiacovino"><img src="https://avatars.githubusercontent.com/u/50103937?v=4&s=48" width="48" height="48" alt="nachoiacovino" title="nachoiacovino"/></a> <a href="https://github.com/vsabavat"><img src="https://avatars.githubusercontent.com/u/50385532?v=4&s=48" width="48" height="48" alt="Vasanth Rao Naik Sabavat" title="Vasanth Rao Naik Sabavat"/></a> <a href="https://github.com/thewilloftheshadow"><img src="https://avatars.githubusercontent.com/u/35580099?v=4&s=48" width="48" height="48" alt="thewilloftheshadow" title="thewilloftheshadow"/></a> <a href="https://github.com/petter-b"><img src="https://avatars.githubusercontent.com/u/62076402?v=4&s=48" width="48" height="48" alt="petter-b" title="petter-b"/></a>
  <a href="https://github.com/leszekszpunar"><img src="https://avatars.githubusercontent.com/u/13106764?v=4&s=48" width="48" height="48" alt="leszekszpunar" title="leszekszpunar"/></a> <a href="https://github.com/scald"><img src="https://avatars.githubusercontent.com/u/1215913?v=4&s=48" width="48" height="48" alt="scald" title="scald"/></a> <a href="https://github.com/pycckuu"><img src="https://avatars.githubusercontent.com/u/1489583?v=4&s=48" width="48" height="48" alt="pycckuu" title="pycckuu"/></a> <a href="https://github.com/AnonO6"><img src="https://avatars.githubusercontent.com/u/124311066?v=4&s=48" width="48" height="48" alt="AnonO6" title="AnonO6"/></a> <a href="https://github.com/andranik-sahakyan"><img src="https://avatars.githubusercontent.com/u/8908029?v=4&s=48" width="48" height="48" alt="andranik-sahakyan" title="andranik-sahakyan"/></a> <a href="https://github.com/davidguttman"><img src="https://avatars.githubusercontent.com/u/431696?v=4&s=48" width="48" height="48" alt="davidguttman" title="davidguttman"/></a> <a href="https://github.com/jarvis89757"><img src="https://avatars.githubusercontent.com/u/258175441?v=4&s=48" width="48" height="48" alt="jarvis89757" title="jarvis89757"/></a> <a href="https://github.com/sleontenko"><img src="https://avatars.githubusercontent.com/u/7135949?v=4&s=48" width="48" height="48" alt="sleontenko" title="sleontenko"/></a> <a href="https://github.com/denysvitali"><img src="https://avatars.githubusercontent.com/u/4939519?v=4&s=48" width="48" height="48" alt="denysvitali" title="denysvitali"/></a> <a href="https://github.com/TinyTb"><img src="https://avatars.githubusercontent.com/u/5957298?v=4&s=48" width="48" height="48" alt="TinyTb" title="TinyTb"/></a>
  <a href="https://github.com/sircrumpet"><img src="https://avatars.githubusercontent.com/u/4436535?v=4&s=48" width="48" height="48" alt="sircrumpet" title="sircrumpet"/></a> <a href="https://github.com/peschee"><img src="https://avatars.githubusercontent.com/u/63866?v=4&s=48" width="48" height="48" alt="peschee" title="peschee"/></a> <a href="https://github.com/nicolasstanley"><img src="https://avatars.githubusercontent.com/u/60584925?v=4&s=48" width="48" height="48" alt="nicolasstanley" title="nicolasstanley"/></a> <a href="https://github.com/davidiach"><img src="https://avatars.githubusercontent.com/u/28102235?v=4&s=48" width="48" height="48" alt="davidiach" title="davidiach"/></a> <a href="https://github.com/nonggialiang"><img src="https://avatars.githubusercontent.com/u/14367839?v=4&s=48" width="48" height="48" alt="nonggia.liang" title="nonggia.liang"/></a> <a href="https://github.com/ironbyte-rgb"><img src="https://avatars.githubusercontent.com/u/230665944?v=4&s=48" width="48" height="48" alt="ironbyte-rgb" title="ironbyte-rgb"/></a> <a href="https://github.com/dominicnunez"><img src="https://avatars.githubusercontent.com/u/43616264?v=4&s=48" width="48" height="48" alt="dominicnunez" title="dominicnunez"/></a> <a href="https://github.com/lploc94"><img src="https://avatars.githubusercontent.com/u/28453843?v=4&s=48" width="48" height="48" alt="lploc94" title="lploc94"/></a> <a href="https://github.com/ratulsarna"><img src="https://avatars.githubusercontent.com/u/105903728?v=4&s=48" width="48" height="48" alt="ratulsarna" title="ratulsarna"/></a> <a href="https://github.com/sfo2001"><img src="https://avatars.githubusercontent.com/u/103369858?v=4&s=48" width="48" height="48" alt="sfo2001" title="sfo2001"/></a>
  <a href="https://github.com/lutr0"><img src="https://avatars.githubusercontent.com/u/76906369?v=4&s=48" width="48" height="48" alt="lutr0" title="lutr0"/></a> <a href="https://github.com/kiranjd"><img src="https://avatars.githubusercontent.com/u/25822851?v=4&s=48" width="48" height="48" alt="kiranjd" title="kiranjd"/></a> <a href="https://github.com/danielz1z"><img src="https://avatars.githubusercontent.com/u/235270390?v=4&s=48" width="48" height="48" alt="danielz1z" title="danielz1z"/></a> <a href="https://github.com/Iranb"><img src="https://avatars.githubusercontent.com/u/49674669?v=4&s=48" width="48" height="48" alt="Iranb" title="Iranb"/></a> <a href="https://github.com/cdorsey"><img src="https://avatars.githubusercontent.com/u/12650570?v=4&s=48" width="48" height="48" alt="cdorsey" title="cdorsey"/></a> <a href="https://github.com/AdeboyeDN"><img src="https://avatars.githubusercontent.com/u/65312338?v=4&s=48" width="48" height="48" alt="AdeboyeDN" title="AdeboyeDN"/></a> <a href="https://github.com/obviyus"><img src="https://avatars.githubusercontent.com/u/22031114?v=4&s=48" width="48" height="48" alt="obviyus" title="obviyus"/></a> <a href="https://github.com/Alg0rix"><img src="https://avatars.githubusercontent.com/u/53804949?v=4&s=48" width="48" height="48" alt="Alg0rix" title="Alg0rix"/></a> <a href="https://github.com/papago2355"><img src="https://avatars.githubusercontent.com/u/68721273?v=4&s=48" width="48" height="48" alt="papago2355" title="papago2355"/></a> <a href="https://github.com/peetzweg"><img src="https://avatars.githubusercontent.com/u/839848?v=4&s=48" width="48" height="48" alt="peetzweg/" title="peetzweg/"/></a>
  <a href="https://github.com/emanuelst"><img src="https://avatars.githubusercontent.com/u/9994339?v=4&s=48" width="48" height="48" alt="emanuelst" title="emanuelst"/></a> <a href="https://github.com/evanotero"><img src="https://avatars.githubusercontent.com/u/13204105?v=4&s=48" width="48" height="48" alt="evanotero" title="evanotero"/></a> <a href="https://github.com/KristijanJovanovski"><img src="https://avatars.githubusercontent.com/u/8942284?v=4&s=48" width="48" height="48" alt="KristijanJovanovski" title="KristijanJovanovski"/></a> <a href="https://github.com/jlowin"><img src="https://avatars.githubusercontent.com/u/153965?v=4&s=48" width="48" height="48" alt="jlowin" title="jlowin"/></a> <a href="https://github.com/rdev"><img src="https://avatars.githubusercontent.com/u/8418866?v=4&s=48" width="48" height="48" alt="rdev" title="rdev"/></a> <a href="https://github.com/rhuanssauro"><img src="https://avatars.githubusercontent.com/u/164682191?v=4&s=48" width="48" height="48" alt="rhuanssauro" title="rhuanssauro"/></a> <a href="https://github.com/joshrad-dev"><img src="https://avatars.githubusercontent.com/u/62785552?v=4&s=48" width="48" height="48" alt="joshrad-dev" title="joshrad-dev"/></a> <a href="https://github.com/osolmaz"><img src="https://avatars.githubusercontent.com/u/2453968?v=4&s=48" width="48" height="48" alt="osolmaz" title="osolmaz"/></a> <a href="https://github.com/adityashaw2"><img src="https://avatars.githubusercontent.com/u/41204444?v=4&s=48" width="48" height="48" alt="adityashaw2" title="adityashaw2"/></a> <a href="https://github.com/shadril238"><img src="https://avatars.githubusercontent.com/u/63901551?v=4&s=48" width="48" height="48" alt="shadril238" title="shadril238"/></a>
  <a href="https://github.com/CashWilliams"><img src="https://avatars.githubusercontent.com/u/613573?v=4&s=48" width="48" height="48" alt="CashWilliams" title="CashWilliams"/></a> <a href="https://github.com/search?q=sheeek"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="sheeek" title="sheeek"/></a> <a href="https://github.com/ryancontent"><img src="https://avatars.githubusercontent.com/u/39743613?v=4&s=48" width="48" height="48" alt="ryan" title="ryan"/></a> <a href="https://github.com/jasonsschin"><img src="https://avatars.githubusercontent.com/u/1456889?v=4&s=48" width="48" height="48" alt="jasonsschin" title="jasonsschin"/></a> <a href="https://github.com/artuskg"><img src="https://avatars.githubusercontent.com/u/11966157?v=4&s=48" width="48" height="48" alt="artuskg" title="artuskg"/></a> <a href="https://github.com/onutc"><img src="https://avatars.githubusercontent.com/u/152018508?v=4&s=48" width="48" height="48" alt="onutc" title="onutc"/></a> <a href="https://github.com/pauloportella"><img src="https://avatars.githubusercontent.com/u/22947229?v=4&s=48" width="48" height="48" alt="pauloportella" title="pauloportella"/></a> <a href="https://github.com/HirokiKobayashi-R"><img src="https://avatars.githubusercontent.com/u/37167840?v=4&s=48" width="48" height="48" alt="HirokiKobayashi-R" title="HirokiKobayashi-R"/></a> <a href="https://github.com/ThanhNguyxn"><img src="https://avatars.githubusercontent.com/u/74597207?v=4&s=48" width="48" height="48" alt="ThanhNguyxn" title="ThanhNguyxn"/></a> <a href="https://github.com/18-RAJAT"><img src="https://avatars.githubusercontent.com/u/78920780?v=4&s=48" width="48" height="48" alt="18-RAJAT" title="18-RAJAT"/></a>
  <a href="https://github.com/kimitaka"><img src="https://avatars.githubusercontent.com/u/167225?v=4&s=48" width="48" height="48" alt="kimitaka" title="kimitaka"/></a> <a href="https://github.com/yuting0624"><img src="https://avatars.githubusercontent.com/u/32728916?v=4&s=48" width="48" height="48" alt="yuting0624" title="yuting0624"/></a> <a href="https://github.com/neooriginal"><img src="https://avatars.githubusercontent.com/u/54811660?v=4&s=48" width="48" height="48" alt="neooriginal" title="neooriginal"/></a> <a href="https://github.com/ManuelHettich"><img src="https://avatars.githubusercontent.com/u/17690367?v=4&s=48" width="48" height="48" alt="manuelhettich" title="manuelhettich"/></a> <a href="https://github.com/unisone"><img src="https://avatars.githubusercontent.com/u/32521398?v=4&s=48" width="48" height="48" alt="unisone" title="unisone"/></a> <a href="https://github.com/baccula"><img src="https://avatars.githubusercontent.com/u/22080883?v=4&s=48" width="48" height="48" alt="baccula" title="baccula"/></a> <a href="https://github.com/manikv12"><img src="https://avatars.githubusercontent.com/u/49544491?v=4&s=48" width="48" height="48" alt="manikv12" title="manikv12"/></a> <a href="https://github.com/sbking"><img src="https://avatars.githubusercontent.com/u/3913213?v=4&s=48" width="48" height="48" alt="sbking" title="sbking"/></a> <a href="https://github.com/travisirby"><img src="https://avatars.githubusercontent.com/u/5958376?v=4&s=48" width="48" height="48" alt="travisirby" title="travisirby"/></a> <a href="https://github.com/fujiwara-tofu-shop"><img src="https://avatars.githubusercontent.com/u/259415332?v=4&s=48" width="48" height="48" alt="fujiwara-tofu-shop" title="fujiwara-tofu-shop"/></a>
  <a href="https://github.com/buddyh"><img src="https://avatars.githubusercontent.com/u/31752869?v=4&s=48" width="48" height="48" alt="buddyh" title="buddyh"/></a> <a href="https://github.com/connorshea"><img src="https://avatars.githubusercontent.com/u/2977353?v=4&s=48" width="48" height="48" alt="connorshea" title="connorshea"/></a> <a href="https://github.com/bjesuiter"><img src="https://avatars.githubusercontent.com/u/2365676?v=4&s=48" width="48" height="48" alt="bjesuiter" title="bjesuiter"/></a> <a href="https://github.com/kyleok"><img src="https://avatars.githubusercontent.com/u/58307870?v=4&s=48" width="48" height="48" alt="kyleok" title="kyleok"/></a> <a href="https://github.com/mcinteerj"><img src="https://avatars.githubusercontent.com/u/3613653?v=4&s=48" width="48" height="48" alt="mcinteerj" title="mcinteerj"/></a> <a href="https://github.com/slonce70"><img src="https://avatars.githubusercontent.com/u/130596182?v=4&s=48" width="48" height="48" alt="slonce70" title="slonce70"/></a> <a href="https://github.com/calvin-hpnet"><img src="https://avatars.githubusercontent.com/u/258432838?v=4&s=48" width="48" height="48" alt="calvin-hpnet" title="calvin-hpnet"/></a> <a href="https://github.com/gitpds"><img src="https://avatars.githubusercontent.com/u/78130276?v=4&s=48" width="48" height="48" alt="gitpds" title="gitpds"/></a> <a href="https://github.com/ide-rea"><img src="https://avatars.githubusercontent.com/u/30512600?v=4&s=48" width="48" height="48" alt="ide-rea" title="ide-rea"/></a> <a href="https://github.com/badlogic"><img src="https://avatars.githubusercontent.com/u/514052?v=4&s=48" width="48" height="48" alt="badlogic" title="badlogic"/></a>
  <a href="https://github.com/grp06"><img src="https://avatars.githubusercontent.com/u/1573959?v=4&s=48" width="48" height="48" alt="grp06" title="grp06"/></a> <a href="https://github.com/apps/dependabot"><img src="https://avatars.githubusercontent.com/in/29110?v=4&s=48" width="48" height="48" alt="dependabot[bot]" title="dependabot[bot]"/></a> <a href="https://github.com/amitbiswal007"><img src="https://avatars.githubusercontent.com/u/108086198?v=4&s=48" width="48" height="48" alt="amitbiswal007" title="amitbiswal007"/></a> <a href="https://github.com/John-Rood"><img src="https://avatars.githubusercontent.com/u/62669593?v=4&s=48" width="48" height="48" alt="John-Rood" title="John-Rood"/></a> <a href="https://github.com/timkrase"><img src="https://avatars.githubusercontent.com/u/38947626?v=4&s=48" width="48" height="48" alt="timkrase" title="timkrase"/></a> <a href="https://github.com/gerardward2007"><img src="https://avatars.githubusercontent.com/u/3002155?v=4&s=48" width="48" height="48" alt="gerardward2007" title="gerardward2007"/></a> <a href="https://github.com/roshanasingh4"><img src="https://avatars.githubusercontent.com/u/88576930?v=4&s=48" width="48" height="48" alt="roshanasingh4" title="roshanasingh4"/></a> <a href="https://github.com/tosh-hamburg"><img src="https://avatars.githubusercontent.com/u/58424326?v=4&s=48" width="48" height="48" alt="tosh-hamburg" title="tosh-hamburg"/></a> <a href="https://github.com/azade-c"><img src="https://avatars.githubusercontent.com/u/252790079?v=4&s=48" width="48" height="48" alt="azade-c" title="azade-c"/></a> <a href="https://github.com/dlauer"><img src="https://avatars.githubusercontent.com/u/757041?v=4&s=48" width="48" height="48" alt="dlauer" title="dlauer"/></a>
  <a href="https://github.com/ezhikkk"><img src="https://avatars.githubusercontent.com/u/105670095?v=4&s=48" width="48" height="48" alt="ezhikkk" title="ezhikkk"/></a> <a href="https://github.com/JonUleis"><img src="https://avatars.githubusercontent.com/u/7644941?v=4&s=48" width="48" height="48" alt="JonUleis" title="JonUleis"/></a> <a href="https://github.com/shivamraut101"><img src="https://avatars.githubusercontent.com/u/110457469?v=4&s=48" width="48" height="48" alt="shivamraut101" title="shivamraut101"/></a> <a href="https://github.com/cheeeee"><img src="https://avatars.githubusercontent.com/u/21245729?v=4&s=48" width="48" height="48" alt="cheeeee" title="cheeeee"/></a> <a href="https://github.com/jabezborja"><img src="https://avatars.githubusercontent.com/u/64759159?v=4&s=48" width="48" height="48" alt="jabezborja" title="jabezborja"/></a> <a href="https://github.com/robbyczgw-cla"><img src="https://avatars.githubusercontent.com/u/239660374?v=4&s=48" width="48" height="48" alt="robbyczgw-cla" title="robbyczgw-cla"/></a> <a href="https://github.com/YuriNachos"><img src="https://avatars.githubusercontent.com/u/19365375?v=4&s=48" width="48" height="48" alt="YuriNachos" title="YuriNachos"/></a> <a href="https://github.com/j1philli"><img src="https://avatars.githubusercontent.com/u/3744255?v=4&s=48" width="48" height="48" alt="Josh Phillips" title="Josh Phillips"/></a> <a href="https://github.com/Wangnov"><img src="https://avatars.githubusercontent.com/u/48670012?v=4&s=48" width="48" height="48" alt="Wangnov" title="Wangnov"/></a> <a href="https://github.com/kaizen403"><img src="https://avatars.githubusercontent.com/u/134706404?v=4&s=48" width="48" height="48" alt="kaizen403" title="kaizen403"/></a>
  <a href="https://github.com/patrickshao"><img src="https://avatars.githubusercontent.com/u/5953037?v=4&s=48" width="48" height="48" alt="patrickshao" title="patrickshao"/></a> <a href="https://github.com/Whoaa512"><img src="https://avatars.githubusercontent.com/u/1581943?v=4&s=48" width="48" height="48" alt="Whoaa512" title="Whoaa512"/></a> <a href="https://github.com/chriseidhof"><img src="https://avatars.githubusercontent.com/u/5382?v=4&s=48" width="48" height="48" alt="chriseidhof" title="chriseidhof"/></a> <a href="https://github.com/ngutman"><img src="https://avatars.githubusercontent.com/u/1540134?v=4&s=48" width="48" height="48" alt="ngutman" title="ngutman"/></a> <a href="https://github.com/wangai-studio"><img src="https://avatars.githubusercontent.com/u/256938352?v=4&s=48" width="48" height="48" alt="wangai-studio" title="wangai-studio"/></a> <a href="https://github.com/ysqander"><img src="https://avatars.githubusercontent.com/u/80843820?v=4&s=48" width="48" height="48" alt="ysqander" title="ysqander"/></a> <a href="https://github.com/search?q=Yurii%20Chukhlib"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Yurii Chukhlib" title="Yurii Chukhlib"/></a> <a href="https://github.com/aj47"><img src="https://avatars.githubusercontent.com/u/8023513?v=4&s=48" width="48" height="48" alt="aj47" title="aj47"/></a> <a href="https://github.com/kennyklee"><img src="https://avatars.githubusercontent.com/u/1432489?v=4&s=48" width="48" height="48" alt="kennyklee" title="kennyklee"/></a> <a href="https://github.com/superman32432432"><img src="https://avatars.githubusercontent.com/u/7228420?v=4&s=48" width="48" height="48" alt="superman32432432" title="superman32432432"/></a>
  <a href="https://github.com/Hisleren"><img src="https://avatars.githubusercontent.com/u/83217244?v=4&s=48" width="48" height="48" alt="Hisleren" title="Hisleren"/></a> <a href="https://github.com/antons"><img src="https://avatars.githubusercontent.com/u/129705?v=4&s=48" width="48" height="48" alt="antons" title="antons"/></a> <a href="https://github.com/austinm911"><img src="https://avatars.githubusercontent.com/u/31991302?v=4&s=48" width="48" height="48" alt="austinm911" title="austinm911"/></a> <a href="https://github.com/apps/blacksmith-sh"><img src="https://avatars.githubusercontent.com/in/807020?v=4&s=48" width="48" height="48" alt="blacksmith-sh[bot]" title="blacksmith-sh[bot]"/></a> <a href="https://github.com/damoahdominic"><img src="https://avatars.githubusercontent.com/u/4623434?v=4&s=48" width="48" height="48" alt="damoahdominic" title="damoahdominic"/></a> <a href="https://github.com/dan-dr"><img src="https://avatars.githubusercontent.com/u/6669808?v=4&s=48" width="48" height="48" alt="dan-dr" title="dan-dr"/></a> <a href="https://github.com/doodlewind"><img src="https://avatars.githubusercontent.com/u/7312949?v=4&s=48" width="48" height="48" alt="doodlewind" title="doodlewind"/></a> <a href="https://github.com/GHesericsu"><img src="https://avatars.githubusercontent.com/u/60202455?v=4&s=48" width="48" height="48" alt="GHesericsu" title="GHesericsu"/></a> <a href="https://github.com/HeimdallStrategy"><img src="https://avatars.githubusercontent.com/u/223014405?v=4&s=48" width="48" height="48" alt="HeimdallStrategy" title="HeimdallStrategy"/></a> <a href="https://github.com/imfing"><img src="https://avatars.githubusercontent.com/u/5097752?v=4&s=48" width="48" height="48" alt="imfing" title="imfing"/></a>
  <a href="https://github.com/jalehman"><img src="https://avatars.githubusercontent.com/u/550978?v=4&s=48" width="48" height="48" alt="jalehman" title="jalehman"/></a> <a href="https://github.com/jarvis-medmatic"><img src="https://avatars.githubusercontent.com/u/252428873?v=4&s=48" width="48" height="48" alt="jarvis-medmatic" title="jarvis-medmatic"/></a> <a href="https://github.com/kkarimi"><img src="https://avatars.githubusercontent.com/u/875218?v=4&s=48" width="48" height="48" alt="kkarimi" title="kkarimi"/></a> <a href="https://github.com/Lukavyi"><img src="https://avatars.githubusercontent.com/u/1013690?v=4&s=48" width="48" height="48" alt="Lukavyi" title="Lukavyi"/></a> <a href="https://github.com/mahmoudashraf93"><img src="https://avatars.githubusercontent.com/u/9130129?v=4&s=48" width="48" height="48" alt="mahmoudashraf93" title="mahmoudashraf93"/></a> <a href="https://github.com/pkrmf"><img src="https://avatars.githubusercontent.com/u/1714267?v=4&s=48" width="48" height="48" alt="pkrmf" title="pkrmf"/></a> <a href="https://github.com/RandyVentures"><img src="https://avatars.githubusercontent.com/u/149904821?v=4&s=48" width="48" height="48" alt="RandyVentures" title="RandyVentures"/></a> <a href="https://github.com/search?q=Ryan%20Lisse"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Ryan Lisse" title="Ryan Lisse"/></a> <a href="https://github.com/Yeom-JinHo"><img src="https://avatars.githubusercontent.com/u/81306489?v=4&s=48" width="48" height="48" alt="Yeom-JinHo" title="Yeom-JinHo"/></a> <a href="https://github.com/dougvk"><img src="https://avatars.githubusercontent.com/u/401660?v=4&s=48" width="48" height="48" alt="dougvk" title="dougvk"/></a>
  <a href="https://github.com/erikpr1994"><img src="https://avatars.githubusercontent.com/u/6299331?v=4&s=48" width="48" height="48" alt="erikpr1994" title="erikpr1994"/></a> <a href="https://github.com/fal3"><img src="https://avatars.githubusercontent.com/u/6484295?v=4&s=48" width="48" height="48" alt="fal3" title="fal3"/></a> <a href="https://github.com/search?q=Ghost"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Ghost" title="Ghost"/></a> <a href="https://github.com/hyf0-agent"><img src="https://avatars.githubusercontent.com/u/258783736?v=4&s=48" width="48" height="48" alt="hyf0-agent" title="hyf0-agent"/></a> <a href="https://github.com/jonasjancarik"><img src="https://avatars.githubusercontent.com/u/2459191?v=4&s=48" width="48" height="48" alt="jonasjancarik" title="jonasjancarik"/></a> <a href="https://github.com/search?q=Keith%20the%20Silly%20Goose"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Keith the Silly Goose" title="Keith the Silly Goose"/></a> <a href="https://github.com/search?q=L36%20Server"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="L36 Server" title="L36 Server"/></a> <a href="https://github.com/search?q=Marc"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Marc" title="Marc"/></a> <a href="https://github.com/mitschabaude-bot"><img src="https://avatars.githubusercontent.com/u/247582884?v=4&s=48" width="48" height="48" alt="mitschabaude-bot" title="mitschabaude-bot"/></a> <a href="https://github.com/mkbehr"><img src="https://avatars.githubusercontent.com/u/1285?v=4&s=48" width="48" height="48" alt="mkbehr" title="mkbehr"/></a>
  <a href="https://github.com/neist"><img src="https://avatars.githubusercontent.com/u/1029724?v=4&s=48" width="48" height="48" alt="neist" title="neist"/></a> <a href="https://github.com/orenyomtov"><img src="https://avatars.githubusercontent.com/u/168856?v=4&s=48" width="48" height="48" alt="orenyomtov" title="orenyomtov"/></a> <a href="https://github.com/sibbl"><img src="https://avatars.githubusercontent.com/u/866535?v=4&s=48" width="48" height="48" alt="sibbl" title="sibbl"/></a> <a href="https://github.com/zats"><img src="https://avatars.githubusercontent.com/u/2688806?v=4&s=48" width="48" height="48" alt="zats" title="zats"/></a> <a href="https://github.com/abhijeet117"><img src="https://avatars.githubusercontent.com/u/192859219?v=4&s=48" width="48" height="48" alt="abhijeet117" title="abhijeet117"/></a> <a href="https://github.com/chrisrodz"><img src="https://avatars.githubusercontent.com/u/2967620?v=4&s=48" width="48" height="48" alt="chrisrodz" title="chrisrodz"/></a> <a href="https://github.com/search?q=Friederike%20Seiler"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Friederike Seiler" title="Friederike Seiler"/></a> <a href="https://github.com/gabriel-trigo"><img src="https://avatars.githubusercontent.com/u/38991125?v=4&s=48" width="48" height="48" alt="gabriel-trigo" title="gabriel-trigo"/></a> <a href="https://github.com/hudson-rivera"><img src="https://avatars.githubusercontent.com/u/258693705?v=4&s=48" width="48" height="48" alt="hudson-rivera" title="hudson-rivera"/></a> <a href="https://github.com/Iamadig"><img src="https://avatars.githubusercontent.com/u/102129234?v=4&s=48" width="48" height="48" alt="iamadig" title="iamadig"/></a>
  <a href="https://github.com/itsjling"><img src="https://avatars.githubusercontent.com/u/2521993?v=4&s=48" width="48" height="48" alt="itsjling" title="itsjling"/></a> <a href="https://github.com/jdrhyne"><img src="https://avatars.githubusercontent.com/u/7828464?v=4&s=48" width="48" height="48" alt="Jonathan D. Rhyne (DJ-D)" title="Jonathan D. Rhyne (DJ-D)"/></a> <a href="https://github.com/search?q=Joshua%20Mitchell"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Joshua Mitchell" title="Joshua Mitchell"/></a> <a href="https://github.com/kelvinCB"><img src="https://avatars.githubusercontent.com/u/50544379?v=4&s=48" width="48" height="48" alt="kelvinCB" title="kelvinCB"/></a> <a href="https://github.com/search?q=Kit"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Kit" title="Kit"/></a> <a href="https://github.com/koala73"><img src="https://avatars.githubusercontent.com/u/996596?v=4&s=48" width="48" height="48" alt="koala73" title="koala73"/></a> <a href="https://github.com/lailoo"><img src="https://avatars.githubusercontent.com/u/20536249?v=4&s=48" width="48" height="48" alt="lailoo" title="lailoo"/></a> <a href="https://github.com/manmal"><img src="https://avatars.githubusercontent.com/u/142797?v=4&s=48" width="48" height="48" alt="manmal" title="manmal"/></a> <a href="https://github.com/mattqdev"><img src="https://avatars.githubusercontent.com/u/115874885?v=4&s=48" width="48" height="48" alt="mattqdev" title="mattqdev"/></a> <a href="https://github.com/mcaxtr"><img src="https://avatars.githubusercontent.com/u/7562095?v=4&s=48" width="48" height="48" alt="mcaxtr" title="mcaxtr"/></a>
  <a href="https://github.com/mitsuhiko"><img src="https://avatars.githubusercontent.com/u/7396?v=4&s=48" width="48" height="48" alt="mitsuhiko" title="mitsuhiko"/></a> <a href="https://github.com/ogulcancelik"><img src="https://avatars.githubusercontent.com/u/7064011?v=4&s=48" width="48" height="48" alt="ogulcancelik" title="ogulcancelik"/></a> <a href="https://github.com/petradonka"><img src="https://avatars.githubusercontent.com/u/7353770?v=4&s=48" width="48" height="48" alt="petradonka" title="petradonka"/></a> <a href="https://github.com/rubyrunsstuff"><img src="https://avatars.githubusercontent.com/u/246602379?v=4&s=48" width="48" height="48" alt="rubyrunsstuff" title="rubyrunsstuff"/></a> <a href="https://github.com/rybnikov"><img src="https://avatars.githubusercontent.com/u/7761808?v=4&s=48" width="48" height="48" alt="rybnikov" title="rybnikov"/></a> <a href="https://github.com/siddhantjain"><img src="https://avatars.githubusercontent.com/u/4835232?v=4&s=48" width="48" height="48" alt="siddhantjain" title="siddhantjain"/></a> <a href="https://github.com/suminhthanh"><img src="https://avatars.githubusercontent.com/u/2907636?v=4&s=48" width="48" height="48" alt="suminhthanh" title="suminhthanh"/></a> <a href="https://github.com/svkozak"><img src="https://avatars.githubusercontent.com/u/31941359?v=4&s=48" width="48" height="48" alt="svkozak" title="svkozak"/></a> <a href="https://github.com/wes-davis"><img src="https://avatars.githubusercontent.com/u/16506720?v=4&s=48" width="48" height="48" alt="wes-davis" title="wes-davis"/></a> <a href="https://github.com/24601"><img src="https://avatars.githubusercontent.com/u/1157207?v=4&s=48" width="48" height="48" alt="24601" title="24601"/></a>
  <a href="https://github.com/ameno-"><img src="https://avatars.githubusercontent.com/u/2416135?v=4&s=48" width="48" height="48" alt="ameno-" title="ameno-"/></a> <a href="https://github.com/bonald"><img src="https://avatars.githubusercontent.com/u/12394874?v=4&s=48" width="48" height="48" alt="bonald" title="bonald"/></a> <a href="https://github.com/bravostation"><img src="https://avatars.githubusercontent.com/u/257991910?v=4&s=48" width="48" height="48" alt="bravostation" title="bravostation"/></a> <a href="https://github.com/search?q=Chris%20Taylor"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Chris Taylor" title="Chris Taylor"/></a> <a href="https://github.com/search?q=damaozi"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="damaozi" title="damaozi"/></a> <a href="https://github.com/dguido"><img src="https://avatars.githubusercontent.com/u/294844?v=4&s=48" width="48" height="48" alt="dguido" title="dguido"/></a> <a href="https://github.com/djangonavarro220"><img src="https://avatars.githubusercontent.com/u/251162586?v=4&s=48" width="48" height="48" alt="Django Navarro" title="Django Navarro"/></a> <a href="https://github.com/evalexpr"><img src="https://avatars.githubusercontent.com/u/23485511?v=4&s=48" width="48" height="48" alt="evalexpr" title="evalexpr"/></a> <a href="https://github.com/henrino3"><img src="https://avatars.githubusercontent.com/u/4260288?v=4&s=48" width="48" height="48" alt="henrino3" title="henrino3"/></a> <a href="https://github.com/humanwritten"><img src="https://avatars.githubusercontent.com/u/206531610?v=4&s=48" width="48" height="48" alt="humanwritten" title="humanwritten"/></a>
  <a href="https://github.com/j2h4u"><img src="https://avatars.githubusercontent.com/u/39818683?v=4&s=48" width="48" height="48" alt="j2h4u" title="j2h4u"/></a> <a href="https://github.com/larlyssa"><img src="https://avatars.githubusercontent.com/u/13128869?v=4&s=48" width="48" height="48" alt="larlyssa" title="larlyssa"/></a> <a href="https://github.com/liuxiaopai-ai"><img src="https://avatars.githubusercontent.com/u/73659136?v=4&s=48" width="48" height="48" alt="liuxiaopai-ai" title="liuxiaopai-ai"/></a> <a href="https://github.com/odysseus0"><img src="https://avatars.githubusercontent.com/u/8635094?v=4&s=48" width="48" height="48" alt="odysseus0" title="odysseus0"/></a> <a href="https://github.com/oswalpalash"><img src="https://avatars.githubusercontent.com/u/6431196?v=4&s=48" width="48" height="48" alt="oswalpalash" title="oswalpalash"/></a> <a href="https://github.com/pcty-nextgen-service-account"><img src="https://avatars.githubusercontent.com/u/112553441?v=4&s=48" width="48" height="48" alt="pcty-nextgen-service-account" title="pcty-nextgen-service-account"/></a> <a href="https://github.com/pi0"><img src="https://avatars.githubusercontent.com/u/5158436?v=4&s=48" width="48" height="48" alt="pi0" title="pi0"/></a> <a href="https://github.com/rmorse"><img src="https://avatars.githubusercontent.com/u/853547?v=4&s=48" width="48" height="48" alt="rmorse" title="rmorse"/></a> <a href="https://github.com/search?q=Roopak%20Nijhara"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Roopak Nijhara" title="Roopak Nijhara"/></a> <a href="https://github.com/Syhids"><img src="https://avatars.githubusercontent.com/u/671202?v=4&s=48" width="48" height="48" alt="Syhids" title="Syhids"/></a>
  <a href="https://github.com/tmchow"><img src="https://avatars.githubusercontent.com/u/517103?v=4&s=48" width="48" height="48" alt="tmchow" title="tmchow"/></a> <a href="https://github.com/search?q=Ubuntu"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Ubuntu" title="Ubuntu"/></a> <a href="https://github.com/search?q=xiaose"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="xiaose" title="xiaose"/></a> <a href="https://github.com/search?q=Aaron%20Konyer"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Aaron Konyer" title="Aaron Konyer"/></a> <a href="https://github.com/aaronveklabs"><img src="https://avatars.githubusercontent.com/u/225997828?v=4&s=48" width="48" height="48" alt="aaronveklabs" title="aaronveklabs"/></a> <a href="https://github.com/akramcodez"><img src="https://avatars.githubusercontent.com/u/179671552?v=4&s=48" width="48" height="48" alt="akramcodez" title="akramcodez"/></a> <a href="https://github.com/aldoeliacim"><img src="https://avatars.githubusercontent.com/u/17973757?v=4&s=48" width="48" height="48" alt="aldoeliacim" title="aldoeliacim"/></a> <a href="https://github.com/andreabadesso"><img src="https://avatars.githubusercontent.com/u/3586068?v=4&s=48" width="48" height="48" alt="andreabadesso" title="andreabadesso"/></a> <a href="https://github.com/search?q=Andrii"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Andrii" title="Andrii"/></a> <a href="https://github.com/BinaryMuse"><img src="https://avatars.githubusercontent.com/u/189606?v=4&s=48" width="48" height="48" alt="BinaryMuse" title="BinaryMuse"/></a>
  <a href="https://github.com/bqcfjwhz85-arch"><img src="https://avatars.githubusercontent.com/u/239267175?v=4&s=48" width="48" height="48" alt="bqcfjwhz85-arch" title="bqcfjwhz85-arch"/></a> <a href="https://github.com/cash-echo-bot"><img src="https://avatars.githubusercontent.com/u/252747386?v=4&s=48" width="48" height="48" alt="cash-echo-bot" title="cash-echo-bot"/></a> <a href="https://github.com/search?q=Clawd"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Clawd" title="Clawd"/></a> <a href="https://github.com/search?q=ClawdFx"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="ClawdFx" title="ClawdFx"/></a> <a href="https://github.com/danballance"><img src="https://avatars.githubusercontent.com/u/13839912?v=4&s=48" width="48" height="48" alt="danballance" title="danballance"/></a> <a href="https://github.com/danielcadenhead"><img src="https://avatars.githubusercontent.com/u/195258443?v=4&s=48" width="48" height="48" alt="danielcadenhead" title="danielcadenhead"/></a> <a href="https://github.com/Elarwei001"><img src="https://avatars.githubusercontent.com/u/168552401?v=4&s=48" width="48" height="48" alt="Elarwei001" title="Elarwei001"/></a> <a href="https://github.com/EnzeD"><img src="https://avatars.githubusercontent.com/u/9866900?v=4&s=48" width="48" height="48" alt="EnzeD" title="EnzeD"/></a> <a href="https://github.com/erik-agens"><img src="https://avatars.githubusercontent.com/u/80908960?v=4&s=48" width="48" height="48" alt="erik-agens" title="erik-agens"/></a> <a href="https://github.com/Evizero"><img src="https://avatars.githubusercontent.com/u/10854026?v=4&s=48" width="48" height="48" alt="Evizero" title="Evizero"/></a>
  <a href="https://github.com/fcatuhe"><img src="https://avatars.githubusercontent.com/u/17382215?v=4&s=48" width="48" height="48" alt="fcatuhe" title="fcatuhe"/></a> <a href="https://github.com/gildo"><img src="https://avatars.githubusercontent.com/u/133645?v=4&s=48" width="48" height="48" alt="gildo" title="gildo"/></a> <a href="https://github.com/hclsys"><img src="https://avatars.githubusercontent.com/u/7755017?v=4&s=48" width="48" height="48" alt="hclsys" title="hclsys"/></a> <a href="https://github.com/itsjaydesu"><img src="https://avatars.githubusercontent.com/u/220390?v=4&s=48" width="48" height="48" alt="itsjaydesu" title="itsjaydesu"/></a> <a href="https://github.com/ivancasco"><img src="https://avatars.githubusercontent.com/u/2452858?v=4&s=48" width="48" height="48" alt="ivancasco" title="ivancasco"/></a> <a href="https://github.com/ivanrvpereira"><img src="https://avatars.githubusercontent.com/u/183991?v=4&s=48" width="48" height="48" alt="ivanrvpereira" title="ivanrvpereira"/></a> <a href="https://github.com/search?q=Jarvis"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Jarvis" title="Jarvis"/></a> <a href="https://github.com/jayhickey"><img src="https://avatars.githubusercontent.com/u/1676460?v=4&s=48" width="48" height="48" alt="jayhickey" title="jayhickey"/></a> <a href="https://github.com/jeffersonwarrior"><img src="https://avatars.githubusercontent.com/u/89030989?v=4&s=48" width="48" height="48" alt="jeffersonwarrior" title="jeffersonwarrior"/></a> <a href="https://github.com/search?q=jeffersonwarrior"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="jeffersonwarrior" title="jeffersonwarrior"/></a>
  <a href="https://github.com/jverdi"><img src="https://avatars.githubusercontent.com/u/345050?v=4&s=48" width="48" height="48" alt="jverdi" title="jverdi"/></a> <a href="https://github.com/longmaba"><img src="https://avatars.githubusercontent.com/u/9361500?v=4&s=48" width="48" height="48" alt="longmaba" title="longmaba"/></a> <a href="https://github.com/search?q=Marco%20Marandiz"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Marco Marandiz" title="Marco Marandiz"/></a> <a href="https://github.com/MarvinCui"><img src="https://avatars.githubusercontent.com/u/130876763?v=4&s=48" width="48" height="48" alt="MarvinCui" title="MarvinCui"/></a> <a href="https://github.com/mattezell"><img src="https://avatars.githubusercontent.com/u/361409?v=4&s=48" width="48" height="48" alt="mattezell" title="mattezell"/></a> <a href="https://github.com/mjrussell"><img src="https://avatars.githubusercontent.com/u/1641895?v=4&s=48" width="48" height="48" alt="mjrussell" title="mjrussell"/></a> <a href="https://github.com/odnxe"><img src="https://avatars.githubusercontent.com/u/403141?v=4&s=48" width="48" height="48" alt="odnxe" title="odnxe"/></a> <a href="https://github.com/optimikelabs"><img src="https://avatars.githubusercontent.com/u/31423109?v=4&s=48" width="48" height="48" alt="optimikelabs" title="optimikelabs"/></a> <a href="https://github.com/p6l-richard"><img src="https://avatars.githubusercontent.com/u/18185649?v=4&s=48" width="48" height="48" alt="p6l-richard" title="p6l-richard"/></a> <a href="https://github.com/philipp-spiess"><img src="https://avatars.githubusercontent.com/u/458591?v=4&s=48" width="48" height="48" alt="philipp-spiess" title="philipp-spiess"/></a>
  <a href="https://github.com/search?q=Pocket%20Clawd"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Pocket Clawd" title="Pocket Clawd"/></a> <a href="https://github.com/RayBB"><img src="https://avatars.githubusercontent.com/u/921217?v=4&s=48" width="48" height="48" alt="RayBB" title="RayBB"/></a> <a href="https://github.com/robaxelsen"><img src="https://avatars.githubusercontent.com/u/13132899?v=4&s=48" width="48" height="48" alt="robaxelsen" title="robaxelsen"/></a> <a href="https://github.com/search?q=Sash%20Catanzarite"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Sash Catanzarite" title="Sash Catanzarite"/></a> <a href="https://github.com/Suksham-sharma"><img src="https://avatars.githubusercontent.com/u/94667656?v=4&s=48" width="48" height="48" alt="Suksham-sharma" title="Suksham-sharma"/></a> <a href="https://github.com/T5-AndyML"><img src="https://avatars.githubusercontent.com/u/22801233?v=4&s=48" width="48" height="48" alt="T5-AndyML" title="T5-AndyML"/></a> <a href="https://github.com/thejhinvirtuoso"><img src="https://avatars.githubusercontent.com/u/258521837?v=4&s=48" width="48" height="48" alt="thejhinvirtuoso" title="thejhinvirtuoso"/></a> <a href="https://github.com/travisp"><img src="https://avatars.githubusercontent.com/u/165698?v=4&s=48" width="48" height="48" alt="travisp" title="travisp"/></a> <a href="https://github.com/search?q=VAC"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="VAC" title="VAC"/></a> <a href="https://github.com/search?q=william%20arzt"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="william arzt" title="william arzt"/></a>
  <a href="https://github.com/yudshj"><img src="https://avatars.githubusercontent.com/u/16971372?v=4&s=48" width="48" height="48" alt="yudshj" title="yudshj"/></a> <a href="https://github.com/zknicker"><img src="https://avatars.githubusercontent.com/u/1164085?v=4&s=48" width="48" height="48" alt="zknicker" title="zknicker"/></a> <a href="https://github.com/0oAstro"><img src="https://avatars.githubusercontent.com/u/79555780?v=4&s=48" width="48" height="48" alt="0oAstro" title="0oAstro"/></a> <a href="https://github.com/Abdul535"><img src="https://avatars.githubusercontent.com/u/54276938?v=4&s=48" width="48" height="48" alt="Abdul535" title="Abdul535"/></a> <a href="https://github.com/abhaymundhara"><img src="https://avatars.githubusercontent.com/u/62872231?v=4&s=48" width="48" height="48" alt="abhaymundhara" title="abhaymundhara"/></a> <a href="https://github.com/aduk059"><img src="https://avatars.githubusercontent.com/u/257603478?v=4&s=48" width="48" height="48" alt="aduk059" title="aduk059"/></a> <a href="https://github.com/aisling404"><img src="https://avatars.githubusercontent.com/u/211950534?v=4&s=48" width="48" height="48" alt="aisling404" title="aisling404"/></a> <a href="https://github.com/search?q=alejandro%20maza"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="alejandro maza" title="alejandro maza"/></a> <a href="https://github.com/Alex-Alaniz"><img src="https://avatars.githubusercontent.com/u/88956822?v=4&s=48" width="48" height="48" alt="Alex-Alaniz" title="Alex-Alaniz"/></a> <a href="https://github.com/alexanderatallah"><img src="https://avatars.githubusercontent.com/u/1011391?v=4&s=48" width="48" height="48" alt="alexanderatallah" title="alexanderatallah"/></a>
  <a href="https://github.com/alexstyl"><img src="https://avatars.githubusercontent.com/u/1665273?v=4&s=48" width="48" height="48" alt="alexstyl" title="alexstyl"/></a> <a href="https://github.com/AlexZhangji"><img src="https://avatars.githubusercontent.com/u/3280924?v=4&s=48" width="48" height="48" alt="AlexZhangji" title="AlexZhangji"/></a> <a href="https://github.com/andrewting19"><img src="https://avatars.githubusercontent.com/u/10536704?v=4&s=48" width="48" height="48" alt="andrewting19" title="andrewting19"/></a> <a href="https://github.com/anpoirier"><img src="https://avatars.githubusercontent.com/u/1245729?v=4&s=48" width="48" height="48" alt="anpoirier" title="anpoirier"/></a> <a href="https://github.com/araa47"><img src="https://avatars.githubusercontent.com/u/22760261?v=4&s=48" width="48" height="48" alt="araa47" title="araa47"/></a> <a href="https://github.com/arthyn"><img src="https://avatars.githubusercontent.com/u/5466421?v=4&s=48" width="48" height="48" alt="arthyn" title="arthyn"/></a> <a href="https://github.com/Asleep123"><img src="https://avatars.githubusercontent.com/u/122379135?v=4&s=48" width="48" height="48" alt="Asleep123" title="Asleep123"/></a> <a href="https://github.com/search?q=Ayush%20Ojha"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Ayush Ojha" title="Ayush Ojha"/></a> <a href="https://github.com/Ayush10"><img src="https://avatars.githubusercontent.com/u/7945279?v=4&s=48" width="48" height="48" alt="Ayush10" title="Ayush10"/></a> <a href="https://github.com/bguidolim"><img src="https://avatars.githubusercontent.com/u/987360?v=4&s=48" width="48" height="48" alt="bguidolim" title="bguidolim"/></a>
  <a href="https://github.com/bolismauro"><img src="https://avatars.githubusercontent.com/u/771999?v=4&s=48" width="48" height="48" alt="bolismauro" title="bolismauro"/></a> <a href="https://github.com/caelum0x"><img src="https://avatars.githubusercontent.com/u/130079063?v=4&s=48" width="48" height="48" alt="caelum0x" title="caelum0x"/></a> <a href="https://github.com/championswimmer"><img src="https://avatars.githubusercontent.com/u/1327050?v=4&s=48" width="48" height="48" alt="championswimmer" title="championswimmer"/></a> <a href="https://github.com/chenyuan99"><img src="https://avatars.githubusercontent.com/u/25518100?v=4&s=48" width="48" height="48" alt="chenyuan99" title="chenyuan99"/></a> <a href="https://github.com/Chloe-VP"><img src="https://avatars.githubusercontent.com/u/257371598?v=4&s=48" width="48" height="48" alt="Chloe-VP" title="Chloe-VP"/></a> <a href="https://github.com/search?q=Claude%20Code"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Claude Code" title="Claude Code"/></a> <a href="https://github.com/search?q=Clawdbot%20Maintainers"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Clawdbot Maintainers" title="Clawdbot Maintainers"/></a> <a href="https://github.com/conhecendoia"><img src="https://avatars.githubusercontent.com/u/82890727?v=4&s=48" width="48" height="48" alt="conhecendoia" title="conhecendoia"/></a> <a href="https://github.com/dasilva333"><img src="https://avatars.githubusercontent.com/u/947827?v=4&s=48" width="48" height="48" alt="dasilva333" title="dasilva333"/></a> <a href="https://github.com/David-Marsh-Photo"><img src="https://avatars.githubusercontent.com/u/228404527?v=4&s=48" width="48" height="48" alt="David-Marsh-Photo" title="David-Marsh-Photo"/></a>
  <a href="https://github.com/deepsoumya617"><img src="https://avatars.githubusercontent.com/u/80877391?v=4&s=48" width="48" height="48" alt="deepsoumya617" title="deepsoumya617"/></a> <a href="https://github.com/search?q=Developer"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Developer" title="Developer"/></a> <a href="https://github.com/search?q=Dimitrios%20Ploutarchos"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Dimitrios Ploutarchos" title="Dimitrios Ploutarchos"/></a> <a href="https://github.com/search?q=Drake%20Thomsen"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Drake Thomsen" title="Drake Thomsen"/></a> <a href="https://github.com/dvrshil"><img src="https://avatars.githubusercontent.com/u/81693876?v=4&s=48" width="48" height="48" alt="dvrshil" title="dvrshil"/></a> <a href="https://github.com/dxd5001"><img src="https://avatars.githubusercontent.com/u/1886046?v=4&s=48" width="48" height="48" alt="dxd5001" title="dxd5001"/></a> <a href="https://github.com/dylanneve1"><img src="https://avatars.githubusercontent.com/u/31746704?v=4&s=48" width="48" height="48" alt="dylanneve1" title="dylanneve1"/></a> <a href="https://github.com/search?q=Felix%20Krause"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Felix Krause" title="Felix Krause"/></a> <a href="https://github.com/foeken"><img src="https://avatars.githubusercontent.com/u/13864?v=4&s=48" width="48" height="48" alt="foeken" title="foeken"/></a> <a href="https://github.com/frankekn"><img src="https://avatars.githubusercontent.com/u/4488090?v=4&s=48" width="48" height="48" alt="frankekn" title="frankekn"/></a>
  <a href="https://github.com/fredheir"><img src="https://avatars.githubusercontent.com/u/3304869?v=4&s=48" width="48" height="48" alt="fredheir" title="fredheir"/></a> <a href="https://github.com/Fronut"><img src="https://avatars.githubusercontent.com/u/165925262?v=4&s=48" width="48" height="48" alt="Fronut" title="Fronut"/></a> <a href="https://github.com/search?q=ganghyun%20kim"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="ganghyun kim" title="ganghyun kim"/></a> <a href="https://github.com/grrowl"><img src="https://avatars.githubusercontent.com/u/907140?v=4&s=48" width="48" height="48" alt="grrowl" title="grrowl"/></a> <a href="https://github.com/gtsifrikas"><img src="https://avatars.githubusercontent.com/u/8904378?v=4&s=48" width="48" height="48" alt="gtsifrikas" title="gtsifrikas"/></a> <a href="https://github.com/HassanFleyah"><img src="https://avatars.githubusercontent.com/u/228002017?v=4&s=48" width="48" height="48" alt="HassanFleyah" title="HassanFleyah"/></a> <a href="https://github.com/HazAT"><img src="https://avatars.githubusercontent.com/u/363802?v=4&s=48" width="48" height="48" alt="HazAT" title="HazAT"/></a> <a href="https://github.com/hrdwdmrbl"><img src="https://avatars.githubusercontent.com/u/554881?v=4&s=48" width="48" height="48" alt="hrdwdmrbl" title="hrdwdmrbl"/></a> <a href="https://github.com/hugobarauna"><img src="https://avatars.githubusercontent.com/u/2719?v=4&s=48" width="48" height="48" alt="hugobarauna" title="hugobarauna"/></a> <a href="https://github.com/iamEvanYT"><img src="https://avatars.githubusercontent.com/u/47493765?v=4&s=48" width="48" height="48" alt="iamEvanYT" title="iamEvanYT"/></a>
  <a href="https://github.com/ichbinlucaskim"><img src="https://avatars.githubusercontent.com/u/125564751?v=4&s=48" width="48" height="48" alt="ichbinlucaskim" title="ichbinlucaskim"/></a> <a href="https://github.com/search?q=Jamie%20Openshaw"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Jamie Openshaw" title="Jamie Openshaw"/></a> <a href="https://github.com/search?q=Jane"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Jane" title="Jane"/></a> <a href="https://github.com/search?q=Jarvis%20Deploy"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Jarvis Deploy" title="Jarvis Deploy"/></a> <a href="https://github.com/search?q=Jefferson%20Nunn"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Jefferson Nunn" title="Jefferson Nunn"/></a> <a href="https://github.com/jogi47"><img src="https://avatars.githubusercontent.com/u/1710139?v=4&s=48" width="48" height="48" alt="jogi47" title="jogi47"/></a> <a href="https://github.com/kentaro"><img src="https://avatars.githubusercontent.com/u/3458?v=4&s=48" width="48" height="48" alt="kentaro" title="kentaro"/></a> <a href="https://github.com/search?q=Kevin%20Lin"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Kevin Lin" title="Kevin Lin"/></a> <a href="https://github.com/kira-ariaki"><img src="https://avatars.githubusercontent.com/u/257352493?v=4&s=48" width="48" height="48" alt="kira-ariaki" title="kira-ariaki"/></a> <a href="https://github.com/kitze"><img src="https://avatars.githubusercontent.com/u/1160594?v=4&s=48" width="48" height="48" alt="kitze" title="kitze"/></a>
  <a href="https://github.com/Kiwitwitter"><img src="https://avatars.githubusercontent.com/u/25277769?v=4&s=48" width="48" height="48" alt="Kiwitwitter" title="Kiwitwitter"/></a> <a href="https://github.com/kossoy"><img src="https://avatars.githubusercontent.com/u/51094?v=4&s=48" width="48" height="48" alt="kossoy" title="kossoy"/></a> <a href="https://github.com/levifig"><img src="https://avatars.githubusercontent.com/u/1605?v=4&s=48" width="48" height="48" alt="levifig" title="levifig"/></a> <a href="https://github.com/liuy"><img src="https://avatars.githubusercontent.com/u/1192888?v=4&s=48" width="48" height="48" alt="liuy" title="liuy"/></a> <a href="https://github.com/search?q=Lloyd"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Lloyd" title="Lloyd"/></a> <a href="https://github.com/loganaden"><img src="https://avatars.githubusercontent.com/u/1688420?v=4&s=48" width="48" height="48" alt="loganaden" title="loganaden"/></a> <a href="https://github.com/longjos"><img src="https://avatars.githubusercontent.com/u/740160?v=4&s=48" width="48" height="48" alt="longjos" title="longjos"/></a> <a href="https://github.com/loukotal"><img src="https://avatars.githubusercontent.com/u/18210858?v=4&s=48" width="48" height="48" alt="loukotal" title="loukotal"/></a> <a href="https://github.com/search?q=mac%20mimi"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="mac mimi" title="mac mimi"/></a> <a href="https://github.com/markusbkoch"><img src="https://avatars.githubusercontent.com/u/34865315?v=4&s=48" width="48" height="48" alt="markusbkoch" title="markusbkoch"/></a>
  <a href="https://github.com/martinpucik"><img src="https://avatars.githubusercontent.com/u/5503097?v=4&s=48" width="48" height="48" alt="martinpucik" title="martinpucik"/></a> <a href="https://github.com/search?q=Matt%20mini"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Matt mini" title="Matt mini"/></a> <a href="https://github.com/mertcicekci0"><img src="https://avatars.githubusercontent.com/u/179321902?v=4&s=48" width="48" height="48" alt="mertcicekci0" title="mertcicekci0"/></a> <a href="https://github.com/search?q=Miles"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Miles" title="Miles"/></a> <a href="https://github.com/search?q=minghinmatthewlam"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="minghinmatthewlam" title="minghinmatthewlam"/></a> <a href="https://github.com/mrdbstn"><img src="https://avatars.githubusercontent.com/u/58957632?v=4&s=48" width="48" height="48" alt="mrdbstn" title="mrdbstn"/></a> <a href="https://github.com/MSch"><img src="https://avatars.githubusercontent.com/u/7475?v=4&s=48" width="48" height="48" alt="MSch" title="MSch"/></a> <a href="https://github.com/search?q=mudrii"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="mudrii" title="mudrii"/></a> <a href="https://github.com/search?q=Mustafa%20Tag%20Eldeen"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Mustafa Tag Eldeen" title="Mustafa Tag Eldeen"/></a> <a href="https://github.com/search?q=myfunc"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="myfunc" title="myfunc"/></a>
  <a href="https://github.com/mylukin"><img src="https://avatars.githubusercontent.com/u/1021019?v=4&s=48" width="48" height="48" alt="mylukin" title="mylukin"/></a> <a href="https://github.com/nathanbosse"><img src="https://avatars.githubusercontent.com/u/4040669?v=4&s=48" width="48" height="48" alt="nathanbosse" title="nathanbosse"/></a> <a href="https://github.com/ndraiman"><img src="https://avatars.githubusercontent.com/u/12609607?v=4&s=48" width="48" height="48" alt="ndraiman" title="ndraiman"/></a> <a href="https://github.com/nexty5870"><img src="https://avatars.githubusercontent.com/u/3869659?v=4&s=48" width="48" height="48" alt="nexty5870" title="nexty5870"/></a> <a href="https://github.com/Noctivoro"><img src="https://avatars.githubusercontent.com/u/183974570?v=4&s=48" width="48" height="48" alt="Noctivoro" title="Noctivoro"/></a> <a href="https://github.com/Omar-Khaleel"><img src="https://avatars.githubusercontent.com/u/240748662?v=4&s=48" width="48" height="48" alt="Omar-Khaleel" title="Omar-Khaleel"/></a> <a href="https://github.com/ozgur-polat"><img src="https://avatars.githubusercontent.com/u/26483942?v=4&s=48" width="48" height="48" alt="ozgur-polat" title="ozgur-polat"/></a> <a href="https://github.com/search?q=pasogott"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="pasogott" title="pasogott"/></a> <a href="https://github.com/search?q=plum-dawg"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="plum-dawg" title="plum-dawg"/></a> <a href="https://github.com/search?q=pookNast"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="pookNast" title="pookNast"/></a>
  <a href="https://github.com/ppamment"><img src="https://avatars.githubusercontent.com/u/2122919?v=4&s=48" width="48" height="48" alt="ppamment" title="ppamment"/></a> <a href="https://github.com/prathamdby"><img src="https://avatars.githubusercontent.com/u/134331217?v=4&s=48" width="48" height="48" alt="prathamdby" title="prathamdby"/></a> <a href="https://github.com/ptn1411"><img src="https://avatars.githubusercontent.com/u/57529765?v=4&s=48" width="48" height="48" alt="ptn1411" title="ptn1411"/></a> <a href="https://github.com/search?q=rafaelreis-r"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="rafaelreis-r" title="rafaelreis-r"/></a> <a href="https://github.com/rafelbev"><img src="https://avatars.githubusercontent.com/u/467120?v=4&s=48" width="48" height="48" alt="rafelbev" title="rafelbev"/></a> <a href="https://github.com/reeltimeapps"><img src="https://avatars.githubusercontent.com/u/637338?v=4&s=48" width="48" height="48" alt="reeltimeapps" title="reeltimeapps"/></a> <a href="https://github.com/RLTCmpe"><img src="https://avatars.githubusercontent.com/u/10762242?v=4&s=48" width="48" height="48" alt="RLTCmpe" title="RLTCmpe"/></a> <a href="https://github.com/search?q=robhparker"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="robhparker" title="robhparker"/></a> <a href="https://github.com/rohansachinpatil"><img src="https://avatars.githubusercontent.com/u/172933149?v=4&s=48" width="48" height="48" alt="rohansachinpatil" title="rohansachinpatil"/></a> <a href="https://github.com/search?q=Rony%20Kelner"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Rony Kelner" title="Rony Kelner"/></a>
  <a href="https://github.com/ryancnelson"><img src="https://avatars.githubusercontent.com/u/347171?v=4&s=48" width="48" height="48" alt="ryancnelson" title="ryancnelson"/></a> <a href="https://github.com/search?q=Samrat%20Jha"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Samrat Jha" title="Samrat Jha"/></a> <a href="https://github.com/search?q=seans-openclawcnbot"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="seans-openclawcnbot" title="seans-openclawcnbot"/></a> <a href="https://github.com/senoldogann"><img src="https://avatars.githubusercontent.com/u/45736551?v=4&s=48" width="48" height="48" alt="senoldogann" title="senoldogann"/></a> <a href="https://github.com/Seredeep"><img src="https://avatars.githubusercontent.com/u/22802816?v=4&s=48" width="48" height="48" alt="Seredeep" title="Seredeep"/></a> <a href="https://github.com/sergical"><img src="https://avatars.githubusercontent.com/u/3760543?v=4&s=48" width="48" height="48" alt="sergical" title="sergical"/></a> <a href="https://github.com/search?q=shatner"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="shatner" title="shatner"/></a> <a href="https://github.com/shiv19"><img src="https://avatars.githubusercontent.com/u/9407019?v=4&s=48" width="48" height="48" alt="shiv19" title="shiv19"/></a> <a href="https://github.com/shiyuanhai"><img src="https://avatars.githubusercontent.com/u/1187370?v=4&s=48" width="48" height="48" alt="shiyuanhai" title="shiyuanhai"/></a> <a href="https://github.com/Shrinija17"><img src="https://avatars.githubusercontent.com/u/199155426?v=4&s=48" width="48" height="48" alt="Shrinija17" title="Shrinija17"/></a>
  <a href="https://github.com/siraht"><img src="https://avatars.githubusercontent.com/u/73152895?v=4&s=48" width="48" height="48" alt="siraht" title="siraht"/></a> <a href="https://github.com/snopoke"><img src="https://avatars.githubusercontent.com/u/249606?v=4&s=48" width="48" height="48" alt="snopoke" title="snopoke"/></a> <a href="https://github.com/search?q=spiceoogway"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="spiceoogway" title="spiceoogway"/></a> <a href="https://github.com/stephenchen2025"><img src="https://avatars.githubusercontent.com/u/218387130?v=4&s=48" width="48" height="48" alt="stephenchen2025" title="stephenchen2025"/></a> <a href="https://github.com/search?q=succ985"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="succ985" title="succ985"/></a> <a href="https://github.com/Suvink"><img src="https://avatars.githubusercontent.com/u/10671497?v=4&s=48" width="48" height="48" alt="Suvink" title="Suvink"/></a> <a href="https://github.com/search?q=techboss"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="techboss" title="techboss"/></a> <a href="https://github.com/testingabc321"><img src="https://avatars.githubusercontent.com/u/8577388?v=4&s=48" width="48" height="48" alt="testingabc321" title="testingabc321"/></a> <a href="https://github.com/search?q=tewatia"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="tewatia" title="tewatia"/></a> <a href="https://github.com/search?q=The%20Admiral"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="The Admiral" title="The Admiral"/></a>
  <a href="https://github.com/search?q=therealZpoint-bot"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="therealZpoint-bot" title="therealZpoint-bot"/></a> <a href="https://github.com/thesash"><img src="https://avatars.githubusercontent.com/u/1166151?v=4&s=48" width="48" height="48" alt="thesash" title="thesash"/></a> <a href="https://github.com/search?q=uos-status"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="uos-status" title="uos-status"/></a> <a href="https://github.com/vcastellm"><img src="https://avatars.githubusercontent.com/u/47026?v=4&s=48" width="48" height="48" alt="vcastellm" title="vcastellm"/></a> <a href="https://github.com/search?q=Vibe%20Kanban"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Vibe Kanban" title="Vibe Kanban"/></a> <a href="https://github.com/vincentkoc"><img src="https://avatars.githubusercontent.com/u/25068?v=4&s=48" width="48" height="48" alt="vincentkoc" title="vincentkoc"/></a> <a href="https://github.com/search?q=void"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="void" title="void"/></a> <a href="https://github.com/search?q=Vultr-Clawd%20Admin"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Vultr-Clawd Admin" title="Vultr-Clawd Admin"/></a> <a href="https://github.com/search?q=Wimmie"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Wimmie" title="Wimmie"/></a> <a href="https://github.com/search?q=wolfred"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="wolfred" title="wolfred"/></a>
  <a href="https://github.com/wstock"><img src="https://avatars.githubusercontent.com/u/1394687?v=4&s=48" width="48" height="48" alt="wstock" title="wstock"/></a> <a href="https://github.com/wytheme"><img src="https://avatars.githubusercontent.com/u/5009358?v=4&s=48" width="48" height="48" alt="wytheme" title="wytheme"/></a> <a href="https://github.com/YangHuang2280"><img src="https://avatars.githubusercontent.com/u/201681634?v=4&s=48" width="48" height="48" alt="YangHuang2280" title="YangHuang2280"/></a> <a href="https://github.com/yazinsai"><img src="https://avatars.githubusercontent.com/u/1846034?v=4&s=48" width="48" height="48" alt="yazinsai" title="yazinsai"/></a> <a href="https://github.com/yevhen"><img src="https://avatars.githubusercontent.com/u/107726?v=4&s=48" width="48" height="48" alt="yevhen" title="yevhen"/></a> <a href="https://github.com/YiWang24"><img src="https://avatars.githubusercontent.com/u/176262341?v=4&s=48" width="48" height="48" alt="YiWang24" title="YiWang24"/></a> <a href="https://github.com/search?q=ymat19"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="ymat19" title="ymat19"/></a> <a href="https://github.com/search?q=Zach%20Knickerbocker"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Zach Knickerbocker" title="Zach Knickerbocker"/></a> <a href="https://github.com/zackerthescar"><img src="https://avatars.githubusercontent.com/u/38077284?v=4&s=48" width="48" height="48" alt="zackerthescar" title="zackerthescar"/></a> <a href="https://github.com/search?q=zhixian"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="zhixian" title="zhixian"/></a>
  <a href="https://github.com/0xJonHoldsCrypto"><img src="https://avatars.githubusercontent.com/u/81202085?v=4&s=48" width="48" height="48" alt="0xJonHoldsCrypto" title="0xJonHoldsCrypto"/></a> <a href="https://github.com/aaronn"><img src="https://avatars.githubusercontent.com/u/1653630?v=4&s=48" width="48" height="48" alt="aaronn" title="aaronn"/></a> <a href="https://github.com/Alphonse-arianee"><img src="https://avatars.githubusercontent.com/u/254457365?v=4&s=48" width="48" height="48" alt="Alphonse-arianee" title="Alphonse-arianee"/></a> <a href="https://github.com/atalovesyou"><img src="https://avatars.githubusercontent.com/u/3534502?v=4&s=48" width="48" height="48" alt="atalovesyou" title="atalovesyou"/></a> <a href="https://github.com/search?q=Azade"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Azade" title="Azade"/></a> <a href="https://github.com/carlulsoe"><img src="https://avatars.githubusercontent.com/u/34673973?v=4&s=48" width="48" height="48" alt="carlulsoe" title="carlulsoe"/></a> <a href="https://github.com/search?q=ddyo"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="ddyo" title="ddyo"/></a> <a href="https://github.com/search?q=Erik"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Erik" title="Erik"/></a> <a href="https://github.com/jiulingyun"><img src="https://avatars.githubusercontent.com/u/126459548?v=4&s=48" width="48" height="48" alt="jiulingyun" title="jiulingyun"/></a> <a href="https://github.com/latitudeki5223"><img src="https://avatars.githubusercontent.com/u/119656367?v=4&s=48" width="48" height="48" alt="latitudeki5223" title="latitudeki5223"/></a>
  <a href="https://github.com/search?q=Manuel%20Maly"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Manuel Maly" title="Manuel Maly"/></a> <a href="https://github.com/minghinmatthewlam"><img src="https://avatars.githubusercontent.com/u/14224566?v=4&s=48" width="48" height="48" alt="minghinmatthewlam" title="minghinmatthewlam"/></a> <a href="https://github.com/search?q=Mourad%20Boustani"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Mourad Boustani" title="Mourad Boustani"/></a> <a href="https://github.com/odrobnik"><img src="https://avatars.githubusercontent.com/u/333270?v=4&s=48" width="48" height="48" alt="odrobnik" title="odrobnik"/></a> <a href="https://github.com/pcty-nextgen-ios-builder"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="pcty-nextgen-ios-builder" title="pcty-nextgen-ios-builder"/></a> <a href="https://github.com/search?q=Quentin"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Quentin" title="Quentin"/></a> <a href="https://github.com/rafaelreis-r"><img src="https://avatars.githubusercontent.com/u/57492577?v=4&s=48" width="48" height="48" alt="rafaelreis-r" title="rafaelreis-r"/></a> <a href="https://github.com/search?q=Randy%20Torres"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Randy Torres" title="Randy Torres"/></a> <a href="https://github.com/rhjoh"><img src="https://avatars.githubusercontent.com/u/105699450?v=4&s=48" width="48" height="48" alt="rhjoh" title="rhjoh"/></a> <a href="https://github.com/search?q=Rolf%20Fredheim"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="Rolf Fredheim" title="Rolf Fredheim"/></a>
  <a href="https://github.com/ronak-guliani"><img src="https://avatars.githubusercontent.com/u/23518228?v=4&s=48" width="48" height="48" alt="ronak-guliani" title="ronak-guliani"/></a> <a href="https://github.com/search?q=William%20Stock"><img src="assets/avatar-placeholder.svg" width="48" height="48" alt="William Stock" title="William Stock"/></a>
</p>

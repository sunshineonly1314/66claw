# 多网关组网中心 -- 产品需求与交互设计文档

> **版本**: 2.0 (合并实例+节点，交互优化，文案白话化)
> **日期**: 2026-02-27
> **状态**: 待评审
> **文档类型**: 产品需求 + 交互设计 + 技术规格

---

## 目录

- [1. 背景与目标](#1-背景与目标)
- [2. 用户画像与场景](#2-用户画像与场景)
- [3. 系统现状评估](#3-系统现状评估)
- [4. 产品设计](#4-产品设计)
- [5. 交互设计](#5-交互设计)
- [6. 技术架构](#6-技术架构)
- [7. 接口设计 (RPC)](#7-接口设计-rpc)
- [8. 安全设计](#8-安全设计)
- [9. 分期计划](#9-分期计划)
- [10. 验收标准](#10-验收标准)
- [11. 风险登记表](#11-风险登记表)
- [12. 改动清单](#12-改动清单)

---

## 1. 背景与目标

### 1.1 背景

OpenClawCN 的多网关组网能力在底层已经比较完整 -- mDNS 发现、Tailscale 穿透、FRP 反向代理、Redis 状态同步、Node 设备配对。但这些能力全部隐藏在配置文件和 CLI 命令背后，普通用户完全无法使用。

当前 UI 中的"实例"页只是一个只读列表，显示已连接的信标，不能发现、连接、配置任何东西。"节点"页面虽然功能较多（配对、审批、执行绑定），但只管 Node -> Gateway 单向连接，不涉及 Gateway -> Gateway 组网。

用户要实现"两台电脑互连"或"手机连家里电脑"，需要手动编辑 JSON 配置文件、了解网络绑定模式、知道 Redis Pub/Sub 的概念 -- 这对小白用户来说完全不可接受。

### 1.2 目标

将分散在配置文件和 CLI 中的组网能力，整合到一个"组网中心"UI 页面，实现:

1. **一键切换网络模式**: 仅本机 / 局域网 / 远程，三选一
2. **自动发现**: 局域网内其他网关实例自动出现在列表中（macOS/Linux mDNS + Windows ciao browser）
3. **傻瓜连接**: 点击"连接"或输入地址即可组网
4. **一键穿透**: Tailscale Serve / FRP 反向代理，UI 上一个按钮就通
5. **Redis 同步**: 填地址、测试连接、一键启用

### 1.3 不做

- 自建中继服务（用户自备 FRP 服务器或 Tailscale 账号）
- 多租户管理（多 Gateway 之间没有统一的管理面板）
- 自动 SSL 证书签发（Tailscale Funnel 自带，FRP 需用户自配）
- P2P 直连（WebRTC/STUN/TURN 等，复杂度过高）

---

## 2. 用户画像与场景

### 2.1 核心场景

| # | 场景 | 用户类型 | 痛点 | 预期方案 |
|---|------|---------|------|---------|
| S1 | 手机连家里电脑 | 小白 | 不知道什么是端口、IP、WebSocket | 手机 App 自动发现局域网网关 + 一键配对 |
| S2 | 公司连家里网关 | 进阶 | 需要外网穿透，不会配 frpc | UI 上选 Tailscale，点一个按钮 |
| S3 | 两台电脑互连 | 进阶 | 两个网关共享消息和状态 | 局域网自动发现 + Redis 同步 |
| S4 | 智能家居联动 | 极客 | 多个节点分布在不同设备上 | 节点页面 + 组网中心统一管理 |
| S5 | 远程开发机执行命令 | 开发者 | Gateway 在笔记本，构建在远程服务器 | 手动输入服务器地址 + Node 配对 |

### 2.2 用户类型分层

| 层级 | 用户 | 预期交互 |
|------|------|---------|
| L1 小白 | 只用一台设备 | 默认"仅本机"模式，不需要碰组网中心 |
| L2 家庭 | 手机+电脑 | 切到"局域网"，手机 App 自动发现 |
| L3 跨网络 | 办公室+家里 | 开 Tailscale 或 FRP 穿透 |
| L4 集群 | 多台服务器 | Redis 同步 + 多 Gateway 实例 |

---

## 3. 系统现状评估

### 3.1 已完成组件（可直接复用）

| 组件 | 文件 | 说明 |
|------|------|------|
| mDNS 广播 | `src/infra/bonjour-service.ts` | @homebridge/ciao，全平台可用 |
| mDNS 发现 | `src/infra/bonjour-discovery.ts` | macOS(dns-sd) + Linux(avahi-browse)，**Windows 返回空** |
| Tailscale 检测 | `src/infra/tailscale.ts` | 二进制查找 + status --json + IP 获取 |
| Tailscale Serve/Funnel | `src/gateway/server-tailscale.ts` | 完整实现，含 serve 和 funnel 模式 |
| FRP 隧道管理 | `apps/desktop/src-tauri/src/repair/remote_tunnel.rs` | Rust 实现，含 30 分钟超时、Windows 隐窗 |
| SSH 隧道 | `src/gateway/ssh-tunnel.ts` | 自动隧道，依赖系统 ssh |
| ngrok 隧道 | `extensions/voice-call/src/tunnel.ts` | spawn ngrok，voice-call 扩展用 |
| Redis 状态存储 | `src/infra/state-store/redis-store.ts` | KV/Hash/Set/PubSub/分布式锁/可靠队列 |
| 分布式广播 | `src/infra/distributed-broadcast.ts` | Redis 频道 + echo suppression |
| Node 配对 | `src/gateway/server-methods/nodes.ts` | pending/approve/reject/verify 全流程 |
| Node 注册 | `src/gateway/node-registry.ts` | 内存 Map，256 上限，命令转发 |
| 节点心跳 | WebSocket ping/pong | 45s 间隔，3 次丢失断连 |
| 配置热重载 | `src/gateway/config-reload.ts` | 文件 watch + merge-patch + 部分路径触发重启 |
| Config Patch RPC | `config.patch` | baseHash 乐观锁，原子写入 |
| 重启哨兵 | `src/gateway/server-restart-sentinel.ts` | WS close code 1012，静默重连 |
| UI 自动重连 | `ui/src/ui/gateway.ts` | 指数退避 800ms~15s + pending RPC flush + 状态恢复 |
| 实例页（只读） | `ui/src/ui/views/instances.ts` | 信标列表，无交互能力 |
| 节点页 | `ui/src/ui/views/nodes.ts` | 配对审批 + 执行绑定 + 节点列表 |
| 网关 URL 确认框 | `ui/src/ui/views/gateway-url-confirmation.ts` | 可复用的安全确认弹窗 |
| Setup Wizard | `src/gateway/setup-wizard-handlers.ts` | 引导式配置写入模式 |

### 3.2 缺失/需要修复

| 项目 | 问题 | 修复方案 | 工作量 |
|------|------|---------|--------|
| Windows mDNS 发现 | 返回空数组 | 用 @homebridge/ciao createBrowser() | 0.5 天 |
| Windows Tailscale 路径 | findTailscaleBinary() 没搜 Windows 路径 | 加 `C:\Program Files\Tailscale\` | 0.5 天 |
| 网络状态 RPC | 无法从 UI 获取当前绑定模式/IP | 新增 `gateway.network.status` | 0.5 天 |
| 发现触发 RPC | mDNS 发现只有 CLI 入口 | 新增 `gateway.network.discover` | 0.5 天 |
| Redis 探活 RPC | 无法从 UI 测试 Redis 连接 | 新增 `gateway.network.probe` | 0.5 天 |
| 网络配置 RPC | 无法从 UI 切换 bind 模式 | 新增 `gateway.network.configure` | 1 天 |
| 组网中心 UI | "实例"页只有只读列表 | 改造为完整组网中心 | 1.5 天 |

### 3.3 重启影响域

以下配置变更会触发网关重启（约 1.5-3 秒，WS close code 1012，UI 自动重连）:

| 配置路径 | 触发重启 | 说明 |
|----------|---------|------|
| `gateway.bind` | 是 | 需要重新绑定端口 |
| `gateway.port` | 是 | 需要重新绑定端口 |
| `gateway.auth` | 是 | 安全策略变更 |
| `gateway.tailscale.*` | 是 | 需要启停 tailscale serve/funnel |
| `stateStore.backend` | 是 | 需要重新初始化存储层 |
| `stateStore.redis.*` | 是 | 需要重建 Redis 连接 |
| `discovery.mdns.*` | 否 | 仅影响发现行为，不影响服务 |

---

## 4. 产品设计

### 4.1 核心改动: 合并实例+节点为"组网中心"

将现有"实例"页（控制台组）和"节点"页（助手组）合并为一个"组网中心"页，用 tab 切换子功能。

**导航变化:**

| 现有导航 | 现有分组 | 合并后 |
|---------|---------|--------|
| 实例 (instances) | 控制台 | 删除，合并进组网 |
| 节点 (nodes) | 助手 | 删除，合并进组网 |
| -- | -- | **组网 (network)** -- 放入控制台分组，位置取代原"实例" |

导航从 2 项变 1 项，Tab union type 对应修改，路由使用 `/network`。

### 4.2 页面结构: 顶部状态条 + 3 个 tab

```
┌──────────────────────────────────────────────────────────────┐
│  组网中心                                                     │
│  ╔══════════════════════════════════════════════════════════╗ │
│  ║ 状态条: 仅本机模式 · 2 台设备在线 · 无远程访问             ║ │
│  ╚══════════════════════════════════════════════════════════╝ │
│                                                              │
│  [ 我的设备 ]  [ 连接方式 ]  [ 安全设置 ]                      │
│  ────────────────────────────────────────────────────────     │
│                                                              │
│          (当前 tab 的内容区)                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**tab 说明:**

| Tab | 名称 | 面向谁 | 包含内容 |
|-----|------|--------|---------|
| 1 | 我的设备 | 所有用户 | 在线设备统一列表(原实例+节点合并) + 局域网发现 + 手动添加 + 设备配对 |
| 2 | 连接方式 | 需要组网的用户 | 网络模式切换 + Tailscale/FRP 远程穿透 + Redis 高级同步 |
| 3 | 安全设置 | 进阶用户 | 命令权限管控(原执行审批) + 运行位置指定(原执行绑定) |

**设计原则:**
- 小白用户只看"我的设备" tab -- 一眼看到所有连上来的东西
- 需要组网时才切到"连接方式" -- 从"怎么让别人连上来"这个任务出发
- "安全设置"藏在第三个 tab -- 99% 的用户不需要碰

### 4.3 状态机

```
网络模式:
  loopback ←→ lan ←→ tailnet

  切换条件:
    loopback → lan: 需要 auth token（无则引导设置）
    loopback → tailnet: 需要 Tailscale 在线 + auth token
    lan → loopback: 直接切换

穿透状态:
  off → tailscale_serve → tailscale_funnel
  off → frp_connected

  Tailscale 前提: Tailscale 二进制已安装 + 已登录
  FRP 前提: 用户提供 frps 地址 + token

Redis 同步:
  disabled → testing → connected / failed
  connected → disabled (关闭)
```

---

## 5. 交互设计

### 5.0 顶部状态条 (所有 tab 共享)

所有 tab 上方固定一行状态总结，让用户 0.5 秒看懂当前状态。

```
┌──────────────────────────────────────────────────────────────┐
│  仅本机模式 · 2 台设备在线 · 无远程访问                        │
└──────────────────────────────────────────────────────────────┘
```

状态条组成: `{网络模式} · {在线设备数} · {穿透状态}`

| 网络模式 | 显示 |
|---------|------|
| loopback | "仅本机模式" |
| lan | "局域网模式 · 192.168.1.100" |
| tailnet | "远程模式 · Tailscale" |

| 穿透状态 | 显示 |
|---------|------|
| 无 | "无远程访问" |
| Tailscale Serve | "Tailscale 组网已开启" |
| Tailscale Funnel | "公网访问已开启" |
| FRP | "FRP 穿透已连接" |

| 设备数 | 显示 |
|--------|------|
| 0 | "暂无设备" |
| N | "{N} 台设备在线" |

点击状态条可以跳转到对应 tab（点"仅本机模式"跳到连接方式 tab，点设备数跳到我的设备 tab）。

---

### 5.1 Tab 1: 我的设备

**信息优先级重排**: 小白用户最关心的是"我有哪些设备、它们在不在线"。原节点页把"执行审批"放在最上面是反人类的。

#### 5.1.1 布局

```
┌──────────────────────────────────────────────────────────────┐
│  [ 我的设备 ]  [ 连接方式 ]  [ 安全设置 ]                      │
│  ────────────────────────────────────────────────────────     │
│                                                              │
│  ── 在线设备 ──────────────────────────────── [添加设备]      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ● 本机网关                    127.0.0.1:18789         │  │
│  │    gateway · Windows · v2026.2 · 心跳正常               │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ● 控制面板                    当前浏览器               │  │
│  │    webchat · 心跳 3 秒前                                │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ● iPhone 15 Pro               已配对 · 在线            │  │
│  │    手机 · iOS 18 · 拍照 定位 截屏                       │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ○ Peter-MacBook               192.168.1.50            │  │
│  │    局域网发现 · macOS · 3 秒前               [连接]     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ── 设备配对 ──────────────────────────────────────────────  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  待审批                                                │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  新设备请求连接: Xiaomi-14                        │  │  │
│  │  │  设备ID: abc123 · IP: 192.168.1.88 · 3 分钟前    │  │  │
│  │  │                         [拒绝]  [批准连接]        │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  已配对设备                                             │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  iPhone 15 Pro · 设备ID: xyz789                  │  │  │
│  │  │  角色: node · 权限: chat, exec                    │  │  │
│  │  │  密钥: 活跃 · 上次使用: 2 小时前                   │  │  │
│  │  │                      [更换密钥]  [取消配对]        │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ── 如何添加新设备 ─────────────────────────── (可折叠)      │
│  │                                                        │  │
│  │  手机/平板:                                             │  │
│  │    1. 下载 OpenClawCN App（应用商店搜索 "OpenClaw"）    │  │
│  │    2. 打开 App，自动发现同一 Wi-Fi 下的网关              │  │
│  │    3. 在上方"待审批"中批准连接                           │  │
│  │                                                        │  │
│  │  其他电脑:                                              │  │
│  │    1. 在目标电脑上安装 OpenClawCN                       │  │
│  │    2. 运行后会自动发现局域网网关                         │  │
│  │    3. 或者点击上方 [添加设备] 手动输入地址                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ── Windows 提示（仅 Windows 平台显示）────────────────────  │
│  │  自动搜索附近设备的功能正在开发中。                       │  │
│  │  你可以点击 [添加设备] 手动输入对方的 IP 地址连接。       │  │
│  │  好消息: 其他设备（Mac/手机）可以自动发现你的电脑。       │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

#### 5.1.2 设备统一列表设计要点

**混合展示**: 信标实例(原 instances) + 已配对节点(原 nodes) + 局域网发现 = 同一个列表，按状态排序:
1. 在线设备（绿色 ● 标记）-- 网关、UI、已连接节点
2. 离线设备（灰色 ○ 标记）-- 已配对但离线的节点
3. 发现但未连接（蓝色 ○ 标记）-- mDNS 发现的其他网关，带"连接"按钮

**每个设备卡片的信息:**
- 第一行: 状态圆点 + 设备名 + 右侧地址/状态标签
- 第二行: 类型(网关/控制面板/手机/电脑) + 平台 + 能力标签（拍照/定位/截屏/执行命令）
- 能力标签使用中文短词而非英文 caps: camera→拍照, location→定位, canvas→截屏, system.run→命令

**语义颜色 chip:**
| 状态 | 颜色 | 说明 |
|------|------|------|
| 在线 | 绿色 `chip-ok` | 心跳正常 |
| 离线 | 灰色 `chip-muted` | 超过 3 分钟无心跳 |
| 配对中 | 橙色 `chip-warn` | 等待审批 |
| 未连接(发现) | 蓝色 `chip-info` | mDNS 发现但未配对 |

#### 5.1.3 "添加设备"弹窗

地址输入框只要求输入 IP 和端口，不需要 ws:// 前缀:

```
┌──────────────────────────────────────────────┐
│  添加设备                                     │
│                                              │
│  输入对方的 IP 地址和端口:                     │
│  IP 地址: [ 192.168.1.50 ]                   │
│  端口:    [ 18789 ]  (默认)                   │
│  密码:    [ ____________ ]  (没有可以不填)     │
│                                              │
│  [测试能不能连上]                              │
│  结果: 连上了! 对方版本 v2026.2.22             │
│                                              │
│                    [取消]  [添加到我的设备]     │
└──────────────────────────────────────────────┘
```

#### 5.1.4 交互流程

```
进入"我的设备" tab
  │
  ├─ 自动加载 presence 订阅 → 在线实例列表
  ├─ 自动加载 nodes.list → 已配对节点
  ├─ 自动加载 devices.list → 配对请求
  │
  ├─ 平台检测:
  │   ├─ macOS/Linux → 自动 mDNS 发现（30 秒刷新），结果追加到列表
  │   └─ Windows → 显示提示条
  │
  ├─ 三种数据源合并排序 → 渲染统一设备列表
  │
  ▼ 用户操作
  │
  ├─ 点击发现项的"连接" → 弹出 URL 确认框 → 确认 → 建立连接
  ├─ 点击"添加设备" → 弹出手动添加弹窗
  ├─ 点击待审批的"批准连接" → 调 devices.approve → 设备变为已配对
  ├─ 点击已配对的"更换密钥" → 调 devices.rotate
  └─ 点击已配对的"取消配对" → 确认弹窗 → 调 devices.revoke
```

#### 5.1.5 功能完整性映射（原实例+节点页 → 新页面）

| 原功能 | 原位置 | 新位置 | 变化 |
|--------|-------|--------|------|
| 实例说明"什么是实例" | instances.ts L17-26 | 删除 | 状态条已经自解释，不需要教育性文案 |
| 已连接实例列表 | instances.ts L27-58 | Tab1 在线设备列表 | 合并到统一列表 |
| 实例详情 chip (模式/角色/平台/版本) | instances.ts L81-92 | Tab1 设备卡片 | 保留，chip 文案中文化 |
| 实例时间 (心跳/最后输入/原因) | instances.ts L95-98 | Tab1 设备卡片 | 保留在卡片右侧 |
| 实例空状态提示 | instances.ts L48-53 | Tab1 空状态 | 文案白话化 |
| 节点帮助说明 | nodes.ts L58-82 | Tab1 "如何添加新设备"折叠区 | 文案从 CLI 改为 App 优先 |
| 节点列表 | nodes.ts L87-103 | Tab1 在线设备列表 | 合并到统一列表 |
| 节点详情 (nodeId/IP/版本/caps/commands) | nodes.ts L1090-1120 | Tab1 设备卡片 | caps 中文化 |
| 设备配对 - 待审批 | nodes.ts L106-172 | Tab1 设备配对区 | 完整保留，按钮文案优化 |
| 设备配对 - 已配对 | nodes.ts L174-196 | Tab1 设备配对区 | 完整保留 |
| 设备配对 - Token 管理 | nodes.ts L199-226 | Tab1 设备配对区 | 保留，"轮换"改为"更换密钥"，"撤销"改为"取消配对" |
| 执行审批（安全策略） | nodes.ts L544-866 | **Tab3** 安全设置 | 完整保留，文案优化 |
| 执行节点绑定 | nodes.ts L463-541 | **Tab3** 安全设置 | 完整保留，文案优化 |

---

### 5.2 Tab 2: 连接方式

把"怎么让别的设备连上来"这个任务的所有方式放在一起。

#### 5.2.1 布局

```
┌──────────────────────────────────────────────────────────────┐
│  [ 我的设备 ]  [ 连接方式 ]  [ 安全设置 ]                      │
│  ────────────────────────────────────────────────────────     │
│                                                              │
│  ── 网络模式 ──────────────────────────────────────────────  │
│                                                              │
│  谁能连接到你的网关?                                          │
│                                                              │
│  ┌───────────────┐  ┌────────────────┐  ┌──────────────┐    │
│  │  ● 只有本机     │  │  ○ 同一个网络   │  │  ○ 任何地方  │    │
│  │  最安全，适合   │  │  家里/公司      │  │  需要穿透    │    │
│  │  单人使用       │  │  Wi-Fi 下的设备  │  │  工具辅助    │    │
│  └───────────────┘  └────────────────┘  └──────────────┘    │
│                                                     [保存]   │
│                                                              │
│  当前地址: 127.0.0.1:18789                                    │
│  你的局域网 IP: 192.168.1.100                                 │
│                                                              │
│  ── 切换到"同一个网络"时展开 ──────────────────────────────── │
│  │                                                        │  │
│  │  需要设置一个连接密码，防止陌生设备随意连入:               │  │
│  │                                                        │  │
│  │  ○ 帮我自动生成一个（推荐）                              │  │
│  │  ○ 我自己设: [__________]                               │  │
│  │                                                        │  │
│  │  保存后网关会重启，大约 3 秒就好。页面会自动恢复。          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ── 远程穿透 ──────────────────────────────────────────────  │
│                                                              │
│  不在同一个网络？用以下方式让远程设备也能连上来:                │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Tailscale（最简单，推荐）                               │  │
│  │  两台设备都装上 Tailscale，自动打通网络，免费。            │  │
│  │                                                        │  │
│  │  状态: 已检测到 Tailscale                                │  │
│  │  你的 Tailscale 地址: 100.64.1.23                       │  │
│  │  你的域名: my-pc.tail12345.ts.net                       │  │
│  │                                                        │  │
│  │  我想要:                                                │  │
│  │  ○ 只让装了 Tailscale 的设备访问                         │  │
│  │  ○ 让任何人都能通过链接访问（会自动要求密码）             │  │
│  │                                                        │  │
│  │  [开启]                                                 │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ── Tailscale 未安装时 ────────────────────────────────────  │
│  │  没检测到 Tailscale。                                   │  │
│  │  Tailscale 是一款免费的组网工具，装上就能用，不需要       │  │
│  │  任何网络知识。两台设备各装一个，自动互连。               │  │
│  │  [去了解一下 →]                                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  内网穿透 FRP（需要自己有服务器）                        │  │
│  │  如果你有一台有公网 IP 的服务器，可以用它做中转。         │  │
│  │                                                        │  │
│  │  服务器地址: [____________]                              │  │
│  │  端口:       [____]                                     │  │
│  │  密钥:       [____________]                              │  │
│  │                                                        │  │
│  │  注意: 中转服务器可以看到你的所有数据。                    │  │
│  │  请只用你自己的或者你信任的服务器。                        │  │
│  │                                                        │  │
│  │                          [测试服务器]  [连接]            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ── 多台网关联动 ──────────────────────────── (折叠，高级)   │
│  ▶ 如果你有多台电脑各跑一个网关，想让它们共享消息...           │
│                                                              │
│  ── 展开后 ────────────────────────────────────────────────  │
│  │  多台网关之间可以通过 Redis 共享消息和对话状态。           │  │
│  │  这是高级功能，适合多服务器部署或容灾场景。               │  │
│  │                                                        │  │
│  │  当前: 未启用                                           │  │
│  │                                                        │  │
│  │  Redis 地址: [ redis://192.168.1.200:6379 ]             │  │
│  │                                                        │  │
│  │                         [测试能不能连]  [启用]           │  │
│  │                                                        │  │
│  │  启用后网关会重启，大约 3 秒就好。                        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

#### 5.2.2 网络模式切换交互流程

```
用户点击"同一个网络"
  │
  ├─ 已有连接密码？
  │   ├─ 是 → "保存"按钮可点击
  │   └─ 否 → 展开密码设置区
  │           ├─ 默认选"帮我自动生成"
  │           └─ 任一选项就绪后 → "保存"按钮可点击
  │
  ▼ 用户点击"保存"
  │
  ├─ 调用 gateway.network.configure 写入 bind + auth
  ├─ 按钮变为"正在保存..."
  ├─ 网关重启（WS close code 1012）
  ├─ 顶部状态条短暂显示"正在重启..."
  ├─ 自动重连（指数退避，最多 15s）
  └─ 重连成功 → 状态条更新为"局域网模式 · 192.168.1.100"
```

#### 5.2.3 Tailscale 交互流程

```
页面加载
  │
  ├─ 检测 Tailscale: findTailscaleBinary() + tailscale status --json
  │
  ├─ 未安装 → 显示引导卡片
  │
  ├─ 已安装但未登录 → 提示"请先在系统托盘登录 Tailscale"
  │
  └─ 已安装已登录 → 显示地址、域名、模式选项

  ▼ 用户选"只让装了 Tailscale 的设备访问" + 点击"开启"
  │
  ├─ 调用 gateway.network.configure(tailscaleMode: "serve")
  ├─ 若无密码 → 自动生成并写入
  ├─ 网关重启 → 自动重连
  ├─ 状态条更新: "Tailscale 组网已开启"
  └─ 显示: "其他设备访问地址: https://my-pc.tail12345.ts.net:18789"
```

#### 5.2.4 FRP 交互流程

```
用户输入服务器信息
  │
  ├─ 点击"测试服务器" → gateway.network.probe(type: "frp", ...)
  │   ├─ 成功 → 绿色: "服务器连得上"
  │   └─ 失败 → 红色: "连不上: 超时/地址错/密钥错"
  │
  ▼ 点击"连接"
  │
  ├─ 调用 gateway.tunnel.start(type: "frp", ...)
  ├─ 按钮变为"连接中..."
  ├─ 成功 → "已连接! 远程地址: frps.example.com:7000"
  └─ 失败 → 错误详情 + 重试按钮
```

---

### 5.3 Tab 3: 安全设置

原节点页的"执行审批"和"执行绑定"功能完整搬过来，但文案全面白话化。

#### 5.3.1 布局

```
┌──────────────────────────────────────────────────────────────┐
│  [ 我的设备 ]  [ 连接方式 ]  [ 安全设置 ]                      │
│  ────────────────────────────────────────────────────────     │
│                                                              │
│  ── 命令权限 ──────────────────────────────── [保存]         │
│                                                              │
│  控制 AI 助手能在设备上执行哪些操作。                          │
│  这是重要的安全设置，可以防止 AI 做出危险操作。                 │
│                                                              │
│  管控对象:                                                    │
│  [  网关（本机）  ▼]  [  选择节点  ▼]                          │
│                                                              │
│  按助手设置:                                                  │
│  [ 全局默认 ]  [ 主助手(main) ]  [ 翻译助手(translator) ]     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  权限级别                                               │  │
│  │  AI 助手在这台设备上能做什么?                             │  │
│  │  [ 只允许指定命令（推荐）  ▼]                            │  │
│  │                                                        │  │
│  │  级别说明:                                              │  │
│  │  · 禁止一切 -- AI 不能执行任何命令                       │  │
│  │  · 只允许指定命令 -- 只能跑你批准的命令（推荐）           │  │
│  │  · 完全放开 -- AI 可以执行任何命令（有风险）              │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  遇到没见过的命令时                                      │  │
│  │  AI 想执行一个不在列表里的命令时，怎么办?                 │  │
│  │  [ 弹窗问我（推荐）  ▼]                                  │  │
│  │                                                        │  │
│  │  · 不问，直接拒绝                                       │  │
│  │  · 只在不认识的命令时问我                                │  │
│  │  · 每次都问我                                           │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  弹窗问不了时怎么办                                      │  │
│  │  如果界面没打开、弹窗无法显示:                            │  │
│  │  [ 拒绝执行  ▼]                                         │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  自动信任技能自带的命令                                   │  │
│  │  已安装技能声明的可执行文件，自动加入允许列表。             │  │
│  │  [ ✓ 开启 ]                                             │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ── 允许的命令列表 ──────────────────────── [添加命令]       │
│  （仅在"只允许指定命令"模式下显示）                            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  命令模式: [ node* ]                                    │  │
│  │  上次使用: 2 小时前 · node --version                    │  │
│  │                                         [删除]          │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  命令模式: [ git* ]                                     │  │
│  │  上次使用: 从未                                         │  │
│  │                                         [删除]          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ── 运行位置 ──────────────────────────────── [保存]         │
│                                                              │
│  指定 AI 助手在哪台设备上执行命令。                            │
│  默认在网关本机执行。如果你有远程服务器，可以指定到那台机器上。  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  默认运行位置                                           │  │
│  │  没有特别指定的助手，都在这里跑:                          │  │
│  │  [ 网关本机  ▼]                                         │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  主助手 (main) -- 默认助手                               │  │
│  │  [ 跟随默认（网关本机）  ▼]                              │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  翻译助手 (translator)                                  │  │
│  │  [ Build-Server (192.168.1.200)  ▼]                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 5.3.2 功能完整性映射

| 原功能 (nodes.ts) | 原代码 | Tab3 对应 | 文案变化 |
|-------------------|--------|-----------|---------|
| execApprovals 整体 | L544-583 | "命令权限"区 | "执行审批"→"命令权限" |
| target 选择 (gateway/node) | L585-650 | "管控对象"下拉 | "目标"→"管控对象" |
| scope tab (defaults/各agent) | L652-677 | "按助手设置" tab 行 | "作用域"→"按助手设置" |
| security (deny/allowlist/full) | L679-866 | "权限级别"卡片 | "安全"→"权限级别"；"拒绝/白名单/完全"→"禁止一切/只允许指定命令/完全放开" |
| ask (off/on-miss/always) | 同上 | "遇到没见过的命令时"卡片 | "询问"→白话描述 |
| askFallback | 同上 | "弹窗问不了时怎么办"卡片 | "询问后备"→白话描述 |
| autoAllowSkills | 同上 | "自动信任技能命令"卡片 | "自动允许技能命令行"→"自动信任技能自带的命令" |
| allowlist (pattern 增删) | L868-950 | "允许的命令列表"区 | "白名单"→"允许的命令列表"；"添加模式"→"添加命令" |
| bindings 整体 | L463-541 | "运行位置"区 | "执行节点绑定"→"运行位置" |
| defaultBinding | L499-530 | "默认运行位置" | "默认绑定"→"默认运行位置" |
| agentBinding | L952-995 | 每个助手一行 | "绑定"→"运行位置"；"使用默认"→"跟随默认" |

---

### 5.4 空状态与首次引导

#### 首次进入（默认 loopback 模式，无设备）

"我的设备" tab 显示空状态引导:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  还没有其他设备连上来                                         │
│                                                              │
│  想让手机或其他电脑连接到你的 AI 助手?                         │
│                                                              │
│  最简单的方式:                                                │
│  1. 把网络模式改成"同一个网络" → [去设置]                      │
│  2. 在手机上下载 OpenClawCN App                              │
│  3. App 会自动发现你的电脑，点一下就连上了                     │
│                                                              │
│  不在同一个 Wi-Fi？试试远程穿透 → [去设置]                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

"去设置"按钮点击后切换到"连接方式" tab。

---

## 6. 技术架构

### 6.1 分层架构

```
┌──────────────────────────────────────────────────────────────┐
│  UI Layer (Lit)                                              │
│  - views/network-center.ts (合并 instances.ts + nodes.ts)    │
│  - controllers/networking.ts (新增)                          │
│  - controllers/nodes.ts (保留，Tab3 复用)                     │
│  - controllers/devices.ts (保留，Tab1 复用)                   │
│  - i18n: zh-CN/en 新增 network.* 键 + 修改 nodes.* 文案     │
└────────────────┬─────────────────────────────────────────────┘
                 │ WebSocket RPC
┌────────────────▼─────────────────────────────────────────────┐
│  Gateway RPC Layer                                           │
│  - server-methods/networking.ts (新增, 5 个 RPC)             │
│  - server-methods/tunnel.ts (新增, 穿透管理)                 │
│  - server-methods/nodes.ts (已有, Tab1 配对/列表)            │
│  - server-methods/exec-approvals (已有, Tab3 安全设置)       │
└────────────────┬─────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────┐
│  Infrastructure Layer (已有)                                  │
│  - bonjour-discovery.ts (+ Windows ciao browser 补丁)        │
│  - tailscale.ts (+ Windows 路径补丁)                          │
│  - state-store/redis-store.ts                                │
│  - config-reload.ts                                          │
│  - server-restart-sentinel.ts                                │
│  - repair/remote_tunnel.rs (FRP)                             │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 数据流

```
状态查询:
  UI → gateway.network.status → 聚合 bind/IP/tailscale/redis 状态 → UI 渲染

发现:
  UI → gateway.network.discover → discoverGatewayBeacons() → mDNS/Tailscale DNS-SD → beacon 列表 → UI 渲染

配置变更:
  UI → config.patch({gateway:{bind:"lan"}, gateway:{auth:{token:"xxx"}}})
     → merge-patch 写入 JSON
     → config-reload 检测到 gateway.* 变更
     → scheduleGracefulRestart()
     → WS close 1012
     → UI 自动重连

穿透:
  UI → gateway.tunnel.start(type: "tailscale", mode: "serve")
     → config.patch({gateway:{tailscale:{mode:"serve"}}})
     → 重启 → tailscale serve 启动
     → UI 重连后查询新状态
```

---

## 7. 接口设计 (RPC)

### 7.1 gateway.network.status

查询当前网关网络状态。

**请求**: `{}`

**响应**:
```typescript
interface NetworkStatus {
  bind: {
    mode: "loopback" | "lan" | "tailnet";
    host: string;          // "127.0.0.1" | "0.0.0.0" | "100.64.x.x"
    port: number;          // 18789
    actualAddress: string; // "127.0.0.1:18789"
  };
  lan: {
    primaryIp: string | null;   // "192.168.1.100"
    allInterfaces: Array<{name: string; address: string; family: "IPv4" | "IPv6"}>;
  };
  tailscale: {
    installed: boolean;
    loggedIn: boolean;
    ip: string | null;         // "100.64.1.23"
    hostname: string | null;   // "my-pc"
    dnsName: string | null;    // "my-pc.tail12345.ts.net"
    serveMode: "off" | "serve" | "funnel";
  };
  auth: {
    hasToken: boolean;       // 是否已设置 gateway auth token
    tokenType: "shared-secret" | "none";
  };
  stateStore: {
    backend: "memory" | "redis";
    redisConnected: boolean;
    redisUrl: string | null; // 脱敏: 隐藏密码部分
  };
  platform: string;          // "win32" | "darwin" | "linux"
}
```

### 7.2 gateway.network.discover

触发网络发现扫描。

**请求**:
```typescript
interface DiscoverRequest {
  scope?: "lan" | "wide-area" | "all";  // 默认 "lan"
  timeoutMs?: number;                    // 默认 5000
}
```

**响应**:
```typescript
interface DiscoverResponse {
  beacons: Array<{
    instanceName: string;
    host: string;
    port: number;
    lanHost?: string;
    tailnetDns?: string;
    role: string;
    platform: string;
    version: string;
    transport: string;
    tls: boolean;
    tlsFingerprint?: string;
    discoveredVia: "mdns" | "tailnet-dns-sd";
    ageMs: number;
  }>;
  errors?: string[];  // 发现过程中的非致命错误
}
```

### 7.3 gateway.network.probe

测试远程目标可达性。

**请求**:
```typescript
interface ProbeRequest {
  type: "gateway" | "redis" | "frp";
  // gateway:
  url?: string;       // "ws://192.168.1.50:18789"
  token?: string;
  // redis:
  redisUrl?: string;  // "redis://host:6379"
  // frp:
  frpHost?: string;
  frpPort?: number;
  frpToken?: string;
}
```

**响应**:
```typescript
interface ProbeResponse {
  reachable: boolean;
  latencyMs: number;
  error?: string;
  // gateway 额外:
  gatewayVersion?: string;
  gatewayPlatform?: string;
  // redis 额外:
  redisVersion?: string;
}
```

### 7.4 gateway.network.configure

写入网络相关配置并触发必要的重启。

**请求**:
```typescript
interface ConfigureRequest {
  // 可选，每个字段只有提供时才会写入
  bind?: "loopback" | "lan" | "tailnet";
  authToken?: string;         // 设置 auth token
  generateAuthToken?: boolean; // 自动生成 auth token
  tailscaleMode?: "off" | "serve" | "funnel";
  stateStoreBackend?: "memory" | "redis";
  redisUrl?: string;
  redisKeyPrefix?: string;
}
```

**响应**:
```typescript
interface ConfigureResponse {
  applied: string[];    // 实际变更的配置路径
  restartRequired: boolean;
  restartScheduledMs?: number;  // 重启倒计时毫秒
}
```

**说明**: 此方法内部调用 `config.patch`，但增加了业务校验:
- `bind: "lan"` 时必须有 auth token（否则拒绝并返回错误）
- `tailscaleMode: "serve"/"funnel"` 时检测 Tailscale 是否在线（否则返回错误）
- `stateStoreBackend: "redis"` 时检测 Redis 是否可达（否则返回警告但仍允许）

### 7.5 gateway.network.interfaces

枚举本机网络接口。

**请求**: `{}`

**响应**:
```typescript
interface InterfacesResponse {
  interfaces: Array<{
    name: string;       // "eth0", "Wi-Fi", "Tailscale"
    address: string;    // "192.168.1.100"
    family: "IPv4" | "IPv6";
    internal: boolean;
    mac: string;
    isTailscale: boolean;
  }>;
  primaryLanIp: string | null;
  primaryTailscaleIp: string | null;
}
```

### 7.6 gateway.tunnel.start / stop / status

穿透隧道管理。

**start 请求**:
```typescript
interface TunnelStartRequest {
  type: "tailscale" | "frp";
  // tailscale:
  tailscaleMode?: "serve" | "funnel";
  // frp:
  frpServerAddr?: string;
  frpServerPort?: number;
  frpToken?: string;
  frpLocalPort?: number;    // 默认使用网关端口
  frpRemotePort?: number;
  frpTimeoutMinutes?: number; // 默认 0 = 不超时; FRP 的 30 分钟超时由 Rust 层控制
}
```

**status 响应**:
```typescript
interface TunnelStatus {
  tunnels: Array<{
    type: "tailscale" | "frp" | "ssh";
    status: "connecting" | "connected" | "disconnected" | "error";
    remoteUrl?: string;       // 远程可访问的地址
    connectedSince?: string;  // ISO 时间
    error?: string;
    autoReconnect: boolean;
  }>;
}
```

---

## 8. 安全设计

### 8.1 原则

| 原则 | 实施 |
|------|------|
| 默认安全 | 新装即 loopback，无外部暴露 |
| 切换即验证 | 从 loopback 切到 lan/tailnet 强制设 auth token |
| 密码不明文 | UI 不回显完整 token，status 接口脱敏 |
| 穿透可控 | FRP 配置可选超时（30 分钟安全窗口），Funnel 强制 auth |
| 配对即授权 | 每个 Node 需要人工审批，不自动信任 |

### 8.2 auth token 管理

- 自动生成: `crypto.randomBytes(32).toString("base64url")` -- 43 字符
- 存储位置: 配置文件中的 `gateway.auth.token`
- 传输: WebSocket over TLS（Tailscale Serve 自动 HTTPS），或用户自行确保局域网安全
- UI 显示: 生成后显示一次（带"复制"按钮），之后只显示 `●●●●●●...` + "重新生成"

### 8.3 FRP 安全

- 上游 Rust 实现已有 30 分钟超时（`TUNNEL_TIMEOUT_SECS = 1800`），可配置为 0 取消
- token 存储在配置文件中，不在日志中输出
- 建议 UI 提示: "FRP 中继服务器可以看到您的所有流量。请确保使用您信任的服务器。"

### 8.4 攻击面分析

| 风险 | 缓解 |
|------|------|
| CVE-2026-25253 类攻击（恶意网页窃取 token） | bind 默认 loopback，非 loopback 强制 auth |
| mDNS 投毒（伪造网关 beacon） | 连接时显示 TLS 指纹确认框（已有 gateway-url-confirmation） |
| Redis 未授权访问 | UI 提示设置 Redis 密码，probe 时检测是否有 AUTH |
| FRP 中间人 | 提示用户信任风险，建议使用 Tailscale 替代 |

---

## 9. 分期计划

### Phase 1: MVP -- 合并页面 + 局域网组网 (约 5 天)

| 任务 | 工作量 | 文件 |
|------|--------|------|
| 合并 instances + nodes → network-center (Tab1+Tab3) | 1.5 天 | `ui/src/ui/views/network-center.ts` |
| 状态条 + Tab 切换框架 | 0.5 天 | 同上 |
| 导航改造 (删 instances/nodes，加 network) | 0.5 天 | `ui/src/ui/navigation.ts` + `app-render.ts` |
| gateway.network.status / discover / probe / configure RPC | 1.5 天 | `src/gateway/server-methods/networking.ts` |
| i18n 文案白话化 (nodes.* 重写 + network.* 新增) | 0.5 天 | `ui/src/ui/i18n/locales/zh-CN.ts` + `en.ts` |
| Windows mDNS 发现修复 (ciao browser) | 0.5 天 | `src/infra/bonjour-discovery.ts` |

**Phase 1 交付物**: 合并后的组网中心，Tab1 设备列表 + Tab2 网络模式切换 + Tab3 安全设置(原功能保留)，局域网发现+手动添加。

### Phase 2: 外网穿透 (约 3 天)

| 任务 | 工作量 | 文件 |
|------|--------|------|
| Tab2 Tailscale 穿透 UI + RPC | 1.5 天 | tunnel.start/stop/status |
| Windows Tailscale 路径修复 | 0.5 天 | `src/infra/tailscale.ts` |
| Tab2 FRP 穿透 UI (复用 Rust 实现) | 1 天 | Tauri command 桥接 |

**Phase 2 交付物**: Tailscale 一键穿透 + FRP 一键穿透。

### Phase 3: 高级功能 (约 2 天)

| 任务 | 工作量 | 文件 |
|------|--------|------|
| Tab2 Redis 同步配置 UI | 1 天 | 折叠区 |
| Tab2 "任何地方"模式（Tailnet bind） | 0.5 天 | 网络模式第三选项 |
| 设备列表能力标签中文化 | 0.5 天 | presenter + i18n |

**Phase 3 交付物**: 完整的组网中心，含 Redis 同步。

### 总工期: 约 10 天（MVP 5 天可上线）

---

## 10. 验收标准

### Phase 1 验收

| # | 场景 | 验收条件 |
|---|------|---------|
| 1 | 导航变化 | 原"实例"和"节点"导航项消失，出现"组网"导航项 |
| 2 | 状态条 | 进入页面顶部显示"仅本机模式 · N 台设备在线 · 无远程访问" |
| 3 | Tab1 统一设备列表 | 信标实例+已配对节点在同一列表中，绿色=在线、灰色=离线 |
| 4 | Tab1 设备配对 | 待审批设备可批准/拒绝；已配对设备可更换密钥/取消配对 |
| 5 | Tab1 局域网发现 | macOS/Linux 自动发现同局域网网关，5 秒内出现 |
| 6 | Tab1 手动添加 | 输入 IP+端口（不需要 ws://），测试成功后添加 |
| 7 | Tab1 Windows 提示 | ciao browser 不可用时显示白话提示，不显示技术错误 |
| 8 | Tab2 网络模式切换 | 选"同一个网络"→无密码展开设置→保存→重启→自动重连 |
| 9 | Tab3 命令权限 | 原执行审批全部功能正常：权限级别/按助手设置/命令列表 |
| 10 | Tab3 运行位置 | 原执行绑定全部功能正常：默认绑定/按助手绑定 |
| 11 | 文案检查 | 页面上无"执行审批/作用域/白名单/询问后备"等技术术语 |
| 12 | 并发写保护 | 快速连续点两次"保存"，第二次报友好错误 |

### Phase 2 验收

| # | 场景 | 验收条件 |
|---|------|---------|
| 13 | Tailscale 检测 | 已装已登录 → 显示地址域名；未装 → 白话引导卡片 |
| 14 | Tailscale 开启 | 点"开启" → 重启 → 状态条更新 + 显示访问地址 |
| 15 | FRP 连接 | 输入信息 → 测试 → 连接 → 显示远程地址 |
| 16 | Windows Tailscale | Windows 能检测到 `C:\Program Files\Tailscale\` |

### Phase 3 验收

| # | 场景 | 验收条件 |
|---|------|---------|
| 17 | Redis 测试 | 输入地址 → 点"测试能不能连" → 显示延迟 |
| 18 | Redis 启用 | 确认后重启 → 重连后状态为"已启用" |
| 19 | 能力标签中文化 | camera→拍照, location→定位, system.run→命令 等全部中文 |

---

## 11. 风险登记表

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Windows ciao browser 不稳定 | 发现功能失效 | 中 | 降级为手动输入；ciao 是 homebridge 生态广泛使用的库 |
| 重启期间用户正在操作 | 操作丢失 | 低 | UI 在重启前显示倒计时，config.patch 有 baseHash 保护 |
| FRP 服务器不可达 | 穿透失败 | 中 | probe 先测试，失败给明确错误信息 |
| Redis 配置错误导致网关启动失败 | 网关无法启动 | 低 | Redis 连接失败时 fallback 到 memory store |
| Tailscale Funnel 暴露到公网 | 安全风险 | 低 | 强制 auth，UI 明确警告"任何人可访问" |
| 配置文件写坏 | 网关无法启动 | 极低 | config.patch 原子写入 + baseHash 乐观锁 |

---

## 12. 改动清单 (v2.0 合并方案)

### 新增文件

| 文件 | 说明 | Phase |
|------|------|-------|
| `ui/src/ui/views/network-center.ts` | 组网中心页面 (合并 instances + nodes + 新增连接方式) | P1 |
| `ui/src/ui/controllers/networking.ts` | 组网控制器 (状态条/发现/模式切换) | P1 |
| `src/gateway/server-methods/networking.ts` | 5 个网络 RPC: status/discover/probe/configure/interfaces | P1 |
| `src/gateway/server-methods/tunnel.ts` | 隧道管理 RPC: start/stop/status | P2 |

### 删除文件

| 文件 | 说明 |
|------|------|
| `ui/src/ui/views/instances.ts` | 功能全部合并进 network-center.ts Tab1 设备列表 |

> **注意**: `ui/src/ui/views/nodes.ts` 不删除文件本身，但从导航中移除。nodes.ts 中的 render 函数可以被 network-center.ts import 复用（exec approvals、bindings、device pairing 等区块），避免大量代码搬移。如果团队倾向完全合并，则可以在 P1 之后逐步内联。

### 修改文件

| 文件 | 改动 | Phase |
|------|------|-------|
| `ui/src/ui/navigation.ts` | Tab union 类型: 删除 `"instances"` 和 `"nodes"`，新增 `"network"`。TAB_GROUPS: Control 组删 "instances"，Agent 组删 "nodes"，Agent 组加 "network" | P1 |
| `ui/src/ui/app-render.ts` | L719 `state.tab === "instances"` 和 L1598 `state.tab === "nodes"` → 合并为 `state.tab === "network"` 渲染 network-center | P1 |
| `ui/src/ui/i18n/locales/zh-CN.ts` | 新增 `network.*` 约 130 个键 (附录 A)；原 `instances.*` / `nodes.*` 键保留但标记 deprecated | P1 |
| `ui/src/ui/i18n/locales/en.ts` | 同上，新增 `network.*` 英文键 | P1 |
| `ui/src/ui/types.ts` | Tab 类型定义同步更新 | P1 |
| `ui/src/ui/presenter.ts` | `formatPresenceAge` / `formatPresenceSummary` 保持不变，network-center 直接 import | P1 |
| `src/infra/bonjour-discovery.ts` | 增加 Windows ciao `createBrowser()` 分支 | P1 |
| `src/infra/tailscale.ts` | 增加 Windows `C:\Program Files\Tailscale\` 搜索路径 | P2 |
| `src/gateway/server-methods/index.ts` | 注册 networking + tunnel handlers | P1 |
| `src/config/zod-schema.core.ts` | 确认 gateway.bind / gateway.auth / stateStore schema 完整 | P1 |

### 不改动的文件

| 文件 | 原因 |
|------|------|
| `ui/src/ui/views/nodes.ts` | 代码保留供 network-center.ts import 复用，导航入口移除 |
| `ui/src/ui/controllers/nodes.ts` | Tab3 安全设置区块复用，无需改动 |
| `ui/src/ui/controllers/devices.ts` | Tab1 设备配对区块复用，无需改动 |
| `src/gateway/config-reload.ts` | restart path 检测已包含 `gateway.*` 和 `stateStore.*` |
| `src/gateway/server-restart-sentinel.ts` | WS close code 1012 机制完整 |
| `ui/src/ui/gateway.ts` | 自动重连逻辑完整 |
| `src/gateway/node-registry.ts` | Node 配对流程完整 |
| `src/infra/state-store/redis-store.ts` | Redis 存储层完整 |
| `src/infra/distributed-broadcast.ts` | 分布式广播完整 |

---

## 附录 A: i18n 键值表 (v2.0)

按三 tab 结构组织，所有文案白话化。

### A.1 页面级 + 状态条

```typescript
// ── 页面标题 ──
"network.title":    "组网中心",
"network.subtitle": "管理你的设备、网络连接和安全设置",

// ── Tab 标签 ──
"network.tab.devices":    "我的设备",
"network.tab.connection": "连接方式",
"network.tab.security":   "安全设置",

// ── 顶部状态条 ──
"network.statusBar.loopback":       "仅本机模式",
"network.statusBar.lan":            "局域网模式 · {ip}",
"network.statusBar.tailnet":        "远程模式 · Tailscale",
"network.statusBar.devicesOnline":  "{count} 台设备在线",
"network.statusBar.noDevices":      "暂无设备",
"network.statusBar.noRemote":       "无远程访问",
"network.statusBar.tailscaleServe": "Tailscale 组网已开启",
"network.statusBar.tailscaleFunnel":"公网访问已开启",
"network.statusBar.frpConnected":   "FRP 穿透已连接",
"network.statusBar.restarting":     "正在重启...",
```

### A.2 Tab 1: 我的设备

```typescript
// ── 在线设备区 ──
"network.devices.onlineTitle":    "在线设备",
"network.devices.addDevice":      "添加设备",
"network.devices.refresh":        "刷新",
"network.devices.refreshing":     "刷新中...",

// ── 设备卡片 ──
"network.devices.gateway":        "网关",
"network.devices.webchat":        "控制面板",
"network.devices.phone":          "手机",
"network.devices.computer":       "电脑",
"network.devices.unknownDevice":  "未知设备",
"network.devices.online":         "在线",
"network.devices.offline":        "离线",
"network.devices.discovered":     "局域网发现",
"network.devices.pending":        "等待审批",
"network.devices.heartbeat":      "心跳 {seconds} 秒前",
"network.devices.heartbeatOk":    "心跳正常",
"network.devices.lastInput":      "最后操作: {time}",
"network.devices.connect":        "连接",
"network.devices.currentBrowser": "当前浏览器",

// ── 能力标签中文化 (camera/location/canvas/system.run → 中文) ──
"network.devices.cap.camera":     "拍照",
"network.devices.cap.location":   "定位",
"network.devices.cap.canvas":     "截屏",
"network.devices.cap.systemRun":  "命令",
"network.devices.cap.chat":       "对话",
"network.devices.cap.exec":       "执行",

// ── chip 行 (保留原 instances 的 mode/role/platform/version) ──
"network.devices.mode":           "模式",
"network.devices.unknownMode":    "未知模式",
"network.devices.unknownHost":    "未知设备",
"network.devices.version":        "版本",
"network.devices.roles":          "角色",
"network.devices.scopes":         "权限范围",
"network.devices.scopesCount":    "{count} 项权限",
"network.devices.reason":         "原因",
"network.devices.na":             "无",
"network.devices.ago":            "前",

// ── 设备配对区 ──
"network.devices.pairingTitle":   "设备配对",
"network.devices.pendingTitle":   "待审批",
"network.devices.pendingDesc":    "新设备请求连接: {name}",
"network.devices.pendingMeta":    "设备ID: {id} · IP: {ip} · {time}",
"network.devices.approve":        "批准连接",
"network.devices.reject":         "拒绝",
"network.devices.pairedTitle":    "已配对设备",
"network.devices.pairedRole":     "角色: {role}",
"network.devices.pairedPerms":    "权限: {perms}",
"network.devices.tokenActive":    "密钥: 活跃",
"network.devices.tokenLastUsed":  "上次使用: {time}",
"network.devices.rotateToken":    "更换密钥",
"network.devices.unpair":         "取消配对",
"network.devices.unpairConfirm":  "确定取消和 {name} 的配对？该设备将无法再连接。",

// ── 添加设备弹窗 ──
"network.devices.addTitle":            "添加设备",
"network.devices.addIpLabel":          "输入对方的 IP 地址和端口:",
"network.devices.addIpPlaceholder":    "192.168.1.50",
"network.devices.addPortLabel":        "端口:",
"network.devices.addPortDefault":      "(默认)",
"network.devices.addPasswordLabel":    "密码:",
"network.devices.addPasswordHint":     "没有可以不填",
"network.devices.addTest":             "测试能不能连上",
"network.devices.addTesting":          "测试中...",
"network.devices.addTestOk":           "连上了! 对方版本 {version}",
"network.devices.addTestFail":         "连不上: {error}",
"network.devices.addCancel":           "取消",
"network.devices.addConfirm":          "添加到我的设备",

// ── 如何添加新设备（折叠帮助区） ──
"network.devices.helpTitle":           "如何添加新设备",
"network.devices.helpPhoneTitle":      "手机/平板:",
"network.devices.helpPhoneStep1":      "1. 下载 OpenClawCN App（应用商店搜索 \"OpenClaw\"）",
"network.devices.helpPhoneStep2":      "2. 打开 App，自动发现同一 Wi-Fi 下的网关",
"network.devices.helpPhoneStep3":      "3. 在上方\"待审批\"中批准连接",
"network.devices.helpPcTitle":         "其他电脑:",
"network.devices.helpPcStep1":         "1. 在目标电脑上安装 OpenClawCN",
"network.devices.helpPcStep2":         "2. 运行后会自动发现局域网网关",
"network.devices.helpPcStep3":         "3. 或者点击上方 [添加设备] 手动输入地址",

// ── Windows 提示 ──
"network.devices.windowsHint":         "自动搜索附近设备的功能正在开发中。",
"network.devices.windowsManual":       "你可以点击 [添加设备] 手动输入对方的 IP 地址连接。",
"network.devices.windowsGoodNews":     "好消息: 其他设备（Mac/手机）可以自动发现你的电脑。",

// ── 空状态引导 ──
"network.devices.emptyTitle":          "还没有其他设备连上来",
"network.devices.emptyDesc":           "想让手机或其他电脑连接到你的 AI 助手?",
"network.devices.emptyStep1":          "最简单的方式:",
"network.devices.emptyStep2":          "1. 把网络模式改成\"同一个网络\"",
"network.devices.emptyStep3":          "2. 在手机上下载 OpenClawCN App",
"network.devices.emptyStep4":          "3. App 会自动发现你的电脑，点一下就连上了",
"network.devices.emptyRemoteHint":     "不在同一个 Wi-Fi? 试试远程穿透",
"network.devices.emptyGoToConnection": "去设置",
```

### A.3 Tab 2: 连接方式

```typescript
// ── 网络模式区 ──
"network.conn.modeTitle":         "网络模式",
"network.conn.modeQuestion":      "谁能连接到你的网关?",
"network.conn.loopbackLabel":     "只有本机",
"network.conn.loopbackDesc":      "最安全，适合单人使用",
"network.conn.lanLabel":          "同一个网络",
"network.conn.lanDesc":           "家里/公司 Wi-Fi 下的设备",
"network.conn.anywhereLabel":     "任何地方",
"network.conn.anywhereDesc":      "需要穿透工具辅助",
"network.conn.save":              "保存",
"network.conn.saving":            "正在保存...",
"network.conn.currentAddress":    "当前地址: {address}",
"network.conn.lanIp":             "你的局域网 IP: {ip}",

// ── 密码设置（切换到局域网时展开） ──
"network.conn.authTitle":         "需要设置一个连接密码，防止陌生设备随意连入:",
"network.conn.authAutoGenerate":  "帮我自动生成一个（推荐）",
"network.conn.authManual":        "我自己设:",
"network.conn.authRestartHint":   "保存后网关会重启，大约 3 秒就好。页面会自动恢复。",
"network.conn.authGenerated":     "密码已生成，请复制保存好:",
"network.conn.authCopy":          "复制",
"network.conn.authCopied":        "已复制!",

// ── 远程穿透区 ──
"network.conn.tunnelTitle":       "远程穿透",
"network.conn.tunnelDesc":        "不在同一个网络? 用以下方式让远程设备也能连上来:",

// ── Tailscale 子区 ──
"network.conn.tsTitle":           "Tailscale（最简单，推荐）",
"network.conn.tsDesc":            "两台设备都装上 Tailscale，自动打通网络，免费。",
"network.conn.tsDetected":        "已检测到 Tailscale",
"network.conn.tsAddress":         "你的 Tailscale 地址: {ip}",
"network.conn.tsDomain":          "你的域名: {domain}",
"network.conn.tsServeOption":     "只让装了 Tailscale 的设备访问",
"network.conn.tsFunnelOption":    "让任何人都能通过链接访问（会自动要求密码）",
"network.conn.tsEnable":          "开启",
"network.conn.tsEnabled":         "已开启",
"network.conn.tsDisable":         "关闭",
"network.conn.tsAccessUrl":       "其他设备访问地址: {url}",
"network.conn.tsNotInstalled":    "没检测到 Tailscale。",
"network.conn.tsInstallHint":     "Tailscale 是一款免费的组网工具，装上就能用，不需要任何网络知识。两台设备各装一个，自动互连。",
"network.conn.tsLearnMore":       "去了解一下",
"network.conn.tsNotLoggedIn":     "Tailscale 已安装但未登录。请先在系统托盘登录。",

// ── FRP 子区 ──
"network.conn.frpTitle":          "内网穿透 FRP（需要自己有服务器）",
"network.conn.frpDesc":           "如果你有一台有公网 IP 的服务器，可以用它做中转。",
"network.conn.frpServerAddr":     "服务器地址:",
"network.conn.frpPort":           "端口:",
"network.conn.frpToken":          "密钥:",
"network.conn.frpTestServer":     "测试服务器",
"network.conn.frpTestOk":         "服务器连得上",
"network.conn.frpTestFail":       "连不上: {error}",
"network.conn.frpConnect":        "连接",
"network.conn.frpConnecting":     "连接中...",
"network.conn.frpConnected":      "已连接! 远程地址: {address}",
"network.conn.frpDisconnect":     "断开",
"network.conn.frpTrustWarning":   "注意: 中转服务器可以看到你的所有数据。请只用你自己的或者你信任的服务器。",

// ── 多网关联动（折叠高级区） ──
"network.conn.redisTitle":        "多台网关联动",
"network.conn.redisCollapsed":    "如果你有多台电脑各跑一个网关，想让它们共享消息...",
"network.conn.redisDesc":         "多台网关之间可以通过 Redis 共享消息和对话状态。",
"network.conn.redisAdvanced":     "这是高级功能，适合多服务器部署或容灾场景。",
"network.conn.redisStatus":       "当前: {status}",
"network.conn.redisDisabled":     "未启用",
"network.conn.redisEnabled":      "已启用",
"network.conn.redisConnected":    "已连接",
"network.conn.redisUrl":          "Redis 地址:",
"network.conn.redisUrlPlaceholder":"redis://192.168.1.200:6379",
"network.conn.redisTest":         "测试能不能连",
"network.conn.redisTestOk":       "连上了，延迟 {latency}ms",
"network.conn.redisTestFail":     "连不上: {error}",
"network.conn.redisEnable":       "启用",
"network.conn.redisDisable":      "禁用",
"network.conn.redisRestartHint":  "启用后网关会重启，大约 3 秒就好。",
```

### A.4 Tab 3: 安全设置

```typescript
// ── 命令权限区 ──
"network.security.title":         "命令权限",
"network.security.desc":          "控制 AI 助手能在设备上执行哪些操作。",
"network.security.importantHint": "这是重要的安全设置，可以防止 AI 做出危险操作。",
"network.security.save":          "保存",
"network.security.saving":        "保存中...",

// ── 管控对象选择 ──
"network.security.targetLabel":   "管控对象:",
"network.security.targetGateway": "网关（本机）",
"network.security.targetNode":    "选择节点",

// ── 按助手设置 tab 行 ──
"network.security.scopeLabel":    "按助手设置:",
"network.security.scopeDefault":  "全局默认",
"network.security.scopeAgent":    "{agentName}",

// ── 权限级别 ──
"network.security.levelTitle":    "权限级别",
"network.security.levelQuestion": "AI 助手在这台设备上能做什么?",
"network.security.levelDeny":     "禁止一切",
"network.security.levelDenyDesc": "AI 不能执行任何命令",
"network.security.levelAllow":    "只允许指定命令（推荐）",
"network.security.levelAllowDesc":"只能跑你批准的命令",
"network.security.levelFull":     "完全放开",
"network.security.levelFullDesc": "AI 可以执行任何命令（有风险）",

// ── 遇到没见过的命令 ──
"network.security.askTitle":      "遇到没见过的命令时",
"network.security.askQuestion":   "AI 想执行一个不在列表里的命令时，怎么办?",
"network.security.askOff":        "不问，直接拒绝",
"network.security.askOnMiss":     "只在不认识的命令时问我",
"network.security.askAlways":     "每次都问我",
"network.security.askRecommend":  "弹窗问我（推荐）",

// ── 弹窗问不了时 ──
"network.security.fallbackTitle": "弹窗问不了时怎么办",
"network.security.fallbackDesc":  "如果界面没打开、弹窗无法显示:",
"network.security.fallbackDeny":  "拒绝执行",
"network.security.fallbackAllow": "允许执行",

// ── 自动信任技能命令 ──
"network.security.autoSkillTitle":"自动信任技能自带的命令",
"network.security.autoSkillDesc": "已安装技能声明的可执行文件，自动加入允许列表。",
"network.security.autoSkillOn":   "开启",
"network.security.autoSkillOff":  "关闭",

// ── 允许的命令列表 ──
"network.security.allowlistTitle":"允许的命令列表",
"network.security.allowlistHint": "仅在\"只允许指定命令\"模式下显示",
"network.security.allowlistAdd":  "添加命令",
"network.security.allowlistPattern":"命令模式:",
"network.security.allowlistLastUsed":"上次使用: {time}",
"network.security.allowlistNeverUsed":"上次使用: 从未",
"network.security.allowlistLastCmd":"最近: {cmd}",
"network.security.allowlistDelete":"删除",

// ── 运行位置区 ──
"network.security.bindingTitle":  "运行位置",
"network.security.bindingDesc":   "指定 AI 助手在哪台设备上执行命令。",
"network.security.bindingHint":   "默认在网关本机执行。如果你有远程服务器，可以指定到那台机器上。",
"network.security.bindingDefault":"默认运行位置",
"network.security.bindingDefaultDesc":"没有特别指定的助手，都在这里跑:",
"network.security.bindingGateway":"网关本机",
"network.security.bindingAgent":  "{agentName} -- {agentDesc}",
"network.security.bindingFollow": "跟随默认（{target}）",
"network.security.bindingCustom": "{nodeName} ({address})",
```

### A.5 英文版 (en)

```typescript
// ── Page level + status bar ──
"network.title":    "Network Center",
"network.subtitle": "Manage your devices, network connections, and security settings",
"network.tab.devices":    "My Devices",
"network.tab.connection": "Connection",
"network.tab.security":   "Security",
"network.statusBar.loopback":       "Local only",
"network.statusBar.lan":            "LAN mode · {ip}",
"network.statusBar.tailnet":        "Remote mode · Tailscale",
"network.statusBar.devicesOnline":  "{count} device(s) online",
"network.statusBar.noDevices":      "No devices",
"network.statusBar.noRemote":       "No remote access",
"network.statusBar.tailscaleServe": "Tailscale networking enabled",
"network.statusBar.tailscaleFunnel":"Public access enabled",
"network.statusBar.frpConnected":   "FRP tunnel connected",
"network.statusBar.restarting":     "Restarting...",

// ── Tab 1: My Devices ──
"network.devices.onlineTitle":    "Online Devices",
"network.devices.addDevice":      "Add Device",
"network.devices.refresh":        "Refresh",
"network.devices.refreshing":     "Refreshing...",
"network.devices.gateway":        "Gateway",
"network.devices.webchat":        "Web UI",
"network.devices.phone":          "Phone",
"network.devices.computer":       "Computer",
"network.devices.unknownDevice":  "Unknown Device",
"network.devices.online":         "Online",
"network.devices.offline":        "Offline",
"network.devices.discovered":     "LAN Discovered",
"network.devices.pending":        "Pending Approval",
"network.devices.heartbeat":      "Heartbeat {seconds}s ago",
"network.devices.heartbeatOk":    "Heartbeat OK",
"network.devices.connect":        "Connect",
"network.devices.approve":        "Approve",
"network.devices.reject":         "Reject",
"network.devices.rotateToken":    "Rotate Key",
"network.devices.unpair":         "Unpair",
"network.devices.unpairConfirm":  "Unpair {name}? The device will no longer be able to connect.",
"network.devices.emptyTitle":     "No other devices connected",
"network.devices.emptyDesc":      "Want to connect your phone or another computer?",
"network.devices.emptyGoToConnection": "Go to Connection",
"network.devices.windowsHint":    "Automatic device discovery is coming soon for Windows.",
"network.devices.windowsManual":  "You can click [Add Device] to manually enter the other device's IP.",
"network.devices.windowsGoodNews":"Good news: other devices (Mac/phone) can discover your PC automatically.",
// ... (remaining en keys follow same structure, omitted for brevity)

// ── Tab 2: Connection ──
"network.conn.modeTitle":         "Network Mode",
"network.conn.modeQuestion":      "Who can connect to your gateway?",
"network.conn.loopbackLabel":     "This machine only",
"network.conn.lanLabel":          "Same network",
"network.conn.anywhereLabel":     "Anywhere",
"network.conn.save":              "Save",
"network.conn.authTitle":         "Set a connection password to prevent unauthorized access:",
"network.conn.authAutoGenerate":  "Auto-generate one (Recommended)",
"network.conn.authManual":        "Set my own:",
"network.conn.authRestartHint":   "After saving, the gateway will restart. It takes about 3 seconds.",
"network.conn.tunnelTitle":       "Remote Access",
"network.conn.tsTitle":           "Tailscale (Easiest, Recommended)",
"network.conn.frpTitle":          "FRP Tunnel (Requires your own server)",
"network.conn.redisTitle":        "Multi-Gateway Sync",
// ... (remaining en keys follow same pattern)

// ── Tab 3: Security ──
"network.security.title":         "Command Permissions",
"network.security.levelDeny":     "Deny all",
"network.security.levelAllow":    "Allowlist only (Recommended)",
"network.security.levelFull":     "Full access",
"network.security.askTitle":      "When an unknown command is requested",
"network.security.fallbackTitle": "When popup is unavailable",
"network.security.allowlistTitle":"Allowed Commands",
"network.security.bindingTitle":  "Execution Target",
// ... (remaining en keys follow same pattern)
```

---

## 附录 B: 配置文件 Schema 参考

组网中心涉及的配置路径:

```yaml
# gateway 核心
gateway:
  bind: "loopback"          # "loopback" | "lan" | "tailnet"
  port: 18789
  auth:
    token: "base64url-string"
  tailscale:
    mode: "off"             # "off" | "serve" | "funnel"
  nodes:
    allowCommands: []
    denyCommands: []

# mDNS 发现
discovery:
  mdns:
    mode: "minimal"         # "minimal" | "full" | "off"
  wideArea:
    enabled: false
    domain: "openclawcn.internal"

# 状态存储
stateStore:
  backend: "memory"         # "memory" | "redis"
  redis:
    url: "redis://host:6379"
    keyPrefix: "openclawcn:"
    maxReconnectAttempts: 10
    connectTimeoutMs: 5000
```

---

## 附录 C: 与现有页面的关系 (v2.0 合并方案)

| 现有页面 | 变化 | 说明 |
|---------|------|------|
| 实例 (instances) | **删除** | 功能全部合并到组网中心 Tab1 "我的设备"列表 |
| 节点 (nodes) | **从导航移除** | 设备配对 → Tab1；执行审批/执行绑定 → Tab3。nodes.ts 代码保留供 import |
| 设置 (settings) | 不变 | 高级配置文件编辑仍在设置页 |
| 组网中心 (新) | **新增** | 替代原"实例"和"节点"两个导航项，位于 Agent 组 |

### 导航变化对照

```
v1.0 (原):
  Control: overview, model-config, usage, channels, [instances], sessions, cron
  Agent:   agents, skills, extensions, [nodes]

v2.0 (合并):
  Control: overview, model-config, usage, channels, sessions, cron
  Agent:   agents, skills, extensions, [network]
```

### 功能零丢失确认

| 原页面功能 | 新位置 | 完整性 |
|-----------|--------|--------|
| 实例说明卡片 | 删除 (状态条自解释) | OK -- 信息通过状态条传达 |
| 已连接实例列表 + 详情 chip | Tab1 在线设备列表 | 100% 保留 |
| 实例时间 (心跳/最后输入/原因) | Tab1 设备卡片右侧 | 100% 保留 |
| 实例空状态提示 | Tab1 空状态引导 | 文案白话化 |
| 节点帮助说明 | Tab1 "如何添加新设备"折叠区 | 文案从 CLI 改为 App 优先 |
| 节点列表 + 节点详情 | Tab1 在线设备列表 | 100% 保留 |
| 设备配对 -- 待审批/已配对/Token | Tab1 设备配对区 | 100% 保留 |
| 执行审批 (安全策略) | Tab3 命令权限区 | 100% 保留，文案优化 |
| 执行绑定 (默认+按助手) | Tab3 运行位置区 | 100% 保留，文案优化 |

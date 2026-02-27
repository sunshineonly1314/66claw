---
summary: "两个 Gateway 组网完整教程：局域网自动发现、跨网络 Tailscale、Redis 状态同步"
read_when:
  - 想让两个 Gateway 互相发现
  - 多个 Gateway 组网
  - 跨网络连接两个 Gateway
  - 配置 Redis 让多个 Gateway 同步
title: "多 Gateway 组网教程"
---

# 多 Gateway 组网教程

本文档面向零基础用户，手把手教你让两个 OpenClawCN Gateway 互相发现、组成网络。

## 你需要哪种方案？

| 场景 | 方案 | 难度 | 需要额外软件？ |
|------|------|------|----------------|
| 两个 Gateway 在**同一个局域网** | 方案一：mDNS 自动发现 | 简单 | 不需要 |
| 两个 Gateway 在**不同网络**（如家里和公司） | 方案二：Tailscale 组网 | 中等 | 需要装 Tailscale（免费） |
| 两个 Gateway 需要**共享会话/事件同步** | 方案三：Redis 状态同步 | 较高 | 需要装 Redis |

> 大多数人只需要**方案一**或**方案二**。方案三只在你需要两个 Gateway 的客户端能收到对方事件时才需要。

---

## 方案一：局域网自动发现（mDNS/Bonjour）

> 适用场景：两个 Gateway 在同一个 Wi-Fi / 有线网络下。

### 原理

每个 Gateway 启动时会通过 mDNS（Bonjour）自动广播自己的存在，服务类型为 `_openclawcn-gw._tcp`。同一局域网内的其他 Gateway 和客户端（iOS/Android/macOS）可以自动发现它。

**不需要任何手动配对，不需要 Redis，不需要共享任何东西。**

### 第 1 步：确认两个 Gateway 的配置

每个 Gateway 都有自己的配置文件，默认在 `~/.openclawcn/openclawcn.json`。

**Gateway A** 的配置：

```json5
// ~/.openclawcn/openclawcn.json （机器 A）
{
  gateway: {
    port: 18789,
    bind: "lan"       // 关键！必须是 "lan"，不能是默认的 "loopback"
  }
}
```

**Gateway B** 的配置：

```json5
// ~/.openclawcn/openclawcn.json （机器 B）
{
  gateway: {
    port: 18789,      // 不同机器上端口可以一样
    bind: "lan"       // 同样要设成 "lan"
  }
}
```

> **为什么要改 `bind`？** 默认 `bind` 是 `"loopback"`（只监听 127.0.0.1），别的机器根本连不上。改成 `"lan"` 后 Gateway 会监听局域网 IP，其他设备才能访问。

### 第 2 步：确认 mDNS 没有被关闭

mDNS 默认是**开启**的，一般不需要改。但如果之前手动关过，检查一下：

```json5
{
  // 如果有这个配置，确保不是 "off"
  discovery: {
    mdns: { mode: "minimal" }   // "minimal" 或 "full" 都行，不要 "off"
  }
}
```

也确认环境变量 `OPENCLAWCN_DISABLE_BONJOUR` **没有**被设为 `1`。

### 第 3 步：启动两个 Gateway

```bash
# 机器 A
openclawcn gateway

# 机器 B
openclawcn gateway
```

启动后你会在日志中看到类似这样的信息：

```
bonjour: advertised gateway fqdn=机器名._openclawcn-gw._tcp.local. host=机器名.local port=18789 state=announced
```

看到 `state=announced` 就说明广播成功了。

### 第 4 步：验证互相发现

在任意一台机器上运行：

```bash
openclawcn gateway discover
```

输出类似：

```
Gateway Discovery
Found 2 gateway(s) · domains: local.
- 机器A (OpenClawCN) local.
  lan: machineA.local
  ws: ws://machineA.local:18789
- 机器B (OpenClawCN) local.
  lan: machineB.local
  ws: ws://machineB.local:18789
```

看到两个 Gateway 都列出来了，就说明组网成功！

### 常见问题

| 问题 | 解决办法 |
|------|---------|
| `discover` 只能看到自己 | 检查 `bind` 是否设成了 `"lan"`；检查两台机器是否在同一网段 |
| `discover` 什么都看不到 | 检查 `OPENCLAWCN_DISABLE_BONJOUR` 是否被设为 `1`；检查路由器是否禁用了 mDNS 组播 |
| macOS 能发现但 Windows 不行 | Windows 需要安装 Bonjour 服务（安装 iTunes 会自带，或单独安装 Apple Bonjour Print Services） |
| Linux 能发现但很慢 | 确保安装了 `avahi-daemon`（Ubuntu: `sudo apt install avahi-daemon`） |

### 同一台机器上跑两个 Gateway

如果两个 Gateway 在**同一台机器**上，需要额外隔离。参考 [Multiple Gateways](/gateway/multiple-gateways)。

要点：
- 用 `--profile` 隔离配置和状态
- 端口间隔至少 20（如 18789 和 19001）

```bash
# Gateway A
openclawcn --profile main gateway --port 18789

# Gateway B
openclawcn --profile secondary gateway --port 19001
```

设置 `OPENCLAWCN_ALLOW_MULTI_GATEWAY=1` 环境变量以允许同时运行多个实例。

---

## 方案二：跨网络组网（Tailscale）

> 适用场景：两个 Gateway 不在同一个局域网（如一个在家、一个在公司），或者中间隔了 NAT。

### 原理

mDNS 广播**不能跨网络**。Tailscale 是一个免费的虚拟组网工具，可以让不同网络的设备像在同一局域网一样互相访问。结合 OpenClawCN 的「广域 DNS-SD」功能，可以实现跨网络的 Gateway 自动发现。

### 第 1 步：两台机器都安装 Tailscale

去 [tailscale.com](https://tailscale.com/) 注册账号，在两台机器上安装并登录同一个账号。

**Windows：**
1. 下载安装包：https://tailscale.com/download/windows
2. 安装后登录你的账号

**macOS：**
```bash
brew install tailscale
```

**Linux：**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

安装完成后，每台机器会获得一个 100.x.x.x 的内网 IP。运行 `tailscale ip` 可以查看。

### 第 2 步：配置 Gateway 绑定到 Tailscale 网络

**Gateway A**（`~/.openclawcn/openclawcn.json`）：

```json5
{
  gateway: {
    port: 18789,
    bind: "tailnet"    // 绑到 Tailscale 网络接口
  }
}
```

**Gateway B**（`~/.openclawcn/openclawcn.json`）：

```json5
{
  gateway: {
    port: 18789,
    bind: "tailnet"
  }
}
```

### 第 3 步：配置广域 DNS-SD 发现（可选但推荐）

如果你希望两个 Gateway 能像局域网一样**自动发现**对方（而不是手动输入 IP），需要配置广域 DNS-SD。

#### 3a. 选一台机器作为 DNS 服务器

在其中一台 Gateway 机器上（比如机器 A）运行：

```bash
openclawcn dns setup --domain openclawcn.internal --apply
```

这会自动安装 CoreDNS 并配置好。（目前仅支持 macOS，Linux 需手动配置 CoreDNS。）

#### 3b. 两个 Gateway 都启用广域发现

**两台机器**的配置都加上：

```json5
{
  gateway: {
    port: 18789,
    bind: "tailnet"
  },
  discovery: {
    wideArea: {
      enabled: true,
      domain: "openclawcn.internal"
    }
  }
}
```

#### 3c. 配置 Tailscale Split DNS

在 [Tailscale 管理后台](https://login.tailscale.com/admin/dns)：

1. 点 **Add nameserver**
2. 填入机器 A 的 Tailscale IP（运行 `tailscale ip -4` 查看，类似 `100.64.x.x`）
3. 勾选 **Restrict to domain**，填入 `openclawcn.internal`
4. 保存

#### 3d. 验证跨网络发现

```bash
openclawcn gateway discover
```

应该能看到两个 Gateway，即使它们在不同的物理网络。

### 不想配 DNS-SD？直接用 IP 连接

如果觉得 DNS-SD 太麻烦，可以直接用 Tailscale IP 手动连接：

```bash
# 在机器 B 上直接访问机器 A 的 Gateway
# 机器 A 的 Tailscale IP 假设是 100.64.1.2
openclawcn gateway probe --url ws://100.64.1.2:18789
```

---

## 方案三：Redis 状态同步（事件广播）

> 适用场景：你需要两个 Gateway 的客户端能**实时收到对方的事件**（如 Agent 消息、节点配对通知等）。

**注意**：方案一和方案二只是让 Gateway 互相「看到」对方，但它们的客户端连接是**独立的**——连在 Gateway A 上的客户端不会收到 Gateway B 上的事件。如果你需要这种同步，才需要配 Redis。

### 第 1 步：安装 Redis

**Windows（推荐用 Docker）：**
```bash
docker run -d --name redis -p 6379:6379 redis:7
```

**macOS：**
```bash
brew install redis
brew services start redis
```

**Linux（Ubuntu/Debian）：**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

安装完后验证 Redis 在运行：
```bash
redis-cli ping
# 应该返回 PONG
```

### 第 2 步：安装 ioredis 依赖

在 OpenClawCN 项目目录中：

```bash
pnpm add ioredis
```

### 第 3 步：两个 Gateway 都配置 Redis

**Gateway A**（`~/.openclawcn/openclawcn.json`）：

```json5
{
  gateway: {
    port: 18789,
    bind: "lan"
  },
  stateStore: {
    backend: "redis",
    redis: {
      url: "redis://Redis服务器的IP:6379"
    }
  }
}
```

**Gateway B**（`~/.openclawcn/openclawcn.json`）：

```json5
{
  gateway: {
    port: 19001,       // 如果在同一台机器上，端口必须不同
    bind: "lan"
  },
  stateStore: {
    backend: "redis",
    redis: {
      url: "redis://Redis服务器的IP:6379"   // 必须指向同一个 Redis
    }
  }
}
```

> **关键**：两个 Gateway 的 `redis.url` 必须指向**同一个** Redis 实例。

如果 Redis 有密码：
```json5
{
  stateStore: {
    backend: "redis",
    redis: {
      url: "redis://:你的密码@Redis服务器的IP:6379"
    }
  }
}
```

### 第 4 步：启动并验证

启动两个 Gateway 后，看日志确认 Redis 连接成功：

```
[state-store] State store initialized (backend=redis)
[state-store/redis] Redis state store connected (prefix=openclawcn:)
[distributed-broadcast] distributed broadcast bridge active (instance=a1b2c3d4)
```

如果看到的是下面这个，说明 Redis 没连上，还是单机模式：

```
[state-store] State store initialized (backend=memory)
```

### Redis 可选参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `url` | **必填** | Redis 连接地址 |
| `keyPrefix` | `"openclawcn:"` | Redis 键前缀，两个 Gateway 必须一样 |
| `maxReconnectAttempts` | `10` | 最大重连次数 |
| `connectTimeoutMs` | `5000` | 连接超时（毫秒） |

### Redis 同步了什么？

| 能力 | 说明 |
|------|------|
| WebSocket 事件广播 | Gateway A 的事件会推送给连在 Gateway B 上的客户端 |
| 分布式锁 | 防止两个 Gateway 同时操作同一个会话 |
| 共享 KV 存储 | 会话数据跨实例可见 |
| 可靠队列 | 任务在实例间传递 |

---

## 方案组合

这三个方案**可以叠加使用**：

| 组合 | 效果 |
|------|------|
| 方案一（mDNS） | 局域网内自动发现，各自独立运行 |
| 方案一 + 方案三（mDNS + Redis） | 局域网内自动发现 + 事件同步 |
| 方案二（Tailscale） | 跨网络自动发现，各自独立运行 |
| 方案二 + 方案三（Tailscale + Redis） | 跨网络自动发现 + 事件同步 |

---

## 完整配置示例

### 场景 A：两台局域网机器，只需互相发现

```json5
// 两台机器的配置一样（端口可以一样因为是不同机器）
{
  gateway: {
    port: 18789,
    bind: "lan"
  }
  // 不需要其他配置，mDNS 默认开启
}
```

### 场景 B：两台跨网络机器，通过 Tailscale 发现

```json5
{
  gateway: {
    port: 18789,
    bind: "tailnet"
  },
  discovery: {
    wideArea: {
      enabled: true,
      domain: "openclawcn.internal"
    }
  }
}
```

### 场景 C：同一台机器两个实例 + Redis 同步

```json5
// Gateway A: ~/.openclawcn/gateway-a.json
{
  gateway: {
    port: 18789,
    bind: "lan"
  },
  stateStore: {
    backend: "redis",
    redis: { url: "redis://127.0.0.1:6379" }
  }
}

// Gateway B: ~/.openclawcn/gateway-b.json
{
  gateway: {
    port: 19001,
    bind: "lan"
  },
  stateStore: {
    backend: "redis",
    redis: { url: "redis://127.0.0.1:6379" }
  }
}
```

启动：
```bash
OPENCLAWCN_ALLOW_MULTI_GATEWAY=1 \
OPENCLAWCN_CONFIG_PATH=~/.openclawcn/gateway-a.json \
OPENCLAWCN_STATE_DIR=~/.openclawcn-a \
openclawcn gateway

OPENCLAWCN_ALLOW_MULTI_GATEWAY=1 \
OPENCLAWCN_CONFIG_PATH=~/.openclawcn/gateway-b.json \
OPENCLAWCN_STATE_DIR=~/.openclawcn-b \
openclawcn gateway
```

---

## 排查命令速查

```bash
# 发现局域网内的 Gateway
openclawcn gateway discover

# 发现局域网 + 广域（JSON 格式，方便排查）
openclawcn gateway discover --json

# 探测指定 Gateway 是否可达
openclawcn gateway probe --url ws://192.168.1.100:18789

# 查看当前 Gateway 状态
openclawcn gateway status

# macOS 原生 mDNS 调试
dns-sd -B _openclawcn-gw._tcp local.

# Linux avahi 调试
avahi-browse -rt _openclawcn-gw._tcp

# 检查 Tailscale 连接
tailscale status
tailscale ping <对方机器名>
```

---

## 相关文档

- [Bonjour/mDNS 详细文档](/gateway/bonjour) — mDNS 广播调试和故障排除
- [Discovery and Transports](/gateway/discovery) — 发现机制和传输协议设计
- [Tailscale 集成](/gateway/tailscale) — Tailscale Serve/Funnel 配置
- [Multiple Gateways (same host)](/gateway/multiple-gateways) — 同一台机器多实例隔离
- [Remote Access](/gateway/remote) — SSH 远程访问

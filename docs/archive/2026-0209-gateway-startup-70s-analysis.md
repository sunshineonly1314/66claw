# 问题归档：Gateway 启动 70+ 秒根因分析

> 日期：2026-02-09
> 状态：已分析，待优化
> 关联：ClawdbotService.cs、license-check.ts、entry.ts、server.impl.ts

---

## 一、问题概述

### 1.1 现象

Gateway 从启动到 Node.js 进程真正拉起并就绪，耗时 70+ 秒。用户体验极差。

### 1.2 根因总结

启动延迟由 **两层串行操作叠加** 造成：

1. **Pre-Node 层**（Windows 脚本 / 原生服务）：端口清理、doctor fix、硬编码 sleep — 共 10-25s
2. **Node.js 层**：进程自我重启、License 网络验证超时、串行子系统初始化 — 共 20-50s

**最大单一瓶颈**：License 网络验证（CN 用户），最多阻塞 30 秒。

---

## 二、启动架构全景

```
┌─────────────────────────────────────────────────────────────┐
│ ClawdbotService.cs / start-gateway.bat                       │
│  ├─ KillProcessOnPort() + Thread.Sleep(1000)        ~3s     │
│  ├─ RunDoctorFix() → spawn node doctor --fix        0-15s   │
│  ├─ Process.Start(node gateway)                     instant  │
│  └─ IsGatewayHealthy() 轮询 (每轮 netstat)         30-90s  │
├─────────────────────────────────────────────────────────────┤
│ entry.ts                                                     │
│  ├─ ensureWarningsSuppressed() → 可能重启自身        3-5s    │
│  └─ import cli → Commander → runGatewayCommand()    2-3s    │
├─────────────────────────────────────────────────────────────┤
│ gateway-cli/run.ts                                           │
│  ├─ loadConfig() + Zod validation                   <1s     │
│  ├─ acquireGatewayLock()                            0-5s    │
│  └─ startGatewayServer()                            ↓       │
├─────────────────────────────────────────────────────────────┤
│ server.impl.ts                                               │
│  ├─ Phase 1: Config 加载 + 迁移                     1-3s    │
│  ├─ Phase 2: Promise.all([                                   │
│  │    checkLicenseOnGatewayStart()  ← 最大瓶颈       5-30s  │
│  │    loadGatewayTlsRuntime()                        <1s    │
│  │    resolveGatewayRuntimeConfig()                  <1s    │
│  │  ])                                                       │
│  ├─ Phase 3: 串行子系统初始化                        5-15s   │
│  │    plugins → HTTP server → mDNS → WebSocket → Tailscale  │
│  ├─ Phase 4: Sidecars 启动                           3-10s   │
│  │    browser → gmail → hooks → channels → MCP               │
│  └─ Phase 5: markGatewayReady() ✓                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、瓶颈详解

### 3.1 License 网络验证（最大瓶颈，5-30s）

**文件：** `src/gateway/license-check.ts:153`、`src/license/verify.ts:114,623-658`

```
LICENSE_VERIFY_TIMEOUT_MS = 30_000

checkLicenseOnGatewayStart():
  → checkIntegrityOnStartup()          // 文件哈希校验
  → verifyLicenseOnStartup():
      verifyLicenseWithRetry(key, {maxRetries: 3}):
        Attempt 1: HTTP POST → AbortSignal.timeout(30000)
        Attempt 2: wait 1s → retry
        Attempt 3: wait 2s → retry
      → 外层 Promise.race([verify, timeout(30s)])
```

- CN 用户主 license 服务器不可达时，白等 30 秒才 fallback 到本地缓存
- 非 CN 用户跳过此检查（`isLicenseCheckEnabled` 返回 false）
- **这是 CN 用户独有的瓶颈**

### 3.2 Pre-Node 硬编码等待（8-20s）

**文件：** `scripts/windows/native/ClawdbotService.cs:627,728-749`

| 操作 | 耗时 | 说明 |
|------|------|------|
| `Thread.Sleep(1000)` | 1s | kill 端口后的硬编码等待 |
| `RunDoctorFix()` | 0-15s | 额外 spawn node.exe 跑 doctor --fix |
| 健康轮询 `netstat -ano` × N | 30-90s | 每轮跑一次 netstat，Windows 上 ~0.5-1s/次 |

### 3.3 Node.js 进程自我重启（3-5s）

**文件：** `src/entry.ts:52-87`

`ensureWarningsSuppressed()` 检查 `NODE_OPTIONS` 是否包含警告抑制标志。如果没有，**整个进程重启**——即 node.exe 冷启动两次。

```javascript
if (!process.env.CLAWDBOT_NODE_OPTIONS_READY) {
  // 重新 spawn 自己，附加 NODE_OPTIONS
  // 第一次启动的 node.exe 白白浪费
}
```

### 3.4 Gateway 锁等待（0-5s）

**文件：** `src/infra/gateway-lock.ts:201`

```
DEFAULT_TIMEOUT_MS = 5000
DEFAULT_STALE_MS = 15000
```

旧 gateway 崩溃未清理锁文件时，新进程轮询 100ms/次，最多等 5 秒。

### 3.5 串行子系统初始化（5-15s）

**文件：** `src/gateway/server-startup.ts`、`src/gateway/server.impl.ts:298-582`

Phase 3-4 的 ~10 个子系统全部串行 init：插件加载、mDNS 发现、频道启动、MCP 初始化等。单个快，但累计 5-15 秒。

---

## 四、时间线（最坏情况，CN + Windows）

```
[0s]    ClawdbotService 杀端口 + sleep         → 3s
[3s]    RunDoctorFix spawn node doctor          → +15s
[18s]   启动 node.exe gateway                   → +0s
[18s]   entry.ts 自我重启补 NODE_OPTIONS        → +5s
[23s]   模块加载 + 锁获取                       → +5s
[28s]   License 网络验证超时等待                 → +30s  ← 最大瓶颈
[58s]   子系统串行初始化                         → +15s
[73s]   Gateway ready ✓
```

---

## 五、已有的容忍设计

代码中已有多处体现开发者知道启动慢：

| 常量 | 值 | 位置 |
|------|-----|------|
| `STARTUP_GRACE_PERIOD_MS` | 120,000 (2 min) | `app-gateway.startup-grace.test.ts` |
| Watchdog 启动超时 | 120s (4×30s) | `ClawdbotService.cs:393-394` |
| 启动等待循环 | 90 次 × 1s | `ClawdbotService.cs:728` |

注释原文：`// Gateway startup can take 30-90s on slow machines (license check, plugin init, etc.)`

---

## 六、优化建议

### P0 — License 验证非阻塞化

**当前：** License 验证完成前 gateway 不可用（阻塞 Phase 2）
**建议：** 先启动 HTTP server 响应健康检查，License 验证移至后台，超时直接用缓存
**预期收益：** -30s（CN 用户）

### P1 — 去掉 RunDoctorFix 或改异步

**当前：** 每次启动都额外 spawn node.exe 跑 doctor --fix
**建议：** 仅在首次安装或版本升级后执行，日常启动跳过
**预期收益：** -5~15s

### P2 — 消除进程自我重启

**当前：** `ensureWarningsSuppressed()` 可能导致 node.exe 启动两次
**建议：** 在 .bat / .cs 启动脚本中直接设好 `NODE_OPTIONS`，避免重启
**预期收益：** -3~5s

### P3 — 去掉硬编码 sleep

**当前：** `Thread.Sleep(1000)` 和 `timeout /t 5` 散布各处
**建议：** 用实际健康检查替代固定等待
**预期收益：** -2~6s

### P4 — 子系统并行初始化

**当前：** Phase 3-4 约 10 个子系统串行启动
**建议：** 无依赖关系的子系统用 `Promise.all()` 并行启动
**预期收益：** -5~10s

### P5 — 健康轮询优化

**当前：** `IsGatewayHealthy()` 每轮跑 `netstat -ano`（Windows 上很慢）
**建议：** 改为 HTTP health endpoint 轮询，或使用 named pipe / TCP connect 检测
**预期收益：** 轮询间隔从 ~1s 降至 ~100ms

---

## 七、预期优化后启动时间

| 场景 | 当前 | 优化后（预估） |
|------|------|----------------|
| CN Windows（网络差） | 70-97s | **15-25s** |
| CN Windows（网络好） | 40-60s | **10-15s** |
| 非 CN | 20-40s | **8-12s** |

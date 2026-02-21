# Gateway 桌面端启动速度优化需求

> 提给：Gateway 后端负责人
> 日期：2026-02-20
> 背景：桌面端（Tauri）启动时需要等 gateway 完全 ready 后才能跳转到 setup wizard 或 control-ui。当前从进程启动到 `[gateway] ready` 约 5-8 秒，用户看到的是一个转圈等待的 loading 页面。目标是将这个时间缩短到 2 秒以内。

---

## 一、当前启动时序分析

从 sidecar 日志可以看到典型启动时间线：

```
T+0.0s   Node.js 进程启动（冷启动 + 模块加载）
T+2.0s   [state-store] State store initialized (backend=memory)
T+3.5s   [gateway] listening on ws://127.0.0.1:19002
T+3.5s   [gateway] listening on ws://[::1]:19002
T+3.6s   [browser/service] Browser control service ready
T+4.5s   [gateway] ready
```

从 Rust `spawn()` 到 `[gateway] ready` 约 **4.5-8 秒**。

### 阻塞路径分析

以下是 `src/gateway/server.impl.ts` 中的关键路径：

| 阶段 | 耗时 | 阻塞? | 文件:行号 |
|------|------|-------|----------|
| Config validation & migration | ~200ms | YES | server.impl.ts:195-243 |
| State store init | ~100ms | YES | server.impl.ts:256-258 |
| Plugin loading | ~300ms | YES | server.impl.ts:260-286 |
| HTTP server creation & bind | ~100ms | YES | server.impl.ts:296-410 |
| **Discovery (Bonjour)** | ~200-500ms | NO | server.impl.ts:458-475 |
| **Skills registry** | ~100ms | NO | server.impl.ts:477-500 |
| **Maintenance timers** | ~50ms | NO | server.impl.ts:502-523 |
| **Heartbeat** | ~50ms | NO | server.impl.ts:525-551 |
| **Delivery recovery** | ~10-70s | NO | server.impl.ts:557-602 |
| **Tailscale** | ~1-5s | NO | server.impl.ts:687-695 |
| **Browser control** | ~500ms-2s | NO | server-startup.ts |
| **Plugin services** | ~500ms-3s | NO | server-startup.ts |
| **MCP init + sync** | ~2-10s | NO | server-startup.ts |
| **Channels startup** | ~5-20s | NO | server-startup.ts |

**关键问题**：`markGatewayReady()` 在 `Promise.all([tailscale, sidecars, discovery])` 之后才执行（server.impl.ts:714），这意味着 Browser control、MCP sync、Channels 启动都完成了才算 ready。但桌面端只需要 `/api/health` 能返回 provider 信息即可。

---

## 二、优化方案

### 方案 A：提前 markGatewayReady()（推荐，改动小）

在 HTTP server 监听成功 + WebSocket handler 注册完成后就调用 `markGatewayReady()`，把 Bonjour、channels、MCP sync 等放到 ready 之后异步执行。

**改动点**：`src/gateway/server.impl.ts`

```typescript
// 当前（约 line 714-808）：
const [tailscaleCleanup, sidecarsResult, discoveryBonjourStop] = await Promise.all([
  tailscalePromise,
  sidecarsPromise,     // ← 这里等 channels/MCP/browser 全部完成
  discoveryPromise,
]);
// ... plugin hooks, config reloader ...
markGatewayReady();  // ← 太晚了

// 优化后：
markGatewayReady();  // ← 在 HTTP server listen 成功后就标记
// 然后异步等待其他子系统
Promise.all([tailscalePromise, sidecarsPromise, discoveryPromise])
  .then(/* 清理函数注册 */)
  .catch(/* 错误处理 */);
```

**预期效果**：从 ~5s 缩短到 ~2s（HTTP listen 后立即 ready）

**风险**：`/api/health` 会在 channels/MCP 还没初始化时就返回 ready=true。对桌面端 setup 判断没影响（只需要 provider 配置信息），但其他依赖 ready 状态的逻辑需要评估。

### 方案 B：新增 `/api/health` 的 providers 字段提前可用

当前 `/api/health` 在 ready=false 时不返回 providers 信息。可以改为：config 加载完成后就能返回 providers 状态（API Key 是否配置是静态信息，不需要等 provider 真正就绪）。

**改动点**：`src/gateway/server-http.ts:488-507`

在 health endpoint 的响应中，即使 ready=false，也返回基于配置的 provider 信息：

```typescript
if (healthPath === "/api/health") {
  const ready = isGatewayReady();
  // 即使未 ready，也返回 provider 配置状态
  const providers = getProviderConfigStatus(); // 从 config 读取，不依赖运行时状态
  res.end(JSON.stringify({ ok: true, ready, providers, ... }));
}
```

### 方案 C：桌面模式跳过非必要子系统

当 `OPENCLAWCN_DESKTOP_MODE=1` 时，跳过以下初始化：

- Bonjour discovery（桌面端不需要被发现）
- Tailscale exposure（桌面端不需要外部访问）
- Channels startup（钉钉/飞书/微信等，桌面端首次启动不需要）
- Delivery recovery（桌面端不需要恢复投递）

这些可以延迟到 gateway ready 之后再初始化，或者用户在 control-ui 里配置了才启动。

**改动点**：`src/gateway/server.impl.ts` 和 `src/gateway/server-startup.ts`

---

## 三、桌面端侧的配合改动

### 已完成的优化

1. **Loading 页面轮询间隔**：前 10 秒每 300ms 轮询一次，之后每 1 秒（`loading.html`）
2. **直接调 `check_needs_setup`**：跳过 `get_service_status` 中间步骤
3. **`check_needs_setup` 用 reqwest**：Rust 端发 HTTP 请求，无 CORS 问题

### 待优化（需要后端配合）

如果采用方案 B，桌面端的 `check_needs_setup`（`commands.rs`）可以不等 `ready=true`，只要 health 接口返回 providers 信息就做决策。当前实现已经是这样——它只检查 providers 字段，不检查 ready 字段。

---

## 四、验收标准

- 桌面端从双击 exe 到显示 setup wizard 或 control-ui，**转圈时间不超过 3 秒**
- 不影响非桌面模式的 gateway 启动行为
- channels、MCP、discovery 等子系统仍能正常初始化（只是延迟启动）

---

## 五、相关文件

| 文件 | 说明 |
|------|------|
| `src/gateway/server.impl.ts` | Gateway 主启动逻辑，`markGatewayReady()` 位置 |
| `src/gateway/server-startup.ts` | Sidecars 启动（channels、MCP、browser control） |
| `src/gateway/server-ready.ts` | Ready 状态管理 |
| `src/gateway/server-http.ts:488-507` | `/api/health` 端点 |
| `src/gateway/server-discovery-runtime.ts` | Bonjour discovery |
| `apps/desktop/src-tauri/src/loading.html` | 桌面端 loading 页面 |
| `apps/desktop/src-tauri/src/commands.rs` | `check_needs_setup` IPC 命令 |

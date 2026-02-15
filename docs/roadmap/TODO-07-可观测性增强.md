# TODO-07: 可观测性增强

**优先级**: P2  
**预估工时**: 1-2天  
**影响**: 运维排查效率、代码可读性

## 问题清单

### 7.1 魔法数字提取为命名常量

**位置**: 多个文件  
**现状**: 大量超时、限制、间隔等数字直接硬编码在代码中。  
**建议**: 提取到文件顶部或专用常量模块。

应该提取的常量示例：
```typescript
// src/constants.ts 或各模块顶部
const GATEWAY_REQUEST_TIMEOUT_MS = 30_000;
const CONFIG_RELOAD_DEBOUNCE_MS = 300;      // config-reload.ts
const MAX_LICENSE_VERIFY_RETRIES = 3;       // verify.ts
const HEARTBEAT_FAILURE_WARN_THRESHOLD = 3; // heartbeat.ts
const HEARTBEAT_FAILURE_ERROR_THRESHOLD = 5;
const DEDUPE_CACHE_TTL_MS = 300_000;        // chat.ts (待实现)
const MESSAGE_HISTORY_DISPLAY_LIMIT = 80;   // chat.ts (UI)
const TYPING_DEFAULT_INTERVAL_SECONDS = 6;  // get-reply.ts
const OFFLINE_GRACE_PERIOD_HOURS = 24;      // offline.ts
const BINARY_PATH_CACHE_TTL_MS = 600_000;   // skills/config.ts (待实现)
```

---

### 7.2 全局错误日志标志改为节流

**位置**:
- `src/agents/model-catalog.ts:26` — `let errorLogged = false`
- `src/agents/bedrock-discovery.ts:28` — 同上模式

**现状**: 布尔标志导致只记录首次错误，后续全部静默。  
**建议**: 改为基于时间的节流（每 60 秒最多记录一次）。

```typescript
let lastErrorLogTime = 0;
const ERROR_LOG_THROTTLE_MS = 60_000;

function logErrorThrottled(msg: string): void {
  const now = Date.now();
  if (now - lastErrorLogTime >= ERROR_LOG_THROTTLE_MS) {
    log.error(msg);
    lastErrorLogTime = now;
  }
}
```

---

### 7.3 诊断日志条件化

**位置**:
- `src/agents/pi-embedded-runner/run/attempt.ts:710-715`
- `src/agents/pi-embedded-runner/run/payloads.ts:45-55`
- `src/agents/pi-embedded-runner/run.ts:386-404`

**现状**: 详细诊断日志在所有环境都执行字符串拼接。  
**建议**: 使用 `log.isDebugEnabled()` 或惰性求值包装。

```typescript
// 避免不必要的字符串拼接
if (log.isDebugEnabled?.()) {
  log.debug(`Detailed payload: ${JSON.stringify(payload)}`);
}
```

---

### 7.4 TODO 注释追踪

**位置**:
- `src/gateway/setup-wizard.ts:844`
- `src/gateway/setup-wizard.ts:1138`
- `src/gateway/setup-wizard.ts:1255`

**现状**: 代码中有未完成的 TODO 注释。  
**建议**: 为每个 TODO 创建 GitHub Issue 追踪，或在此 TODO 文件中记录。

---

### 7.5 clearLicenseCache 清理备份文件 — 已完成

**位置**: `src/license/offline.ts`  
**状态**: DONE — 已在本次稳定版修复中一并处理。

## 验收标准

- [ ] 所有重要数字常量有命名和注释
- [ ] 错误日志使用节流而非布尔标志
- [ ] 诊断日志有条件化保护
- [ ] clearLicenseCache 同时清理备份
- [ ] 代码中 TODO 注释都有对应的追踪项

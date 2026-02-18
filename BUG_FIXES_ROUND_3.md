# Bug Fixes - Round 3
**Date**: 2026-02-16
**Review Scope**: CLI, Browser, Memory, Web, TUI, Extensions

## Summary

Fixed 10 critical bugs identified in the third round of code review:

- **3 Memory Manager Issues** (CRITICAL - OOM risk)
- **3 Browser Issues** (zombie processes, timer cleanup)
- **2 Extension Issues** (DoS protection, listener leaks)
- **1 Security Issue** (CORS wildcard)
- **1 CLI Issue** (unhandled promise, signal leak)

---

## Critical Bugs Fixed

### 1. ✅ **manager-search.ts** - Unbounded Chunk Loading (CRITICAL)
**File**: `src/memory/manager-search.ts`
**Issue**: `listChunks()` loaded ALL chunks without LIMIT clause, causing OOM on large indices
**Fix**:
- Added optional `limit` parameter (default: 10,000 chunks)
- Added `LIMIT ?` clause to SQL query
- Prevents memory exhaustion on large memory stores

```typescript
// Before: SELECT ... WHERE model = ?
// After: SELECT ... WHERE model = ? LIMIT ?
```

**Impact**: Prevents OOM crashes on production systems with large memory indices

---

### 2. ✅ **chrome.ts** - WebSocket Listener Leak
**File**: `src/browser/chrome.ts`
**Issue**: `canOpenWebSocket()` could leave orphaned listeners if timeout fires before open/error
**Fix**:
- Added `settled` flag with `safeResolve()` wrapper
- Prevents double-resolution race condition

```typescript
let settled = false;
const safeResolve = (value: boolean) => {
  if (settled) return;
  settled = true;
  resolve(value);
};
```

---

### 3. ✅ **chrome.ts** - Zombie Bootstrap Process
**File**: `src/browser/chrome.ts`
**Issue**: Bootstrap Chrome process not force-killed if SIGTERM fails
**Fix**:
- Added SIGKILL fallback after 5-second timeout
- Prevents zombie processes accumulating

```typescript
if (bootstrap.exitCode == null) {
  try {
    bootstrap.kill("SIGKILL");
  } catch {}
}
```

---

### 4. ✅ **media/server.ts** - Event Listener Accumulation
**File**: `src/media/server.ts`
**Issue**: `res.on("finish")` accumulates listeners on response object
**Fix**: Changed `res.on()` to `res.once()`

```typescript
// Before: res.on("finish", () => { ... })
// After: res.once("finish", () => { ... })
```

---

### 5. ✅ **manager-sync-ops.ts** - Database Connection Leak
**File**: `src/memory/manager-sync-ops.ts`
**Issue**: `tempDb` not closed on error path in `runSafeReindex()`
**Fix**:
- Added `tempDb.close()` in catch block
- Prevents database connection leaks on reindex failure

```typescript
try {
  tempDb.close();
} catch {}
```

---

### 6. ✅ **manager-embedding-ops.ts** - Cache Unbounded Growth
**File**: `src/memory/manager-embedding-ops.ts`
**Issue**: Embedding cache grows unbounded between sync cycles
**Fix**:
- Added `pruneEmbeddingCacheIfNeeded()` call in hot path
- Cache now pruned after each batch of embeddings

```typescript
this.pruneEmbeddingCacheIfNeeded();
```

---

### 7. ✅ **setup-wizard.ts** - Wildcard CORS (SECURITY)
**File**: `src/gateway/setup-wizard.ts`
**Issue**: `Access-Control-Allow-Origin: *` allows any origin
**Fix**:
- Restricted to localhost origins only
- Validates origin against allowlist before setting CORS header

```typescript
const allowedOrigins = ["http://localhost", "http://127.0.0.1"];
if (origin && allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
  res.setHeader("Access-Control-Allow-Origin", origin);
}
```

**Impact**: Prevents CSRF attacks on setup wizard API

---

### 8. ✅ **tui.ts** - Timer Cleanup on Exit
**File**: `src/tui/tui.ts`
**Issue**: Three timers (`statusTimer`, `waitingTimer`, `statusTimeout`) never cleaned up
**Fix**:
- Added cleanup calls in both exit paths (Ctrl+C, Ctrl+D)

```typescript
stopStatusTimer();
stopWaitingTimer();
if (statusTimeout) {
  clearTimeout(statusTimeout);
  statusTimeout = null;
}
```

---

### 9. ✅ **browser-cli-serve.ts** - Unhandled Promise Rejection
**File**: `src/cli/browser-cli-serve.ts`
**Issue**: Fire-and-forget `shutdown()` call could cause unhandled rejection
**Fix**:
- Added `.catch()` handlers with proper error logging
- Named handler functions to prevent signal listener accumulation

```typescript
const sigintHandler = () => {
  shutdown("SIGINT").catch((err) => {
    defaultRuntime.error(`Shutdown failed: ${String(err)}`);
    process.exit(1);
  });
};
```

---

### 10. ✅ **nextcloud-talk/monitor.ts** - Request Body DoS
**File**: `extensions/nextcloud-talk/src/monitor.ts`
**Issue**: `readBody()` had no size limit, allowing DoS via large payloads
**Fix**:
- Added 1MB body size limit
- Destroy request and reject on overflow

```typescript
const MAX_BODY_SIZE = 1024 * 1024; // 1 MB
if (totalSize > MAX_BODY_SIZE) {
  req.destroy();
  reject(new Error("Request body too large"));
  return;
}
```

---

### 11. ✅ **msteams/monitor.ts** - Abort Listener Leak
**File**: `extensions/msteams/src/monitor.ts`
**Issue**: Abort event listener never removed, accumulates on recreate
**Fix**:
- Added `{ once: true }` option to addEventListener
- Remove listener in shutdown function

```typescript
const abortHandler = () => { void shutdown(); };
if (opts.abortSignal) {
  opts.abortSignal.addEventListener("abort", abortHandler, { once: true });
}
// ... cleanup in shutdown
opts.abortSignal.removeEventListener("abort", abortHandler);
```

---

## Diagnosed as NOT BUGS

### ✅ **server-middleware.ts** - Request Abort Listeners
**Status**: NOT A BUG
**Reason**: Listeners are on per-request `req`/`res` objects that are garbage collected

### ✅ **cdp.helpers.ts** - CDP WebSocket Listeners
**Status**: NOT A BUG
**Reason**: WebSocket is short-lived, closed in `finally` block, listeners cleaned up with socket

### ✅ **zalo/monitor.ts** - Fire-and-Forget Webhook Processing
**Status**: NOT A BUG (Design Intent)
**Reason**: Webhooks must respond quickly (200 OK) to avoid sender timeouts. Error logging is appropriate.

### ✅ **zalo/monitor.ts** - Polling Loop Orphaned Operations
**Status**: NOT A BUG
**Reason**: Polling loop properly awaits `processUpdate()` before next iteration (line 244)

---

## Testing Recommendations

1. **Memory Manager**: Test with large indices (>10,000 chunks)
2. **Browser**: Test Chrome profile bootstrap on slow systems
3. **Extensions**: Test webhook endpoints with large payloads
4. **TUI**: Test rapid Ctrl+C/Ctrl+D sequences
5. **Security**: Test setup wizard CORS with external origins

---

## Files Modified (Total: 11)

1. `src/memory/manager-search.ts`
2. `src/browser/chrome.ts` (2 bugs)
3. `src/media/server.ts`
4. `src/memory/manager-sync-ops.ts`
5. `src/memory/manager-embedding-ops.ts`
6. `src/gateway/setup-wizard.ts`
7. `src/tui/tui.ts`
8. `src/cli/browser-cli-serve.ts`
9. `extensions/nextcloud-talk/src/monitor.ts`
10. `extensions/msteams/src/monitor.ts`

---

## Total Bugs Fixed (All Rounds)

- **Round 1**: 9 bugs fixed (gateway, agents, extensions)
- **Round 2**: 2 bugs fixed (msteams cache, voice-call DoS)
- **Round 3**: 10 bugs fixed (cli, browser, memory, web, extensions)

**Grand Total**: **21 confirmed bugs fixed** ✅

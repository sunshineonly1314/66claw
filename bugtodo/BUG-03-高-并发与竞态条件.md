# BUG-03: 并发与竞态条件 [高]

## Bug 3.1: 配置热更新竞态条件

**位置**: `src/gateway/config-reload.ts:300-363`  
**严重度**: 高  
**类型**: 竞态条件  

**问题描述**:
`runReload()` 使用 `pending` 标志防止并发重载，但在快速连续修改配置的场景下，可能丢失中间的配置变更：

1. 修改1触发重载 → `pending = true`
2. 修改2到达 → 因 `pending = true` 被跳过
3. 修改1的重载完成 → `pending = false`
4. 修改2的变更丢失

**影响**:
- 配置变更可能丢失
- 实际配置与文件不一致

**修复建议**:
```typescript
// 使用"重载后再检查"策略
let reloadQueued = false;
let isReloading = false;

async function runReload(): Promise<void> {
  if (isReloading) {
    reloadQueued = true; // 标记需要再次重载
    return;
  }
  
  isReloading = true;
  try {
    await performReload();
  } finally {
    isReloading = false;
    if (reloadQueued) {
      reloadQueued = false;
      // 延迟一小段时间后再次重载（合并更多变更）
      setTimeout(() => runReload(), 500);
    }
  }
}
```

---

## Bug 3.2: 配置编辑器并发冲突

**位置**: `src/gateway/server-methods/config.ts:42-84`  
**严重度**: 中  
**类型**: 竞态条件  

**问题描述**:
`requireConfigBaseHash` 基于快照哈希检测冲突配置编辑，但如果哈希不可用（首次加载或缓存失效），检查可能被跳过。

**影响**:
- 多用户同时编辑配置可能互相覆盖

**修复建议**:
```typescript
// 强制要求 hash
function requireConfigBaseHash(
  clientHash: string | undefined,
  currentHash: string,
): void {
  if (!clientHash) {
    throw new Error("配置编辑需要提供 baseHash，请刷新后重试");
  }
  if (clientHash !== currentHash) {
    throw new Error("配置已被其他操作修改，请刷新后重试");
  }
}
```

---

## Bug 3.3: 免费模型重试循环边界条件

**位置**: `src/auto-reply/reply/get-reply.ts:341-519`  
**严重度**: 中  
**类型**: 逻辑错误  

**问题描述**:
免费模型重试循环中 `while (retryCount <= MAX_FREE_MODEL_RETRIES)` 与循环体内的 `if (retryCount > MAX_FREE_MODEL_RETRIES)` 存在逻辑冗余。当 `retryCount` 在循环体内递增到超过 `MAX_FREE_MODEL_RETRIES` 时，内部检查总是为 true。

具体问题：
- 第349行: `while (retryCount <= MAX_FREE_MODEL_RETRIES)` — retryCount 从 0 开始
- 第423行: `retryCount++` — 递增
- 第429行: `if (retryCount > MAX_FREE_MODEL_RETRIES)` — 此时如果刚好 == MAX，不会进入
- 实际最大尝试次数为 MAX_FREE_MODEL_RETRIES + 1 次（初始 + 3次重试 = 4次），比预期多1次

**影响**:
- 实际重试次数可能比预期多1次
- 代码逻辑不够清晰

**修复建议**:
```typescript
const MAX_FREE_MODEL_RETRIES = 3;
let retryCount = 0;

// 使用更清晰的循环结构
while (true) {
  try {
    reply = await runPreparedReply({ ... });
    break; // 成功，退出
  } catch (err) {
    if (!usingFreeModel) throw err;
    
    const isQuotaError = detectQuotaExhaustedError(err, httpStatus);
    if (!isQuotaError) throw err;
    
    retryCount++;
    if (retryCount >= MAX_FREE_MODEL_RETRIES) {
      // 达到最大重试次数
      throw err;
    }
    
    // 切换到下一个免费模型...
  }
}
```

---

## Bug 3.4: 技能同步并发防护可能导致长等待

**位置**: `src/agents/skills/sync.ts:77-80`  
**严重度**: 低  
**类型**: 竞态条件  

**问题描述**:
并发同步防护可能导致请求等待已有的同步操作完成，但没有超时机制。如果同步操作卡住，等待者将无限等待。

**修复建议**:
```typescript
// 添加超时机制
const SYNC_TIMEOUT = 30_000; // 30秒

async function syncSkillsIndex(): Promise<void> {
  if (syncInProgress) {
    // 等待已有同步完成，但加超时
    const timeoutPromise = new Promise<void>((_, reject) => 
      setTimeout(() => reject(new Error("Sync timeout")), SYNC_TIMEOUT)
    );
    try {
      await Promise.race([syncInProgress, timeoutPromise]);
    } catch {
      log.warn("Sync wait timed out, proceeding with stale data");
    }
    return;
  }
  // ...
}
```

---

## Bug 3.5: AbortController 清理不完整

**位置**: `src/gateway/server-methods/chat.ts:588-590`  
**严重度**: 低  
**类型**: 资源泄漏  

**问题描述**:
AbortController 在 finally 块中被删除，但如果在创建之前发生异常，finally 块中的删除操作不会有问题（no-op）。然而，如果 abort 信号已经被传递给其他异步操作，删除 controller 不会取消这些操作。

**修复建议**:
```typescript
try {
  const controller = new AbortController();
  activeControllers.set(sessionKey, controller);
  try {
    await processMessage(controller.signal);
  } finally {
    controller.abort(); // 确保所有持有 signal 的操作被取消
    activeControllers.delete(sessionKey);
  }
} catch (err) {
  // ...
}
```

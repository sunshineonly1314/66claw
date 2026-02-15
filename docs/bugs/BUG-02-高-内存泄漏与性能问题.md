# BUG-02: 内存泄漏与性能问题 [高]

## Bug 2.1: 聊天去重缓存永不过期

**位置**: `src/gateway/server-methods/chat.ts:420-426`  
**严重度**: 高  
**类型**: 内存泄漏  

**问题描述**:
`context.dedupe` 缓存用于消息去重，但没有 TTL（过期时间）和大小限制。长时间运行的网关会导致此缓存持续增长。

**影响**:
- 内存持续增长，最终可能导致 OOM
- 长期运行的实例性能下降

**修复建议**:
```typescript
// 方案1：使用 Map 配合定期清理
class ExpiringCache<K, V> {
  private cache = new Map<K, { value: V; expireAt: number }>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 10000, ttlMs = 300_000) { // 5分钟 TTL
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    // 定期清理
    setInterval(() => this.cleanup(), ttlMs);
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      // 删除最旧的条目
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expireAt: Date.now() + this.ttlMs });
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expireAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expireAt) this.cache.delete(key);
    }
  }
}
```

---

## Bug 2.2: 钉钉 Session Webhook 缓存无清理机制

**位置**: `extensions/dingtalk/src/channel.ts:46`  
**严重度**: 中  
**类型**: 内存泄漏  

**问题描述**:
DingTalk 的 session webhook 缓存存储了每个会话的 webhook URL，但从不清理过期条目。长时间运行会导致缓存不断增长。

**影响**:
- 内存增长
- 过期 webhook 可能导致消息发送失败

**修复建议**:
```typescript
// 使用 Map 配合 TTL
class SessionWebhookCache {
  private cache = new Map<string, { url: string; expireAt: number }>();
  private readonly TTL = 2 * 60 * 60 * 1000; // 2小时

  set(sessionId: string, url: string): void {
    this.cache.set(sessionId, { url, expireAt: Date.now() + this.TTL });
  }

  get(sessionId: string): string | undefined {
    const entry = this.cache.get(sessionId);
    if (!entry || Date.now() > entry.expireAt) {
      this.cache.delete(sessionId);
      return undefined;
    }
    return entry.url;
  }
}
```

---

## Bug 2.3: Windows 二进制路径扫描性能问题

**位置**: `src/agents/skills/config.ts:145-177`  
**严重度**: 中  
**类型**: 性能  

**问题描述**:
`getBinaryPath()` 在 Windows 上扫描大量路径（包括 `C:\Program Files`、`C:\Windows\System32` 等），每次调用都进行文件系统检查，没有缓存。

**影响**:
- Windows 上技能检查明显变慢
- 频繁的文件系统 I/O

**修复建议**:
```typescript
// 添加结果缓存
const binaryPathCache = new Map<string, string | null>();

export function getBinaryPath(name: string): string | null {
  if (binaryPathCache.has(name)) {
    return binaryPathCache.get(name)!;
  }
  
  const result = _getBinaryPathUncached(name);
  binaryPathCache.set(name, result);
  
  // 10分钟后过期
  setTimeout(() => binaryPathCache.delete(name), 600_000);
  
  return result;
}
```

---

## Bug 2.4: 模型目录缓存策略问题

**位置**: `src/agents/model-catalog.ts:93`  
**严重度**: 中  
**类型**: 性能/可靠性  

**问题描述**:
模型目录加载失败时直接清除缓存，导致后续每次请求都重新尝试加载，可能造成大量重复的失败请求。

**影响**:
- 模型目录不可用时频繁重试
- 性能下降

**修复建议**:
```typescript
// 实现指数退避缓存
let failureCount = 0;
let nextRetryTime = 0;

async function loadModelCatalog(): Promise<ModelCatalog | null> {
  if (cachedCatalog) return cachedCatalog;
  
  if (Date.now() < nextRetryTime) {
    return null; // 等待退避时间
  }
  
  try {
    const catalog = await _loadCatalogFromSDK();
    cachedCatalog = catalog;
    failureCount = 0;
    return catalog;
  } catch (err) {
    failureCount++;
    // 指数退避：1s, 2s, 4s, 8s, 最大60s
    const backoffMs = Math.min(1000 * Math.pow(2, failureCount - 1), 60_000);
    nextRetryTime = Date.now() + backoffMs;
    log.warn(`Model catalog load failed, retry in ${backoffMs}ms`);
    return null;
  }
}
```

---

## Bug 2.5: Bedrock 发现缓存同样的问题

**位置**: `src/agents/bedrock-discovery.ts:192`  
**严重度**: 中  
**类型**: 性能/可靠性  

**问题描述**:
与 Bug 2.4 相同，Bedrock 发现错误时直接删除缓存，可能导致重复的 AWS API 调用。

**修复建议**:
同 Bug 2.4，实现指数退避策略。

---

## Bug 2.6: 详细诊断日志影响性能

**位置**: 多个文件  
- `src/agents/pi-embedded-runner/run/attempt.ts:710-715`  
- `src/agents/pi-embedded-runner/run/payloads.ts:45-55`  
- `src/agents/pi-embedded-runner/run.ts:386-404`  
**严重度**: 低  
**类型**: 性能  

**问题描述**:
多处诊断日志在生产环境也会执行字符串拼接和对象序列化，即使日志级别不需要。

**修复建议**:
```typescript
// 使用懒求值日志
if (log.isDebugEnabled()) {
  log.debug(`Diagnostic: ${JSON.stringify(payload)}`);
}

// 或使用日志框架的延迟求值
log.debug(() => `Diagnostic: ${JSON.stringify(payload)}`);
```

---

## Bug 2.7: UI 消息历史截断无提示

**位置**: `ui/src/ui/views/chat.ts:473`  
**严重度**: 低  
**类型**: 用户体验  

**问题描述**:
聊天界面限制显示 80 条消息，超出部分直接截断，用户无法知道有更多历史消息。

**修复建议**:
```typescript
// 在截断处添加提示
if (messages.length > 80) {
  const truncatedHtml = html`
    <div class="message-truncated-notice">
      已显示最近 80 条消息，更早的 ${messages.length - 80} 条消息已隐藏
    </div>
  `;
  // 在消息列表顶部显示
}
```

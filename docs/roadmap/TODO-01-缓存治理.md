# TODO-01: 缓存治理

**优先级**: P1  
**预估工时**: 2-3天  
**影响**: 长时间运行实例的内存稳定性

## 问题清单

### 1.1 聊天去重缓存无 TTL

**位置**: `src/gateway/server-methods/chat.ts`  
**现状**: `context.dedupe` 缓存只增不减，没有过期和大小限制。  
**风险**: 长时间运行的网关实例内存持续增长。  
**建议**:
- 添加 TTL（建议 5 分钟）
- 添加最大条目数限制（建议 10000）
- 使用 LRU 或定期清理策略

```typescript
// 建议实现方向
class ExpiringDedupeCache {
  private cache = new Map<string, number>(); // key → expireAt
  private maxSize = 10_000;
  private ttlMs = 300_000; // 5分钟

  has(key: string): boolean {
    const expireAt = this.cache.get(key);
    if (!expireAt) return false;
    if (Date.now() > expireAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  add(key: string): void {
    if (this.cache.size >= this.maxSize) {
      // 清理过期条目
      const now = Date.now();
      for (const [k, exp] of this.cache) {
        if (now > exp) this.cache.delete(k);
      }
      // 仍然满则删最旧
      if (this.cache.size >= this.maxSize) {
        const first = this.cache.keys().next().value;
        if (first !== undefined) this.cache.delete(first);
      }
    }
    this.cache.set(key, Date.now() + this.ttlMs);
  }
}
```

---

### 1.2 钉钉 Session Webhook 缓存无清理

**位置**: `extensions/dingtalk/src/channel.ts:46`  
**现状**: session webhook URL 缓存永不过期，永不清理。  
**风险**: 内存缓慢增长；过期 webhook 可能导致发送失败。  
**建议**:
- 添加 2 小时 TTL
- Webhook 发送失败时清除对应缓存条目

---

### 1.3 模型目录缓存失败后无退避

**位置**: `src/agents/model-catalog.ts:93`  
**现状**: 加载失败时清除缓存，下次请求立即重试。  
**风险**: 模型服务不可用时产生大量重复请求。  
**建议**:
- 实现指数退避：1s → 2s → 4s → 8s，最大 60s
- 保留上一次成功的缓存作为 stale 回退

---

### 1.4 Bedrock 发现缓存同样问题

**位置**: `src/agents/bedrock-discovery.ts:192`  
**现状**: 与 1.3 相同模式。  
**建议**: 同 1.3 的退避策略。

---

### 1.5 Windows 二进制路径扫描无缓存

**位置**: `src/agents/skills/config.ts:145-177`  
**现状**: `getBinaryPath()` 每次调用都扫描文件系统。  
**风险**: Windows 上扫描多个 Program Files 路径较慢。  
**建议**:
- 添加结果缓存（Map<string, string | null>）
- 设置 10 分钟 TTL

## 验收标准

- [ ] 去重缓存有 TTL 和大小限制
- [ ] 钉钉 webhook 缓存有过期策略
- [ ] 模型目录和 Bedrock 发现有指数退避
- [ ] 二进制路径查找有缓存
- [ ] 所有缓存策略有对应的单元测试

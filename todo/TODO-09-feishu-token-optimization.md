# TODO-09: 飞书 Token 消耗优化

**优先级**: P1 (5.7, 5.8) / P2 (5.9) / P3 (5.10, 5.11)
**预估工时**: 2-3天
**影响**: 飞书渠道 LLM Token 消耗、连接稳定性、可观测性
**关联**: TODO-05 扩展插件改进 (5.7-5.11)

> 调研结论：飞书 WebSocket 重连本身不消耗 API Token（走独立的 AppID/AppSecret 端点）。
> 用户感知的"重连费 Token"根因是：3 秒超时重推导致重复 LLM 调用 + 断线重连后消息积压集中处理。

---

## P1 — 下个迭代必须修复

### 9.1 飞书消息去重 — 防重复 LLM 调用

**位置**: `extensions/feishu/src/monitor.ts`, `extensions/feishu/src/webhook.ts`
**问题**: 飞书要求 3 秒内处理完消息，超时重推同一条消息。AI 模型响应远超 3 秒，导致同一消息被多次推送、多次调用 LLM，大量 Token 浪费。
**方案**:
- 基于 `message_id` 实现幂等处理，维护已处理消息的去重缓存（TTL 5 分钟）
- 收到重复消息时直接跳过，不再调用 LLM

```typescript
const processedMessages = new Map<string, number>(); // message_id -> timestamp
const DEDUP_TTL_MS = 5 * 60 * 1000;

function isDuplicate(messageId: string): boolean {
  const now = Date.now();
  for (const [id, ts] of processedMessages) {
    if (now - ts > DEDUP_TTL_MS) processedMessages.delete(id);
  }
  if (processedMessages.has(messageId)) return true;
  processedMessages.set(messageId, now);
  return false;
}
```

---

### 9.2 飞书消息"占位回复"机制 — 避免超时重推

**位置**: `extensions/feishu/src/monitor.ts`
**问题**: AI 模型响应耗时远超飞书 3 秒超时阈值，飞书服务端认为消息未处理而重推。
**方案**:
- 收到消息后立即发送一条"思考中..."占位回复（< 1 秒内完成）
- AI 模型返回结果后，更新或追加正式回复
- 既满足飞书 3 秒响应要求，又避免重推

---

## P2 — 后续迭代改善

### 9.3 飞书 WebSocket 优雅关闭 — 防连接槽泄漏

**位置**: `extensions/feishu/src/monitor.ts:219-232`
**问题**: 飞书每应用最多 50 个 WebSocket 连接。异常退出时服务端不立即释放连接槽位，频繁重启可导致 `ExceedConnLimit`（错误码 1000040350）。
**方案**:
- 进程退出时（SIGTERM/SIGINT）主动调用 `wsClient.close()` 关闭 WebSocket
- 添加 `process.on('exit')` / `process.on('SIGTERM')` 钩子确保清理
- 实例 cleanup 函数中显式关闭 WebSocket 连接

---

## P3 — 逐步优化

### 9.4 飞书 probe 调用频率优化

**位置**: `extensions/feishu/src/api.ts` — `probeFeishuConnection()`
**问题**: probe 通过 REST API 探测连接状态，每次调用消耗 API 频控配额。
**方案**:
- 增加 probe 结果缓存（TTL 30 秒），避免短时间内重复探测
- 优先通过 WebSocket 连接状态判断，减少 REST API 调用

---

### 9.5 飞书重连频率监控告警

**位置**: `extensions/feishu/src/monitor.ts`
**问题**: 重连行为仅靠 SDK 内部日志，无应用层监控。
**方案**:
- 记录重连次数和频率，超过阈值（如 5 分钟内 3 次）输出 `log.warn`
- 帮助用户发现网络不稳定等基础设施问题

---

## 技术背景（调研结论摘要）

| 资源 | 重连时是否消耗？ |
|------|-----------------|
| `tenant_access_token` | 否 — WebSocket 端点用 AppID/AppSecret 直接认证 |
| `app_access_token` | 否 — 不参与 WebSocket 连接 |
| `user_access_token` | 否 — 不参与 WebSocket 连接 |
| 标准 API 频控配额 | 否 — `/callback/ws/endpoint` 是专用端点 |
| 连接数配额 (50上限) | 是 — 每个 Client 占一个槽位 |

**SDK 默认重连参数**:
- `autoReconnect`: true
- `reconnectCount`: -1 (无限)
- `reconnectInterval`: 120s
- `reconnectNonce`: 30s (随机抖动防惊群)
- `pingInterval`: 120s

## 验收标准

- [ ] 飞书消息基于 `message_id` 去重，不重复调用 LLM
- [ ] 飞书收到消息后 < 1 秒内发送占位回复"思考中..."
- [ ] 飞书进程退出时主动关闭 WebSocket 连接
- [ ] 飞书 probe 有缓存，短时间内不重复调用 REST API
- [ ] 飞书重连频率超阈值时有告警日志

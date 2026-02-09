# TODO-10: MCP 热加载与上下文优化

**优先级**: P1
**预估工时**: 3-5天
**影响**: 上下文利用率、MCP 可扩展性、对话质量

## 背景

### 当前问题

MCP 工具定义（tool schemas）直接注入 agent 上下文，每个 MCP server 平均暴露 5 个工具，每个工具 schema 约 200 tokens。当 MCP 数量增多时，工具定义会显著挤占对话空间：

| MCP 数量 | 工具定义占用 (估算) | 占 200k 上下文比例 |
|----------|--------------------|--------------------|
| 5 个 | ~5,000 tokens | 2.5% |
| 10 个 | ~10,000 tokens | 5% |
| 15 个 | ~15,000 tokens | 7.5% |
| 20 个 (上限) | ~20,000 tokens | 10% |

### 当前架构能力

已具备的基础设施（**无需修改**）：

| 能力 | 位置 | 说明 |
|------|------|------|
| 单个 server 运行时启动/停止 | `src/mcp/runtime-manager.ts:41-99` | `startServer(id)` / `stopServer(id)` |
| 动态添加/移除 server | `src/mcp/index.ts` | `addServer()` / `removeServer()` |
| 工具列表动态重建 | `src/mcp/tool-bridge.ts` | `bridgeMCPTools()` 每次调用都从 running servers 重建，无缓存 |
| Gateway RPC 全套 API | `src/gateway/server-methods/mcp-methods.ts` | 8 个端点：status/restart/disable/enable/sync/list/add/remove |
| 健康监控 + 熔断 | `src/mcp/runtime-manager.ts:187-237` | 30s 心跳，3 次失败熔断，5 分钟冷却 |

**缺失的两个关键组件**：

1. **任务路由器** — 无代码分析用户输入并决定该启动哪个 MCP
2. **会话中工具注入** — agent session 创建后工具列表冻结（`src/agents/clawdbot-tools.ts:167-179`）

---

## 问题清单

### 10.1 新增 MCPTaskRouter — 任务级 MCP 匹配器

**新增文件**: `src/mcp/task-router.ts`
**现状**: 所有 `autoStart: true` 的 MCP 在初始化时全部启动，agent 看到全量工具定义。
**目标**: 根据用户输入内容，仅启动相关 MCP，减少无关工具定义对上下文的占用。

**设计要点**:

```typescript
// src/mcp/task-router.ts

export interface MCPServerMeta {
  id: string;
  tags: string[];                    // 分类标签，如 ["database", "sql"]
  triggerKeywords: string[];         // 触发关键词，如 ["数据库", "查询", "SQL"]
  priority: "always" | "warm" | "cold";  // 分层策略
}

export interface RouteResult {
  activate: string[];    // 需要启动的 server IDs
  deactivate: string[];  // 需要停止的 server IDs
  reason: string;        // 路由决策理由（调试用）
}

export class MCPTaskRouter {
  /**
   * 分析用户消息，返回需要激活/停用的 MCP 列表。
   * 轻量实现：关键词匹配 + 权重打分。
   * 未来可替换为 embedding 语义匹配。
   */
  route(userMessage: string, registeredServers: MCPServerMeta[]): RouteResult;
}
```

**分层策略**:

| 层级 | 说明 | 行为 | 典型 server |
|------|------|------|-------------|
| `always` | 常驻层 | 永远启动，不参与路由 | filesystem, time |
| `warm` | 热备层 | 进程保留，按需注入工具定义 | sqlite, fetch |
| `cold` | 冷启层 | 按需 spawn，启动延迟 3-30s | 第三方 MCP |

**匹配算法（V1 — 关键词）**:

```typescript
route(userMessage: string, servers: MCPServerMeta[]): RouteResult {
  const msg = userMessage.toLowerCase();
  const activate: string[] = [];
  const deactivate: string[] = [];

  for (const server of servers) {
    if (server.priority === "always") {
      activate.push(server.id);
      continue;
    }
    const score = server.triggerKeywords.reduce(
      (s, kw) => s + (msg.includes(kw.toLowerCase()) ? 1 : 0), 0
    );
    if (score > 0) {
      activate.push(server.id);
    } else {
      deactivate.push(server.id);
    }
  }
  return { activate, deactivate, reason: `keyword match` };
}
```

---

### 10.2 MCP Server 元数据扩展

**位置**: `src/mcp/types.ts` (MCPServerConfig)
**现状**: MCPServerConfig 只有 `id, command, args, env, transport, enabled, autoStart, timeout`。
**建议**: 扩展配置支持路由元数据。

```typescript
// src/mcp/types.ts — MCPServerConfig 扩展
export interface MCPServerConfig {
  // ... 现有字段 ...

  /** 分类标签，用于任务路由匹配 */
  tags?: string[];
  /** 触发关键词（支持中英文），用于任务路由匹配 */
  triggerKeywords?: string[];
  /** 加载优先级：always=常驻, warm=热备, cold=按需 */
  priority?: "always" | "warm" | "cold";
}
```

**配置示例** (clawdbot.yaml):

```yaml
mcp:
  servers:
    - id: filesystem
      command: npx
      args: ["-y", "@anthropic-ai/mcp-filesystem"]
      priority: always            # 常驻，不参与路由

    - id: sqlite
      command: npx
      args: ["-y", "@anthropic-ai/mcp-sqlite"]
      priority: warm
      tags: ["database", "sql"]
      triggerKeywords: ["数据库", "查询", "SQL", "表", "sqlite", "database"]

    - id: fetch
      command: npx
      args: ["-y", "@anthropic-ai/mcp-fetch"]
      priority: warm
      tags: ["http", "api", "web"]
      triggerKeywords: ["请求", "API", "fetch", "HTTP", "下载", "网页"]

    - id: thinking
      command: npx
      args: ["-y", "@anthropic-ai/mcp-sequential-thinking"]
      priority: cold
      tags: ["reasoning", "thinking"]
      triggerKeywords: ["推理", "思考", "分析", "thinking", "reasoning"]
```

**Zod schema 更新**: `src/config/zod-schema.ts`

---

### 10.3 Session 创建前路由集成

**位置**: `src/agents/clawdbot-tools.ts:167-179`
**现状**: agent session 创建时一次性获取全量 MCP 工具。
**建议**: 在 session 创建前调用 `MCPTaskRouter.route()`，仅启动匹配的 servers。

**修改思路**:

```typescript
// src/agents/clawdbot-tools.ts — 修改工具组装流程

export async function createClawdbotTools(options: {
  userMessage?: string;   // 新增：用户当前消息，用于路由
  // ... 其他现有参数
}) {
  // 1. 如果有用户消息且启用了热加载，先跑路由
  if (options.userMessage && mcpHotLoadEnabled) {
    const router = getMCPTaskRouter();
    const manager = getMCPManagerSafe();
    if (router && manager) {
      const result = router.route(options.userMessage, manager.getServerMetas());
      // 启动需要的 servers
      await Promise.allSettled(
        result.activate.map(id => manager.runtime.startServer(id))
      );
      // 可选：停止不需要的 servers（释放内存）
      // await Promise.allSettled(
      //   result.deactivate.map(id => manager.runtime.stopServer(id))
      // );
    }
  }

  // 2. 原有逻辑：获取当前 running servers 的工具
  const mcpToolsRaw = getMCPManagerSafe()?.getAvailableTools() ?? [];
  // ...
}
```

**注意**: 停止 server 的操作可选，首版建议**只启动不停止**，避免误杀正在被其他会话使用的 server。

---

### 10.4 MCP 启动延迟优化（预热池）

**新增文件**: `src/mcp/warmpool.ts`
**现状**: 冷启动 MCP server 需要 3-30s（npx 下载 + 进程初始化）。
**目标**: 对 `warm` 层 server 保持进程存活，仅控制工具是否注入 agent。

**设计要点**:

```typescript
// src/mcp/warmpool.ts

/**
 * Warm Pool 策略：
 * - warm server 在 MCPManager.initialize() 时启动进程
 * - 但 bridgeMCPTools() 只桥接被 TaskRouter 激活的 servers 的工具
 * - 这样启动延迟 <500ms（无需 spawn），同时不污染 agent 上下文
 */

export class MCPWarmPool {
  private activeSet = new Set<string>();  // 当前对 agent 可见的 server IDs

  activate(id: string): void {
    this.activeSet.add(id);
  }

  deactivate(id: string): void {
    this.activeSet.delete(id);
  }

  isActive(id: string): boolean {
    return this.activeSet.has(id);
  }

  /** LRU 淘汰：超过 maxWarm 个 warm server 时停止最久未用的 */
  evictIfNeeded(maxWarm: number): string[] { ... }
}
```

**tool-bridge.ts 修改**:

```typescript
// src/mcp/tool-bridge.ts — bridgeMCPTools 增加过滤

export function bridgeMCPTools(
  runtimeManager: MCPRuntimeManager,
  warmPool?: MCPWarmPool,   // 新增参数
): AnyAgentTool[] {
  const allTools = runtimeManager.getAllTools();

  // 如果有 warmPool，只桥接 active 的 servers 的工具
  const filtered = warmPool
    ? allTools.filter(t => warmPool.isActive(t.serverId))
    : allTools;

  return filtered.map(toolInfo => /* ... 原有桥接逻辑 */);
}
```

---

### 10.5 配置项与开关

**位置**: `src/config/types.clawdbot.ts` / `src/config/zod-schema.ts`
**建议**: 新增配置开关，允许用户控制热加载行为。

```yaml
# clawdbot.yaml
mcp:
  hotLoad:
    enabled: true                  # 是否启用热加载（默认 false，渐进式开启）
    maxConcurrentActive: 8         # 同时激活的最大 server 数
    warmPoolSize: 5                # 热备池大小
    fallbackToFullLoad: true       # 路由失败时回退到全量加载
```

---

## 上下文节省估算

| 场景 | 全量加载 | 热加载后 | 节省 |
|------|---------|---------|------|
| 5 个 MCP | ~5,000 tokens | ~2,000 tokens | 3,000 tokens |
| 10 个 MCP | ~10,000 tokens | ~3,000 tokens | **7,000 tokens** |
| 15 个 MCP | ~15,000 tokens | ~3,000 tokens | **12,000 tokens** |
| 20 个 MCP (上限) | ~20,000 tokens | ~3,000 tokens | **17,000 tokens** |

> 按每轮对话保留 2-3 个相关 MCP + 1-2 个常驻 MCP 估算。

---

## 实现路线图

### Phase 1: 基础路由（2 天）

- [ ] 新增 `src/mcp/task-router.ts` — 关键词匹配路由器
- [ ] 扩展 `MCPServerConfig` 类型 — 添加 tags/triggerKeywords/priority
- [ ] 修改 `src/agents/clawdbot-tools.ts` — session 创建前调用路由
- [ ] 更新 Zod schema — 支持新配置字段
- [ ] 默认 5 个内置 MCP 的元数据预设

### Phase 2: 预热池 + LRU（1-2 天）

- [ ] 新增 `src/mcp/warmpool.ts` — 预热池 + LRU 淘汰
- [ ] 修改 `src/mcp/tool-bridge.ts` — 支持 warmPool 过滤
- [ ] 修改 `src/mcp/index.ts` — MCPManager 集成 warmPool
- [ ] warm 层 server 启动但不注入工具的能力

### Phase 3: 配置 + UI（1 天）

- [ ] 配置 schema 新增 `mcp.hotLoad` 节
- [ ] UI Extensions 页面显示 server 的 priority 层级
- [ ] UI 状态显示 active/warm/cold 标识

### Phase 4: 高级路由（未来迭代）

- [ ] Embedding 语义匹配替代关键词（需要 embedding 模型）
- [ ] 基于历史使用频率的自适应路由
- [ ] 会话内动态工具注入（需改 agent 框架）

## 验收标准

- [ ] 配置 `mcp.hotLoad.enabled: true` 后，agent session 仅包含路由匹配的 MCP 工具
- [ ] `priority: always` 的 server 始终可用
- [ ] `priority: warm` 的 server 启动延迟 < 500ms（进程已存活）
- [ ] `priority: cold` 的 server 首次使用时自动启动
- [ ] 路由失败时 fallback 到全量加载（不降级体验）
- [ ] 10 个 MCP 场景下上下文节省 ≥ 5,000 tokens

## 相关常量参考

| 常量 | 值 | 位置 |
|------|---|------|
| MCP_MAX_SERVERS | 20 | `src/mcp/types.ts:95` |
| MCP_INIT_TIMEOUT_MS | 30,000ms | `src/mcp/types.ts:96` |
| MCP_CALL_TIMEOUT_MS | 60,000ms | `src/mcp/types.ts:97` |
| MCP_HEALTH_INTERVAL_MS | 30,000ms | `src/mcp/types.ts:98` |
| MCP_MAX_RESULT_BYTES | 1,048,576 (1MB) | `src/mcp/types.ts:103` |
| DEFAULT_CONTEXT_TOKENS | 200,000 | `src/agents/defaults.ts:6` |
| CONTEXT_WINDOW_WARN_BELOW_TOKENS | 32,000 | `src/agents/context-window-guard.ts:4` |
| CONTEXT_WINDOW_HARD_MIN_TOKENS | 16,000 | `src/agents/context-window-guard.ts:3` |

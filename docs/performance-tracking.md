# OpenClawCN 性能追踪系统

## 概述

为了诊断和优化聊天交互的性能,OpenClawCN 集成了精细化的性能追踪系统。该系统能够追踪从用户消息接收到最终响应发送的整个流程,帮助快速定位性能瓶颈。

## 使用方法

性能追踪系统默认已集成到聊天流程中,无需额外配置即可使用。

### 查看性能日志

性能日志会自动输出到系统日志,使用 `perf-tracker` 子系统标签。

**示例日志输出:**

```
[perf-tracker] [a1b2c3d4] request_received: +0.50ms (total: 0.50ms)
[perf-tracker] [a1b2c3d4] agent_session_load: +5.23ms (total: 5.73ms)
[perf-tracker] [a1b2c3d4] dispatch_start: +0.15ms (total: 5.88ms)
[perf-tracker] [a1b2c3d4] dispatch_intent_classify: +12.45ms (total: 18.33ms)
[perf-tracker] [a1b2c3d4] dispatch_complexity: +2.10ms (total: 20.43ms)
[perf-tracker] [a1b2c3d4] agent_run_start: +8.67ms (total: 29.10ms)
[perf-tracker] [a1b2c3d4] agent_context_build: +15.32ms (total: 44.42ms)
[perf-tracker] [a1b2c3d4] agent_api_call_start: +1.20ms (total: 45.62ms) [{"provider":"anthropic","model":"claude-sonnet-4.5"}]
[perf-tracker] [a1b2c3d4] agent_run_complete: +1850.45ms (total: 1896.07ms)
[perf-tracker] [a1b2c3d4] agent_response_process: +3.21ms (total: 1899.28ms)
[perf-tracker] [a1b2c3d4] response_sent: +0.80ms (total: 1900.08ms)

========== Performance Trace Summary [a1b2c3d4] ==========
Total Time: 1900.08ms
Session: main-123456

Phase Breakdown:
  agent         :  1874.64ms (98.7%)
  dispatch      :    14.70ms (0.8%)
  request       :     0.50ms (0.0%)
  response      :     0.80ms (0.0%)

Slow Phases (>10ms):
  dispatch_intent_classify        :    12.45ms
  agent_context_build             :    15.32ms
  agent_run_complete              :  1850.45ms

==========================================================
```

## 性能追踪阶段

系统追踪以下关键阶段:

### 1. 请求接收阶段 (request_*)
- `request_received`: 网关接收到 chat.send 请求

### 2. 分发引擎阶段 (dispatch_*)
- `dispatch_start`: 分发引擎启动
- `dispatch_intent_classify`: 意图分类
- `dispatch_complexity`: 复杂度分析
- `dispatch_tool_discovery`: 工具发现 (如果启用)
- `dispatch_tool_select`: 工具选择 (如果启用)
- `dispatch_complete`: 分发完成

### 3. Agent 运行阶段 (agent_*)
- `agent_run_start`: Agent 运行启动
- `agent_session_load`: 会话加载
- `agent_context_build`: 上下文构建
- `agent_memory_load`: 记忆加载
- `agent_prompt_build`: Prompt 构建
- `agent_api_call_start`: API 调用开始 (包含 provider/model 信息)
- `agent_api_call_ttfb`: API 首字节时间 (Time To First Byte)
- `agent_api_call_complete`: API 调用完成
- `agent_tool_execute_start`: 工具执行开始
- `agent_tool_execute_complete`: 工具执行完成
- `agent_response_process`: 响应处理
- `agent_session_save`: 会话保存
- `agent_run_complete`: Agent 运行完成

### 4. 响应发送阶段 (response_*)
- `response_sent`: 最终响应发送完成

## 性能总结报告

每次聊天完成后,系统会自动生成性能总结报告,包含:

1. **总耗时**: 从请求接收到响应发送的总时间
2. **阶段分组**: 按主要阶段(request, dispatch, agent, response)分组统计耗时和占比
3. **慢速阶段**: 列出所有耗时超过 10ms 的阶段,便于快速定位瓶颈

## 常见性能问题诊断

### 问题 1: 整体响应慢 (>3秒)

**可能原因:**
- `agent_api_call_start` 到 `agent_run_complete` 耗时长: **LLM API 响应慢**
  - 解决方案: 检查网络连接,考虑使用更快的 LLM 提供商或模型
- `dispatch_intent_classify` 耗时长 (>50ms): **意图分类 LLM 调用慢**
  - 解决方案: 在 `dispatch.json5` 中使用规则分类而非 LLM 分类
- `agent_context_build` 耗时长 (>100ms): **会话历史过长**
  - 解决方案: 启用 prompt caching 或减小上下文窗口

### 问题 2: /new 新建窗口慢

**可能原因:**
- `agent_session_load` 耗时长: **会话初始化慢**
  - 解决方案: 检查文件系统性能,减少会话元数据
- `dispatch_tool_discovery` 耗时长: **工具索引查询慢**
  - 解决方案: 重建工具索引数据库 (`pnpm build:tool-index`)

### 问题 3: 首次响应慢,后续响应正常

**可能原因:**
- `agent_memory_load` 首次耗时长: **冷启动加载向量数据库**
  - 解决方案: 这是正常现象,考虑预热机制

## 高级用法

### 编程方式访问性能数据

```typescript
import { getPerfTrace, getAllPerfTraces } from "./src/infra/perf-tracker.js";

// 获取特定 runId 的性能追踪
const trace = getPerfTrace("a1b2c3d4-1234-5678-abcd-1234567890ab");
if (trace) {
  console.log(`Total time: ${trace.measurements[trace.measurements.length - 1].totalMs}ms`);

  // 分析各阶段耗时
  for (const m of trace.measurements) {
    if (m.durationMs && m.durationMs > 100) {
      console.log(`Slow phase: ${m.phase} took ${m.durationMs}ms`);
    }
  }
}

// 获取所有追踪 (最近 1000 条)
const allTraces = getAllPerfTraces();
const avgTotalTime = allTraces.reduce((sum, t) => {
  const last = t.measurements[t.measurements.length - 1];
  return sum + (last?.totalMs ?? 0);
}, 0) / allTraces.length;
console.log(`Average response time: ${avgTotalTime.toFixed(2)}ms`);
```

### 在自定义工具中添加性能追踪

```typescript
import { recordPerfMeasurement } from "./src/infra/perf-tracker.js";

export function myCustomTool(params: { runId: string; /* ... */ }) {
  recordPerfMeasurement(params.runId, "agent_tool_execute_start", {
    toolName: "my-custom-tool",
  });

  // ... 工具执行逻辑 ...

  recordPerfMeasurement(params.runId, "agent_tool_execute_complete", {
    toolName: "my-custom-tool",
    resultSize: result.length,
  });
}
```

## 数据保留策略

- 性能追踪数据仅保留在内存中,最多保留最近 1000 条记录 (LRU 淘汰)
- 进程重启后数据会丢失
- 不占用持久化存储空间

## 注意事项

1. **性能开销**: 性能追踪系统本身的开销极小 (<1ms),可以安全地在生产环境使用
2. **隐私**: 性能日志不包含用户消息内容,只包含元数据(长度、附件数量等)
3. **日志级别**: 确保日志级别设置为 `info` 或更详细才能看到性能日志

## 故障排除

### 看不到性能日志?

1. 检查日志级别设置 (应为 `info` 或 `debug`)
2. 确认 `perf-tracker` 子系统日志未被过滤
3. 验证聊天请求是否通过 `chat.send` 方法 (直接调用 agent 不会触发追踪)

### 性能总结报告格式混乱?

1. 确保使用支持 ANSI 颜色的终端
2. 检查日志格式配置,建议使用纯文本格式而非 JSON

## 参考资料

- [性能追踪核心代码](../src/infra/perf-tracker.ts)
- [Chat 网关集成](../src/gateway/server-methods/chat.ts)
- [Dispatch 引擎集成](../src/dispatch/engine.ts)
- [Agent Runner 集成](../src/auto-reply/reply/agent-runner-execution.ts)

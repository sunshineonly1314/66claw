/**
 * Performance Tracker — 用于追踪和记录聊天流程各阶段的性能指标
 *
 * 此模块提供精细化的性能追踪能力,帮助定位聊天交互中的性能瓶颈。
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("perf-tracker");

export type PerfPhase =
  | "request_received" // 请求接收
  | "dispatch_start" // 分发开始
  | "dispatch_intent_classify" // 意图分类
  | "dispatch_complexity" // 复杂度分析
  | "dispatch_tool_discovery" // 工具发现
  | "dispatch_tool_select" // 工具选择
  | "dispatch_complete" // 分发完成
  | "agent_run_start" // Agent运行开始
  | "agent_session_load" // 会话加载
  | "agent_context_build" // 上下文构建
  | "agent_memory_load" // 记忆加载
  | "agent_prompt_build" // Prompt构建
  | "agent_api_call_start" // API调用开始
  | "agent_api_call_ttfb" // API首字节时间
  | "agent_api_call_complete" // API调用完成
  | "agent_tool_execute_start" // 工具执行开始
  | "agent_tool_execute_complete" // 工具执行完成
  | "agent_response_process" // 响应处理
  | "agent_session_save" // 会话保存
  | "agent_run_complete" // Agent运行完成
  | "response_sent"; // 响应发送

export type PerfMeasurement = {
  phase: PerfPhase;
  timestamp: number;
  durationMs?: number; // 相对于上一个阶段的耗时
  totalMs?: number; // 相对于起始时间的总耗时
  metadata?: Record<string, unknown>;
};

export type PerfTrace = {
  traceId: string;
  sessionKey?: string;
  startTime: number;
  measurements: PerfMeasurement[];
  metadata: Record<string, unknown>;
};

// 内存中的追踪存储 (使用LRU保留最近1000条)
const traces = new Map<string, PerfTrace>();
const MAX_TRACES = 1000;
const traceOrder: string[] = [];

/**
 * 创建一个新的性能追踪
 */
export function startPerfTrace(traceId: string, metadata?: Record<string, unknown>): PerfTrace {
  const trace: PerfTrace = {
    traceId,
    startTime: performance.now(),
    measurements: [],
    metadata: metadata ?? {},
  };

  // LRU淘汰
  if (traces.size >= MAX_TRACES) {
    const oldestId = traceOrder.shift();
    if (oldestId) {
      traces.delete(oldestId);
    }
  }

  traces.set(traceId, trace);
  traceOrder.push(traceId);

  return trace;
}

/**
 * 记录一个性能测量点
 */
export function recordPerfMeasurement(
  traceId: string,
  phase: PerfPhase,
  metadata?: Record<string, unknown>,
): void {
  const trace = traces.get(traceId);
  if (!trace) {
    log.warn(`Performance trace not found: ${traceId}`);
    return;
  }

  const now = performance.now();
  const totalMs = now - trace.startTime;

  const lastMeasurement = trace.measurements[trace.measurements.length - 1];
  const durationMs = lastMeasurement ? now - lastMeasurement.timestamp : totalMs;

  const measurement: PerfMeasurement = {
    phase,
    timestamp: now,
    durationMs,
    totalMs,
    metadata,
  };

  trace.measurements.push(measurement);

  // 记录详细日志
  const metaStr = metadata ? ` [${JSON.stringify(metadata)}]` : "";
  log.info(
    `[${traceId.slice(0, 8)}] ${phase}: +${durationMs.toFixed(2)}ms (total: ${totalMs.toFixed(2)}ms)${metaStr}`,
  );
}

/**
 * 完成性能追踪并输出总结
 */
export function completePerfTrace(
  traceId: string,
  metadata?: Record<string, unknown>,
): PerfTrace | undefined {
  const trace = traces.get(traceId);
  if (!trace) {
    log.warn(`Performance trace not found: ${traceId}`);
    return undefined;
  }

  // 记录完成点
  recordPerfMeasurement(traceId, "response_sent", metadata);

  // 输出性能总结
  const totalTime = performance.now() - trace.startTime;
  log.info(`\n========== Performance Trace Summary [${traceId.slice(0, 8)}] ==========`);
  log.info(`Total Time: ${totalTime.toFixed(2)}ms`);
  log.info(`Session: ${trace.metadata.sessionKey ?? "N/A"}`);
  log.info(`\nPhase Breakdown:`);

  // 按阶段分组统计
  const phaseGroups = new Map<string, number>();
  for (const m of trace.measurements) {
    const group = m.phase.split("_")[0]; // 取前缀作为分组
    phaseGroups.set(group, (phaseGroups.get(group) ?? 0) + (m.durationMs ?? 0));
  }

  // 输出分组统计
  const sortedGroups = Array.from(phaseGroups.entries()).sort((a, b) => b[1] - a[1]);
  for (const [group, duration] of sortedGroups) {
    const percent = ((duration / totalTime) * 100).toFixed(1);
    log.info(`  ${group.padEnd(15)}: ${duration.toFixed(2).padStart(8)}ms (${percent}%)`);
  }

  // 输出详细阶段耗时 (只显示超过10ms的)
  log.info(`\nSlow Phases (>10ms):`);
  const slowPhases = trace.measurements.filter((m) => (m.durationMs ?? 0) > 10);
  if (slowPhases.length === 0) {
    log.info(`  (none)`);
  } else {
    for (const m of slowPhases) {
      const metaStr = m.metadata ? ` | ${JSON.stringify(m.metadata)}` : "";
      log.info(`  ${m.phase.padEnd(30)}: ${m.durationMs!.toFixed(2).padStart(8)}ms${metaStr}`);
    }
  }

  log.info(`==========================================================\n`);

  return trace;
}

/**
 * 获取指定追踪
 */
export function getPerfTrace(traceId: string): PerfTrace | undefined {
  return traces.get(traceId);
}

/**
 * 获取所有追踪
 */
export function getAllPerfTraces(): PerfTrace[] {
  return Array.from(traces.values());
}

/**
 * 清空所有追踪
 */
export function clearPerfTraces(): void {
  traces.clear();
  traceOrder.length = 0;
}

/**
 * 便捷方法:创建一个性能计时器
 */
export function createPerfTimer(traceId: string) {
  return {
    record: (phase: PerfPhase, metadata?: Record<string, unknown>) => {
      recordPerfMeasurement(traceId, phase, metadata);
    },
    complete: (metadata?: Record<string, unknown>) => {
      return completePerfTrace(traceId, metadata);
    },
  };
}

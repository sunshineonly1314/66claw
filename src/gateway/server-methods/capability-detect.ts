/**
 * 能力检测 Gateway API
 * Capability Detection Gateway API
 *
 * 提供前端调用的能力检测接口
 */

import {
  detectCapabilities,
  detectCapabilitiesQuick,
  type CapabilityDetectResult,
} from "../../infra/capability-detect.js";
import { loadConfig } from "../../config/config.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import type { GatewayRequestHandler } from "./types.js";

// ============================================================================
// API Handlers
// ============================================================================

/**
 * 检测设备能力
 * @method capability.detect
 * @scope operator.read
 */
const detectHandler: GatewayRequestHandler = async (opts) => {
  const { params, respond } = opts;
  const cfg = loadConfig();

  try {
    // 获取工作空间目录
    let workspaceDir: string | undefined;
    const agentId = (params.agentId as string) ?? resolveDefaultAgentId(cfg);
    if (agentId) {
      workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    }

    // 是否快速检测
    const quick = params.quick === true;

    // 执行检测
    const result: CapabilityDetectResult = quick
      ? detectCapabilitiesQuick({ config: cfg, workspaceDir })
      : await detectCapabilities({ config: cfg, workspaceDir });

    respond(true, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    respond(false, undefined, {
      code: "CAPABILITY_DETECT_ERROR",
      message: `Capability detection failed: ${message}`,
    });
  }
};

/**
 * 快速检测能力（同步版本，更快）
 * @method capability.detect.quick
 * @scope operator.read
 */
const detectQuickHandler: GatewayRequestHandler = (opts) => {
  const { params, respond } = opts;

  try {
    const cfg = loadConfig();

    let workspaceDir: string | undefined;
    try {
      const agentId = (params.agentId as string) ?? resolveDefaultAgentId(cfg);
      if (agentId) {
        workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
      }
    } catch {
      // 如果获取工作空间目录失败，继续检测但不包含工作空间信息
      workspaceDir = undefined;
    }

    const result = detectCapabilitiesQuick({ config: cfg, workspaceDir });
    respond(true, result);
  } catch (err) {
    // 检测失败：返回错误而非伪造成功结果，让前端能正确处理降级逻辑
    const message = err instanceof Error ? err.message : String(err);
    console.error("[capability.detect.quick] Detection failed:", err);
    respond(false, undefined, {
      code: "CAPABILITY_DETECT_ERROR",
      message: `Quick detection failed: ${message}`,
    });
  }
};

/**
 * 标记首次使用完成
 * @method capability.firstVisit.complete
 * @scope operator.write
 */
const markFirstVisitCompleteHandler: GatewayRequestHandler = (opts) => {
  const { respond } = opts;

  try {
    // 这里可以在配置中记录首次使用完成状态
    // 目前由前端 localStorage 管理，后端只需要返回成功
    respond(true, { success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    respond(false, undefined, {
      code: "FIRST_VISIT_COMPLETE_ERROR",
      message: `Failed to mark first visit complete: ${message}`,
    });
  }
};

// ============================================================================
// Export Handlers
// ============================================================================

export const capabilityDetectHandlers: Record<string, GatewayRequestHandler> = {
  "capability.detect": detectHandler,
  "capability.detect.quick": detectQuickHandler,
  "capability.firstVisit.complete": markFirstVisitCompleteHandler,
};

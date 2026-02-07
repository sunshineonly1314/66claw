/**
 * Clawdbot Security Module
 * 安全模块入口
 *
 * @module security
 */

// 反调试检测
export {
  startAntiDebug,
  stopAntiDebug,
  checkDebuggerNow,
  type AntiDebugConfig,
} from "./anti-debug.js";

// 文件完整性校验
export {
  initIntegrityCheck,
  verifyIntegrity,
  checkIntegrityOnStartup,
  type IntegrityCheckResult,
} from "./integrity.js";

// AI 篡改防护
export {
  initAiTamperProtection,
  registerProtectedFunction,
  verifyProtectedFunctions,
  verifyCheckpoint,
  getCheckpointStatus,
  setApiToken,
  validateApiAction,
  reportSecurityViolation,
  createHoneypot,
  performSecuritySelfCheck,
} from "./ai-tamper-protection.js";

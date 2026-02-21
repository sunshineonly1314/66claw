/**
 * OpenClawCN Security Module
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
  startIntegrityPatrol,
  stopIntegrityPatrol,
  isNativeAddonAvailable,
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

// 内容保险库 — 机器绑定加密
export {
  setContentVaultDevMode,
  isEncryptionEnabled,
  encryptContent,
  decryptContent,
  encryptFile,
  decryptFile,
  ensureDirectoryEncrypted,
  destroyContentVault,
} from "./content-vault.js";

// 敏感字符串保险库 (Layer 5)
export {
  encryptSensitiveString,
  decryptSensitiveBuffer,
  wipeSensitiveBuffer,
  withSensitiveBuffer,
  withSensitiveString,
  destroyVault,
} from "./string-vault.js";

// 进程完整性监控 (Layer 5)
export {
  checkProcessIntegrity,
  startProcessIntegrityMonitor,
  stopProcessIntegrityMonitor,
  type ProcessIntegrityResult,
} from "./process-integrity.js";

// 延迟惩罚系统 (Knife 7)
export {
  recordViolation,
  getEnforcementDelay,
  shouldBlockService,
  applyEnforcementDelay,
  getEnforcementStatus,
} from "./delayed-enforcement.js";

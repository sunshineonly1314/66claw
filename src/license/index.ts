/**
 * Clawdbot License Module
 * 授权验证模块入口
 *
 * @module license
 */

// 类型导出
export * from "./types.js";

// 设备 ID 管理
export {
  getDeviceId,
  getDeviceName,
  getOsInfo,
  resetDeviceId,
} from "./device-id.js";

// 请求签名
export {
  generateNonce,
  getTimestamp,
  generateSign,
  generateSignParams,
  verifySign,
} from "./sign.js";

// 授权验证
export {
  configureLicense,
  getLicenseConfig,
  buildVerifyRequest,
  verifyLicense,
  verifyLicenseWithRetry,
  sendHeartbeat,
  getDeviceList,
  unbindDevice,
  acknowledgeNotification,
  checkHealth,
  createLicenseCache,
  getErrorMessage,
} from "./verify.js";

// 离线模式
export {
  saveLicenseCache,
  loadLicenseCache,
  clearLicenseCache,
  canUseOffline,
  getOfflineCache,
  getOfflineRemainingHours,
  shouldRefreshCache,
  createOfflineResponse,
} from "./offline.js";

// 心跳服务
export {
  startHeartbeat,
  stopHeartbeat,
  triggerHeartbeat,
  getHeartbeatStatus,
  isHeartbeatRunning,
} from "./heartbeat.js";

// 通知管理
export {
  loadShownNotifications,
  markNotificationAsShown,
  hasNotificationBeenShown,
  getShownNotificationIds,
  cleanupOldNotificationRecords,
  filterNotificationsToShow,
  processNotifications,
  getNotificationDisplayConfig,
} from "./notifications.js";

// 启动验证
export {
  verifyLicenseOnStartup,
  type StartupVerifyResult,
} from "./startup.js";

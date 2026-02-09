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
  getDeviceFingerprint,
  getOsInfo,
  resetDeviceId,
  getDeviceDiagnostics,
  type DeviceDiagnostics,
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
  UnbindError,
  switchDevice,
  DeviceSwitchError,
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

// 技术支持二维码（本地文件）
export {
  getSupportQrcode,
  getPurchaseUrl,
  fetchRemotePurchaseUrl,
  enrichLicenseWithSupport,
  clearSupportQrcodeCache,
} from "./support-qrcode.js";

// 技术支持二维码（远程拉取 + 7天缓存）
export {
  getRemoteSupportQrcode,
  preloadSupportQrcode,
  fetchRemoteQrcode,
  clearRemoteQrcodeCache,
  getQrcodeCacheStatus,
  isCacheExpired,
  getCacheRemainingMs,
  type RemoteQrcodeMetadata,
  type RemoteQrcodeResponse,
} from "./support-qrcode-remote.js";

// 短期令牌
export {
  fetchToken,
  refreshToken,
  hasValidToken,
  getCurrentToken,
  getTokenRemainingMs,
  isTokenValid,
  isTokenInGracePeriod,
  verifyTokenSignature,
  startTokenAutoRefresh,
  stopTokenAutoRefresh,
  clearToken,
  isFeatureAllowed,
  getTokenStatusSummary,
  type LicenseToken,
  type TokenResponse,
  type TokenState,
} from "./token.js";

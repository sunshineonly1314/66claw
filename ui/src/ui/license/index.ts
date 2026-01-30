/**
 * Clawdbot License UI Module
 * 授权验证 UI 模块入口
 */

// 类型导出
export * from "./types.js";

// 弹窗渲染
export {
  renderActivationDialog,
  renderExpiredDialog,
  renderRenewalReminderDialog,
  renderNotificationDialog,
  renderForceUpdateDialog,
  renderDeviceLimitDialog,
  renderOfflineBanner,
} from "./license-dialogs.js";

// 控制器
export {
  createLicenseController,
  shouldShowLicenseDialog,
  getOfflineRemainingHours,
  type LicenseController,
} from "./license-controller.js";

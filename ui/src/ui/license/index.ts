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
  renderDeviceSwitchDialog,
  renderDeviceSwitchCooldownDialog,
  renderDeviceKickedDialog,
  renderOfflineBanner,
  renderUpgradeSuccessDialog,
  renderUpgradeErrorDialog,
} from "./license-dialogs.js";

// 授权信息面板
export { renderLicenseInfoCard } from "./license-info-panel.js";

// 功能门控
export { renderFeatureGate, hasFeature } from "./feature-gate.js";

// 控制器
export {
  createLicenseController,
  shouldShowLicenseDialog,
  getOfflineRemainingHours,
  type LicenseController,
} from "./license-controller.js";

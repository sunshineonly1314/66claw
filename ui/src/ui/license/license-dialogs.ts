/**
 * License UI - Dialog Rendering
 * 授权相关弹窗渲染
 */

import { html, nothing, type TemplateResult } from "lit";
import { isCN } from "../edition";
import { brand } from "../brand";
import type {
  LicenseUiState,
  LicenseNotification,
  RenewalReminder,
  ForceUpdateInfo,
  BoundDevice,
  LicenseErrorCode,
  DeviceSwitchInfo,
  DeviceSwitchCooldownInfo,
  UpgradeResult,
} from "./types.js";
import { LicenseUpgradeErrorCode } from "./types.js";

/**
 * 打开购买/续费链接
 * 优先使用传入的 URL，若为空则从 gateway /config/purchase-url 获取
 */
async function openPurchaseOrRenewUrl(renewUrl: string | null): Promise<void> {
  if (renewUrl) {
    window.open(renewUrl, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    const resp = await fetch("/config/purchase-url");
    if (!resp.ok) return;
    const json = (await resp.json()) as { code?: number; data?: { xianyu?: string } };
    const fetchedUrl = json?.code === 200 && json?.data?.xianyu ? json.data.xianyu : null;
    if (fetchedUrl) {
      window.open(fetchedUrl, "_blank", "noopener,noreferrer");
    }
  } catch { /* silent */ }
}

/**
 * 获取紧急程度对应的样式类
 */
function getUrgencyClass(urgency: "info" | "warning" | "critical" | null): string {
  switch (urgency) {
    case "critical":
      return "license-urgency-critical";
    case "warning":
      return "license-urgency-warning";
    case "info":
    default:
      return "license-urgency-info";
  }
}

/**
 * 获取紧急程度对应的图标
 */
function getUrgencyIcon(urgency: "info" | "warning" | "critical" | null): string {
  switch (urgency) {
    case "critical":
      return "🚨";
    case "warning":
      return "⚠️";
    case "info":
    default:
      return "ℹ️";
  }
}

/**
 * 渲染授权激活弹窗
 * 前端校验：激活码前缀由 brand.activationPrefix 控制
 */
export function renderActivationDialog(
  onActivate: (key: string) => void,
  onCancel: () => void,
  error: string | null = null,
  loading: boolean = false,
): TemplateResult {
  const prefix = brand.activationPrefix;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.querySelector("input") as HTMLInputElement;
    const errorEl = form.querySelector(".license-prefix-error") as HTMLElement | null;
    const value = input?.value?.trim();
    if (!value) return;

    // 前端校验：若配置了前缀则校验
    if (prefix && !value.toLowerCase().startsWith(prefix)) {
      if (errorEl) {
        errorEl.textContent = brand.activationPrefixError;
        errorEl.style.display = "block";
      }
      input.focus();
      return;
    }
    if (errorEl) errorEl.style.display = "none";
    onActivate(value);
  };

  const handleInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const form = input.closest("form");
    const errorEl = form?.querySelector(".license-prefix-error") as HTMLElement | null;
    if (prefix && errorEl && input.value.toLowerCase().startsWith(prefix)) {
      errorEl.style.display = "none";
    }
  };

  return html`
    <div class="license-dialog-overlay" @click=${onCancel}>
      <div class="license-dialog license-activation-dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="license-dialog-header">
          <h2>🔑 激活授权</h2>
        </div>
        <div class="license-dialog-content">
          <p>${brand.activationDialogText}</p>
          <form @submit=${handleSubmit}>
            <input
              type="text"
              class="license-input"
              placeholder="${brand.activationPlaceholder}"
              ?disabled=${loading}
              @input=${handleInput}
              autofocus
            />
            <p class="license-prefix-error license-error" style="display:none;"></p>
            ${error ? html`<p class="license-error">${error}</p>` : nothing}
            <div class="license-dialog-actions">
              <button type="button" class="license-btn license-btn-secondary" @click=${onCancel} ?disabled=${loading}>
                稍后激活
              </button>
              <button type="submit" class="license-btn license-btn-primary" ?disabled=${loading}>
                ${loading ? "验证中..." : "激活"}
              </button>
            </div>
          </form>
          ${brand.showPurchaseEntry ? html`
          <p class="license-help">
            还没有授权码？<a href="#" @click=${(e: Event) => { e.preventDefault(); void openPurchaseOrRenewUrl(null); }} style="font-size:16px;font-weight:600;">立即购买</a>
          </p>
          ` : nothing}
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染授权过期弹窗
 */
export function renderExpiredDialog(
  renewUrl: string | null,
  daysExpired: number,
  onRenew: () => void,
  onClose: () => void,
): TemplateResult {
  const handleRenew = () => {
    void openPurchaseOrRenewUrl(renewUrl);
    onRenew();
  };

  return html`
    <div class="license-dialog-overlay">
      <div class="license-dialog license-expired-dialog">
        <div class="license-dialog-header license-urgency-critical">
          <h2>🚨 授权已过期</h2>
        </div>
        <div class="license-dialog-content">
          <p>您的授权已过期 ${daysExpired > 0 ? `${daysExpired} 天` : ""}，请续费后继续使用。</p>
          <div class="license-dialog-actions">
            <button class="license-btn license-btn-secondary" @click=${onClose}>
              稍后处理
            </button>
            ${brand.showPurchaseEntry ? html`
            <button class="license-btn license-btn-primary" @click=${handleRenew}>
              立即续费
            </button>
            ` : nothing}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染续费提醒弹窗
 */
export function renderRenewalReminderDialog(
  reminder: RenewalReminder,
  onRenew: () => void,
  onDismiss: () => void,
): TemplateResult {
  const urgencyClass = getUrgencyClass(reminder.urgency);
  const urgencyIcon = getUrgencyIcon(reminder.urgency);

  const handleRenew = () => {
    void openPurchaseOrRenewUrl(reminder.renewUrl);
    onRenew();
  };

  return html`
    <div class="license-dialog-overlay" @click=${onDismiss}>
      <div class="license-dialog license-renewal-dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="license-dialog-header ${urgencyClass}">
          <h2>${urgencyIcon} ${reminder.title || "授权即将到期"}</h2>
        </div>
        <div class="license-dialog-content">
          <p>${reminder.message || `您的授权将在 ${reminder.daysRemaining} 天后到期，请及时续费。`}</p>
          <p class="license-days-remaining">
            剩余天数: <strong>${reminder.daysRemaining}</strong> 天
          </p>
          <div class="license-dialog-actions">
            <button class="license-btn license-btn-secondary" @click=${onDismiss}>
              稍后提醒
            </button>
            ${brand.showPurchaseEntry ? html`
            <button class="license-btn license-btn-primary" @click=${handleRenew}>
              立即续费
            </button>
            ` : nothing}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染通知弹窗
 */
export function renderNotificationDialog(
  notification: LicenseNotification,
  onAction: () => void,
  onDismiss: () => void,
): TemplateResult {
  const handleAction = () => {
    if (notification.action?.type === "url" && notification.action.url) {
      window.open(notification.action.url, "_blank");
    }
    onAction();
  };

  return html`
    <div class="license-dialog-overlay" @click=${onDismiss}>
      <div class="license-dialog license-notification-dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="license-dialog-header">
          <h2>${notification.title}</h2>
        </div>
        <div class="license-dialog-content">
          <div class="license-notification-content">
            ${notification.content.split("\n").map((line) => html`<p>${line}</p>`)}
          </div>
          <div class="license-dialog-actions">
            <button class="license-btn license-btn-secondary" @click=${onDismiss}>
              ${notification.action ? "稍后再说" : "关闭"}
            </button>
            ${notification.action
              ? html`
                  <button class="license-btn license-btn-primary" @click=${handleAction}>
                    ${notification.action.text || "了解更多"}
                  </button>
                `
              : nothing}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染强制更新弹窗
 */
export function renderForceUpdateDialog(
  update: ForceUpdateInfo,
  currentVersion: string,
  onUpdate: () => void,
): TemplateResult {
  const handleUpdate = () => {
    if (update.downloadUrl) {
      window.open(update.downloadUrl, "_blank");
    }
    onUpdate();
  };

  return html`
    <div class="license-dialog-overlay">
      <div class="license-dialog license-force-update-dialog">
        <div class="license-dialog-header license-urgency-critical">
          <h2>🔄 需要更新</h2>
        </div>
        <div class="license-dialog-content">
          <p>${update.updateMessage || "发现新版本，请更新后继续使用。"}</p>
          <div class="license-version-info">
            <p>当前版本: <code>${currentVersion}</code></p>
            <p>最低要求: <code>${update.minVersion}</code></p>
            <p>最新版本: <code>${update.latestVersion}</code></p>
          </div>
          <div class="license-dialog-actions">
            ${!update.blocking
              ? html`
                  <button class="license-btn license-btn-secondary" @click=${() => {}}>
                    稍后更新
                  </button>
                `
              : nothing}
            <button class="license-btn license-btn-primary" @click=${handleUpdate}>
              立即下载
            </button>
          </div>
          ${update.blocking
            ? html`<p class="license-warning">此更新为强制更新，必须更新后才能继续使用。</p>`
            : nothing}
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染设备超限弹窗
 */
export function renderDeviceLimitDialog(
  devices: BoundDevice[],
  deviceLimit: number,
  onUnbind: (deviceId: string) => void,
  onClose: () => void,
  loading: boolean = false,
): TemplateResult {
  return html`
    <div class="license-dialog-overlay" @click=${onClose}>
      <div class="license-dialog license-device-dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="license-dialog-header license-urgency-warning">
          <h2>⚠️ 设备数超限</h2>
        </div>
        <div class="license-dialog-content">
          <p>您的授权码最多可绑定 <strong>${deviceLimit}</strong> 台设备，请解绑其他设备后再试。</p>
          <div class="license-device-list">
            ${devices.map(
              (device) => html`
                <div class="license-device-item ${device.isCurrent ? "current" : ""}">
                  <div class="license-device-info">
                    <span class="license-device-name">${device.deviceName}</span>
                    <span class="license-device-os">${device.osInfo}</span>
                    <span class="license-device-time">最后活跃: ${formatTime(device.lastActiveAt)}</span>
                  </div>
                  ${device.isCurrent
                    ? html`<span class="license-device-badge">当前设备</span>`
                    : html`
                        <button
                          class="license-btn license-btn-danger license-btn-small"
                          @click=${() => onUnbind(device.deviceId)}
                          ?disabled=${loading}
                        >
                          解绑
                        </button>
                      `}
                </div>
              `,
            )}
          </div>
          <div class="license-dialog-actions">
            <button class="license-btn license-btn-secondary" @click=${onClose}>
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染设备切换确认弹窗（单设备模式：errorCode=1010）
 */
export function renderDeviceSwitchDialog(
  switchInfo: DeviceSwitchInfo,
  onConfirm: () => void,
  onCancel: () => void,
  loading: boolean = false,
): TemplateResult {
  return html`
    <div class="license-dialog-overlay" @click=${onCancel}>
      <div class="license-dialog license-device-switch-dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="license-dialog-header license-urgency-warning">
          <h2>⚠️ 确认切换设备？</h2>
        </div>
        <div class="license-dialog-content">
          <p>检测到您已在「<strong>${switchInfo.existingDeviceName}</strong>」上使用此密钥。</p>
          
          <div class="license-switch-info">
            <p>继续操作将：</p>
            <ul>
              <li>在当前设备激活此密钥</li>
              <li>「${switchInfo.existingDeviceName}」将自动退出登录</li>
            </ul>
          </div>

          <p class="license-warning">
            ⚠️ 切换后 24 小时内无法再次切换设备
          </p>

          <div class="license-dialog-actions">
            <button 
              class="license-btn license-btn-secondary" 
              @click=${onCancel}
              ?disabled=${loading}
            >
              取消
            </button>
            <button 
              class="license-btn license-btn-primary" 
              @click=${onConfirm}
              ?disabled=${loading}
            >
              ${loading ? "切换中..." : "确认切换"}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染设备切换冷却期弹窗（单设备模式：errorCode=1011）
 */
export function renderDeviceSwitchCooldownDialog(
  cooldownInfo: DeviceSwitchCooldownInfo,
  onClose: () => void,
): TemplateResult {
  // 格式化冷却剩余时间
  const hours = cooldownInfo.cooldownRemainingHours;
  const remainingText = hours >= 1
    ? `${Math.ceil(hours)} 小时`
    : `${Math.ceil(hours * 60)} 分钟`;

  // 格式化可切换时间
  const cooldownEndsAt = formatTime(cooldownInfo.cooldownEndsAt);

  return html`
    <div class="license-dialog-overlay" @click=${onClose}>
      <div class="license-dialog license-cooldown-dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="license-dialog-header license-urgency-info">
          <h2>⏳ 无法切换设备</h2>
        </div>
        <div class="license-dialog-content">
          <p>设备切换需间隔 24 小时</p>
          
          <div class="license-cooldown-info">
            <p>距离下次可切换还有：<strong>${remainingText}</strong></p>
            <p>预计可切换时间：<strong>${cooldownEndsAt}</strong></p>
          </div>

          <div class="license-dialog-actions">
            <button class="license-btn license-btn-primary" @click=${onClose}>
              知道了
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染被踢出提示弹窗（旧设备打开时显示）
 */
export function renderDeviceKickedDialog(
  onReactivate: () => void,
): TemplateResult {
  return html`
    <div class="license-dialog-overlay">
      <div class="license-dialog license-kicked-dialog">
        <div class="license-dialog-header license-urgency-info">
          <h2>📱 已在其他设备登录</h2>
        </div>
        <div class="license-dialog-content">
          <p>您的授权码已在其他设备上登录使用</p>
          <p>如需在此设备使用，请重新输入授权码</p>

          <div class="license-dialog-actions">
            <button class="license-btn license-btn-primary" @click=${onReactivate}>
              重新激活
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染离线模式提示条
 */
export function renderOfflineBanner(
  remainingHours: number,
  onDismiss: () => void,
): TemplateResult {
  return html`
    <div class="license-offline-banner">
      <span class="license-offline-icon">📡</span>
      <span class="license-offline-text">
        离线模式运行中，剩余 ${remainingHours.toFixed(1)} 小时。请尽快连接网络以继续使用。
      </span>
      <button class="license-offline-dismiss" @click=${onDismiss}>×</button>
    </div>
  `;
}

/**
 * 渲染升级成功弹窗
 */
export function renderUpgradeSuccessDialog(
  result: UpgradeResult,
  onClose: () => void,
): TemplateResult {
  const isAddon = result.upgradeType === "addon";
  const title = isAddon ? "扩展包激活成功" : "升级成功";
  const icon = isAddon ? "📦" : "🎉";

  return html`
    <div class="license-dialog-overlay" @click=${onClose}>
      <div class="license-dialog license-upgrade-success-dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="license-dialog-header" style="background: linear-gradient(135deg, #4CAF50, #45a049);">
          <h2>${icon} ${title}</h2>
        </div>
        <div class="license-dialog-content">
          <p>${result.message || (isAddon ? "扩展包已激活" : `已从${result.fromTier || "基础版"}升级为${result.toTier || "高级版"}`)}</p>
          ${result.license ? html`
            <div class="license-upgrade-info">
              <p>当前版本: <strong>${result.license.tierName}</strong></p>
              <p>到期时间: <strong>${formatTime(result.license.expiresAt)}</strong></p>
            </div>
          ` : nothing}
          <div class="license-dialog-actions">
            <button class="license-btn license-btn-primary" @click=${onClose}>
              知道了
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染升级失败弹窗
 */
export function renderUpgradeErrorDialog(
  result: UpgradeResult,
  onClose: () => void,
  onRetry?: () => void,
): TemplateResult {
  // 根据错误码生成具体提示
  let errorDetail = result.error || "升级失败，请稍后重试";
  if (result.errorCode === LicenseUpgradeErrorCode.ERROR_UPGRADE_KEY_EXPIRED && result.expiredAt) {
    errorDetail = `该激活码已于 ${formatTime(result.expiredAt)} 过期`;
  }

  return html`
    <div class="license-dialog-overlay" @click=${onClose}>
      <div class="license-dialog license-upgrade-error-dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="license-dialog-header license-urgency-warning">
          <h2>⚠️ 升级失败</h2>
        </div>
        <div class="license-dialog-content">
          <p>${errorDetail}</p>
          <div class="license-dialog-actions">
            <button class="license-btn license-btn-secondary" @click=${onClose}>
              关闭
            </button>
            ${onRetry ? html`
              <button class="license-btn license-btn-primary" @click=${onRetry}>
                重新输入
              </button>
            ` : nothing}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 格式化时间
 */
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

/**
 * Feature Gate UI Component
 * 功能门控组件 - 根据 features 列表控制功能可见性
 *
 * 用法：
 *   renderFeatureGate("advanced_model", state.licenseState, modelSelectorContent)
 *
 * 有权限时渲染正常内容，无权限时渲染"升级解锁"遮罩。
 * 具体哪些 UI 元素需要门控，取决于 pro 版新增了哪些功能的 UI 入口。
 * 此组件提供框架，后续渐进接入。
 */

import { html, nothing, type TemplateResult } from "lit";
import type { LicenseUiState, UpgradeAvailableInfo } from "./types.js";

/**
 * 检查当前 License 是否包含指定功能
 */
export function hasFeature(state: LicenseUiState, featureCode: string): boolean {
  if (!state.license) return false;
  const features = state.license.features;
  if (features.includes("*")) return true;
  return features.includes(featureCode);
}

/**
 * 渲染功能门控包装器
 *
 * @param featureCode - 需要检查的功能码
 * @param state - 当前 License UI 状态
 * @param content - 有权限时渲染的内容
 * @param onUpgrade - 点击升级按钮的回调（可选）
 */
export function renderFeatureGate(
  featureCode: string,
  state: LicenseUiState,
  content: TemplateResult,
  onUpgrade?: () => void,
): TemplateResult {
  if (hasFeature(state, featureCode)) {
    return content;
  }

  const upgrade = state.license?.upgradeAvailable;

  return html`
    <div class="feature-gate">
      <div class="feature-gate__content feature-gate__content--locked">
        ${content}
      </div>
      <div class="feature-gate__overlay">
        <div class="feature-gate__lock-info">
          <span class="feature-gate__lock-icon">🔒</span>
          <span class="feature-gate__lock-text">
            ${upgrade
              ? `升级到${upgrade.targetTierName}解锁此功能`
              : "此功能需要更高版本"}
          </span>
          ${upgrade && onUpgrade ? html`
            <button class="feature-gate__upgrade-btn" @click=${onUpgrade}>
              升级 ¥${upgrade.upgradePrice}
            </button>
          ` : nothing}
        </div>
      </div>
    </div>
  `;
}

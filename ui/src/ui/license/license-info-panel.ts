/**
 * License Info Panel - 我的授权面板
 * 侧栏底部常驻小卡片，展示版本信息、扩展包、升级入口
 */

import { html, nothing, type TemplateResult } from "lit";
import type { LicenseUiState, AddonInfo } from "./types.js";

/**
 * 渲染侧栏底部的授权信息小卡片
 *
 * 折叠态：显示版本名称 + 剩余天数
 * 展开态：显示详细信息、扩展包列表、升级/扩展码输入入口
 */
export function renderLicenseInfoCard(
  state: LicenseUiState,
  expanded: boolean,
  onToggle: () => void,
  onUpgradeClick: () => void,
): TemplateResult {
  if (!state.license) {
    return html`${nothing}`;
  }

  const { license } = state;
  const tierBadgeClass = license.tier === "pro" ? "license-tier--pro" : "license-tier--basic";

  return html`
    <div class="license-info-card">
      <button class="license-info-card__summary" @click=${onToggle}>
        <span class="license-info-card__tier ${tierBadgeClass}">
          ${license.tierName || getTierLabel(license.tier)}
        </span>
        <span class="license-info-card__days">
          ${license.daysRemaining > 0 ? `${license.daysRemaining}天` : "已过期"}
        </span>
        <span class="license-info-card__chevron">${expanded ? "−" : "+"}</span>
      </button>

      ${expanded ? html`
        <div class="license-info-card__detail">
          <div class="license-info-card__row">
            <span class="license-info-card__label">到期时间</span>
            <span class="license-info-card__value">${formatDate(license.expiresAt)}</span>
          </div>

          ${license.addons.length > 0 ? html`
            <div class="license-info-card__section">
              <span class="license-info-card__section-title">已激活扩展包</span>
              ${license.addons.map((addon) => renderAddonItem(addon))}
            </div>
          ` : nothing}

          ${license.upgradeAvailable ? html`
            <button class="license-info-card__upgrade-btn" @click=${onUpgradeClick}>
              升级到${license.upgradeAvailable.targetTierName}
              <span class="license-info-card__price">¥${license.upgradeAvailable.upgradePrice}</span>
            </button>
          ` : nothing}
        </div>
      ` : nothing}
    </div>
  `;
}

/**
 * 渲染单个扩展包条目
 */
function renderAddonItem(addon: AddonInfo): TemplateResult {
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(addon.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  return html`
    <div class="license-info-card__addon">
      <span class="license-info-card__addon-name">${addon.name}</span>
      <span class="license-info-card__addon-days">${daysLeft > 0 ? `${daysLeft}天` : "已过期"}</span>
    </div>
  `;
}

/**
 * 获取 tier 的中文名称
 */
function getTierLabel(tier: string): string {
  switch (tier) {
    case "pro": return "高级版";
    case "test": return "测试版";
    case "trial": return "试用版";
    case "basic":
    default: return "基础版";
  }
}

/**
 * 格式化日期
 */
function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return isoString;
  }
}

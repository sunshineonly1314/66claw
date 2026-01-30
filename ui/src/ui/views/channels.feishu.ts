/**
 * 飞书渠道 UI 视图
 * Feishu Channel UI View
 */

import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type { ChannelAccountSnapshot } from "../types";
import type { ChannelsProps, FeishuStatus } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";

// 重新导出类型以保持向后兼容
export type { FeishuStatus } from "./channels.types";

export function renderFeishuCard(params: {
  props: ChannelsProps;
  feishu?: FeishuStatus;
  feishuAccounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
}) {
  const { props, feishu, feishuAccounts } = params;
  const hasMultipleAccounts = feishuAccounts.length > 1;

  const renderAccountCard = (account: ChannelAccountSnapshot) => {
    const probe = account.probe as { tenant?: { name?: string } } | undefined;
    const tenantName = probe?.tenant?.name;
    const label = account.name || account.accountId;
    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">
            ${tenantName ? tenantName : label}
          </div>
          <div class="account-card-id">${account.accountId}</div>
        </div>
        <div class="status-list account-card-status">
          <div>
            <span class="label">${t("common.running")}</span>
            <span>${account.running ? t("common.yes") : t("common.no")}</span>
          </div>
          <div>
            <span class="label">${t("channels.configured")}</span>
            <span>${account.configured ? t("common.yes") : t("common.no")}</span>
          </div>
          <div>
            <span class="label">${t("sessions.lastActivity")}</span>
            <span>${account.lastInboundAt ? formatAgo(account.lastInboundAt) : t("common.na")}</span>
          </div>
          ${account.lastError
            ? html`
                <div class="account-card-error">
                  ${account.lastError}
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  };

  // 状态徽章
  const statusBadge = feishu?.running 
    ? html`<span class="channel-card__badge channel-card__badge--ok">${t("common.running")}</span>`
    : feishu?.configured
      ? html`<span class="channel-card__badge channel-card__badge--warn">${t("common.stopped")}</span>`
      : html`<span class="channel-card__badge">${t("channels.notConfigured")}</span>`;

  // 箭头图标
  const chevronIcon = html`<svg class="channel-card__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  return html`
    <details class="channel-card" open>
      <summary class="channel-card__header">
        <div class="channel-card__left">
          <span class="channel-card__icon">🪶</span>
          <span class="channel-card__title">${t("channels.feishu")}</span>
          <div class="channel-card__status">
            ${statusBadge}
          </div>
        </div>
        ${chevronIcon}
      </summary>
      <div class="channel-card__body">
        <div class="channel-card__desc">${t("channels.feishu.description")}</div>

        ${hasMultipleAccounts
          ? html`
              <div class="account-card-list">
                ${feishuAccounts.map((account) => renderAccountCard(account))}
              </div>
            `
          : html`
              <div class="status-list">
                <div>
                  <span class="label">${t("channels.configured")}</span>
                  <span>${feishu?.configured ? t("common.yes") : t("common.no")}</span>
                </div>
                <div>
                  <span class="label">${t("common.running")}</span>
                  <span>${feishu?.running ? t("common.yes") : t("common.no")}</span>
                </div>
                <div>
                  <span class="label">${t("channels.lastStart")}</span>
                  <span>${feishu?.lastStartAt ? formatAgo(feishu.lastStartAt) : t("common.na")}</span>
                </div>
                <div>
                  <span class="label">${t("channels.lastProbe")}</span>
                  <span>${feishu?.lastProbeAt ? formatAgo(feishu.lastProbeAt) : t("common.na")}</span>
                </div>
              </div>
            `}

        ${feishu?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${feishu.lastError}
            </div>`
          : nothing}

        ${feishu?.probe
          ? html`<div class="callout" style="margin-top: 12px;">
              ${t("channels.probe")} ${feishu.probe.ok ? t("common.success") : t("common.failed")} ·
              ${feishu.probe.status ?? ""} ${feishu.probe.error ?? ""}
              ${feishu.probe.tenant?.name ? html`<br/>${t("channels.feishu.tenant")}: ${feishu.probe.tenant.name}` : nothing}
            </div>`
          : nothing}

        <!-- 配置帮助 -->
        <details class="channel-card__help" style="margin-top: 16px;">
          <summary class="channel-card__help-title">
            📖 ${t("channels.feishu.configTitle")}
          </summary>
          <div class="channel-card__help-content">
            <p>${t("channels.feishu.configDesc")}</p>
            <ol>
              <li>登录 <a href="https://open.feishu.cn/" target="_blank" rel="noreferrer">飞书开放平台</a></li>
              <li>创建企业自建应用，开启机器人能力</li>
              <li>在「凭证与基础信息」页面获取 App ID 和 App Secret</li>
              <li>配置事件订阅，设置回调地址</li>
              <li>在下方填写凭证并保存</li>
            </ol>
            <a href="${t("channels.feishu.docsUrl")}" target="_blank" rel="noreferrer" class="btn btn--link">
              ${t("channels.feishu.docsLabel")} →
            </a>
          </div>
        </details>

        ${renderChannelConfigSection({ channelId: "feishu", props })}

        <div class="row" style="margin-top: 12px;">
          <button class="btn" @click=${() => props.onRefresh(true)}>
            ${t("channels.probe")}
          </button>
        </div>
      </div>
    </details>
  `;
}

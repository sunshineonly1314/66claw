/**
 * 钉钉渠道 UI 视图
 * DingTalk Channel UI View
 */

import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type { ChannelAccountSnapshot } from "../types";
import type { ChannelsProps, DingtalkStatus } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";

// 重新导出类型以保持向后兼容
export type { DingtalkStatus } from "./channels.types";

export function renderDingtalkCard(params: {
  props: ChannelsProps;
  dingtalk?: DingtalkStatus;
  dingtalkAccounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
}) {
  const { props, dingtalk, dingtalkAccounts } = params;
  const hasMultipleAccounts = dingtalkAccounts.length > 1;

  const renderAccountCard = (account: ChannelAccountSnapshot) => {
    const probe = account.probe as { corp?: { name?: string } } | undefined;
    const corpName = probe?.corp?.name;
    const label = account.name || account.accountId;
    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">
            ${corpName ? corpName : label}
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
  const statusBadge = dingtalk?.running 
    ? html`<span class="channel-card__badge channel-card__badge--ok">${t("common.running")}</span>`
    : dingtalk?.configured
      ? html`<span class="channel-card__badge channel-card__badge--warn">${t("common.stopped")}</span>`
      : html`<span class="channel-card__badge">${t("channels.notConfigured")}</span>`;

  // 箭头图标
  const chevronIcon = html`<svg class="channel-card__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  return html`
    <details class="channel-card" open>
      <summary class="channel-card__header">
        <div class="channel-card__left">
          <span class="channel-card__icon">📱</span>
          <span class="channel-card__title">${t("channels.dingtalk")}</span>
          <div class="channel-card__status">
            ${statusBadge}
          </div>
        </div>
        ${chevronIcon}
      </summary>
      <div class="channel-card__body">
        <div class="channel-card__desc">${t("channels.dingtalk.description")}</div>

        ${hasMultipleAccounts
          ? html`
              <div class="account-card-list">
                ${dingtalkAccounts.map((account) => renderAccountCard(account))}
              </div>
            `
          : html`
              <div class="status-list">
                <div>
                  <span class="label">${t("channels.configured")}</span>
                  <span>${dingtalk?.configured ? t("common.yes") : t("common.no")}</span>
                </div>
                <div>
                  <span class="label">${t("common.running")}</span>
                  <span>${dingtalk?.running ? t("common.yes") : t("common.no")}</span>
                </div>
                <div>
                  <span class="label">${t("channels.lastStart")}</span>
                  <span>${dingtalk?.lastStartAt ? formatAgo(dingtalk.lastStartAt) : t("common.na")}</span>
                </div>
                <div>
                  <span class="label">${t("channels.lastProbe")}</span>
                  <span>${dingtalk?.lastProbeAt ? formatAgo(dingtalk.lastProbeAt) : t("common.na")}</span>
                </div>
              </div>
            `}

        ${dingtalk?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${dingtalk.lastError}
            </div>`
          : nothing}

        ${dingtalk?.probe
          ? html`<div class="callout" style="margin-top: 12px;">
              ${t("channels.probe")} ${dingtalk.probe.ok ? t("common.success") : t("common.failed")} ·
              ${dingtalk.probe.status ?? ""} ${dingtalk.probe.error ?? ""}
              ${dingtalk.probe.corp?.name ? html`<br/>${t("channels.dingtalk.corp")}: ${dingtalk.probe.corp.name}` : nothing}
            </div>`
          : nothing}

        <!-- 配置帮助 -->
        <details class="channel-card__help" style="margin-top: 16px;">
          <summary class="channel-card__help-title">
            📖 ${t("channels.dingtalk.configTitle")}
          </summary>
          <div class="channel-card__help-content">
            <p>${t("channels.dingtalk.configDesc")}</p>
            <ol>
              <li>登录 <a href="https://open.dingtalk.com/" target="_blank" rel="noreferrer">钉钉开放平台</a></li>
              <li>创建企业内部应用，开启机器人能力</li>
              <li>在「凭证与基础信息」页面获取 AppKey 和 AppSecret</li>
              <li>配置消息接收地址（HTTP 模式）</li>
              <li>在下方填写凭证并保存</li>
            </ol>
            <a href="${t("channels.dingtalk.docsUrl")}" target="_blank" rel="noreferrer" class="btn btn--link">
              ${t("channels.dingtalk.docsLabel")} →
            </a>
          </div>
        </details>

        ${renderChannelConfigSection({ channelId: "dingtalk", props })}

        <div class="row" style="margin-top: 12px;">
          <button class="btn" @click=${() => props.onRefresh(true)}>
            ${t("channels.probe")}
          </button>
        </div>
      </div>
    </details>
  `;
}

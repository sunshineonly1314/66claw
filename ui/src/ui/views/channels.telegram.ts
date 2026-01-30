import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type { ChannelAccountSnapshot, TelegramStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";

export function renderTelegramCard(params: {
  props: ChannelsProps;
  telegram?: TelegramStatus;
  telegramAccounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
}) {
  const { props, telegram, telegramAccounts } = params;
  const hasMultipleAccounts = telegramAccounts.length > 1;

  const renderAccountCard = (account: ChannelAccountSnapshot) => {
    const probe = account.probe as { bot?: { username?: string } } | undefined;
    const botUsername = probe?.bot?.username;
    const label = account.name || account.accountId;
    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">
            ${botUsername ? `@${botUsername}` : label}
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
  const statusBadge = telegram?.running 
    ? html`<span class="channel-card__badge channel-card__badge--ok">${t("common.running")}</span>`
    : telegram?.configured
      ? html`<span class="channel-card__badge channel-card__badge--warn">${t("common.stopped")}</span>`
      : html`<span class="channel-card__badge">${t("channels.notConfigured")}</span>`;

  // 箭头图标
  const chevronIcon = html`<svg class="channel-card__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  return html`
    <details class="channel-card">
      <summary class="channel-card__header">
        <div class="channel-card__left">
          <span class="channel-card__title">Telegram</span>
          <div class="channel-card__status">
            ${statusBadge}
          </div>
        </div>
        ${chevronIcon}
      </summary>
      <div class="channel-card__body">
        <div class="channel-card__desc">${t("channels.telegram.description")}</div>

        ${hasMultipleAccounts
          ? html`
              <div class="account-card-list">
                ${telegramAccounts.map((account) => renderAccountCard(account))}
              </div>
            `
          : html`
              <div class="status-list">
                <div>
                  <span class="label">${t("channels.configured")}</span>
                  <span>${telegram?.configured ? t("common.yes") : t("common.no")}</span>
                </div>
                <div>
                  <span class="label">${t("common.running")}</span>
                  <span>${telegram?.running ? t("common.yes") : t("common.no")}</span>
                </div>
                <div>
                  <span class="label">${t("channels.telegram.mode")}</span>
                  <span>${telegram?.mode ?? t("common.na")}</span>
                </div>
                <div>
                  <span class="label">${t("channels.lastStart")}</span>
                  <span>${telegram?.lastStartAt ? formatAgo(telegram.lastStartAt) : t("common.na")}</span>
                </div>
                <div>
                  <span class="label">${t("channels.lastProbe")}</span>
                  <span>${telegram?.lastProbeAt ? formatAgo(telegram.lastProbeAt) : t("common.na")}</span>
                </div>
              </div>
            `}

        ${telegram?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${telegram.lastError}
            </div>`
          : nothing}

        ${telegram?.probe
          ? html`<div class="callout" style="margin-top: 12px;">
              ${t("channels.probe")} ${telegram.probe.ok ? t("common.success") : t("common.failed")} ·
              ${telegram.probe.status ?? ""} ${telegram.probe.error ?? ""}
            </div>`
          : nothing}

        ${renderChannelConfigSection({ channelId: "telegram", props })}

        <div class="row" style="margin-top: 12px;">
          <button class="btn" @click=${() => props.onRefresh(true)}>
            ${t("channels.probe")}
          </button>
        </div>
      </div>
    </details>
  `;
}

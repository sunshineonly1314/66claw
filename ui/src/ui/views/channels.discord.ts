import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type { DiscordStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { isUnconfiguredError, errorCalloutClass } from "./channels.shared";

export function renderDiscordCard(params: {
  props: ChannelsProps;
  discord?: DiscordStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, discord, accountCountLabel } = params;

  // 状态徽章
  const statusBadge = discord?.running
    ? html`<span class="channel-card__badge channel-card__badge--ok">
        <span class="status-dot status-dot--running"></span>
        ${t("common.running")}
      </span>`
    : discord?.configured
      ? html`<span class="channel-card__badge channel-card__badge--warn">
          <span class="status-dot status-dot--configured"></span>
          ${t("common.stopped")}
        </span>`
      : html`<span class="channel-card__badge">
          <span class="status-dot status-dot--unconfigured"></span>
          ${t("channels.notConfigured")}
        </span>`;

  // 箭头图标
  const chevronIcon = html`<svg class="channel-card__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  // 根据状态决定卡片样式类
  const cardClasses = [
    "channel-card",
    discord?.running ? "channel-card--running" : "",
    discord?.configured && !discord?.running ? "channel-card--configured" : "",
    discord?.lastError ? (isUnconfiguredError(discord.lastError) ? "channel-card--unconfigured" : "channel-card--error") : "",
  ].filter(Boolean).join(" ");

  // 自动展开：运行中 或 有真实错误
  const shouldOpen = discord?.running || (discord?.lastError != null && !isUnconfiguredError(discord.lastError));

  return html`
    <details class="${cardClasses}" ?open=${shouldOpen}>
      <summary class="channel-card__header">
        <div class="channel-card__left">
          <span class="channel-card__icon">🎮</span>
          <span class="channel-card__title">Discord</span>
          <div class="channel-card__status">
            ${statusBadge}
          </div>
        </div>
        ${chevronIcon}
      </summary>
      <div class="channel-card__body">
        <div class="channel-card__desc">${t("channels.discord.description")}</div>
        ${accountCountLabel}

        ${(discord?.configured || discord?.running)
          ? html`
            <div class="status-list">
              <div>
                <span class="label">${t("channels.configured")}</span>
                <span>${discord?.configured ? t("common.yes") : t("common.no")}</span>
              </div>
              <div>
                <span class="label">${t("common.running")}</span>
                <span>${discord?.running ? t("common.yes") : t("common.no")}</span>
              </div>
              <div>
                <span class="label">${t("channels.lastStart")}</span>
                <span>${discord?.lastStartAt ? formatAgo(discord.lastStartAt) : t("common.na")}</span>
              </div>
              <div>
                <span class="label">${t("channels.lastProbe")}</span>
                <span>${discord?.lastProbeAt ? formatAgo(discord.lastProbeAt) : t("common.na")}</span>
              </div>
            </div>
          `
          : nothing}

        ${discord?.lastError
          ? html`<div class="${errorCalloutClass(discord.lastError)}" style="margin-top: 12px;">
              ${discord.lastError}
            </div>`
          : nothing}

        ${discord?.probe
          ? html`<div class="callout" style="margin-top: 12px;">
              ${t("channels.probe")} ${discord.probe.ok ? t("common.success") : t("common.failed")} ·
              ${discord.probe.status ?? ""} ${discord.probe.error ?? ""}
            </div>`
          : nothing}

        ${renderChannelConfigSection({ channelId: "discord", props })}

        <div class="row" style="margin-top: 12px;">
          <button class="btn" @click=${() => props.onRefresh(true)}>
            ${t("channels.probe")}
          </button>
        </div>
      </div>
    </details>
  `;
}

import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type { GoogleChatStatus } from "../types";
import { renderChannelConfigSection } from "./channels.config";
import type { ChannelsProps } from "./channels.types";

export function renderGoogleChatCard(params: {
  props: ChannelsProps;
  googlechat?: GoogleChatStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, googlechat, accountCountLabel } = params;

  // 状态徽章
  const statusBadge = googlechat?.running 
    ? html`<span class="channel-card__badge channel-card__badge--ok">${t("common.running")}</span>`
    : googlechat?.configured
      ? html`<span class="channel-card__badge channel-card__badge--warn">${t("common.stopped")}</span>`
      : html`<span class="channel-card__badge">${t("channels.notConfigured")}</span>`;

  // 箭头图标
  const chevronIcon = html`<svg class="channel-card__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  return html`
    <details class="channel-card">
      <summary class="channel-card__header">
        <div class="channel-card__left">
          <span class="channel-card__title">${t("channels.googlechat.title")}</span>
          <div class="channel-card__status">
            ${statusBadge}
          </div>
        </div>
        ${chevronIcon}
      </summary>
      <div class="channel-card__body">
        <div class="channel-card__desc">${t("channels.googlechat.description")}</div>
        ${accountCountLabel}

        <div class="status-list">
          <div>
            <span class="label">${t("channels.configured")}</span>
            <span>${googlechat ? (googlechat.configured ? t("common.yes") : t("common.no")) : t("common.na")}</span>
          </div>
          <div>
            <span class="label">${t("common.running")}</span>
            <span>${googlechat ? (googlechat.running ? t("common.yes") : t("common.no")) : t("common.na")}</span>
          </div>
          <div>
            <span class="label">${t("channels.googlechat.credential")}</span>
            <span>${googlechat?.credentialSource ?? t("common.na")}</span>
          </div>
          <div>
            <span class="label">${t("channels.googlechat.audience")}</span>
            <span>
              ${googlechat?.audienceType
                ? `${googlechat.audienceType}${googlechat.audience ? ` · ${googlechat.audience}` : ""}`
                : t("common.na")}
            </span>
          </div>
          <div>
            <span class="label">${t("channels.lastStart")}</span>
            <span>${googlechat?.lastStartAt ? formatAgo(googlechat.lastStartAt) : t("common.na")}</span>
          </div>
          <div>
            <span class="label">${t("channels.lastProbe")}</span>
            <span>${googlechat?.lastProbeAt ? formatAgo(googlechat.lastProbeAt) : t("common.na")}</span>
          </div>
        </div>

        ${googlechat?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${googlechat.lastError}
            </div>`
          : nothing}

        ${googlechat?.probe
          ? html`<div class="callout" style="margin-top: 12px;">
              ${t("channels.probe")} ${googlechat.probe.ok ? t("common.success") : t("common.failed")} ·
              ${googlechat.probe.status ?? ""} ${googlechat.probe.error ?? ""}
            </div>`
          : nothing}

        ${renderChannelConfigSection({ channelId: "googlechat", props })}

        <div class="row" style="margin-top: 12px;">
          <button class="btn" @click=${() => props.onRefresh(true)}>
            ${t("channels.probe")}
          </button>
        </div>
      </div>
    </details>
  `;
}

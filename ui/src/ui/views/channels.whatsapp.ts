import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type { WhatsAppStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { formatDuration } from "./channels.shared";

export function renderWhatsAppCard(params: {
  props: ChannelsProps;
  whatsapp?: WhatsAppStatus;
  accountCountLabel: unknown;
}) {
  const { props, whatsapp } = params;

  // 状态徽章
  const statusBadge = whatsapp?.running 
    ? html`<span class="channel-card__badge channel-card__badge--ok">${t("common.running")}</span>`
    : whatsapp?.configured
      ? html`<span class="channel-card__badge channel-card__badge--warn">${t("common.stopped")}</span>`
      : html`<span class="channel-card__badge">${t("channels.notConfigured")}</span>`;

  // 箭头图标
  const chevronIcon = html`<svg class="channel-card__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  return html`
    <details class="channel-card">
      <summary class="channel-card__header">
        <div class="channel-card__left">
          <span class="channel-card__title">WhatsApp</span>
          <div class="channel-card__status">
            ${statusBadge}
          </div>
        </div>
        ${chevronIcon}
      </summary>
      <div class="channel-card__body">
        <div class="channel-card__desc">${t("channels.whatsapp.description")}</div>

        <div class="status-list">
          <div>
            <span class="label">${t("channels.configured")}</span>
            <span>${whatsapp?.configured ? t("common.yes") : t("common.no")}</span>
          </div>
          <div>
            <span class="label">${t("channels.whatsapp.linked")}</span>
            <span>${whatsapp?.linked ? t("common.yes") : t("common.no")}</span>
          </div>
          <div>
            <span class="label">${t("common.running")}</span>
            <span>${whatsapp?.running ? t("common.yes") : t("common.no")}</span>
          </div>
          <div>
            <span class="label">${t("common.connected")}</span>
            <span>${whatsapp?.connected ? t("common.yes") : t("common.no")}</span>
          </div>
          <div>
            <span class="label">${t("channels.whatsapp.lastConnect")}</span>
            <span>
              ${whatsapp?.lastConnectedAt
                ? formatAgo(whatsapp.lastConnectedAt)
                : t("common.na")}
            </span>
          </div>
          <div>
            <span class="label">${t("channels.whatsapp.lastMessage")}</span>
            <span>
              ${whatsapp?.lastMessageAt ? formatAgo(whatsapp.lastMessageAt) : t("common.na")}
            </span>
          </div>
          <div>
            <span class="label">${t("channels.whatsapp.authAge")}</span>
            <span>
              ${whatsapp?.authAgeMs != null
                ? formatDuration(whatsapp.authAgeMs)
                : t("common.na")}
            </span>
          </div>
        </div>

        ${whatsapp?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${whatsapp.lastError}
            </div>`
          : nothing}

        ${props.whatsappMessage
          ? html`<div class="callout" style="margin-top: 12px;">
              ${props.whatsappMessage}
            </div>`
          : nothing}

        ${props.whatsappQrDataUrl
          ? html`<div class="qr-wrap">
              <img src=${props.whatsappQrDataUrl} alt="WhatsApp QR" />
            </div>`
          : nothing}

        <div class="row" style="margin-top: 14px; flex-wrap: wrap;">
          <button
            class="btn primary"
            ?disabled=${props.whatsappBusy}
            @click=${() => props.onWhatsAppStart(false)}
          >
            ${props.whatsappBusy ? t("common.working") : t("channels.whatsapp.showQR")}
          </button>
          <button
            class="btn"
            ?disabled=${props.whatsappBusy}
            @click=${() => props.onWhatsAppStart(true)}
          >
            ${t("channels.whatsapp.relink")}
          </button>
          <button
            class="btn"
            ?disabled=${props.whatsappBusy}
            @click=${() => props.onWhatsAppWait()}
          >
            ${t("channels.whatsapp.waitForScan")}
          </button>
          <button
            class="btn danger"
            ?disabled=${props.whatsappBusy}
            @click=${() => props.onWhatsAppLogout()}
          >
            ${t("channels.whatsapp.logout")}
          </button>
          <button class="btn" @click=${() => props.onRefresh(true)}>
            ${t("common.refresh")}
          </button>
        </div>

        ${renderChannelConfigSection({ channelId: "whatsapp", props })}
      </div>
    </details>
  `;
}

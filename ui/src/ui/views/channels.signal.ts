import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type { SignalStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";

export function renderSignalCard(params: {
  props: ChannelsProps;
  signal?: SignalStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, signal, accountCountLabel } = params;

  // 状态徽章
  const statusBadge = signal?.running 
    ? html`<span class="channel-card__badge channel-card__badge--ok">${t("common.running")}</span>`
    : signal?.configured
      ? html`<span class="channel-card__badge channel-card__badge--warn">${t("common.stopped")}</span>`
      : html`<span class="channel-card__badge">${t("channels.notConfigured")}</span>`;

  // 箭头图标
  const chevronIcon = html`<svg class="channel-card__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  return html`
    <details class="channel-card">
      <summary class="channel-card__header">
        <div class="channel-card__left">
          <span class="channel-card__title">${t("channels.signal.title")}</span>
          <div class="channel-card__status">
            ${statusBadge}
          </div>
        </div>
        ${chevronIcon}
      </summary>
      <div class="channel-card__body">
        <div class="channel-card__desc">${t("channels.signal.description")}</div>
        ${accountCountLabel}

        <div class="status-list">
          <div>
            <span class="label">${t("channels.configured")}</span>
            <span>${signal?.configured ? t("common.yes") : t("common.no")}</span>
          </div>
          <div>
            <span class="label">${t("common.running")}</span>
            <span>${signal?.running ? t("common.yes") : t("common.no")}</span>
          </div>
          <div>
            <span class="label">${t("channels.signal.baseUrl")}</span>
            <span>${signal?.baseUrl ?? t("common.na")}</span>
          </div>
          <div>
            <span class="label">${t("channels.lastStart")}</span>
            <span>${signal?.lastStartAt ? formatAgo(signal.lastStartAt) : t("common.na")}</span>
          </div>
          <div>
            <span class="label">${t("channels.lastProbe")}</span>
            <span>${signal?.lastProbeAt ? formatAgo(signal.lastProbeAt) : t("common.na")}</span>
          </div>
        </div>

        ${signal?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${signal.lastError}
            </div>`
          : nothing}

        ${signal?.probe
          ? html`<div class="callout" style="margin-top: 12px;">
              ${t("channels.probe")} ${signal.probe.ok ? t("common.success") : t("common.failed")} ·
              ${signal.probe.status ?? ""} ${signal.probe.error ?? ""}
            </div>`
          : nothing}

        ${renderChannelConfigSection({ channelId: "signal", props })}

        <div class="row" style="margin-top: 12px;">
          <button class="btn" @click=${() => props.onRefresh(true)}>
            ${t("channels.probe")}
          </button>
        </div>
      </div>
    </details>
  `;
}

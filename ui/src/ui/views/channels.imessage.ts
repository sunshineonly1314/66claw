import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { IMessageStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { isUnconfiguredError, errorCalloutClass } from "./channels.shared";

export function renderIMessageCard(params: {
  props: ChannelsProps;
  imessage?: IMessageStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, imessage, accountCountLabel } = params;

  // 状态徽章
  const statusBadge = imessage?.running
    ? html`<span class="channel-card__badge channel-card__badge--ok">
        <span class="status-dot status-dot--running"></span>
        Running
      </span>`
    : imessage?.configured
      ? html`<span class="channel-card__badge channel-card__badge--warn">
          <span class="status-dot status-dot--configured"></span>
          Stopped
        </span>`
      : html`<span class="channel-card__badge">
          <span class="status-dot status-dot--unconfigured"></span>
          Not configured
        </span>`;

  // 箭头图标
  const chevronIcon = html`<svg class="channel-card__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  // 根据状态决定卡片样式类
  const cardClasses = [
    "channel-card",
    imessage?.running ? "channel-card--running" : "",
    imessage?.configured && !imessage?.running ? "channel-card--configured" : "",
    imessage?.lastError ? (isUnconfiguredError(imessage.lastError) ? "channel-card--unconfigured" : "channel-card--error") : "",
  ].filter(Boolean).join(" ");

  // 自动展开：运行中 或 有真实错误
  const shouldOpen = imessage?.running || (imessage?.lastError != null && !isUnconfiguredError(imessage.lastError));

  return html`
    <details class="${cardClasses}" ?open=${shouldOpen}>
      <summary class="channel-card__header">
        <div class="channel-card__left">
          <span class="channel-card__icon">🍎</span>
          <span class="channel-card__title">iMessage</span>
          <div class="channel-card__status">
            ${statusBadge}
          </div>
        </div>
        ${chevronIcon}
      </summary>
      <div class="channel-card__body">
        <div class="channel-card__desc">macOS bridge status and channel configuration.</div>
        ${accountCountLabel}

        ${(imessage?.configured || imessage?.running)
          ? html`
            <div class="status-list">
              <div>
                <span class="label">Configured</span>
                <span>${imessage?.configured ? "Yes" : "No"}</span>
              </div>
              <div>
                <span class="label">Running</span>
                <span>${imessage?.running ? "Yes" : "No"}</span>
              </div>
              <div>
                <span class="label">Last start</span>
                <span>${imessage?.lastStartAt ? formatAgo(imessage.lastStartAt) : "n/a"}</span>
              </div>
              <div>
                <span class="label">Last probe</span>
                <span>${imessage?.lastProbeAt ? formatAgo(imessage.lastProbeAt) : "n/a"}</span>
              </div>
            </div>
          `
          : nothing}

        ${imessage?.lastError
          ? html`<div class="${errorCalloutClass(imessage.lastError)}" style="margin-top: 12px;">
              ${imessage.lastError}
            </div>`
          : nothing}

        ${imessage?.probe
          ? html`<div class="callout" style="margin-top: 12px;">
              Probe ${imessage.probe.ok ? "ok" : "failed"} ·
              ${imessage.probe.error ?? ""}
            </div>`
          : nothing}

        ${renderChannelConfigSection({ channelId: "imessage", props })}

        <div class="row" style="margin-top: 12px;">
          <button class="btn" @click=${() => props.onRefresh(true)}>
            Probe
          </button>
        </div>
      </div>
    </details>
  `;
}

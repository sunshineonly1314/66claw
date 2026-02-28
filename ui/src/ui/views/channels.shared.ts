import { html, nothing } from "lit";

import { t } from "../i18n/index.js";
import type { ChannelAccountSnapshot } from "../types";
import type { ChannelKey, ChannelsProps } from "./channels.types";

export function formatDuration(ms?: number | null) {
  if (!ms && ms !== 0) return "n/a";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  return `${hr}h`;
}

export function channelEnabled(key: ChannelKey, props: ChannelsProps) {
  const snapshot = props.snapshot;
  const channels = snapshot?.channels as Record<string, unknown> | null;
  if (!snapshot || !channels) return false;
  const channelStatus = channels[key] as Record<string, unknown> | undefined;
  const configured = typeof channelStatus?.configured === "boolean" && channelStatus.configured;
  const running = typeof channelStatus?.running === "boolean" && channelStatus.running;
  const connected = typeof channelStatus?.connected === "boolean" && channelStatus.connected;
  const accounts = snapshot.channelAccounts?.[key] ?? [];
  const accountActive = accounts.some(
    (account) => account.configured || account.running || account.connected,
  );
  return configured || running || connected || accountActive;
}

export function getChannelAccountCount(
  key: ChannelKey,
  channelAccounts?: Record<string, ChannelAccountSnapshot[]> | null,
): number {
  return channelAccounts?.[key]?.length ?? 0;
}

/**
 * 判断 lastError 是否属于「未配置/已禁用」等非真正错误的状态。
 * 这些状态应用灰色提示而非红色警告。
 */
const BENIGN_ERRORS = ["not configured", "disabled", "not linked", "logged out"];
export function isUnconfiguredError(lastError?: string | null): boolean {
  if (!lastError) return false;
  return BENIGN_ERRORS.includes(lastError.toLowerCase().trim());
}

/**
 * 根据 lastError 内容返回 callout CSS 类：
 * - 未配置/禁用 → "callout muted"
 * - 真正的错误 → "callout danger"
 */
export function errorCalloutClass(lastError?: string | null): string {
  return isUnconfiguredError(lastError) ? "callout muted" : "callout danger";
}

export function renderChannelAccountCount(
  key: ChannelKey,
  channelAccounts?: Record<string, ChannelAccountSnapshot[]> | null,
) {
  const count = getChannelAccountCount(key, channelAccounts);
  if (count < 2) return nothing;
  return html`<div class="account-count">${t("channel.accounts")} (${count})</div>`;
}

/**
 * Renders the channel-to-project route binding selector.
 * Placed at the bottom of each channel card body.
 *
 * When a channel has multiple accounts (e.g. 3 feishu bots), renders one
 * dropdown per account so each bot can be independently routed to a project.
 * When there's 0 or 1 account, renders a single dropdown for the channel.
 */
export function renderChannelRouteSection(params: {
  channelId: string;
  props: ChannelsProps;
  accounts?: ChannelAccountSnapshot[];
}) {
  const { channelId, props, accounts } = params;
  const routes = props.routeSummary;
  const projects = props.routeProjects;

  // Don't render if route data hasn't loaded yet
  if (!routes || !projects) return nothing;
  // Don't render if no projects exist (nothing to bind to)
  if (projects.length === 0) return nothing;

  const hasMultipleAccounts = accounts && accounts.length > 1;

  if (hasMultipleAccounts) {
    // Multi-account: one dropdown per account
    return html`
      <div class="channel-route-section">
        <div class="channel-route-section__title">${t("channels.route")}</div>
        <div class="channel-route-section__desc">${t("channels.route.desc") ?? ""}</div>
        ${accounts.map((account) => {
          const accountId = account.accountId;
          const label = account.name || accountId;
          const currentRoute = routes.find(
            (r) => r.channel === channelId && r.accountId === accountId,
          );
          const currentProjectId = currentRoute?.targetId ?? "";

          const handleChange = (e: Event) => {
            const select = e.target as HTMLSelectElement;
            props.onRouteChange(channelId, accountId, select.value || null);
          };

          return html`
            <div class="channel-route-section__row">
              <label class="channel-route-section__label">${label}</label>
              <select
                class="channel-route-section__select"
                .value=${currentProjectId}
                ?disabled=${props.routeSaving}
                @change=${handleChange}
              >
                <option value="">${t("channels.route.none")}</option>
                <optgroup label="${t("channels.route.projects")}">
                  ${projects.map(
                    (p) => html`
                      <option value=${p.projectId} ?selected=${p.projectId === currentProjectId}>
                        ${p.name}
                      </option>
                    `,
                  )}
                </optgroup>
              </select>
            </div>
          `;
        })}
      </div>
    `;
  }

  // Single account or no accounts: one dropdown for the whole channel
  const currentRoute = routes.find(
    (r) => r.channel === channelId && !r.accountId,
  );
  const currentProjectId = currentRoute?.targetId ?? "";

  const handleChange = (e: Event) => {
    const select = e.target as HTMLSelectElement;
    props.onRouteChange(channelId, undefined, select.value || null);
  };

  return html`
    <div class="channel-route-section">
      <div class="channel-route-section__title">${t("channels.route")}</div>
      <div class="channel-route-section__desc">${t("channels.route.desc") ?? ""}</div>
      <div class="channel-route-section__row">
        <label class="channel-route-section__label">${t("channels.route.target")}</label>
        <select
          class="channel-route-section__select"
          .value=${currentProjectId}
          ?disabled=${props.routeSaving}
          @change=${handleChange}
        >
          <option value="">${t("channels.route.none")}</option>
          <optgroup label="${t("channels.route.projects")}">
            ${projects.map(
              (p) => html`
                <option value=${p.projectId} ?selected=${p.projectId === currentProjectId}>
                  ${p.name}
                </option>
              `,
            )}
          </optgroup>
        </select>
      </div>
    </div>
  `;
}

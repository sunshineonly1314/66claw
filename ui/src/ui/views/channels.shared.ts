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

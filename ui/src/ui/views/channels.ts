import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type {
  ChannelAccountSnapshot,
  ChannelUiMetaEntry,
  ChannelsStatusSnapshot,
  DiscordStatus,
  GoogleChatStatus,
  IMessageStatus,
  NostrProfile,
  NostrStatus,
  SignalStatus,
  SlackStatus,
  TelegramStatus,
  WhatsAppStatus,
} from "../types";
import type {
  ChannelKey,
  ChannelsChannelData,
  ChannelsProps,
} from "./channels.types";
import { channelEnabled, renderChannelAccountCount } from "./channels.shared";
import { renderChannelConfigSection } from "./channels.config";
import { renderDiscordCard } from "./channels.discord";
import { renderGoogleChatCard } from "./channels.googlechat";
import { renderIMessageCard } from "./channels.imessage";
import { renderNostrCard } from "./channels.nostr";
import { renderSignalCard } from "./channels.signal";
import { renderSlackCard } from "./channels.slack";
import { renderTelegramCard } from "./channels.telegram";
import { renderWhatsAppCard } from "./channels.whatsapp";
import { renderFeishuCard } from "./channels.feishu";
import { renderDingtalkCard } from "./channels.dingtalk";
import type { FeishuStatus, DingtalkStatus } from "./channels.types";

export function renderChannels(props: ChannelsProps) {
  const channels = props.snapshot?.channels as Record<string, unknown> | null;
  // 国内渠道
  const feishu = (channels?.feishu ?? undefined) as FeishuStatus | undefined;
  const dingtalk = (channels?.dingtalk ?? undefined) as DingtalkStatus | undefined;
  // 国际渠道
  const whatsapp = (channels?.whatsapp ?? undefined) as
    | WhatsAppStatus
    | undefined;
  const telegram = (channels?.telegram ?? undefined) as
    | TelegramStatus
    | undefined;
  const discord = (channels?.discord ?? null) as DiscordStatus | null;
  const googlechat = (channels?.googlechat ?? null) as GoogleChatStatus | null;
  const slack = (channels?.slack ?? null) as SlackStatus | null;
  const signal = (channels?.signal ?? null) as SignalStatus | null;
  const imessage = (channels?.imessage ?? null) as IMessageStatus | null;
  const nostr = (channels?.nostr ?? null) as NostrStatus | null;
  const channelOrder = resolveChannelOrder(props.snapshot);
  const orderedChannels = channelOrder
    .map((key, index) => ({
      key,
      enabled: channelEnabled(key, props),
      order: index,
    }))
    .sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.order - b.order;
    });

  return html`
    <section class="channels-grid">
      ${orderedChannels.map((channel) =>
        renderChannel(channel.key, props, {
          feishu,
          dingtalk,
          whatsapp,
          telegram,
          discord,
          googlechat,
          slack,
          signal,
          imessage,
          nostr,
          channelAccounts: props.snapshot?.channelAccounts ?? null,
        }),
      )}
    </section>
  `;
}

function resolveChannelOrder(snapshot: ChannelsStatusSnapshot | null): ChannelKey[] {
  if (snapshot?.channelMeta?.length) {
    return snapshot.channelMeta.map((entry) => entry.id) as ChannelKey[];
  }
  if (snapshot?.channelOrder?.length) {
    return snapshot.channelOrder;
  }
  // 默认顺序：国内常用渠道优先（飞书、钉钉），然后是国际渠道
  // 注意：企业微信暂不支持
  return [
    "feishu",      // 飞书
    "dingtalk",    // 钉钉
    "whatsapp",
    "telegram",
    "discord",
    "googlechat",
    "slack",
    "signal",
    "imessage",
    "nostr",
  ];
}

function renderChannel(
  key: ChannelKey,
  props: ChannelsProps,
  data: ChannelsChannelData,
) {
  const accountCountLabel = renderChannelAccountCount(
    key,
    data.channelAccounts,
  );
  switch (key) {
    // 国内渠道（优先显示）
    case "feishu":
      return renderFeishuCard({
        props,
        feishu: data.feishu,
        feishuAccounts: data.channelAccounts?.feishu ?? [],
        accountCountLabel,
      });
    case "dingtalk":
      return renderDingtalkCard({
        props,
        dingtalk: data.dingtalk,
        dingtalkAccounts: data.channelAccounts?.dingtalk ?? [],
        accountCountLabel,
      });
    // 国际渠道
    case "whatsapp":
      return renderWhatsAppCard({
        props,
        whatsapp: data.whatsapp,
        accountCountLabel,
      });
    case "telegram":
      return renderTelegramCard({
        props,
        telegram: data.telegram,
        telegramAccounts: data.channelAccounts?.telegram ?? [],
        accountCountLabel,
      });
    case "discord":
      return renderDiscordCard({
        props,
        discord: data.discord,
        accountCountLabel,
      });
    case "googlechat":
      return renderGoogleChatCard({
        props,
        googlechat: data.googlechat,
        accountCountLabel,
      });
    case "slack":
      return renderSlackCard({
        props,
        slack: data.slack,
        accountCountLabel,
      });
    case "signal":
      return renderSignalCard({
        props,
        signal: data.signal,
        accountCountLabel,
      });
    case "imessage":
      return renderIMessageCard({
        props,
        imessage: data.imessage,
        accountCountLabel,
      });
    case "nostr": {
      const nostrAccounts = data.channelAccounts?.nostr ?? [];
      const primaryAccount = nostrAccounts[0];
      const accountId = primaryAccount?.accountId ?? "default";
      const profile =
        (primaryAccount as { profile?: NostrProfile | null } | undefined)?.profile ?? null;
      const showForm =
        props.nostrProfileAccountId === accountId ? props.nostrProfileFormState : null;
      const profileFormCallbacks = showForm
        ? {
            onFieldChange: props.onNostrProfileFieldChange,
            onSave: props.onNostrProfileSave,
            onImport: props.onNostrProfileImport,
            onCancel: props.onNostrProfileCancel,
            onToggleAdvanced: props.onNostrProfileToggleAdvanced,
          }
        : null;
      return renderNostrCard({
        props,
        nostr: data.nostr,
        nostrAccounts,
        accountCountLabel,
        profileFormState: showForm,
        profileFormCallbacks,
        onEditProfile: () => props.onNostrProfileEdit(accountId, profile),
      });
    }
    default:
      return renderGenericChannelCard(key, props, data.channelAccounts ?? {});
  }
}

// 渠道中文名称映射
const CHANNEL_LABELS: Record<string, string> = {
  feishu: "飞书",
  dingtalk: "钉钉",
  // wecom: "企业微信",  // 暂不支持
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  discord: "Discord",
  googlechat: "Google Chat",
  slack: "Slack",
  signal: "Signal",
  imessage: "iMessage",
  nostr: "Nostr",
};

// 渠道描述映射（中文）
const CHANNEL_DESCRIPTIONS: Record<string, string> = {
  feishu: "飞书机器人状态和配置。适用于企业内部沟通和协作。",
  dingtalk: "钉钉机器人状态和配置。适用于企业办公和团队协作。",
  // wecom: "企业微信机器人状态和配置。适用于企业内部通讯。",  // 暂不支持
  whatsapp: "WhatsApp Web 连接状态和配置。",
  telegram: "Telegram 机器人状态和配置。",
  discord: "Discord 机器人状态和配置。",
  googlechat: "Google Chat API webhook 状态和配置。",
  slack: "Slack 应用状态和配置。",
  signal: "Signal 消息状态和配置。",
  imessage: "iMessage 状态和配置（仅限 macOS）。",
  nostr: "Nostr 协议状态和配置。",
};

// 默认展开的渠道列表（国内常用渠道）
const DEFAULT_OPEN_CHANNELS = new Set(["feishu", "dingtalk"]);

function renderGenericChannelCard(
  key: ChannelKey,
  props: ChannelsProps,
  channelAccounts: Record<string, ChannelAccountSnapshot[]>,
) {
  // 优先使用中文标签，否则从后端获取，最后使用 key 本身
  const label = CHANNEL_LABELS[key] ?? resolveChannelLabel(props.snapshot, key);
  const status = props.snapshot?.channels?.[key] as Record<string, unknown> | undefined;
  const configured = typeof status?.configured === "boolean" ? status.configured : undefined;
  const running = typeof status?.running === "boolean" ? status.running : undefined;
  const connected = typeof status?.connected === "boolean" ? status.connected : undefined;
  const lastError = typeof status?.lastError === "string" ? status.lastError : undefined;
  const accounts = channelAccounts[key] ?? [];
  const description = CHANNEL_DESCRIPTIONS[key] ?? t("channels.configured");

  // 状态徽章
  const statusBadge = running 
    ? html`<span class="channel-card__badge channel-card__badge--ok">${t("common.running")}</span>`
    : configured
      ? html`<span class="channel-card__badge channel-card__badge--warn">${t("common.stopped")}</span>`
      : html`<span class="channel-card__badge">${t("channels.notConfigured")}</span>`;

  // 箭头图标
  const chevronIcon = html`<svg class="channel-card__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  // 飞书和钉钉默认展开，其他渠道默认折叠
  const isDefaultOpen = DEFAULT_OPEN_CHANNELS.has(key);

  return html`
    <details class="channel-card" ?open=${isDefaultOpen}>
      <summary class="channel-card__header">
        <div class="channel-card__left">
          <span class="channel-card__title">${label}</span>
          <div class="channel-card__status">
            ${statusBadge}
          </div>
        </div>
        ${chevronIcon}
      </summary>
      <div class="channel-card__body">
        <div class="channel-card__desc">${description}</div>
        
        ${accounts.length > 0
          ? html`
              <div class="account-card-list">
                ${accounts.map((account) => renderGenericAccount(account))}
              </div>
            `
          : html`
              <div class="status-list">
                <div>
                  <span class="label">${t("channels.configured")}</span>
                  <span>${configured == null ? t("common.na") : configured ? t("common.yes") : t("common.no")}</span>
                </div>
                <div>
                  <span class="label">${t("common.running")}</span>
                  <span>${running == null ? t("common.na") : running ? t("common.yes") : t("common.no")}</span>
                </div>
                <div>
                  <span class="label">${t("common.connected")}</span>
                  <span>${connected == null ? t("common.na") : connected ? t("common.yes") : t("common.no")}</span>
                </div>
              </div>
            `}

        ${lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${lastError}
            </div>`
          : nothing}

        ${renderChannelConfigSection({ channelId: key, props })}
      </div>
    </details>
  `;
}

function resolveChannelMetaMap(
  snapshot: ChannelsStatusSnapshot | null,
): Record<string, ChannelUiMetaEntry> {
  if (!snapshot?.channelMeta?.length) return {};
  return Object.fromEntries(snapshot.channelMeta.map((entry) => [entry.id, entry]));
}

function resolveChannelLabel(
  snapshot: ChannelsStatusSnapshot | null,
  key: string,
): string {
  const meta = resolveChannelMetaMap(snapshot)[key];
  return meta?.label ?? snapshot?.channelLabels?.[key] ?? key;
}

const RECENT_ACTIVITY_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

function hasRecentActivity(account: ChannelAccountSnapshot): boolean {
  if (!account.lastInboundAt) return false;
  return Date.now() - account.lastInboundAt < RECENT_ACTIVITY_THRESHOLD_MS;
}

function deriveRunningStatus(account: ChannelAccountSnapshot): "Yes" | "No" | "Active" {
  if (account.running) return "Yes";
  // If we have recent inbound activity, the channel is effectively running
  if (hasRecentActivity(account)) return "Active";
  return "No";
}

function deriveConnectedStatus(account: ChannelAccountSnapshot): "Yes" | "No" | "Active" | "n/a" {
  if (account.connected === true) return "Yes";
  if (account.connected === false) return "No";
  // If connected is null/undefined but we have recent activity, show as active
  if (hasRecentActivity(account)) return "Active";
  return "n/a";
}

function renderGenericAccount(account: ChannelAccountSnapshot) {
  const runningStatus = deriveRunningStatus(account);
  const connectedStatus = deriveConnectedStatus(account);
  // 状态值本地化
  const runningLabel = runningStatus === "Yes" ? t("common.yes") 
    : runningStatus === "No" ? t("common.no") 
    : runningStatus === "Active" ? t("nodes.active") : runningStatus;
  const connectedLabel = connectedStatus === "Yes" ? t("common.yes")
    : connectedStatus === "No" ? t("common.no")
    : connectedStatus === "Active" ? t("nodes.active")
    : t("common.na");

  return html`
    <div class="account-card">
      <div class="account-card-header">
        <div class="account-card-title">${account.name || account.accountId}</div>
        <div class="account-card-id">${account.accountId}</div>
      </div>
      <div class="status-list account-card-status">
        <div>
          <span class="label">${t("common.running")}</span>
          <span>${runningLabel}</span>
        </div>
        <div>
          <span class="label">${t("channels.configured")}</span>
          <span>${account.configured ? t("common.yes") : t("common.no")}</span>
        </div>
        <div>
          <span class="label">${t("common.connected")}</span>
          <span>${connectedLabel}</span>
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
}

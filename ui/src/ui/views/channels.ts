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
import { renderWecomCard } from "./channels.wecom";
import { renderQqbotCard } from "./channels.qq";
import type { FeishuStatus, DingtalkStatus, WecomStatus, QqbotStatus } from "./channels.types";

// 所有支持的渠道列表（始终显示，不管后端是否返回）
const ALL_SUPPORTED_CHANNELS: ChannelKey[] = [
  "feishu",      // 飞书
  "dingtalk",    // 钉钉
  "wecom",       // 企业微信
  "qqbot",       // QQ 机器人
  "whatsapp",
  "telegram",
  "discord",
  "googlechat",
  "slack",
  "signal",
  "imessage",
  "nostr",
];

// 渠道状态概览
function renderChannelOverview(props: ChannelsProps, data: ChannelsChannelData) {
  const channels = props.snapshot?.channels as Record<string, unknown> | null;
  
  // 统计各状态渠道数量
  let configuredCount = 0;
  let runningCount = 0;
  let errorCount = 0;
  
  for (const key of ALL_SUPPORTED_CHANNELS) {
    const status = channels?.[key] as { configured?: boolean; running?: boolean; lastError?: string } | undefined;
    if (status?.configured) configuredCount++;
    if (status?.running) runningCount++;
    if (status?.lastError) errorCount++;
  }
  
  const totalChannels = ALL_SUPPORTED_CHANNELS.length;
  
  return html`
    <div class="channel-overview">
      <div class="channel-overview__cards">
        <div class="overview-card overview-card--primary">
          <div class="overview-card__icon">📡</div>
          <div class="overview-card__content">
            <div class="overview-card__value">${runningCount}</div>
            <div class="overview-card__label">运行中</div>
          </div>
          <div class="overview-card__indicator ${runningCount > 0 ? 'indicator--ok' : 'indicator--muted'}"></div>
        </div>
        
        <div class="overview-card">
          <div class="overview-card__icon">⚙️</div>
          <div class="overview-card__content">
            <div class="overview-card__value">${configuredCount}</div>
            <div class="overview-card__label">已配置</div>
          </div>
        </div>
        
        <div class="overview-card">
          <div class="overview-card__icon">📊</div>
          <div class="overview-card__content">
            <div class="overview-card__value">${totalChannels}</div>
            <div class="overview-card__label">支持渠道</div>
          </div>
        </div>
        
        ${errorCount > 0 ? html`
          <div class="overview-card overview-card--danger">
            <div class="overview-card__icon">⚠️</div>
            <div class="overview-card__content">
              <div class="overview-card__value">${errorCount}</div>
              <div class="overview-card__label">有错误</div>
            </div>
          </div>
        ` : nothing}
      </div>
      
      ${configuredCount === 0 ? html`
        <div class="channel-overview__guide">
          <div class="guide-content">
            <span class="guide-icon">🚀</span>
            <div class="guide-text">
              <strong>开始配置你的第一个渠道</strong>
              <p>选择下方的飞书、钉钉或企业微信，按照配置指南完成设置，即可开始与 AI 助手对话。</p>
            </div>
          </div>
        </div>
      ` : nothing}
    </div>
  `;
}

export function renderChannels(props: ChannelsProps) {
  const channels = props.snapshot?.channels as Record<string, unknown> | null;
  // 国内渠道
  const feishu = (channels?.feishu ?? undefined) as FeishuStatus | undefined;
  const dingtalk = (channels?.dingtalk ?? undefined) as DingtalkStatus | undefined;
  const wecom = (channels?.wecom ?? undefined) as WecomStatus | undefined;
  const qqbot = (channels?.qqbot ?? undefined) as QqbotStatus | undefined;
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

  // 国内渠道
  const domesticChannels = orderedChannels.filter(c => DOMESTIC_CHANNELS.has(c.key));
  // 国际渠道
  const internationalChannels = orderedChannels.filter(c => !DOMESTIC_CHANNELS.has(c.key));

  const channelData = {
    feishu,
    dingtalk,
    wecom,
    qqbot,
    whatsapp,
    telegram,
    discord,
    googlechat,
    slack,
    signal,
    imessage,
    nostr,
    channelAccounts: props.snapshot?.channelAccounts ?? null,
  };

  return html`
    <!-- 渠道状态概览 -->
    ${renderChannelOverview(props, channelData)}

    <!-- 国内渠道 -->
    ${domesticChannels.length > 0 ? html`
      <div class="channel-group">
        <div class="channel-group__header">
          <span class="channel-group__icon">🇨🇳</span>
          <span class="channel-group__title">国内渠道</span>
          <span class="channel-group__badge">${t("channels.help.domestic")}</span>
        </div>
        <div class="channel-group__tip">
          <span class="tip-icon">💡</span>
          <span>飞书、钉钉、企业微信 - 无需翻墙，Stream/长连接模式无需公网 IP</span>
        </div>
        <section class="channels-grid">
          ${domesticChannels.map((channel) =>
            renderChannel(channel.key, props, channelData),
          )}
        </section>
      </div>
    ` : nothing}

    <!-- 国际渠道 -->
    ${internationalChannels.length > 0 ? html`
      <div class="channel-group">
        <div class="channel-group__header">
          <span class="channel-group__icon">🌐</span>
          <span class="channel-group__title">国际渠道</span>
          <span class="channel-group__badge">${t("channels.help.international")}</span>
        </div>
        <div class="channel-group__tip">
          <span class="tip-icon">💡</span>
          <span>WhatsApp、Telegram、Discord 等 - 国际主流平台，部分需要网络代理</span>
        </div>
        <section class="channels-grid">
          ${internationalChannels.map((channel) =>
            renderChannel(channel.key, props, channelData),
          )}
        </section>
      </div>
    ` : nothing}
  `;
}

function resolveChannelOrder(snapshot: ChannelsStatusSnapshot | null): ChannelKey[] {
  // 获取后端返回的渠道顺序
  let backendOrder: string[] = [];
  if (snapshot?.channelMeta?.length) {
    backendOrder = snapshot.channelMeta.map((entry) => entry.id);
  } else if (snapshot?.channelOrder?.length) {
    backendOrder = snapshot.channelOrder;
  }
  
  // 合并后端返回的渠道和所有支持的渠道，确保所有渠道都显示
  // 后端返回的渠道优先（保持其顺序），然后是默认列表中的其他渠道
  const seen = new Set<string>(backendOrder);
  const result: ChannelKey[] = [...backendOrder] as ChannelKey[];
  
  for (const key of ALL_SUPPORTED_CHANNELS) {
    if (!seen.has(key)) {
      result.push(key);
      seen.add(key);
    }
  }
  
  return result;
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
    case "wecom":
      return renderWecomCard({
        props,
        wecom: data.wecom,
        wecomAccounts: data.channelAccounts?.wecom ?? [],
        accountCountLabel,
      });
    case "qqbot":
      return renderQqbotCard({
        props,
        qqbot: data.qqbot,
        qqbotAccounts: data.channelAccounts?.qqbot ?? [],
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
  wecom: "企业微信",
  qqbot: "QQ",
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
  wecom: "企业微信机器人状态和配置。适用于企业内部通讯。",
  qqbot: "QQ 机器人状态和配置。支持 QQ 开放平台官方机器人。",
  whatsapp: "WhatsApp Web 连接状态和配置。",
  telegram: "Telegram 机器人状态和配置。",
  discord: "Discord 机器人状态和配置。",
  googlechat: "Google Chat API webhook 状态和配置。",
  slack: "Slack 应用状态和配置。",
  signal: "Signal 消息状态和配置。",
  imessage: "iMessage 状态和配置（仅限 macOS）。",
  nostr: "Nostr 协议状态和配置。",
};

// 国内渠道列表
const DOMESTIC_CHANNELS = new Set(["feishu", "dingtalk", "wecom", "qqbot"]);

// 默认展开的渠道列表（国内常用渠道）
const DEFAULT_OPEN_CHANNELS = new Set(["feishu", "dingtalk", "wecom"]);

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

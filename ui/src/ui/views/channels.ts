import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type {
  ChannelAccountSnapshot,
  ChannelUiMetaEntry,
  ChannelsStatusSnapshot,
} from "../types";
import type {
  ChannelKey,
  ChannelsProps,
} from "./channels.types";
import { CHANNEL_LABELS } from "./channels.types";
import { channelEnabled, isUnconfiguredError, renderChannelRouteSection } from "./channels.shared";
import { renderChannelWizard } from "./channels.wizard";

// ── Channel registry ────────────────────────────────────────────────────────

export const ALL_SUPPORTED_CHANNELS: ChannelKey[] = [
  "feishu", "dingtalk", "wecom", "qqbot", "openclawwechat",
  "whatsapp", "telegram", "discord", "googlechat", "slack",
  "signal", "imessage", "nostr",
];

export const DOMESTIC_CHANNELS = new Set([
  "feishu", "dingtalk", "wecom", "qqbot", "openclawwechat",
]);

// Re-export from types to preserve existing import paths
export { CHANNEL_LABELS } from "./channels.types";

// 渠道描述映射
const CHANNEL_DESCRIPTIONS: Record<string, string> = {
  feishu: "飞书机器人，适用于企业内部沟通和协作",
  dingtalk: "钉钉机器人，适用于企业办公和团队协作",
  wecom: "企业微信机器人，适用于企业内部通讯",
  qqbot: "QQ 机器人，支持 QQ 开放平台官方机器人",
  openclawwechat: "个人微信渠道，通过 ClawChat 桥接服务接入",
  whatsapp: "WhatsApp Web 连接",
  telegram: "Telegram 机器人",
  discord: "Discord 机器人",
  googlechat: "Google Chat API",
  slack: "Slack 应用",
  signal: "Signal 消息",
  imessage: "iMessage (仅 macOS)",
  nostr: "Nostr 去中心化协议",
};

// 渠道特性列表
const CHANNEL_FEATURES: Record<string, string[]> = {
  feishu: ["私聊消息", "群聊 @机器人", "图片/文件收发", "Markdown 卡片", "无需公网 IP", "文档读写"],
  dingtalk: ["私聊消息", "群聊 @机器人", "图片/文件收发", "Markdown 卡片", "无需公网 IP"],
  wecom: ["私聊消息", "群聊 @机器人", "图片/文件收发", "Markdown 消息"],
  qqbot: ["私聊消息", "群聊 @机器人", "图片收发", "Markdown 消息"],
  openclawwechat: ["私聊消息", "群聊", "图片/视频/文档", "无需企业认证"],
  whatsapp: ["私聊消息", "群聊", "图片/文件收发", "已读回执"],
  telegram: ["私聊消息", "群聊 @机器人", "图片/文件收发", "Markdown", "Inline 按钮", "Webhook/轮询"],
  discord: ["私聊消息", "群聊 @机器人", "图片/文件收发", "Markdown", "Reaction", "语音状态"],
  googlechat: ["私聊消息", "群聊 @机器人", "卡片消息"],
  slack: ["私聊消息", "频道消息", "图片/文件收发", "Markdown", "Slash 命令", "Thread"],
  signal: ["私聊消息", "群聊", "图片/文件收发", "端到端加密"],
  imessage: ["私聊消息", "群聊", "图片/文件收发"],
  nostr: ["私聊消息", "去中心化", "抗审查"],
};

// ── Helper functions ────────────────────────────────────────────────────────

function resolveChannelOrder(snapshot: ChannelsStatusSnapshot | null): ChannelKey[] {
  let backendOrder: string[] = [];
  if (snapshot?.channelMeta?.length) {
    backendOrder = snapshot.channelMeta.map((entry) => entry.id);
  } else if (snapshot?.channelOrder?.length) {
    backendOrder = snapshot.channelOrder;
  }
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

function getChannelStatus(key: string, props: ChannelsProps): {
  configured: boolean;
  running: boolean;
  connected: boolean;
  lastError: string | null;
} {
  const channels = props.snapshot?.channels as Record<string, unknown> | null;
  const status = channels?.[key] as Record<string, unknown> | undefined;
  return {
    configured: status?.configured === true,
    running: status?.running === true,
    connected: status?.connected === true,
    lastError: typeof status?.lastError === "string" ? status.lastError : null,
  };
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

function renderSidebarItem(
  key: ChannelKey,
  props: ChannelsProps,
) {
  const label = CHANNEL_LABELS[key] ?? resolveChannelLabel(props.snapshot, key);
  const status = getChannelStatus(key, props);
  const isActive = props.channelsSelectedKey === key;
  const dotClass = status.running
    ? "status-dot--running"
    : status.configured
      ? "status-dot--configured"
      : "status-dot--unconfigured";

  return html`
    <button
      class="ch-sidebar-item ${isActive ? "ch-sidebar-item--active" : ""}"
      @click=${() => props.onSelectChannel(key)}
    >
      <span class="status-dot ${dotClass}"></span>
      <span class="ch-sidebar-item__label">${label}</span>
    </button>
  `;
}

function renderChannelSidebar(props: ChannelsProps) {
  const channelOrder = resolveChannelOrder(props.snapshot);
  const ordered = channelOrder.map((key, index) => ({
    key,
    enabled: channelEnabled(key, props),
    order: index,
  }));

  const domestic = ordered.filter((c) => DOMESTIC_CHANNELS.has(c.key));
  const international = ordered.filter((c) => !DOMESTIC_CHANNELS.has(c.key));

  // Sort: enabled channels first
  const sortFn = (a: typeof ordered[0], b: typeof ordered[0]) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.order - b.order;
  };
  domestic.sort(sortFn);
  international.sort(sortFn);

  return html`
    <div class="ch-sidebar-group">
      <div class="ch-sidebar-group__title">${t("channels.sidebar.domestic")}</div>
      ${domestic.map((c) => renderSidebarItem(c.key, props))}
    </div>
    <div class="ch-sidebar-group">
      <div class="ch-sidebar-group__title">${t("channels.sidebar.international")}</div>
      ${international.map((c) => renderSidebarItem(c.key, props))}
    </div>
  `;
}

// ── Welcome panel ───────────────────────────────────────────────────────────

function renderChannelWelcome(props: ChannelsProps) {
  const channels = props.snapshot?.channels as Record<string, unknown> | null;
  let runningCount = 0;
  let configuredCount = 0;
  for (const key of ALL_SUPPORTED_CHANNELS) {
    const s = channels?.[key] as { configured?: boolean; running?: boolean } | undefined;
    if (s?.running) runningCount++;
    if (s?.configured) configuredCount++;
  }

  return html`
    <div class="ch-welcome">
      <div class="ch-welcome__stats">
        <div class="ch-welcome__stat">
          <div class="ch-welcome__stat-value">${runningCount}</div>
          <div class="ch-welcome__stat-label">${t("common.running")}</div>
        </div>
        <div class="ch-welcome__stat">
          <div class="ch-welcome__stat-value">${configuredCount}</div>
          <div class="ch-welcome__stat-label">${t("channels.configured")}</div>
        </div>
      </div>
      ${configuredCount === 0
        ? html`
          <div class="ch-welcome__guide">
            <div class="ch-welcome__guide-title">${t("channels.welcome.title")}</div>
            <p class="ch-welcome__guide-desc">${t("channels.welcome.desc")}</p>
          </div>
        `
        : nothing}
    </div>
  `;
}

// ── Detail panel ────────────────────────────────────────────────────────────

const RECENT_ACTIVITY_THRESHOLD_MS = 10 * 60 * 1000;

function hasRecentActivity(account: ChannelAccountSnapshot): boolean {
  if (!account.lastInboundAt) return false;
  return Date.now() - account.lastInboundAt < RECENT_ACTIVITY_THRESHOLD_MS;
}

function renderBotCard(
  account: ChannelAccountSnapshot,
  channelId: string,
  props: ChannelsProps,
) {
  const isRunning = account.running || hasRecentActivity(account);
  const statusLabel = account.running
    ? t("common.running")
    : account.configured
      ? t("common.stopped")
      : t("channels.notConfigured");
  const dotClass = isRunning
    ? "status-dot--running"
    : account.configured
      ? "status-dot--configured"
      : "status-dot--unconfigured";

  // Find route binding for this account
  const route = props.routeSummary?.find(
    (r) => r.channel === channelId && r.accountId === account.accountId,
  );

  // Resolve bound project details
  const boundProject = route
    ? props.routeProjects?.find((p) => p.projectId === route.targetId)
    : null;

  return html`
    <div
      class="ch-bot-card ch-bot-card--clickable ${account.lastError && !isUnconfiguredError(account.lastError) ? "ch-bot-card--error" : ""}"
      @click=${() => props.onWizardOpen(account.accountId)}
      role="button"
      tabindex="0"
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onWizardOpen(account.accountId);
        }
      }}
    >
      <div class="ch-bot-card__header">
        <span class="ch-bot-card__name">${account.name || account.accountId}</span>
        <span class="status-dot ${dotClass}"></span>
      </div>
      <div class="ch-bot-card__status">${statusLabel}</div>
      ${account.lastInboundAt
        ? html`<div class="ch-bot-card__activity">${t("sessions.lastActivity")}: ${formatAgo(account.lastInboundAt)}</div>`
        : nothing}
      ${boundProject
        ? html`
          <div class="ch-bot-card__binding">
            <div class="ch-bot-card__binding-project">
              <span class="ch-bot-card__route">${boundProject.name}</span>
              ${boundProject.status
                ? html`<span class="ch-bot-card__binding-status ch-bot-card__binding-status--${boundProject.status}">${boundProject.status}</span>`
                : nothing}
            </div>
            <div class="ch-bot-card__binding-meta">
              <span>${t("channels.detail.supervisor")}: ${boundProject.supervisorId}</span>
              ${boundProject.memberCount != null
                ? html`<span>${t("channels.detail.members")}: ${boundProject.memberCount}</span>`
                : nothing}
            </div>
          </div>
        `
        : route
          ? html`<div class="ch-bot-card__route">${route.targetName}</div>`
          : nothing}
      ${account.lastError && !isUnconfiguredError(account.lastError)
        ? html`<div class="ch-bot-card__error">${account.lastError}</div>`
        : nothing}
    </div>
  `;
}

function renderChannelDetail(key: ChannelKey, props: ChannelsProps) {
  const label = CHANNEL_LABELS[key] ?? resolveChannelLabel(props.snapshot, key);
  const description = CHANNEL_DESCRIPTIONS[key] ?? "";
  const features = CHANNEL_FEATURES[key] ?? [];
  const status = getChannelStatus(key, props);
  const accounts = props.snapshot?.channelAccounts?.[key] ?? [];

  // Status badge
  const statusBadge = status.running
    ? html`<span class="ch-detail__badge ch-detail__badge--running">${t("common.running")}</span>`
    : status.configured
      ? html`<span class="ch-detail__badge ch-detail__badge--configured">${t("common.stopped")}</span>`
      : html`<span class="ch-detail__badge ch-detail__badge--unconfigured">${t("channels.notConfigured")}</span>`;

  return html`
    <div class="ch-detail">
      <!-- Header -->
      <div class="ch-detail__header">
        <div class="ch-detail__title-row">
          <h2 class="ch-detail__title">${label}</h2>
          ${statusBadge}
        </div>
        <p class="ch-detail__desc">${description}</p>
      </div>

      <!-- Features -->
      ${features.length > 0
        ? html`
          <div class="ch-detail__features">
            ${features.map((f) => html`<span class="ch-detail__feature-tag">${f}</span>`)}
          </div>
        `
        : nothing}

      <!-- Bot cards -->
      <div class="ch-detail__section">
        <div class="ch-detail__section-header">
          <h3 class="ch-detail__section-title">${t("channels.detail.bots")}</h3>
        </div>
        ${accounts.length > 0
          ? html`
            <div class="ch-bot-grid">
              ${accounts.map((account) => renderBotCard(account, key, props))}
              <button class="ch-bot-card ch-bot-card--add" @click=${() => props.onWizardOpen()}>
                <span class="ch-bot-card--add__icon">+</span>
                <span>${t("channels.detail.addBot")}</span>
              </button>
            </div>
          `
          : html`
            <div class="ch-detail__empty">
              <p>${t("channels.detail.noBots")}</p>
              <button class="btn primary" @click=${() => props.onWizardOpen()}>
                ${t("channels.detail.addBot")}
              </button>
            </div>
          `}
      </div>

      <!-- Status info (compact) -->
      ${status.configured || status.running
        ? html`
          <div class="ch-detail__section">
            <h3 class="ch-detail__section-title">${t("channels.detail.status")}</h3>
            <div class="ch-detail__status-row">
              <span>${t("channels.configured")}: ${status.configured ? t("common.yes") : t("common.no")}</span>
              <span>${t("common.running")}: ${status.running ? t("common.yes") : t("common.no")}</span>
              ${status.connected ? html`<span>${t("common.connected")}: ${t("common.yes")}</span>` : nothing}
            </div>
          </div>
        `
        : nothing}

      <!-- Error -->
      ${status.lastError && !isUnconfiguredError(status.lastError)
        ? html`<div class="callout danger" style="margin-top: 12px;">${status.lastError}</div>`
        : nothing}

      <!-- Actions -->
      <div class="ch-detail__actions">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.probe")}
        </button>
      </div>

      <!-- Route section -->
      ${renderChannelRouteSection({
        channelId: key,
        props,
        accounts,
      })}
    </div>
  `;
}

// ── Main export ─────────────────────────────────────────────────────────────

export function renderChannels(props: ChannelsProps) {
  return html`
    <div class="ch-layout">
      <div class="ch-sidebar">
        ${renderChannelSidebar(props)}
      </div>
      <div class="ch-main">
        ${props.channelsSelectedKey
          ? renderChannelDetail(props.channelsSelectedKey, props)
          : renderChannelWelcome(props)}
      </div>
    </div>
    ${props.channelsWizardOpen
      ? renderChannelWizard(props)
      : nothing}
  `;
}

import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type { SessionsListResult } from "../types";
import type { ChatAttachment, ChatQueueItem } from "../ui-types";
import type { ChatItem, MessageGroup } from "../types/chat-types";
import type { LicenseUiState } from "../license/types";
import { icons } from "../icons";
import {
  normalizeMessage,
  normalizeRoleForGrouping,
} from "../chat/message-normalizer";
import {
  renderMessageGroup,
  renderReadingIndicatorGroup,
  renderStreamingGroup,
} from "../chat/grouped-render";
import { renderMarkdownSidebar } from "./markdown-sidebar";
import { t } from "../i18n/index.js";
import "../components/resizable-divider";
import {
  renderWelcomeDiscovery,
  type WelcomeDiscoveryProps,
} from "./welcome-discovery";

/**
 * 打开购买链接
 * 优先使用已缓存的 URL，若为空则实时从 gateway GET /config/purchase-url 获取
 */
async function openPurchaseUrl(url: string | null): Promise<void> {
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  // 实时获取购买链接
  try {
    const resp = await fetch("/config/purchase-url");
    if (!resp.ok) return;
    const json = (await resp.json()) as { code?: number; data?: { xianyu?: string } };
    const fetchedUrl = json?.code === 200 && json?.data?.xianyu ? json.data.xianyu : null;
    if (fetchedUrl) {
      window.open(fetchedUrl, "_blank", "noopener,noreferrer");
    }
  } catch {
    // 静默失败
  }
}

export type CompactionIndicatorStatus = {
  active: boolean;
  startedAt: number | null;
  completedAt: number | null;
  /** "proactive" when triggered automatically before agent turn. */
  source?: "proactive";
  /** Context usage percentage when compaction started. */
  contextPercent?: number;
};

export type ChatProps = {
  sessionKey: string;
  onSessionKeyChange: (next: string) => void;
  thinkingLevel: string | null;
  showThinking: boolean;
  loading: boolean;
  sending: boolean;
  canAbort?: boolean;
  compactionStatus?: CompactionIndicatorStatus | null;
  messages: unknown[];
  toolMessages: unknown[];
  stream: string | null;
  justCompleted?: boolean;
  streamStartedAt: number | null;
  assistantAvatarUrl?: string | null;
  draft: string;
  queue: ChatQueueItem[];
  connected: boolean;
  canSend: boolean;
  disabledReason: string | null;
  error: string | null;
  sessions: SessionsListResult | null;
  // Focus mode
  focusMode: boolean;
  // Sidebar state
  sidebarOpen?: boolean;
  sidebarContent?: string | null;
  sidebarError?: string | null;
  splitRatio?: number;
  assistantName: string;
  assistantAvatar: string | null;
  // License activation banner
  needsActivation?: boolean;
  onActivate?: () => void;
  // License state for support/purchase UI
  licenseState?: LicenseUiState | null;
  /** 内联激活回调（试用用户在 chat 中输入激活码） */
  onInlineActivate?: (key: string) => Promise<boolean>;
  // Image attachments
  attachments?: ChatAttachment[];
  onAttachmentsChange?: (attachments: ChatAttachment[]) => void;
  // Discovery props (首次使用发现)
  discoveryProps?: WelcomeDiscoveryProps | null;
  showDiscovery?: boolean;
  // Event handlers
  onRefresh: () => void;
  onToggleFocusMode: () => void;
  onDraftChange: (next: string) => void;
  onSend: () => void;
  onAbort?: () => void;
  onQueueRemove: (id: string) => void;
  onNewSession: () => void;
  onOpenSidebar?: (content: string) => void;
  onCloseSidebar?: () => void;
  onSplitRatioChange?: (ratio: number) => void;
  onChatScroll?: (event: Event) => void;
};

const COMPACTION_TOAST_DURATION_MS = 5000;

function renderCompactionIndicator(status: CompactionIndicatorStatus | null | undefined) {
  if (!status) return nothing;

  // Show "compacting..." while active
  if (status.active) {
    const isProactive = status.source === "proactive";
    const pctLabel =
      typeof status.contextPercent === "number"
        ? ` (${status.contextPercent}%)`
        : "";
    const message = isProactive
      ? html`<strong>正在优化对话记忆${pctLabel}</strong><br /><span style="opacity:0.85;font-size:12px">对话内容较多，正在自动整理压缩，请稍候...</span>`
      : html`Compacting context...`;
    return html`
      <div class="callout info compaction-indicator compaction-indicator--active">
        ${icons.loader} ${message}
      </div>
    `;
  }

  // Show "compaction complete" briefly after completion
  if (status.completedAt) {
    const elapsed = Date.now() - status.completedAt;
    if (elapsed < COMPACTION_TOAST_DURATION_MS) {
      const isProactive = status.source === "proactive";
      const message = isProactive
        ? html`对话记忆优化完成，继续为你服务`
        : html`Context compacted`;
      return html`
        <div class="callout success compaction-indicator compaction-indicator--complete">
          ${icons.check} ${message}
        </div>
      `;
    }
  }

  return nothing;
}

/**
 * 生成安全的附件 ID
 * 使用 Web Crypto API (crypto.getRandomValues) 替代 Math.random
 */
function generateAttachmentId(): string {
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  const hex = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
  return `att-${Date.now()}-${hex}`;
}

function handlePaste(
  e: ClipboardEvent,
  props: ChatProps,
) {
  const items = e.clipboardData?.items;
  if (!items || !props.onAttachmentsChange) return;

  const imageItems: DataTransferItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith("image/")) {
      imageItems.push(item);
    }
  }

  if (imageItems.length === 0) return;

  e.preventDefault();

  for (const item of imageItems) {
    const file = item.getAsFile();
    if (!file) continue;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newAttachment: ChatAttachment = {
        id: generateAttachmentId(),
        dataUrl,
        mimeType: file.type,
      };
      const current = props.attachments ?? [];
      props.onAttachmentsChange?.([...current, newAttachment]);
    };
    reader.readAsDataURL(file);
  }
}

function renderAttachmentPreview(props: ChatProps) {
  const attachments = props.attachments ?? [];
  if (attachments.length === 0) return nothing;

  return html`
    <div class="chat-attachments">
      ${attachments.map(
        (att) => html`
          <div class="chat-attachment">
            <img
              src=${att.dataUrl}
              alt="Attachment preview"
              class="chat-attachment__img"
            />
            <button
              class="chat-attachment__remove"
              type="button"
              aria-label="Remove attachment"
              @click=${() => {
                const next = (props.attachments ?? []).filter(
                  (a) => a.id !== att.id,
                );
                props.onAttachmentsChange?.(next);
              }}
            >
              ${icons.x}
            </button>
          </div>
        `,
      )}
    </div>
  `;
}

export function renderChat(props: ChatProps) {
  const canCompose = props.connected;
  const isBusy = props.sending || props.stream !== null;
  const canAbort = Boolean(props.canAbort && props.onAbort);
  const activeSession = props.sessions?.sessions?.find(
    (row) => row.key === props.sessionKey,
  );
  const reasoningLevel = activeSession?.reasoningLevel ?? "off";
  const showReasoning = props.showThinking && reasoningLevel !== "off";
  const assistantIdentity = {
    name: props.assistantName,
    avatar: props.assistantAvatar ?? props.assistantAvatarUrl ?? null,
  };

  const hasAttachments = (props.attachments?.length ?? 0) > 0;
  const composePlaceholder = props.connected
    ? hasAttachments
      ? t("chat.placeholder.withImages")
      : t("chat.placeholder.default")
    : t("chat.placeholder.disconnected");

  const splitRatio = props.splitRatio ?? 0.6;
  const sidebarOpen = Boolean(props.sidebarOpen && props.onCloseSidebar);
  
  // Check if we have messages to show
  const hasMessages = props.messages.length > 0 || props.stream !== null || props.loading;
  
  // Example prompts for welcome card
  const examplePrompts = [
    { icon: "☀️", text: t("chat.welcome.example1") },
    { icon: "🎨", text: t("chat.welcome.example2") },
    { icon: "✉️", text: t("chat.welcome.example3") },
    { icon: "📊", text: t("chat.welcome.example4") },
    { icon: "💻", text: t("chat.welcome.example5") },
  ];

  // License info for conditional rendering
  const license = props.licenseState?.license ?? null;
  const isTestUser = license?.keyType === "test" || license?.keyType === "trial";
  const supportQrcode = license?.supportQrcode ?? null;
  const purchaseUrl = license?.purchaseUrl ?? null;

  const welcomeCard = html`
    <div class="chat-welcome">
      <div class="chat-welcome__header">
        <div class="chat-welcome__icon">🤖</div>
        <h2 class="chat-welcome__title">
          ${isTestUser ? t("chat.welcome.titleTrial") : t("chat.welcome.title")}
        </h2>
        <p class="chat-welcome__subtitle">
          ${isTestUser ? t("chat.welcome.subtitleTrial") : t("chat.welcome.subtitle")}
        </p>
      </div>

      ${isTestUser ? html`
        <!-- 试用用户：二维码 + 购买链接 同一行 -->
        <div class="chat-welcome__hero-row">
          ${supportQrcode ? html`
            <div class="chat-welcome__hero-qr-wrap">
              <img class="chat-welcome__hero-qr" src="${supportQrcode.base64}" alt="Support QR" />
            </div>
          ` : nothing}
          <div class="chat-welcome__hero-info">
            <div class="chat-welcome__hero-badge">💬</div>
            <div class="chat-welcome__hero-title">${t("support.heroScanTitle")}</div>
            ${supportQrcode ? html`
              <div class="chat-welcome__hero-group">${supportQrcode.groupName}</div>
            ` : nothing}
            <div class="chat-welcome__hero-desc">${t("support.basicGroupDesc")}</div>
            <button
              class="chat-welcome__hero-purchase"
              type="button"
              @click=${() => void openPurchaseUrl(purchaseUrl)}
            >
              🛒 ${t("support.purchaseOnXianyu")}
            </button>
          </div>
        </div>
      ` : nothing}

      <div class="chat-welcome__section">
        <h3 class="chat-welcome__section-title">${t("chat.welcome.tryAsk")}</h3>
        <div class="chat-welcome__examples">
          ${examplePrompts.map(
            (example) => html`
              <button
                class="chat-welcome__example"
                type="button"
                @click=${() => props.onDraftChange(example.text)}
              >
                <span class="chat-welcome__example-icon">${example.icon}</span>
                <span class="chat-welcome__example-text">${example.text}</span>
              </button>
            `,
          )}
        </div>
      </div>

      <div class="chat-welcome__section">
        <h3 class="chat-welcome__section-title">${t("chat.welcome.capabilities")}</h3>
        <div class="chat-welcome__capabilities">
          <div class="chat-welcome__capability">
            <span class="chat-welcome__capability-icon">💬</span>
            <span class="chat-welcome__capability-text">${t("chat.welcome.capability.chat")}</span>
          </div>
          <div class="chat-welcome__capability">
            <span class="chat-welcome__capability-icon">🔧</span>
            <span class="chat-welcome__capability-text">${t("chat.welcome.capability.tool")}</span>
          </div>
          <div class="chat-welcome__capability">
            <span class="chat-welcome__capability-icon">⚡</span>
            <span class="chat-welcome__capability-text">${t("chat.welcome.capability.automation")}</span>
          </div>
        </div>
      </div>

      <!-- 技术支持二维码（非试用用户 / 正式用户单独显示） -->
      ${!isTestUser && supportQrcode ? html`
        <div class="chat-welcome__support-card chat-welcome__support-card--pro">
          <div class="chat-welcome__support-header">
            <span class="chat-welcome__support-badge">⭐</span>
            <span class="chat-welcome__support-title">
              ${t("support.scanForPremiumSupport")}
            </span>
          </div>
          <div class="chat-welcome__support-body">
            <img class="chat-welcome__support-qr" src="${supportQrcode.base64}" alt="Support QR" />
            <div class="chat-welcome__support-info">
              <div class="chat-welcome__support-name">${supportQrcode.groupName}</div>
              <div class="chat-welcome__support-desc">
                ${t("support.premiumGroupDesc")}
              </div>
            </div>
          </div>
        </div>
      ` : nothing}

      <div class="chat-welcome__footer">
        <a href="https://www.obplugins.cn" target="_blank" rel="noreferrer" class="chat-welcome__tecbinai">
          🚀 由 <strong>tecbinai</strong> 提供技术支持 · 及时追踪 AI 最新内容
        </a>
      </div>
    </div>
  `;
  
  const thread = html`
    <div
      class="chat-thread"
      role="log"
      aria-live="polite"
      @scroll=${props.onChatScroll}
    >
      ${!hasMessages && props.connected
        ? props.showDiscovery && props.discoveryProps
          ? renderWelcomeDiscovery(props.discoveryProps)
          : welcomeCard
        : nothing}
      ${props.loading ? html`<div class="muted">Loading chat…</div>` : nothing}
      ${(() => {
        const chatItems = buildChatItems(props);
        // Pre-compute last assistant group key once (O(n)), instead of per-group (O(M*n))
        const lastAsstKey = props.justCompleted ? findLastAssistantGroupKey(chatItems) : null;
        return repeat(chatItems, (item) => item.key, (item) => {
          if (item.kind === "reading-indicator") {
            return renderReadingIndicatorGroup(assistantIdentity, item.startedAt, props.error);
          }

          if (item.kind === "stream") {
            return renderStreamingGroup(
              item.text,
              item.startedAt,
              props.onOpenSidebar,
              assistantIdentity,
              item.key,
            );
          }

          if (item.kind === "group") {
            return renderMessageGroup(item, {
              onOpenSidebar: props.onOpenSidebar,
              showReasoning,
              assistantName: props.assistantName,
              assistantAvatar: assistantIdentity.avatar,
              justCompleted: lastAsstKey !== null && item.key === lastAsstKey,
            });
          }

          return nothing;
        });
      })()}
    </div>
  `;

  return html`
    <section class="card chat">
      ${props.disabledReason
        ? html`<div class="callout">${props.disabledReason}</div>`
        : nothing}

      ${props.needsActivation
        ? html`
            <div class="callout warning license-activation-banner">
              <span class="license-activation-icon">🔑</span>
              <span class="license-activation-text">
                请先激活授权码以使用完整功能
              </span>
              <button 
                class="license-activation-btn"
                @click=${props.onActivate}
              >
                立即激活
              </button>
            </div>
          `
        : props.error
          ? html`<div class="callout danger">${props.error}</div>`
          : nothing}

      ${renderCompactionIndicator(props.compactionStatus)}

      ${props.focusMode
        ? html`
            <button
              class="chat-focus-exit"
              type="button"
              @click=${props.onToggleFocusMode}
              aria-label="Exit focus mode"
              title="Exit focus mode"
            >
              ${icons.x}
            </button>
          `
        : nothing}

      <div
        class="chat-split-container ${sidebarOpen ? "chat-split-container--open" : ""}"
      >
        <div
          class="chat-main"
          style="flex: ${sidebarOpen ? `0 0 ${splitRatio * 100}%` : "1 1 100%"}"
        >
          ${thread}
        </div>

        ${sidebarOpen
          ? html`
              <resizable-divider
                .splitRatio=${splitRatio}
                @resize=${(e: CustomEvent) =>
                  props.onSplitRatioChange?.(e.detail.splitRatio)}
              ></resizable-divider>
              <div class="chat-sidebar">
                ${renderMarkdownSidebar({
                  content: props.sidebarContent ?? null,
                  error: props.sidebarError ?? null,
                  onClose: props.onCloseSidebar!,
                  onViewRawText: () => {
                    if (!props.sidebarContent || !props.onOpenSidebar) return;
                    props.onOpenSidebar(`\`\`\`\n${props.sidebarContent}\n\`\`\``);
                  },
                })}
              </div>
            `
          : nothing}
      </div>

      ${isTestUser ? html`
        <!-- 试用用户常驻浮条：输入框与聊天之间 -->
        <div class="chat-trial-bar">
          <div class="chat-trial-bar__left">
            <div class="chat-trial-bar__support-trigger">
              <span class="chat-trial-bar__icon">💬</span>
              <span class="chat-trial-bar__label">${t("support.getExclusiveSupport")}</span>
              ${supportQrcode ? html`
                <div class="chat-trial-bar__popover">
                  <div class="chat-trial-bar__popover-arrow"></div>
                  <div class="chat-trial-bar__popover-title">${t("support.scanForSupport")}</div>
                  <img class="chat-trial-bar__qrcode" src="${supportQrcode.base64}" alt="QR" />
                  <div class="chat-trial-bar__popover-name">${supportQrcode.groupName}</div>
                </div>
              ` : nothing}
            </div>
            <button
              class="chat-trial-bar__purchase chat-trial-bar__purchase--gold"
              type="button"
              @click=${() => void openPurchaseUrl(purchaseUrl)}
            >
              <span class="chat-trial-bar__purchase-icon">👑</span>
              <span>${t("support.upgradePro")}</span>
            </button>
          </div>
          <div class="chat-trial-bar__right">
            <button
              class="chat-trial-bar__activate-trigger"
              type="button"
              @click=${props.onActivate}
            >
              <span class="chat-trial-bar__activate-icon">🔑</span>
              <span>${t("support.inputActivationCode")}</span>
            </button>
          </div>
        </div>
      ` : nothing}

      ${props.queue.length
        ? html`
            <div class="chat-queue" role="status" aria-live="polite">
              <div class="chat-queue__title">Queued (${props.queue.length})</div>
              <div class="chat-queue__list">
                ${props.queue.map(
                  (item) => html`
                    <div class="chat-queue__item">
                      <div class="chat-queue__text">
                        ${item.text ||
                        (item.attachments?.length
                          ? `Image (${item.attachments.length})`
                          : "")}
                      </div>
                      <button
                        class="btn chat-queue__remove"
                        type="button"
                        aria-label="Remove queued message"
                        @click=${() => props.onQueueRemove(item.id)}
                      >
                        ${icons.x}
                      </button>
                    </div>
                  `,
                )}
              </div>
            </div>
          `
        : nothing}

      <div class="chat-compose">
        ${renderAttachmentPreview(props)}
        <div class="chat-compose__row">
          <label class="field chat-compose__field">
            <span>Message</span>
            <textarea
              .value=${props.draft}
              ?disabled=${!props.connected}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key !== "Enter") return;
                if (e.isComposing || e.keyCode === 229) return;
                if (e.shiftKey) return; // Allow Shift+Enter for line breaks
                if (!props.connected) return;
                e.preventDefault();
                if (canCompose) props.onSend();
              }}
              @input=${(e: Event) =>
                props.onDraftChange((e.target as HTMLTextAreaElement).value)}
              @paste=${(e: ClipboardEvent) => handlePaste(e, props)}
              placeholder=${composePlaceholder}
            ></textarea>
          </label>
          <div class="chat-compose__actions">
            <button
              class="btn"
              ?disabled=${!props.connected || (!canAbort && props.sending)}
              @click=${canAbort ? props.onAbort : props.onNewSession}
            >
              ${canAbort ? t("chat.stop") : t("chat.newSession")}
            </button>
            <button
              class="btn primary"
              ?disabled=${!props.connected}
              @click=${props.onSend}
            >
              ${isBusy ? t("chat.queue") : t("chat.send")}<kbd class="btn-kbd">↵</kbd>
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

// 渲染限制：降低到 80 条以提升性能，避免 DOM 节点过多导致卡顿
const CHAT_HISTORY_RENDER_LIMIT = 80;

/** 找到所有 items 中最后一个 assistant group 的 key，O(n) 单次扫描 */
function findLastAssistantGroupKey(
  allItems: Array<ChatItem | MessageGroup>,
): string | null {
  for (let i = allItems.length - 1; i >= 0; i--) {
    const g = allItems[i];
    if (g.kind === "group" && normalizeRoleForGrouping(g.role) === "assistant") {
      return g.key;
    }
  }
  return null;
}

function groupMessages(items: ChatItem[]): Array<ChatItem | MessageGroup> {
  const result: Array<ChatItem | MessageGroup> = [];
  let currentGroup: MessageGroup | null = null;

  for (const item of items) {
    if (item.kind !== "message") {
      if (currentGroup) {
        result.push(currentGroup);
        currentGroup = null;
      }
      result.push(item);
      continue;
    }

    const normalized = normalizeMessage(item.message);
    const role = normalizeRoleForGrouping(normalized.role);
    const timestamp = normalized.timestamp || Date.now();

    if (!currentGroup || currentGroup.role !== role) {
      if (currentGroup) result.push(currentGroup);
      currentGroup = {
        kind: "group",
        key: `group:${role}:${item.key}`,
        role,
        messages: [{ message: item.message, key: item.key }],
        timestamp,
        isStreaming: false,
      };
    } else {
      currentGroup.messages.push({ message: item.message, key: item.key });
    }
  }

  if (currentGroup) result.push(currentGroup);
  return result;
}

function buildChatItems(props: ChatProps): Array<ChatItem | MessageGroup> {
  const items: ChatItem[] = [];
  const history = Array.isArray(props.messages) ? props.messages : [];
  const tools = Array.isArray(props.toolMessages) ? props.toolMessages : [];
  const historyStart = Math.max(0, history.length - CHAT_HISTORY_RENDER_LIMIT);
  if (historyStart > 0) {
    items.push({
      kind: "message",
      key: "chat:history:notice",
      message: {
        role: "system",
        content: `Showing last ${CHAT_HISTORY_RENDER_LIMIT} messages (${historyStart} hidden).`,
        timestamp: Date.now(),
      },
    });
  }
  for (let i = historyStart; i < history.length; i++) {
    const msg = history[i];
    const normalized = normalizeMessage(msg);

    if (!props.showThinking && normalized.role.toLowerCase() === "toolresult") {
      continue;
    }

    items.push({
      kind: "message",
      key: messageKey(msg, i),
      message: msg,
    });
  }
  if (props.showThinking) {
    for (let i = 0; i < tools.length; i++) {
      items.push({
        kind: "message",
        key: messageKey(tools[i], i + history.length),
        message: tools[i],
      });
    }
  }

  if (props.stream !== null) {
    const key = `stream:${props.sessionKey}:${props.streamStartedAt ?? "live"}`;
    if (props.stream.trim().length > 0) {
      items.push({
        kind: "stream",
        key,
        text: props.stream,
        startedAt: props.streamStartedAt ?? Date.now(),
      });
    } else {
      items.push({
        kind: "reading-indicator",
        key,
        startedAt: props.streamStartedAt ?? Date.now(),
      });
    }
  }

  return groupMessages(items);
}

function messageKey(message: unknown, index: number): string {
  const m = message as Record<string, unknown>;
  const toolCallId = typeof m.toolCallId === "string" ? m.toolCallId : "";
  if (toolCallId) return `tool:${toolCallId}`;
  const id = typeof m.id === "string" ? m.id : "";
  if (id) return `msg:${id}`;
  const messageId = typeof m.messageId === "string" ? m.messageId : "";
  if (messageId) return `msg:${messageId}`;
  const timestamp = typeof m.timestamp === "number" ? m.timestamp : null;
  const role = typeof m.role === "string" ? m.role : "unknown";
  if (timestamp != null) return `msg:${role}:${timestamp}:${index}`;
  return `msg:${role}:${index}`;
}

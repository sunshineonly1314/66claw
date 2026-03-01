import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { live } from "lit/directives/live.js";
import type { SessionsListResult } from "../types";
import type { ChatAttachment, ChatQueueItem } from "../ui-types";
import type { ChatItem, MessageGroup } from "../types/chat-types";
import type { LicenseUiState } from "../license/types";
import { isCN } from "../edition";
import { icons } from "../icons";
import {
  normalizeMessage,
  normalizeRoleForGrouping,
} from "../chat/message-normalizer";
import {
  renderMessageGroup,
  renderReadingIndicatorGroup,
  renderStreamingGroup,
  renderQueuedMessage,
} from "../chat/grouped-render";
import { renderMarkdownSidebar } from "./markdown-sidebar";
import { t } from "../i18n/index.js";
import "../components/resizable-divider";
import {
  renderWelcomeDiscovery,
  type WelcomeDiscoveryProps,
} from "./welcome-discovery";
import { extractImageGenDetails, renderImageGenPending } from "../chat/image-gen-result";
import { extractVideoGenDetails, renderVideoGenPending } from "../chat/video-gen-result";
import { extractFileWriteFromToolCall, type FileWriteDetails } from "../chat/file-write-card";
import {
  renderVoiceMascot,
  type VoiceMascotProps,
} from "./voice-mascot";
import { detectTextDirection } from "../text-direction";
import { renderComposeCard, type ComposeCardProps } from "../chat/compose-card";
import { renderIntentHint, type IntentHintProps } from "../chat/intent-hint";

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
  /** Active media generation tool detected in stream (video_gen / image_gen) */
  mediaToolActive?: { tool: string; args?: Record<string, unknown> } | null;
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
  // Scroll control
  showNewMessages?: boolean;
  onScrollToBottom?: () => void;
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
  // Voice mascot
  voiceMascot?: VoiceMascotProps | null;
  // OpenClawCN: auto-failover notification banner
  failoverBanner?: {
    fromProvider: string;
    toProvider: string;
    toModel: string;
    reason: string;
    reasonText: string;
  } | null;
  onDismissFailoverBanner?: () => void;
  // OpenClawCN: 聊天模型是否已配置
  chatModelConfigured?: boolean | null;
  onNavigateToModelConfig?: () => void;
  // OpenClawCN: compose-card 替代原始 textarea
  composeCardProps?: ComposeCardProps | null;
  // OpenClawCN: intent-hint 智能提示
  intentHintProps?: IntentHintProps | null;
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
      ? html`<span class="compaction-toast__title">正在优化对话记忆${pctLabel}</span><span class="compaction-toast__sub">对话内容较多，正在自动整理压缩...</span>`
      : html`<span>Compacting context...</span>`;
    return html`
      <div class="compaction-indicator compaction-indicator--active compaction-toast compaction-toast--loading">
        <span class="compaction-toast__icon compaction-toast__icon--spin">
          ${icons.loader}
        </span>
        <span class="compaction-toast__text">${message}</span>
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
        <div class="compaction-indicator compaction-indicator--complete compaction-toast">
          <span class="compaction-toast__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </span>
          <span class="compaction-toast__text">${message}</span>
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

/**
 * Enhanced paste handler with multi-format support:
 * 1. Standard image files (from OS clipboard)
 * 2. Base64 data URLs (e.g., data:image/png;base64,...)
 * 3. HTTP(S) URLs pointing to images
 * 4. Local file paths (if accessible)
 */
async function handlePaste(
  e: ClipboardEvent,
  props: ChatProps,
) {
  const items = e.clipboardData?.items;
  if (!items || !props.onAttachmentsChange) return;

  let hasImages = false;

  // Step 1: Check for standard image files
  const imageItems: DataTransferItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith("image/")) {
      imageItems.push(item);
      hasImages = true;
    }
  }

  // Step 2: Check for text content that might contain image references
  let textContent = "";
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type === "text/plain") {
      textContent = await new Promise<string>((resolve) => {
        item.getAsString(resolve);
      });
      break;
    }
  }

  // If we found images OR text that looks like an image reference, prevent default
  if (hasImages || isImageReference(textContent)) {
    e.preventDefault();
  } else {
    // No images, let default paste behavior continue
    return;
  }

  // Process standard image files
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

  // Process text-based image references
  if (textContent && !hasImages) {
    await handleTextImageReference(textContent, props);
  }
}

/**
 * Defense-in-depth: reject SVG and non-raster data URLs.
 * SVG can contain embedded <script>, <foreignObject>, etc.
 */
function isSafeImageDataUrl(dataUrl: string): boolean {
  if (!dataUrl.startsWith("data:image/")) return false;
  const mime = dataUrl.slice(5, dataUrl.indexOf(";")).toLowerCase();
  // Only allow known-safe raster formats
  const SAFE_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "image/avif"];
  return SAFE_MIMES.includes(mime);
}

/**
 * Check if a MIME type is a safe raster image (blocks SVG).
 */
function isSafeImageMime(mime: string): boolean {
  const lower = mime.toLowerCase();
  return (
    lower === "image/png" ||
    lower === "image/jpeg" ||
    lower === "image/gif" ||
    lower === "image/webp" ||
    lower === "image/bmp" ||
    lower === "image/avif"
  );
}

/**
 * Check if text content is an image reference
 */
function isImageReference(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  const trimmed = text.trim();

  // Base64 data URL -- only safe raster formats
  if (trimmed.startsWith("data:image/")) return isSafeImageDataUrl(trimmed);

  // HTTP(S) URL ending with image extension (exclude SVG)
  if (/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|bmp|avif)(\?.*)?$/i.test(trimmed)) return true;

  // File path ending with image extension (exclude SVG)
  if (/\.(jpg|jpeg|png|gif|webp|bmp|avif)$/i.test(trimmed)) return true;

  return false;
}

/**
 * Handle text-based image references (base64, URLs, file paths)
 */
async function handleTextImageReference(
  text: string,
  props: ChatProps,
): Promise<void> {
  const trimmed = text.trim();

  // Case 1: Base64 data URL -- only safe raster formats (XSS defense: block SVG)
  if (trimmed.startsWith("data:image/")) {
    if (!isSafeImageDataUrl(trimmed)) {
      console.warn("[handlePaste] Blocked unsafe data URL (SVG or unsupported format)");
      return;
    }
    const mimeTypeMatch = trimmed.match(/^data:(image\/[^;]+);base64,/);
    if (mimeTypeMatch) {
      const newAttachment: ChatAttachment = {
        id: generateAttachmentId(),
        dataUrl: trimmed,
        mimeType: mimeTypeMatch[1],
      };
      const current = props.attachments ?? [];
      props.onAttachmentsChange?.([...current, newAttachment]);
      return;
    }
  }

  // Case 2: HTTP(S) URL - fetch and convert to base64
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const response = await fetch(trimmed, { mode: 'cors' });
      if (!response.ok) {
        console.warn(`[handlePaste] Failed to fetch image from URL: ${response.status}`);
        return;
      }

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) {
        console.warn(`[handlePaste] URL does not point to an image: ${blob.type}`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const newAttachment: ChatAttachment = {
          id: generateAttachmentId(),
          dataUrl,
          mimeType: blob.type,
        };
        const current = props.attachments ?? [];
        props.onAttachmentsChange?.([...current, newAttachment]);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.warn(`[handlePaste] Failed to load image from URL:`, err);
    }
    return;
  }

  // Case 3: Local file path - show helpful error
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(trimmed)) {
    console.warn(
      `[handlePaste] Pasted a file path, but browsers cannot access local files directly: ${trimmed}\n` +
      `Please drag and drop the file instead, or use a file picker.`
    );
    // Could show a toast notification to the user here
  }
}

// OpenClawCN: 拖拽上传支持
function handleDrop(
  e: DragEvent,
  props: ChatProps,
) {
  e.preventDefault();
  (e.currentTarget as HTMLElement)?.classList.remove("chat--drag-over");
  if (!props.onAttachmentsChange) return;

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  for (const file of Array.from(files)) {
    if (!file.type.startsWith("image/") || !isSafeImageMime(file.type)) continue;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newAttachment: ChatAttachment = {
        id: generateAttachmentId(),
        dataUrl,
        mimeType: file.type,
        fileName: file.name,
        fileSize: file.size,
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
      ${attachments.filter((att) => isSafeImageDataUrl(att.dataUrl)).map(
        (att) => html`
          <div class="chat-attachment">
            <img
              src=${att.dataUrl}
              alt="Attachment preview"
              class="chat-attachment__img"
              loading="lazy"
              decoding="async"
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
  
  // License info for conditional rendering
  const license = props.licenseState?.license ?? null;
  const isTestUser = license?.keyType === "test" || license?.keyType === "trial";
  const supportQrcode = license?.supportQrcode ?? null;
  const purchaseUrl = license?.purchaseUrl ?? null;

  // Time-based greeting
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? t("chat.greeting.morning") : hour < 18 ? t("chat.greeting.afternoon") : t("chat.greeting.evening");
  const hasCustomName = props.assistantName && props.assistantName !== "Assistant";
  const subtitleText = hasCustomName
    ? `${t("chat.greeting.intro")}${props.assistantName}`
    : t("chat.greeting.introDefault");

  const greetingLine = hasCustomName
    ? `${timeGreeting}，${subtitleText}`
    : `${timeGreeting}，${subtitleText}`;

  const greetingCard = html`
    <div class="chat-greeting">
      <h1 class="chat-greeting__text">${greetingLine}</h1>
    </div>
  `;

  // Whether to show the centered empty-state layout (greeting + compose together)
  const showEmptyCenter = !hasMessages && props.connected
    && !(props.showDiscovery && props.discoveryProps);

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
          : nothing
        : nothing}
      ${props.loading ? html`<div class="muted">Loading chat…</div>` : nothing}
      ${(() => {
        const chatItems = buildChatItems(props);
        // Pre-compute last assistant group key once (O(n)), instead of per-group (O(M*n))
        const lastAsstKey = props.justCompleted ? findLastAssistantGroupKey(chatItems) : null;
        return repeat(chatItems, (item) => item.key, (item) => {
          if (item.kind === "divider") {
            return html`
              <div class="chat-divider" role="separator" data-ts=${String(item.timestamp)}>
                <span class="chat-divider__line"></span>
                <span class="chat-divider__label">${item.label}</span>
                <span class="chat-divider__line"></span>
              </div>
            `;
          }

          if (item.kind === "reading-indicator") {
            return renderReadingIndicatorGroup(assistantIdentity, item.startedAt, props.error);
          }

          // [CN-PATCH:media-tool-heartbeat] Show media generation pending shimmer
          if (item.kind === "media-pending") {
            const args = item.args as Record<string, unknown> | undefined;
            if (item.tool === "video_gen") {
              return html`<div class="chat-group chat-group--assistant">${renderVideoGenPending(args)}</div>`;
            }
            return html`<div class="chat-group chat-group--assistant">${renderImageGenPending(args)}</div>`;
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

          if (item.kind === "queued") {
            return renderQueuedMessage(item.queueItem, props.onQueueRemove);
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
    <section
      class="card chat ${showEmptyCenter ? "chat--empty" : ""}"
      @dragover=${(e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = "copy";
        (e.currentTarget as HTMLElement).classList.add("chat--drag-over");
      }}
      @dragleave=${(e: DragEvent) => {
        if (e.currentTarget === e.target) {
          (e.currentTarget as HTMLElement).classList.remove("chat--drag-over");
        }
      }}
      @drop=${(e: DragEvent) => handleDrop(e, props)}
    >
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

      ${props.failoverBanner ? html`
        <div class="callout info failover-banner">
          <span class="failover-banner__icon">&#x26A1;</span>
          <span class="failover-banner__text">
            已自动切换到 <strong>${props.failoverBanner.toProvider}</strong> / ${props.failoverBanner.toModel}，原服务商 ${props.failoverBanner.fromProvider} ${props.failoverBanner.reasonText}
          </span>
          <button class="failover-banner__close" type="button" @click=${props.onDismissFailoverBanner}>&times;</button>
        </div>
      ` : nothing}

      <!-- OpenClawCN: model config banner moved to content-header -->

      ${
        props.showNewMessages
          ? html`
            <button
              class="btn chat-new-messages"
              type="button"
              @click=${props.onScrollToBottom}
            >
              ${t("chat.newMessages")} ${icons.arrowDown}
            </button>
          `
          : nothing
      }

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

      ${showEmptyCenter ? html`
        <div class="chat-empty-center">
          ${greetingCard}
        </div>
      ` : html`
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
      `}

      ${isTestUser ? html`
        <!-- 试用用户常驻浮条：输入框与聊天之间 -->
        <div class="chat-trial-bar">
          ${isCN ? html`
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
          ` : nothing}
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

      <div class="chat-compose">
        ${props.voiceMascot ? renderVoiceMascot(props.voiceMascot) : nothing}
        ${props.intentHintProps ? renderIntentHint(props.intentHintProps) : nothing}
        ${props.composeCardProps
          ? renderComposeCard(props.composeCardProps)
          : html`
            ${renderAttachmentPreview(props)}
            <div class="chat-compose__row">
              <label class="field chat-compose__field">
                <span>Message</span>
                <textarea
                  .value=${live(props.draft)}
                  dir=${detectTextDirection(props.draft)}
                  ?disabled=${!props.connected}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key !== "Enter") return;
                    if (e.isComposing || e.keyCode === 229) return;
                    if (e.shiftKey) return;
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
                ${props.onAttachmentsChange ? html`
                  <input
                    type="file"
                    id="chat-file-input"
                    accept="image/*"
                    multiple
                    style="display: none;"
                    @change=${(e: Event) => {
                      const input = e.target as HTMLInputElement;
                      if (!input.files || input.files.length === 0) return;
                      for (const file of Array.from(input.files)) {
                        if (!file.type.startsWith("image/")) continue;
                        const reader = new FileReader();
                        reader.onload = () => {
                          const dataUrl = reader.result as string;
                          const newAttachment: ChatAttachment = {
                            id: generateAttachmentId(),
                            dataUrl,
                            mimeType: file.type,
                            fileName: file.name,
                            fileSize: file.size,
                          };
                          const current = props.attachments ?? [];
                          props.onAttachmentsChange?.([...current, newAttachment]);
                        };
                        reader.readAsDataURL(file);
                      }
                      input.value = '';
                    }}
                  />
                  <button
                    type="button"
                    class="btn chat-attach-btn"
                    ?disabled=${!props.connected}
                    @click=${() => {
                      const input = document.getElementById('chat-file-input') as HTMLInputElement;
                      input?.click();
                    }}
                    title="Attach images (Ctrl+V to paste, or drag and drop)"
                    aria-label="Attach images"
                  >
                    ${icons.paperclip}
                  </button>
                ` : nothing}
                ${canAbort ? html`<button
                  class="btn"
                  @click=${props.onAbort}
                >
                  ${t("chat.stop")}
                </button>` : nothing}
                <button
                  class="btn"
                  ?disabled=${!props.connected}
                  @click=${props.onNewSession}
                >
                  ${t("chat.newSession")}
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
          `}
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
  // Pre-scan: collect indices of history messages that are tool results,
  // so we can mark preceding tool-call messages as resolved (not pending).
  const resolvedToolCallIndices = new Set<number>();
  for (let i = historyStart; i < history.length; i++) {
    const n = normalizeMessage(history[i]);
    if (n.role.toLowerCase() === "toolresult") {
      // Walk backwards to find the assistant message whose tool calls are now resolved
      for (let j = i - 1; j >= historyStart; j--) {
        const prev = normalizeMessage(history[j]);
        if (prev.role.toLowerCase() === "assistant") {
          resolvedToolCallIndices.add(j);
          break;
        }
      }
    }
  }

  for (let i = historyStart; i < history.length; i++) {
    const msg = history[i];
    const normalized = normalizeMessage(msg);
    const raw = msg as Record<string, unknown>;
    const marker = raw.__openclawcn as Record<string, unknown> | undefined;
    if (marker && marker.kind === "compaction") {
      items.push({
        kind: "divider",
        key:
          typeof marker.id === "string"
            ? `divider:compaction:${marker.id}`
            : `divider:compaction:${normalized.timestamp}:${i}`,
        label: t("chat.compaction"),
        timestamp: normalized.timestamp ?? Date.now(),
      });
      continue;
    }

    if (normalized.role.toLowerCase() === "toolresult") {
      // [CN-FIX] Always hide ALL tool result messages — they show raw technical
      // details (error messages, file contents, etc.) that confuse end users.
      // Image/video gen data is injected into the assistant bubble via the
      // assistant-message scan below (reads from history[] directly).
      continue;
    }

    // If this assistant message's tool calls have a matching tool result in
    // history, tag it so extractToolCards won't mark them as pending/spinning.
    let message: unknown = resolvedToolCallIndices.has(i)
      ? Object.assign({}, msg as Record<string, unknown>, { __toolsResolved: true })
      : msg;

    // [CN-FIX:interrupted-gen] When loading from history with no active stream,
    // unresolved image_gen/video_gen tool calls are stale (page was closed mid-
    // generation). Mark them so the renderer shows "interrupted" instead of shimmer.
    // BUT: if the unresolved tool call is in the LAST assistant message of the
    // history, it's likely still executing in the backend (e.g. video_gen takes
    // 1-2 min) — keep it as "pending" shimmer, not "interrupted" grey.
    const isLiveSession = props.stream !== null || props.sending;
    if (
      !isLiveSession &&
      !resolvedToolCallIndices.has(i) &&
      normalized.role.toLowerCase() === "assistant"
    ) {
      // Check if this is the last assistant message (no later user/assistant messages after it)
      let isLastAssistant = true;
      for (let k = i + 1; k < history.length; k++) {
        const laterRole = normalizeMessage(history[k]).role.toLowerCase();
        if (laterRole === "user" || laterRole === "assistant") {
          isLastAssistant = false;
          break;
        }
      }

      if (!isLastAssistant) {
        const contentArr = Array.isArray(raw.content) ? raw.content as Array<Record<string, unknown>> : [];
        const hasMediaToolUse = contentArr.some((block) => {
          const kind = String(block.type ?? "").toLowerCase();
          if (!["tool_use", "tooluse", "toolcall", "tool_call"].includes(kind)) return false;
          const name = String(block.name ?? "");
          return name === "image_gen" || name === "image_edit" || name === "video_gen" || name === "write" || name === "edit";
        });
        if (hasMediaToolUse) {
          message = Object.assign({}, message as Record<string, unknown>, { __staleMediaTools: true });
        }
      }
    }

    // [CN-FIX:image-display] Image/video gen toolResult messages are always
    // skipped above. Attach their data to this assistant message so the image
    // renders inline in the assistant bubble (no separate "tool" group).
    // [CN-FEAT:file-card] Also extract file write details from tool results
    // and from tool_call args in the assistant message itself.
    if (normalized.role.toLowerCase() === "assistant") {
      for (let j = i - 1; j >= historyStart; j--) {
        const prev = normalizeMessage(history[j]);
        if (prev.role.toLowerCase() !== "toolresult") break;
        const imgDetails = extractImageGenDetails(history[j]);
        if (imgDetails) {
          message = Object.assign({}, message as Record<string, unknown>, { __imageGenDetails: imgDetails });
          break;
        }
        const vidDetails = extractVideoGenDetails(history[j]);
        if (vidDetails) {
          message = Object.assign({}, message as Record<string, unknown>, { __videoGenDetails: vidDetails });
          break;
        }
      }
      // [CN-FEAT:file-card] Extract file write details from the assistant's
      // own tool_call blocks (args contain path + content).
      // Only inject as result cards when tool calls are RESOLVED, to avoid
      // showing both a completed-looking card AND a pending shimmer.
      if (resolvedToolCallIndices.has(i)) {
        const fileWrites = extractFileWriteFromToolCall(message);
        if (fileWrites.length > 0) {
          message = Object.assign({}, message as Record<string, unknown>, {
            __fileCardDetails: fileWrites,
          });
        }
      }
    }

    items.push({
      kind: "message",
      key: messageKey(msg, i),
      message,
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
    } else if (props.mediaToolActive) {
      // [CN-PATCH:media-tool-heartbeat] When a media generation tool (video_gen /
      // image_gen) is actively running, show its pending shimmer card instead of the
      // generic reading indicator + timeout warning.
      items.push({
        kind: "media-pending",
        key,
        tool: props.mediaToolActive.tool,
        args: props.mediaToolActive.args,
      });
    } else {
      items.push({
        kind: "reading-indicator",
        key,
        startedAt: props.streamStartedAt ?? Date.now(),
      });
    }
  }

  // Inject queued messages as inline items at the end of the thread
  if (props.queue.length > 0) {
    for (const qItem of props.queue) {
      items.push({
        kind: "queued",
        key: `queued:${qItem.id}`,
        queueItem: qItem,
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

/**
 * extensions-card.ts
 * Single MCP capability card for the Extensions page.
 *
 * Design goal (from mcp-ux-design-beginner.md):
 *   - User-facing, not developer-facing
 *   - Show "what it can do" + "try saying" example
 *   - Status: ready (green), needs_config (yellow), paused/fixing (muted)
 *   - "needs_config" cards show a [Configure & Enable] button
 *   - "ready" cards show no action — capability just works
 *   - Whole card is clickable for better UX
 */

import { html, nothing, type TemplateResult } from "lit";
import { t } from "../i18n/index.js";
import type { McpCapability, McpCapabilityStatus } from "../app-view-state.js";

export type ExtensionsCardProps = {
  capability: McpCapability;
  onConfigClick: (id: string) => void;
  onTrySay: (prompt: string) => void;
  onUninstall?: (id: string) => void;
  /** When set to this capability's id, button shows a loading spinner */
  enablingId?: string | null;
};

/* ── status visual helpers ───────────────────────────────────── */

const STATUS_DOT_COLORS: Record<McpCapabilityStatus, string> = {
  ready: "#34d399",
  needs_config: "#fbbf24",
  paused: "#94a3b8",
  fixing: "#60a5fa",
  unavailable: "#f87171",
};

const STATUS_BG: Record<McpCapabilityStatus, string> = {
  ready: "rgba(52,211,153,0.08)",
  needs_config: "rgba(251,191,36,0.08)",
  paused: "rgba(148,163,184,0.08)",
  fixing: "rgba(96,165,250,0.08)",
  unavailable: "rgba(248,113,113,0.08)",
};

function statusLabel(status: McpCapabilityStatus): string {
  switch (status) {
    case "ready":
      return t("extensions.status.ready");
    case "needs_config":
      return t("extensions.status.needsConfig");
    case "paused":
      return t("extensions.status.paused");
    case "fixing":
      return t("extensions.status.fixing");
    case "unavailable":
      return t("extensions.status.unavailable");
  }
}

/* ── main render ─────────────────────────────────────────────── */

export function renderExtensionsCard(props: ExtensionsCardProps): TemplateResult {
  const { capability: cap, onConfigClick, onTrySay, onUninstall, enablingId } = props;
  const isEnabling = enablingId === cap.id;
  const dotColor = STATUS_DOT_COLORS[cap.status];
  const bgColor = STATUS_BG[cap.status];

  // Whole-card click: needs_config → config wizard, otherwise → try saying
  const handleCardClick = (e: Event) => {
    // Don't trigger if user clicked an actual button inside the card
    if ((e.target as HTMLElement).closest("button")) return;
    if (cap.status === "needs_config") {
      onConfigClick(cap.id);
    } else if (cap.examplePrompt) {
      onTrySay(cap.examplePrompt);
    }
  };

  return html`
    <div
      class="ext-cap-card"
      @click=${handleCardClick}
      style="
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg, 12px);
        padding: 16px 18px;
        position: relative;
        cursor: pointer;
        transition: border-color var(--duration-normal, 200ms) var(--ease-out, ease),
                    box-shadow var(--duration-normal, 200ms) var(--ease-out, ease),
                    transform var(--duration-normal, 200ms) var(--ease-out, ease);
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.2)), inset 0 1px 0 var(--card-highlight, rgba(255,255,255,0.08));
        display:flex;
        flex-direction:column;
        min-height: 0;
      "
    >
      ${cap.isNew
        ? html`<span
            style="
              position: absolute;
              top: 12px;
              right: 12px;
              font-size: 10px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 2px 8px;
              border-radius: var(--radius-sm, 6px);
              background: rgba(96,165,250,0.15);
              color: #60a5fa;
            "
          >${t("extensions.newBadge")}</span>`
        : nothing}

      <!-- Header: name + status — compact -->
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
        <span style="font-size:15px; font-weight:600; color:var(--fg); letter-spacing:-0.01em;">${cap.friendlyName}</span>
        <span
          style="
            display:inline-flex;
            align-items:center;
            gap:4px;
            font-size:10px;
            padding:2px 10px;
            border-radius:var(--radius-full, 9999px);
            background:${bgColor};
            color:${dotColor};
            flex-shrink:0;
          "
        >
          <span style="width:5px;height:5px;border-radius:50%;background:${dotColor};display:inline-block;${cap.status === "ready" ? "box-shadow:0 0 5px " + dotColor + ";" : ""}"></span>
          ${statusLabel(cap.status)}
        </span>
      </div>

      <!-- Description list — compact -->
      <div style="margin-bottom:10px; flex:1;">
        <div style="font-size:11px; color:var(--muted-strong, #6b7d91); margin-bottom:4px; font-weight:500;">
          ${t("extensions.canHelp")}
        </div>
        <ul style="margin:0; padding-left:16px; font-size:12px; color:var(--fg-secondary, #a0aec0); line-height:1.7;">
          ${cap.description.map((d) => html`<li>${d}</li>`)}
        </ul>
      </div>

      <!-- Config needed hint — compact -->
      ${(cap.status === "needs_config" || cap.status === "unavailable") && cap.configNeeded
        ? html`
            <div
              style="
                font-size:11px;
                color:var(--muted-strong, #6b7d91);
                margin-bottom:10px;
                padding:8px 12px;
                background:rgba(251,191,36,0.06);
                border:1px solid rgba(251,191,36,0.12);
                border-radius:var(--radius-md, 8px);
              "
            >
              ${t("mcpConfig.needKey")}:
              <strong style="color:#fbbf24;">${cap.configNeeded}</strong>
            </div>
          `
        : nothing}

      <!-- Footer: config button + uninstall + "try saying" — compact -->
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-top:auto; padding-top:2px;">
        <div style="display:flex; align-items:center; gap:6px;">
          ${cap.status === "needs_config" || isEnabling
            ? html`
                <button
                  @click=${() => { if (!isEnabling) onConfigClick(cap.id); }}
                  ?disabled=${isEnabling}
                  style="
                    all:unset;
                    cursor:${isEnabling ? "default" : "pointer"};
                    font-size:12px;
                    font-weight:600;
                    padding:7px 18px;
                    border-radius:var(--radius-sm, 6px);
                    background:linear-gradient(135deg, #fbbf24, #f59e0b);
                    color:#000;
                    opacity:${isEnabling ? "0.75" : "1"};
                    transition: opacity 150ms, transform 100ms;
                    display:inline-flex;
                    align-items:center;
                    gap:6px;
                  "
                >
                  ${isEnabling
                    ? html`<span style="
                        width:12px; height:12px;
                        border:2px solid rgba(0,0,0,0.3);
                        border-top-color:#000;
                        border-radius:50%;
                        animation:extCardSpin 0.8s linear infinite;
                        display:inline-block;
                        flex-shrink:0;
                      "></span>`
                    : nothing}
                  ${isEnabling ? t("extensions.status.enabling" as never) : t("extensions.configAndEnable")}
                </button>
              `
            : nothing}
          ${!cap.isBuiltin && onUninstall
            ? html`
                <button
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    if (confirm(t("extensions.detail.uninstallConfirm" as never).replace("{{name}}", cap.friendlyName))) {
                      onUninstall(cap.id);
                    }
                  }}
                  style="
                    all:unset;
                    cursor:pointer;
                    font-size:11px;
                    padding:5px 12px;
                    border-radius:var(--radius-sm, 6px);
                    border:1px solid rgba(248,113,113,0.3);
                    color:#f87171;
                    transition: opacity 150ms, background 150ms;
                  "
                >${t("extensions.uninstall" as never)}</button>
              `
            : nothing}
        </div>

        ${(() => {
          const prompt = cap.examplePrompt
            || t("extensions.trySayFallback" as never).replace("{{name}}", cap.friendlyName);
          return html`
            <button
              class="ext-try-say-btn"
              @click=${() => onTrySay(prompt)}
              style="
                all:unset;
                cursor:pointer;
                font-size:12px;
                color:var(--accent-2, #20d5bc);
                display:inline-flex;
                align-items:center;
                gap:5px;
                transition: opacity 150ms, color 150ms, background 150ms;
                padding:5px 12px;
                border-radius:var(--radius-full, 9999px);
                background:rgba(32,213,188,0.08);
                border:1px solid rgba(32,213,188,0.15);
                overflow:hidden;
                max-width:100%;
              "
              title="${prompt}"
            >
              <span style="flex-shrink:0;">&#x1F4AC;</span>
              <span style="font-size:11px; color:var(--muted-strong, #6b7d91); flex-shrink:0;">${t("extensions.trySayBtn" as never)}</span>
              <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">"${prompt}"</span>
            </button>
          `;
        })()}
      </div>
    </div>

    <style>
      .ext-cap-card:hover {
        border-color: var(--border-strong, #4a5a70) !important;
        box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.25)), inset 0 1px 0 var(--card-highlight, rgba(255,255,255,0.08)) !important;
        transform: translateY(-1px);
      }
      .ext-cap-card:active {
        transform: translateY(0) !important;
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.2)) !important;
      }
      .ext-cap-card button:hover {
        opacity: 0.85;
      }
      .ext-cap-card button:active {
        opacity: 0.65;
        transform: scale(0.97);
      }
      .ext-cap-card .ext-try-say-btn:hover {
        opacity: 1 !important;
        background: rgba(32,213,188,0.14) !important;
        border-color: rgba(32,213,188,0.3) !important;
      }
      @keyframes extCardSpin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;
}

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
 */

import { html, nothing, type TemplateResult } from "lit";
import { t } from "../i18n/index.js";
import type { McpCapability, McpCapabilityStatus } from "../app-view-state.js";

export type ExtensionsCardProps = {
  capability: McpCapability;
  onConfigClick: (id: string) => void;
  onTrySay: (prompt: string) => void;
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
  const { capability: cap, onConfigClick, onTrySay } = props;
  const dotColor = STATUS_DOT_COLORS[cap.status];
  const bgColor = STATUS_BG[cap.status];

  return html`
    <div
      class="ext-cap-card"
      style="
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg, 12px);
        padding: 16px 18px;
        position: relative;
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
      ${cap.status === "needs_config" && cap.configNeeded
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

      <!-- Footer: config button + "try saying" — compact -->
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-top:auto; padding-top:2px;">
        ${cap.status === "needs_config"
          ? html`
              <button
                @click=${() => onConfigClick(cap.id)}
                style="
                  all:unset;
                  cursor:pointer;
                  font-size:11px;
                  font-weight:600;
                  padding:5px 14px;
                  border-radius:var(--radius-sm, 6px);
                  background:linear-gradient(135deg, #fbbf24, #f59e0b);
                  color:#000;
                  transition: opacity 150ms;
                "
              >
                ${t("extensions.configAndEnable")}
              </button>
            `
          : nothing}

        <button
          @click=${() => onTrySay(cap.examplePrompt)}
          style="
            all:unset;
            cursor:pointer;
            font-size:11px;
            color:var(--accent-2, #20d5bc);
            display:flex;
            align-items:center;
            gap:4px;
            transition: opacity 150ms, color 150ms;
            padding:2px 0;
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
            max-width:100%;
          "
          title="${cap.examplePrompt}"
        >
          <span style="font-size:10px; color:var(--muted-strong, #6b7d91); flex-shrink:0;">${t("extensions.trySay")}</span>
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">"${cap.examplePrompt}"</span>
        </button>
      </div>
    </div>

    <style>
      .ext-cap-card:hover {
        border-color: var(--border-strong, #4a5a70) !important;
        box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.25)), inset 0 1px 0 var(--card-highlight, rgba(255,255,255,0.08)) !important;
        transform: translateY(-1px);
      }
    </style>
  `;
}

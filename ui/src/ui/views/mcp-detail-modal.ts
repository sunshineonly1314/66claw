/**
 * mcp-detail-modal.ts
 * Capability detail modal — shows full info + "try saying" + install.
 *
 * Opened when user clicks a store card. Follows fm-modal pattern (centered
 * overlay, 540px max width, click-outside-to-close).
 */

import { html, nothing, type TemplateResult } from "lit";
import { t } from "../i18n/index.js";
import type { McpMarketplaceItem } from "../app-view-state.js";

export type McpDetailModalProps = {
  item: McpMarketplaceItem;
  onClose: () => void;
  onInstall: () => void;
  onConfigInstall: () => void;
  onUninstall: () => void;
  onUpdate: () => void;
  onTrySay: (prompt: string) => void;
};

/* ── helpers ────────────────────────────────────────────── */

const CATEGORY_EMOJI: Record<string, string> = {
  filesystem: "\u{1F4C1}",
  database: "\u{1F5C3}\uFE0F",
  search: "\u{1F50D}",
  productivity: "\u26A1",
  development: "\u{1F6E0}\uFE0F",
  network: "\u{1F310}",
  smarthome: "\u{1F3E0}",
  ai: "\u{1F916}",
  social: "\u{1F4F1}",
  other: "\u{1F527}",
};

function badgePill(bg: string, fg: string, label: string): TemplateResult {
  return html`<span style="
    font-size:10px; padding:2px 10px; border-radius:4px;
    background:${bg}; color:${fg}; white-space:nowrap;
  ">${label}</span>`;
}

/* ── main render ───────────────────────────────────────── */

export function renderMcpDetailModal(props: McpDetailModalProps): TemplateResult {
  const { item, onClose, onInstall, onConfigInstall, onUninstall, onUpdate, onTrySay } = props;
  const emoji = CATEGORY_EMOJI[item.category] ?? "\u{1F527}";
  const scoreColor = item.securityScore >= 80 ? "#34d399" : item.securityScore >= 60 ? "#fbbf24" : "#94a3b8";

  return html`
    <!-- Backdrop -->
    <div
      @click=${onClose}
      style="
        position:fixed; inset:0;
        background:rgba(0,0,0,0.55);
        z-index:9000;
        animation:mcpModalBgIn 200ms ease both;
      "
    ></div>

    <!-- Modal -->
    <div
      role="dialog"
      aria-modal="true"
      aria-label="${item.friendlyName}"
      style="
        position:fixed;
        top:50%; left:50%;
        transform:translate(-50%,-50%);
        width:min(540px, calc(100vw - 48px));
        max-height:85vh;
        overflow-y:auto;
        background:var(--bg, #0f0f0f);
        border:1px solid var(--border);
        border-radius:var(--radius-lg, 12px);
        z-index:9001;
        padding:28px 28px 24px;
        animation:mcpModalIn 250ms var(--ease-out, ease) both;
      "
      @click=${(e: Event) => e.stopPropagation()}
    >
      <!-- Close button -->
      <button
        @click=${onClose}
        aria-label="Close"
        style="
          all:unset; cursor:pointer;
          position:absolute; top:16px; right:16px;
          font-size:18px; color:var(--muted-strong, #6b7d91);
          width:28px; height:28px;
          display:flex; align-items:center; justify-content:center;
          border-radius:6px;
          transition:background 150ms;
        "
        class="mcp-modal-close"
      >&times;</button>

      <!-- Header: icon + name + version + badges -->
      <div style="display:flex; align-items:flex-start; gap:14px; margin-bottom:20px;">
        <div style="
          width:52px; height:52px; border-radius:12px;
          background:rgba(99,102,241,0.08);
          display:flex; align-items:center; justify-content:center;
          font-size:24px; flex-shrink:0;
        ">${emoji}</div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-size:17px; font-weight:700; color:var(--fg);">${item.friendlyName}</span>
            <span style="
              font-size:10px; padding:2px 8px; border-radius:4px;
              background:rgba(148,163,184,0.1); color:var(--muted-strong, #6b7d91);
            ">v${item.version}</span>
          </div>
          <div style="font-size:12px; color:var(--muted-strong, #6b7d91); margin-top:3px;">
            ${item.npmPackage}
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
            ${item.isOfficial
              ? badgePill("rgba(99,102,241,0.12)", "#818cf8", `\u{1F4E6} ${t("extensions.store.official")}`)
              : nothing}
            ${!item.requiresApiKey && item.installable !== false && item.installMethod !== "none"
              ? badgePill("rgba(52,211,153,0.12)", "#34d399", `\u26A1 ${t("extensions.store.zeroConfig")}`)
              : item.requiresApiKey
                ? badgePill("rgba(251,191,36,0.12)", "#fbbf24", `\u{1F511} ${t("extensions.store.needsKey")}`)
                : nothing}
            ${item.securityScore >= 60
              ? badgePill("rgba(52,211,153,0.08)", scoreColor, `\u{1F6E1}\uFE0F ${item.securityScore}`)
              : nothing}
          </div>
        </div>
      </div>

      <div style="border-top:1px solid var(--border); margin:0 -28px; padding:0 28px;"></div>

      <!-- Capabilities list -->
      ${item.capabilities && item.capabilities.length > 0
        ? html`
            <div style="margin-top:20px;">
              <div style="font-size:13px; font-weight:600; color:var(--fg); margin-bottom:10px;">
                ${t("extensions.detail.canHelp")}
              </div>
              <ul style="margin:0; padding-left:20px; font-size:13px; color:var(--fg-secondary, #a0aec0); line-height:1.8;">
                ${item.capabilities.map((c) => html`<li>${c}</li>`)}
              </ul>
            </div>
          `
        : html`
            <div style="margin-top:20px;">
              <div style="font-size:13px; font-weight:600; color:var(--fg); margin-bottom:10px;">
                ${t("extensions.detail.canHelp")}
              </div>
              <p style="font-size:13px; color:var(--fg-secondary, #a0aec0); line-height:1.6; margin:0;">
                ${item.description}
              </p>
            </div>
          `}

      <!-- API Key warning -->
      ${item.requiresApiKey
        ? html`
            <div style="
              margin-top:16px;
              padding:12px 14px;
              border-radius:8px;
              background:rgba(251,191,36,0.06);
              border:1px solid rgba(251,191,36,0.15);
              font-size:12px;
              color:var(--fg-secondary, #a0aec0);
            ">
              <div style="font-weight:600; color:#fbbf24; margin-bottom:6px;">
                \u26A0\uFE0F ${t("extensions.detail.needsKeyWarning")}
              </div>
              ${item.configHint
                ? html`<div style="font-size:11px; line-height:1.5; color:var(--muted-strong, #6b7d91); margin-bottom:6px;">
                    ${item.configHint}
                  </div>`
                : nothing}
              <details style="cursor:pointer;">
                <summary style="font-size:11px; color:var(--accent-2, #20d5bc); margin-bottom:6px;">
                  ${t("extensions.detail.whatIsApiKey")}
                </summary>
                <p style="margin:6px 0 0; font-size:11px; line-height:1.6; color:var(--muted-strong, #6b7d91);">
                  ${t("extensions.detail.apiKeyExplain")}
                </p>
              </details>
            </div>
          `
        : nothing}

      <div style="border-top:1px solid var(--border); margin:20px -28px 0; padding:0 28px;"></div>

      <!-- Try saying prompts -->
      ${item.examplePrompts && item.examplePrompts.length > 0
        ? html`
            <div style="margin-top:20px;">
              <div style="font-size:13px; font-weight:600; color:var(--fg); margin-bottom:10px;">
                ${t("extensions.detail.trySay")}
              </div>
              ${item.examplePrompts.map(
                (prompt) => html`
                  <button
                    @click=${() => { onTrySay(prompt); onClose(); }}
                    style="
                      all:unset; cursor:pointer;
                      display:flex;
                      align-items:center;
                      justify-content:space-between;
                      width:100%;
                      box-sizing:border-box;
                      padding:10px 14px;
                      margin-bottom:8px;
                      border-radius:8px;
                      border:1px solid var(--border);
                      font-size:12px;
                      color:var(--fg-secondary, #a0aec0);
                      transition:border-color 150ms, background 150ms;
                    "
                    class="mcp-prompt-btn"
                  >
                    <span>"${prompt}"</span>
                    <span style="
                      font-size:11px; font-weight:600;
                      color:var(--accent-2, #20d5bc);
                      flex-shrink:0; margin-left:12px;
                    ">${t("extensions.detail.sendToChat")} \u2192</span>
                  </button>
                `,
              )}
            </div>
          `
        : nothing}

      <div style="border-top:1px solid var(--border); margin:16px -28px 0; padding:0 28px;"></div>

      <!-- Collapsible detail info -->
      <details style="margin-top:16px;">
        <summary style="
          font-size:12px; font-weight:600;
          color:var(--muted-strong, #6b7d91);
          cursor:pointer; user-select:none;
        ">${t("extensions.detail.info")}</summary>
        <div style="margin-top:10px; font-size:12px; color:var(--fg-secondary, #a0aec0); line-height:2;">
          <div>${t("extensions.detail.source")}: <span style="color:var(--fg);">${item.installMethod ?? (item.npmPackage ? "npm" : item.sourceUrl ? "source" : "—")} &middot; ${item.npmPackage || item.sourceUrl || item.serverId}</span></div>
          <div>${t("extensions.detail.category")}: <span style="color:var(--fg);">${t(`extensions.category.${item.category}` as never)}</span></div>
          <div>${t("extensions.detail.platform")}: <span style="color:var(--fg);">${item.platforms.join(" / ")}</span></div>
          <div>${t("extensions.detail.transport")}: <span style="color:var(--fg);">stdio</span></div>
          <div>${t("extensions.detail.toolCount")}: <span style="color:var(--fg);">${item.toolCount}</span></div>
          ${item.securityScore >= 60
            ? html`<div>${t("extensions.detail.securityAudit")}: <span style="color:${scoreColor};">${t("extensions.detail.auditPassed")} (${item.securityScore})</span></div>`
            : nothing}
        </div>
      </details>

      <!-- Collapsible tool list -->
      ${item.toolNames && item.toolNames.length > 0
        ? html`
            <details style="margin-top:12px;">
              <summary style="
                font-size:12px; font-weight:600;
                color:var(--muted-strong, #6b7d91);
                cursor:pointer; user-select:none;
              ">${t("extensions.detail.toolsList")} (${item.toolNames.length})</summary>
              <div style="
                margin-top:8px;
                font-size:11px;
                color:var(--fg-secondary, #a0aec0);
                line-height:1.8;
                word-break:break-all;
              ">
                ${item.toolNames.join(" \u00B7 ")}
              </div>
            </details>
          `
        : nothing}

      <div style="border-top:1px solid var(--border); margin:20px -28px 0; padding:0 28px;"></div>

      <!-- Footer install/uninstall/update buttons -->
      <div style="margin-top:20px; text-align:center; display:flex; justify-content:center; gap:12px;">
        ${item.installStatus === "installed"
          ? html`
              ${item.hasUpdate
                ? html`
                    <button
                      @click=${() => { onUpdate(); onClose(); }}
                      style="
                        all:unset; cursor:pointer;
                        font-size:13px; font-weight:600;
                        padding:10px 32px;
                        border-radius:8px;
                        background:linear-gradient(135deg, #6366f1, #818cf8);
                        color:#fff;
                        transition:opacity 150ms;
                      "
                    >\u2B06\uFE0F ${t("extensions.detail.updateNow" as never)}</button>
                  `
                : html`
                    <button
                      @click=${onClose}
                      style="
                        all:unset; cursor:pointer;
                        font-size:13px; font-weight:600;
                        padding:10px 32px;
                        border-radius:8px;
                        background:rgba(52,211,153,0.1);
                        color:#34d399;
                      "
                    >&#10003; ${t("extensions.detail.installedManage")}</button>
                  `}
              <button
                @click=${() => {
                  if (confirm(t("extensions.detail.uninstallConfirm" as never).replace("{{name}}", item.friendlyName))) {
                    onUninstall();
                    onClose();
                  }
                }}
                style="
                  all:unset; cursor:pointer;
                  font-size:12px;
                  padding:10px 20px;
                  border-radius:8px;
                  border:1px solid rgba(248,113,113,0.2);
                  color:#f87171;
                "
              >${t("extensions.detail.uninstall" as never)}</button>
            `
          : item.installStatus === "installing"
            ? html`
                <span style="
                  font-size:13px; font-weight:600;
                  padding:10px 32px;
                  border-radius:8px;
                  background:rgba(99,102,241,0.1);
                  color:var(--accent, #6366f1);
                  display:inline-flex; align-items:center; gap:8px;
                ">
                  <span style="
                    width:12px;height:12px;
                    border:2px solid currentColor;
                    border-top-color:transparent;
                    border-radius:50%;
                    animation:mcpSpin 0.8s linear infinite;
                    display:inline-block;
                  "></span>
                  ${t("extensions.store.installing")}
                </span>
              `
            : item.installable === false
              ? html`
                  <a
                    href=${item.sourceUrl || ""}
                    target="_blank"
                    rel="noopener"
                    style="
                      all:unset; cursor:pointer;
                      font-size:13px; font-weight:600;
                      padding:10px 32px;
                      border-radius:8px;
                      background:rgba(148,163,184,0.12);
                      color:var(--muted-strong, #6b7d91);
                      text-decoration:none;
                      transition:opacity 150ms;
                    "
                  >${t("extensions.store.viewSource" as never)} \u2197</a>
                `
              : item.requiresApiKey
                ? html`
                    <button
                      @click=${() => { onConfigInstall(); }}
                      style="
                        all:unset; cursor:pointer;
                        font-size:13px; font-weight:600;
                        padding:10px 32px;
                        border-radius:8px;
                        background:linear-gradient(135deg, #fbbf24, #f59e0b);
                        color:#000;
                        transition:opacity 150ms;
                      "
                    >${t("extensions.store.configAndInstall")}</button>
                  `
                : html`
                    <button
                      @click=${onInstall}
                      style="
                        all:unset; cursor:pointer;
                        font-size:13px; font-weight:600;
                        padding:10px 32px;
                        border-radius:8px;
                        background:var(--accent, #6366f1);
                        color:#fff;
                        transition:opacity 150ms;
                      "
                    >${t("extensions.detail.installThis")}</button>
                  `}
      </div>
    </div>

    <style>
      @keyframes mcpModalBgIn {
        from { opacity:0; }
        to   { opacity:1; }
      }
      @keyframes mcpModalIn {
        from { opacity:0; transform:translate(-50%,-50%) scale(0.95); }
        to   { opacity:1; transform:translate(-50%,-50%) scale(1); }
      }
      @keyframes mcpSpin {
        to { transform:rotate(360deg); }
      }
      .mcp-modal-close:hover {
        background:rgba(148,163,184,0.1);
      }
      .mcp-prompt-btn:hover {
        border-color:var(--accent-2, #20d5bc) !important;
        background:rgba(32,213,188,0.04);
      }
    </style>
  `;
}

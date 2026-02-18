/**
 * mcp-batch-config.ts
 * Batch API Key configuration modal for MCP servers.
 *
 * Shows a table of all MCP servers requiring API keys, allowing users
 * to configure multiple keys at once. Unconfigured items are highlighted.
 */

import { html, nothing, type TemplateResult } from "lit";
import { t } from "../i18n/index.js";
import type { McpMarketplaceItem } from "../app-view-state.js";

// ============================================================================
// Types
// ============================================================================

export type McpBatchConfigProps = {
  /** All marketplace items that require API keys */
  items: McpMarketplaceItem[];
  /** Server env configuration status: { serverId: { envKey: boolean } } */
  serverEnvStatus: Record<string, Record<string, boolean>>;
  onClose: () => void;
  onSaveAll: (updates: Array<{ serverId: string; env: Record<string, string> }>) => void;
  saving: boolean;
  saveResult?: { success: number; failed: number } | null;
};

// ============================================================================
// Helpers
// ============================================================================

function isConfigured(
  item: McpMarketplaceItem,
  serverEnvStatus: Record<string, Record<string, boolean>>,
): boolean {
  const status = serverEnvStatus[item.serverId];
  if (!status) return false;
  const keyName = item.apiKeyName ?? "API_KEY";
  return !!status[keyName];
}

function collectUpdates(): Array<{ serverId: string; env: Record<string, string> }> {
  const updates: Array<{ serverId: string; env: Record<string, string> }> = [];
  const rows = document.querySelectorAll("[data-batch-server-id]");
  rows.forEach((row) => {
    const serverId = row.getAttribute("data-batch-server-id") ?? "";
    const keyName = row.getAttribute("data-batch-key-name") ?? "";
    const input = row.querySelector(".batch-key-input") as HTMLInputElement | null;
    const val = input?.value?.trim();
    if (serverId && keyName && val) {
      updates.push({ serverId, env: { [keyName]: val } });
    }
  });
  return updates;
}

// ============================================================================
// Render
// ============================================================================

export function renderMcpBatchConfig(props: McpBatchConfigProps): TemplateResult {
  const { items, serverEnvStatus, onClose, onSaveAll, saving, saveResult } = props;

  const needsKey = items.filter((i) => i.requiresApiKey);
  // Sort: unconfigured first, then configured
  const sorted = [...needsKey].sort((a, b) => {
    const aConf = isConfigured(a, serverEnvStatus) ? 1 : 0;
    const bConf = isConfigured(b, serverEnvStatus) ? 1 : 0;
    return aConf - bConf;
  });

  return html`
    <!-- Backdrop -->
    <div
      @click=${onClose}
      style="
        position:fixed; inset:0;
        background:rgba(0,0,0,0.55);
        z-index:9200;
        animation:batchCfgBgIn 200ms ease both;
      "
    ></div>

    <!-- Panel -->
    <div
      role="dialog"
      aria-modal="true"
      aria-label="${t("extensions.batchConfig.title" as never)}"
      style="
        position:fixed;
        top:50%; left:50%;
        transform:translate(-50%,-50%);
        width:min(680px, calc(100vw - 48px));
        max-height:85vh;
        overflow-y:auto;
        background:var(--bg, #0f0f0f);
        border:1px solid var(--border);
        border-radius:var(--radius-lg, 12px);
        z-index:9201;
        padding:28px;
        animation:batchCfgIn 250ms var(--ease-out, ease) both;
      "
      @click=${(e: Event) => e.stopPropagation()}
    >
      <!-- Close -->
      <button
        @click=${onClose}
        style="
          all:unset; cursor:pointer;
          position:absolute; top:16px; right:16px;
          font-size:18px; color:var(--muted-strong, #6b7d91);
          width:28px; height:28px;
          display:flex; align-items:center; justify-content:center;
          border-radius:6px;
        "
        class="batch-cfg-close"
      >&times;</button>

      <!-- Title -->
      <div style="font-size:16px; font-weight:700; color:var(--fg); margin-bottom:6px;">
        ${t("extensions.batchConfig.title" as never)}
      </div>
      <div style="font-size:12px; color:var(--muted-strong, #6b7d91); margin-bottom:20px;">
        ${t("extensions.batchConfig.subtitle" as never)}
      </div>

      <!-- Empty state -->
      ${sorted.length === 0
        ? html`
            <div style="
              padding:40px 20px;
              text-align:center;
              color:var(--muted-strong, #6b7d91);
              font-size:13px;
            ">
              ${t("extensions.batchConfig.empty" as never)}
            </div>
          `
        : html`
            <!-- Table header -->
            <div style="
              display:grid;
              grid-template-columns: 1fr 140px 1fr 50px 40px;
              gap:8px;
              padding:8px 0;
              border-bottom:1px solid var(--border);
              font-size:11px;
              font-weight:600;
              color:var(--muted-strong, #6b7d91);
              text-transform:uppercase;
              letter-spacing:0.5px;
            ">
              <span>${t("extensions.batchConfig.serverName" as never)}</span>
              <span>${t("extensions.batchConfig.apiKeyVar" as never)}</span>
              <span>${t("extensions.batchConfig.value" as never)}</span>
              <span>${t("extensions.batchConfig.guide" as never)}</span>
              <span style="text-align:center;">${t("extensions.batchConfig.status" as never)}</span>
            </div>

            <!-- Rows -->
            ${sorted.map((item) => {
              const keyName = item.apiKeyName ?? "API_KEY";
              const configured = isConfigured(item, serverEnvStatus);
              const isInstalled = item.installStatus === "installed";
              return html`
                <div
                  data-batch-server-id="${item.serverId}"
                  data-batch-key-name="${keyName}"
                  style="
                    display:grid;
                    grid-template-columns: 1fr 140px 1fr 50px 40px;
                    gap:8px;
                    padding:10px 0;
                    border-bottom:1px solid var(--border);
                    align-items:center;
                    opacity:${isInstalled ? "1" : "0.6"};
                  "
                >
                  <!-- Name -->
                  <div style="font-size:13px; color:var(--fg); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${item.friendlyName}
                    ${!isInstalled
                      ? html`<span style="font-size:10px; color:var(--muted-strong, #6b7d91); margin-left:4px;">(${t("extensions.store.install" as never)})</span>`
                      : nothing}
                  </div>

                  <!-- Key variable name -->
                  <div style="font-size:11px; color:var(--accent-2, #20d5bc); font-family:monospace;">
                    ${keyName}
                  </div>

                  <!-- Key input -->
                  <div style="position:relative;">
                    <input
                      type="password"
                      class="batch-key-input"
                      placeholder="${configured ? "••••••••" : keyName}"
                      autocomplete="off"
                      ?disabled=${!isInstalled}
                      style="
                        width:100%;
                        box-sizing:border-box;
                        padding:7px 32px 7px 10px;
                        border:1px solid var(--border);
                        border-radius:6px;
                        background:var(--card);
                        color:var(--fg);
                        font-size:12px;
                        outline:none;
                        transition:border-color 150ms;
                      "
                    />
                    <button
                      type="button"
                      @click=${(e: Event) => {
                        const btn = e.target as HTMLElement;
                        const container = btn.closest("div");
                        const input = container?.querySelector(".batch-key-input") as HTMLInputElement | null;
                        if (!input) return;
                        const isPassword = input.type === "password";
                        input.type = isPassword ? "text" : "password";
                        btn.textContent = isPassword ? "\u{1F441}" : "\u{1F441}\u200D\u{1F5E8}";
                      }}
                      style="
                        all:unset; cursor:pointer;
                        position:absolute;
                        right:8px;
                        top:50%;
                        transform:translateY(-50%);
                        font-size:12px;
                        color:var(--muted-strong, #6b7d91);
                        line-height:1;
                      "
                    >\u{1F441}\u200D\u{1F5E8}</button>
                  </div>

                  <!-- Guide link -->
                  <div style="text-align:center;">
                    ${item.apiKeyGuideUrl
                      ? html`<a
                          href=${item.apiKeyGuideUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style="font-size:12px; color:var(--accent-2, #20d5bc); text-decoration:none;"
                          title="${t("extensions.batchConfig.guide" as never)}"
                        >\u2197</a>`
                      : html`<span style="color:var(--muted-strong, #6b7d91);">—</span>`}
                  </div>

                  <!-- Status dot -->
                  <div style="text-align:center;">
                    <span
                      style="
                        display:inline-block;
                        width:8px; height:8px;
                        border-radius:50%;
                        background:${configured ? "#34d399" : "#fbbf24"};
                      "
                      title="${configured
                        ? t("extensions.batchConfig.configured" as never)
                        : t("extensions.batchConfig.unconfigured" as never)}"
                    ></span>
                  </div>
                </div>
              `;
            })}
          `}

      <!-- Save result -->
      ${saveResult
        ? html`
            <div style="
              padding:10px 14px;
              border-radius:8px;
              margin-top:16px;
              font-size:12px;
              background:${saveResult.failed === 0 ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)"};
              border:1px solid ${saveResult.failed === 0 ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)"};
              color:${saveResult.failed === 0 ? "#34d399" : "#f87171"};
            ">
              ${saveResult.success > 0
                ? html`<span>&#10003; ${saveResult.success} ${t("extensions.batchConfig.saved" as never)}</span>`
                : nothing}
              ${saveResult.failed > 0
                ? html`<span>&#10007; ${saveResult.failed} ${t("extensions.batchConfig.failed" as never)}</span>`
                : nothing}
            </div>
          `
        : nothing}

      <!-- Actions -->
      <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:20px; padding-top:16px; border-top:1px solid var(--border);">
        <button
          @click=${onClose}
          style="
            all:unset; cursor:pointer;
            font-size:12px; font-weight:600;
            padding:8px 20px;
            border-radius:8px;
            border:1px solid var(--border);
            color:var(--fg-secondary, #a0aec0);
          "
        >${t("common.cancel" as never)}</button>

        <button
          @click=${() => {
            const updates = collectUpdates();
            if (updates.length > 0) onSaveAll(updates);
          }}
          ?disabled=${saving || sorted.length === 0}
          style="
            all:unset; cursor:pointer;
            font-size:13px; font-weight:600;
            padding:8px 24px;
            border-radius:8px;
            background:var(--accent, #6366f1);
            color:#fff;
            transition:opacity 150ms;
            opacity:${saving ? "0.6" : "1"};
          "
        >
          ${saving
            ? html`<span style="
                width:12px;height:12px;
                border:2px solid #fff;
                border-top-color:transparent;
                border-radius:50%;
                animation:batchCfgSpin 0.8s linear infinite;
                display:inline-block;
                vertical-align:middle;
                margin-right:6px;
              "></span>`
            : nothing}
          ${t("extensions.batchConfig.saveAll" as never)}
        </button>
      </div>
    </div>

    <style>
      @keyframes batchCfgBgIn {
        from { opacity:0; }
        to   { opacity:1; }
      }
      @keyframes batchCfgIn {
        from { opacity:0; transform:translate(-50%,-50%) scale(0.95); }
        to   { opacity:1; transform:translate(-50%,-50%) scale(1); }
      }
      @keyframes batchCfgSpin {
        to { transform:rotate(360deg); }
      }
      .batch-cfg-close:hover {
        background:rgba(148,163,184,0.1);
      }
      .batch-key-input:focus {
        border-color:var(--accent, #6366f1) !important;
      }
    </style>
  `;
}

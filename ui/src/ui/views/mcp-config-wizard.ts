/**
 * mcp-config-wizard.ts
 * API Key configuration wizard modal for MCP capabilities that need setup.
 *
 * Design: 3-step flow (visit site → get key → paste here)
 * with test-connection button and advanced config fold.
 */

import { html, nothing, type TemplateResult } from "lit";
import { t } from "../i18n/index.js";
import type { McpMarketplaceItem } from "../app-view-state.js";

export type McpConfigWizardProps = {
  item: McpMarketplaceItem;
  onClose: () => void;
  onSaveAndEnable: (env: Record<string, string>) => void;
  onTestConnection: (env: Record<string, string>) => void;
  /** Test state managed by parent */
  testState: "idle" | "testing" | "success" | "error";
  testMessage?: string;
};

/* ── main render ───────────────────────────────────────── */

export function renderMcpConfigWizard(props: McpConfigWizardProps): TemplateResult {
  const { item, onClose, onSaveAndEnable, onTestConnection, testState, testMessage } = props;

  // Use apiKeyName for the primary field; fallback to generic
  const keyFieldName = item.apiKeyName ?? "API_KEY";

  return html`
    <!-- Backdrop -->
    <div
      @click=${onClose}
      style="
        position:fixed; inset:0;
        background:rgba(0,0,0,0.55);
        z-index:9100;
        animation:mcpWizBgIn 200ms ease both;
      "
    ></div>

    <!-- Wizard panel -->
    <div
      style="
        position:fixed;
        top:50%; left:50%;
        transform:translate(-50%,-50%);
        width:min(480px, calc(100vw - 48px));
        max-height:85vh;
        overflow-y:auto;
        background:var(--bg, #0f0f0f);
        border:1px solid var(--border);
        border-radius:var(--radius-lg, 12px);
        z-index:9101;
        padding:28px;
        animation:mcpWizIn 250ms var(--ease-out, ease) both;
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
        class="mcp-wiz-close"
      >&times;</button>

      <!-- Title -->
      <div style="font-size:16px; font-weight:700; color:var(--fg); margin-bottom:6px;">
        ${t("extensions.config.title").replace("{{name}}", item.friendlyName)}
      </div>
      <div style="font-size:12px; color:var(--muted-strong, #6b7d91); margin-bottom:24px;">
        ${t("extensions.config.steps").replace("{{name}}", item.friendlyName).replace("{{action}}", "")}
      </div>

      <!-- Step 1 -->
      <div style="display:flex; gap:12px; margin-bottom:18px;">
        <span style="
          width:24px; height:24px; border-radius:50%;
          background:var(--accent, #6366f1); color:#fff;
          display:flex; align-items:center; justify-content:center;
          font-size:12px; font-weight:700; flex-shrink:0;
        ">1</span>
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--fg);">
            ${t("extensions.config.step1")}
          </div>
          ${item.apiKeyGuideUrl
            ? html`
                <a
                  href=${item.apiKeyGuideUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style="
                    font-size:12px;
                    color:var(--accent-2, #20d5bc);
                    text-decoration:none;
                    display:inline-flex;
                    align-items:center;
                    gap:4px;
                    margin-top:4px;
                  "
                >${t("extensions.config.step1Action")} \u2197</a>
              `
            : nothing}
        </div>
      </div>

      <!-- Step 2 -->
      <div style="display:flex; gap:12px; margin-bottom:18px;">
        <span style="
          width:24px; height:24px; border-radius:50%;
          background:var(--accent, #6366f1); color:#fff;
          display:flex; align-items:center; justify-content:center;
          font-size:12px; font-weight:700; flex-shrink:0;
        ">2</span>
        <div style="font-size:13px; font-weight:600; color:var(--fg);">
          ${t("extensions.config.step2")}
        </div>
      </div>

      <!-- Step 3: key input -->
      <div style="display:flex; gap:12px; margin-bottom:20px;">
        <span style="
          width:24px; height:24px; border-radius:50%;
          background:var(--accent, #6366f1); color:#fff;
          display:flex; align-items:center; justify-content:center;
          font-size:12px; font-weight:700; flex-shrink:0;
        ">3</span>
        <div style="flex:1;">
          <div style="font-size:13px; font-weight:600; color:var(--fg); margin-bottom:8px;">
            ${t("extensions.config.step3")}
          </div>
          <input
            id="mcp-api-key-input"
            type="password"
            placeholder="${keyFieldName}"
            style="
              width:100%;
              box-sizing:border-box;
              padding:10px 14px;
              border:1px solid var(--border);
              border-radius:8px;
              background:var(--card);
              color:var(--fg);
              font-size:13px;
              outline:none;
              transition:border-color 150ms;
            "
            class="mcp-key-input"
          />
          <div style="
            font-size:11px;
            color:var(--muted-strong, #6b7d91);
            margin-top:6px;
            display:flex; align-items:center; gap:4px;
          ">
            \u{1F512} ${t("extensions.config.keyLocal")}
          </div>
        </div>
      </div>

      <!-- Test connection result -->
      ${testState !== "idle"
        ? html`
            <div style="
              padding:10px 14px;
              border-radius:8px;
              margin-bottom:16px;
              font-size:12px;
              background:${testState === "success"
                ? "rgba(52,211,153,0.08)"
                : testState === "error"
                  ? "rgba(248,113,113,0.08)"
                  : "rgba(99,102,241,0.06)"};
              border:1px solid ${testState === "success"
                ? "rgba(52,211,153,0.15)"
                : testState === "error"
                  ? "rgba(248,113,113,0.15)"
                  : "rgba(99,102,241,0.1)"};
              color:${testState === "success"
                ? "#34d399"
                : testState === "error"
                  ? "#f87171"
                  : "var(--accent, #6366f1)"};
              display:flex; align-items:center; gap:8px;
            ">
              ${testState === "testing"
                ? html`<span style="
                    width:12px;height:12px;
                    border:2px solid currentColor;
                    border-top-color:transparent;
                    border-radius:50%;
                    animation:mcpSpin 0.8s linear infinite;
                    display:inline-block;
                  "></span>`
                : testState === "success"
                  ? html`<span>&#10003;</span>`
                  : html`<span>&#10007;</span>`}
              <span>${testMessage ?? (testState === "testing"
                ? t("extensions.config.testConnection")
                : testState === "success"
                  ? t("extensions.config.testSuccess")
                  : t("extensions.config.testFailed"))}</span>
            </div>
          `
        : nothing}

      <!-- Action buttons -->
      <div style="display:flex; gap:12px; justify-content:flex-end; border-top:1px solid var(--border); padding-top:20px;">
        <button
          @click=${() => {
            const input = document.getElementById("mcp-api-key-input") as HTMLInputElement | null;
            const val = input?.value?.trim() ?? "";
            if (val) onTestConnection({ [keyFieldName]: val });
          }}
          style="
            all:unset; cursor:pointer;
            font-size:12px; font-weight:600;
            padding:8px 20px;
            border-radius:8px;
            border:1px solid var(--border);
            color:var(--fg-secondary, #a0aec0);
            transition:border-color 150ms;
          "
        >${t("extensions.config.testConnection")}</button>

        <button
          @click=${() => {
            const input = document.getElementById("mcp-api-key-input") as HTMLInputElement | null;
            const val = input?.value?.trim() ?? "";
            if (val) onSaveAndEnable({ [keyFieldName]: val });
          }}
          style="
            all:unset; cursor:pointer;
            font-size:13px; font-weight:600;
            padding:8px 24px;
            border-radius:8px;
            background:var(--accent, #6366f1);
            color:#fff;
            transition:opacity 150ms;
          "
        >${t("extensions.config.saveAndEnable")}</button>
      </div>

      <!-- Advanced config (collapsed) -->
      <details style="margin-top:20px;">
        <summary style="
          font-size:12px; font-weight:600;
          color:var(--muted-strong, #6b7d91);
          cursor:pointer; user-select:none;
        ">${t("extensions.config.advancedConfig")}</summary>
        <div style="margin-top:12px;">
          <!-- Additional env vars table -->
          <div style="font-size:11px; color:var(--muted-strong, #6b7d91); margin-bottom:8px;">
            ${t("extensions.config.envVars")}
          </div>
          <div id="mcp-extra-env" style="
            background:var(--card);
            border:1px solid var(--border);
            border-radius:8px;
            padding:12px;
            font-size:12px;
            color:var(--fg-secondary, #a0aec0);
          ">
            <div style="display:flex; gap:8px; margin-bottom:8px;">
              <input
                placeholder="KEY"
                style="
                  flex:1; padding:6px 10px;
                  border:1px solid var(--border); border-radius:6px;
                  background:transparent; color:var(--fg); font-size:11px;
                  outline:none;
                "
              />
              <input
                placeholder="VALUE"
                style="
                  flex:1; padding:6px 10px;
                  border:1px solid var(--border); border-radius:6px;
                  background:transparent; color:var(--fg); font-size:11px;
                  outline:none;
                "
              />
            </div>
            <button style="
              all:unset; cursor:pointer;
              font-size:11px; color:var(--accent-2, #20d5bc);
            ">+ ${t("extensions.config.addEnvVar")}</button>
          </div>

          <!-- Timeout -->
          <div style="margin-top:14px; display:flex; align-items:center; gap:10px;">
            <span style="font-size:11px; color:var(--muted-strong, #6b7d91);">
              ${t("extensions.config.timeout")}
            </span>
            <input
              type="number"
              value="30"
              min="5"
              max="300"
              style="
                width:60px; padding:6px 10px;
                border:1px solid var(--border); border-radius:6px;
                background:transparent; color:var(--fg); font-size:11px;
                outline:none; text-align:center;
              "
            />
            <span style="font-size:11px; color:var(--muted-strong, #6b7d91);">s</span>
          </div>
        </div>
      </details>
    </div>

    <style>
      @keyframes mcpWizBgIn {
        from { opacity:0; }
        to   { opacity:1; }
      }
      @keyframes mcpWizIn {
        from { opacity:0; transform:translate(-50%,-50%) scale(0.95); }
        to   { opacity:1; transform:translate(-50%,-50%) scale(1); }
      }
      @keyframes mcpSpin {
        to { transform:rotate(360deg); }
      }
      .mcp-wiz-close:hover {
        background:rgba(148,163,184,0.1);
      }
      .mcp-key-input:focus {
        border-color:var(--accent, #6366f1) !important;
      }
    </style>
  `;
}

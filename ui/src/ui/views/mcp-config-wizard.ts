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

export type McpInstallOverrides = {
  sseUrl?: string;
  npmPackage?: string;
  pypiPackage?: string;
};

export type McpConfigWizardProps = {
  item: McpMarketplaceItem;
  onClose: () => void;
  onSaveAndEnable: (env: Record<string, string>, overrides?: McpInstallOverrides) => void;
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
      role="dialog"
      aria-modal="true"
      aria-label="${t("extensions.config.title").replace("{{name}}", item.friendlyName)}"
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

      <!-- Install method override (shown only for items without install info) -->
      ${item.installable === false ? html`
        <div style="
          background:var(--card, #1a1a2e);
          border:1px solid var(--border);
          border-radius:8px;
          padding:16px;
          margin-bottom:20px;
        ">
          <div style="font-size:13px; font-weight:600; color:var(--fg); margin-bottom:10px;">
            ${t("extensions.config.installMethod" as never)}
          </div>
          <div style="font-size:11px; color:var(--muted-strong, #6b7d91); margin-bottom:12px;">
            ${t("extensions.config.installMethodHint" as never)}
          </div>
          <div style="display:flex; gap:8px; margin-bottom:12px;">
            ${["sse", "npm", "pypi"].map((m) => html`
              <label style="
                display:flex; align-items:center; gap:4px;
                font-size:12px; color:var(--fg-secondary, #a0aec0);
                cursor:pointer;
              ">
                <input
                  type="radio"
                  name="mcp-install-method"
                  value=${m}
                  ?checked=${m === "sse"}
                  @change=${(e: Event) => {
                    const radio = e.target as HTMLInputElement;
                    const container = radio.closest("[role=dialog]");
                    const sseInput = container?.querySelector("#mcp-override-sse") as HTMLElement | null;
                    const npmInput = container?.querySelector("#mcp-override-npm") as HTMLElement | null;
                    const pypiInput = container?.querySelector("#mcp-override-pypi") as HTMLElement | null;
                    if (sseInput) sseInput.style.display = radio.value === "sse" ? "block" : "none";
                    if (npmInput) npmInput.style.display = radio.value === "npm" ? "block" : "none";
                    if (pypiInput) pypiInput.style.display = radio.value === "pypi" ? "block" : "none";
                  }}
                  style="accent-color:var(--accent, #6366f1);"
                />
                ${m === "sse" ? "SSE" : m === "npm" ? "npm" : "PyPI"}
              </label>
            `)}
          </div>
          <div id="mcp-override-sse" style="display:block;">
            <input
              id="mcp-override-sse-input"
              type="text"
              placeholder="https://example.com/mcp/sse"
              style="
                width:100%; box-sizing:border-box;
                padding:8px 12px;
                border:1px solid var(--border); border-radius:6px;
                background:transparent; color:var(--fg); font-size:12px;
                outline:none;
              "
            />
          </div>
          <div id="mcp-override-npm" style="display:none;">
            <input
              id="mcp-override-npm-input"
              type="text"
              placeholder="@scope/package-name"
              style="
                width:100%; box-sizing:border-box;
                padding:8px 12px;
                border:1px solid var(--border); border-radius:6px;
                background:transparent; color:var(--fg); font-size:12px;
                outline:none;
              "
            />
          </div>
          <div id="mcp-override-pypi" style="display:none;">
            <input
              id="mcp-override-pypi-input"
              type="text"
              placeholder="package-name"
              style="
                width:100%; box-sizing:border-box;
                padding:8px 12px;
                border:1px solid var(--border); border-radius:6px;
                background:transparent; color:var(--fg); font-size:12px;
                outline:none;
              "
            />
          </div>
        </div>
      ` : nothing}

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
          <div style="position:relative;">
            <input
              id="mcp-api-key-input"
              type="password"
              placeholder="${keyFieldName}"
              autocomplete="off"
              style="
                width:100%;
                box-sizing:border-box;
                padding:10px 40px 10px 14px;
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
            <button
              type="button"
              @click=${(e: Event) => {
                const btn = e.target as HTMLElement;
                const container = btn.closest("div");
                const input = container?.querySelector("#mcp-api-key-input") as HTMLInputElement | null;
                if (!input) return;
                const isPassword = input.type === "password";
                input.type = isPassword ? "text" : "password";
                btn.textContent = isPassword ? "\u{1F441}" : "\u{1F441}\u200D\u{1F5E8}";
              }}
              style="
                all:unset; cursor:pointer;
                position:absolute;
                right:10px;
                top:50%;
                transform:translateY(-50%);
                font-size:14px;
                color:var(--muted-strong, #6b7d91);
                padding:2px;
                line-height:1;
              "
              title="${t("extensions.config.toggleVisibility" as never)}"
            >\u{1F441}\u200D\u{1F5E8}</button>
          </div>
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
            // API key is optional for manual-config items (installable === false)
            if (!val && item.installable !== false) return;
            // Collect extra env vars from advanced config
            const env: Record<string, string> = {};
            if (val) env[keyFieldName] = val;
            const extraContainer = document.getElementById("mcp-extra-env");
            if (extraContainer) {
              // Template row (always present)
              const templateRow = extraContainer.querySelector(".mcp-env-row-template");
              if (templateRow) {
                const k = (templateRow.querySelector(".mcp-env-key") as HTMLInputElement)?.value?.trim();
                const v = (templateRow.querySelector(".mcp-env-val") as HTMLInputElement)?.value?.trim();
                if (k && v) env[k] = v;
              }
              // Dynamic rows
              const dynamicRows = extraContainer.querySelectorAll("#mcp-env-rows > div");
              dynamicRows.forEach((row) => {
                const k = (row.querySelector(".mcp-env-key") as HTMLInputElement)?.value?.trim();
                const v = (row.querySelector(".mcp-env-val") as HTMLInputElement)?.value?.trim();
                if (k && v) env[k] = v;
              });
            }
            // Collect install method overrides (for manual-config items)
            const overrides: McpInstallOverrides = {};
            const sseInput = document.getElementById("mcp-override-sse-input") as HTMLInputElement | null;
            const npmInput = document.getElementById("mcp-override-npm-input") as HTMLInputElement | null;
            const pypiInput = document.getElementById("mcp-override-pypi-input") as HTMLInputElement | null;
            const selectedMethod = (document.querySelector('input[name="mcp-install-method"]:checked') as HTMLInputElement)?.value;
            if (selectedMethod === "sse" && sseInput?.value?.trim()) {
              overrides.sseUrl = sseInput.value.trim();
            } else if (selectedMethod === "npm" && npmInput?.value?.trim()) {
              overrides.npmPackage = npmInput.value.trim();
            } else if (selectedMethod === "pypi" && pypiInput?.value?.trim()) {
              overrides.pypiPackage = pypiInput.value.trim();
            }
            onSaveAndEnable(env, Object.keys(overrides).length > 0 ? overrides : undefined);
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
            <div id="mcp-env-rows"></div>
            <div style="display:flex; gap:8px; margin-bottom:8px;" class="mcp-env-row-template">
              <input
                placeholder="KEY"
                class="mcp-env-key"
                style="
                  flex:1; padding:6px 10px;
                  border:1px solid var(--border); border-radius:6px;
                  background:transparent; color:var(--fg); font-size:11px;
                  outline:none;
                "
              />
              <input
                placeholder="VALUE"
                class="mcp-env-val"
                style="
                  flex:1; padding:6px 10px;
                  border:1px solid var(--border); border-radius:6px;
                  background:transparent; color:var(--fg); font-size:11px;
                  outline:none;
                "
              />
            </div>
            <button
              @click=${(e: Event) => {
                const container = (e.target as HTMLElement).closest("#mcp-extra-env");
                const rows = container?.querySelector("#mcp-env-rows");
                if (!rows) return;
                const row = document.createElement("div");
                row.style.cssText = "display:flex; gap:8px; margin-bottom:8px;";

                // Create elements via DOM API instead of innerHTML (prevents XSS)
                const keyInput = document.createElement("input");
                keyInput.placeholder = "KEY";
                keyInput.className = "mcp-env-key";
                keyInput.style.cssText = "flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:6px; background:transparent; color:var(--fg); font-size:11px; outline:none;";

                const valInput = document.createElement("input");
                valInput.placeholder = "VALUE";
                valInput.className = "mcp-env-val";
                valInput.style.cssText = "flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:6px; background:transparent; color:var(--fg); font-size:11px; outline:none;";

                const removeBtn = document.createElement("button");
                removeBtn.style.cssText = "all:unset; cursor:pointer; font-size:14px; color:var(--muted-strong, #6b7d91); padding:0 4px;";
                removeBtn.textContent = "\u00D7";
                removeBtn.addEventListener("click", () => row.remove());

                row.appendChild(keyInput);
                row.appendChild(valInput);
                row.appendChild(removeBtn);
                rows.appendChild(row);
              }}
              style="
                all:unset; cursor:pointer;
                font-size:11px; color:var(--accent-2, #20d5bc);
              "
            >+ ${t("extensions.config.addEnvVar")}</button>
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

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

/* ── Collect env field values from the dynamic form ────── */

function collectEnvFields(e: Event): Record<string, string> {
  const dialog = (e.target as HTMLElement).closest("[role=dialog]");
  if (!dialog) return {};
  const env: Record<string, string> = {};
  const inputs = dialog.querySelectorAll<HTMLInputElement>(".mcp-env-field");
  inputs.forEach((input) => {
    const key = input.dataset.envKey;
    const val = input.value?.trim();
    if (key && val) env[key] = val;
  });
  return env;
}

/* ── main render ───────────────────────────────────────── */

export function renderMcpConfigWizard(props: McpConfigWizardProps): TemplateResult {
  const { item, onClose, onSaveAndEnable, onTestConnection, testState, testMessage } = props;

  // Build the list of env fields to show:
  // If envSchema exists, use it; otherwise fall back to single apiKeyName
  const envFields: Array<{ key: string; description: string; placeholder: string; required: boolean }> = [];
  if (item.envSchema && Object.keys(item.envSchema).length > 0) {
    const requiredSet = new Set(item.envRequired ?? []);
    // If envRequired is empty, treat credential-looking keys as required
    const inferRequired = requiredSet.size === 0;
    for (const [key, schema] of Object.entries(item.envSchema)) {
      const looksRequired = inferRequired && /KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|AUTH|API/i.test(key);
      envFields.push({
        key,
        description: schema.description ?? "",
        placeholder: schema.placeholder ?? key,
        required: requiredSet.has(key) || looksRequired,
      });
    }
  } else if (item.apiKeyName || item.requiresApiKey) {
    const keyFieldName = item.apiKeyName ?? "API_KEY";
    envFields.push({
      key: keyFieldName,
      description: "",
      placeholder: keyFieldName,
      required: true,
    });
  }

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
        width:min(520px, calc(100vw - 48px));
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
        ${envFields.length > 0
          ? html`${item.friendlyName} ${t("extensions.config.needsEnvVars" as never)}`
          : html`${t("extensions.config.configAdvanced" as never)}`}
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

      <!-- API Key registration guide (when env fields exist and we have a guide URL or configHint) -->
      ${envFields.length > 0 && (item.apiKeyGuideUrl || item.configHint || envFields.some(f => f.placeholder && /^https?:\/\//.test(f.placeholder)))
        ? html`
          <div style="
            background:rgba(251,191,36,0.04);
            border:1px solid rgba(251,191,36,0.12);
            border-radius:8px;
            padding:12px 14px;
            margin-bottom:16px;
            font-size:12px;
            color:var(--fg-secondary, #a0aec0);
          ">
            ${item.configHint
              ? html`<div style="font-size:11px; line-height:1.5; margin-bottom:${item.apiKeyGuideUrl ? "8" : "0"}px;">
                  ${item.configHint}
                </div>`
              : nothing}
            ${(() => {
              const guideUrl = item.apiKeyGuideUrl
                || envFields.map(f => f.placeholder).find(p => p && /^https?:\/\//.test(p));
              return guideUrl
                ? html`<a
                    href=${guideUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style="font-size:12px; color:var(--accent-2, #20d5bc); text-decoration:none; display:inline-flex; align-items:center; gap:4px;"
                  >${t("extensions.config.step1Action")} \u2197</a>`
                : nothing;
            })()}
          </div>
        ` : nothing}

      <!-- Dynamic env var form based on envSchema -->
      ${envFields.length > 0 ? html`
        <div style="
          background:var(--card, #1a1a2e);
          border:1px solid var(--border);
          border-radius:8px;
          padding:16px;
          margin-bottom:20px;
        ">
          ${envFields.map((field, idx) => html`
            <div style="margin-bottom:${idx < envFields.length - 1 ? "14px" : "0"};">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <span style="
                  font-size:12px; font-weight:600; color:var(--fg);
                  font-family:monospace;
                ">${field.key}</span>
                ${field.required ? html`<span style="
                  font-size:9px; padding:1px 6px; border-radius:3px;
                  background:rgba(248,113,113,0.12); color:#f87171;
                ">${t("extensions.config.required" as never)}</span>` : html`<span style="
                  font-size:9px; padding:1px 6px; border-radius:3px;
                  background:rgba(148,163,184,0.08); color:#6b7d91;
                ">${t("extensions.config.optional" as never)}</span>`}
              </div>
              ${field.description ? html`<div style="
                font-size:11px; color:var(--muted-strong, #6b7d91);
                margin-bottom:6px; line-height:1.4;
              ">${field.description}</div>` : nothing}
              <input
                class="mcp-env-field"
                data-env-key="${field.key}"
                type="password"
                placeholder="${field.placeholder}"
                autocomplete="off"
                style="
                  width:100%; box-sizing:border-box;
                  padding:8px 12px;
                  border:1px solid var(--border);
                  border-radius:6px;
                  background:transparent; color:var(--fg);
                  font-size:12px; outline:none;
                  transition:border-color 150ms;
                "
              />
            </div>
          `)}
          <div style="
            font-size:10px; color:var(--muted-strong, #6b7d91);
            margin-top:10px; display:flex; align-items:center; gap:4px;
          ">
            \u{1F512} ${t("extensions.config.keyLocal")}
          </div>
        </div>
      ` : html`
        <!-- No env fields: show a hint that env vars can be added below -->
        <div style="
          font-size:12px; color:var(--muted-strong, #6b7d91);
          margin-bottom:16px; line-height:1.5;
          padding:10px 14px;
          background:rgba(99,102,241,0.04);
          border:1px solid rgba(99,102,241,0.1);
          border-radius:8px;
        ">
          ${t("extensions.config.noEnvHint" as never)}
          ${item.sourceUrl ? html`<br/><a
            href=${item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style="font-size:12px; color:var(--accent-2, #20d5bc); text-decoration:none; margin-top:4px; display:inline-block;"
          >${t("extensions.store.viewSource" as never)} \u2197</a>` : nothing}
        </div>
      `}

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
          @click=${(e: Event) => {
            const env = collectEnvFields(e);
            if (Object.keys(env).length > 0) onTestConnection(env);
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
          @click=${(e: Event) => {
            const env = collectEnvFields(e);
            // For manual-config items, env is optional; otherwise need at least one value
            if (Object.keys(env).length === 0 && item.installable !== false) return;
            // Merge extra env vars from advanced config
            const extraContainer = document.getElementById("mcp-extra-env");
            if (extraContainer) {
              const templateRow = extraContainer.querySelector(".mcp-env-row-template");
              if (templateRow) {
                const k = (templateRow.querySelector(".mcp-env-key") as HTMLInputElement)?.value?.trim();
                const v = (templateRow.querySelector(".mcp-env-val") as HTMLInputElement)?.value?.trim();
                if (k && v) env[k] = v;
              }
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

import { html } from "lit";
import type { GatewayHelloOk } from "../gateway.ts";
import type { UiSettings } from "../storage.ts";
import { formatRelativeTimestamp, formatDurationHuman } from "../format.ts";
import { formatNextRun } from "../presenter.ts";
import { t } from "../i18n/index.js";

export type OverviewProps = {
  connected: boolean;
  hello: GatewayHelloOk | null;
  settings: UiSettings;
  password: string;
  lastError: string | null;
  presenceCount: number;
  sessionsCount: number | null;
  cronEnabled: boolean | null;
  cronNext: number | null;
  lastChannelsRefresh: number | null;
  onSettingsChange: (next: UiSettings) => void;
  onPasswordChange: (next: string) => void;
  onSessionKeyChange: (next: string) => void;
  onConnect: () => void;
  onRefresh: () => void;
};

export function renderOverview(props: OverviewProps) {
  const snapshot = props.hello?.snapshot as
    | {
        uptimeMs?: number;
        policy?: { tickIntervalMs?: number };
        authMode?: "none" | "token" | "password" | "trusted-proxy";
      }
    | undefined;
  const uptime = snapshot?.uptimeMs ? formatDurationHuman(snapshot.uptimeMs) : "n/a";
  const tick = snapshot?.policy?.tickIntervalMs ? `${snapshot.policy.tickIntervalMs}ms` : "n/a";
  const authMode = snapshot?.authMode;
  const isTrustedProxy = authMode === "trusted-proxy";
  const authHint = (() => {
    if (props.connected || !props.lastError) {
      return null;
    }
    const lower = props.lastError.toLowerCase();
    const authFailed = lower.includes("unauthorized") || lower.includes("connect failed");
    if (!authFailed) {
      return null;
    }
    const hasToken = Boolean(props.settings.token.trim());
    const hasPassword = Boolean(props.password.trim());
    if (!hasToken && !hasPassword) {
      return html`
        <div class="muted" style="margin-top: 8px">
          ${t("overview.authRequiredHint")}
          <div style="margin-top: 6px">
            <span class="mono">openclawcn dashboard --no-open</span> → open the Control UI<br />
            <span class="mono">openclawcn doctor --generate-gateway-token</span> → set token
          </div>
          <div style="margin-top: 6px">
            <a
              class="session-link"
              href="https://docs.openclawcn.com/web/dashboard"
              target="_blank"
              rel="noreferrer"
              title="${t("overview.authDocs")}"
              >${t("overview.authDocs")}</a
            >
          </div>
        </div>
      `;
    }
    return html`
      <div class="muted" style="margin-top: 8px">
        ${t("overview.authFailedHint")}
        <div style="margin-top: 6px">
          <a
            class="session-link"
            href="https://docs.openclawcn.com/web/dashboard"
            target="_blank"
            rel="noreferrer"
            title="${t("overview.authDocs")}"
            >${t("overview.authDocs")}</a
          >
        </div>
      </div>
    `;
  })();
  const insecureContextHint = (() => {
    if (props.connected || !props.lastError) {
      return null;
    }
    const isSecureContext = typeof window !== "undefined" ? window.isSecureContext : true;
    if (isSecureContext) {
      return null;
    }
    const lower = props.lastError.toLowerCase();
    if (!lower.includes("secure context") && !lower.includes("device identity required")) {
      return null;
    }
    return html`
      <div class="muted" style="margin-top: 8px">
        ${t("overview.insecureHint")}
        <div style="margin-top: 6px">
          ${t("overview.insecureAllowHttp")}
          <span class="mono">gateway.controlUi.allowInsecureAuth: true</span> ${t("overview.insecureAllowHttpSuffix")}
        </div>
        <div style="margin-top: 6px">
          <a
            class="session-link"
            href="https://docs.openclawcn.com/gateway/tailscale"
            target="_blank"
            rel="noreferrer"
            title="${t("overview.docsTailscale")}"
            >${t("overview.docsTailscale")}</a
          >
          <span class="muted"> · </span>
          <a
            class="session-link"
            href="https://docs.openclawcn.com/web/control-ui#insecure-http"
            target="_blank"
            rel="noreferrer"
            title="${t("overview.docsInsecureHttp")}"
            >${t("overview.docsInsecureHttp")}</a
          >
        </div>
      </div>
    `;
  })();

  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">${t("overview.gatewayAccessTitle")}</div>
        <div class="card-sub">${t("overview.gatewayAccessSub")}</div>
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>${t("overview.websocketUrl")}</span>
            <input
              .value=${props.settings.gatewayUrl}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSettingsChange({ ...props.settings, gatewayUrl: v });
              }}
              placeholder="ws://100.x.y.z:18789"
            />
          </label>
          ${
            isTrustedProxy
              ? ""
              : html`
                <label class="field">
                  <span>${t("overview.gatewayToken")}</span>
                  <input
                    .value=${props.settings.token}
                    @input=${(e: Event) => {
                      const v = (e.target as HTMLInputElement).value;
                      props.onSettingsChange({ ...props.settings, token: v });
                    }}
                    placeholder="OPENCLAWCN_GATEWAY_TOKEN"
                  />
                </label>
                <label class="field">
                  <span>${t("overview.passwordNotStored")}</span>
                  <input
                    type="password"
                    .value=${props.password}
                    @input=${(e: Event) => {
                      const v = (e.target as HTMLInputElement).value;
                      props.onPasswordChange(v);
                    }}
                    placeholder="${t("overview.password")}"
                  />
                </label>
              `
          }
          <label class="field">
            <span>${t("overview.defaultSessionKey")}</span>
            <input
              .value=${props.settings.sessionKey}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSessionKeyChange(v);
              }}
            />
          </label>
        </div>
        <div class="row" style="margin-top: 14px;">
          <button class="btn" @click=${() => props.onConnect()}>${t("overview.connect")}</button>
          <button class="btn" @click=${() => props.onRefresh()}>${t("overview.refresh")}</button>
          <span class="muted">${isTrustedProxy ? t("overview.trustedProxy") : t("overview.clickConnect")}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${t("overview.snapshotTitle")}</div>
        <div class="card-sub">${t("overview.snapshotSub")}</div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">${t("overview.status")}</div>
            <div class="stat-value ${props.connected ? "ok" : "warn"}">
              ${props.connected ? t("overview.connected") : t("overview.disconnected")}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("overview.uptime")}</div>
            <div class="stat-value">${uptime}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("overview.tickInterval")}</div>
            <div class="stat-value">${tick}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("overview.lastChannelsRefresh")}</div>
            <div class="stat-value">
              ${props.lastChannelsRefresh ? formatRelativeTimestamp(props.lastChannelsRefresh) : "n/a"}
            </div>
          </div>
        </div>
        ${
          props.lastError
            ? html`<div class="callout danger" style="margin-top: 14px;">
              <div>${props.lastError}</div>
              ${authHint ?? ""}
              ${insecureContextHint ?? ""}
            </div>`
            : html`
                <div class="callout" style="margin-top: 14px">
                  ${t("overview.channelsHint")}
                </div>
              `
        }
      </div>
    </section>

    <section class="grid grid-cols-3" style="margin-top: 18px;">
      <div class="card stat-card">
        <div class="stat-label">${t("overview.instances")}</div>
        <div class="stat-value">${props.presenceCount}</div>
        <div class="muted">${t("overview.presenceDesc")}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">${t("overview.sessions")}</div>
        <div class="stat-value">${props.sessionsCount ?? "n/a"}</div>
        <div class="muted">${t("overview.sessionsDesc")}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">${t("overview.cronLabel")}</div>
        <div class="stat-value">
          ${props.cronEnabled == null ? "n/a" : props.cronEnabled ? t("overview.enabled") : t("overview.disabled")}
        </div>
        <div class="muted">${t("overview.nextWake")} ${formatNextRun(props.cronNext)}</div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">${t("overview.notesTitle")}</div>
      <div class="card-sub">${t("overview.notesSub")}</div>
      <div class="note-grid" style="margin-top: 14px;">
        <div>
          <div class="note-title">${t("overview.noteTailscaleTitle")}</div>
          <div class="muted">
            ${t("overview.noteTailscaleBody")}
          </div>
        </div>
        <div>
          <div class="note-title">${t("overview.noteSessionTitle")}</div>
          <div class="muted">${t("overview.noteSessionBody")}</div>
        </div>
        <div>
          <div class="note-title">${t("overview.noteCronTitle")}</div>
          <div class="muted">${t("overview.noteCronBody")}</div>
        </div>
      </div>
    </section>
  `;
}

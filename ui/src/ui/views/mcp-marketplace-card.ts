/**
 * mcp-marketplace-card.ts
 * Store card component for the MCP Capability Store tab.
 *
 * Shows: icon + friendly name + version + security score + description
 *        + tags + badges + install button (state machine)
 */

import { html, nothing, type TemplateResult } from "lit";
import { t } from "../i18n/index.js";
import type { McpMarketplaceItem } from "../app-view-state.js";
import { CATEGORY_EMOJI } from "./mcp-shared.js";

export type MarketplaceCardProps = {
  item: McpMarketplaceItem;
  onClick: () => void;
  onInstall: () => void;
  onConfigInstall: () => void;
};

/* ── Platform compatibility check (Fix #11) ───────────── */

function detectCurrentPlatform(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  return "linux";
}

function isPlatformCompatible(item: McpMarketplaceItem): boolean {
  if (!item.platforms || item.platforms.length === 0) return true;
  return item.platforms.includes(detectCurrentPlatform());
}

/* ── Install button state machine ──────────────────────── */

function renderInstallButton(
  item: McpMarketplaceItem,
  onInstall: () => void,
  onConfigInstall: () => void,
): TemplateResult {
  // Fix #11: Platform check — show disabled label if incompatible
  if (!isPlatformCompatible(item)) {
    const label = item.platforms.map((p) =>
      p === "macos" ? "macOS" : p === "windows" ? "Windows" : "Linux",
    ).join(" / ");
    return html`
      <span style="
        font-size:10px;
        padding:5px 12px;
        border-radius:6px;
        background:rgba(148,163,184,0.08);
        color:var(--muted-strong, #6b7d91);
        cursor:not-allowed;
      ">${label}</span>
    `;
  }

  switch (item.installStatus) {
    case "installed":
      return html`
        <span style="
          font-size:11px;
          font-weight:600;
          padding:5px 14px;
          border-radius:6px;
          background:rgba(52,211,153,0.1);
          color:#34d399;
          display:inline-flex;
          align-items:center;
          gap:4px;
        ">&#10003; ${t("extensions.store.installed")}</span>
      `;
    case "installing":
      return html`
        <span style="
          font-size:11px;
          font-weight:600;
          padding:5px 14px;
          border-radius:6px;
          background:rgba(99,102,241,0.1);
          color:var(--accent, #6366f1);
          display:inline-flex;
          align-items:center;
          gap:6px;
        ">
          <span style="
            width:10px;height:10px;
            border:2px solid currentColor;
            border-top-color:transparent;
            border-radius:50%;
            animation:mcpSpin 0.8s linear infinite;
            display:inline-block;
          "></span>
          ${t("extensions.store.installing")}
        </span>
      `;
    case "error": {
      const errMsg = item.errorMessage || "";
      // Show a short snippet below the button (max 60 chars)
      const shortErr = errMsg.length > 60 ? errMsg.slice(0, 57) + "..." : errMsg;
      return html`
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:3px;">
          <button
            @click=${(e: Event) => {
              e.stopPropagation();
              // Route to config wizard if item has env vars to configure;
              // otherwise just retry the install directly.
              const hasConfigurableEnv = item.requiresApiKey
                || (item.envRequired && item.envRequired.length > 0)
                || (item.envSchema && Object.keys(item.envSchema).length > 0);
              if (hasConfigurableEnv) { onConfigInstall(); } else { onInstall(); }
            }}
            title=${errMsg}
            style="
              all:unset; cursor:pointer;
              font-size:11px; font-weight:600;
              padding:5px 14px;
              border-radius:6px;
              background:rgba(248,113,113,0.1);
              color:#f87171;
            "
          >${t("extensions.store.installFailed")}</button>
          ${shortErr ? html`<span style="
            font-size:10px; color:#f87171; opacity:0.8;
            max-width:200px; word-break:break-all;
            line-height:1.3;
          ">${shortErr}</span>` : nothing}
        </div>
      `;
    }
    default: // not_installed
      // Items without any install method → show "Manual Config" button + optional "View Source" link
      if (item.installable === false) {
        const url = item.sourceUrl || "";
        return html`
          <div style="display:flex; gap:6px; align-items:center;">
            <button
              @click=${(e: Event) => { e.stopPropagation(); onConfigInstall(); }}
              style="
                all:unset; cursor:pointer;
                font-size:11px; font-weight:600;
                padding:5px 14px;
                border-radius:6px;
                background:linear-gradient(135deg, #fbbf24, #f59e0b);
                color:#000;
                transition: opacity 150ms;
              "
            >${t("extensions.store.manualConfig" as never)}</button>
            ${url ? html`
              <a
                href=${url}
                target="_blank"
                rel="noopener"
                @click=${(e: Event) => { e.stopPropagation(); }}
                style="
                  all:unset; cursor:pointer;
                  font-size:10px;
                  color:var(--muted-strong, #6b7d91);
                  text-decoration:underline;
                "
              >${t("extensions.store.viewSource" as never)}</a>
            ` : nothing}
          </div>
        `;
      }
      if (item.requiresApiKey || (item.envRequired && item.envRequired.length > 0) || (item.envSchema && Object.keys(item.envSchema).length > 0)) {
        return html`
          <button
            @click=${(e: Event) => { e.stopPropagation(); onConfigInstall(); }}
            style="
              all:unset; cursor:pointer;
              font-size:11px; font-weight:600;
              padding:5px 14px;
              border-radius:6px;
              background:linear-gradient(135deg, #fbbf24, #f59e0b);
              color:#000;
              transition: opacity 150ms;
            "
          >${t("extensions.store.configAndInstall")}</button>
        `;
      }
      return html`
        <button
          @click=${(e: Event) => { e.stopPropagation(); onInstall(); }}
          style="
            all:unset; cursor:pointer;
            font-size:11px; font-weight:600;
            padding:5px 14px;
            border-radius:6px;
            background:var(--accent, #6366f1);
            color:#fff;
            transition: opacity 150ms;
          "
        >${t("extensions.store.install")}</button>
      `;
  }
}

/* ── Badge pills ───────────────────────────────────────── */

/* ── Install method badge ──────────────────────────────── */

function renderInstallMethodBadge(item: McpMarketplaceItem): TemplateResult {
  const method = item.installMethod ?? "none";
  const pillStyle = (bg: string, fg: string) =>
    `font-size:10px; padding:2px 8px; border-radius:4px; background:${bg}; color:${fg}; white-space:nowrap;`;

  switch (method) {
    case "npm":
      return html`<span style="${pillStyle("rgba(203,92,88,0.12)", "#cb5c58")}"
        title="${t("extensions.store.installMethodNpmTip" as never)}"
        >${t("extensions.store.installMethodNpm" as never)}</span>`;
    case "pypi":
      return html`<span style="${pillStyle("rgba(53,114,165,0.12)", "#3572a5")}"
        title="${t("extensions.store.installMethodPypiTip" as never)}"
        >${t("extensions.store.installMethodPypi" as never)}</span>`;
    case "sse":
      return html`<span style="${pillStyle("rgba(251,146,60,0.12)", "#fb923c")}"
        title="${t("extensions.store.installMethodSseTip" as never)}"
        >${t("extensions.store.installMethodSse" as never)}</span>`;
    default:
      return html`<span style="${pillStyle("rgba(148,163,184,0.08)", "#6b7d91")}"
        >${t("extensions.store.installMethodNone" as never)}</span>`;
  }
}

function renderBadges(item: McpMarketplaceItem): TemplateResult {
  const badges: TemplateResult[] = [];
  const pillStyle = (bg: string, fg: string) =>
    `font-size:10px; padding:2px 8px; border-radius:4px; background:${bg}; color:${fg}; white-space:nowrap;`;

  // Install method badge — always first so users immediately see how it works
  badges.push(renderInstallMethodBadge(item));

  if (item.isOfficial) {
    badges.push(html`<span style="${pillStyle("rgba(99,102,241,0.12)", "#818cf8")}">${t("extensions.store.official")}</span>`);
  }
  const needsConfig = item.requiresApiKey || (item.envRequired && item.envRequired.length > 0) || (item.envSchema && Object.keys(item.envSchema).length > 0);
  if (!needsConfig && item.installable !== false && item.installMethod !== "none") {
    badges.push(html`<span style="${pillStyle("rgba(52,211,153,0.12)", "#34d399")}">${t("extensions.store.zeroConfig")}</span>`);
  } else if (needsConfig) {
    badges.push(html`<span style="${pillStyle("rgba(251,191,36,0.12)", "#fbbf24")}">${t("extensions.store.needsKey")}</span>`);
  }
  // SSE risk badge — warn users this connects to a third-party server
  if (item.installMethod === "sse") {
    const isVerified = (item as McpMarketplaceItem & { isVerified?: boolean }).isVerified;
    if (!isVerified) {
      badges.push(html`<span style="${pillStyle("rgba(248,113,113,0.12)", "#f87171")}"
        title="${t("extensions.store.highRiskTip" as never)}"
        >${t("extensions.store.highRisk" as never)}</span>`);
    } else {
      badges.push(html`<span style="${pillStyle("rgba(251,146,60,0.12)", "#fb923c")}"
        title="${t("extensions.store.remoteServiceTip" as never)}"
        >${t("extensions.store.remoteService" as never)}</span>`);
    }
  }
  if (item.isNew) {
    badges.push(html`<span style="${pillStyle("rgba(96,165,250,0.12)", "#60a5fa")}">${t("extensions.store.newBadge")}</span>`);
  }
  if (item.hasUpdate) {
    badges.push(html`<span style="${pillStyle("rgba(251,191,36,0.12)", "#fbbf24")}">${t("extensions.store.hasUpdate" as never)}</span>`);
  }

  return html`<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:8px;">${badges}</div>`;
}

/* ── Security score shield ─────────────────────────────── */

function renderSecurityScore(score: number): TemplateResult {
  if (score < 60) return html`${nothing}`;
  const color = score >= 80 ? "#34d399" : "#fbbf24";
  return html`
    <span style="
      font-size:10px;
      display:inline-flex;
      align-items:center;
      gap:3px;
      color:${color};
      opacity:0.9;
    ">\u{1F6E1}\uFE0F ${score}</span>
  `;
}

/* ── Main card ─────────────────────────────────────────── */

export function renderMarketplaceCard(props: MarketplaceCardProps): TemplateResult {
  const { item, onClick, onInstall, onConfigInstall } = props;
  const emoji = CATEGORY_EMOJI[item.category] ?? "\u{1F527}";
  const isInstalled = item.installStatus === "installed";
  const notInstallable = item.installable === false || item.installMethod === "none";

  return html`
    <div
      @click=${onClick}
      @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      role="article"
      tabindex="0"
      aria-label="${item.friendlyName} — ${item.description}"
      style="
        background:var(--card);
        border:1px solid var(--border);
        border-radius:var(--radius-lg, 12px);
        padding:14px;
        cursor:pointer;
        transition:box-shadow 200ms ease, border-color 200ms ease, transform 200ms ease;
        position:relative;
        display:flex;
        flex-direction:column;
        box-shadow:var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.2)), inset 0 1px 0 var(--card-highlight, rgba(255,255,255,0.08));
        min-width:0;
        overflow:hidden;
        ${notInstallable ? "opacity:0.5; filter:grayscale(0.3);" : ""}
      "
      class="mcp-store-card"
    >
      <!-- Top row: icon + name + version + security -->
      <div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:10px;">
        <!-- Category icon -->
        <div style="
          width:36px; height:36px;
          border-radius:var(--radius-md, 8px);
          background:${isInstalled ? "rgba(52,211,153,0.1)" : "rgba(108,140,255,0.08)"};
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:18px;
          flex-shrink:0;
        ">${emoji}</div>

        <!-- Name + package -->
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span style="font-size:13px; font-weight:600; color:var(--fg); letter-spacing:-0.01em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:160px; display:inline-block; vertical-align:middle;">${item.friendlyName}</span>
            <span style="
              font-size:10px;
              padding:2px 8px;
              border-radius:var(--radius-sm, 6px);
              background:rgba(148,163,184,0.1);
              color:var(--muted-strong, #6b7d91);
            ">v${item.version}</span>
            ${item.installedVersion && item.installedVersion !== item.version
              ? html`<span style="
                  font-size:9px;
                  padding:2px 6px;
                  border-radius:var(--radius-sm, 6px);
                  background:rgba(251,191,36,0.1);
                  color:#fbbf24;
                ">v${item.installedVersion} \u2192 v${item.version}</span>`
              : nothing}
            ${renderSecurityScore(item.securityScore)}
          </div>
          <div style="font-size:10px; color:var(--muted-strong, #6b7d91); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${item.npmPackage || item.serverId}
          </div>
        </div>
      </div>

      <!-- Description (2-line clamp) -->
      <div style="
        font-size:12px;
        color:var(--fg-secondary, #a0aec0);
        line-height:1.5;
        display:-webkit-box;
        -webkit-line-clamp:2;
        -webkit-box-orient:vertical;
        overflow:hidden;
        margin-bottom:8px;
        flex:1;
      ">${item.description}</div>

      <!-- Tags -->
      ${item.tags.length > 0
        ? html`
            <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;">
              ${item.tags.slice(0, 3).map(
                (tag) => html`<span style="
                  font-size:10px;
                  padding:3px 10px;
                  border-radius:var(--radius-sm, 6px);
                  background:rgba(148,163,184,0.08);
                  color:var(--muted-strong, #6b7d91);
                ">${tag}</span>`,
              )}
            </div>
          `
        : nothing}

      <!-- Config hint (for items that need API key) -->
      ${item.configHint
        ? html`<div style="
            font-size:10px; color:var(--muted-strong, #6b7d91);
            line-height:1.4; margin-bottom:6px;
            padding:3px 6px;
            background:rgba(251,191,36,0.06);
            border-radius:4px;
            display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;
          ">${item.configHint}</div>`
        : nothing}

      <!-- Badges + install button row -->
      <div style="display:flex; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; gap:6px; margin-top:auto;">
        ${renderBadges(item)}
        ${renderInstallButton(item, onInstall, onConfigInstall)}
      </div>
    </div>

    <style>
      .mcp-store-card:hover {
        border-color: var(--accent, #6c8cff) !important;
        box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.25)), inset 0 1px 0 var(--card-highlight, rgba(255,255,255,0.08)) !important;
        transform: translateY(-2px);
      }
      @keyframes mcpSpin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;
}

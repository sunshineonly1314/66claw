/**
 * extensions-page.ts
 * "Extensions" page — dual-tab layout:
 *   Tab 1: "My Capabilities"  — installed capabilities + advanced settings
 *   Tab 2: "Capability Store"  — marketplace browse / search / install
 *
 * Design principles:
 *   - Never mention "MCP" — call it "扩展能力" or "AI capabilities"
 *   - Beginner-first: 99% users stay at Level 0-1, progressive disclosure
 *   - Reuses existing Skills marketplace patterns (search, chips, cards)
 */

import { html, nothing, type TemplateResult } from "lit";
import { ref, type RefOrCallback } from "lit/directives/ref.js";
import { t } from "../i18n/index.js";
import type {
  McpCapability,
  McpProcessInfo,
  McpMarketplaceItem,
  McpMarketplaceState,
  McpExtensionsTab,
  McpToast,
} from "../app-view-state.js";
import { renderExtensionsCard } from "./extensions-card.js";
import { renderMarketplaceCard } from "./mcp-marketplace-card.js";
import { renderMcpDetailModal } from "./mcp-detail-modal.js";
import { renderMcpConfigWizard } from "./mcp-config-wizard.js";
import { renderMcpBatchConfig } from "./mcp-batch-config.js";
import { MCP_CATEGORIES, MCP_MAX_RUNNING, filterMarketplaceItems } from "./mcp-shared.js";

// ---------------------------------------------------------------------------
// IntersectionObserver-based infinite scroll sentinel
// ---------------------------------------------------------------------------
const _sentinelObservers = new WeakMap<Element, IntersectionObserver>();

function scrollSentinelRef(onLoad?: () => void, loading?: boolean): RefOrCallback {
  return (el: Element | undefined) => {
    if (!el) return;
    const prev = _sentinelObservers.get(el);
    if (prev) { prev.disconnect(); _sentinelObservers.delete(el); }
    if (!onLoad || loading) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) onLoad(); },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    _sentinelObservers.set(el, obs);
  };
}

// ============================================================================
// Props
// ============================================================================

export type ExtensionsPageProps = {
  // — existing (Tab 1: My Capabilities) —
  capabilities: McpCapability[];
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  onConfigClick: (capabilityId: string) => void;
  onTrySay: (prompt: string) => void;
  onRestart: (serverId: string) => void;
  onDisable: (serverId: string) => void;
  onEnable: (serverId: string) => void;
  onTest: (serverId: string, env?: Record<string, string>) => void;
  onCheckUpdate: () => void;
  onViewUpdate?: () => void;
  processes: McpProcessInfo[];
  updateNotice: { count: number; names: string[] } | null;
  /** Server currently being tested (shows spinner) */
  testingServerId: string | null;
  /** Last test result per server id */
  testResults: Record<string, "success" | "failed">;
  // — new (Tab switch + marketplace) —
  activeTab: McpExtensionsTab;
  onTabChange: (tab: McpExtensionsTab) => void;
  marketplace: McpMarketplaceState;
  onSearchChange: (search: string) => void;
  onCategoryChange: (category: string) => void;
  onSortChange: (sort: McpMarketplaceState["sort"]) => void;
  onOpenDetail: (item: McpMarketplaceItem) => void;
  onCloseDetail: () => void;
  onInstall: (item: McpMarketplaceItem) => void;
  onUninstall: (serverId: string) => void;
  onUpdate: (serverId: string) => void;
  onOpenConfigWizard: (item: McpMarketplaceItem) => void;
  onCloseConfigWizard: () => void;
  onDismissFirstVisit: () => void;
  onDismissRecommendation: () => void;
  /** Current running process count for limit guard */
  runningCount: number;
  /** Toast notification */
  toast: McpToast | null;
  /** Load next page of marketplace items */
  onLoadMore?: () => void;
  /** Retry marketplace data sync (shown when load fails or returns empty) */
  onRetrySync?: () => void;
  /** Manual add MCP server (advanced users). Returns true on success. */
  onManualAdd?: (config: {
    id: string;
    command: string;
    args: string[];
    transport: "stdio" | "sse";
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
  }) => Promise<boolean>;
  // — Batch API Key configuration —
  onOpenBatchConfig?: () => void;
  onCloseBatchConfig?: () => void;
  onSaveBatchConfig?: (updates: Array<{ serverId: string; env: Record<string, string> }>) => void;
  batchConfigSaving?: boolean;
  batchConfigResult?: { success: number; failed: number } | null;
  serverEnvStatus?: Record<string, Record<string, boolean>>;
  /** Update env vars for an already-installed server and restart it */
  onUpdateServerEnv?: (serverId: string, env: Record<string, string>) => void;
};

// ============================================================================
// Search debounce (Fix #8: 300ms debounce on search input)
// ============================================================================

let _searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let _searchDraft = "";

function debouncedSearch(value: string, onSearchChange: (s: string) => void): void {
  _searchDraft = value;
  if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
  _searchDebounceTimer = setTimeout(() => {
    onSearchChange(_searchDraft);
    _searchDebounceTimer = null;
  }, 300);
}

// CATEGORIES, MCP_MAX_RUNNING, filterMarketplaceItems — imported from mcp-shared.ts

// ============================================================================
// Main render
// ============================================================================

export function renderExtensions(props: ExtensionsPageProps): TemplateResult {
  const { activeTab, onTabChange, marketplace, toast } = props;

  return html`
    <div style="padding:0 clamp(12px, 2vw, 32px); max-width:100%; overflow-x:hidden; overflow-y:auto; min-height:0; flex:1 1 0; box-sizing:border-box;">

      <!-- First visit guide overlay -->
      ${marketplace.showFirstVisit ? renderFirstVisitGuide(props) : nothing}

      <!-- Desktop header: tabs left + stats right in one bar -->
      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        margin-bottom:24px;
        border-bottom:1px solid var(--border);
        gap:16px;
        flex-wrap:wrap;
      ">
        <div style="display:flex; gap:0;">
          ${renderTab("my", activeTab, t("extensions.tab.my"), onTabChange)}
          ${renderTab("store", activeTab, t("extensions.tab.store"), onTabChange, true)}
        </div>
        ${activeTab === "my" ? renderInlineStats(props) : nothing}
      </div>

      <!-- Tab content -->
      ${activeTab === "my"
        ? renderMyCapabilities(props)
        : renderCapabilityStore(props)}
    </div>

    <!-- Detail modal overlay -->
    ${marketplace.detailItem
      ? renderMcpDetailModal({
          item: marketplace.detailItem,
          onClose: props.onCloseDetail,
          onInstall: () => props.onInstall(marketplace.detailItem!),
          onConfigInstall: () => props.onOpenConfigWizard(marketplace.detailItem!),
          onUninstall: () => props.onUninstall(marketplace.detailItem!.serverId),
          onUpdate: () => props.onUpdate(marketplace.detailItem!.serverId),
          onTrySay: props.onTrySay,
        })
      : nothing}

    <!-- Config wizard overlay -->
    ${marketplace.configTarget
      ? renderMcpConfigWizard({
          item: marketplace.configTarget,
          onClose: props.onCloseConfigWizard,
          onSaveAndEnable: (env, overrides) => {
            const target = marketplace.configTarget!;
            if (target.installStatus === "installed" && props.onUpdateServerEnv) {
              // Already installed — update env vars and restart
              props.onUpdateServerEnv(target.serverId, env);
            } else {
              props.onInstall({ ...target, _env: env, _overrides: overrides } as McpMarketplaceItem & { _env: Record<string, string>; _overrides?: typeof overrides });
            }
            props.onCloseConfigWizard();
          },
          onTestConnection: (env) => {
            props.onTest(marketplace.configTarget!.serverId, env);
          },
          testState: props.testingServerId === marketplace.configTarget?.serverId
            ? "testing"
            : props.testResults[marketplace.configTarget?.serverId ?? ""] === "success"
              ? "success"
              : props.testResults[marketplace.configTarget?.serverId ?? ""] === "failed"
                ? "error"
                : "idle",
        })
      : nothing}

    <!-- Batch API Key config modal -->
    ${marketplace.showBatchConfig && props.onCloseBatchConfig && props.onSaveBatchConfig
      ? renderMcpBatchConfig({
          items: marketplace.items,
          serverEnvStatus: props.serverEnvStatus ?? {},
          onClose: props.onCloseBatchConfig,
          onSaveAll: props.onSaveBatchConfig,
          saving: props.batchConfigSaving ?? false,
          saveResult: props.batchConfigResult,
        })
      : nothing}

    <!-- Toast notification -->
    ${toast ? renderMcpToast(toast) : nothing}
  `;
}

// ============================================================================
// Tab button
// ============================================================================

function renderTab(
  id: McpExtensionsTab,
  active: McpExtensionsTab,
  label: string,
  onChange: (tab: McpExtensionsTab) => void,
  trialBadge = false,
): TemplateResult {
  const isActive = id === active;
  return html`
    <button
      @click=${() => onChange(id)}
      style="
        all:unset;
        cursor:pointer;
        padding:10px 24px;
        font-size:14px;
        font-weight:${isActive ? "700" : "400"};
        color:${isActive ? "var(--fg)" : "var(--muted-strong, #6b7d91)"};
        border-bottom:2px solid ${isActive ? "var(--accent, #6c8cff)" : "transparent"};
        transition:color 150ms, border-color 150ms;
        user-select:none;
        position:relative;
        letter-spacing:-0.01em;
      "
    >${label}${trialBadge ? html`<span style="
        display:inline-block;
        margin-left:6px;
        padding:1px 6px;
        font-size:10px;
        font-weight:600;
        line-height:16px;
        border-radius:8px;
        background:linear-gradient(135deg, #f59e0b, #f97316);
        color:#fff;
        letter-spacing:0.02em;
        vertical-align:middle;
        white-space:nowrap;
      ">\u8BD5\u8FD0\u884C</span>` : nothing}</button>
  `;
}

// ============================================================================
// Inline stats ribbon (shown in header bar, right side)
// ============================================================================

function renderInlineStats(props: ExtensionsPageProps): TemplateResult {
  const { capabilities, processes } = props;
  const readyCount = capabilities.filter((c) => c.status === "ready").length;
  const stoppedCount = capabilities.filter((c) => c.status === "paused" || c.status === "unavailable").length;
  const totalTools = processes.reduce((sum, p) => sum + p.toolCount, 0);

  return html`
    <div style="
      display:flex;
      align-items:center;
      gap:0;
      font-size:12px;
      color:var(--muted, #8b9caf);
      margin-bottom:-1px;
      padding-bottom:12px;
    ">
      <!-- Running -->
      <div style="display:flex; align-items:center; gap:6px; padding:0 16px;">
        <span style="width:7px;height:7px;border-radius:50%;background:#34d399;display:inline-block;box-shadow:0 0 6px rgba(52,211,153,0.4);"></span>
        <span>${t("extensions.stats.running")}</span>
        <span style="font-size:16px; font-weight:700; color:#34d399; letter-spacing:-0.02em;">${readyCount}</span>
      </div>
      <div style="width:1px;height:16px;background:var(--border);"></div>
      <!-- Stopped -->
      <div style="display:flex; align-items:center; gap:6px; padding:0 16px;">
        <span style="width:7px;height:7px;border-radius:50%;background:#94a3b8;display:inline-block;"></span>
        <span>${t("extensions.stats.stopped")}</span>
        <span style="font-size:16px; font-weight:700; color:${stoppedCount > 0 ? "#94a3b8" : "var(--fg)"}; letter-spacing:-0.02em;">${stoppedCount}</span>
      </div>
      <div style="width:1px;height:16px;background:var(--border);"></div>
      <!-- Tools -->
      <div style="display:flex; align-items:center; gap:6px; padding:0 16px;">
        <span>${t("extensions.stats.tools")}</span>
        <span style="font-size:16px; font-weight:700; color:var(--accent, #6c8cff); letter-spacing:-0.02em;">${totalTools}</span>
        <span style="font-size:11px;">${t("extensions.stats.toolsUnit")}</span>
      </div>
      <div style="width:1px;height:16px;background:var(--border);"></div>
      <!-- Sync -->
      <div style="display:flex; align-items:center; gap:6px; padding:0 16px; font-size:11px; color:var(--muted-strong, #6b7d91);">
        \u{1F504} ${t("extensions.stats.lastSync")}
      </div>
      <div style="width:1px;height:16px;background:var(--border);"></div>
      <!-- Import MCP button -->
      <button
        @click=${() => _openImportMcpModal(props.onManualAdd)}
        style="
          all:unset; cursor:pointer;
          display:flex; align-items:center; gap:5px;
          padding:4px 14px;
          border-radius:6px;
          font-size:12px; font-weight:600;
          color:var(--accent-2, #20d5bc);
          border:1px solid var(--accent-2, #20d5bc);
          background:transparent;
          transition:opacity 150ms;
          white-space:nowrap;
        "
      >+ ${t("extensions.stats.importMcp" as never)}</button>
    </div>
  `;
}

// ============================================================================
// Tab 1: My Capabilities
// ============================================================================

function renderMyCapabilities(props: ExtensionsPageProps): TemplateResult {
  const {
    capabilities, advancedOpen, onToggleAdvanced, onConfigClick, onTrySay,
    onRestart, onDisable, onEnable, onTest, onCheckUpdate, onViewUpdate, processes, updateNotice,
    testingServerId, testResults,
  } = props;

  return html`
    <!-- Update notice bar -->
    ${updateNotice
      ? html`
          <div
            style="
              display:flex;
              align-items:center;
              justify-content:space-between;
              padding:10px 20px;
              margin-bottom:20px;
              border-radius:var(--radius-md, 8px);
              background:rgba(52,211,153,0.08);
              border:1px solid rgba(52,211,153,0.15);
              color:#34d399;
              font-size:13px;
              animation:extUpdateIn 300ms var(--ease-out, ease) both;
            "
          >
            <span>
              ${t("mcpUpdate.newAbilities").replace("{{count}}", String(updateNotice.count))}:
              ${updateNotice.names.join(", ")}
            </span>
            <button
              @click=${() => onViewUpdate?.()}
              style="all:unset; cursor:pointer; font-size:12px; font-weight:600; color:#34d399; text-decoration:underline;"
            >${t("mcpUpdate.view")}</button>
          </div>
        `
      : nothing}

    <!-- Capability cards — Desktop: 3-column grid, fills full width -->
    ${capabilities.length === 0
      ? html`
          <div style="text-align:center; padding:80px 20px; color:var(--muted-strong, #6b7d91); font-size:14px;">
            ${t("extensions.noCapabilities")}
          </div>
        `
      : html`
          <div class="ext-cards-grid" style="display:grid; gap:16px; margin-bottom:28px;">
            ${capabilities.map(
              (cap) => renderExtensionsCard({
                capability: cap,
                onConfigClick,
                onTrySay,
                onUninstall: !cap.isBuiltin ? (id) => props.onUninstall(id) : undefined,
              }),
            )}
          </div>
        `}

    <!-- Advanced Settings (collapsed) -->
    <div style="border-top:1px solid var(--border); padding-top:16px;">
      <button
        @click=${onToggleAdvanced}
        style="
          all:unset; cursor:pointer;
          display:flex; align-items:center; gap:8px;
          font-size:13px; color:var(--muted-strong, #6b7d91);
          user-select:none;
          padding:4px 0;
        "
      >
        <span style="font-size:10px; transition:transform 150ms; transform:rotate(${advancedOpen ? "90deg" : "0deg"});">\u25B6</span>
        ${t("extensions.advanced")}
      </button>
      ${advancedOpen ? renderAdvancedSection(processes, onRestart, onDisable, onEnable, onTest, onCheckUpdate, testingServerId, testResults) : nothing}
    </div>

    <style>
      @keyframes extUpdateIn {
        from { opacity:0; transform:translateY(-8px); }
        to   { opacity:1; transform:translateY(0); }
      }
      /* Desktop: auto-fill responsive. Mobile: 1 column */
      .ext-cards-grid {
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        max-width:100%;
      }
      @media (max-width: 600px) {
        .ext-cards-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  `;
}

// ============================================================================
// Tab 2: Capability Store
// ============================================================================

function renderCapabilityStore(props: ExtensionsPageProps): TemplateResult {
  const { marketplace, onSearchChange, onCategoryChange, onSortChange, onOpenDetail, onInstall, onOpenConfigWizard, onDismissRecommendation, runningCount } = props;

  // Filter items by search + category
  const filtered = filterMarketplaceItems(marketplace);

  return html`
    <!-- Recommendation banner -->
    ${marketplace.recommendations.length > 0
      ? renderRecommendationBanner(marketplace.recommendations, onInstall, onDismissRecommendation)
      : nothing}

    <!-- Fix #9: Process limit warning -->
    ${runningCount >= MCP_MAX_RUNNING
      ? html`
          <div style="
            padding:12px 20px;
            margin-bottom:20px;
            border-radius:var(--radius-lg, 12px);
            background:rgba(251,191,36,0.08);
            border:1px solid rgba(251,191,36,0.2);
            font-size:13px;
            color:#fbbf24;
            display:flex;
            align-items:center;
            gap:10px;
          ">
            <span style="font-size:16px;">\u26A0\uFE0F</span>
            ${t("extensions.store.limitReached")
              .replace("{{count}}", String(runningCount))
              .replace("{{max}}", String(MCP_MAX_RUNNING))}
          </div>
        `
      : nothing}

    <!-- Desktop toolbar: search + categories + sort — all in one compact area -->
    <div style="
      display:flex;
      gap:12px;
      margin-bottom:16px;
      align-items:center;
    ">
      <!-- Search box -->
      <div style="
        width:280px; flex-shrink:0;
        display:flex; align-items:center;
        padding:0 14px;
        border:1px solid var(--border);
        border-radius:var(--radius-md, 8px);
        background:var(--card);
        transition:border-color 150ms, box-shadow 150ms;
        height:36px;
      " class="mcp-search-box">
        <span style="font-size:13px; color:var(--muted-strong, #6b7d91); margin-right:8px;" aria-hidden="true">\u{1F50D}</span>
        <input
          type="text"
          .value=${marketplace.search}
          @input=${(e: Event) => debouncedSearch((e.target as HTMLInputElement).value, onSearchChange)}
          placeholder=${t("extensions.store.searchPlaceholder")}
          aria-label=${t("extensions.store.searchPlaceholder")}
          style="
            all:unset;
            flex:1;
            padding:8px 0;
            font-size:13px;
            color:var(--fg);
          "
        />
        ${marketplace.search
          ? html`<button
              @click=${() => onSearchChange("")}
              style="all:unset; cursor:pointer; font-size:16px; color:var(--muted-strong, #6b7d91); padding:0 4px; line-height:1;"
            >&times;</button>`
          : nothing}
      </div>

      <!-- Category chips — inline with search -->
      <div style="
        display:flex;
        gap:6px;
        flex-wrap:wrap;
        flex:1;
        align-items:center;
      ">
        ${MCP_CATEGORIES.map((cat) => {
          const isActive = marketplace.activeCategory === cat.id;
          const count = cat.id === "all"
            ? marketplace.total
            : marketplace.items.filter((i) => i.category === cat.id).length;

          return html`
            <button
              @click=${() => onCategoryChange(isActive && cat.id !== "all" ? "all" : cat.id)}
              style="
                all:unset; cursor:pointer;
                padding:4px 12px;
                border-radius:var(--radius-full, 9999px);
                font-size:11px;
                white-space:nowrap;
                border:1px solid ${isActive ? "var(--accent, #6c8cff)" : "var(--border)"};
                background:${isActive ? "rgba(108,140,255,0.1)" : "transparent"};
                color:${isActive ? "var(--accent, #6c8cff)" : "var(--muted-strong, #6b7d91)"};
                transition:all 150ms;
                user-select:none;
              "
            >${cat.emoji} ${t(`extensions.category.${cat.id}` as never)}${count > 0 ? ` (${count})` : ""}</button>
          `;
        })}
      </div>

      <!-- Sort dropdown — right side -->
      <select
        @change=${(e: Event) => onSortChange((e.target as HTMLSelectElement).value as McpMarketplaceState["sort"])}
        .value=${marketplace.sort}
        style="
          padding:0 12px;
          height:36px;
          border:1px solid var(--border);
          border-radius:var(--radius-md, 8px);
          background:var(--card);
          color:var(--fg);
          font-size:12px;
          outline:none;
          cursor:pointer;
          flex-shrink:0;
        "
      >
        <option value="recommended">${t("extensions.store.sort.recommended")}</option>
        <option value="newest">${t("extensions.store.sort.newest")}</option>
        <option value="popular">${t("extensions.store.sort.popular")}</option>
        <option value="name">${t("extensions.store.sort.name")}</option>
      </select>

      <!-- Batch API Key config button (only when items with requiresApiKey exist) -->
      ${props.onOpenBatchConfig && marketplace.items.some((i) => i.requiresApiKey)
        ? html`<button
            @click=${props.onOpenBatchConfig}
            style="
              all:unset; cursor:pointer;
              padding:0 14px;
              height:36px;
              border:1px solid var(--accent-2, #20d5bc);
              border-radius:var(--radius-md, 8px);
              background:rgba(32,213,188,0.08);
              color:var(--accent-2, #20d5bc);
              font-size:12px;
              font-weight:600;
              white-space:nowrap;
              flex-shrink:0;
              display:flex;
              align-items:center;
              gap:6px;
              transition:background 150ms, border-color 150ms;
            "
            class="batch-config-btn"
          >\u{1F511} ${t("extensions.batchConfig.button" as never)}</button>`
        : nothing}
    </div>

    <!-- Content: loading / empty / no results / cards — Desktop: 3-4 column grid -->
    ${marketplace.loading
      ? renderStoreLoading()
      : marketplace.error
        ? renderStoreEmpty(marketplace.error, props.onRetrySync)
        : marketplace.items.length === 0
          ? renderStoreEmpty("", props.onRetrySync)
          : filtered.length === 0
            ? renderNoResults(marketplace.search, () => onSearchChange(""))
            : html`
                <div class="ext-store-grid" style="
                  display:grid;
                  gap:12px;
                  margin-bottom:16px;
                ">
                  ${filtered.map(
                    (item) => renderMarketplaceCard({
                      item,
                      onClick: () => onOpenDetail(item),
                      onInstall: () => onInstall(item),
                      onConfigInstall: () => onOpenConfigWizard(item),
                    }),
                  )}
                </div>
                ${marketplace.page < marketplace.totalPages
                  ? html`
                    <div ${ref(scrollSentinelRef(props.onLoadMore, marketplace.loadingMore))}
                      style="display:flex; justify-content:center; align-items:center; padding:20px 0 28px; min-height:48px;">
                      ${marketplace.loadingMore
                        ? html`<span style="font-size:13px; color:var(--muted-strong, #6b7d91);">${t("extensions.store.loadingMore" as never)}</span>`
                        : html`<span style="font-size:12px; color:var(--muted-strong, #6b7d91);">${marketplace.items.length} / ${marketplace.total}</span>`}
                    </div>`
                  : marketplace.total > 0
                    ? html`<div style="text-align:center; margin-bottom:28px; font-size:12px; color:var(--muted-strong, #6b7d91);">
                        ${t("extensions.store.showingAll" as never).replace("{{count}}", String(marketplace.total))}
                      </div>`
                    : nothing}
              `}

    <style>
      .mcp-search-box:focus-within {
        border-color:var(--accent, #6c8cff) !important;
        box-shadow:0 0 0 3px rgba(108,140,255,0.1);
      }
      .batch-config-btn:hover {
        background:rgba(32,213,188,0.15) !important;
      }
      /* Store grid: auto-fill responsive, max 3 cols, cards min 240px */
      .ext-store-grid {
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        max-width:100%;
      }
      @media (max-width: 600px) {
        .ext-store-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  `;
}

// ============================================================================
// Store sub-components
// ============================================================================

// filterItems — now using filterMarketplaceItems from mcp-shared.ts

function renderStoreLoading(): TemplateResult {
  return html`
    <div style="
      text-align:center;
      padding:60px 20px;
      color:var(--muted-strong, #6b7d91);
    ">
      <div style="
        width:24px; height:24px;
        border:3px solid var(--accent-2, #20d5bc);
        border-top-color:transparent;
        border-radius:50%;
        animation:mcpStoreSpin 0.8s linear infinite;
        margin:0 auto 16px;
      "></div>
      <div style="font-size:14px;">${t("extensions.store.loading")}</div>
      <div style="font-size:12px; margin-top:6px; opacity:0.7;">${t("extensions.store.loadingHint")}</div>
    </div>
    <style>
      @keyframes mcpStoreSpin { to { transform:rotate(360deg); } }
    </style>
  `;
}

function renderStoreEmpty(error: string, onRetry?: () => void): TemplateResult {
  return html`
    <div style="
      text-align:center;
      padding:60px 20px;
      color:var(--muted-strong, #6b7d91);
    ">
      <div style="font-size:28px; margin-bottom:12px;">${error ? "\u26A0\uFE0F" : "\u{1F4E1}"}</div>
      <div style="font-size:14px; font-weight:600;">${t("extensions.store.empty")}</div>
      <div style="font-size:12px; margin-top:8px; max-width:300px; margin-left:auto; margin-right:auto;">
        ${t("extensions.store.emptyHint")}
      </div>
      ${error ? html`<div style="font-size:11px; margin-top:6px; opacity:0.5;">${error}</div>` : nothing}
      ${onRetry ? html`
        <button
          @click=${onRetry}
          style="
            margin-top:16px;
            padding:8px 20px;
            border:1px solid var(--border);
            border-radius:8px;
            background:var(--bg-elevated, #fff);
            color:var(--accent, #6c8cff);
            font-size:13px;
            font-weight:600;
            cursor:pointer;
            transition:background 150ms, border-color 150ms;
          "
        >${t("extensions.store.reload" as never)}</button>
      ` : nothing}
    </div>
  `;
}

function renderNoResults(query: string, onClear: () => void): TemplateResult {
  return html`
    <div style="
      text-align:center;
      padding:60px 20px;
      color:var(--muted-strong, #6b7d91);
    ">
      <div style="font-size:28px; margin-bottom:12px;">\u{1F50D}</div>
      <div style="font-size:14px;">
        ${t("extensions.store.noResults").replace("{{query}}", query)}
      </div>
      <div style="font-size:12px; margin-top:8px;">
        ${t("extensions.store.noResultsHint")}
      </div>
      <button
        @click=${onClear}
        style="
          all:unset; cursor:pointer;
          margin-top:16px;
          font-size:12px; font-weight:600;
          padding:6px 20px; border-radius:6px;
          border:1px solid var(--border);
          color:var(--fg-secondary, #a0aec0);
        "
      >${t("extensions.store.clearSearch")}</button>
    </div>
  `;
}

function renderRecommendationBanner(
  recommendations: McpMarketplaceItem[],
  onInstall: (item: McpMarketplaceItem) => void,
  onDismiss: () => void,
): TemplateResult {
  return html`
    <div style="
      padding:14px 24px;
      margin-bottom:16px;
      border-radius:var(--radius-md, 8px);
      background:linear-gradient(135deg, rgba(108,140,255,0.06), rgba(32,213,188,0.04));
      border:1px solid rgba(108,140,255,0.12);
      display:flex;
      align-items:center;
      gap:20px;
    ">
      <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
        <span style="font-size:15px; font-weight:600; color:var(--fg); white-space:nowrap;">
          \u2728 ${t("extensions.recommend.title")}
        </span>
        <span style="font-size:12px; color:var(--muted-strong, #6b7d91); white-space:nowrap;">
          ${t("extensions.recommend.subtitle")}
        </span>
        <div style="display:flex; gap:6px; flex-wrap:nowrap; overflow:hidden;">
          ${recommendations.slice(0, 3).map(
            (r) => html`
              <span style="
                font-size:11px; padding:3px 10px;
                border-radius:var(--radius-sm, 6px);
                background:var(--card);
                border:1px solid var(--border);
                color:var(--fg);
                white-space:nowrap;
                max-width:180px;
                overflow:hidden;
                text-overflow:ellipsis;
                display:inline-block;
              ">${r.friendlyName}</span>
            `,
          )}
        </div>
      </div>
      <div style="display:flex; gap:10px; align-items:center; flex-shrink:0;">
        <button
          @click=${() => recommendations.filter((r) => r.installable !== false && r.installMethod !== "none").forEach((r) => onInstall(r))}
          style="
            all:unset; cursor:pointer;
            font-size:12px; font-weight:600;
            padding:6px 18px; border-radius:var(--radius-md, 8px);
            background:var(--accent, #6c8cff);
            color:#fff;
            transition:opacity 150ms;
          "
        >${t("extensions.recommend.installAll")}</button>
        <button
          @click=${onDismiss}
          style="
            all:unset; cursor:pointer;
            font-size:12px;
            color:var(--muted-strong, #6b7d91);
            padding:6px 8px;
          "
        >${t("extensions.recommend.later")}</button>
      </div>
    </div>
  `;
}

// ============================================================================
// First visit guide
// ============================================================================

function renderFirstVisitGuide(props: ExtensionsPageProps): TemplateResult {
  return html`
    <div style="
      padding:24px 32px;
      margin-bottom:24px;
      border-radius:var(--radius-lg, 12px);
      background:linear-gradient(135deg, rgba(108,140,255,0.06), rgba(32,213,188,0.04));
      border:1px solid rgba(108,140,255,0.12);
      animation:extFadeIn 400ms ease both;
      display:flex;
      align-items:center;
      gap:32px;
    ">
      <!-- Left: text content -->
      <div style="flex:1; min-width:0;">
        <div style="font-size:18px; font-weight:700; color:var(--fg); margin-bottom:8px;">
          \u{1F389} ${t("extensions.firstVisit.title")}
        </div>
        <div style="font-size:13px; color:var(--fg-secondary, #a0aec0); margin-bottom:14px; line-height:1.6;">
          ${t("extensions.firstVisit.desc")}
        </div>
        <div style="
          display:flex; gap:10px; flex-wrap:wrap;
          font-size:12px; margin-bottom:12px;
        ">
          <span style="padding:5px 14px; border-radius:var(--radius-sm, 6px); background:var(--card); border:1px solid var(--border);">
            \u{1F4C1} \u64CD\u4F5C\u7535\u8111\u6587\u4EF6</span>
          <span style="padding:5px 14px; border-radius:var(--radius-sm, 6px); background:var(--card); border:1px solid var(--border);">
            \u{1F50D} \u641C\u7D22\u7F51\u9875</span>
          <span style="padding:5px 14px; border-radius:var(--radius-sm, 6px); background:var(--card); border:1px solid var(--border);">
            \u{1F5C3}\uFE0F \u67E5\u8BE2\u6570\u636E\u5E93</span>
          <span style="padding:5px 14px; border-radius:var(--radius-sm, 6px); background:var(--card); border:1px solid var(--border);">
            \u23F0 \u4E86\u89E3\u65F6\u95F4\u65E5\u671F</span>
          <span style="padding:5px 14px; border-radius:var(--radius-sm, 6px); background:var(--card); border:1px solid var(--border);">
            \u{1F9E0} \u6DF1\u5EA6\u601D\u8003</span>
        </div>
        <div style="font-size:12px; color:var(--muted-strong, #6b7d91); line-height:1.6;">
          ${t("extensions.firstVisit.preinstalled")}
          &nbsp;\u00B7&nbsp;
          ${t("extensions.firstVisit.storeHint")}
        </div>
      </div>
      <!-- Right: action -->
      <button
        @click=${props.onDismissFirstVisit}
        style="
          all:unset; cursor:pointer;
          font-size:13px; font-weight:600;
          padding:10px 32px;
          border-radius:var(--radius-md, 8px);
          background:var(--accent, #6c8cff);
          color:#fff;
          transition:opacity 150ms;
          white-space:nowrap;
          flex-shrink:0;
        "
      >${t("extensions.firstVisit.explore")}</button>
    </div>
    <style>
      @keyframes extFadeIn {
        from { opacity:0; transform:translateY(-12px); }
        to   { opacity:1; transform:translateY(0); }
      }
    </style>
  `;
}

// ============================================================================
// Advanced section (process table — preserved from original)
// ============================================================================

function renderAdvancedSection(
  processes: McpProcessInfo[],
  onRestart: (id: string) => void,
  onDisable: (id: string) => void,
  onEnable: (id: string) => void,
  onTest: (id: string) => void,
  onCheckUpdate: () => void,
  testingServerId: string | null,
  testResults: Record<string, "success" | "failed">,
): TemplateResult {
  const totalMemory = processes.reduce((sum, p) => sum + p.memoryMB, 0);

  return html`
    <div style="margin-top:20px; animation:extUpdateIn 200ms ease both;">
      <div style="
        background:var(--card);
        border:1px solid var(--border);
        border-radius:var(--radius-lg, 12px);
        overflow:hidden;
        margin-bottom:20px;
        box-shadow:var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.2));
      ">
        <div style="
          padding:14px 24px;
          font-size:13px; font-weight:600;
          color:var(--muted-strong, #6b7d91);
          border-bottom:1px solid var(--border);
          text-transform:uppercase;
          letter-spacing:0.03em;
        ">${t("extensions.advanced.status")}</div>

        ${processes.length === 0
          ? html`<div style="padding:32px; text-align:center; font-size:13px; color:var(--muted-strong);">
              ${t("extensions.noCapabilities")}
            </div>`
          : html`
            <div style="max-height:400px; overflow-y:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead>
                  <tr style="color:var(--muted-strong, #6b7d91); text-align:left; background:var(--bg-elevated, #1c242e);">
                    <th style="padding:10px 24px; font-weight:500;">${t("extensions.advanced.name")}</th>
                    <th style="padding:10px 16px; font-weight:500;">${t("extensions.advanced.state")}</th>
                    <th style="padding:10px 16px; font-weight:500;">${t("extensions.advanced.memory")}</th>
                    <th style="padding:10px 16px; font-weight:500;">${t("extensions.advanced.tools")}</th>
                    <th style="padding:10px 16px; font-weight:500; text-align:right;">${t("extensions.advanced.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  ${processes.map(
                    (p) => {
                      const isTesting = testingServerId === p.id;
                      const testResult = testResults[p.id];
                      return html`
                      <tr style="border-top:1px solid var(--border); transition:background 150ms;" class="ext-process-row">
                        <td style="padding:12px 24px; color:var(--fg); font-weight:500;">${p.friendlyName}</td>
                        <td style="padding:12px 16px;">
                          <span style="
                            display:inline-flex; align-items:center; gap:5px;
                            font-size:12px;
                            padding:3px 10px;
                            border-radius:var(--radius-full, 9999px);
                            background:${p.status === "running" ? "rgba(52,211,153,0.1)" : p.status === "error" ? "rgba(248,113,113,0.1)" : "rgba(148,163,184,0.1)"};
                            color:${p.status === "running" ? "#34d399" : p.status === "error" ? "#f87171" : "#94a3b8"};
                          ">
                            <span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;"></span>
                            ${p.status === "running"
                              ? t("common.running")
                              : p.status === "error"
                                ? t("common.failed")
                                : t("common.stopped")}
                          </span>
                          ${testResult
                            ? html`<span style="
                                margin-left:6px;
                                font-size:11px;
                                padding:2px 8px;
                                border-radius:var(--radius-full, 9999px);
                                background:${testResult === "success" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)"};
                                color:${testResult === "success" ? "#34d399" : "#f87171"};
                              ">${testResult === "success" ? t("extensions.advanced.testSuccess" as never) : t("extensions.advanced.testFailed" as never)}</span>`
                            : nothing}
                          ${p.status === "error" && p.error
                            ? html`<div style="
                                margin-top:4px;
                                font-size:11px;
                                color:#f87171;
                                max-width:320px;
                                word-break:break-word;
                                line-height:1.4;
                              ">${p.error}</div>`
                            : nothing}
                        </td>
                        <td style="padding:12px 16px; color:var(--fg-secondary, #a0aec0); font-family:var(--mono);">${p.memoryMB}MB</td>
                        <td style="padding:12px 16px; color:var(--fg-secondary, #a0aec0);">${p.toolCount}</td>
                        <td style="padding:12px 16px; text-align:right; white-space:nowrap;">
                          <!-- Test button -->
                          <button
                            @click=${() => onTest(p.id)}
                            ?disabled=${isTesting}
                            style="all:unset; cursor:${isTesting ? "wait" : "pointer"}; font-size:12px; font-weight:500; color:var(--accent, #6c8cff); margin-right:14px; transition:opacity 150ms; opacity:${isTesting ? "0.5" : "1"};"
                          >${isTesting ? t("extensions.advanced.testing" as never) : t("extensions.advanced.test" as never)}</button>
                          <button
                            @click=${() => onRestart(p.id)}
                            style="all:unset; cursor:pointer; font-size:12px; font-weight:500; color:var(--accent-2, #20d5bc); margin-right:14px; transition:opacity 150ms;"
                          >${t("extensions.advanced.restart")}</button>
                          ${p.status === "running"
                            ? html`<button
                                @click=${() => onDisable(p.id)}
                                style="all:unset; cursor:pointer; font-size:12px; font-weight:500; color:var(--muted-strong, #6b7d91); transition:opacity 150ms;"
                              >${t("extensions.advanced.disable")}</button>`
                            : html`<button
                                @click=${() => onEnable(p.id)}
                                style="all:unset; cursor:pointer; font-size:12px; font-weight:500; color:#34d399; transition:opacity 150ms;"
                              >${t("extensions.advanced.enable" as never)}</button>`}
                        </td>
                      </tr>
                    `;
                    },
                  )}
                </tbody>
              </table>
            </div>
            `}
      </div>

      <div style="display:flex; align-items:center; justify-content:space-between; font-size:13px; color:var(--muted-strong, #6b7d91); padding:0 4px;">
        <span>${t("extensions.advanced.totalMemory")}: <strong style="color:var(--fg);">${totalMemory}MB</strong></span>
        <button
          @click=${onCheckUpdate}
          style="all:unset; cursor:pointer; font-size:13px; font-weight:500; color:var(--accent-2, #20d5bc); transition:opacity 150ms;"
        >${t("extensions.advanced.checkUpdate")}</button>
      </div>

    </div>

    <style>
      .ext-process-row:hover {
        background: var(--bg-hover, #2a3544) !important;
      }
    </style>
  `;
}

// ============================================================================
// Toast notification
// ============================================================================

const TOAST_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  success: { bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.25)", text: "#34d399" },
  error:   { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.25)", text: "#f87171" },
  info:    { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.25)", text: "var(--accent, #6366f1)" },
};

function renderMcpToast(toast: McpToast): TemplateResult {
  const colors = TOAST_COLORS[toast.type] ?? TOAST_COLORS.info;
  const icon = toast.type === "success" ? "\u2705" : toast.type === "error" ? "\u274C" : "\u2139\uFE0F";

  return html`
    <div
      role="alert"
      aria-live="polite"
      style="
      position:fixed;
      bottom:24px;
      left:50%;
      transform:translateX(-50%);
      z-index:9999;
      padding:10px 24px;
      border-radius:10px;
      background:${colors.bg};
      border:1px solid ${colors.border};
      color:${colors.text};
      font-size:13px;
      font-weight:500;
      display:flex;
      align-items:center;
      gap:8px;
      box-shadow:0 4px 12px rgba(0,0,0,0.15);
      backdrop-filter:blur(8px);
      animation:mcpToastIn 300ms ease both;
      pointer-events:none;
      max-width:min(560px, 90vw);
      white-space:pre-line;
      line-height:1.4;
      text-align:left;
    ">
      <span style="font-size:14px; flex-shrink:0;" aria-hidden="true">${icon}</span>
      ${toast.message}
    </div>
    <style>
      @keyframes mcpToastIn {
        from { opacity:0; transform:translateX(-50%) translateY(12px); }
        to   { opacity:1; transform:translateX(-50%) translateY(0); }
      }
    </style>
  `;
}

// ============================================================================
// Import MCP modal — JSON paste mode (imperative DOM, immune to Lit re-render)
// ============================================================================

type ManualAddConfig = NonNullable<ExtensionsPageProps["onManualAdd"]> extends (c: infer C) => void ? C : never;

/** Parse pasted JSON into server configs. Returns array on success, error string on failure. */
function _parseMcpJson(raw: string): ManualAddConfig[] | string {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return t("extensions.advanced.jsonPaste.parseError" as never) as string;
  }

  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return t("extensions.advanced.jsonPaste.parseError" as never) as string;
  }

  const rec = obj as Record<string, unknown>;

  // Unwrap "mcpServers" envelope if present
  const servers: Record<string, unknown> =
    rec.mcpServers && typeof rec.mcpServers === "object" && !Array.isArray(rec.mcpServers)
      ? (rec.mcpServers as Record<string, unknown>)
      : rec;

  // Format C: bare server config (has "command" or "url" at top level)
  if (typeof servers.command === "string" || typeof servers.url === "string") {
    const cfg = _extractServerConfig("mcp-server", servers);
    if (!cfg) return t("extensions.advanced.jsonPaste.invalidConfig" as never) as string;
    return [cfg];
  }

  // Format A / B: iterate named server entries
  const results: ManualAddConfig[] = [];
  for (const [name, val] of Object.entries(servers)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    const cfg = _extractServerConfig(name, val as Record<string, unknown>);
    if (cfg) results.push(cfg);
  }

  if (results.length === 0) {
    return t("extensions.advanced.jsonPaste.noServers" as never) as string;
  }
  return results;
}

function _extractServerConfig(id: string, obj: Record<string, unknown>): ManualAddConfig | null {
  const command = typeof obj.command === "string" ? obj.command : "";
  const url = typeof obj.url === "string" ? obj.url : undefined;
  if (!command && !url) return null;

  const transport: "stdio" | "sse" = url && !command ? "sse" : "stdio";
  const args = Array.isArray(obj.args) ? obj.args.filter((a): a is string => typeof a === "string") : [];
  const env =
    obj.env && typeof obj.env === "object" && !Array.isArray(obj.env)
      ? (obj.env as Record<string, string>)
      : undefined;
  const headers =
    obj.headers && typeof obj.headers === "object" && !Array.isArray(obj.headers)
      ? (obj.headers as Record<string, string>)
      : undefined;

  return { id, command, args, transport, env, url, headers };
}

/**
 * Open import-MCP modal: creates a centered overlay with a JSON textarea.
 * Pure DOM — not a Lit template — so it's immune to re-render race conditions.
 */
function _openImportMcpModal(onManualAdd: ExtensionsPageProps["onManualAdd"]): void {
  if (!onManualAdd) return;
  // Prevent duplicate
  if (document.getElementById("mcp-import-modal-backdrop")) return;

  const placeholder = `{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@org/mcp-server"]
    }
  }
}`;

  // --- Backdrop ---
  const backdrop = document.createElement("div");
  backdrop.id = "mcp-import-modal-backdrop";
  Object.assign(backdrop.style, {
    position: "fixed", inset: "0", zIndex: "9999",
    background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    animation: "extUpdateIn 150ms ease both",
  });

  const close = () => { backdrop.remove(); };
  backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) close(); });

  // --- Dialog card ---
  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "var(--card, #1e293b)", border: "1px solid var(--border, #334155)",
    borderRadius: "12px", padding: "24px", width: "520px", maxWidth: "90vw",
    maxHeight: "80vh", overflowY: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
    display: "flex", flexDirection: "column", gap: "14px",
    animation: "extUpdateIn 200ms ease both",
  });

  // Title row
  const titleRow = document.createElement("div");
  Object.assign(titleRow.style, { display: "flex", alignItems: "center", justifyContent: "space-between" });
  const title = document.createElement("div");
  title.textContent = t("extensions.stats.importMcp" as never) as string;
  Object.assign(title.style, { fontSize: "15px", fontWeight: "700", color: "var(--fg, #e2e8f0)" });
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "\u2715";
  Object.assign(closeBtn.style, {
    all: "unset", cursor: "pointer", fontSize: "16px", color: "var(--muted, #8b9caf)",
    padding: "4px 8px", borderRadius: "4px", lineHeight: "1",
  });
  closeBtn.addEventListener("click", close);
  titleRow.append(title, closeBtn);

  // Hint text
  const hint = document.createElement("div");
  hint.textContent = t("extensions.advanced.jsonPaste.hint" as never) as string;
  Object.assign(hint.style, { fontSize: "12px", color: "var(--muted-strong, #6b7d91)", lineHeight: "1.5" });

  // Textarea
  const textarea = document.createElement("textarea");
  textarea.placeholder = placeholder;
  textarea.rows = 10;
  Object.assign(textarea.style, {
    padding: "10px 12px", border: "1px solid var(--border, #334155)",
    borderRadius: "8px", background: "var(--bg, #0f172a)", color: "var(--fg, #e2e8f0)",
    fontSize: "13px", fontFamily: "monospace", resize: "vertical",
    outline: "none", tabSize: "2", whiteSpace: "pre", lineHeight: "1.5",
  });
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = textarea.selectionStart, end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, s) + "  " + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = s + 2;
    }
    if (e.key === "Escape") close();
  });

  // Status line
  const status = document.createElement("div");
  Object.assign(status.style, { display: "none", fontSize: "12px", padding: "0 2px", lineHeight: "1.4" });

  // Button row
  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, { display: "flex", gap: "10px", justifyContent: "flex-end", alignItems: "center" });

  const spinner = document.createElement("span");
  spinner.textContent = t("extensions.advanced.jsonPaste.adding" as never) as string;
  Object.assign(spinner.style, { display: "none", fontSize: "12px", color: "var(--muted-strong, #6b7d91)" });

  const submitBtn = document.createElement("button");
  submitBtn.textContent = t("extensions.advanced.manualAdd.submit" as never) as string;
  Object.assign(submitBtn.style, {
    all: "unset", cursor: "pointer", padding: "8px 24px", borderRadius: "8px",
    fontSize: "13px", fontWeight: "600", background: "var(--accent, #6366f1)", color: "#fff",
    transition: "opacity 150ms",
  });

  submitBtn.addEventListener("click", () => {
    const raw = textarea.value.trim();
    if (!raw) return;

    const result = _parseMcpJson(raw);
    if (typeof result === "string") {
      status.textContent = result;
      status.style.display = "block";
      status.style.color = "#f87171";
      return;
    }

    status.style.display = "none";
    spinner.style.display = "inline";
    submitBtn.style.opacity = "0.5";
    submitBtn.style.pointerEvents = "none";

    void (async () => {
      const ok: string[] = [], fail: string[] = [];
      for (const cfg of result) {
        (await onManualAdd(cfg)) ? ok.push(cfg.id) : fail.push(cfg.id);
      }

      submitBtn.style.opacity = "1";
      submitBtn.style.pointerEvents = "";
      spinner.style.display = "none";

      if (fail.length > 0 && ok.length === 0) {
        status.textContent = (t("extensions.advanced.jsonPaste.addFailed" as never) as string).replace("{{names}}", fail.join(", "));
        status.style.color = "#f87171";
        status.style.display = "block";
      } else if (fail.length > 0) {
        status.textContent = (t("extensions.advanced.jsonPaste.addPartial" as never) as string).replace("{{ok}}", ok.join(", ")).replace("{{fail}}", fail.join(", "));
        status.style.color = "#fb923c";
        status.style.display = "block";
      } else {
        status.textContent = (t("extensions.advanced.jsonPaste.addSuccess" as never) as string).replace("{{names}}", ok.join(", "));
        status.style.color = "#34d399";
        status.style.display = "block";
        setTimeout(close, 1200);
      }
    })();
  });

  btnRow.append(spinner, submitBtn);
  card.append(titleRow, hint, textarea, status, btnRow);
  backdrop.append(card);
  document.body.append(backdrop);

  // Auto-focus textarea
  requestAnimationFrame(() => textarea.focus());
}

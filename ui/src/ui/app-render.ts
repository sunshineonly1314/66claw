import { html, nothing } from "lit";

import type { GatewayBrowserClient, GatewayHelloOk } from "./gateway";
import type { AppViewState, McpMarketplaceItem } from "./app-view-state";
import { parseAgentSessionKey } from "../../../src/routing/session-key.js";
import {
  getTabGroups,
  iconForTab,
  pathForTab,
  subtitleForTab,
  titleForTab,
  type Tab,
} from "./navigation";
import { t, type TranslationKey } from "./i18n/index.js";
import { icons } from "./icons";
import type { UiSettings } from "./storage";
import type { ThemeMode } from "./theme";
import type { ThemeTransitionContext } from "./theme-transition";
import type {
  ConfigSnapshot,
  CronJob,
  CronRunLogEntry,
  CronStatus,
  HealthSnapshot,
  LogEntry,
  LogLevel,
  PresenceEntry,
  ChannelsStatusSnapshot,
  SessionsListResult,
  SkillStatusReport,
  StatusSummary,
} from "./types";
import type { ChatQueueItem, CronFormState } from "./ui-types";
import { refreshChatAvatar } from "./app-chat";
import { renderChat } from "./views/chat";
import { renderConfig } from "./views/config";
import { renderChannels } from "./views/channels";
import { renderCron } from "./views/cron";
import { renderDebug } from "./views/debug";
import { renderInstances } from "./views/instances";
import { renderLogs } from "./views/logs";
import { renderNodes } from "./views/nodes";
import { renderOverview } from "./views/overview";
import { renderUsageTab } from "./app-render-usage-tab";
import { renderSessions } from "./views/sessions";
import { renderExecApprovalPrompt } from "./views/exec-approval";
import { renderGatewayUrlConfirmation } from "./views/gateway-url-confirmation";
import { renderSkillInstallApproval } from "./views/skill-install-approval";
import { renderSkillInstallProgress } from "./views/skill-install-progress";
import {
  approveDevicePairing,
  loadDevices,
  rejectDevicePairing,
  revokeDeviceToken,
  rotateDeviceToken,
} from "./controllers/devices";
import { renderAgents } from "./views/agents";
import { renderSkills } from "./views/skills";
import { renderPlayground } from "./views/playground";
import "./views/model-config";
import { renderExtensions } from "./views/extensions-page";
import {
  restartMcpServer,
  disableMcpServer,
  enableMcpServer,
  testMcpServer,
  checkMcpUpdate,
  handleConfigClick as mcpConfigClick,
  installMarketplaceItem,
  uninstallMarketplaceItem,
  updateMarketplaceItem,
  loadMarketplaceItems,
  loadMarketplaceRecommendations,
  batchUpdateMcpServerEnv,
  fetchServerEnvStatus,
  type McpLifecycleState,
  type MarketplaceCallbacks,
} from "./controllers/mcp-lifecycle.js";
// 官方原始组件（已禁用）
// import { renderSkillsBatchBanner } from "./views/skills-batch-banner";
// import { renderSkillsBatchConfirm } from "./views/skills-batch-confirm";
// import { renderSkillsBatchProgress } from "./views/skills-batch-progress";
// import { renderSkillsBatchResult } from "./views/skills-batch-result";
// import { renderSkillsBatchComplete } from "./views/skills-batch-complete";

// 🎨 增强版组件（基于您的精美设计）
import { renderSkillsBatchBannerEnhanced as renderSkillsBatchBanner } from "./views/skills-batch-banner-enhanced";
import { renderSkillsBatchConfirmEnhanced as renderSkillsBatchConfirm } from "./views/skills-batch-confirm-enhanced";
import { renderSkillsBatchProgressEnhanced as renderSkillsBatchProgress } from "./views/skills-batch-progress-enhanced";
import { renderSkillsBatchCompleteEnhanced as renderSkillsBatchComplete } from "./views/skills-batch-complete-enhanced";

// 保留 Pill 和 Result（暂无增强版）
import { renderSkillsBatchPill } from "./views/skills-batch-pill";
import { renderSkillsBatchResult } from "./views/skills-batch-result";
import {
  checkBatchSkills,
  startBatchInstall,
  cancelBatchInstall,
  reportBatchFailures,
  dismissBanner,
} from "./controllers/skills-batch";
import {
  renderDocs,
  searchDocs,
  handleDocSelect,
  handleDocsBack,
  handleDocsSearch,
  handleToggleFavorite,
  type DocsViewProps,
} from "./views/docs";
import {
  renderFeedbackTrigger,
  renderFeedbackModal,
  type FeedbackViewProps,
} from "./views/feedback";
import {
  loadPlaygroundSkills,
  setPlaygroundCategory,
  handleTrySkill,
  installSkillDeps,
} from "./controllers/playground";
import { renderChatControls, renderTab, renderThemeToggle } from "./app-render.helpers";
import {
  renderActivationDialog,
  renderExpiredDialog,
  renderRenewalReminderDialog,
  renderNotificationDialog,
  renderForceUpdateDialog,
  renderDeviceLimitDialog,
  renderDeviceSwitchDialog,
  renderDeviceSwitchCooldownDialog,
  renderOfflineBanner,
  type LicenseDialogType,
} from "./license/index";
import { handleRenewalReminderDismiss } from "./app-gateway";
import { loadChannels } from "./controllers/channels";
import { loadPresence } from "./controllers/presence";
import { deleteSession, loadSessions, patchSession } from "./controllers/sessions";
import {
  installRemoteSkill,
  installSkill,
  loadMarketSkills,
  loadMoreSkills,
  loadRemoteSkills,
  loadSkills,
  refreshMarketSkills,
  saveSkillApiKey,
  setActiveTab,
  SKILLS_PAGE_SIZE,
  toggleSkillPinned,
  updateSkillEdit,
  updateSkillEnabled,
  type SkillMessage,
} from "./controllers/skills";
import { loadAgentFileContent, loadAgentFiles, saveAgentFile } from "./controllers/agent-files";
import { loadAgentIdentities, loadAgentIdentity } from "./controllers/agent-identity";
import { loadAgentSkills } from "./controllers/agent-skills";
import { loadAgents } from "./controllers/agents";
import { loadNodes } from "./controllers/nodes";
import { loadChatHistory } from "./controllers/chat";
import {
  applyConfig,
  loadConfig,
  runUpdate,
  saveConfig,
  updateConfigFormValue,
  removeConfigFormValue,
} from "./controllers/config";
import {
  loadExecApprovals,
  removeExecApprovalsFormValue,
  saveExecApprovals,
  updateExecApprovalsFormValue,
} from "./controllers/exec-approvals";
import { loadCronRuns, toggleCronJob, runCronJob, removeCronJob, addCronJob } from "./controllers/cron";
import { loadDebug, callDebugMethod } from "./controllers/debug";
import { loadLogs } from "./controllers/logs";
import {
  buildDiscoveryProps,
  shouldShowDiscovery,
  handleSkip as handleDiscoverySkip,
  handleSuggestionClick as handleDiscoverySuggestionClick,
  runCapabilityDetection,
  markFirstVisitCompleted,
  createInitialDiscoveryState,
} from "./controllers/capability-detect";

const AVATAR_DATA_RE = /^data:/i;
const AVATAR_HTTP_RE = /^https?:\/\//i;
const MCP_TOAST_DURATION_MS = 4000;
const MCP_TOAST_ERROR_DURATION_MS = 8000;

/**
 * Show a toast notification for MCP install/uninstall/error actions.
 * Auto-clears after 4s (success/info) or 8s (error) for readability.
 */
function showMcpToast(state: AppViewState, message: string, type: "success" | "error" | "info"): void {
  if (state._mcpToastTimer) {
    clearTimeout(state._mcpToastTimer);
  }
  state.mcpMarketplace = {
    ...state.mcpMarketplace,
    toast: { message, type, timestamp: Date.now() },
  };
  const duration = type === "error" ? MCP_TOAST_ERROR_DURATION_MS : MCP_TOAST_DURATION_MS;
  state._mcpToastTimer = window.setTimeout(() => {
    state.mcpMarketplace = { ...state.mcpMarketplace, toast: null };
    state._mcpToastTimer = null;
  }, duration);
}

function resolveAssistantAvatarUrl(state: AppViewState): string | undefined {
  const list = state.agentsList?.agents ?? [];
  const parsed = parseAgentSessionKey(state.sessionKey);
  const agentId =
    parsed?.agentId ??
    state.agentsList?.defaultId ??
    "main";
  const agent = list.find((entry) => entry.id === agentId);
  const identity = agent?.identity;
  const candidate = identity?.avatarUrl ?? identity?.avatar;
  if (!candidate) return undefined;
  if (AVATAR_DATA_RE.test(candidate) || AVATAR_HTTP_RE.test(candidate)) return candidate;
  return identity?.avatarUrl;
}

/**
 * 渲染二维码 popover 内容
 * 有二维码 → 显示图片；正在加载 → 显示加载动画；无数据 → 不显示 popover
 */
function renderQrcodePopover(
  qrcode: { base64: string; groupName: string } | undefined | null,
  isLoading: boolean,
  titleKey: TranslationKey,
  extraDesc?: ReturnType<typeof html>,
) {
  if (qrcode) {
    return html`
      <div class="topbar-support__popover">
        <div class="topbar-support__popover-arrow"></div>
        <div class="topbar-support__popover-title">${t(titleKey)}</div>
        <img class="topbar-support__qrcode" src="${qrcode.base64}" alt="Support QR" />
        <div class="topbar-support__popover-desc">${qrcode.groupName}</div>
        ${extraDesc ?? nothing}
      </div>
    `;
  }

  if (isLoading) {
    return html`
      <div class="topbar-support__popover">
        <div class="topbar-support__popover-arrow"></div>
        <div class="topbar-support__popover-title">${t(titleKey)}</div>
        <div class="topbar-support__loading">
          <div class="topbar-support__spinner"></div>
          <div class="topbar-support__loading-text">${t("support.loading")}</div>
        </div>
      </div>
    `;
  }

  return nothing;
}

/**
 * 顶栏技术支持按钮（根据用户类型显示不同内容）
 * - 正式用户：⭐ 专属技术支持 (hover 弹出二维码)
 * - 试用用户：💬 技术支持 + 🛒 升级正式版
 *
 * 交互：鼠标悬浮显示二维码，移走消失
 * 预加载：进入 chat 页面时已主动拉取，hover 时立即显示
 */
function renderTopbarSupportButtons(state: AppViewState) {
  const license = state.licenseState?.license;
  if (!license) return nothing;

  const isTestUser = license.keyType === "test" || license.keyType === "trial";
  const qrcode = license.supportQrcode;
  const isLoading = state.qrcodePreloading ?? false;

  if (isTestUser) {
    // 试用用户：获取专属技术支持 + 升级按钮
    const handleUpgradeClick = async (e: Event) => {
      e.preventDefault();
      const url = license.purchaseUrl;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      try {
        const resp = await fetch("/config/purchase-url");
        if (!resp.ok) return;
        const json = (await resp.json()) as { code?: number; data?: { xianyu?: string } };
        const fetchedUrl = json?.code === 200 && json?.data?.xianyu ? json.data.xianyu : null;
        if (fetchedUrl) window.open(fetchedUrl, "_blank", "noopener,noreferrer");
      } catch { /* silent */ }
    };

    return html`
      <div class="topbar-support topbar-support--test">
        <div class="topbar-support__btn topbar-support__btn--support">
          <span class="topbar-support__icon">💬</span>
          <span class="topbar-support__text">${t("support.getExclusiveSupport")}</span>
          ${renderQrcodePopover(qrcode, isLoading, "support.scanForSupport")}
        </div>
        <button
          type="button"
          class="topbar-support__btn topbar-support__btn--upgrade topbar-support__btn--gold-breathe"
          @click=${handleUpgradeClick}
        >
          <span class="topbar-support__icon">👑</span>
          <span class="topbar-support__text">${t("support.upgradePro")}</span>
        </button>
      </div>
    `;
  }

  // 正式用户：专属VIP支持
  return html`
    <div class="topbar-support topbar-support--pro">
      <div class="topbar-support__btn topbar-support__btn--pro-support">
        <span class="topbar-support__icon">👑</span>
        <span class="topbar-support__text">${t("support.exclusiveSupport")}</span>
        ${renderQrcodePopover(
          qrcode,
          isLoading,
          "support.scanForPremiumSupport",
          html`<div class="topbar-support__popover-sub">${t("support.premiumGroupDesc")}</div>`,
        )}
      </div>
    </div>
  `;
}

function renderApiMonitor(state: AppViewState) {
  const isWaiting =
    state.chatRunId !== null &&
    state.chatStream !== null &&
    state.chatStream.trim().length === 0 &&
    state.chatStreamStartedAt !== null;

  const elapsed = state.apiMonitorElapsedMs;

  // Don't show if nothing to display or dismissed
  if (!isWaiting && elapsed === 0) return nothing;
  if (state.apiMonitorDismissed) return nothing;

  const seconds = Math.floor(elapsed / 1000);
  // Hide for very short waits to avoid visual noise
  if (isWaiting && seconds < 3) return nothing;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const timeStr =
    minutes > 0
      ? `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
      : `${seconds}s`;

  // Determine severity
  const level: "normal" | "warning" | "danger" =
    seconds < 10 ? "normal" : seconds < 30 ? "warning" : "danger";

  // Just completed — brief green flash
  if (!isWaiting && elapsed > 0) {
    return html`
      <div class="api-monitor api-monitor--ok" title="API responded in ${timeStr}">
        <span class="api-monitor__dot api-monitor__dot--ok"></span>
        <span class="api-monitor__time">API ${timeStr} ✓</span>
      </div>
    `;
  }

  const title =
    level === "danger"
      ? t("apiMonitor.slowWarning" as TranslationKey)
      : t("apiMonitor.waiting" as TranslationKey);

  return html`
    <div class="api-monitor api-monitor--${level}" title="${title}">
      <span class="api-monitor__dot api-monitor__dot--${level}"></span>
      <span class="api-monitor__time">${timeStr}</span>
      ${level === "danger"
        ? html`<span class="api-monitor__label">${t("apiMonitor.slow" as TranslationKey)}</span>`
        : nothing}
      ${seconds > 15
        ? html`<button
            class="api-monitor__dismiss"
            @click=${(e: Event) => {
              e.stopPropagation();
              state.apiMonitorDismissed = true;
            }}
            title="${t("apiMonitor.dismiss" as TranslationKey)}"
          >&times;</button>`
        : nothing}
    </div>
  `;
}

export function renderApp(state: AppViewState) {
  const presenceCount = state.presenceEntries.length;
  const sessionsCount = state.sessionsResult?.count ?? null;
  const cronNext = state.cronStatus?.nextWakeAtMs ?? null;
  const chatDisabledReason = state.connected ? null : t("connection.disconnectedFromGateway");
  const isChat = state.tab === "chat";
  const chatFocus = isChat && (state.settings.chatFocusMode || state.onboarding);
  const showThinking = state.onboarding ? false : state.settings.chatShowThinking;
  const assistantAvatarUrl = resolveAssistantAvatarUrl(state);
  const chatAvatarUrl = state.chatAvatarUrl ?? assistantAvatarUrl ?? null;
  const configValue =
    state.configForm ?? (state.configSnapshot?.config as Record<string, unknown> | null);
  const resolvedAgentId =
    state.agentsSelectedId ??
    state.agentsList?.defaultId ??
    state.agentsList?.agents?.[0]?.id ??
    null;

  return html`
    <div class="shell ${isChat ? "shell--chat" : ""} ${chatFocus ? "shell--chat-focus" : ""} ${state.settings.navCollapsed ? "shell--nav-collapsed" : ""} ${state.onboarding ? "shell--onboarding" : ""}">
      <header class="topbar">
        <div class="topbar-left">
          <button
            class="nav-collapse-toggle"
            @click=${() =>
              state.applySettings({
                ...state.settings,
                navCollapsed: !state.settings.navCollapsed,
              })}
            title="${state.settings.navCollapsed ? "Expand sidebar" : "Collapse sidebar"}"
            aria-label="${state.settings.navCollapsed ? "Expand sidebar" : "Collapse sidebar"}"
          >
            <span class="nav-collapse-toggle__icon">${icons.menu}</span>
          </button>
          <div class="brand">
            <div class="brand-logo">
              <img src="/logo.png" alt="ClawbotCN" />
            </div>
            <div class="brand-text">
              <div class="brand-title">ClawbotCN</div>
              <div class="brand-sub">- <strong>全栈国内运行</strong></div>
            </div>
          </div>
        </div>
        <div class="topbar-status">
          ${renderTopbarSupportButtons(state)}
          <a href="https://www.obplugins.cn" target="_blank" rel="noreferrer" class="topbar-promo">
            <span class="topbar-promo__dot"></span>
            <span class="topbar-promo__brand">TecbinAI</span>
            <span class="topbar-promo__sep"></span>
            <span class="topbar-promo__desc">及时追踪AI · 解锁更多玩法</span>
          </a>
          ${renderApiMonitor(state)}
          <div class="pill">
            <span class="statusDot ${state.connected ? "ok" : ""}"></span>
            <span>Health</span>
            <span class="mono">${state.connected ? "OK" : "Offline"}</span>
          </div>
          ${renderThemeToggle(state)}
        </div>
      </header>
      <aside class="nav ${state.settings.navCollapsed ? "nav--collapsed" : ""}">
        ${getTabGroups().map((group) => {
          const isGroupCollapsed = state.settings.navGroupsCollapsed[group.label] ?? false;
          const hasActiveTab = group.tabs.some((tab) => tab === state.tab);
          return html`
            <div class="nav-group ${isGroupCollapsed && !hasActiveTab ? "nav-group--collapsed" : ""}">
              <button
                class="nav-label"
                @click=${() => {
                  const next = { ...state.settings.navGroupsCollapsed };
                  next[group.label] = !isGroupCollapsed;
                  state.applySettings({
                    ...state.settings,
                    navGroupsCollapsed: next,
                  });
                }}
                aria-expanded=${!isGroupCollapsed}
              >
                <span class="nav-label__text">${group.label}</span>
                <span class="nav-label__chevron">${isGroupCollapsed ? "+" : "−"}</span>
              </button>
              <div class="nav-group__items">
                ${group.tabs.map((tab) => renderTab(state, tab))}
              </div>
            </div>
          `;
        })}
        <div class="nav-group nav-group--links">
          <div class="nav-label nav-label--static">
            <span class="nav-label__text">${t("nav.docs")}</span>
          </div>
          <div class="nav-group__items">
            ${renderFeedbackTrigger(state.handleFeedbackOpen)}
            ${renderTab(state, "docs")}
          </div>
        </div>
        <!-- tecbinai Footer Link -->
        <div class="nav-footer">
          <a href="https://www.obplugins.cn" target="_blank" rel="noreferrer" class="nav-footer-link">
            <span class="nav-footer-icon">🚀</span>
            <span class="nav-footer-text">
              <span class="nav-footer-title">tecbinai</span>
              <span class="nav-footer-desc">及时追踪 AI 内容</span>
            </span>
          </a>
        </div>
      </aside>
      <main class="content ${isChat ? "content--chat" : ""}">
        <section class="content-header">
          <div>
            <div class="page-title">${titleForTab(state.tab)}</div>
            <div class="page-sub">${subtitleForTab(state.tab)}</div>
          </div>
          <div class="page-meta">
            ${state.lastError
              ? html`<div class="pill danger">${state.lastError}</div>`
              : nothing}
            ${isChat ? renderChatControls(state) : nothing}
          </div>
        </section>

        ${state.tab === "overview"
          ? renderOverview({
              connected: state.connected,
              hello: state.hello,
              settings: state.settings,
              password: state.password,
              lastError: state.lastError,
              presenceCount,
              sessionsCount,
              cronEnabled: state.cronStatus?.enabled ?? null,
              cronNext,
              lastChannelsRefresh: state.channelsLastSuccess,
              usageLoading: state.usageLoading,
              usageSummary: state.usageSummary,
              usageError: state.usageError,
              // 模型选择相关
              modelsLoading: state.modelsLoading,
              modelsProviders: state.modelsProviders,
              modelsDefaults: state.modelsDefaults,
              modelsCurrent: state.modelsCurrent,
              modelsSaving: state.modelsSaving,
              modelsError: state.modelsError,
              modelsSuccessMessage: state.modelsSuccessMessage,
              modelsAuthSaving: state.modelsAuthSaving,
              modelsConfiguringProvider: state.modelsConfiguringProvider,
              modelsAuthVerifying: state.modelsAuthVerifying,
              modelsAuthVerifyResult: state.modelsAuthVerifyResult,
              // 安全模式相关
              securityLoading: state.securityLoading,
              securityModes: state.securityModes,
              securityCurrent: state.securityCurrent,
              securitySaving: state.securitySaving,
              securityError: state.securityError,
              securityShowWarning: state.securityShowWarning,
              securitySuccessMessage: state.securitySuccessMessage,
              onSettingsChange: (next) => state.applySettings(next),
              onPasswordChange: (next) => (state.password = next),
              onSessionKeyChange: (next) => {
                state.sessionKey = next;
                state.chatMessage = "";
                state.resetToolStream();
                state.applySettings({
                  ...state.settings,
                  sessionKey: next,
                  lastActiveSessionKey: next,
                });
                void state.loadAssistantIdentity();
              },
              onConnect: () => state.connect(),
              onRefresh: () => state.loadOverview(),
              onNavigateToUsage: () => state.setTab("usage" as Tab),
              onModelChange: (provider, model) => state.setModelPrimary(provider, model),
              modelsPendingProvider: state.modelsPendingProvider,
              modelsPendingModel: state.modelsPendingModel,
              onModelPendingChange: (provider, model) => state.setModelPending(provider, model),
              onModelPendingCancel: () => state.cancelModelPending(),
              onModelPendingConfirm: () => state.confirmModelPending(),
              onNavigateToConfig: () => state.setTab("config" as Tab),
              onSetConfiguringProvider: (providerId) => state.setConfiguringProvider(providerId),
              onSaveProviderAuth: (provider, auth) => state.saveProviderAuth(provider, auth),
              onVerifyApiKey: (provider, apiKey, model) => state.verifyProviderApiKey(provider, apiKey, model),
              onClearVerifyResult: () => state.clearAuthVerifyResult(),
              // 安全模式回调
              onSecurityModeChange: (mode) => state.setSecurityMode(mode),
              onCloseSecurityWarning: () => state.closeSecurityWarning(),
              onConfirmSecurityTrust: () => state.confirmSecurityTrustMode(),
            })
          : nothing}

        ${renderUsageTab(state)}

        ${state.tab === "channels"
          ? renderChannels({
              connected: state.connected,
              loading: state.channelsLoading,
              snapshot: state.channelsSnapshot,
              lastError: state.channelsError,
              lastSuccessAt: state.channelsLastSuccess,
              whatsappMessage: state.whatsappLoginMessage,
              whatsappQrDataUrl: state.whatsappLoginQrDataUrl,
              whatsappConnected: state.whatsappLoginConnected,
              whatsappBusy: state.whatsappBusy,
              configSchema: state.configSchema,
              configSchemaLoading: state.configSchemaLoading,
              configForm: state.configForm,
              configUiHints: state.configUiHints,
              configSaving: state.configSaving,
              configFormDirty: state.configFormDirty,
              nostrProfileFormState: state.nostrProfileFormState,
              nostrProfileAccountId: state.nostrProfileAccountId,
              onRefresh: (probe) => loadChannels(state, probe),
              onWhatsAppStart: (force) => state.handleWhatsAppStart(force),
              onWhatsAppWait: () => state.handleWhatsAppWait(),
              onWhatsAppLogout: () => state.handleWhatsAppLogout(),
              onConfigPatch: (path, value) => updateConfigFormValue(state, path, value),
              onConfigSave: () => state.handleChannelConfigSave(),
              onConfigReload: () => state.handleChannelConfigReload(),
              onNostrProfileEdit: (accountId, profile) =>
                state.handleNostrProfileEdit(accountId, profile),
              onNostrProfileCancel: () => state.handleNostrProfileCancel(),
              onNostrProfileFieldChange: (field, value) =>
                state.handleNostrProfileFieldChange(field, value),
              onNostrProfileSave: () => state.handleNostrProfileSave(),
              onNostrProfileImport: () => state.handleNostrProfileImport(),
              onNostrProfileToggleAdvanced: () => state.handleNostrProfileToggleAdvanced(),
            })
          : nothing}

        ${state.tab === "instances"
          ? renderInstances({
              loading: state.presenceLoading,
              entries: state.presenceEntries,
              lastError: state.presenceError,
              statusMessage: state.presenceStatus,
              onRefresh: () => loadPresence(state),
            })
          : nothing}

        ${state.tab === "sessions"
          ? renderSessions({
              loading: state.sessionsLoading,
              result: state.sessionsResult,
              error: state.sessionsError,
              activeMinutes: state.sessionsFilterActive,
              limit: state.sessionsFilterLimit,
              includeGlobal: state.sessionsIncludeGlobal,
              includeUnknown: state.sessionsIncludeUnknown,
              basePath: state.basePath,
              onFiltersChange: (next) => {
                state.sessionsFilterActive = next.activeMinutes;
                state.sessionsFilterLimit = next.limit;
                state.sessionsIncludeGlobal = next.includeGlobal;
                state.sessionsIncludeUnknown = next.includeUnknown;
	              },
	              onRefresh: () => loadSessions(state),
	              onPatch: (key, patch) => patchSession(state, key, patch),
	              onDelete: (key) => deleteSession(state, key),
	            })
	          : nothing}

        ${state.tab === "cron"
          ? renderCron({
              loading: state.cronLoading,
              status: state.cronStatus,
              jobs: state.cronJobs,
              error: state.cronError,
              busy: state.cronBusy,
              form: state.cronForm,
              channels: state.channelsSnapshot?.channelMeta?.length
                ? state.channelsSnapshot.channelMeta.map((entry) => entry.id)
                : state.channelsSnapshot?.channelOrder ?? [],
              channelLabels: state.channelsSnapshot?.channelLabels ?? {},
              channelMeta: state.channelsSnapshot?.channelMeta ?? [],
              runsJobId: state.cronRunsJobId,
              runs: state.cronRuns,
              onFormChange: (patch) => (state.cronForm = { ...state.cronForm, ...patch }),
              onRefresh: () => state.loadCron(),
              onAdd: () => addCronJob(state),
              onToggle: (job, enabled) => toggleCronJob(state, job, enabled),
              onRun: (job) => runCronJob(state, job),
              onRemove: (job) => removeCronJob(state, job),
              onLoadRuns: (jobId) => loadCronRuns(state, jobId),
            })
          : nothing}

        ${state.tab === "playground"
          ? renderPlayground({
              loading: state.playgroundLoading ?? false,
              report: state.playgroundReport ?? null,
              error: state.playgroundError ?? null,
              activeCategory: state.playgroundActiveCategory ?? null,
              filter: state.playgroundFilter ?? "",
              onFilterChange: (next) => (state.playgroundFilter = next),
              installingSkill: state.playgroundInstallingSkill ?? null,
              installMessage: state.playgroundInstallMessage ?? null,
              onCategoryChange: (category) =>
                setPlaygroundCategory(state, category),
              onTrySkill: (skillName, example) => {
                handleTrySkill(
                  (tab) => state.setTab(tab),
                  (msg) => (state.chatMessage = msg),
                  skillName,
                  example,
                );
              },
              onInstallSkill: (skill) => {
                installSkillDeps(state, skill);
              },
              onRefresh: () => loadPlaygroundSkills(state),
              onGoToSkills: () => state.setTab("skills" as any),
            })
          : nothing}

        ${
          state.tab === "agents"
            ? renderAgents({
                loading: state.agentsLoading,
                error: state.agentsError,
                agentsList: state.agentsList,
                selectedAgentId: resolvedAgentId,
                activePanel: state.agentsPanel,
                configForm: configValue,
                configLoading: state.configLoading,
                configSaving: state.configSaving,
                configDirty: state.configFormDirty,
                channelsLoading: state.channelsLoading,
                channelsError: state.channelsError,
                channelsSnapshot: state.channelsSnapshot,
                channelsLastSuccess: state.channelsLastSuccess,
                cronLoading: state.cronLoading,
                cronStatus: state.cronStatus,
                cronJobs: state.cronJobs,
                cronError: state.cronError,
                agentFilesLoading: state.agentFilesLoading,
                agentFilesError: state.agentFilesError,
                agentFilesList: state.agentFilesList,
                agentFileActive: state.agentFileActive,
                agentFileContents: state.agentFileContents,
                agentFileDrafts: state.agentFileDrafts,
                agentFileSaving: state.agentFileSaving,
                agentIdentityLoading: state.agentIdentityLoading,
                agentIdentityError: state.agentIdentityError,
                agentIdentityById: state.agentIdentityById,
                agentSkillsLoading: state.agentSkillsLoading,
                agentSkillsReport: state.agentSkillsReport,
                agentSkillsError: state.agentSkillsError,
                agentSkillsAgentId: state.agentSkillsAgentId,
                skillsFilter: state.skillsFilter,
                onRefresh: async () => {
                  await loadAgents(state);
                  const agentIds = state.agentsList?.agents?.map((entry) => entry.id) ?? [];
                  if (agentIds.length > 0) void loadAgentIdentities(state, agentIds);
                },
                onSelectAgent: (agentId) => {
                  if (state.agentsSelectedId === agentId) return;
                  state.agentsSelectedId = agentId;
                  state.agentFilesList = null;
                  state.agentFilesError = null;
                  state.agentFilesLoading = false;
                  state.agentFileActive = null;
                  state.agentFileContents = {};
                  state.agentFileDrafts = {};
                  state.agentSkillsReport = null;
                  state.agentSkillsError = null;
                  state.agentSkillsAgentId = null;
                  void loadAgentIdentity(state, agentId);
                  if (state.agentsPanel === "files") void loadAgentFiles(state, agentId);
                  if (state.agentsPanel === "skills") void loadAgentSkills(state, agentId);
                },
                onSelectPanel: (panel) => {
                  state.agentsPanel = panel;
                  if (panel === "files" && resolvedAgentId) {
                    if (state.agentFilesList?.agentId !== resolvedAgentId) {
                      state.agentFilesList = null;
                      state.agentFilesError = null;
                      state.agentFileActive = null;
                      state.agentFileContents = {};
                      state.agentFileDrafts = {};
                      void loadAgentFiles(state, resolvedAgentId);
                    }
                  }
                  if (panel === "skills" && resolvedAgentId) void loadAgentSkills(state, resolvedAgentId);
                  if (panel === "channels") void loadChannels(state, false);
                  if (panel === "cron") void state.loadCron();
                },
                onLoadFiles: (agentId) => loadAgentFiles(state, agentId),
                onSelectFile: (name) => {
                  state.agentFileActive = name;
                  if (resolvedAgentId) void loadAgentFileContent(state, resolvedAgentId, name);
                },
                onFileDraftChange: (name, content) => {
                  state.agentFileDrafts = { ...state.agentFileDrafts, [name]: content };
                },
                onFileReset: (name) => {
                  state.agentFileDrafts = { ...state.agentFileDrafts, [name]: state.agentFileContents[name] ?? "" };
                },
                onFileSave: (name) => {
                  if (!resolvedAgentId) return;
                  void saveAgentFile(state, resolvedAgentId, name, state.agentFileDrafts[name] ?? state.agentFileContents[name] ?? "");
                },
                onToolsProfileChange: (agentId, profile, clearAllow) => {
                  if (!configValue) return;
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) return;
                  const index = list.findIndex((e) => e && typeof e === "object" && "id" in e && (e as { id?: string }).id === agentId);
                  if (index < 0) return;
                  const bp = ["agents", "list", index, "tools"];
                  if (profile) updateConfigFormValue(state, [...bp, "profile"], profile);
                  else removeConfigFormValue(state, [...bp, "profile"]);
                  if (clearAllow) removeConfigFormValue(state, [...bp, "allow"]);
                },
                onToolsOverridesChange: (agentId, alsoAllow, deny) => {
                  if (!configValue) return;
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) return;
                  const index = list.findIndex((e) => e && typeof e === "object" && "id" in e && (e as { id?: string }).id === agentId);
                  if (index < 0) return;
                  const bp = ["agents", "list", index, "tools"];
                  if (alsoAllow.length > 0) updateConfigFormValue(state, [...bp, "alsoAllow"], alsoAllow);
                  else removeConfigFormValue(state, [...bp, "alsoAllow"]);
                  if (deny.length > 0) updateConfigFormValue(state, [...bp, "deny"], deny);
                  else removeConfigFormValue(state, [...bp, "deny"]);
                },
                onConfigReload: () => loadConfig(state),
                onConfigSave: () => saveConfig(state),
                onChannelsRefresh: () => loadChannels(state, false),
                onCronRefresh: () => state.loadCron(),
                onSkillsFilterChange: (next) => { state.skillsFilter = next; },
                onSkillsRefresh: () => { if (resolvedAgentId) void loadAgentSkills(state, resolvedAgentId); },
                onAgentSkillToggle: (agentId, skillName, enabled) => {
                  if (!configValue) return;
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) return;
                  const index = list.findIndex((e) => e && typeof e === "object" && "id" in e && (e as { id?: string }).id === agentId);
                  if (index < 0) return;
                  const entry = list[index] as { skills?: unknown };
                  const ns = skillName.trim();
                  if (!ns) return;
                  const allSkills = state.agentSkillsReport?.skills?.map((s) => s.name).filter(Boolean) ?? [];
                  const existing = Array.isArray(entry.skills) ? entry.skills.map((n) => String(n).trim()).filter(Boolean) : undefined;
                  const base = existing ?? allSkills;
                  const next = new Set(base);
                  if (enabled) next.add(ns); else next.delete(ns);
                  updateConfigFormValue(state, ["agents", "list", index, "skills"], [...next]);
                },
                onAgentSkillsClear: (agentId) => {
                  if (!configValue) return;
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) return;
                  const index = list.findIndex((e) => e && typeof e === "object" && "id" in e && (e as { id?: string }).id === agentId);
                  if (index < 0) return;
                  removeConfigFormValue(state, ["agents", "list", index, "skills"]);
                },
                onAgentSkillsDisableAll: (agentId) => {
                  if (!configValue) return;
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) return;
                  const index = list.findIndex((e) => e && typeof e === "object" && "id" in e && (e as { id?: string }).id === agentId);
                  if (index < 0) return;
                  updateConfigFormValue(state, ["agents", "list", index, "skills"], []);
                },
                onModelChange: (agentId, modelId) => {
                  if (!configValue) return;
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) return;
                  const index = list.findIndex((e) => e && typeof e === "object" && "id" in e && (e as { id?: string }).id === agentId);
                  if (index < 0) return;
                  const bp = ["agents", "list", index, "model"];
                  if (!modelId) { removeConfigFormValue(state, bp); return; }
                  const entry = list[index] as { model?: unknown };
                  const existing = entry?.model;
                  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
                    const fb = (existing as { fallbacks?: unknown }).fallbacks;
                    updateConfigFormValue(state, bp, { primary: modelId, ...(Array.isArray(fb) ? { fallbacks: fb } : {}) });
                  } else {
                    updateConfigFormValue(state, bp, modelId);
                  }
                },
                onModelFallbacksChange: (agentId, fallbacks) => {
                  if (!configValue) return;
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) return;
                  const index = list.findIndex((e) => e && typeof e === "object" && "id" in e && (e as { id?: string }).id === agentId);
                  if (index < 0) return;
                  const bp = ["agents", "list", index, "model"];
                  const entry = list[index] as { model?: unknown };
                  const normalized = fallbacks.map((n) => n.trim()).filter(Boolean);
                  const existing = entry.model;
                  const resolvePrimary = () => {
                    if (typeof existing === "string") return existing.trim() || null;
                    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
                      const p = (existing as { primary?: unknown }).primary;
                      return typeof p === "string" ? (p.trim() || null) : null;
                    }
                    return null;
                  };
                  const primary = resolvePrimary();
                  if (normalized.length === 0) {
                    if (primary) updateConfigFormValue(state, bp, primary);
                    else removeConfigFormValue(state, bp);
                    return;
                  }
                  updateConfigFormValue(state, bp, primary ? { primary, fallbacks: normalized } : { fallbacks: normalized });
                },
              })
            : nothing
        }

        ${state.tab === "skills"
          ? renderSkills({
              loading: state.skillsLoading,
              report: state.skillsReport,
              error: state.skillsError,
              filter: state.skillsFilter,
              edits: state.skillEdits,
              messages: state.skillMessages,
              busyKey: state.skillsBusyKey,
              connected: state.connected ?? false,
              installProgress: state.skillsInstallProgress ?? {},
              activeTab: state.skillsActiveTab ?? "active",
              remoteLoading: false,
              remoteIndex: null,
              remoteError: null,
              marketLoading: state.skillsMarketLoading ?? false,
              marketResponse: state.skillsMarketResponse ?? null,
              marketSyncing: state.skillsMarketSyncing ?? false,
              marketLastSyncedAt: state.skillsMarketLastSyncedAt ?? null,
              marketError: state.skillsMarketError ?? null,
              activeCategory: state.skillsActiveCategory ?? "all",
              visibleCount: state.skillsVisibleCount ?? SKILLS_PAGE_SIZE,
              onFilterChange: (next) => { state.skillsFilter = next; state.skillsVisibleCount = SKILLS_PAGE_SIZE; },
              onLoadMore: () => loadMoreSkills(state),
              onRefresh: () => loadSkills(state, { clearMessages: true }),
              onToggle: (key, enabled) => updateSkillEnabled(state, key, enabled),
              onEdit: (key, value) => updateSkillEdit(state, key, value),
              onSaveKey: (key) => saveSkillApiKey(state, key),
              onInstall: (skillKey, name, installId) =>
                installSkill(state, skillKey, name, installId),
              onTabChange: (tab) => {
                setActiveTab(state, tab);
                // Lazy-load MCP marketplace when switching to mcp-store tab
                if (tab === "mcp-store" && state.mcpMarketplace.items.length === 0 && !state.mcpMarketplace.loading) {
                  const mcpCallbacks: MarketplaceCallbacks = {
                    onStateChange: (patch) => {
                      state.mcpMarketplace = { ...state.mcpMarketplace, ...patch };
                    },
                  };
                  void loadMarketplaceItems(state.client, mcpCallbacks);
                }
              },
              onRefreshRemote: () => refreshMarketSkills(state),
              onInstallRemote: (skillName) => installRemoteSkill(state, skillName),
              onCategoryChange: (category) => { state.skillsActiveCategory = category; state.skillsVisibleCount = SKILLS_PAGE_SIZE; },
              onPinToggle: (skillKey, pinned) => toggleSkillPinned(state, skillKey, pinned),
              // MCP marketplace props for "MCP 市场" tab
              mcpMarketplace: state.mcpMarketplace,
              onMcpSearchChange: (search) => {
                state.mcpMarketplace = { ...state.mcpMarketplace, search };
              },
              onMcpCategoryChange: (category) => {
                state.mcpMarketplace = { ...state.mcpMarketplace, activeCategory: category };
              },
              onMcpSortChange: (sort) => {
                state.mcpMarketplace = { ...state.mcpMarketplace, sort };
              },
              onMcpOpenDetail: (item) => {
                state.mcpMarketplace = { ...state.mcpMarketplace, detailItem: item };
              },
              onMcpCloseDetail: () => {
                state.mcpMarketplace = { ...state.mcpMarketplace, detailItem: null };
              },
              onMcpInstall: (item) => {
                const runningCount = state.mcpProcesses.filter((p) => p.status === "running").length;
                if (runningCount >= 8) {
                  showMcpToast(state, t("extensions.store.limitReached").replace("{{count}}", "8").replace("{{max}}", "8"), "error");
                  return;
                }
                const env = (item as McpMarketplaceItem & { _env?: Record<string, string> })._env;
                void installMarketplaceItem(
                  state.client,
                  item,
                  env,
                  {
                    currentItems: () => state.mcpMarketplace.items,
                    onStateChange: (patch) => {
                      state.mcpMarketplace = { ...state.mcpMarketplace, ...patch };
                      if (patch.items?.some((i) => i.serverId === item.serverId && i.installStatus === "installed")) {
                        showMcpToast(state, `${item.friendlyName} ${t("extensions.toast.installed" as never)}`, "success");
                        void checkMcpUpdate(state.client, {
                          onStateChange: (lcPatch: Partial<McpLifecycleState>) => {
                            if (lcPatch.capabilities !== undefined) state.mcpCapabilities = lcPatch.capabilities;
                            if (lcPatch.processes !== undefined) state.mcpProcesses = lcPatch.processes;
                            if (lcPatch.updateNotice !== undefined) state.mcpUpdateNotice = lcPatch.updateNotice;
                          },
                        });
                      }
                      if (patch.items?.some((i) => i.serverId === item.serverId && i.installStatus === "error")) {
                        showMcpToast(state, `${item.friendlyName} ${t("extensions.toast.error" as never)}`, "error");
                      }
                    },
                  },
                );
              },
              onMcpUninstall: (serverId) => {
                void (async () => {
                  try {
                    await state.client?.request("mcp.servers.remove", { id: serverId });
                    const items = state.mcpMarketplace.items.map((i) =>
                      i.serverId === serverId ? { ...i, installStatus: "not_installed" as const } : i,
                    );
                    state.mcpMarketplace = { ...state.mcpMarketplace, items };
                    const name = state.mcpMarketplace.items.find((i) => i.serverId === serverId)?.friendlyName ?? serverId;
                    showMcpToast(state, `${name} ${t("extensions.toast.uninstalled" as never)}`, "info");
                    void checkMcpUpdate(state.client, {
                      onStateChange: (lcPatch: Partial<McpLifecycleState>) => {
                        if (lcPatch.capabilities !== undefined) state.mcpCapabilities = lcPatch.capabilities;
                        if (lcPatch.processes !== undefined) state.mcpProcesses = lcPatch.processes;
                        if (lcPatch.updateNotice !== undefined) state.mcpUpdateNotice = lcPatch.updateNotice;
                      },
                    });
                  } catch (err) {
                    console.error("[mcp] uninstall failed:", serverId, err);
                    showMcpToast(state, `${t("extensions.toast.error" as never)}: ${serverId}`, "error");
                  }
                })();
              },
              onMcpOpenConfigWizard: (item) => {
                state.mcpMarketplace = { ...state.mcpMarketplace, configTarget: item };
              },
              onMcpCloseConfigWizard: () => {
                state.mcpMarketplace = { ...state.mcpMarketplace, configTarget: null };
              },
              mcpRunningCount: state.mcpProcesses.filter((p) => p.status === "running").length,
              // Batch API Key configuration (Skills page)
              onMcpOpenBatchConfig: () => {
                state.mcpMarketplace = { ...state.mcpMarketplace, showBatchConfig: true };
                state._mcpBatchConfigResult = null;
                void (async () => {
                  try {
                    state._mcpServerEnvStatus = await fetchServerEnvStatus(state.client);
                  } catch { /* ignore */ }
                })();
              },
              onMcpCloseBatchConfig: () => {
                state.mcpMarketplace = { ...state.mcpMarketplace, showBatchConfig: false };
                state._mcpBatchConfigResult = null;
              },
              onMcpSaveBatchConfig: (updates) => {
                state._mcpBatchConfigSaving = true;
                state._mcpBatchConfigResult = null;
                void (async () => {
                  try {
                    const { success, failed } = await batchUpdateMcpServerEnv(state.client, updates);
                    state._mcpBatchConfigResult = { success, failed };
                    if (success > 0) {
                      showMcpToast(state, `${success} ${t("extensions.batchConfig.saved" as never)}`, "success");
                      state._mcpServerEnvStatus = await fetchServerEnvStatus(state.client);
                      void checkMcpUpdate(state.client, {
                        onStateChange: (lcPatch: Partial<McpLifecycleState>) => {
                          if (lcPatch.capabilities !== undefined) state.mcpCapabilities = lcPatch.capabilities;
                          if (lcPatch.processes !== undefined) state.mcpProcesses = lcPatch.processes;
                        },
                      });
                    }
                    if (failed > 0) {
                      showMcpToast(state, `${failed} ${t("extensions.batchConfig.failed" as never)}`, "error");
                    }
                  } catch (err) {
                    console.error("[mcp] batch env update failed:", err);
                    showMcpToast(state, t("extensions.toast.error" as never), "error");
                  } finally {
                    state._mcpBatchConfigSaving = false;
                  }
                })();
              },
              mcpBatchConfigSaving: state._mcpBatchConfigSaving,
              mcpBatchConfigResult: state._mcpBatchConfigResult,
              mcpServerEnvStatus: state._mcpServerEnvStatus,
            })
          : nothing}

        ${state.tab === "extensions"
          ? renderExtensions({
              capabilities: state.mcpCapabilities,
              advancedOpen: state.mcpAdvancedOpen,
              onToggleAdvanced: () => { state.mcpAdvancedOpen = !state.mcpAdvancedOpen; },
              onConfigClick: (id) => {
                mcpConfigClick(id, state.setTab as (tab: string) => void, (section) => {
                  state.configActiveSection = section;
                });
              },
              onTrySay: (prompt) => {
                state.chatMessage = prompt;
                state.setTab("chat");
              },
              onRestart: (id) => {
                void restartMcpServer(state.client, id, {
                  onStateChange: (patch: Partial<McpLifecycleState>) => {
                    if (patch.capabilities !== undefined) state.mcpCapabilities = patch.capabilities;
                    if (patch.processes !== undefined) state.mcpProcesses = patch.processes;
                    if (patch.updateNotice !== undefined) state.mcpUpdateNotice = patch.updateNotice;
                  },
                });
              },
              onDisable: (id) => {
                void disableMcpServer(state.client, id, {
                  onStateChange: (patch: Partial<McpLifecycleState>) => {
                    if (patch.capabilities !== undefined) state.mcpCapabilities = patch.capabilities;
                    if (patch.processes !== undefined) state.mcpProcesses = patch.processes;
                    if (patch.updateNotice !== undefined) state.mcpUpdateNotice = patch.updateNotice;
                  },
                });
              },
              onEnable: (id) => {
                void enableMcpServer(state.client, id, {
                  onStateChange: (patch: Partial<McpLifecycleState>) => {
                    if (patch.capabilities !== undefined) state.mcpCapabilities = patch.capabilities;
                    if (patch.processes !== undefined) state.mcpProcesses = patch.processes;
                    if (patch.updateNotice !== undefined) state.mcpUpdateNotice = patch.updateNotice;
                  },
                });
              },
              onTest: (id, env) => {
                state.mcpTestingServerId = id;
                // Clear previous result for this server
                const results = { ...state.mcpTestResults };
                delete results[id];
                state.mcpTestResults = results;
                void (async () => {
                  try {
                    const result = await testMcpServer(state.client, id, env);
                    state.mcpTestResults = { ...state.mcpTestResults, [id]: result.ok ? "success" : "failed" };
                    if (result.ok) {
                      const toolInfo = result.toolCount ? ` (${result.toolCount} tools)` : "";
                      showMcpToast(state, `${id} — ${t("extensions.advanced.testSuccess" as never)}${toolInfo}`, "success");
                    } else {
                      const errorInfo = result.error ? `: ${result.error}` : "";
                      showMcpToast(state, `${id} — ${t("extensions.advanced.testFailed" as never)}${errorInfo}`, "error");
                    }
                    // Also refresh status after test
                    await checkMcpUpdate(state.client, {
                      onStateChange: (patch: Partial<McpLifecycleState>) => {
                        if (patch.capabilities !== undefined) state.mcpCapabilities = patch.capabilities;
                        if (patch.processes !== undefined) state.mcpProcesses = patch.processes;
                        if (patch.updateNotice !== undefined) state.mcpUpdateNotice = patch.updateNotice;
                      },
                    });
                  } catch {
                    state.mcpTestResults = { ...state.mcpTestResults, [id]: "failed" };
                    showMcpToast(state, `${id} — ${t("extensions.advanced.testFailed" as never)}`, "error");
                  } finally {
                    state.mcpTestingServerId = null;
                  }
                })();
              },
              testingServerId: state.mcpTestingServerId,
              testResults: state.mcpTestResults,
              onCheckUpdate: () => {
                void checkMcpUpdate(state.client, {
                  onStateChange: (patch: Partial<McpLifecycleState>) => {
                    if (patch.capabilities !== undefined) state.mcpCapabilities = patch.capabilities;
                    if (patch.processes !== undefined) state.mcpProcesses = patch.processes;
                    if (patch.updateNotice !== undefined) state.mcpUpdateNotice = patch.updateNotice;
                  },
                });
              },
              onViewUpdate: () => {
                state.mcpUpdateNotice = null;
              },
              processes: state.mcpProcesses,
              updateNotice: state.mcpUpdateNotice,
              // Marketplace props
              activeTab: state.mcpExtTab,
              onTabChange: (tab) => {
                state.mcpExtTab = tab;
                // Fix #5: Lazy-load marketplace data when switching to store tab
                if (tab === "store" && state.mcpMarketplace.items.length === 0 && !state.mcpMarketplace.loading) {
                  const mcpCallbacks: MarketplaceCallbacks = {
                    onStateChange: (patch) => {
                      state.mcpMarketplace = { ...state.mcpMarketplace, ...patch };
                    },
                  };
                  void loadMarketplaceItems(state.client, mcpCallbacks);
                  void loadMarketplaceRecommendations(state.client, mcpCallbacks);
                }
              },
              marketplace: state.mcpMarketplace,
              onSearchChange: (search) => {
                // Fix #8: Debounce search — update input immediately for responsive typing,
                // but the filterItems() in extensions-page already works on the reactive state,
                // so the 300ms debounce is applied via a pending timer for expensive re-filters.
                state.mcpMarketplace = { ...state.mcpMarketplace, search };
              },
              onCategoryChange: (category) => {
                state.mcpMarketplace = { ...state.mcpMarketplace, activeCategory: category };
              },
              onSortChange: (sort) => {
                state.mcpMarketplace = { ...state.mcpMarketplace, sort };
              },
              onOpenDetail: (item) => {
                state.mcpMarketplace = { ...state.mcpMarketplace, detailItem: item };
              },
              onCloseDetail: () => {
                state.mcpMarketplace = { ...state.mcpMarketplace, detailItem: null };
              },
              onInstall: (item) => {
                // Fix #6: Process limit guard (max 8 running)
                const runningCount = state.mcpProcesses.filter((p) => p.status === "running").length;
                if (runningCount >= 8) {
                  showMcpToast(state, t("extensions.store.limitReached").replace("{{count}}", "8").replace("{{max}}", "8"), "error");
                  return;
                }
                // Extract env from config wizard (attached as _env on the item)
                const env = (item as McpMarketplaceItem & { _env?: Record<string, string> })._env;
                // Fix #1: Wire to real RPC via installMarketplaceItem
                void installMarketplaceItem(
                  state.client,
                  item,
                  env,
                  {
                    currentItems: () => state.mcpMarketplace.items,
                    onStateChange: (patch) => {
                      state.mcpMarketplace = { ...state.mcpMarketplace, ...patch };
                      // Fix #7: After install completes, refresh "My Capabilities" tab + show toast
                      if (patch.items?.some((i) => i.serverId === item.serverId && i.installStatus === "installed")) {
                        showMcpToast(state, `${item.friendlyName} ${t("extensions.toast.installed" as never)}`, "success");
                        void checkMcpUpdate(state.client, {
                          onStateChange: (lcPatch: Partial<McpLifecycleState>) => {
                            if (lcPatch.capabilities !== undefined) state.mcpCapabilities = lcPatch.capabilities;
                            if (lcPatch.processes !== undefined) state.mcpProcesses = lcPatch.processes;
                            if (lcPatch.updateNotice !== undefined) state.mcpUpdateNotice = lcPatch.updateNotice;
                          },
                        });
                      }
                      // Show error toast on failure
                      if (patch.items?.some((i) => i.serverId === item.serverId && i.installStatus === "error")) {
                        showMcpToast(state, `${item.friendlyName} ${t("extensions.toast.error" as never)}`, "error");
                      }
                    },
                  },
                );
              },
              onUninstall: (serverId) => {
                // Capture name BEFORE optimistic update
                const itemName = state.mcpMarketplace.items.find((i) => i.serverId === serverId)?.friendlyName ?? serverId;

                void (async () => {
                  try {
                    await uninstallMarketplaceItem(
                      state.client,
                      serverId,
                      {
                        currentItems: () => state.mcpMarketplace.items,
                        onStateChange: (patch) => {
                          state.mcpMarketplace = { ...state.mcpMarketplace, ...patch };
                        },
                      },
                    );
                    showMcpToast(state, `${itemName} ${t("extensions.toast.uninstalled" as never)}`, "info");
                    // Refresh My Capabilities
                    void checkMcpUpdate(state.client, {
                      onStateChange: (lcPatch: Partial<McpLifecycleState>) => {
                        if (lcPatch.capabilities !== undefined) state.mcpCapabilities = lcPatch.capabilities;
                        if (lcPatch.processes !== undefined) state.mcpProcesses = lcPatch.processes;
                        if (lcPatch.updateNotice !== undefined) state.mcpUpdateNotice = lcPatch.updateNotice;
                      },
                    });
                  } catch (err) {
                    console.error("[mcp] uninstall failed:", serverId, err);
                    showMcpToast(state, `${itemName} ${t("extensions.toast.error" as never)}`, "error");
                  }
                })();
              },
              onUpdate: (serverId) => {
                const itemName = state.mcpMarketplace.items.find((i) => i.serverId === serverId)?.friendlyName ?? serverId;
                void (async () => {
                  try {
                    await updateMarketplaceItem(
                      state.client,
                      serverId,
                      {
                        currentItems: () => state.mcpMarketplace.items,
                        onStateChange: (patch) => {
                          state.mcpMarketplace = { ...state.mcpMarketplace, ...patch };
                        },
                      },
                    );
                    showMcpToast(state, `${itemName} ${t("extensions.toast.updated" as never)}`, "success");
                    void checkMcpUpdate(state.client, {
                      onStateChange: (lcPatch: Partial<McpLifecycleState>) => {
                        if (lcPatch.capabilities !== undefined) state.mcpCapabilities = lcPatch.capabilities;
                        if (lcPatch.processes !== undefined) state.mcpProcesses = lcPatch.processes;
                        if (lcPatch.updateNotice !== undefined) state.mcpUpdateNotice = lcPatch.updateNotice;
                      },
                    });
                  } catch (err) {
                    console.error("[mcp] update failed:", serverId, err);
                    showMcpToast(state, `${itemName} ${t("extensions.toast.error" as never)}`, "error");
                  }
                })();
              },
              onOpenConfigWizard: (item) => {
                state.mcpMarketplace = { ...state.mcpMarketplace, configTarget: item };
              },
              onCloseConfigWizard: () => {
                state.mcpMarketplace = { ...state.mcpMarketplace, configTarget: null };
              },
              onDismissFirstVisit: () => {
                localStorage.setItem("clawdbot.mcp.firstVisitSeen", "1");
                state.mcpMarketplace = { ...state.mcpMarketplace, showFirstVisit: false };
              },
              onDismissRecommendation: () => {
                state.mcpMarketplace = { ...state.mcpMarketplace, recommendations: [] };
              },
              runningCount: state.mcpProcesses.filter((p) => p.status === "running").length,
              toast: state.mcpMarketplace.toast,
              onManualAdd: (config) => {
                void (async () => {
                  try {
                    await state.client?.request("mcp.servers.add", {
                      id: config.id,
                      command: config.command,
                      args: config.args,
                      transport: config.transport,
                      env: config.env,
                      enabled: true,
                      autoStart: true,
                    });
                    showMcpToast(state, `${config.id} ${t("extensions.toast.installed" as never)}`, "success");
                    void checkMcpUpdate(state.client, {
                      onStateChange: (lcPatch: Partial<McpLifecycleState>) => {
                        if (lcPatch.capabilities !== undefined) state.mcpCapabilities = lcPatch.capabilities;
                        if (lcPatch.processes !== undefined) state.mcpProcesses = lcPatch.processes;
                        if (lcPatch.updateNotice !== undefined) state.mcpUpdateNotice = lcPatch.updateNotice;
                      },
                    });
                  } catch (err) {
                    console.error("[mcp] manual add failed:", config.id, err);
                    showMcpToast(state, `${t("extensions.toast.error" as never)}: ${config.id}`, "error");
                  }
                })();
              },
              manualFormTrigger: state.mcpManualFormTrigger,
              onRetrySync: () => {
                const mcpCallbacks: MarketplaceCallbacks = {
                  onStateChange: (patch) => {
                    state.mcpMarketplace = { ...state.mcpMarketplace, ...patch };
                  },
                };
                state.mcpMarketplace = { ...state.mcpMarketplace, loading: true, error: null };
                void loadMarketplaceItems(state.client, mcpCallbacks);
                void loadMarketplaceRecommendations(state.client, mcpCallbacks);
              },
              // Batch API Key configuration
              onOpenBatchConfig: () => {
                state.mcpMarketplace = { ...state.mcpMarketplace, showBatchConfig: true };
                state._mcpBatchConfigResult = null;
                void (async () => {
                  try {
                    state._mcpServerEnvStatus = await fetchServerEnvStatus(state.client);
                  } catch { /* ignore */ }
                })();
              },
              onCloseBatchConfig: () => {
                state.mcpMarketplace = { ...state.mcpMarketplace, showBatchConfig: false };
                state._mcpBatchConfigResult = null;
              },
              onSaveBatchConfig: (updates) => {
                state._mcpBatchConfigSaving = true;
                state._mcpBatchConfigResult = null;
                void (async () => {
                  try {
                    const { success, failed } = await batchUpdateMcpServerEnv(state.client, updates);
                    state._mcpBatchConfigResult = { success, failed };
                    if (success > 0) {
                      showMcpToast(state, `${success} ${t("extensions.batchConfig.saved" as never)}`, "success");
                      // Refresh env status + capabilities
                      state._mcpServerEnvStatus = await fetchServerEnvStatus(state.client);
                      void checkMcpUpdate(state.client, {
                        onStateChange: (lcPatch: Partial<McpLifecycleState>) => {
                          if (lcPatch.capabilities !== undefined) state.mcpCapabilities = lcPatch.capabilities;
                          if (lcPatch.processes !== undefined) state.mcpProcesses = lcPatch.processes;
                        },
                      });
                    }
                    if (failed > 0) {
                      showMcpToast(state, `${failed} ${t("extensions.batchConfig.failed" as never)}`, "error");
                    }
                  } catch (err) {
                    console.error("[mcp] batch env update failed:", err);
                    showMcpToast(state, t("extensions.toast.error" as never), "error");
                  } finally {
                    state._mcpBatchConfigSaving = false;
                  }
                })();
              },
              batchConfigSaving: state._mcpBatchConfigSaving,
              batchConfigResult: state._mcpBatchConfigResult,
              serverEnvStatus: state._mcpServerEnvStatus,
            })
          : nothing}

        ${state.tab === "nodes"
          ? renderNodes({
              loading: state.nodesLoading,
              nodes: state.nodes,
              devicesLoading: state.devicesLoading,
              devicesError: state.devicesError,
              devicesList: state.devicesList,
              configForm: state.configForm ?? (state.configSnapshot?.config as Record<string, unknown> | null),
              configLoading: state.configLoading,
              configSaving: state.configSaving,
              configDirty: state.configFormDirty,
              configFormMode: state.configFormMode,
              execApprovalsLoading: state.execApprovalsLoading,
              execApprovalsSaving: state.execApprovalsSaving,
              execApprovalsDirty: state.execApprovalsDirty,
              execApprovalsSnapshot: state.execApprovalsSnapshot,
              execApprovalsForm: state.execApprovalsForm,
              execApprovalsSelectedAgent: state.execApprovalsSelectedAgent,
              execApprovalsTarget: state.execApprovalsTarget,
              execApprovalsTargetNodeId: state.execApprovalsTargetNodeId,
              onRefresh: () => loadNodes(state),
              onDevicesRefresh: () => loadDevices(state),
              onDeviceApprove: (requestId) => approveDevicePairing(state, requestId),
              onDeviceReject: (requestId) => rejectDevicePairing(state, requestId),
              onDeviceRotate: (deviceId, role, scopes) =>
                rotateDeviceToken(state, { deviceId, role, scopes }),
              onDeviceRevoke: (deviceId, role) =>
                revokeDeviceToken(state, { deviceId, role }),
              onLoadConfig: () => loadConfig(state),
              onLoadExecApprovals: () => {
                const target =
                  state.execApprovalsTarget === "node" && state.execApprovalsTargetNodeId
                    ? { kind: "node" as const, nodeId: state.execApprovalsTargetNodeId }
                    : { kind: "gateway" as const };
                return loadExecApprovals(state, target);
              },
              onBindDefault: (nodeId) => {
                if (nodeId) {
                  updateConfigFormValue(state, ["tools", "exec", "node"], nodeId);
                } else {
                  removeConfigFormValue(state, ["tools", "exec", "node"]);
                }
              },
              onBindAgent: (agentIndex, nodeId) => {
                const basePath = ["agents", "list", agentIndex, "tools", "exec", "node"];
                if (nodeId) {
                  updateConfigFormValue(state, basePath, nodeId);
                } else {
                  removeConfigFormValue(state, basePath);
                }
              },
              onSaveBindings: () => saveConfig(state),
              onExecApprovalsTargetChange: (kind, nodeId) => {
                state.execApprovalsTarget = kind;
                state.execApprovalsTargetNodeId = nodeId;
                state.execApprovalsSnapshot = null;
                state.execApprovalsForm = null;
                state.execApprovalsDirty = false;
                state.execApprovalsSelectedAgent = null;
              },
              onExecApprovalsSelectAgent: (agentId) => {
                state.execApprovalsSelectedAgent = agentId;
              },
              onExecApprovalsPatch: (path, value) =>
                updateExecApprovalsFormValue(state, path, value),
              onExecApprovalsRemove: (path) =>
                removeExecApprovalsFormValue(state, path),
              onSaveExecApprovals: () => {
                const target =
                  state.execApprovalsTarget === "node" && state.execApprovalsTargetNodeId
                    ? { kind: "node" as const, nodeId: state.execApprovalsTargetNodeId }
                    : { kind: "gateway" as const };
                return saveExecApprovals(state, target);
              },
            })
          : nothing}

        ${state.tab === "chat" && state.skillsBatch.batchPhase === "banner" && state.skillsBatch.batchCheckResult
          ? renderSkillsBatchBanner({
              missingSkills: state.skillsBatch.batchCheckResult.missing,
              totalSizeBytes: state.skillsBatch.batchCheckResult.total_size_bytes,
              estimatedSeconds: state.skillsBatch.batchCheckResult.estimated_seconds,
              onInstall: () => { state.skillsBatch.batchPhase = "confirm"; state.skillsBatch = { ...state.skillsBatch }; },
              onDismiss: () => { void dismissBanner(Object.assign(state.skillsBatch, { client: state.client })); state.skillsBatch = { ...state.skillsBatch }; },
              onClose: () => { void dismissBanner(Object.assign(state.skillsBatch, { client: state.client })); state.skillsBatch = { ...state.skillsBatch }; },
            })
          : nothing}
        ${state.tab === "chat"
          ? renderChat({
              sessionKey: state.sessionKey,
              onSessionKeyChange: (next) => {
                state.sessionKey = next;
                state.chatMessage = "";
                state.chatAttachments = [];
                state.chatStream = null;
                state.chatStreamStartedAt = null;
                state.chatRunId = null;
                state.chatQueue = [];
                state.resetToolStream();
                state.resetChatScroll();
                state.applySettings({
                  ...state.settings,
                  sessionKey: next,
                  lastActiveSessionKey: next,
                });
                void state.loadAssistantIdentity();
                void loadChatHistory(state);
                void refreshChatAvatar(state);
              },
              thinkingLevel: state.chatThinkingLevel,
              showThinking,
              loading: state.chatLoading,
              sending: state.chatSending,
              compactionStatus: state.compactionStatus,
              assistantAvatarUrl: chatAvatarUrl,
              messages: state.chatMessages,
              toolMessages: state.chatToolMessages,
              stream: state.chatStream,
              justCompleted: state.chatStreamJustCompleted,
              streamStartedAt: state.chatStreamStartedAt,
              draft: state.chatMessage,
              queue: state.chatQueue,
              connected: state.connected,
              canSend: state.connected,
              disabledReason: chatDisabledReason,
              error: state.lastError,
              sessions: state.sessionsResult,
              focusMode: chatFocus,
              onRefresh: () => {
                state.resetToolStream();
                return Promise.all([loadChatHistory(state), refreshChatAvatar(state)]);
              },
              onToggleFocusMode: () => {
                if (state.onboarding) return;
                state.applySettings({
                  ...state.settings,
                  chatFocusMode: !state.settings.chatFocusMode,
                });
              },
              onChatScroll: (event) => state.handleChatScroll(event),
              onDraftChange: (next) => (state.chatMessage = next),
              attachments: state.chatAttachments,
              onAttachmentsChange: (next) => (state.chatAttachments = next),
              onSend: () => state.handleSendChat(),
              canAbort: Boolean(state.chatRunId),
              onAbort: () => void state.handleAbortChat(),
              onQueueRemove: (id) => state.removeQueuedMessage(id),
              onNewSession: () =>
                state.handleSendChat("/new", { restoreDraft: true }),
              // Sidebar props for tool output viewing
              sidebarOpen: state.sidebarOpen,
              sidebarContent: state.sidebarContent,
              sidebarError: state.sidebarError,
              splitRatio: state.splitRatio,
              onOpenSidebar: (content: string) => state.handleOpenSidebar(content),
              onCloseSidebar: () => state.handleCloseSidebar(),
              onSplitRatioChange: (ratio: number) => state.handleSplitRatioChange(ratio),
              assistantName: state.assistantName,
              assistantAvatar: state.assistantAvatar,
              // Discovery props (首次使用发现)
              showDiscovery: shouldShowDiscovery(
                state.discoveryState,
                state.chatMessages.length > 0 || state.chatStream !== null || state.chatLoading,
                state.connected,
              ),
              discoveryProps: buildDiscoveryProps({
                state: state.discoveryState,
                onSuggestionClick: (prompt) => {
                  handleDiscoverySuggestionClick(
                    prompt,
                    {
                      onStateChange: (patch) => {
                        state.discoveryState = { ...state.discoveryState, ...patch };
                      },
                    },
                    (draft) => (state.chatMessage = draft),
                  );
                },
                onSkip: () => {
                  handleDiscoverySkip({
                    onStateChange: (patch) => {
                      state.discoveryState = { ...state.discoveryState, ...patch };
                    },
                  });
                },
                onRetry: () => {
                  void runCapabilityDetection(state.client, {
                    onStateChange: (patch) => {
                      state.discoveryState = { ...state.discoveryState, ...patch };
                    },
                  });
                },
              }),
              // License activation banner
              needsActivation: !state.licenseState?.valid && !state.licenseState?.license,
              onActivate: () => {
                state.showLicenseDialog = "activation";
              },
              // License state for support/purchase UI
              licenseState: state.licenseState,
              onInlineActivate: async (key: string) => {
                if (!state.client) return false;
                state.licenseActivating = true;
                state.licenseActivationError = null;
                try {
                  const result = await state.client.request("license.activate", { key });
                  if (result && typeof result === "object") {
                    const data = result as Record<string, unknown>;
                    if (data.valid) {
                      state.licenseState = {
                        ...state.licenseState,
                        valid: true,
                        error: null,
                        errorCode: null,
                        license: data.license as typeof state.licenseState.license,
                        device: data.device as typeof state.licenseState.device,
                      };
                      state.licenseActivating = false;
                      // 激活成功后显示升级成功提示
                      state.showLicenseDialog = "notification";
                      return true;
                    }
                  }
                  state.licenseActivating = false;
                  state.licenseActivationError = "激活码无效，请检查后重试";
                  return false;
                } catch {
                  state.licenseActivating = false;
                  state.licenseActivationError = "激活失败，请稍后重试";
                  return false;
                }
              },
              // Voice mascot (语音吉祥物)
              voiceMascot: state.voiceAsrAvailable === true && !state.voiceMascotDismissed ? {
                visible: true,
                recordingState: state.voiceRecordingState,
                error: state.voiceError,
                onStartRecording: () => state.handleVoiceStartRecording(),
                onStopRecording: () => state.handleVoiceStopRecording(),
                onDismiss: () => state.handleVoiceMascotDismiss(),
              } : null,
            })
          : nothing}

        ${state.tab === "config"
          ? renderConfig({
              raw: state.configRaw,
              originalRaw: state.configRawOriginal,
              valid: state.configValid,
              issues: state.configIssues,
              loading: state.configLoading,
              saving: state.configSaving,
              applying: state.configApplying,
              updating: state.updateRunning,
              connected: state.connected,
              schema: state.configSchema,
              schemaLoading: state.configSchemaLoading,
              uiHints: state.configUiHints,
              formMode: state.configFormMode,
              formValue: state.configForm,
              originalValue: state.configFormOriginal,
              searchQuery: state.configSearchQuery,
              activeSection: state.configActiveSection,
              activeSubsection: state.configActiveSubsection,
              onRawChange: (next) => {
                state.configRaw = next;
              },
              onFormModeChange: (mode) => (state.configFormMode = mode),
              onFormPatch: (path, value) => updateConfigFormValue(state, path, value),
              onSearchChange: (query) => (state.configSearchQuery = query),
              onSectionChange: (section) => {
                state.configActiveSection = section;
                state.configActiveSubsection = null;
              },
              onSubsectionChange: (section) => (state.configActiveSubsection = section),
              onReload: () => loadConfig(state),
              onSave: () => saveConfig(state),
              onApply: () => applyConfig(state),
              onUpdate: () => runUpdate(state),
            })
          : nothing}

        ${state.tab === "debug"
          ? renderDebug({
              loading: state.debugLoading,
              status: state.debugStatus,
              health: state.debugHealth,
              models: state.debugModels,
              heartbeat: state.debugHeartbeat,
              eventLog: state.eventLog,
              callMethod: state.debugCallMethod,
              callParams: state.debugCallParams,
              callResult: state.debugCallResult,
              callError: state.debugCallError,
              onCallMethodChange: (next) => (state.debugCallMethod = next),
              onCallParamsChange: (next) => (state.debugCallParams = next),
              onRefresh: () => loadDebug(state),
              onCall: () => callDebugMethod(state),
            })
          : nothing}

        ${state.tab === "logs"
          ? renderLogs({
              loading: state.logsLoading,
              error: state.logsError,
              file: state.logsFile,
              entries: state.logsEntries,
              filterText: state.logsFilterText,
              levelFilters: state.logsLevelFilters,
              autoFollow: state.logsAutoFollow,
              truncated: state.logsTruncated,
              onFilterTextChange: (next) => (state.logsFilterText = next),
              onLevelToggle: (level, enabled) => {
                state.logsLevelFilters = { ...state.logsLevelFilters, [level]: enabled };
              },
              onToggleAutoFollow: (next) => (state.logsAutoFollow = next),
              onRefresh: () => loadLogs(state, { reset: true }),
              onExport: (lines, label) => state.exportLogs(lines, label),
              onScroll: (event) => state.handleLogsScroll(event),
            })
          : nothing}

        ${state.tab === "docs"
          ? renderDocs({
              state: state.docsViewState,
              onSearchQueryChange: (query) => {
                state.docsViewState = handleDocsSearch(state.docsViewState, query);
              },
              onDocSelect: (docId) => {
                state.docsViewState = handleDocSelect(state.docsViewState, docId);
              },
              onBack: () => {
                state.docsViewState = handleDocsBack(state.docsViewState);
              },
              onToggleFavorite: (docId) => {
                handleToggleFavorite(docId);
                // Force re-render
                state.docsViewState = { ...state.docsViewState };
              },
              onOpenSearchModal: () => {
                state.docsViewState = { ...state.docsViewState, showSearchModal: true };
              },
              onCloseSearchModal: () => {
                state.docsViewState = { ...state.docsViewState, showSearchModal: false };
              },
            })
          : nothing}

        ${state.tab === "model-config"
          ? html`<model-config-view .client=${state.client} .connected=${state.connected}></model-config-view>`
          : nothing}
      </main>
      ${renderExecApprovalPrompt(state)}
      ${renderGatewayUrlConfirmation(state)}
      ${renderSkillInstallApproval(state)}
      ${renderSkillInstallProgress(state)}
      ${renderLicenseDialogs(state)}
      ${renderFeedbackModal(buildFeedbackProps(state))}
      ${renderSkillsBatchOverlays(state)}
      ${state.showAdaptationNotice
          && state.tab === "chat"
          && !state.showLicenseDialog
          && !state.showOfflineBanner
          && !shouldShowDiscovery(
               state.discoveryState,
               state.chatMessages.length > 0 || state.chatStream !== null || state.chatLoading,
               state.connected,
             )
        ? html`
          <div class="adaptation-notice-overlay" @click=${() => state.dismissAdaptationNotice()}>
            <div class="adaptation-notice" @click=${(e: Event) => e.stopPropagation()}>
              <button class="adaptation-notice__close" @click=${() => state.dismissAdaptationNotice()} title="关闭">✕</button>
              <div class="adaptation-notice__icon">🚀</div>
              <div class="adaptation-notice__title">正在变得更好</div>
              <div class="adaptation-notice__body">
                <p>Windows 版本正在快速迭代中，每一天都在向更完善的体验靠近。</p>
                <p>我们正在全力拓展更多场景 —— <strong>电商客服、个人助理、资料收集、智能问答</strong>……更多能力持续上线中！</p>
                <p>感谢你的陪伴，一起见证 Clawdbot 的成长 ✨</p>
              </div>
              <button class="adaptation-notice__cta" @click=${() => state.dismissAdaptationNotice()}>好的，继续探索 →</button>
            </div>
          </div>
        `
        : nothing}
    </div>
  `;
}

/**
 * 构建反馈组件 props
 */
function buildFeedbackProps(state: AppViewState): FeedbackViewProps {
  return {
    state: state.feedbackState,
    onOpenModal: state.handleFeedbackOpen,
    onCloseModal: state.handleFeedbackClose,
    onTypeChange: (type) => {
      state.feedbackState = { ...state.feedbackState, type };
    },
    onContentChange: (content) => {
      state.feedbackState = { ...state.feedbackState, content };
    },
    onContactChange: (contact) => {
      state.feedbackState = { ...state.feedbackState, contact };
    },
    onAddAttachment: (attachment) => {
      state.feedbackState = {
        ...state.feedbackState,
        attachments: [...state.feedbackState.attachments, attachment],
      };
    },
    onRemoveAttachment: (id) => {
      state.feedbackState = {
        ...state.feedbackState,
        attachments: state.feedbackState.attachments.filter((a) => a.id !== id),
      };
    },
    onSubmit: state.handleFeedbackSubmit,
    onReset: () => {
      state.feedbackState = {
        ...state.feedbackState,
        type: "suggestion",
        content: "",
        contact: "",
        attachments: [],
        submitting: false,
        submitted: false,
        error: null,
      };
    },
  };
}

/**
 * 渲染 License 相关弹窗
 */
function renderLicenseDialogs(state: AppViewState) {
  // 离线模式横幅
  if (state.licenseState?.offlineMode && state.showOfflineBanner) {
    const remainingHours = state.licenseState.lastVerifiedAt
      ? Math.max(0, 72 - (Date.now() - state.licenseState.lastVerifiedAt) / (1000 * 60 * 60))
      : 0;
    return renderOfflineBanner(remainingHours, () => {
      state.showOfflineBanner = false;
    });
  }

  // 根据弹窗类型渲染对应弹窗
  const dialogType = state.showLicenseDialog;
  if (!dialogType) return nothing;

  switch (dialogType) {
    case "activation":
      return renderActivationDialog(
        async (key) => {
          state.licenseActivating = true;
          state.licenseActivationError = null;
          try {
            const result = await state.client?.request("license.activate", { key });
            if (result && typeof result === "object") {
              const data = result as Record<string, unknown>;
              if (data.valid) {
                state.showLicenseDialog = null;
                state.licenseState = {
                  ...state.licenseState,
                  valid: true,
                  errorCode: null,
                  deviceSwitchInfo: null,
                  deviceSwitchCooldown: null,
                  license: data.license as typeof state.licenseState.license,
                  device: data.device as typeof state.licenseState.device,
                };
              } else {
                const errorCode = (data.errorCode as number | null) ?? null;
                const device = data.device as Record<string, unknown> | null;
                
                // 处理单设备模式错误码
                if (errorCode === 1010 && device?.existingDeviceName) {
                  // 切换到设备切换确认弹窗
                  state.licenseState = {
                    ...state.licenseState,
                    valid: false,
                    errorCode,
                    deviceSwitchInfo: {
                      existingDeviceId: (device.existingDeviceId as string) ?? "",
                      existingDeviceName: (device.existingDeviceName as string) ?? "未知设备",
                      existingOsInfo: device.existingOsInfo as string | undefined,
                      deviceLimit: device.deviceLimit as number | undefined,
                      boundDevices: device.boundDevices as number | undefined,
                    },
                    deviceSwitchCooldown: null,
                  };
                  state.showLicenseDialog = "device-switch";
                  return;
                }
                
                if (errorCode === 1011 && device?.cooldownRemainingHours !== undefined) {
                  // 切换到冷却期弹窗
                  state.licenseState = {
                    ...state.licenseState,
                    valid: false,
                    errorCode,
                    deviceSwitchInfo: null,
                    deviceSwitchCooldown: {
                      cooldownRemainingHours: (device.cooldownRemainingHours as number) ?? 24,
                      cooldownEndsAt: (device.cooldownEndsAt as string) ?? "",
                    },
                  };
                  state.showLicenseDialog = "device-switch-cooldown";
                  return;
                }
                
                // 其他错误：显示错误消息
                state.licenseActivationError = (data.errorMessage as string) || "激活失败";
              }
            }
          } catch (err) {
            state.licenseActivationError = `激活失败: ${err}`;
          } finally {
            state.licenseActivating = false;
          }
        },
        () => {
          state.showLicenseDialog = null;
        },
        state.licenseActivationError,
        state.licenseActivating,
      );

    case "expired":
      return renderExpiredDialog(
        state.licenseState?.renewalReminder?.renewUrl || state.licenseState?.license?.purchaseUrl || null,
        Math.abs(state.licenseState?.renewalReminder?.daysRemaining || 0),
        () => {
          state.showLicenseDialog = null;
        },
        () => {
          state.showLicenseDialog = null;
        },
      );

    case "renewal":
      if (state.licenseState?.renewalReminder) {
        return renderRenewalReminderDialog(
          state.licenseState.renewalReminder,
          () => {
            // 点击"立即续费"
            state.showLicenseDialog = null;
          },
          () => {
            // 点击"稍后提醒"- 根据紧急程度设置不同的延迟时间
            handleRenewalReminderDismiss(state);
          },
        );
      }
      return nothing;

    case "notification":
      const notification = state.licenseState?.pendingNotifications?.[0];
      if (notification) {
        return renderNotificationDialog(
          notification,
          async () => {
            // 确认通知
            await state.client?.request("license.notification.ack", {
              notificationId: notification.id,
              action: "clicked",
            });
            // 移除已处理的通知
            state.licenseState = {
              ...state.licenseState,
              pendingNotifications: state.licenseState.pendingNotifications.slice(1),
            };
            // 如果还有通知，继续显示；否则关闭
            if (state.licenseState.pendingNotifications.length === 0) {
              state.showLicenseDialog = null;
            }
          },
          async () => {
            await state.client?.request("license.notification.ack", {
              notificationId: notification.id,
              action: "dismissed",
            });
            state.licenseState = {
              ...state.licenseState,
              pendingNotifications: state.licenseState.pendingNotifications.slice(1),
            };
            if (state.licenseState.pendingNotifications.length === 0) {
              state.showLicenseDialog = null;
            }
          },
        );
      }
      return nothing;

    case "force-update":
      if (state.licenseState?.forceUpdate) {
        return renderForceUpdateDialog(
          state.licenseState.forceUpdate,
          "1.0.0", // TODO: 从配置获取当前版本
          () => {
            if (!state.licenseState.forceUpdate?.blocking) {
              state.showLicenseDialog = null;
            }
          },
        );
      }
      return nothing;

    case "device-limit":
      return renderDeviceLimitDialog(
        state.licenseBoundDevices,
        state.licenseState?.device?.deviceLimit || 2,
        async (deviceId) => {
          const result = await state.client?.request("license.unbind", { deviceId });
          if (result && typeof result === "object") {
            const unbindResult = result as Record<string, unknown>;
            if (unbindResult.success) {
              // 刷新设备列表
              const devices = await state.client?.request("license.devices", {});
              if (devices && typeof devices === "object") {
                state.licenseBoundDevices = (devices as Record<string, unknown>).devices as typeof state.licenseBoundDevices || [];
              }
            } else {
              // 显示解绑错误（如冷却中）
              const errorMsg = unbindResult.error as string || "解绑失败，请稍后重试";
              window.alert(errorMsg);
            }
          }
        },
        () => {
          state.showLicenseDialog = null;
        },
        false,
      );

    case "device-switch":
      // 单设备模式：确认设备切换（errorCode=1010）
      if (state.licenseState?.deviceSwitchInfo) {
        return renderDeviceSwitchDialog(
          state.licenseState.deviceSwitchInfo,
          async () => {
            // 确认切换
            state.licenseActivating = true;
            try {
              const result = await state.client?.request("license.switch", {});
              if (result && typeof result === "object") {
                const switchResult = result as Record<string, unknown>;
                if (switchResult.valid) {
                  // 切换成功
                  state.showLicenseDialog = null;
                  state.licenseState = {
                    ...state.licenseState,
                    valid: true,
                    error: null,
                    errorCode: null,
                    license: switchResult.license as typeof state.licenseState.license,
                    device: switchResult.device as typeof state.licenseState.device,
                    deviceSwitchInfo: null,
                    deviceSwitchCooldown: null,
                  };
                } else {
                  // 切换失败（可能进入冷却期）
                  if (switchResult.errorCode === 1011) {
                    state.licenseState = {
                      ...state.licenseState,
                      errorCode: 1011,
                      deviceSwitchCooldown: {
                        cooldownRemainingHours: switchResult.cooldownRemainingHours as number,
                        cooldownEndsAt: switchResult.cooldownEndsAt as string,
                      },
                    };
                    state.showLicenseDialog = "device-switch-cooldown";
                  } else {
                    const errorMsg = (switchResult.error as string) || "设备切换失败";
                    window.alert(errorMsg);
                  }
                }
              }
            } catch (err) {
              window.alert(`设备切换失败: ${err}`);
            } finally {
              state.licenseActivating = false;
            }
          },
          () => {
            // 取消切换
            state.showLicenseDialog = null;
          },
          state.licenseActivating,
        );
      }
      return nothing;

    case "device-switch-cooldown":
      // 单设备模式：冷却期提示（errorCode=1011）
      if (state.licenseState?.deviceSwitchCooldown) {
        return renderDeviceSwitchCooldownDialog(
          state.licenseState.deviceSwitchCooldown,
          () => {
            state.showLicenseDialog = null;
          },
        );
      }
      return nothing;

    default:
      return nothing;
  }
}

/**
 * 渲染技能批量安装相关浮层 (confirm / progress / result / complete)
 */
function renderSkillsBatchOverlays(state: AppViewState) {
  const batch = state.skillsBatch;
  const phase = batch.batchPhase;
  const minimized = batch.batchMinimized;

  const withClient = () => Object.assign(batch, { client: state.client });
  const sync = () => { state.skillsBatch = { ...batch }; };

  const onMinimize = () => { batch.batchMinimized = true; sync(); };
  const onExpand = () => { batch.batchMinimized = false; sync(); };
  const onPillDismiss = () => { batch.batchPhase = "idle"; batch.batchMinimized = false; sync(); };

  // Confirm — never minimizable
  if (phase === "confirm" && batch.batchCheckResult) {
    return renderSkillsBatchConfirm({
      checkResult: batch.batchCheckResult,
      onConfirm: (selectedSkills) => { void startBatchInstall(withClient(), selectedSkills); sync(); },
      onCancel: () => { batch.batchPhase = "idle"; sync(); },
    });
  }

  // Minimized pill for downloading / result / complete
  if (minimized && (phase === "downloading" || phase === "result" || phase === "complete")) {
    return html`
      <div style="position:fixed;bottom:24px;left:24px;z-index:8500;">
        ${renderSkillsBatchPill({
          phase, progress: batch.batchProgress, skills: batch.batchSkills,
          result: batch.batchResult, onExpand, onDismiss: onPillDismiss,
        })}
      </div>
      <style>
        @keyframes batchPillIn { from { opacity:0;transform:translateY(20px) scale(0.8); } to { opacity:1;transform:translateY(0) scale(1); } }
        .batch-pill:hover { transform:scale(1.04); }
        .batch-pill:active { transform:scale(0.97); }
      </style>
    `;
  }

  // Full modals (not minimized)
  if (phase === "downloading") {
    return renderSkillsBatchProgress({
      batchState: batch,
      onCancel: () => { void cancelBatchInstall(withClient()); batch.batchPhase = "idle"; batch.batchId = null; sync(); },
      onMinimize,
    });
  }

  if (phase === "result" && batch.batchResult) {
    return renderSkillsBatchResult({
      succeeded: batch.batchResult.succeeded,
      failed: batch.batchResult.failed,
      durationMs: batch.batchResult.durationMs,
      totalCount: batch.batchResult.succeeded.length + batch.batchResult.failed.length,
      onContinue: () => { batch.batchPhase = "idle"; sync(); },
      onRetryFailed: () => {
        const failedNames = batch.batchResult!.failed.map((f) => f.name);
        void startBatchInstall(withClient(), failedNames);
        sync();
      },
      onReport: () => { void reportBatchFailures(withClient()); sync(); },
      reportSent: batch.reportSent,
    });
  }

  if (phase === "complete" && batch.batchResult) {
    return renderSkillsBatchComplete({
      batchState: batch,
      onStartChat: () => { batch.batchPhase = "idle"; sync(); state.tab = "chat" as Tab; },
      onDismiss: () => { batch.batchPhase = "idle"; sync(); },
    });
  }

  return nothing;
}

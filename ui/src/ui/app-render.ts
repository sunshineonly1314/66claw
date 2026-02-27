import { html, nothing } from "lit";

import type { GatewayBrowserClient, GatewayHelloOk } from "./gateway";
import type { AppViewState, McpMarketplaceItem } from "./app-view-state";
import { generateUUID } from "./uuid";
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
import type { ChatAttachment, ChatQueueItem, CronFormState } from "./ui-types";
import { handleComposePaste } from "./chat/compose-card.js";
import { refreshChatAvatar } from "./app-chat";
import { renderChat } from "./views/chat";
import { renderConfig } from "./views/config";
import { renderChannels } from "./views/channels";
import { renderCron } from "./views/cron";
import { renderDebug } from "./views/debug";
import { renderInstances } from "./views/instances";
import { renderLogs } from "./views/logs";
import { renderLogReportModal } from "./views/log-report";
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
  renderOrchestratorEntry,
  renderOrchestrator,
} from "../../../extensions/orchestrator/src/ui/orchestrator-view";
import {
  openOrchestrator,
  closeOrchestrator,
  handleTemplateClick as orchTemplateClick,
  handleExampleClick as orchExampleClick,
  handleInput as orchInput,
  handleKeydown as orchKeydown,
  handleSend as orchSend,
  handleActionClick as orchActionClick,
  handleAnswerQuestion as orchAnswerQuestion,
  handleDeployProposal as orchDeployProposal,
} from "./controllers/orchestrator";
import { renderUpdateBanner } from "./views/update-banner";
import { renderUpdateDialog } from "./views/update-dialog";
import {
  renderConversationSidebar,
  renderSidebarToggle,
} from "./views/conversation-sidebar";
import { renderImageGallery } from "./chat/image-gallery";
import { MCP_MAX_RUNNING } from "./views/mcp-shared.js";
import {
  restartMcpServer,
  disableMcpServer,
  enableMcpServer,
  testMcpServer,
  checkMcpUpdate,
  initMcpCapabilities,
  handleConfigClick as mcpConfigClick,
  installMarketplaceItem,
  uninstallMarketplaceItem,
  updateMarketplaceItem,
  loadMarketplaceItems,
  loadMoreMarketplaceItems,
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
  installSkill,
  installRemoteSkill,
  loadSkills,
  refreshMarketSkills,
  saveSkillApiKey,
  searchMarketSkills,
  loadMoreMarketSkills,
  setActiveCategory,
  updateSkillEdit,
  updateSkillEnabled,
  promoteSkillToCore,
  demoteSkillFromCore,
  countCoreSkills,
  CORE_SKILLS_MAX,
  openSkillImport,
  closeSkillImport,
  browseSkillDir,
  importSkill,
  type SkillMessage,
} from "./controllers/skills";
import { loadAgentFileContent, loadAgentFiles, saveAgentFile } from "./controllers/agent-files";
import { loadAgentIdentities, loadAgentIdentity } from "./controllers/agent-identity";
import { loadAgentSkills } from "./controllers/agent-skills";
import { loadAgents, createAgent, deleteAgent, loadDmScopeStatus } from "./controllers/agents";
import {
  loadTeamProjects,
  selectProject,
  pauseProject,
  resumeProject,
  deleteProject,
  loadProjectStats,
  loadSharedMemory,
  clearSharedMemory,
  stopProjectHealthPoll,
} from "./controllers/team-projects";
import { loadNodes } from "./controllers/nodes";
import {
  loadNetworkStatus,
  discoverGateways,
  probeGateway,
  loadNetworkInterfaces,
  configureNetworkMode,
} from "./controllers/networking";
import { renderNetworkCenter } from "./views/network-center";
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

// Module-scoped set tracking which team projects are collapsed in sidebar
const _teamCollapsedProjects = new Set<string>();

const AVATAR_DATA_RE = /^data:/i;
const AVATAR_HTTP_RE = /^https?:\/\//i;
const MCP_TOAST_DURATION_MS = 4000;
const MCP_TOAST_ERROR_DURATION_MS = 12000;

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
 * - 无 license（断连）：使用 HTTP fallback 二维码仍然显示运维入口
 *
 * 交互：鼠标悬浮显示二维码，移走消失
 * 预加载：进入 chat 页面时已主动拉取，hover 时立即显示
 */
function renderTopbarSupportButtons(state: AppViewState) {
  const license = state.licenseState?.license;
  const isLoading = state.qrcodePreloading ?? false;

  // 无 license 时（断连 / gateway 未就绪），用 HTTP fallback 二维码显示运维支持入口
  if (!license) {
    const fallbackQr = state.fallbackQrcode;
    if (!fallbackQr) return nothing;
    return html`
      <div class="topbar-support topbar-support--test">
        <div class="topbar-support__btn topbar-support__btn--support">
          <span class="topbar-support__icon">💬</span>
          <span class="topbar-support__text">${t("support.getExclusiveSupport")}</span>
          ${renderQrcodePopover(fallbackQr, false, "support.scanForSupport")}
        </div>
      </div>
    `;
  }

  const isTestUser = license.keyType === "test" || license.keyType === "trial";
  const qrcode = license.supportQrcode;

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

/** Reset chat state and switch to a new session key. */
function switchSession(state: AppViewState, key: string) {
  state.sessionKey = key;
  state.chatMessage = "";
  state.chatAttachments = [];
  state.chatStream = null;
  state.chatStreamStartedAt = null;
  state.chatRunId = null;
  state.chatQueue = [];
  // Clear stale assets for the new session
  state.convSidebarAssets = [];
  state.convSidebarAssetsSessionKey = "";
  state.resetToolStream();
  state.resetChatScroll();
  state.applySettings({ ...state.settings, sessionKey: key, lastActiveSessionKey: key });
  void state.loadAssistantIdentity();
  void loadChatHistory(state);
  void refreshChatAvatar(state);
  void loadSidebarAssets(state);
}

/** Load assets (images/videos) for the conversation sidebar's "资源" tab. */
async function loadSidebarAssets(state: AppViewState) {
  if (!state.client || !state.connected || !state.sessionKey) return;
  if (state.convSidebarAssetsLoading) return;
  // Skip re-fetch if already loaded for this session
  if (state.convSidebarAssetsSessionKey === state.sessionKey) return;
  state.convSidebarAssetsLoading = true;
  state.requestUpdate();
  try {
    const res = (await state.client.request("media.list", {
      sessionKey: state.sessionKey,
    })) as { assets?: Array<{ id: string; type: "image" | "video"; url: string; name: string; size?: number; createdAt: number; sessionKey?: string }> } | undefined;
    state.convSidebarAssets = res?.assets ?? [];
    state.convSidebarAssetsSessionKey = state.sessionKey;
  } catch {
    state.convSidebarAssets = [];
  } finally {
    state.convSidebarAssetsLoading = false;
    state.requestUpdate();
  }
}

export function renderApp(state: AppViewState) {
  const presenceCount = state.presenceEntries.length;
  const sessionsCount = state.sessionsResult?.count ?? null;
  const cronNext = state.cronStatus?.nextWakeAtMs ?? null;
  // First startup (hello===null): suppress error/disconnect messages — show loading instead.
  // Only show disconnected message after a successful connection was later lost.
  const isFirstStartup = !state.connected && !state.hello;
  const chatDisabledReason = state.connected ? null
    : isFirstStartup ? null
    : t("connection.disconnectedFromGateway");
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
            <span class="statusDot ${state.connected ? "ok" : isFirstStartup ? "" : ""}"></span>
            <span>Health</span>
            <span class="mono">${state.connected ? "OK" : isFirstStartup ? "..." : "Offline"}</span>
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
        ${state.tab !== "usage" ? html`
        ${isChat ? nothing : html`
        <section class="content-header">
          <div>
            <div class="page-title">${titleForTab(state.tab)}</div>
            <div class="page-sub">${subtitleForTab(state.tab)}</div>
          </div>
          <div class="page-meta">
            ${state.lastError
              ? html`<div class="pill danger">${state.lastError}</div>`
              : nothing}
          </div>
        </section>
        `}
        ` : nothing}

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
              onSessionKeyChange: (next) => switchSession(state, next),
              onConnect: () => state.connect(),
              onRefresh: () => state.loadOverview(),
              onNavigateToUsage: () => state.setTab("usage" as Tab),
              onModelChange: (provider: string, model: string) => state.setModelPrimary(provider, model),
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
                dmScopeStatus: state.dmScopeStatus,
                onDmScopeApply: () => {
                  if (!state.dmScopeStatus?.recommended) return;
                  const recommended = state.dmScopeStatus.recommended;
                  void (async () => {
                    try {
                      updateConfigFormValue(state, ["session", "dmScope"], recommended);
                      await saveConfig(state);
                      void loadDmScopeStatus(state);
                    } catch { /* best-effort */ }
                  })();
                },
                agentCreating: state.agentCreating,
                agentCreateError: state.agentCreateError,
                agentDeleting: state.agentDeleting,
                agentDeleteError: state.agentDeleteError,
                addFormOpen: state.agentAddFormOpen,
                onToggleAddForm: (open: boolean) => { state.agentAddFormOpen = open; },
                onRefresh: async () => {
                  await loadAgents(state);
                  const agentIds = state.agentsList?.agents?.map((entry) => entry.id) ?? [];
                  if (agentIds.length > 0) void loadAgentIdentities(state, agentIds);
                  void loadDmScopeStatus(state);
                  void loadTeamProjects(state as any);
                },
                onSelectAgent: (agentId) => {
                  if (state.agentsSelectedId === agentId && !state.teamProjectSelectedId) return;
                  state.agentsSelectedId = agentId;
                  state.teamProjectSelectedId = null; // Switch to agent view
                  stopProjectHealthPoll();
                  state.agentDeleteError = null;
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
                onCreateAgent: async (id: string, name: string, workspace: string) => {
                  const result = await createAgent(state, { id, name, workspace });
                  if (result.ok) {
                    state.agentAddFormOpen = false;
                    const agentIds = state.agentsList?.agents?.map((entry) => entry.id) ?? [];
                    if (agentIds.length > 0) void loadAgentIdentities(state, agentIds);
                  }
                  return result.ok;
                },
                onDeleteAgent: async (agentId: string) => {
                  await deleteAgent(state, { agentId });
                  const agentIds = state.agentsList?.agents?.map((entry) => entry.id) ?? [];
                  if (agentIds.length > 0) void loadAgentIdentities(state, agentIds);
                },
                // Team Projects
                teamProjects: state.teamProjectsList,
                teamProjectSelectedId: state.teamProjectSelectedId,
                teamProjectDetail: state.teamProjectDetail,
                teamProjectDetailLoading: state.teamProjectDetailLoading,
                teamProjectHealth: state.teamProjectHealth,
                teamProjectStats: state.teamProjectStats,
                teamProjectMemory: state.teamProjectMemory,
                teamProjectTab: state.teamProjectTab,
                teamProjectBusy: state.teamProjectBusy,
                teamCollapsedProjects: _teamCollapsedProjects,
                onSelectProject: (projectId: string) => {
                  state.agentsSelectedId = null;
                  void selectProject(state as any, projectId);
                },
                onSelectProjectTab: (tab) => {
                  state.teamProjectTab = tab;
                  const pid = state.teamProjectSelectedId;
                  if (!pid) return;
                  if (tab === "stats" && !state.teamProjectStats) void loadProjectStats(state as any, pid);
                  if (tab === "memory" && !state.teamProjectMemory) void loadSharedMemory(state as any, pid);
                },
                onPauseProject: (projectId: string) => void pauseProject(state as any, projectId),
                onResumeProject: (projectId: string) => void resumeProject(state as any, projectId),
                onDeleteProject: (projectId: string) => void deleteProject(state as any, projectId),
                onLoadProjectStats: (projectId: string) => void loadProjectStats(state as any, projectId),
                onLoadProjectMemory: (projectId: string) => void loadSharedMemory(state as any, projectId),
                onClearProjectMemory: (projectId: string) => void clearSharedMemory(state as any, projectId),
                onToggleProjectCollapse: (projectId: string) => {
                  if (_teamCollapsedProjects.has(projectId)) _teamCollapsedProjects.delete(projectId);
                  else _teamCollapsedProjects.add(projectId);
                  state.requestUpdate();
                },
                // OpenClawCN: Orchestrator entry & view
                orchestratorEntryHtml: renderOrchestratorEntry(
                  () => void openOrchestrator(state as any),
                  t,
                ),
                orchestratorHtml: state.orchestratorOpen && state.orchestratorState
                  ? renderOrchestrator(state.orchestratorState, {
                      onClose: () => closeOrchestrator(state as any),
                      onSend: () => void orchSend(state as any),
                      onInput: (e: Event) => orchInput(state as any, e),
                      onKeydown: (e: KeyboardEvent) => orchKeydown(state as any, e),
                      onTemplateClick: (templateId: string) => void orchTemplateClick(state as any, templateId),
                      onExampleClick: (text: string) => orchExampleClick(state as any, text),
                      onActionClick: (action: string, data?: unknown) => orchActionClick(state as any, action, data),
                      onAnswerQuestion: (qi: number, answer: string) => orchAnswerQuestion(state as any, qi, answer),
                      onDeployProposal: (planId: string) => void orchDeployProposal(state as any, planId),
                    }, t)
                  : nothing,
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
              tierRenderKey: state.skillsTierRenderKey,
              onTierRenderBump: () => { state.skillsTierRenderKey++; },
              onFilterChange: (next) => { state.skillsFilter = next; },
              onRefresh: () => loadSkills(state, { clearMessages: true }),
              onToggle: (key, enabled) => updateSkillEnabled(state, key, enabled),
              onEdit: (key, value) => updateSkillEdit(state, key, value),
              onSaveKey: (key) => saveSkillApiKey(state, key),
              onInstall: (skillKey, name, installId) =>
                installSkill(state, skillKey, name, installId),
              // core skills drag-and-drop
              onPromoteToCore: (skillKey) => void promoteSkillToCore(state, skillKey),
              onDemoteFromCore: (skillKey) => void demoteSkillFromCore(state, skillKey),
              coreCount: countCoreSkills(state.skillsReport),
              coreMax: CORE_SKILLS_MAX,
              // marketplace props
              activeTab: state.skillsActiveTab === "market" ? "market" : "local",
              onTabChange: (tab) => {
                state.skillsActiveTab = tab === "market" ? "market" : "active";
                if (tab === "market" && !state.skillsMarketSearchResult) {
                  const cat = state.skillsActiveCategory;
                  void searchMarketSkills(state, {
                    category: cat === "all" ? undefined : cat,
                    page: 1,
                  });
                }
              },
              marketLoading: state.skillsMarketLoading,
              marketError: state.skillsMarketError,
              marketSearchResult: state.skillsMarketSearchResult ?? null,
              marketCategory: state.skillsActiveCategory,
              installProgress: state.skillsInstallProgress,
              onMarketSearch: (keyword) => {
                state.skillsFilter = keyword;
                state.skillsMarketPage = 1;
                void searchMarketSkills(state, { keyword: keyword || undefined, page: 1 });
              },
              onMarketCategoryChange: (category) => {
                setActiveCategory(state, category);
                void searchMarketSkills(state, {
                  category: category === "all" ? undefined : category,
                  page: 1,
                });
              },
              onMarketLoadMore: () => void loadMoreMarketSkills(state),
              hasMorePages: (state.skillsMarketSearchResult?.page ?? 0) < (state.skillsMarketSearchResult?.totalPages ?? 0),
              onMarketInstall: (skillName) => void installRemoteSkill(state, skillName),
              onMarketRefresh: () => {
                void refreshMarketSkills(state);
                void searchMarketSkills(state, { page: 1 });
              },
              // import modal
              importOpen: state.skillsImportOpen,
              importPath: state.skillsImportPath,
              importBrowseResult: state.skillsImportBrowseResult,
              importLoading: state.skillsImportLoading,
              importError: state.skillsImportError,
              importSuccess: state.skillsImportSuccess,
              onImportOpen: () => void openSkillImport(state),
              onImportClose: () => closeSkillImport(state),
              onImportBrowse: (path?: string) => void browseSkillDir(state, path),
              onImportPathChange: (path: string) => { state.skillsImportPath = path; },
              onImportExecute: (path: string, mode: "copy" | "reference") => void importSkill(state, path, mode),
            })
          : nothing}

        ${state.tab === "extensions"
          ? renderExtensions({
              capabilities: state.mcpCapabilities,
              advancedOpen: state.mcpAdvancedOpen,
              onToggleAdvanced: () => { state.mcpAdvancedOpen = !state.mcpAdvancedOpen; },
              onConfigClick: (id) => {
                const cap = state.mcpCapabilities.find((c) => c.id === id);
                if (cap?.configNeeded) {
                  // Has unconfigured env keys — open config wizard so the user
                  // can fill in API keys.  Build a synthetic marketplace item
                  // with just enough data for the wizard.
                  const firstKey = cap.configNeeded.split(",")[0]?.trim() ?? "API_KEY";
                  state.mcpMarketplace = {
                    ...state.mcpMarketplace,
                    configTarget: {
                      serverId: id,
                      friendlyName: cap.friendlyName,
                      friendlyNameEn: cap.friendlyName,
                      description: "",
                      descriptionEn: "",
                      category: "other",
                      tags: [],
                      version: "",
                      npmPackage: "",
                      securityScore: 0,
                      requiresApiKey: true,
                      apiKeyName: firstKey,
                      platforms: [],
                      isOfficial: false,
                      isNew: false,
                      toolCount: 0,
                      installStatus: "installed",
                    },
                  };
                  // Switch to extensions tab (stay on it) to show the wizard modal
                  return;
                }
                // No config needed — enable/restart the server directly.
                const name = cap?.friendlyName ?? id;
                showMcpToast(state, `${name} — ${t("extensions.advanced.restarting" as never)}`, "info");
                void enableMcpServer(state.client, id, {
                  onStateChange: (patch: Partial<McpLifecycleState>) => {
                    if (patch.capabilities !== undefined) state.mcpCapabilities = patch.capabilities;
                    if (patch.processes !== undefined) state.mcpProcesses = patch.processes;
                    if (patch.updateNotice !== undefined) state.mcpUpdateNotice = patch.updateNotice;
                  },
                }).then(() => {
                  const updated = state.mcpCapabilities.find((c) => c.id === id);
                  if (updated?.status === "ready") {
                    showMcpToast(state, `${name} — ${t("extensions.status.ready")}`, "success");
                  }
                });
              },
              onTrySay: (prompt) => {
                state.chatMessage = prompt;
                state.setTab("chat");
              },
              onRestart: (id) => {
                showMcpToast(state, `${id} — ${t("extensions.advanced.restarting" as never)}`, "info");
                void (async () => {
                  try {
                    await restartMcpServer(state.client, id, {
                      onStateChange: (patch: Partial<McpLifecycleState>) => {
                        if (patch.capabilities !== undefined) state.mcpCapabilities = patch.capabilities;
                        if (patch.processes !== undefined) state.mcpProcesses = patch.processes;
                        if (patch.updateNotice !== undefined) state.mcpUpdateNotice = patch.updateNotice;
                      },
                    });
                    // Check the resulting status
                    const proc = state.mcpProcesses.find((p) => p.id === id);
                    if (proc?.status === "running") {
                      showMcpToast(state, `${id} — ${t("extensions.advanced.restartSuccess" as never)}`, "success");
                    } else {
                      const errInfo = proc?.error ? `: ${proc.error}` : "";
                      showMcpToast(state, `${id} — ${t("extensions.advanced.restartFailed" as never)}${errInfo}`, "error");
                    }
                  } catch {
                    showMcpToast(state, `${id} — ${t("extensions.advanced.restartFailed" as never)}`, "error");
                  }
                })();
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
                // Update input immediately for responsive typing
                state.mcpMarketplace = { ...state.mcpMarketplace, search };
                // Debounce server-side search query (300ms)
                clearTimeout((state as any)._mcpSearchTimer);
                (state as any)._mcpSearchTimer = setTimeout(() => {
                  const cb: MarketplaceCallbacks = {
                    onStateChange: (patch) => {
                      state.mcpMarketplace = { ...state.mcpMarketplace, ...patch };
                    },
                  };
                  void loadMarketplaceItems(state.client, cb, {
                    search,
                    category: state.mcpMarketplace.activeCategory,
                  });
                }, 300);
              },
              onCategoryChange: (category) => {
                state.mcpMarketplace = { ...state.mcpMarketplace, activeCategory: category };
                // Trigger server-side filtered query immediately
                const cb: MarketplaceCallbacks = {
                  onStateChange: (patch) => {
                    state.mcpMarketplace = { ...state.mcpMarketplace, ...patch };
                  },
                };
                void loadMarketplaceItems(state.client, cb, {
                  search: state.mcpMarketplace.search,
                  category,
                });
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
                // Non-installable guard — items without npm/pypi/sse cannot be installed
                if (item.installable === false || item.installMethod === "none") {
                  showMcpToast(state, `${item.friendlyName} — ${t("extensions.store.notInstallable" as never) || "暂不支持一键安装"}`, "error");
                  return;
                }
                // Process limit guard
                const installedCount = state.mcpProcesses.length;
                if (installedCount >= MCP_MAX_RUNNING) {
                  showMcpToast(
                    state,
                    t("extensions.store.limitReached")
                      .replace("{{count}}", String(installedCount))
                      .replace("{{max}}", String(MCP_MAX_RUNNING)),
                    "error",
                  );
                  return;
                }
                // SSE security confirmation — remote services send data to third-party servers
                const _itemExtras = item as McpMarketplaceItem & { sseUrl?: string; _overrides?: { sseUrl?: string } };
                const _overrideSseUrl = _itemExtras._overrides?.sseUrl;
                if (item.installMethod === "sse" || _overrideSseUrl) {
                  const sseUrl = _overrideSseUrl || _itemExtras.sseUrl || "";
                  let domain = "";
                  try { domain = new URL(sseUrl).hostname; } catch { domain = sseUrl; }
                  const msg = (t("extensions.store.sseInstallConfirm" as never) as string)
                    .replace("{{name}}", item.friendlyName)
                    .replace("{{url}}", domain || "unknown");
                  if (!confirm(msg)) return;
                }
                // Token consumption warning — always show before install
                const afterCount = installedCount + 1;
                showMcpToast(
                  state,
                  (t("extensions.toast.tokenWarning" as never) as string)
                    .replace("{{current}}", String(afterCount))
                    .replace("{{max}}", String(MCP_MAX_RUNNING)),
                  "info",
                );
                // Extract env and overrides from config wizard (attached as _env / _overrides on the item)
                const itemWithExtras = item as McpMarketplaceItem & { _env?: Record<string, string>; _overrides?: { sseUrl?: string; npmPackage?: string; pypiPackage?: string } };
                const env = itemWithExtras._env;
                const overrides = itemWithExtras._overrides;
                void (async () => {
                  const result = await installMarketplaceItem(
                    state.client,
                    item,
                    env,
                    {
                      currentItems: () => state.mcpMarketplace.items,
                      onStateChange: (patch) => {
                        state.mcpMarketplace = { ...state.mcpMarketplace, ...patch };
                      },
                    },
                    overrides,
                  );

                  if (result?.ok) {
                    showMcpToast(state, `${item.friendlyName} ${t("extensions.toast.installed" as never)}`, "success");
                    // Refresh "My Capabilities" tab
                    const refreshCaps = () => initMcpCapabilities(state.client, {
                      onStateChange: (lcPatch) => {
                        if (lcPatch.capabilities !== undefined) state.mcpCapabilities = lcPatch.capabilities;
                        if (lcPatch.processes !== undefined) state.mcpProcesses = lcPatch.processes;
                        if (lcPatch.updateNotice !== undefined) state.mcpUpdateNotice = lcPatch.updateNotice;
                      },
                    });
                    void refreshCaps();
                    setTimeout(() => void refreshCaps(), 3000);
                  } else {
                    const errorDetail = result?.connectError;
                    const toastMsg = errorDetail
                      ? errorDetail
                      : `${item.friendlyName} ${t("extensions.toast.error" as never)}`;
                    showMcpToast(state, toastMsg, "error");
                  }
                })();
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
              onUpdateServerEnv: (serverId, env) => {
                const name = state.mcpCapabilities.find((c) => c.id === serverId)?.friendlyName ?? serverId;
                showMcpToast(state, `${name} — ${t("extensions.advanced.restarting" as never)}`, "info");
                void (async () => {
                  try {
                    await state.client?.request("mcp.servers.updateEnv", { id: serverId, env });
                    await restartMcpServer(state.client, serverId, {
                      onStateChange: (patch: Partial<McpLifecycleState>) => {
                        if (patch.capabilities !== undefined) state.mcpCapabilities = patch.capabilities;
                        if (patch.processes !== undefined) state.mcpProcesses = patch.processes;
                        if (patch.updateNotice !== undefined) state.mcpUpdateNotice = patch.updateNotice;
                      },
                    });
                    const updated = state.mcpCapabilities.find((c) => c.id === serverId);
                    if (updated?.status === "ready") {
                      showMcpToast(state, `${name} — ${t("extensions.status.ready")}`, "success");
                    } else {
                      showMcpToast(state, `${name} — ${t("extensions.advanced.restartFailed" as never)}`, "error");
                    }
                  } catch {
                    showMcpToast(state, `${name} — ${t("extensions.advanced.restartFailed" as never)}`, "error");
                  }
                })();
              },
              onLoadMore: () => {
                void loadMoreMarketplaceItems(state.client, {
                  onStateChange: (patch) => {
                    state.mcpMarketplace = { ...state.mcpMarketplace, ...patch };
                  },
                  currentState: () => state.mcpMarketplace,
                });
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

        ${state.tab === "network"
          ? renderNetworkCenter({
              activeTab: state.networkTab ?? "devices",
              onTabChange: (tab) => { state.networkTab = tab; },
              statusLoading: state.networkStatusLoading,
              status: state.networkStatus,
              statusError: state.networkStatusError,
              onRefreshStatus: () => loadNetworkStatus(state),
              presenceLoading: state.presenceLoading,
              presenceEntries: state.presenceEntries,
              presenceError: state.presenceError,
              onRefreshPresence: () => loadPresence(state),
              nodesProps: {
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
              },
              discoveryLoading: state.networkDiscoveryLoading,
              discoveredGateways: state.networkDiscoveredGateways,
              discoveryError: state.networkDiscoveryError,
              onDiscover: () => discoverGateways(state),
              probeLoading: state.networkProbeLoading,
              probeResult: state.networkProbeResult,
              onProbe: (host) => probeGateway(state, host),
              interfacesLoading: state.networkInterfacesLoading,
              interfaces: state.networkInterfaces,
              configureLoading: state.networkConfigureLoading,
              configureError: state.networkConfigureError,
              onConfigure: (params) => configureNetworkMode(state, params),
            })
          : nothing}

        ${renderUpdateBanner(state.updateAvailable && !state.updateDialogOpen ? {
            version: state.updateAvailable.version,
            summary: state.updateAvailable.summary,
            mandatory: state.updateAvailable.mandatory,
            onView: () => { state.updateResult = null; state.updateProgress = null; state.updateDialogOpen = true; },
            onDismiss: () => {
              const ver = state.updateAvailable?.version;
              state.updateAvailable = null;
              if (ver && state.client) { void state.client.request("update.dismiss", { version: ver }).catch(() => {}); }
            },
          } : null)}

        ${state.updateDialogOpen && state.updateAvailable ? renderUpdateDialog({
            info: state.updateAvailable,
            executing: state.updateExecuting,
            progress: state.updateProgress,
            result: state.updateResult,
            onExecute: () => { void state.handleRunUpdate(); },
            onDismiss: () => {
              state.updateDialogOpen = false;
              const ver = state.updateAvailable?.version;
              state.updateAvailable = null;
              if (ver && state.client) { void state.client.request("update.dismiss", { version: ver }).catch(() => {}); }
            },
            onClose: () => { state.updateDialogOpen = false; state.updateResult = null; state.updateProgress = null; },
            onRetry: () => { state.updateResult = null; state.updateProgress = null; void state.handleRunUpdate(); },
            onRestart: () => {
              // S5-3: 通知服务端立即重启（取消 30s 自动重启定时器）
              if (state.client) {
                void state.client.request("update.restart", {}).catch(() => {});
              }
              // CR-11: Tauri 桌面端重启整个应用，Web 端 fallback 到 reload
              try {
                const w = window as unknown as { __TAURI_INTERNALS__?: { invoke: (cmd: string) => void } };
                if (w.__TAURI_INTERNALS__?.invoke) {
                  w.__TAURI_INTERNALS__.invoke("restart");
                  return;
                }
              } catch { /* not in Tauri */ }
              window.location.reload();
            },
          }) : nothing}

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
          ? html`
            <div class="chat-with-sidebar">
            ${renderConversationSidebar(
              {
                open: state.convSidebarOpen,
                sessionKey: state.sessionKey,
                sessionsResult: state.sessionsResult,
                sessionsLoading: false,
                connected: state.connected,
                onToggle: () => { state.convSidebarOpen = !state.convSidebarOpen; },
                onSelectSession: (key: string) => switchSession(state, key),
                onNewChat: () => switchSession(state, generateUUID()),
                onPinSession: (key: string, pinned: boolean) => {
                  void state.client?.request("sessions.pin", { sessionKey: key, pinned });
                },
                onArchiveSession: (key: string) => {
                  void state.client?.request("sessions.archive", { sessionKey: key });
                },
                onDeleteSession: (key: string) => {
                  void state.client?.request("sessions.delete", { key, deleteTranscript: true })
                    .then(() => loadSessions(state));
                },
                onRenameSession: (key: string, name: string) => {
                  void state.client?.request("sessions.rename", { sessionKey: key, name });
                },
                onViewDetails: (key: string) => {
                  state.sessionKey = key;
                  state.setTab("sessions" as Tab);
                },
                onManageAll: () => { state.setTab("sessions" as Tab); },
                lastError: isFirstStartup ? null : state.lastError,
                assets: state.convSidebarAssets,
                assetsLoading: state.convSidebarAssetsLoading,
                onAssetsTabActivated: () => { void loadSidebarAssets(state); },
                onViewAsset: (asset) => {
                  if (asset.type === "image") {
                    window.open(asset.url, "_blank");
                  } else if (asset.type === "video") {
                    window.open(asset.url, "_blank");
                  }
                },
              },
              () => state.requestUpdate(),
            )}
            <div class="chat-content-area">
            ${state.convSidebarOpen ? html`
              <div class="chat-content-overlay" @click=${() => { state.convSidebarOpen = false; }}></div>
            ` : nothing}
            <div class="chat-content-toolbar">
              ${!state.convSidebarOpen ? renderSidebarToggle(
                false,
                () => { state.convSidebarOpen = true; },
              ) : nothing}
              <div class="chat-header-center">
                ${state.chatModelConfigured === false ? html`
                  <div class="chat-header-banner">
                    <span class="chat-header-banner__icon">🔑</span>
                    <span class="chat-header-banner__text">
                      聊天功能需要配置 AI 模型，请先前往模型设置完成配置
                    </span>
                    <button class="chat-header-banner__btn" type="button"
                      @click=${() => { state.setTab("model-config" as Tab); }}>前往配置</button>
                  </div>
                ` : state.essentialProviderConfigured === false ? html`
                  <div class="chat-header-banner chat-header-banner--warn">
                    <span class="chat-header-banner__icon">⚡</span>
                    <span class="chat-header-banner__text">
                      记忆、推荐等功能需要 <strong>硅基流动</strong>，模型免费，建议配置
                    </span>
                    <button class="chat-header-banner__btn" type="button"
                      @click=${() => { state.setTab("model-config" as Tab); }}>去配置</button>
                  </div>
                ` : nothing}
                ${state.lastError
                  ? html`<div class="pill danger">${state.lastError}</div>`
                  : nothing}
              </div>
              <div class="chat-content-toolbar__right">
                ${renderChatControls(state)}
              </div>
            </div>
            ${renderChat({
              sessionKey: state.sessionKey,
              onSessionKeyChange: (next) => switchSession(state, next),
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
              error: isFirstStartup ? null : state.lastError,
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
              onNewSession: () => switchSession(state, generateUUID()),
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
                onStopRecording: () => state.handleVoiceStopRecording({ autoSend: true }),
                onDismiss: () => state.handleVoiceMascotDismiss(),
              } : null,
              // OpenClawCN: auto-failover banner
              failoverBanner: state.failoverBanner ?? null,
              onDismissFailoverBanner: () => { state.failoverBanner = null; },
              // OpenClawCN: 聊天模型配置状态
              chatModelConfigured: state.chatModelConfigured,
              onNavigateToModelConfig: () => { state.setTab("model-config" as Tab); },
              // OpenClawCN: compose-card (豆包风格输入框)
              composeCardProps: {
                draft: state.chatMessage,
                connected: state.connected,
                sending: state.chatSending,
                canAbort: Boolean(state.chatRunId),
                hasStream: state.chatStream !== null,
                placeholder: t("chat.sendMessage"),
                attachments: state.chatAttachments,
                onDraftChange: (next: string) => (state.chatMessage = next),
                onSend: () => state.handleSendChat(),
                onAbort: () => void state.handleAbortChat(),
                onAttachmentsChange: (next: ChatAttachment[]) => (state.chatAttachments = next),
                onPaste: (e: ClipboardEvent) => {
                  void handleComposePaste(e, state.chatAttachments, (next: ChatAttachment[]) => { state.chatAttachments = next; });
                },
                voiceAvailable: state.voiceAsrAvailable === true,
                voiceRecording: state.voiceRecordingState === "recording",
                voiceProcessing: state.voiceRecordingState === "processing",
                volumeLevel: state.voiceVolumeLevel,
                onVoiceToggle: (opts?: { autoSend?: boolean }) => {
                  if (state.voiceRecordingState === "recording") {
                    void state.handleVoiceStopRecording(opts);
                  } else {
                    void state.handleVoiceStartRecording();
                  }
                },
                onVoiceUnavailable: state.voiceAsrAvailable !== true
                  ? () => {
                      const msg = "语音识别尚未配置，请前往设置页面安装语音能力。";
                      const anchor = document.querySelector(".chat-compose") as HTMLElement;
                      if (!anchor) return;
                      anchor.style.position = "relative";
                      const el = document.createElement("div");
                      el.textContent = msg;
                      Object.assign(el.style, {
                        position: "absolute", bottom: "-52px", left: "50%", transform: "translateX(-50%)",
                        padding: "8px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: "500",
                        background: "rgba(0,0,0,0.8)", color: "#fff", zIndex: "99999", whiteSpace: "nowrap",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)", transition: "opacity 0.3s",
                        pointerEvents: "none",
                      });
                      anchor.appendChild(el);
                      setTimeout(() => { el.style.opacity = "0"; }, 2500);
                      setTimeout(() => el.remove(), 3000);
                    }
                  : undefined,
                voiceMode: state.voiceMode,
                // [CN-PATCH] Hide voice-call (phone) button — feature not ready for production
                // onVoiceModeToggle: () => { void state.toggleVoiceMode(); },
                onToolSelect: (toolId: string) => {
                  const prompts: Record<string, string> = {
                    copywriting: "请帮我写一篇文案：",
                    spreadsheet: "请帮我制作一个表格：",
                    presentation: "请帮我制作一个PPT大纲：",
                    imagegen: "请帮我生成一张图片：",
                    videogen: "请帮我制作一个视频：",
                  };
                  const prompt = prompts[toolId];
                  if (prompt) {
                    state.chatMessage = prompt;
                    // Focus textarea
                    requestAnimationFrame(() => {
                      const ta = document.querySelector(".cc-textarea") as HTMLTextAreaElement;
                      if (ta) { ta.focus(); ta.setSelectionRange(prompt.length, prompt.length); }
                    });
                  }
                },
                // Image generation mode
                imageGenMode: (state as unknown as { imageGenMode?: boolean }).imageGenMode,
                // Screen share
                screenShareActive: state.screenShareActive,
                screenShareFrameCount: state.screenShareFrameCount,
                screenShareModelName: state.screenShareModelName ?? undefined,
                onScreenShareToggle: () => { void state.toggleScreenShare(); },
              },
              // OpenClawCN: intent-hint (智能意图提示)
              intentHintProps: {
                draft: state.chatMessage,
                activeCapabilities: (state as unknown as { activeCapabilities?: string[] }).activeCapabilities ?? [],
                hasImageAttachments: (state.chatAttachments ?? []).some(a => a.mimeType?.startsWith("image/")),
                onNavigateToModelConfig: () => { state.setTab("model-config" as Tab); },
              },
            })}
            ${state.imageGalleryOpen ? renderImageGallery({
              images: state.imageGalleryImages ?? [],
              onClose: () => { state.imageGalleryOpen = false; },
            }) : nothing}
            </div><!-- .chat-content-area -->
            </div><!-- .chat-with-sidebar -->
          `
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
              configFilePath: state.configSnapshot?.path ?? null,
              onRevealConfigFile: state.client ? () => {
                void state.client!.request("config.reveal", {});
              } : null,
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
              onRevealLogDir: state.client ? () => {
                void state.client!.request("logs.reveal", {});
              } : null,
              onScroll: (event) => state.handleLogsScroll(event),
              onReportIssue: state.connected ? () => state.handleLogReportOpen() : null,
            })
          : nothing}

        ${state.logReportState.showModal ? renderLogReportModal({
          state: state.logReportState,
          onOpen: () => state.handleLogReportOpen(),
          onClose: () => state.handleLogReportClose(),
          onDescriptionChange: (value) => {
            state.logReportState = { ...state.logReportState, description: value };
          },
          onAddAttachment: (att) => {
            state.logReportState = {
              ...state.logReportState,
              attachments: [...state.logReportState.attachments, att],
            };
          },
          onRemoveAttachment: (id) => {
            state.logReportState = {
              ...state.logReportState,
              attachments: state.logReportState.attachments.filter((a) => a.id !== id),
            };
          },
          onImageError: (message) => {
            state.logReportState = { ...state.logReportState, error: message };
          },
          onSubmit: () => void state.handleLogReportSubmit(),
          onReset: () => {
            state.logReportState = {
              ...state.logReportState,
              description: "",
              attachments: [],
              submitting: false,
              submitted: false,
              error: null,
              ticketCode: null,
              remaining: null,
            };
          },
          onToggleQueryMode: () => {
            state.logReportState = {
              ...state.logReportState,
              queryMode: !state.logReportState.queryMode,
              queryError: null,
              queryResult: null,
            };
          },
          onQueryCodeChange: (value) => {
            state.logReportState = { ...state.logReportState, queryCode: value };
          },
          onQuerySubmit: () => void state.handleLogReportQuery(),
        }) : nothing}

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

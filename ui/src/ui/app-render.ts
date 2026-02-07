import { html, nothing } from "lit";

import type { GatewayBrowserClient, GatewayHelloOk } from "./gateway";
import type { AppViewState } from "./app-view-state";
import { parseAgentSessionKey } from "../../../src/routing/session-key.js";
import {
  getTabGroups,
  iconForTab,
  pathForTab,
  subtitleForTab,
  titleForTab,
  type Tab,
} from "./navigation";
import { t } from "./i18n/index.js";
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
import { renderUsage } from "./views/usage";
import { renderSessions } from "./views/sessions";
import { renderExecApprovalPrompt } from "./views/exec-approval";
import { renderSkillInstallApproval } from "./views/skill-install-approval";
import { renderSkillInstallProgress } from "./views/skill-install-progress";
import {
  approveDevicePairing,
  loadDevices,
  rejectDevicePairing,
  revokeDeviceToken,
  rotateDeviceToken,
} from "./controllers/devices";
import { renderSkills } from "./views/skills";
import { renderPlayground } from "./views/playground";
import { renderFreeModels } from "./views/free-models";
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
import {
  loadFreeModels,
  toggleFreeModelsEnabled,
  openConfigModal,
  closeConfigModal,
  updateApiKey,
  testConnection,
  saveConfig as saveFreeModelsConfig,
  openDeleteModal,
  closeDeleteModal,
  confirmDelete,
  setPreferred,
  refreshFreeModels,
} from "./controllers/free-models";
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
  loadRemoteSkills,
  loadSkills,
  refreshMarketSkills,
  saveSkillApiKey,
  setActiveTab,
  updateSkillEdit,
  updateSkillEnabled,
  type SkillMessage,
} from "./controllers/skills";
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
import { loadUsageSummary } from "./controllers/usage";
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
 * 顶栏技术支持按钮（根据用户类型显示不同内容）
 * - 正式用户：⭐ 专属技术支持 (hover 弹出二维码)
 * - 试用用户：💬 技术支持 + 🛒 升级正式版
 */
function renderTopbarSupportButtons(state: AppViewState) {
  const license = state.licenseState?.license;
  if (!license) return nothing;

  const isTestUser = license.keyType === "test" || license.keyType === "trial";
  const qrcode = license.supportQrcode;

  if (isTestUser) {
    // 试用用户：技术支持 + 升级按钮
    return html`
      <div class="topbar-support topbar-support--test">
        <div class="topbar-support__btn topbar-support__btn--support">
          <span class="topbar-support__icon">💬</span>
          <span class="topbar-support__text">${t("support.techSupport")}</span>
          ${qrcode ? html`
            <div class="topbar-support__popover">
              <div class="topbar-support__popover-arrow"></div>
              <div class="topbar-support__popover-title">${t("support.scanForSupport")}</div>
              <img class="topbar-support__qrcode" src="${qrcode.base64}" alt="Support QR" />
              <div class="topbar-support__popover-desc">${qrcode.groupName}</div>
            </div>
          ` : nothing}
        </div>
        ${license.purchaseUrl ? html`
          <a href="${license.purchaseUrl}" target="_blank" rel="noreferrer" class="topbar-support__btn topbar-support__btn--upgrade">
            <span class="topbar-support__icon">🛒</span>
            <span class="topbar-support__text">${t("support.upgradePro")}</span>
          </a>
        ` : nothing}
      </div>
    `;
  }

  // 正式用户：专属技术支持
  return html`
    <div class="topbar-support topbar-support--pro">
      <div class="topbar-support__btn topbar-support__btn--pro-support">
        <span class="topbar-support__icon">⭐</span>
        <span class="topbar-support__text">${t("support.exclusiveSupport")}</span>
        ${qrcode ? html`
          <div class="topbar-support__popover">
            <div class="topbar-support__popover-arrow"></div>
            <div class="topbar-support__popover-title">${t("support.scanForPremiumSupport")}</div>
            <img class="topbar-support__qrcode" src="${qrcode.base64}" alt="Support QR" />
            <div class="topbar-support__popover-desc">${qrcode.groupName}</div>
            <div class="topbar-support__popover-sub">${t("support.premiumGroupDesc")}</div>
          </div>
        ` : nothing}
      </div>
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
          <a href="https://www.tecbinai.com" target="_blank" rel="noreferrer" class="topbar-promo">
            <span class="topbar-promo__dot"></span>
            <span class="topbar-promo__brand">TecbinAI</span>
            <span class="topbar-promo__sep"></span>
            <span class="topbar-promo__desc">及时追踪AI · 解锁更多玩法</span>
          </a>
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
          <a href="https://www.tecbinai.com" target="_blank" rel="noreferrer" class="nav-footer-link">
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

        ${state.tab === "usage"
          ? renderUsage({
              connected: state.connected,
              loading: state.usageLoading,
              summary: state.usageSummary,
              error: state.usageError,
              days: state.usageDays,
              onDaysChange: (days) => loadUsageSummary(state, days),
              onRefresh: () => loadUsageSummary(state),
            })
          : nothing}

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
                // 安装技能依赖，成功后刷新列表即可，用户可以点击"立即试用"
                installSkillDeps(state, skill);
              },
              onRefresh: () => loadPlaygroundSkills(state),
            })
          : nothing}

        ${state.tab === "skills"
          ? renderSkills({
              loading: state.skillsLoading,
              report: state.skillsReport,
              error: state.skillsError,
              filter: state.skillsFilter,
              edits: state.skillEdits,
              messages: state.skillMessages,
              busyKey: state.skillsBusyKey,
              // 连接状态
              connected: state.connected ?? false,
              // 安装进度
              installProgress: state.skillsInstallProgress ?? {},
              activeTab: state.skillsActiveTab ?? "local",
              remoteLoading: state.skillsRemoteLoading ?? false,
              remoteIndex: state.skillsRemoteIndex ?? null,
              remoteError: state.skillsRemoteError ?? null,
              // 新的市场属性
              marketLoading: state.skillsMarketLoading ?? false,
              marketResponse: state.skillsMarketResponse ?? null,
              marketSyncing: state.skillsMarketSyncing ?? false,
              marketLastSyncedAt: state.skillsMarketLastSyncedAt ?? null,
              marketError: state.skillsMarketError ?? null,
              // 分类筛选
              activeCategory: state.skillsActiveCategory ?? "all",
              onFilterChange: (next) => (state.skillsFilter = next),
              onRefresh: () => loadSkills(state, { clearMessages: true }),
              onToggle: (key, enabled) => updateSkillEnabled(state, key, enabled),
              onEdit: (key, value) => updateSkillEdit(state, key, value),
              onSaveKey: (key) => saveSkillApiKey(state, key),
              onInstall: (skillKey, name, installId) =>
                installSkill(state, skillKey, name, installId),
              onTabChange: (tab) => {
                setActiveTab(state, tab);
                if (tab === "remote") {
                  // 加载市场数据
                  loadMarketSkills(state).then(() => {
                    // 如果市场数据为空，自动触发刷新
                    const skills = state.skillsMarketResponse?.skills ?? [];
                    if (skills.length === 0 && !state.skillsMarketSyncing) {
                      refreshMarketSkills(state);
                    }
                  });
                }
              },
              onRefreshRemote: () => refreshMarketSkills(state),
              onInstallRemote: (skillName) => installRemoteSkill(state, skillName),
              onCategoryChange: (category) => (state.skillsActiveCategory = category),
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

        ${state.tab === "free-models"
          ? renderFreeModels({
              connected: state.connected,
              loading: state.freeModelsLoading,
              enabled: state.freeModelsEnabled,
              providers: state.freeModelsProviders,
              accounts: state.freeModelsAccounts,
              stats: state.freeModelsStats,
              switchHistory: state.freeModelsSwitchHistory,
              error: state.freeModelsError,
              configModalOpen: state.freeModelsConfigModalOpen,
              configModalProvider: state.freeModelsConfigModalProvider,
              configModalApiKey: state.freeModelsConfigModalApiKey,
              configModalTesting: state.freeModelsConfigModalTesting,
              configModalTestResult: state.freeModelsConfigModalTestResult,
              configModalSaving: state.freeModelsConfigModalSaving,
              deleteModalOpen: state.freeModelsDeleteModalOpen,
              deleteModalProvider: state.freeModelsDeleteModalProvider,
              deleteModalDeleting: state.freeModelsDeleteModalDeleting,
              onToggleEnabled: (enabled) => toggleFreeModelsEnabled(state, enabled),
              onOpenConfigModal: (provider) => openConfigModal(state, provider),
              onCloseConfigModal: () => closeConfigModal(state),
              onApiKeyChange: (apiKey) => updateApiKey(state, apiKey),
              onTestConnection: () => testConnection(state),
              onSaveConfig: () => saveFreeModelsConfig(state),
              onOpenDeleteModal: (provider) => openDeleteModal(state, provider),
              onCloseDeleteModal: () => closeDeleteModal(state),
              onConfirmDelete: () => confirmDelete(state),
              onSetPreferred: (providerId) => setPreferred(state, providerId),
              onRefresh: () => refreshFreeModels(state),
            })
          : nothing}
      </main>
      ${renderExecApprovalPrompt(state)}
      ${renderSkillInstallApproval(state)}
      ${renderSkillInstallProgress(state)}
      ${renderLicenseDialogs(state)}
      ${renderFeedbackModal(buildFeedbackProps(state))}
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
        state.licenseState?.renewalReminder?.renewUrl || null,
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

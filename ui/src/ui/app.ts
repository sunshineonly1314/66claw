import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

import type { GatewayBrowserClient, GatewayHelloOk } from "./gateway";
import { t } from "./i18n/index.js";
import { resolveInjectedAssistantIdentity } from "./assistant-identity";
import { loadSettings, type UiSettings } from "./storage";
import { renderApp } from "./app-render";
import type { Tab } from "./navigation";
import type { ResolvedTheme, ThemeMode } from "./theme";
import type {
  AgentsListResult,
  ConfigSnapshot,
  ConfigUiHints,
  CronJob,
  CronRunLogEntry,
  CronStatus,
  HealthSnapshot,
  LogEntry,
  LogLevel,
  PresenceEntry,
  ChannelsStatusSnapshot,
  RemoteSkillsIndex,
  SessionsListResult,
  SkillStatusReport,
  StatusSummary,
  NostrProfile,
} from "./types";
import { type ChatAttachment, type ChatQueueItem, type CronFormState } from "./ui-types";
import type { EventLogEntry } from "./app-events";
import { DEFAULT_CRON_FORM, DEFAULT_LOG_LEVEL_FILTERS } from "./app-defaults";
import type {
  ExecApprovalsFile,
  ExecApprovalsSnapshot,
} from "./controllers/exec-approvals";
import type { DevicePairingList } from "./controllers/devices";
import type { ExecApprovalRequest } from "./controllers/exec-approval";
import type { SkillMessage } from "./controllers/skills";
import {
  resetToolStream as resetToolStreamInternal,
  type ToolStreamEntry,
} from "./app-tool-stream";
import {
  exportLogs as exportLogsInternal,
  handleChatScroll as handleChatScrollInternal,
  handleLogsScroll as handleLogsScrollInternal,
  resetChatScroll as resetChatScrollInternal,
} from "./app-scroll";
import { connectGateway as connectGatewayInternal } from "./app-gateway";
import { initQrGuard } from "./qr-guard";
import {
  handleConnected,
  handleDisconnected,
  handleFirstUpdated,
  handleUpdated,
} from "./app-lifecycle";
import {
  applySettings as applySettingsInternal,
  loadCron as loadCronInternal,
  loadOverview as loadOverviewInternal,
  setTab as setTabInternal,
  setTheme as setThemeInternal,
  onPopState as onPopStateInternal,
} from "./app-settings";
import {
  handleAbortChat as handleAbortChatInternal,
  handleSendChat as handleSendChatInternal,
  removeQueuedMessage as removeQueuedMessageInternal,
} from "./app-chat";
import {
  handleChannelConfigReload as handleChannelConfigReloadInternal,
  handleChannelConfigSave as handleChannelConfigSaveInternal,
  handleNostrProfileCancel as handleNostrProfileCancelInternal,
  handleNostrProfileEdit as handleNostrProfileEditInternal,
  handleNostrProfileFieldChange as handleNostrProfileFieldChangeInternal,
  handleNostrProfileImport as handleNostrProfileImportInternal,
  handleNostrProfileSave as handleNostrProfileSaveInternal,
  handleNostrProfileToggleAdvanced as handleNostrProfileToggleAdvancedInternal,
  handleWhatsAppLogout as handleWhatsAppLogoutInternal,
  handleWhatsAppStart as handleWhatsAppStartInternal,
  handleWhatsAppWait as handleWhatsAppWaitInternal,
} from "./app-channels";
import type { NostrProfileFormState } from "./views/channels.nostr-profile-form";
import { loadAssistantIdentity as loadAssistantIdentityInternal } from "./controllers/assistant-identity";
import {
  createInitialDiscoveryState,
  runCapabilityDetection,
} from "./controllers/capability-detect";
import { initCodeBlockCopyHandlers } from "./code-highlight";
import {
  createDefaultBatchState,
  checkBatchSkills as checkBatchSkillsController,
  handleBatchEvent as handleBatchEventController,
} from "./controllers/skills-batch";

declare global {
  interface Window {
    __CLAWDBOT_CONTROL_UI_BASE_PATH__?: string;
  }
}

const injectedAssistantIdentity = resolveInjectedAssistantIdentity();

function resolveOnboardingMode(): boolean {
  if (!window.location.search) return false;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("onboarding");
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

@customElement("clawdbot-app")
export class ClawdbotApp extends LitElement {
  @state() settings: UiSettings = loadSettings();
  @state() password = "";
  @state() tab: Tab = "chat";
  @state() onboarding = resolveOnboardingMode();
  @state() connected = false;
  @state() theme: ThemeMode = this.settings.theme ?? "system";
  @state() themeResolved: ResolvedTheme = "dark";
  @state() hello: GatewayHelloOk | null = null;
  @state() lastError: string | null = null;
  @state() eventLog: EventLogEntry[] = [];
  private eventLogBuffer: EventLogEntry[] = [];
  private toolStreamSyncTimer: number | null = null;
  private sidebarCloseTimer: number | null = null;

  @state() assistantName = injectedAssistantIdentity.name;
  @state() assistantAvatar = injectedAssistantIdentity.avatar;
  @state() assistantAgentId = injectedAssistantIdentity.agentId ?? null;

  @state() sessionKey = this.settings.sessionKey;
  @state() chatLoading = false;
  @state() chatSending = false;
  @state() chatMessage = "";
  @state() chatMessages: unknown[] = [];
  @state() chatToolMessages: unknown[] = [];
  @state() chatStream: string | null = null;
  @state() chatStreamStartedAt: number | null = null;
  @state() chatRunId: string | null = null;
  @state() chatStreamJustCompleted = false;
  /** 计时器 ID，用于 justCompleted 自动清除（app-gateway / app-chat 需要访问） */
  _justCompletedTimer = 0;
  @state() compactionStatus: import("./app-tool-stream").CompactionStatus | null = null;
  // API Response Monitor state
  @state() apiMonitorElapsedMs = 0;
  @state() apiMonitorDismissed = false;
  apiMonitorTimer: number | null = null;
  @state() chatAvatarUrl: string | null = null;
  @state() chatThinkingLevel: string | null = null;
  @state() chatQueue: ChatQueueItem[] = [];
  @state() chatAttachments: ChatAttachment[] = [];
  // Sidebar state for tool output viewing
  @state() sidebarOpen = false;
  @state() sidebarContent: string | null = null;
  @state() sidebarError: string | null = null;
  @state() splitRatio = this.settings.splitRatio;

  @state() nodesLoading = false;
  @state() nodes: Array<Record<string, unknown>> = [];
  @state() devicesLoading = false;
  @state() devicesError: string | null = null;
  @state() devicesList: DevicePairingList | null = null;
  @state() execApprovalsLoading = false;
  @state() execApprovalsSaving = false;
  @state() execApprovalsDirty = false;
  @state() execApprovalsSnapshot: ExecApprovalsSnapshot | null = null;
  @state() execApprovalsForm: ExecApprovalsFile | null = null;
  @state() execApprovalsSelectedAgent: string | null = null;
  @state() execApprovalsTarget: "gateway" | "node" = "gateway";
  @state() execApprovalsTargetNodeId: string | null = null;
  @state() execApprovalQueue: ExecApprovalRequest[] = [];
  @state() execApprovalBusy = false;
  @state() execApprovalError: string | null = null;

  // License 状态 (ClawdbotCN)
  @state() licenseState: import("./license/types").LicenseUiState = {
    checking: false,
    valid: true,
    offlineMode: false,
    error: null,
    errorCode: null,
    license: null,
    device: null,
    renewalReminder: null,
    forceUpdate: null,
    pendingNotifications: [],
    lastVerifiedAt: null,
    deviceSwitchInfo: null,
    deviceSwitchCooldown: null,
  };
  @state() showLicenseDialog: import("./license/types").LicenseDialogType | null = null;
  @state() licenseActivating = false;
  @state() licenseActivationError: string | null = null;
  @state() licenseBoundDevices: import("./license/types").BoundDevice[] = [];
  @state() showOfflineBanner = false;

  // QR 码预加载状态 (ClawdbotCN)
  @state() qrcodePreloading = false;
  @state() qrcodePreloaded = false;
  @state() qrcodeExpiresAt: number | null = null;

  // 能力发现状态 (Capability Discovery)
  @state() discoveryState: import("./controllers/capability-detect").DiscoveryControllerState = createInitialDiscoveryState();

  // 性能档位 (Performance Profile)
  @state() performanceProfile: "economy" | "balanced" | "power" = "balanced";
  @state() performanceProfileSaving = false;

  @state() configLoading = false;
  @state() configRaw = "{\n}\n";
  @state() configRawOriginal = "";
  @state() configValid: boolean | null = null;
  @state() configIssues: unknown[] = [];
  @state() configSaving = false;
  @state() configApplying = false;
  @state() updateRunning = false;
  @state() applySessionKey = this.settings.lastActiveSessionKey;
  @state() configSnapshot: ConfigSnapshot | null = null;
  @state() configSchema: unknown | null = null;
  @state() configSchemaVersion: string | null = null;
  @state() configSchemaLoading = false;
  @state() configUiHints: ConfigUiHints = {};
  @state() configForm: Record<string, unknown> | null = null;
  @state() configFormOriginal: Record<string, unknown> | null = null;
  @state() configFormDirty = false;
  @state() configFormMode: "form" | "raw" = "form";
  @state() configSearchQuery = "";
  @state() configActiveSection: string | null = null;
  @state() configActiveSubsection: string | null = null;

  // 模型选择状态 (Model Selection)
  @state() modelsLoading = false;
  @state() modelsProviders: import("./controllers/models").ProviderInfo[] = [];
  @state() modelsDefaults: Record<string, string> = {};
  @state() modelsCurrent: import("./controllers/models").CurrentModelInfo | null = null;
  @state() modelsSaving = false;
  @state() modelsError: string | null = null;
  @state() modelsSuccessMessage: string | null = null; // 成功消息
  // 待保存的模型选择（用户选择后需要点击保存才生效）
  @state() modelsPendingProvider: string | null = null;
  @state() modelsPendingModel: string | null = null;
  @state() modelsConfiguringProvider: string | null = null; // 正在配置的提供商 ID
  @state() modelsAuthSaving = false; // API Key 保存中
  @state() modelsAuthVerifying = false; // API Key 验证中
  @state() modelsAuthVerifyResult: import("./controllers/models").ApiKeyVerifyResult | null = null; // 验证结果

  // 安全模式状态 (Security Mode)
  @state() securityLoading = false;
  @state() securityModes: import("./controllers/security").SecurityModeInfo[] = [];
  @state() securityCurrent: import("./controllers/security").SecurityMode | null = null;
  @state() securitySaving = false;
  @state() securityError: string | null = null;
  @state() securityShowWarning = false; // 显示危险警告弹框
  @state() securitySuccessMessage: string | null = null; // 安全模式切换成功消息

  // 免费模型管理状态 (Free Models)
  @state() freeModelsLoading = false;
  @state() freeModelsEnabled = false;
  @state() freeModelsProviders: import("./views/free-models").FreeModelProvider[] = [];
  @state() freeModelsAccounts: import("./views/free-models").FreeModelAccount[] = [];
  @state() freeModelsStats: import("./views/free-models").FreeModelsStats = {
    todaySavings: 0,
    totalSavings: 0,
    todayFreeRequests: 0,
    lastResetDate: new Date().toISOString().split("T")[0],
  };
  @state() freeModelsSwitchHistory: import("./views/free-models").FreeModelSwitchRecord[] = [];
  @state() freeModelsError: string | null = null;
  @state() freeModelsConfigModalOpen = false;
  @state() freeModelsConfigModalProvider: import("./views/free-models").FreeModelProvider | null = null;
  @state() freeModelsConfigModalApiKey = "";
  @state() freeModelsConfigModalTesting = false;
  @state() freeModelsConfigModalTestResult: { success: boolean; message: string } | null = null;
  @state() freeModelsConfigModalSaving = false;
  @state() freeModelsDeleteModalOpen = false;
  @state() freeModelsDeleteModalProvider: import("./views/free-models").FreeModelProvider | null = null;
  @state() freeModelsDeleteModalDeleting = false;

  @state() channelsLoading = false;
  @state() channelsSnapshot: ChannelsStatusSnapshot | null = null;
  @state() channelsError: string | null = null;
  @state() channelsLastSuccess: number | null = null;
  @state() whatsappLoginMessage: string | null = null;
  @state() whatsappLoginQrDataUrl: string | null = null;
  @state() whatsappLoginConnected: boolean | null = null;
  @state() whatsappBusy = false;
  @state() nostrProfileFormState: NostrProfileFormState | null = null;
  @state() nostrProfileAccountId: string | null = null;

  @state() presenceLoading = false;
  @state() presenceEntries: PresenceEntry[] = [];
  @state() presenceError: string | null = null;
  @state() presenceStatus: string | null = null;

  @state() agentsLoading = false;
  @state() agentsList: AgentsListResult | null = null;
  @state() agentsError: string | null = null;

  @state() sessionsLoading = false;
  @state() sessionsResult: SessionsListResult | null = null;
  @state() sessionsError: string | null = null;
  @state() sessionsFilterActive = "";
  @state() sessionsFilterLimit = "120";
  @state() sessionsIncludeGlobal = true;
  @state() sessionsIncludeUnknown = false;

  @state() cronLoading = false;
  @state() cronJobs: CronJob[] = [];
  @state() cronStatus: CronStatus | null = null;
  @state() cronError: string | null = null;
  @state() cronForm: CronFormState = { ...DEFAULT_CRON_FORM };
  @state() cronRunsJobId: string | null = null;
  @state() cronRuns: CronRunLogEntry[] = [];
  @state() cronBusy = false;

  @state() skillsLoading = false;
  @state() skillsReport: SkillStatusReport | null = null;
  @state() skillsError: string | null = null;
  @state() skillsFilter = "";
  @state() skillEdits: Record<string, string> = {};
  @state() skillsBusyKey: string | null = null;
  @state() skillMessages: Record<string, SkillMessage> = {};
  @state() skillsInstallProgress: Record<string, import("./controllers/skills").InstallProgress> = {};
  @state() skillsActiveTab: "active" | "library" = "active";
  @state() skillsRemoteLoading = false;
  @state() skillsRemoteIndex: RemoteSkillsIndex | null = null;
  @state() skillsRemoteError: string | null = null;
  // 新的市场状态（基于本地索引）
  @state() skillsMarketLoading = false;
  @state() skillsMarketResponse: import("./types").SkillsMarketResponse | null = null;
  @state() skillsMarketSyncing = false;
  @state() skillsMarketLastSyncedAt: string | null = null;
  @state() skillsMarketError: string | null = null;
  // 技能分类筛选
  @state() skillsActiveCategory = "all";
  // 技能列表分页
  @state() skillsVisibleCount = 50;

  // Playground 状态（技能玩法推荐）
  @state() playgroundLoading = false;
  @state() playgroundReport: import("./types").SkillStatusReport | null = null;
  @state() playgroundError: string | null = null;
  @state() playgroundActiveCategory: string | null = null;
  @state() playgroundFilter: string = "";
  @state() playgroundInstallingSkill: string | null = null;
  @state() playgroundInstallMessage: string | null = null;

  // ClawdbotCN 专属：技能安装进度弹框状态
  @state() skillInstallQueue: import("./views/skill-install-approval").SkillInstallRequest[] = [];
  @state() skillInstallProgress: import("./views/skill-install-progress").SkillInstallProgress | null = null;
  @state() skillInstallBusy = false;
  @state() skillInstallError: string | null = null;

  // ClawdbotCN 专属：技能批量安装状态 (Skills Batch Install)
  @state() skillsBatch = createDefaultBatchState();
  private batchPillAutoDismissTimer: number | null = null;
  handleBatchEvent = (event: Record<string, unknown>) => {
    handleBatchEventController(this.skillsBatch, event);
    // Trigger Lit re-render by reassigning the state object
    this.skillsBatch = { ...this.skillsBatch };
  };
  checkBatchSkills = async () => {
    // Augment state with client reference — controller mutates in-place
    const proxy = Object.assign(this.skillsBatch, { client: this.client, connected: this.connected });
    await checkBatchSkillsController(proxy);
    this.skillsBatch = { ...this.skillsBatch };
  };

  // MCP 扩展工具状态 (Extensions)
  @state() mcpCapabilities: import("./app-view-state").McpCapability[] = [];
  @state() mcpAdvancedOpen = false;
  @state() mcpUpdateNotice: { count: number; names: string[] } | null = null;
  @state() mcpProcesses: import("./app-view-state").McpProcessInfo[] = [];
  @state() mcpExtTab: import("./app-view-state").McpExtensionsTab = "my";
  @state() mcpMarketplace: import("./app-view-state").McpMarketplaceState = {
    items: [],
    loading: false,
    error: null,
    search: "",
    activeCategory: "all",
    sort: "recommended",
    recommendations: [],
    showFirstVisit: !localStorage.getItem("clawdbot.mcp.firstVisitSeen"),
    detailItem: null,
    configTarget: null,
    toast: null,
  };
  /** Timer for auto-clearing MCP toast notifications */
  _mcpToastTimer: number | null = null;

  // 文档中心状态
  @state() docsViewState: import("./views/docs").DocsViewState = {
    mode: "home",
    searchQuery: "",
    searchResults: [],
    currentDocId: null,
    showSearchModal: false,
  };

  // 适配公告弹框（仅显示一次）
  @state() showAdaptationNotice = !localStorage.getItem("clawdbot.chat.adaptationNoticeSeen");

  // 意见反馈状态
  @state() feedbackState: import("./views/feedback").FeedbackViewState = {
    showModal: false,
    type: "suggestion",
    content: "",
    contact: "",
    attachments: [],
    submitting: false,
    submitted: false,
    error: null,
  };

  // Token 使用量统计状态
  @state() usageLoading = false;
  @state() usageSummary: import("./types").CostUsageSummary | null = null;
  @state() usageError: string | null = null;
  @state() usageDays = 30;

  @state() debugLoading = false;
  @state() debugStatus: StatusSummary | null = null;
  @state() debugHealth: HealthSnapshot | null = null;
  @state() debugModels: unknown[] = [];
  @state() debugHeartbeat: unknown | null = null;
  @state() debugCallMethod = "";
  @state() debugCallParams = "{}";
  @state() debugCallResult: string | null = null;
  @state() debugCallError: string | null = null;

  @state() logsLoading = false;
  @state() logsError: string | null = null;
  @state() logsFile: string | null = null;
  @state() logsEntries: LogEntry[] = [];
  @state() logsFilterText = "";
  @state() logsLevelFilters: Record<LogLevel, boolean> = {
    ...DEFAULT_LOG_LEVEL_FILTERS,
  };
  @state() logsAutoFollow = true;
  @state() logsTruncated = false;
  @state() logsCursor: number | null = null;
  @state() logsLastFetchAt: number | null = null;
  @state() logsLimit = 500;
  @state() logsMaxBytes = 250_000;
  @state() logsAtBottom = true;

  client: GatewayBrowserClient | null = null;
  private chatScrollFrame: number | null = null;
  private chatScrollTimeout: number | null = null;
  private chatHasAutoScrolled = false;
  private chatUserNearBottom = true;
  private nodesPollInterval: number | null = null;
  private logsPollInterval: number | null = null;
  private debugPollInterval: number | null = null;
  private mcpPollInterval: number | null = null;
  private logsScrollFrame: number | null = null;
  private toolStreamById = new Map<string, ToolStreamEntry>();
  private toolStreamOrder: string[] = [];
  private readingIndicatorTimer: number | null = null;
  basePath = "";
  private popStateHandler = () =>
    onPopStateInternal(
      this as unknown as Parameters<typeof onPopStateInternal>[0],
    );
  private themeMedia: MediaQueryList | null = null;
  private themeMediaHandler: ((event: MediaQueryListEvent) => void) | null = null;
  private topbarObserver: ResizeObserver | null = null;

  createRenderRoot() {
    return this;
  }

  private handleDocsKeydown = (e: KeyboardEvent) => {
    // ⌘K or Ctrl+K to open docs search
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      if (this.tab === "docs") {
        this.docsViewState = { ...this.docsViewState, showSearchModal: true };
      } else {
        // 切换到文档页面并打开搜索
        this.tab = "docs";
        this.docsViewState = { ...this.docsViewState, showSearchModal: true };
      }
    }
    // Esc to close docs search modal
    if (e.key === "Escape" && this.docsViewState.showSearchModal) {
      e.preventDefault();
      this.docsViewState = { ...this.docsViewState, showSearchModal: false };
    }
  };

  connectedCallback() {
    super.connectedCallback();
    handleConnected(this as unknown as Parameters<typeof handleConnected>[0]);
    document.addEventListener("keydown", this.handleDocsKeydown);
    // 初始化代码块复制功能（事件委托，只需初始化一次）
    initCodeBlockCopyHandlers();
    // 初始化 QR 码截屏保护
    initQrGuard();
  }

  protected firstUpdated() {
    handleFirstUpdated(this as unknown as Parameters<typeof handleFirstUpdated>[0]);
  }

  disconnectedCallback() {
    handleDisconnected(this as unknown as Parameters<typeof handleDisconnected>[0]);
    document.removeEventListener("keydown", this.handleDocsKeydown);
    if (this.batchPillAutoDismissTimer != null) {
      window.clearTimeout(this.batchPillAutoDismissTimer);
      this.batchPillAutoDismissTimer = null;
    }
    super.disconnectedCallback();
  }

  protected updated(changed: Map<PropertyKey, unknown>) {
    handleUpdated(
      this as unknown as Parameters<typeof handleUpdated>[0],
      changed,
    );

    // Auto-dismiss the minimized "complete" pill after 5 seconds
    if (changed.has("skillsBatch")) {
      const { batchPhase, batchMinimized } = this.skillsBatch;
      if (batchMinimized && batchPhase === "complete") {
        if (this.batchPillAutoDismissTimer == null) {
          this.batchPillAutoDismissTimer = window.setTimeout(() => {
            this.batchPillAutoDismissTimer = null;
            if (this.skillsBatch.batchMinimized && this.skillsBatch.batchPhase === "complete") {
              this.skillsBatch = { ...this.skillsBatch, batchPhase: "idle", batchMinimized: false };
            }
          }, 5000);
        }
      } else if (this.batchPillAutoDismissTimer != null) {
        window.clearTimeout(this.batchPillAutoDismissTimer);
        this.batchPillAutoDismissTimer = null;
      }
    }
  }

  connect() {
    connectGatewayInternal(
      this as unknown as Parameters<typeof connectGatewayInternal>[0],
    );
  }

  handleChatScroll(event: Event) {
    handleChatScrollInternal(
      this as unknown as Parameters<typeof handleChatScrollInternal>[0],
      event,
    );
  }

  handleLogsScroll(event: Event) {
    handleLogsScrollInternal(
      this as unknown as Parameters<typeof handleLogsScrollInternal>[0],
      event,
    );
  }

  exportLogs(lines: string[], label: string) {
    exportLogsInternal(lines, label);
  }

  resetToolStream() {
    resetToolStreamInternal(
      this as unknown as Parameters<typeof resetToolStreamInternal>[0],
    );
  }

  resetChatScroll() {
    resetChatScrollInternal(
      this as unknown as Parameters<typeof resetChatScrollInternal>[0],
    );
  }

  async loadAssistantIdentity() {
    await loadAssistantIdentityInternal(this);
  }

  applySettings(next: UiSettings) {
    applySettingsInternal(
      this as unknown as Parameters<typeof applySettingsInternal>[0],
      next,
    );
  }

  setTab(next: Tab) {
    setTabInternal(this as unknown as Parameters<typeof setTabInternal>[0], next);
  }

  setTheme(next: ThemeMode, context?: Parameters<typeof setThemeInternal>[2]) {
    setThemeInternal(
      this as unknown as Parameters<typeof setThemeInternal>[0],
      next,
      context,
    );
  }

  async loadOverview() {
    await loadOverviewInternal(
      this as unknown as Parameters<typeof loadOverviewInternal>[0],
    );
  }

  async setModelPrimary(provider: string, model: string) {
    const { setModelPrimary } = await import("./controllers/models.js");
    await setModelPrimary(this, provider, model);
  }

  // 设置待保存的模型选择（不立即保存）
  setModelPending(provider: string, model: string) {
    this.modelsPendingProvider = provider;
    this.modelsPendingModel = model;
  }

  // 取消待保存的模型选择
  cancelModelPending() {
    this.modelsPendingProvider = null;
    this.modelsPendingModel = null;
  }

  // 确认并保存待选择的模型
  async confirmModelPending() {
    if (!this.modelsPendingProvider || !this.modelsPendingModel) return;
    const provider = this.modelsPendingProvider;
    const model = this.modelsPendingModel;
    // 清除之前的消息
    this.modelsError = null;
    this.modelsSuccessMessage = null;
    // 执行实际保存
    const { setModelPrimary } = await import("./controllers/models.js");
    const success = await setModelPrimary(this, provider, model);
    if (success) {
      // 保存成功后才清除待保存状态（失败时保留，方便用户重试）
      this.modelsPendingProvider = null;
      this.modelsPendingModel = null;
      // 显示切换成功消息
      const { t } = await import("./i18n/index.js");
      this.modelsSuccessMessage = t("models.switchSuccess");
      // 3秒后自动清除成功消息
      setTimeout(() => {
        this.modelsSuccessMessage = null;
      }, 3000);
    }
    // 失败时 modelsError 已由 setModelPrimary 设置，pending 状态保留方便重试
  }

  async loadModelsProviders() {
    const { loadModelsProviders } = await import("./controllers/models.js");
    await loadModelsProviders(this);
  }

  setConfiguringProvider(providerId: string | null) {
    this.modelsConfiguringProvider = providerId;
  }

  async saveProviderAuth(provider: string, auth: { apiKey?: string; secretId?: string; secretKey?: string }) {
    const { setProviderAuth } = await import("./controllers/models.js");
    this.modelsAuthSaving = true;
    this.modelsError = null;
    this.modelsSuccessMessage = null;
    
    try {
      const success = await setProviderAuth(this, provider, auth);
      if (success) {
        // 保存成功，关闭配置表单
        this.modelsConfiguringProvider = null;
        this.modelsAuthVerifyResult = null; // 清除验证结果
        // 重新加载提供商列表以更新状态
        await this.loadModelsProviders();
        // 自动切换到该提供商的模型：优先使用用户已手动选择的模型
        const providerData = this.modelsProviders.find((p) => p.id === provider);
        const pendingModelForProvider = (this.modelsPendingProvider === provider) ? this.modelsPendingModel : null;
        const defaultModel = this.modelsDefaults[provider];
        const recommendedModel = providerData?.models.find((m) => m.recommended);
        const firstModel = providerData?.models[0];
        const modelToUse = pendingModelForProvider ?? defaultModel ?? recommendedModel?.id ?? firstModel?.id;
        if (modelToUse) {
          await this.setModelPrimary(provider, modelToUse);
          // 显示切换成功消息
          const { t } = await import("./i18n/index.js");
          this.modelsSuccessMessage = t("models.switchSuccess");
          // 清除待保存状态
          this.modelsPendingProvider = null;
          this.modelsPendingModel = null;
          // 3秒后自动清除成功消息
          setTimeout(() => {
            this.modelsSuccessMessage = null;
          }, 3000);
        }
      }
    } finally {
      this.modelsAuthSaving = false;
    }
  }

  async verifyProviderApiKey(provider: string, apiKey: string, model?: string) {
    const { verifyProviderApiKey } = await import("./controllers/models.js");
    return verifyProviderApiKey(this, provider, apiKey, model);
  }

  clearAuthVerifyResult() {
    this.modelsAuthVerifyResult = null;
  }

  async setSecurityMode(mode: import("./controllers/security").SecurityMode, confirmed: boolean = false) {
    const { setSecurityMode } = await import("./controllers/security.js");
    const result = await setSecurityMode(this, mode, confirmed);
    
    // 如果需要确认，显示警告弹框
    if (!result.ok && result.needsConfirmation) {
      this.securityShowWarning = true;
      return { needsConfirmation: true };
    }
    
    // 切换成功，显示成功消息
    if (result.ok) {
      const { t } = await import("./i18n/index.js");
      this.securitySuccessMessage = t("security.switchSuccess");
      // 3秒后自动清除成功消息
      setTimeout(() => {
        this.securitySuccessMessage = null;
      }, 3000);
    }
    
    return result;
  }

  closeSecurityWarning() {
    this.securityShowWarning = false;
  }

  async confirmSecurityTrustMode() {
    this.securityShowWarning = false;
    await this.setSecurityMode("trust", true);
  }

  async loadCron() {
    await loadCronInternal(
      this as unknown as Parameters<typeof loadCronInternal>[0],
    );
  }

  async handleAbortChat() {
    await handleAbortChatInternal(
      this as unknown as Parameters<typeof handleAbortChatInternal>[0],
    );
  }

  removeQueuedMessage(id: string) {
    removeQueuedMessageInternal(
      this as unknown as Parameters<typeof removeQueuedMessageInternal>[0],
      id,
    );
  }

  async handleSendChat(
    messageOverride?: string,
    opts?: Parameters<typeof handleSendChatInternal>[2],
  ) {
    await handleSendChatInternal(
      this as unknown as Parameters<typeof handleSendChatInternal>[0],
      messageOverride,
      opts,
    );
  }

  async handleWhatsAppStart(force: boolean) {
    await handleWhatsAppStartInternal(this, force);
  }

  async handleWhatsAppWait() {
    await handleWhatsAppWaitInternal(this);
  }

  async handleWhatsAppLogout() {
    await handleWhatsAppLogoutInternal(this);
  }

  async handleChannelConfigSave() {
    await handleChannelConfigSaveInternal(this);
  }

  async handleChannelConfigReload() {
    await handleChannelConfigReloadInternal(this);
  }

  handleNostrProfileEdit(accountId: string, profile: NostrProfile | null) {
    handleNostrProfileEditInternal(this, accountId, profile);
  }

  handleNostrProfileCancel() {
    handleNostrProfileCancelInternal(this);
  }

  handleNostrProfileFieldChange(field: keyof NostrProfile, value: string) {
    handleNostrProfileFieldChangeInternal(this, field, value);
  }

  async handleNostrProfileSave() {
    await handleNostrProfileSaveInternal(this);
  }

  async handleNostrProfileImport() {
    await handleNostrProfileImportInternal(this);
  }

  handleNostrProfileToggleAdvanced() {
    handleNostrProfileToggleAdvancedInternal(this);
  }

  async handleExecApprovalDecision(decision: "allow-once" | "allow-always" | "deny") {
    const active = this.execApprovalQueue[0];
    if (!active || !this.client || this.execApprovalBusy) return;
    this.execApprovalBusy = true;
    this.execApprovalError = null;
    try {
      await this.client.request("exec.approval.resolve", {
        id: active.id,
        decision,
      });
      this.execApprovalQueue = this.execApprovalQueue.filter((entry) => entry.id !== active.id);
    } catch (err) {
      this.execApprovalError = t("execApprovals.error.saveFailed", { error: String(err) });
    } finally {
      this.execApprovalBusy = false;
    }
  }

  // =========================================================================
  // ClawdbotCN 专属：技能安装进度弹框方法
  // =========================================================================

  /**
   * 关闭技能安装进度弹框
   */
  dismissSkillInstallProgress() {
    this.skillInstallProgress = null;
  }

  /**
   * 重试技能安装
   */
  async retrySkillInstall() {
    const progress = this.skillInstallProgress;
    if (!progress || !this.client) {
      this.skillInstallProgress = null;
      return;
    }

    // 重置进度状态
    this.skillInstallProgress = {
      ...progress,
      stage: "downloading",
      message: `正在重新安装 ${progress.skillName}...`,
      percent: 0,
      logs: [],
    };

    try {
      // 重新触发安装
      const result = (await this.client.request("skills.install", {
        name: progress.skillName,
        timeoutMs: 180000,
      })) as { ok?: boolean; message?: string };

      // 注意：进度更新会通过 WebSocket 事件推送
      if (!result?.ok) {
        this.skillInstallProgress = {
          ...this.skillInstallProgress!,
          stage: "failed",
          message: result?.message ?? "安装失败",
          percent: 0,
        };
      }
    } catch (err) {
      this.skillInstallProgress = {
        ...this.skillInstallProgress!,
        stage: "failed",
        message: `安装失败: ${err instanceof Error ? err.message : String(err)}`,
        percent: 0,
      };
    }
  }

  /**
   * 处理技能安装决策（审批弹框）
   */
  async handleSkillInstallDecision(decision: "install" | "install-continue" | "deny") {
    const active = this.skillInstallQueue[0];
    if (!active || !this.client || this.skillInstallBusy) return;
    
    this.skillInstallBusy = true;
    this.skillInstallError = null;
    
    try {
      await this.client.request("skill.install.resolve", {
        id: active.id,
        decision,
      });
      // 从队列中移除
      this.skillInstallQueue = this.skillInstallQueue.filter((entry) => entry.id !== active.id);
    } catch (err) {
      this.skillInstallError = `技能安装决策失败: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.skillInstallBusy = false;
    }
  }

  // Sidebar handlers for tool output viewing
  handleOpenSidebar(content: string) {
    if (this.sidebarCloseTimer != null) {
      window.clearTimeout(this.sidebarCloseTimer);
      this.sidebarCloseTimer = null;
    }
    this.sidebarContent = content;
    this.sidebarError = null;
    this.sidebarOpen = true;
  }

  handleCloseSidebar() {
    this.sidebarOpen = false;
    // Clear content after transition
    if (this.sidebarCloseTimer != null) {
      window.clearTimeout(this.sidebarCloseTimer);
    }
    this.sidebarCloseTimer = window.setTimeout(() => {
      if (this.sidebarOpen) return;
      this.sidebarContent = null;
      this.sidebarError = null;
      this.sidebarCloseTimer = null;
    }, 200);
  }

  handleSplitRatioChange(ratio: number) {
    const newRatio = Math.max(0.4, Math.min(0.7, ratio));
    this.splitRatio = newRatio;
    this.applySettings({ ...this.settings, splitRatio: newRatio });
  }

  // 关闭适配公告弹框（永久记住）
  dismissAdaptationNotice() {
    localStorage.setItem("clawdbot.chat.adaptationNoticeSeen", "1");
    this.showAdaptationNotice = false;
  }

  // 意见反馈处理函数
  handleFeedbackOpen() {
    this.feedbackState = { ...this.feedbackState, showModal: true };
  }

  handleFeedbackClose() {
    this.feedbackState = {
      ...this.feedbackState,
      showModal: false,
      // 如果已提交成功，重置表单
      ...(this.feedbackState.submitted
        ? {
            type: "suggestion" as const,
            content: "",
            contact: "",
            attachments: [],
            submitting: false,
            submitted: false,
            error: null,
          }
        : {}),
    };
  }

  async handleFeedbackSubmit() {
    const { content, type, contact, attachments } = this.feedbackState;

    // 验证内容
    if (!content.trim()) {
      this.feedbackState = {
        ...this.feedbackState,
        error: "请填写反馈内容哦",
      };
      return;
    }

    if (content.trim().length < 5) {
      this.feedbackState = {
        ...this.feedbackState,
        error: "再多写几个字吧，让我们更好地理解你的想法",
      };
      return;
    }

    this.feedbackState = {
      ...this.feedbackState,
      submitting: true,
      error: null,
    };

    try {
      // 构建反馈数据
      const payload = {
        type,
        content: content.trim(),
        contact: contact.trim() || undefined,
        attachments: attachments.length > 0
          ? attachments.map((a) => a.dataUrl)
          : undefined,
        context: {
          version: this.hello?.version ?? "unknown",
          platform: navigator.platform,
          page: this.tab,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
      };

      // 调用网关 API 提交反馈
      if (this.client) {
        await this.client.request("feedback.submit", payload);
      } else {
        // 如果没有连接，保存到本地存储
        const feedbackList = JSON.parse(localStorage.getItem("clawdbot-feedback") || "[]");
        feedbackList.push({ ...payload, id: Date.now().toString() });
        localStorage.setItem("clawdbot-feedback", JSON.stringify(feedbackList));
      }

      this.feedbackState = {
        ...this.feedbackState,
        submitting: false,
        submitted: true,
      };
    } catch (err) {
      console.error("Feedback submit error:", err);
      this.feedbackState = {
        ...this.feedbackState,
        submitting: false,
        error: "提交失败，请稍后重试",
      };
    }
  }

  render() {
    return renderApp(this);
  }
}

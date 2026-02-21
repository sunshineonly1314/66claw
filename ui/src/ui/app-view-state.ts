import type { GatewayBrowserClient, GatewayHelloOk } from "./gateway";
import type { Tab } from "./navigation";
import type { UiSettings } from "./storage";
import type { ThemeMode } from "./theme";
import type { ThemeTransitionContext } from "./theme-transition";
import type {
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentsListResult,
  ChannelsStatusSnapshot,
  ConfigSnapshot,
  ConfigUiHints,
  CronJob,
  CronRunLogEntry,
  CronStatus,
  HealthSnapshot,
  LogEntry,
  LogLevel,
  NostrProfile,
  PresenceEntry,
  RemoteSkillsIndex,
  SessionsListResult,
  SkillStatusReport,
  StatusSummary,
} from "./types";
import type { ChatAttachment, ChatQueueItem, CronFormState } from "./ui-types";
import type { EventLogEntry } from "./app-events";
import type { SkillMessage } from "./controllers/skills";
import type {
  ExecApprovalsFile,
  ExecApprovalsSnapshot,
} from "./controllers/exec-approvals";
import type { DevicePairingList } from "./controllers/devices";
import type { ExecApprovalRequest } from "./controllers/exec-approval";
import type { SkillInstallRequest } from "./views/skill-install-approval";
import type { SkillInstallProgress } from "./views/skill-install-progress";
import type { SkillInstallDecision } from "./controllers/skill-install";
import type { NostrProfileFormState } from "./views/channels.nostr-profile-form";
import type { DocsViewState } from "./views/docs";
import type { FeedbackViewState } from "./views/feedback";
import type { LicenseUiState, LicenseDialogType, BoundDevice } from "./license/types";
import type { DiscoveryControllerState } from "./controllers/capability-detect";
import type { CostUsageSummary, SessionsUsageResult, SessionUsageTimeSeries } from "./types";

export type AppViewState = {
  settings: UiSettings;
  password: string;
  tab: Tab;
  onboarding: boolean;
  basePath: string;
  connected: boolean;
  theme: ThemeMode;
  themeResolved: "light" | "dark";
  hello: GatewayHelloOk | null;
  lastError: string | null;
  eventLog: EventLogEntry[];
  assistantName: string;
  assistantAvatar: string | null;
  assistantAgentId: string | null;
  sessionKey: string;
  chatLoading: boolean;
  chatSending: boolean;
  chatMessage: string;
  chatAttachments: ChatAttachment[];
  chatMessages: unknown[];
  chatToolMessages: unknown[];
  chatStream: string | null;
  chatStreamStartedAt: number | null;
  chatRunId: string | null;
  chatAvatarUrl: string | null;
  chatThinkingLevel: string | null;
  chatQueue: ChatQueueItem[];
  compactionStatus: import("./app-tool-stream").CompactionStatus | null;
  /** OpenClawCN: auto-failover notification banner */
  failoverBanner: {
    fromProvider: string;
    toProvider: string;
    toModel: string;
    reason: string;
    reasonText: string;
  } | null;
  // OpenClawCN: 聊天模型是否已配置
  chatModelConfigured: boolean | null;
  // API Response Monitor state
  apiMonitorElapsedMs: number;
  apiMonitorDismissed: boolean;
  // Sidebar state
  sidebarOpen: boolean;
  sidebarContent: string | null;
  sidebarError: string | null;
  splitRatio: number;
  nodesLoading: boolean;
  nodes: Array<Record<string, unknown>>;
  devicesLoading: boolean;
  devicesError: string | null;
  devicesList: DevicePairingList | null;
  execApprovalsLoading: boolean;
  execApprovalsSaving: boolean;
  execApprovalsDirty: boolean;
  execApprovalsSnapshot: ExecApprovalsSnapshot | null;
  execApprovalsForm: ExecApprovalsFile | null;
  execApprovalsSelectedAgent: string | null;
  execApprovalsTarget: "gateway" | "node";
  execApprovalsTargetNodeId: string | null;
  execApprovalQueue: ExecApprovalRequest[];
  execApprovalBusy: boolean;
  execApprovalError: string | null;
  // 技能安装审批状态
  skillInstallQueue?: SkillInstallRequest[];
  skillInstallBusy?: boolean;
  skillInstallError?: string | null;
  skillInstallProgress?: SkillInstallProgress | null;
  handleSkillInstallDecision?: (decision: SkillInstallDecision) => Promise<void>;
  dismissSkillInstallProgress?: () => void;
  retrySkillInstall?: () => void;
  // 能力发现状态 (Capability Discovery)
  discoveryState: DiscoveryControllerState;
  handleDiscoveryStart?: () => Promise<void>;
  handleDiscoverySkip?: () => void;
  handleDiscoverySuggestionClick?: (prompt: string) => void;
  // License 状态 (ClawdbotCN)
  licenseState: LicenseUiState;
  showLicenseDialog: LicenseDialogType | null;
  licenseActivating: boolean;
  licenseActivationError: string | null;
  licenseBoundDevices: BoundDevice[];
  showOfflineBanner: boolean;
  // QR 码预加载状态 (ClawdbotCN)
  qrcodePreloading: boolean;
  qrcodePreloaded: boolean;
  qrcodeExpiresAt: number | null;
  // HTTP fallback QR 码（断连时通过 /api/support/qrcode 获取）
  fallbackQrcode: { base64: string; groupName: string } | null;
  // 智能推荐开关 (Smart Dispatch Toggle)
  smartDispatchEnabled: boolean;
  smartDispatchSaving: boolean;
  // 性能档位 (Performance Profile)
  performanceProfile: "economy" | "balanced" | "power";
  performanceProfileSaving: boolean;
  pendingGatewayUrl: string | null;
  configLoading: boolean;
  configRaw: string;
  configRawOriginal: string;
  configValid: boolean | null;
  configIssues: unknown[];
  configSaving: boolean;
  configApplying: boolean;
  updateRunning: boolean;
  configSnapshot: ConfigSnapshot | null;
  configSchema: unknown | null;
  configSchemaLoading: boolean;
  configUiHints: ConfigUiHints;
  configForm: Record<string, unknown> | null;
  configFormOriginal: Record<string, unknown> | null;
  configFormMode: "form" | "raw";
  configSchemaVersion: string | null;
  configSearchQuery: string;
  configActiveSection: string | null;
  configActiveSubsection: string | null;
  applySessionKey: string;
  channelsLoading: boolean;
  channelsSnapshot: ChannelsStatusSnapshot | null;
  channelsError: string | null;
  channelsLastSuccess: number | null;
  whatsappLoginMessage: string | null;
  whatsappLoginQrDataUrl: string | null;
  whatsappLoginConnected: boolean | null;
  whatsappBusy: boolean;
  nostrProfileFormState: NostrProfileFormState | null;
  nostrProfileAccountId: string | null;
  configFormDirty: boolean;
  presenceLoading: boolean;
  presenceEntries: PresenceEntry[];
  presenceError: string | null;
  presenceStatus: string | null;
  agentsLoading: boolean;
  agentsList: AgentsListResult | null;
  agentsError: string | null;
  agentsSelectedId: string | null;
  agentsPanel: "overview" | "files" | "tools" | "skills" | "channels" | "cron";
  agentFilesLoading: boolean;
  agentFilesError: string | null;
  agentFilesList: AgentsFilesListResult | null;
  agentFileContents: Record<string, string>;
  agentFileDrafts: Record<string, string>;
  agentFileActive: string | null;
  agentFileSaving: boolean;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  agentSkillsLoading: boolean;
  agentSkillsError: string | null;
  agentSkillsReport: SkillStatusReport | null;
  agentSkillsAgentId: string | null;
  sessionsLoading: boolean;
  sessionsResult: SessionsListResult | null;
  sessionsError: string | null;
  sessionsFilterActive: string;
  sessionsFilterLimit: string;
  sessionsIncludeGlobal: boolean;
  sessionsIncludeUnknown: boolean;
  cronLoading: boolean;
  cronJobs: CronJob[];
  cronStatus: CronStatus | null;
  cronError: string | null;
  cronForm: CronFormState;
  cronRunsJobId: string | null;
  cronRuns: CronRunLogEntry[];
  cronBusy: boolean;
  skillsLoading: boolean;
  skillsReport: SkillStatusReport | null;
  skillsError: string | null;
  skillsFilter: string;
  skillEdits: Record<string, string>;
  skillMessages: Record<string, SkillMessage>;
  skillsBusyKey: string | null;
  skillsActiveTab: "active" | "library" | "blocked" | "mcp-store" | "market";
  skillsRemoteLoading: boolean;
  skillsRemoteIndex: RemoteSkillsIndex | null;
  skillsRemoteError: string | null;
  // 新的市场状态（基于本地索引）
  skillsMarketLoading: boolean;
  skillsMarketResponse: import("./types").SkillsMarketResponse | null;
  skillsMarketSyncing: boolean;
  skillsMarketLastSyncedAt: string | null;
  skillsMarketError: string | null;
  // 技能分类筛选
  skillsActiveCategory: string;
  // 技能市场搜索结果（SQLite FTS5 分页）
  skillsMarketSearchResult: import("./controllers/skills").SkillsMarketSearchResult | null;
  skillsMarketPage: number;
  // 技能列表分页
  skillsVisibleCount: number;
  // 统一视图层级筛选
  skillsTierGroupFilter: "all" | "core" | "ready" | "needs-config" | "disabled" | "catalog";
  // 导入本地技能
  skillsImportOpen: boolean;
  skillsImportPath: string;
  skillsImportBrowseResult: import("./controllers/skills").BrowseResult | null;
  skillsImportLoading: boolean;
  skillsImportError: string | null;
  skillsImportSuccess: string | null;
  // Playground 状态（技能玩法推荐）
  playgroundLoading: boolean;
  playgroundReport: SkillStatusReport | null;
  playgroundError: string | null;
  playgroundActiveCategory: string | null;
  playgroundFilter: string;
  playgroundInstallingSkill: string | null;
  playgroundInstallMessage: string | null;
  // 技能安装进度
  skillsInstallProgress: Record<string, import("./controllers/skills").InstallProgress>;
  // 技能批量安装状态 (ClawdbotCN)
  skillsBatch: import("./controllers/skills-batch").SkillsBatchState;
  handleBatchEvent?: (event: Record<string, unknown>) => void;
  // MCP 扩展工具状态 (Extensions)
  mcpCapabilities: McpCapability[];
  mcpAdvancedOpen: boolean;
  mcpUpdateNotice: { count: number; names: string[] } | null;
  mcpProcesses: McpProcessInfo[];
  mcpTestingServerId: string | null;
  mcpTestResults: Record<string, "success" | "failed">;
  mcpManualFormTrigger: number;
  // MCP 市场状态
  mcpExtTab: McpExtensionsTab;
  mcpMarketplace: McpMarketplaceState;
  // 文档中心状态
  docsViewState: DocsViewState;
  // 意见反馈状态
  feedbackState: FeedbackViewState;
  // Token 使用量统计状态 (简易视图，保留向后兼容)
  usageSummary: CostUsageSummary | null;
  usageDays: number;
  // 高级 Usage 分析系统
  usageLoading: boolean;
  usageResult: SessionsUsageResult | null;
  usageCostSummary: CostUsageSummary | null;
  usageError: string | null;
  usageStartDate: string;
  usageEndDate: string;
  usageSelectedSessions: string[];
  usageSelectedDays: string[];
  usageSelectedHours: number[];
  usageChartMode: "tokens" | "cost";
  usageDailyChartMode: "total" | "by-type";
  usageTimeSeriesMode: "cumulative" | "per-turn";
  usageTimeSeriesBreakdownMode: "total" | "by-type";
  usageTimeSeries: SessionUsageTimeSeries | null;
  usageTimeSeriesLoading: boolean;
  usageSessionLogs: import("./views/usage").SessionLogEntry[] | null;
  usageSessionLogsLoading: boolean;
  usageSessionLogsExpanded: boolean;
  usageQuery: string;
  usageQueryDraft: string;
  usageQueryDebounceTimer: number | null;
  usageSessionSort: "tokens" | "cost" | "recent" | "messages" | "errors";
  usageSessionSortDir: "asc" | "desc";
  usageRecentSessions: string[];
  usageTimeZone: "local" | "utc";
  usageContextExpanded: boolean;
  usageHeaderPinned: boolean;
  usageSessionsTab: "all" | "recent";
  usageVisibleColumns: string[];
  usageLogFilterRoles: import("./views/usage").SessionLogRole[];
  usageLogFilterTools: string[];
  usageLogFilterHasTools: boolean;
  usageLogFilterQuery: string;
  // 模型选择状态
  modelsLoading: boolean;
  modelsProviders: import("./controllers/models").ProviderInfo[];
  modelsDefaults: Record<string, string>;
  modelsCurrent: import("./controllers/models").CurrentModelInfo | null;
  modelsSaving: boolean;
  modelsError: string | null;
  modelsConfiguringProvider: string | null;
  modelsAuthSaving: boolean;
  modelsAuthVerifying: boolean;
  modelsAuthVerifyResult: import("./controllers/models").ApiKeyVerifyResult | null;
  // 安全模式状态
  securityLoading: boolean;
  securityModes: import("./controllers/security").SecurityModeInfo[];
  securityCurrent: import("./controllers/security").SecurityMode | null;
  securitySaving: boolean;
  securityError: string | null;
  securityShowWarning: boolean;
  // 免费模型管理状态
  freeModelsLoading: boolean;
  freeModelsEnabled: boolean;
  freeModelsProviders: import("./views/free-models").FreeModelProvider[];
  freeModelsAccounts: import("./views/free-models").FreeModelAccount[];
  freeModelsStats: import("./views/free-models").FreeModelsStats;
  freeModelsSwitchHistory: import("./views/free-models").FreeModelSwitchRecord[];
  freeModelsError: string | null;
  freeModelsConfigModalOpen: boolean;
  freeModelsConfigModalProvider: import("./views/free-models").FreeModelProvider | null;
  freeModelsConfigModalApiKey: string;
  freeModelsConfigModalTesting: boolean;
  freeModelsConfigModalTestResult: { success: boolean; message: string } | null;
  freeModelsConfigModalSaving: boolean;
  freeModelsDeleteModalOpen: boolean;
  freeModelsDeleteModalProvider: import("./views/free-models").FreeModelProvider | null;
  freeModelsDeleteModalDeleting: boolean;
  debugLoading: boolean;
  debugStatus: StatusSummary | null;
  debugHealth: HealthSnapshot | null;
  debugModels: unknown[];
  debugHeartbeat: unknown | null;
  debugCallMethod: string;
  debugCallParams: string;
  debugCallResult: string | null;
  debugCallError: string | null;
  logsLoading: boolean;
  logsError: string | null;
  logsFile: string | null;
  logsEntries: LogEntry[];
  logsFilterText: string;
  logsLevelFilters: Record<LogLevel, boolean>;
  logsAutoFollow: boolean;
  logsTruncated: boolean;
  client: GatewayBrowserClient | null;
  connect: () => void;
  setTab: (tab: Tab) => void;
  setTheme: (theme: ThemeMode, context?: ThemeTransitionContext) => void;
  applySettings: (next: UiSettings) => void;
  loadOverview: () => Promise<void>;
  loadAssistantIdentity: () => Promise<void>;
  loadCron: () => Promise<void>;
  handleWhatsAppStart: (force: boolean) => Promise<void>;
  handleWhatsAppWait: () => Promise<void>;
  handleWhatsAppLogout: () => Promise<void>;
  handleChannelConfigSave: () => Promise<void>;
  handleChannelConfigReload: () => Promise<void>;
  handleNostrProfileEdit: (accountId: string, profile: NostrProfile | null) => void;
  handleNostrProfileCancel: () => void;
  handleNostrProfileFieldChange: (field: keyof NostrProfile, value: string) => void;
  handleNostrProfileSave: () => Promise<void>;
  handleNostrProfileImport: () => Promise<void>;
  handleNostrProfileToggleAdvanced: () => void;
  handleExecApprovalDecision: (decision: "allow-once" | "allow-always" | "deny") => Promise<void>;
  handleGatewayUrlConfirm: () => void;
  handleGatewayUrlCancel: () => void;
  handleConfigLoad: () => Promise<void>;
  handleConfigSave: () => Promise<void>;
  handleConfigApply: () => Promise<void>;
  handleConfigFormUpdate: (path: string, value: unknown) => void;
  handleConfigFormModeChange: (mode: "form" | "raw") => void;
  handleConfigRawChange: (raw: string) => void;
  handleInstallSkill: (key: string) => Promise<void>;
  handleUpdateSkill: (key: string) => Promise<void>;
  handleToggleSkillEnabled: (key: string, enabled: boolean) => Promise<void>;
  handleUpdateSkillEdit: (key: string, value: string) => void;
  handleSaveSkillApiKey: (key: string, apiKey: string) => Promise<void>;
  handleCronToggle: (jobId: string, enabled: boolean) => Promise<void>;
  handleCronRun: (jobId: string) => Promise<void>;
  handleCronRemove: (jobId: string) => Promise<void>;
  handleCronAdd: () => Promise<void>;
  handleCronRunsLoad: (jobId: string) => Promise<void>;
  handleCronFormUpdate: (path: string, value: unknown) => void;
  handleSessionsLoad: () => Promise<void>;
  handleSessionsPatch: (key: string, patch: unknown) => Promise<void>;
  handleLoadNodes: () => Promise<void>;
  handleLoadPresence: () => Promise<void>;
  handleLoadSkills: () => Promise<void>;
  handleLoadDebug: () => Promise<void>;
  handleLoadLogs: () => Promise<void>;
  handleDebugCall: () => Promise<void>;
  handleRunUpdate: () => Promise<void>;
  setPassword: (next: string) => void;
  setSessionKey: (next: string) => void;
  setChatMessage: (next: string) => void;
  handleChatSend: () => Promise<void>;
  handleChatAbort: () => Promise<void>;
  handleChatSelectQueueItem: (id: string) => void;
  handleChatDropQueueItem: (id: string) => void;
  handleChatClearQueue: () => void;
  handleLogsFilterChange: (next: string) => void;
  handleLogsLevelFilterToggle: (level: LogLevel) => void;
  handleLogsAutoFollowToggle: (next: boolean) => void;
  handleCallDebugMethod: (method: string, params: string) => Promise<void>;
  // 适配公告弹框
  showAdaptationNotice: boolean;
  dismissAdaptationNotice: () => void;
  // 反馈功能处理函数
  handleFeedbackOpen: () => void;
  handleFeedbackClose: () => void;
  handleFeedbackSubmit: () => Promise<void>;
  // 模型选择处理函数
  setModelPrimary: (providerId: string, modelId: string) => Promise<void>;
  setModelPending: (providerId: string, modelId: string) => void;
  cancelModelPending: () => void;
  confirmModelPending: () => Promise<void>;
  modelsPendingProvider: string | null;
  modelsPendingModel: string | null;
  setConfiguringProvider: (providerId: string | null) => void;
  saveProviderAuth: (providerId: string, auth: { apiKey?: string; secretId?: string; secretKey?: string }) => Promise<void>;
  verifyProviderApiKey: (providerId: string, apiKey: string, model?: string) => Promise<import("./controllers/models").ApiKeyVerifyResult>;
  clearAuthVerifyResult: () => void;
  // 安全模式处理函数
  setSecurityMode: (mode: string) => Promise<void>;
  closeSecurityWarning: () => void;
  confirmSecurityTrustMode: () => Promise<void>;
  // 工具流处理函数
  resetToolStream: () => void;
  resetChatScroll: (force?: boolean) => void;
  // Chat 处理函数
  handleChatScroll: (event: Event) => void;
  handleSendChat: (msg?: string, opts?: { restoreDraft?: boolean }) => Promise<void>;
  handleAbortChat: () => Promise<void>;
  removeQueuedMessage: (id: string) => void;
  // Sidebar 处理函数
  handleOpenSidebar: (content: string) => void;
  handleCloseSidebar: () => void;
  handleSplitRatioChange: (ratio: number) => void;
  // Logs 处理函数
  exportLogs: (lines: string[], label: string) => void;
  handleLogsScroll: (event: Event) => void;
  logsCursor: number | null;
  logsLastFetchAt: number | null;
  logsLimit: number;
  logsMaxBytes: number;
};

// ---------------------------------------------------------------------------
// MCP / Extensions types
// ---------------------------------------------------------------------------

export type McpCapabilityStatus = "ready" | "needs_config" | "paused" | "fixing" | "unavailable";

export type McpCapability = {
  id: string;
  friendlyName: string;
  status: McpCapabilityStatus;
  description: string[];
  examplePrompt: string;
  configNeeded?: string;
  isNew?: boolean;
  /** true for the 5 hardcoded built-in capabilities; false/undefined for user-installed MCP */
  isBuiltin?: boolean;
};

export type McpProcessInfo = {
  id: string;
  friendlyName: string;
  status: "running" | "stopped" | "error";
  memoryMB: number;
  toolCount: number;
  error?: string;
};

// ---------------------------------------------------------------------------
// MCP Marketplace types
// ---------------------------------------------------------------------------

export type McpMarketplaceItem = {
  serverId: string;
  friendlyName: string;
  friendlyNameEn: string;
  description: string;
  descriptionEn: string;
  category: string;
  tags: string[];
  version: string;
  npmPackage: string;
  securityScore: number;
  requiresApiKey: boolean;
  apiKeyName?: string;
  apiKeyGuideUrl?: string;
  platforms: string[];
  isOfficial: boolean;
  isNew: boolean;
  toolCount: number;
  installStatus: "not_installed" | "installing" | "installed" | "error";
  /** Capabilities list shown in detail modal */
  capabilities?: string[];
  /** Example prompts for "try saying" */
  examplePrompts?: string[];
  /** Tool names exposed by this server */
  toolNames?: string[];
  /** Installed version (if any) for update detection */
  installedVersion?: string;
  /** True when marketplace version > installed version */
  hasUpdate?: boolean;
  /** Whether this item has a working install method (npm/pypi/SSE) */
  installable?: boolean;
  /** Install method type for UI labeling */
  installMethod?: "npm" | "pypi" | "sse" | "none";
  /** Link to source detail page (for items without install method) */
  sourceUrl?: string;
  /** Data source identifier */
  source?: string;
  /** Setup hint from platformNotes (shown when requiresApiKey is inferred) */
  configHint?: string;
};

export type McpMarketplaceState = {
  items: McpMarketplaceItem[];
  loading: boolean;
  error: string | null;
  search: string;
  activeCategory: string;
  sort: "recommended" | "newest" | "popular" | "name";
  recommendations: McpMarketplaceItem[];
  showFirstVisit: boolean;
  /** Currently open detail modal item */
  detailItem: McpMarketplaceItem | null;
  /** Config wizard target */
  configTarget: McpMarketplaceItem | null;
  /** Toast notification (auto-dismissed after 4s) */
  toast: McpToast | null;
  /** Batch API key configuration modal open state */
  showBatchConfig: boolean;
  /** Pagination: current page (1-based) */
  page: number;
  /** Pagination: items per page */
  pageSize: number;
  /** Pagination: total items across all pages */
  total: number;
  /** Pagination: total pages */
  totalPages: number;
  /** True when loading more items (infinite scroll) */
  loadingMore: boolean;
};

export type McpToast = {
  message: string;
  type: "success" | "error" | "info";
  timestamp: number;
};

export type McpExtensionsTab = "my" | "store";

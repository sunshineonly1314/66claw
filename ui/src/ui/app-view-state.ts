import type { GatewayBrowserClient, GatewayHelloOk } from "./gateway";
import type { Tab } from "./navigation";
import type { UiSettings } from "./storage";
import type { ThemeMode } from "./theme";
import type { ThemeTransitionContext } from "./theme-transition";
import type {
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
import type { CostUsageSummary } from "./types";

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
  skillsActiveTab: "local" | "remote";
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
  // Playground 状态（技能玩法推荐）
  playgroundLoading: boolean;
  playgroundReport: SkillStatusReport | null;
  playgroundError: string | null;
  playgroundActiveCategory: string | null;
  playgroundInstallingSkill: string | null;
  playgroundInstallMessage: string | null;
  // 技能安装进度
  skillsInstallProgress: Record<string, import("./controllers/skills").InstallProgress>;
  // 文档中心状态
  docsViewState: DocsViewState;
  // 意见反馈状态
  feedbackState: FeedbackViewState;
  // Token 使用量统计状态
  usageLoading: boolean;
  usageSummary: CostUsageSummary | null;
  usageError: string | null;
  usageDays: number;
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

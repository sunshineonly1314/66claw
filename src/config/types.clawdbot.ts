import type { AgentBinding, AgentsConfig } from "./types.agents.js";
import type { ApprovalsConfig } from "./types.approvals.js";
import type { AuthConfig } from "./types.auth.js";
import type { DiagnosticsConfig, LoggingConfig, SessionConfig, WebConfig } from "./types.base.js";
import type { BrowserConfig } from "./types.browser.js";
import type { ChannelsConfig } from "./types.channels.js";
import type { CronConfig } from "./types.cron.js";
import type {
  CanvasHostConfig,
  DiscoveryConfig,
  GatewayConfig,
  TalkConfig,
} from "./types.gateway.js";
import type { HooksConfig } from "./types.hooks.js";
import type { MemoryConfig } from "./types.memory.js";
import type {
  AudioConfig,
  BroadcastConfig,
  CommandsConfig,
  MessagesConfig,
} from "./types.messages.js";
import type { ModelsConfig } from "./types.models.js";
import type { NodeHostConfig } from "./types.node-host.js";
import type { PluginsConfig } from "./types.plugins.js";
import type { SkillsConfig } from "./types.skills.js";
import type { ToolsConfig } from "./types.tools.js";
import type { LicenseConfig } from "./types.license.js";
import type { StateStoreConfig } from "../infra/state-store/types.js";
import type { ToolDiscoveryConfig } from "./types.tool-discovery.js";

export type PerformanceProfile = "economy" | "balanced" | "power";

export type OpenClawCNConfig = {
  meta?: {
    /** Last openclawcn version that wrote this config. */
    lastTouchedVersion?: string;
    /** ISO timestamp when this config was last written. */
    lastTouchedAt?: string;
    /** AI assistant performance profile (economy/balanced/power). */
    performanceProfile?: PerformanceProfile;
    /** Config schema version for migration gating. */
    schemaVersion?: number;
  };
  auth?: AuthConfig;
  env?: {
    /** Opt-in: import missing secrets from a login shell environment (exec `$SHELL -l -c 'env -0'`). */
    shellEnv?: {
      enabled?: boolean;
      /** Timeout for the login shell exec (ms). Default: 15000. */
      timeoutMs?: number;
    };
    /** Inline env vars to apply when not already present in the process env. */
    vars?: Record<string, string>;
    /** Sugar: allow env vars directly under env (string values only). */
    [key: string]:
      | string
      | Record<string, string>
      | { enabled?: boolean; timeoutMs?: number }
      | undefined;
  };
  wizard?: {
    lastRunAt?: string;
    lastRunVersion?: string;
    lastRunCommit?: string;
    lastRunCommand?: string;
    lastRunMode?: "local" | "remote";
  };
  diagnostics?: DiagnosticsConfig;
  logging?: LoggingConfig;
  update?: {
    /** Update channel for git + npm installs ("stable", "beta", or "dev"). */
    channel?: "stable" | "beta" | "dev";
    /** Check for updates on gateway start (npm installs only). */
    checkOnStart?: boolean;
  };
  browser?: BrowserConfig;
  ui?: {
    /** Accent color for OpenClawCN UI chrome (hex). */
    seamColor?: string;
    assistant?: {
      /** Assistant display name for UI surfaces. */
      name?: string;
      /** Assistant avatar (emoji, short text, or image URL/data URI). */
      avatar?: string;
    };
  };
  skills?: SkillsConfig;
  plugins?: PluginsConfig;
  models?: ModelsConfig;
  nodeHost?: NodeHostConfig;
  agents?: AgentsConfig;
  tools?: ToolsConfig;
  bindings?: AgentBinding[];
  broadcast?: BroadcastConfig;
  audio?: AudioConfig;
  messages?: MessagesConfig;
  commands?: CommandsConfig;
  approvals?: ApprovalsConfig;
  session?: SessionConfig;
  web?: WebConfig;
  channels?: ChannelsConfig;
  cron?: CronConfig;
  hooks?: HooksConfig;
  discovery?: DiscoveryConfig;
  canvasHost?: CanvasHostConfig;
  talk?: TalkConfig;
  gateway?: GatewayConfig;
  memory?: MemoryConfig;
  /** Setup wizard 状态持久化 */
  setup?: {
    /** ISO timestamp when setup wizard was completed */
    completedAt?: string;
    /** Last wizard step that was fully completed (0-indexed). */
    lastCompletedStep?: number;
  };
  /** License 授权信息 (OpenClawCN) */
  license?: LicenseConfig;
  /** 通用凭据存储（兼容字段，用于存储环境变量） */
  credentials?: Record<string, string>;
  /** MCP (Model Context Protocol) server configuration. */
  mcp?: import("../mcp/types.js").MCPConfig;
  /** Distributed state store configuration (memory or redis). */
  stateStore?: StateStoreConfig;
  /** OpenClawCN 智能调度总开关。需显式设为 true 才启用，默认关闭。 */
  dispatch?: {
    /** 是否启用智能调度引擎（意图识别 + 复杂度评估 + 自动选模型）。默认 false。 */
    enabled?: boolean;
    /** 是否启用模态感知路由（根据图片/音频等附件自动选模型）。默认 true。 */
    modalityRouter?: boolean;
    /** 是否启用多 Agent 编排（复杂任务自动拆分并行执行）。默认 true。 */
    multiAgent?: boolean;
    /** 是否启用工具筛选 Gate（从 ~50 候选中精选 3-8 个工具）。默认 true。 */
    toolSelector?: boolean;
    /** 是否启用 DAG 拓扑执行器（替代旧版并行/顺序编排）。默认 true。 */
    dagExecutor?: boolean;
    /** 工具过滤模式："off"=全量注入, "intent"=仅按意图过滤, "discovery"=意图+工具发现结果。默认 "off"。 */
    toolFilterMode?: "off" | "intent" | "discovery";
  };
  // ── [CN-PATCH:tool-discovery] 智能工具发现配置 ──
  /** 智能工具发现配置（FTS5 + 向量混合搜索，CN 区域默认启用）。 */
  toolDiscovery?: ToolDiscoveryConfig;
  /** Provider 优先级排序（用于 fallback 顺序控制） */
  providerPriority?: string[];
};

export type ConfigValidationIssue = {
  path: string;
  message: string;
};

export type LegacyConfigIssue = {
  path: string;
  message: string;
};

export type ConfigFileSnapshot = {
  path: string;
  exists: boolean;
  raw: string | null;
  parsed: unknown;
  /**
   * Config after $include resolution and ${ENV} substitution, but BEFORE runtime
   * defaults are applied. Use this for config set/unset operations to avoid
   * leaking runtime defaults into the written config file.
   */
  resolved: OpenClawCNConfig;
  valid: boolean;
  config: OpenClawCNConfig;
  hash?: string;
  issues: ConfigValidationIssue[];
  warnings: ConfigValidationIssue[];
  legacyIssues: LegacyConfigIssue[];
};

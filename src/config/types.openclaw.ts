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
import type { LicenseConfig } from "./types.license.js";
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
import type { ToolDiscoveryConfig } from "./types.tool-discovery.js";
import type { ToolsConfig } from "./types.tools.js";
import type { StateStoreConfig } from "../infra/state-store/types.js";

export type OpenClawCNConfig = {
  /** JSON Schema reference for editor autocomplete. */
  $schema?: string;
  meta?: {
    /** Last OpenClawCN version that wrote this config. */
    lastTouchedVersion?: string;
    /** ISO timestamp when this config was last written. */
    lastTouchedAt?: string;
    /** Performance tuning profile (economy / balanced / power). */
    performanceProfile?: "economy" | "balanced" | "power";
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
  /** Media attachment handling config. */
  media?: {
    preserveFilenames?: boolean;
  };
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
  stateStore?: StateStoreConfig;
  /** OpenClawCN 智能调度总开关。需显式设为 true 才启用，默认关闭。 */
  dispatch?: {
    /** 是否启用智能调度引擎（意图识别 + 复杂度评估 + 自动选模型）。默认 false。 */
    enabled?: boolean;
    /** 是否启用模态感知路由（根据图片/音频等附件自动选模型）。默认 true。 */
    modalityRouter?: boolean;
    /** 是否启用多 Agent 编排（复杂任务自动拆分并行执行）。默认 true。 */
    multiAgent?: boolean;
    /** 是否启用工具选择器（智能过滤 AI 可见工具）。默认 true。 */
    toolSelector?: boolean;
    /** 工具过滤模式。"off" = 不过滤；"intent" = 按意图过滤；"discovery" = 向量搜索过滤。 */
    toolFilterMode?: "off" | "intent" | "discovery";
  };
  /** 工具发现引擎配置（CN 二开：向量检索 MCP 工具，按需加载）。 */
  toolDiscovery?: ToolDiscoveryConfig;
  /** 模型能力配置：记录每个能力对应使用的模型 */
  modelCapability?: {
    capabilities?: Partial<
      Record<
        string,
        {
          providerId: string;
          modelId: string;
          /** true = 由 providerPriority 同步自动分配，拖拽时会覆盖；false/undefined = 用户手动选择，拖拽不覆盖 */
          auto?: boolean;
        }
      >
    >;
  };
  /** Provider 优先级排序（用于 fallback 顺序控制） */
  providerPriority?: string[];
  /** MCP (Model Context Protocol) 服务器配置。 */
  mcp?: {
    servers?: Array<{
      id: string;
      command: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
      transport: "stdio" | "sse";
      url?: string;
      headers?: Record<string, string>;
      version?: string;
      enabled: boolean;
      autoStart: boolean;
      timeout?: number;
    }>;
  };
  /** 许可证配置（由系统自动写入，请勿手动修改）。 */
  license?: LicenseConfig;
  /** 初始设置向导状态（由系统自动写入）。 */
  setup?: {
    completedAt?: string;
    lastCompletedStep?: number;
  };
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

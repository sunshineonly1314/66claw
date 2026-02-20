import os from "node:os";
import type { OpenClawCNConfig } from "./types.js";
import type { ModelDefinitionConfig } from "./types.models.js";
import { DEFAULT_CONTEXT_TOKENS } from "../agents/defaults.js";
import { parseModelRef } from "../agents/model-selection.js";
import { DEFAULT_AGENT_MAX_CONCURRENT, DEFAULT_SUBAGENT_MAX_CONCURRENT } from "./agent-limits.js";
import { resolveTalkApiKey } from "./talk.js";
import { detectChinaRegion, CN_DEFAULT_SECURITY_CONFIG } from "./region-cn.js";
import type { PerformanceProfile } from "./types.clawdbot.js";
import type { MCPServerConfig } from "../mcp/types.js";

type WarnState = { warned: boolean };

let defaultWarnState: WarnState = { warned: false };

type AnthropicAuthDefaultsMode = "api_key" | "oauth";

const DEFAULT_MODEL_ALIASES: Readonly<Record<string, string>> = {
  // Anthropic (pi-ai catalog uses "latest" ids without date suffix)
  opus: "anthropic/claude-opus-4-6",
  sonnet: "anthropic/claude-sonnet-4-5",

  // OpenAI
  gpt: "openai/gpt-5.2",
  "gpt-mini": "openai/gpt-5-mini",

  // Google Gemini (3.x are preview ids in the catalog)
  gemini: "google/gemini-3-pro-preview",
  "gemini-flash": "google/gemini-3-flash-preview",
};

const DEFAULT_MODEL_COST: ModelDefinitionConfig["cost"] = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};
const DEFAULT_MODEL_INPUT: ModelDefinitionConfig["input"] = ["text"];
const DEFAULT_MODEL_MAX_TOKENS = 8192;

type ModelDefinitionLike = Partial<ModelDefinitionConfig> &
  Pick<ModelDefinitionConfig, "id" | "name">;

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function resolveModelCost(
  raw?: Partial<ModelDefinitionConfig["cost"]>,
): ModelDefinitionConfig["cost"] {
  return {
    input: typeof raw?.input === "number" ? raw.input : DEFAULT_MODEL_COST.input,
    output: typeof raw?.output === "number" ? raw.output : DEFAULT_MODEL_COST.output,
    cacheRead: typeof raw?.cacheRead === "number" ? raw.cacheRead : DEFAULT_MODEL_COST.cacheRead,
    cacheWrite:
      typeof raw?.cacheWrite === "number" ? raw.cacheWrite : DEFAULT_MODEL_COST.cacheWrite,
  };
}

function resolveAnthropicDefaultAuthMode(cfg: OpenClawCNConfig): AnthropicAuthDefaultsMode | null {
  const profiles = cfg.auth?.profiles ?? {};
  const anthropicProfiles = Object.entries(profiles).filter(
    ([, profile]) => profile?.provider === "anthropic",
  );

  const order = cfg.auth?.order?.anthropic ?? [];
  for (const profileId of order) {
    const entry = profiles[profileId];
    if (!entry || entry.provider !== "anthropic") {
      continue;
    }
    if (entry.mode === "api_key") {
      return "api_key";
    }
    if (entry.mode === "oauth" || entry.mode === "token") {
      return "oauth";
    }
  }

  const hasApiKey = anthropicProfiles.some(([, profile]) => profile?.mode === "api_key");
  const hasOauth = anthropicProfiles.some(
    ([, profile]) => profile?.mode === "oauth" || profile?.mode === "token",
  );
  if (hasApiKey && !hasOauth) {
    return "api_key";
  }
  if (hasOauth && !hasApiKey) {
    return "oauth";
  }

  if (process.env.ANTHROPIC_OAUTH_TOKEN?.trim()) {
    return "oauth";
  }
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    return "api_key";
  }
  return null;
}

function resolvePrimaryModelRef(raw?: string): string | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const aliasKey = trimmed.toLowerCase();
  return DEFAULT_MODEL_ALIASES[aliasKey] ?? trimmed;
}

export type SessionDefaultsOptions = {
  warn?: (message: string) => void;
  warnState?: WarnState;
};

export function applyMessageDefaults(cfg: OpenClawCNConfig): OpenClawCNConfig {
  const messages = cfg.messages;
  const hasAckScope = messages?.ackReactionScope !== undefined;
  if (hasAckScope) {
    return cfg;
  }

  const nextMessages = messages ? { ...messages } : {};
  nextMessages.ackReactionScope = "group-mentions";
  return {
    ...cfg,
    messages: nextMessages,
  };
}

export function applySessionDefaults(
  cfg: OpenClawCNConfig,
  options: SessionDefaultsOptions = {},
): OpenClawCNConfig {
  const session = cfg.session;
  if (!session || session.mainKey === undefined) {
    return cfg;
  }

  const trimmed = session.mainKey.trim();
  const warn = options.warn ?? console.warn;
  const warnState = options.warnState ?? defaultWarnState;

  const next: OpenClawCNConfig = {
    ...cfg,
    session: { ...session, mainKey: "main" },
  };

  if (trimmed && trimmed !== "main" && !warnState.warned) {
    warnState.warned = true;
    warn('session.mainKey is ignored; main session is always "main".');
  }

  return next;
}

export function applyTalkApiKey(config: OpenClawCNConfig): OpenClawCNConfig {
  const resolved = resolveTalkApiKey();
  if (!resolved) {
    return config;
  }
  const existing = config.talk?.apiKey?.trim();
  if (existing) {
    return config;
  }
  return {
    ...config,
    talk: {
      ...config.talk,
      apiKey: resolved,
    },
  };
}

export function applyModelDefaults(cfg: OpenClawCNConfig): OpenClawCNConfig {
  let mutated = false;
  let nextCfg = cfg;

  const providerConfig = nextCfg.models?.providers;
  if (providerConfig) {
    const nextProviders = { ...providerConfig };
    for (const [providerId, provider] of Object.entries(providerConfig)) {
      const models = provider.models;
      if (!Array.isArray(models) || models.length === 0) {
        continue;
      }
      let providerMutated = false;
      const nextModels = models.map((model) => {
        const raw = model as ModelDefinitionLike;
        let modelMutated = false;

        const reasoning = typeof raw.reasoning === "boolean" ? raw.reasoning : false;
        if (raw.reasoning !== reasoning) {
          modelMutated = true;
        }

        const input = raw.input ?? [...DEFAULT_MODEL_INPUT];
        if (raw.input === undefined) {
          modelMutated = true;
        }

        const cost = resolveModelCost(raw.cost);
        const costMutated =
          !raw.cost ||
          raw.cost.input !== cost.input ||
          raw.cost.output !== cost.output ||
          raw.cost.cacheRead !== cost.cacheRead ||
          raw.cost.cacheWrite !== cost.cacheWrite;
        if (costMutated) {
          modelMutated = true;
        }

        const contextWindow = isPositiveNumber(raw.contextWindow)
          ? raw.contextWindow
          : DEFAULT_CONTEXT_TOKENS;
        if (raw.contextWindow !== contextWindow) {
          modelMutated = true;
        }

        const defaultMaxTokens = Math.min(DEFAULT_MODEL_MAX_TOKENS, contextWindow);
        const rawMaxTokens = isPositiveNumber(raw.maxTokens) ? raw.maxTokens : defaultMaxTokens;
        const maxTokens = Math.min(rawMaxTokens, contextWindow);
        if (raw.maxTokens !== maxTokens) {
          modelMutated = true;
        }

        if (!modelMutated) {
          return model;
        }
        providerMutated = true;
        return {
          ...raw,
          reasoning,
          input,
          cost,
          contextWindow,
          maxTokens,
        } as ModelDefinitionConfig;
      });

      if (!providerMutated) {
        continue;
      }
      nextProviders[providerId] = { ...provider, models: nextModels };
      mutated = true;
    }

    if (mutated) {
      nextCfg = {
        ...nextCfg,
        models: {
          ...nextCfg.models,
          providers: nextProviders,
        },
      };
    }
  }

  const existingAgent = nextCfg.agents?.defaults;
  if (!existingAgent) {
    return mutated ? nextCfg : cfg;
  }
  const existingModels = existingAgent.models ?? {};
  if (Object.keys(existingModels).length === 0) {
    return mutated ? nextCfg : cfg;
  }

  const nextModels: Record<string, { alias?: string }> = {
    ...existingModels,
  };

  for (const [alias, target] of Object.entries(DEFAULT_MODEL_ALIASES)) {
    const entry = nextModels[target];
    if (!entry) {
      continue;
    }
    if (entry.alias !== undefined) {
      continue;
    }
    nextModels[target] = { ...entry, alias };
    mutated = true;
  }

  if (!mutated) {
    return cfg;
  }

  return {
    ...nextCfg,
    agents: {
      ...nextCfg.agents,
      defaults: { ...existingAgent, models: nextModels },
    },
  };
}

export function applyAgentDefaults(cfg: OpenClawCNConfig): OpenClawCNConfig {
  const agents = cfg.agents;
  const defaults = agents?.defaults;
  const hasMax =
    typeof defaults?.maxConcurrent === "number" && Number.isFinite(defaults.maxConcurrent);
  const hasSubMax =
    typeof defaults?.subagents?.maxConcurrent === "number" &&
    Number.isFinite(defaults.subagents.maxConcurrent);
  if (hasMax && hasSubMax) {
    return cfg;
  }

  let mutated = false;
  const nextDefaults = defaults ? { ...defaults } : {};
  if (!hasMax) {
    nextDefaults.maxConcurrent = DEFAULT_AGENT_MAX_CONCURRENT;
    mutated = true;
  }

  const nextSubagents = defaults?.subagents ? { ...defaults.subagents } : {};
  if (!hasSubMax) {
    nextSubagents.maxConcurrent = DEFAULT_SUBAGENT_MAX_CONCURRENT;
    mutated = true;
  }

  if (!mutated) {
    return cfg;
  }

  return {
    ...cfg,
    agents: {
      ...agents,
      defaults: {
        ...nextDefaults,
        subagents: nextSubagents,
      },
    },
  };
}

export function applyLoggingDefaults(cfg: OpenClawCNConfig): OpenClawCNConfig {
  const logging = cfg.logging;
  if (!logging) {
    return cfg;
  }
  if (logging.redactSensitive) {
    return cfg;
  }
  return {
    ...cfg,
    logging: {
      ...logging,
      redactSensitive: "tools",
    },
  };
}

export function applyContextPruningDefaults(cfg: OpenClawCNConfig): OpenClawCNConfig {
  const defaults = cfg.agents?.defaults;
  if (!defaults) {
    return cfg;
  }

  const authMode = resolveAnthropicDefaultAuthMode(cfg);
  if (!authMode) {
    return cfg;
  }

  let mutated = false;
  const nextDefaults = { ...defaults };
  const contextPruning = defaults.contextPruning ?? {};
  const heartbeat = defaults.heartbeat ?? {};

  if (defaults.contextPruning?.mode === undefined) {
    nextDefaults.contextPruning = {
      ...contextPruning,
      mode: "cache-ttl",
      ttl: defaults.contextPruning?.ttl ?? "1h",
    };
    mutated = true;
  }

  if (defaults.heartbeat?.every === undefined) {
    nextDefaults.heartbeat = {
      ...heartbeat,
      every: authMode === "oauth" ? "1h" : "30m",
    };
    mutated = true;
  }

  if (authMode === "api_key") {
    const nextModels = defaults.models ? { ...defaults.models } : {};
    let modelsMutated = false;

    for (const [key, entry] of Object.entries(nextModels)) {
      const parsed = parseModelRef(key, "anthropic");
      if (!parsed || parsed.provider !== "anthropic") {
        continue;
      }
      const current = entry ?? {};
      const params = (current as { params?: Record<string, unknown> }).params ?? {};
      if (typeof params.cacheRetention === "string") {
        continue;
      }
      nextModels[key] = {
        ...(current as Record<string, unknown>),
        params: { ...params, cacheRetention: "short" },
      };
      modelsMutated = true;
    }

    const primary = resolvePrimaryModelRef(defaults.model?.primary ?? undefined);
    if (primary) {
      const parsedPrimary = parseModelRef(primary, "anthropic");
      if (parsedPrimary?.provider === "anthropic") {
        const key = `${parsedPrimary.provider}/${parsedPrimary.model}`;
        const entry = nextModels[key];
        const current = entry ?? {};
        const params = (current as { params?: Record<string, unknown> }).params ?? {};
        if (typeof params.cacheRetention !== "string") {
          nextModels[key] = {
            ...(current as Record<string, unknown>),
            params: { ...params, cacheRetention: "short" },
          };
          modelsMutated = true;
        }
      }
    }

    if (modelsMutated) {
      nextDefaults.models = nextModels;
      mutated = true;
    }
  }

  if (!mutated) {
    return cfg;
  }

  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: nextDefaults,
    },
  };
}

export function applyCompactionDefaults(cfg: OpenClawCNConfig): OpenClawCNConfig {
  const defaults = cfg.agents?.defaults;
  if (!defaults) {
    return cfg;
  }
  const compaction = defaults?.compaction;
  if (compaction?.mode) {
    return cfg;
  }

  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...defaults,
        compaction: {
          ...compaction,
          mode: "safeguard",
        },
      },
    },
  };
}

/**
 * CN 区域默认配置
 *
 * 仅当 detectChinaRegion() 为 true 时生效。
 * 只填充用户未显式设置的字段（fill-empty），绝不覆盖已有值。
 * 策略：最高权限 + 最大能力释放 + 省 token。
 */
export function applyCnDefaults(cfg: OpenClawCNConfig): OpenClawCNConfig {
  if (!detectChinaRegion()) return cfg;

  let mutated = false;
  let next = cfg;

  // ── 0. tools.exec.host: "gateway"（直接在宿主机执行，不走 Docker 沙箱）──
  if (next.tools?.exec?.host === undefined) {
    next = {
      ...next,
      tools: {
        ...next.tools,
        exec: {
          ...next.tools?.exec,
          host: "gateway",
        },
      },
    };
    mutated = true;
  }

  // ── 1. tools.exec.security: "full"（全权限模式，最大能力释放）──
  if (next.tools?.exec?.security === undefined) {
    next = {
      ...next,
      tools: {
        ...next.tools,
        exec: {
          ...next.tools?.exec,
          security: "full",
        },
      },
    };
    mutated = true;
  }

  // ── 2. tools.exec.ask: "off"（不询问，直接执行，最大效率）──
  if (next.tools?.exec?.ask === undefined) {
    next = {
      ...next,
      tools: {
        ...next.tools,
        exec: {
          ...next.tools?.exec,
          ask: "off",
        },
      },
    };
    mutated = true;
  }

  // ── 2b. tools.exec.safeBins: 预置常用命令白名单 ──
  if (next.tools?.exec?.safeBins === undefined) {
    next = {
      ...next,
      tools: {
        ...next.tools,
        exec: {
          ...next.tools?.exec,
          safeBins: [...CN_DEFAULT_SECURITY_CONFIG.tools.exec.allowlist],
        },
      },
    };
    mutated = true;
  }

  // ── 2c. tools.write.allowDelete: false（安全底线：禁止删除文件）──
  if (next.tools?.write?.allowDelete === undefined) {
    next = {
      ...next,
      tools: {
        ...next.tools,
        write: {
          ...next.tools?.write,
          allowDelete: CN_DEFAULT_SECURITY_CONFIG.tools.write.allowDelete,
        },
      },
    };
    mutated = true;
  }

  // ── 2d. tools.browser.profile: "openclawcn"（浏览器 profile 隔离，避免污染用户默认 profile）──
  if (next.tools?.browser?.profile === undefined) {
    next = {
      ...next,
      tools: {
        ...next.tools,
        browser: {
          ...next.tools?.browser,
          profile: CN_DEFAULT_SECURITY_CONFIG.tools.browser.profile,
        },
      },
    };
    mutated = true;
  }

  // ── 3. sandbox.mode: "off"（不使用沙箱，最大能力释放）──
  const existingSandbox = next.agents?.defaults?.sandbox;
  if (existingSandbox?.mode === undefined) {
    next = {
      ...next,
      agents: {
        ...next.agents,
        defaults: {
          ...next.agents?.defaults,
          sandbox: {
            ...existingSandbox,
            mode: CN_DEFAULT_SECURITY_CONFIG.sandbox.mode,
          },
        },
      },
    };
    mutated = true;
  }

  // ── 4. sandbox.scope: "agent"（按 agent 隔离，用户手动开启沙箱时生效）──
  const sandbox4 = next.agents?.defaults?.sandbox;
  if (sandbox4?.scope === undefined) {
    next = {
      ...next,
      agents: {
        ...next.agents,
        defaults: {
          ...next.agents?.defaults,
          sandbox: {
            ...sandbox4,
            scope: "agent",
          },
        },
      },
    };
    mutated = true;
  }

  // ── 5. sandbox.workspaceAccess: "rw" ──
  const sandbox5 = next.agents?.defaults?.sandbox;
  if (sandbox5?.workspaceAccess === undefined) {
    next = {
      ...next,
      agents: {
        ...next.agents,
        defaults: {
          ...next.agents?.defaults,
          sandbox: {
            ...sandbox5,
            workspaceAccess: "rw",
          },
        },
      },
    };
    mutated = true;
  }

  // ── 6. agents.defaults.timeoutSeconds: 1800（30 分钟，复杂任务不被截断，国内网络容错）──
  if (next.agents?.defaults?.timeoutSeconds === undefined) {
    next = {
      ...next,
      agents: {
        ...next.agents,
        defaults: {
          ...next.agents?.defaults,
          timeoutSeconds: 1800,
        },
      },
    };
    mutated = true;
  }

  // ── 7. sandbox.browser.allowHostControl: true（允许 AI 使用宿主浏览器）──
  const sandboxBrowser = next.agents?.defaults?.sandbox?.browser;
  if (sandboxBrowser?.allowHostControl === undefined) {
    next = {
      ...next,
      agents: {
        ...next.agents,
        defaults: {
          ...next.agents?.defaults,
          sandbox: {
            ...next.agents?.defaults?.sandbox,
            browser: {
              ...sandboxBrowser,
              allowHostControl: true,
            },
          },
        },
      },
    };
    mutated = true;
  }

  // ── 8. agents.defaults.thinkingDefault: "high"（默认深度推理，最强思考质量，不支持的模型自动忽略）──
  if (next.agents?.defaults?.thinkingDefault === undefined) {
    next = {
      ...next,
      agents: {
        ...next.agents,
        defaults: {
          ...next.agents?.defaults,
          thinkingDefault: "high",
        },
      },
    };
    mutated = true;
  }

  // ── 9. agents.defaults.blockStreamingDefault: "on"（IM 渠道分块输出，体验更好）──
  if (next.agents?.defaults?.blockStreamingDefault === undefined) {
    next = {
      ...next,
      agents: {
        ...next.agents,
        defaults: {
          ...next.agents?.defaults,
          blockStreamingDefault: "on",
        },
      },
    };
    mutated = true;
  }

  // ── 10. agents.defaults.blockStreamingBreak: "text_end"（文字段结束即发送）──
  if (next.agents?.defaults?.blockStreamingBreak === undefined) {
    next = {
      ...next,
      agents: {
        ...next.agents,
        defaults: {
          ...next.agents?.defaults,
          blockStreamingBreak: "text_end",
        },
      },
    };
    mutated = true;
  }

  // ── 11. agents.defaults.typingMode: "thinking"（AI 思考时显示打字状态）──
  if (next.agents?.defaults?.typingMode === undefined) {
    next = {
      ...next,
      agents: {
        ...next.agents,
        defaults: {
          ...next.agents?.defaults,
          typingMode: "thinking",
        },
      },
    };
    mutated = true;
  }

  // ── 12. agents.defaults.contextPruning ──
  //    上游 applyContextPruningDefaults 已在检测到 Anthropic auth 时注入 mode=cache-ttl + ttl=1h
  //    CN 不再额外覆盖 — 上游的默认值已经合理，无需强制缩短 TTL
  //    无 Anthropic auth 时也不应注入 contextPruning（cache-ttl 依赖 Anthropic prompt caching API）

  // ── 13. tools.web.search.provider: "bing"（中国区默认使用 Bing 搜索，香港/大陆均可访问，无需 API key）──
  if (next.tools?.web?.search?.provider === undefined) {
    next = {
      ...next,
      tools: {
        ...next.tools,
        web: {
          ...next.tools?.web,
          search: {
            ...next.tools?.web?.search,
            provider: "bing",
          },
        },
      },
    };
    mutated = true;
  }

  // ── 14. tools.web.fetch.firecrawl: 切换到 Jina Reader（r.jina.ai，国内可用，免费，无需 API key）──
  //        Firecrawl (api.firecrawl.dev) 国内不可访问，Jina Reader 是国产替代
  if (next.tools?.web?.fetch?.firecrawl?.baseUrl === undefined) {
    next = {
      ...next,
      tools: {
        ...next.tools,
        web: {
          ...next.tools?.web,
          fetch: {
            ...next.tools?.web?.fetch,
            firecrawl: {
              ...next.tools?.web?.fetch?.firecrawl,
              enabled: true,
              baseUrl: "https://r.jina.ai",
            },
          },
        },
      },
    };
    mutated = true;
  }

  // ── 15a. tools.web.fetch.timeoutSeconds: 60（国内网络延迟高，默认 30s 容易超时）──
  if (next.tools?.web?.fetch?.timeoutSeconds === undefined) {
    next = {
      ...next,
      tools: {
        ...next.tools,
        web: {
          ...next.tools?.web,
          fetch: {
            ...next.tools?.web?.fetch,
            timeoutSeconds: 60,
          },
        },
      },
    };
    mutated = true;
  }

  // ── 15b. tools.web.search.timeoutSeconds: 60（国内网络延迟高，默认 30s 容易超时）──
  if (next.tools?.web?.search?.timeoutSeconds === undefined) {
    next = {
      ...next,
      tools: {
        ...next.tools,
        web: {
          ...next.tools?.web,
          search: {
            ...next.tools?.web?.search,
            timeoutSeconds: 60,
          },
        },
      },
    };
    mutated = true;
  }

  // ── 16. mcp.servers: 预装 MCP 服务器（中国用户开箱即用）──
  //
  //   官方 MCP 服务器分两种运行时：
  //     Node.js (npx):  @modelcontextprotocol/server-filesystem, server-sequential-thinking
  //     Python  (uvx):  mcp-server-sqlite, mcp-server-fetch, mcp-server-time
  //
  //   npx 服务器: env.npm_config_registry → npmmirror.com（否则被墙）
  //   uvx 服务器: env.UV_INDEX_URL → 清华 PyPI 镜像（否则被墙）
  //              autoStart: false — Windows 安装版不含 uvx，用户需先安装 uv
  //   timeout → 60s（国内网络延迟高，30s 默认值容易超时）
  //
  //   升级兼容：按 id 合并缺失的服务器（不覆盖用户已有配置）
  {
    const cnNpxEnv = { npm_config_registry: "https://registry.npmmirror.com" };
    const cnUvxEnv = { UV_INDEX_URL: "https://pypi.tuna.tsinghua.edu.cn/simple" };
    const cnMcpTimeout = 60_000;
    const cnDefaultMcpServers = [
      // ── Node.js MCP 服务器（npx，自动启动）──
      {
        id: "filesystem",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", os.homedir()],
        transport: "stdio" as const,
        enabled: true,
        autoStart: true,
        env: cnNpxEnv,
        timeout: cnMcpTimeout,
      },
      {
        id: "thinking",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
        transport: "stdio" as const,
        enabled: true,
        autoStart: true,
        env: cnNpxEnv,
        timeout: cnMcpTimeout,
      },
      // ── Python MCP 服务器（uvx，需用户安装 uv 后手动启用）──
      {
        id: "sqlite",
        command: "uvx",
        args: ["mcp-server-sqlite"],
        transport: "stdio" as const,
        enabled: true,
        autoStart: false,
        env: cnUvxEnv,
        timeout: cnMcpTimeout,
      },
      {
        id: "fetch",
        command: "uvx",
        args: ["mcp-server-fetch"],
        transport: "stdio" as const,
        enabled: true,
        autoStart: false,
        env: cnUvxEnv,
        timeout: cnMcpTimeout,
      },
      {
        id: "time",
        command: "uvx",
        args: ["mcp-server-time"],
        transport: "stdio" as const,
        enabled: true,
        autoStart: false,
        env: cnUvxEnv,
        timeout: cnMcpTimeout,
      },
    ];

    if (next.mcp?.servers === undefined) {
      // 全新安装：注入所有默认服务器
      next = { ...next, mcp: { ...next.mcp, servers: cnDefaultMcpServers } };
      mutated = true;
    } else if (Array.isArray(next.mcp.servers)) {
      // 升级：按 id 合并缺失的服务器（用户已有的不覆盖）
      const existingIds = new Set(
        (next.mcp.servers as Array<{ id?: string }>).map((s) => s.id).filter(Boolean),
      );
      const missing = cnDefaultMcpServers.filter((s) => !existingIds.has(s.id));
      if (missing.length > 0) {
        next = {
          ...next,
          mcp: { ...next.mcp, servers: [...(next.mcp.servers as MCPServerConfig[]), ...missing] },
        };
        mutated = true;
      }
    }
  }

  // ── [CN-PATCH:memory-p0] 17. agents.defaults.memorySearch.sources: ["memory", "sessions"] ──
  //    开启会话记忆搜索，让 AI 能搜索历史对话，不再"失忆"
  //    上游默认 ["memory"]，CN 默认 ["memory", "sessions"]
  {
    const existingMemorySearch = next.agents?.defaults?.memorySearch;
    if (existingMemorySearch?.sources === undefined) {
      next = {
        ...next,
        agents: {
          ...next.agents,
          defaults: {
            ...next.agents?.defaults,
            memorySearch: {
              ...existingMemorySearch,
              sources: ["memory", "sessions"],
            },
          },
        },
      };
      mutated = true;
    }
  }

  // ── [CN-PATCH:memory-p0] 18. agents.defaults.memorySearch.experimental.sessionMemory: true ──
  //    启用会话转录索引，normalizeSources() 才会接受 "sessions" 源
  //    上游默认 false，CN 默认 true
  {
    const memSearch18 = next.agents?.defaults?.memorySearch;
    if (memSearch18?.experimental?.sessionMemory === undefined) {
      next = {
        ...next,
        agents: {
          ...next.agents,
          defaults: {
            ...next.agents?.defaults,
            memorySearch: {
              ...memSearch18,
              experimental: {
                ...memSearch18?.experimental,
                sessionMemory: true,
              },
            },
          },
        },
      };
      mutated = true;
    }
  }

  // ── [CN-PATCH:memory-p0] 18.5. agents.defaults.memorySearch: SiliconFlow embedding ──
  //    CN 区域默认用硅基流动做 embedding（BAAI/bge-m3, 免费额度）
  //    provider 设为 "openai"（SiliconFlow 兼容 OpenAI /v1/embeddings API）
  //    remote.baseUrl + remote.apiKey 直接指向 SiliconFlow，不依赖 auth store
  //    fallback 设为 "none"，避免无 key 时依次尝试 openai/gemini/voyage 报错
  {
    const memSearch185 = next.agents?.defaults?.memorySearch;
    if (memSearch185?.provider === undefined) {
      next = {
        ...next,
        agents: {
          ...next.agents,
          defaults: {
            ...next.agents?.defaults,
            memorySearch: {
              ...memSearch185,
              provider: "openai",
              model: "BAAI/bge-m3",
              remote: {
                ...memSearch185?.remote,
                baseUrl: "https://api.siliconflow.cn/v1",
                apiKey: "sk-bdlrjsxfgryopcpjvqbuyygzchkisgzwqucnbdkzurzueukv",
                batch: { enabled: false },
              },
              fallback: "none",
            },
          },
        },
      };
      mutated = true;
    }
  }

  // ── [CN-PATCH:memory-p0] 19. session.maintenance: 120天保留 + 5000条上限 ──
  //    上游默认 30天/500条，CN 用户需要更长的记忆保留
  //    不会触发全量 embedding — needsFullReindex 不检查 sources 和 maintenance 配置
  //    pruneAfter 和 maxEntries 独立检查，避免用户只设其中一个时另一个无 CN 默认值
  //    守卫：仅当 session 对象已存在时才注入，避免凭空创建 session 对象
  if (next.session !== undefined) {
    const existingMaintenance = next.session?.maintenance;
    const needsPruneAfter = existingMaintenance?.pruneAfter === undefined;
    const needsMaxEntries = existingMaintenance?.maxEntries === undefined;
    if (needsPruneAfter || needsMaxEntries) {
      next = {
        ...next,
        session: {
          ...next.session,
          maintenance: {
            ...existingMaintenance,
            ...(needsPruneAfter ? { pruneAfter: "120d" } : {}),
            ...(needsMaxEntries ? { maxEntries: 5000 } : {}),
          },
        },
      };
      mutated = true;
    }
  }

  // ── [CN-PATCH:tool-discovery] 20. toolDiscovery: 智能工具发现默认配置 ──
  //    CN 区域默认启用 FTS5 BM25 搜索，配了 SiliconFlow key 后自动升级为混合搜索
  //    embedding 与聊天 memorySearch 完全隔离，互不影响
  if (next.toolDiscovery === undefined) {
    next = {
      ...next,
      toolDiscovery: {
        enabled: true,
        embedding: {
          model: "BAAI/bge-m3",
          baseUrl: "https://api.siliconflow.cn/v1",
          apiKey: "sk-bdlrjsxfgryopcpjvqbuyygzchkisgzwqucnbdkzurzueukv",
          dimensions: 1024,
        },
        search: { maxResults: 8, minScore: 0.2 },
        mcpOnDemand: { enabled: true, autoInstall: false },
      },
    };
    mutated = true;
  }

  // ── [CN-PATCH:dispatch] 20.5. dispatch: 智能调度引擎默认启用 ──
  //    CN 区域默认启用 dispatch（意图识别 + 工具推荐 + 复杂度评估）
  //    toolDiscovery 需要 dispatch.enabled=true 才能在聊天流程中被调用
  if (next.dispatch === undefined) {
    next = {
      ...next,
      dispatch: {
        enabled: true,
        modalityRouter: true,
        toolSelector: true,
        toolFilterMode: "discovery" as const,
      },
    };
    mutated = true;
  }

  // ── [CN-PATCH:power] 21. compaction.proactiveCompaction: 主动压缩上下文 ──
  //    对话过长时自动压缩，防止上下文溢出被截断
  //    上游默认 enabled=true，但 thresholdRatio 未设；CN 设为 0.85（85% 即触发）
  {
    const existingCompaction = next.agents?.defaults?.compaction;
    const existingProactive = existingCompaction?.proactiveCompaction;
    if (existingProactive?.enabled === undefined) {
      next = {
        ...next,
        agents: {
          ...next.agents,
          defaults: {
            ...next.agents?.defaults,
            compaction: {
              ...existingCompaction,
              proactiveCompaction: {
                ...existingProactive,
                enabled: true,
                ...(existingProactive?.thresholdRatio === undefined
                  ? { thresholdRatio: 0.85 }
                  : {}),
              },
            },
          },
        },
      };
      mutated = true;
    }
  }

  // ── [CN-PATCH:skills] 21.5. skills.allowBundled: 只加载核心技能，省 token ──
  //    70+ 技能全量注入 system prompt 会消耗数千 token，
  //    对 32K/64K 上下文窗口的模型极易触发每条消息都 compact。
  //    仅保留上游核心 + CN 高价值技能（~30 个），其余不加载。
  if (next.skills?.allowBundled === undefined) {
    next = {
      ...next,
      skills: {
        ...next.skills,
        allowBundled: [
          // ── 上游核心技能 ──
          "coding-agent",
          "canvas",
          "github",
          "summarize",
          "weather",
          "skill-creator",
          "session-logs",
          "model-usage",
          "oracle",
          "nano-pdf",
          "nano-banana-pro",
          "tmux",
          "slack",
          "discord",
          "notion",
          "obsidian",
          "trello",
          "himalaya",
          "video-frames",
          "voice-call",
          "gemini",
          "openai-image-gen",
          "openai-whisper-api",
          // ── CN 高价值技能 ──
          // wechat-desktop / wecom-desktop 已移入 skills-private/，不走 bundled 分发
          "wechat-cs",
          "xiaohongshu",
          "desktop-control",
          "open-app",
          "software-protection",
          "build-packaging",
          "packaging",
          "skills-troubleshoot",
          "self-troubleshoot",
        ],
      },
    };
    mutated = true;
  }

  // ── [CN-PATCH:memory-p1] 22. compaction.memoryFlush: SiliconFlow Qwen3-8B + V3 prompt ──
  //    CN 区域 memory flush 使用免费小模型（Qwen3-8B），不走主模型
  //    避免 flush 卡住拖垮 gateway（qwen-plus 曾超时 231 秒导致崩溃）
  //    V3 BALANCED prompt：提取事实/决策/偏好/结果，禁止猜测，信噪比高
  //    守卫：仅当 memoryFlush.provider 未设置时注入
  {
    const existingFlush = next.agents?.defaults?.compaction?.memoryFlush;
    if (existingFlush?.provider === undefined) {
      next = {
        ...next,
        agents: {
          ...next.agents,
          defaults: {
            ...next.agents?.defaults,
            compaction: {
              ...next.agents?.defaults?.compaction,
              memoryFlush: {
                ...existingFlush,
                provider: "siliconflow",
                model: "Qwen/Qwen3-8B",
                systemPrompt: [
                  "你是一个记忆提取器。从对话中提取值得长期保存的信息。",
                  "",
                  "提取目标：",
                  "- 用户明确做出的决策和选择",
                  "- 操作的关键结果（成功/失败及原因）",
                  "- 用户明确表达的偏好，或通过重复行为（≥2次）体现的偏好",
                  "- 重要的技术细节（配置、路径、参数等）",
                  "- 未完成的待办事项",
                  "",
                  "禁止：",
                  '- 凭单次行为猜测意图（不写"用户可能..."、"似乎..."、"看起来..."）',
                  "- 记录寒暄、问候、闲聊",
                  '- 记录显而易见的事情（如"用户发送了消息"）',
                  "",
                  "格式：每行 `- [类别] 内容`",
                  "类别：[fact] [decision] [preference] [todo] [outcome]",
                  "最多12条，宁缺毋滥。无内容则回复 NO_REPLY",
                ].join("\n"),
              },
            },
          },
        },
      };
      mutated = true;
    }
  }

  return mutated ? next : cfg;
}

/**
 * 性能档位预设参数表
 *
 * 三档影响的字段：
 * - thinkingDefault: 思考深度（AI 推理质量）
 * - contextPruning.ttl: 上下文缓存保留时长
 * - maxConcurrent: 最大并发 agent 数
 * - heartbeat.every: 心跳间隔
 */
const PERFORMANCE_PRESETS: Record<
  PerformanceProfile,
  {
    thinkingDefault: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
    contextPruningTtl: string;
    maxConcurrent: number;
    heartbeatEvery: string;
  }
> = {
  economy: {
    thinkingDefault: "low",
    contextPruningTtl: "10m",
    maxConcurrent: 2,
    heartbeatEvery: "1h",
  },
  balanced: {
    thinkingDefault: "medium",
    contextPruningTtl: "1h",
    maxConcurrent: 4,
    heartbeatEvery: "30m",
  },
  power: {
    thinkingDefault: "high",
    contextPruningTtl: "2h",
    maxConcurrent: 6,
    heartbeatEvery: "10m",
  },
};

/**
 * 应用性能档位到配置（显式覆盖，非 fill-empty）
 *
 * 切换档位时必须覆盖已有值，不能用 fill-empty 策略。
 * 同时将 meta.performanceProfile 记录当前档位。
 */
export function applyPerformanceProfile(
  cfg: OpenClawCNConfig,
  profile: PerformanceProfile,
): OpenClawCNConfig {
  const preset = PERFORMANCE_PRESETS[profile];
  return {
    ...cfg,
    meta: {
      ...cfg.meta,
      performanceProfile: profile,
    },
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        thinkingDefault: preset.thinkingDefault,
        maxConcurrent: preset.maxConcurrent,
        contextPruning: {
          ...cfg.agents?.defaults?.contextPruning,
          ttl: preset.contextPruningTtl,
        },
        heartbeat: {
          ...cfg.agents?.defaults?.heartbeat,
          every: preset.heartbeatEvery,
        },
      },
    },
  };
}

export function resetSessionDefaultsWarningForTests() {
  defaultWarnState = { warned: false };
}

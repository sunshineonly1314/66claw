import type { Api, Model } from "@mariozechner/pi-ai";
import { discoverAuthStorage, discoverModels } from "@mariozechner/pi-coding-agent";

import type { ClawdbotConfig } from "../../config/config.js";
import type { ModelDefinitionConfig } from "../../config/types.js";
import { resolveClawdbotAgentDir } from "../agent-paths.js";
import { DEFAULT_CONTEXT_TOKENS } from "../defaults.js";
import { normalizeModelCompat } from "../model-compat.js";
import { normalizeProviderId } from "../model-selection.js";

type InlineModelEntry = ModelDefinitionConfig & { provider: string; baseUrl?: string };
type InlineProviderConfig = {
  baseUrl?: string;
  api?: ModelDefinitionConfig["api"];
  models?: ModelDefinitionConfig[];
};

/** 火山引擎豆包内置 provider，用于配置中未显式写 models.providers["volcengine-ark"] 时仍能解析 volcengine-ark/doubao-seed-* */
const VOLCENGINE_ARK_BUILTIN: InlineProviderConfig = {
  baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
  api: "openai-completions",
  models: [
    {
      id: "doubao-seed-1-8-251228",
      name: "豆包 1.8",
      contextWindow: 256000,
      maxTokens: 32768,
      cost: { input: 0.004, output: 0.016, cacheRead: 0, cacheWrite: 0 },
      input: ["text", "image", "video"],
      reasoning: true,
    },
    {
      id: "doubao-seed-1-6-251015",
      name: "豆包 1.6",
      contextWindow: 256000,
      maxTokens: 32768,
      cost: { input: 0.008, output: 0.02, cacheRead: 0, cacheWrite: 0 },
      input: ["text", "image", "video"],
      reasoning: true,
    },
  ],
};

export function buildInlineProviderModels(
  providers: Record<string, InlineProviderConfig>,
): InlineModelEntry[] {
  return Object.entries(providers).flatMap(([providerId, entry]) => {
    const trimmed = providerId.trim();
    if (!trimmed) return [];
    return (entry?.models ?? []).map((model) => ({
      ...model,
      provider: trimmed,
      baseUrl: entry?.baseUrl,       // 继承 provider 级别的 baseUrl
      api: model.api ?? entry?.api,  // 继承 provider 级别的 api（模型优先）
    }));
  });
}

export function buildModelAliasLines(cfg?: ClawdbotConfig) {
  const models = cfg?.agents?.defaults?.models ?? {};
  const entries: Array<{ alias: string; model: string }> = [];
  for (const [keyRaw, entryRaw] of Object.entries(models)) {
    const model = String(keyRaw ?? "").trim();
    if (!model) continue;
    const alias = String((entryRaw as { alias?: string } | undefined)?.alias ?? "").trim();
    if (!alias) continue;
    entries.push({ alias, model });
  }
  return entries
    .sort((a, b) => a.alias.localeCompare(b.alias))
    .map((entry) => `- ${entry.alias}: ${entry.model}`);
}

export function resolveModel(
  provider: string,
  modelId: string,
  agentDir?: string,
  cfg?: ClawdbotConfig,
): {
  model?: Model<Api>;
  error?: string;
  authStorage: ReturnType<typeof discoverAuthStorage>;
  modelRegistry: ReturnType<typeof discoverModels>;
} {
  const resolvedAgentDir = agentDir ?? resolveClawdbotAgentDir();
  const authStorage = discoverAuthStorage(resolvedAgentDir);
  const modelRegistry = discoverModels(authStorage, resolvedAgentDir);
  const model = modelRegistry.find(provider, modelId) as Model<Api> | null;
  if (!model) {
    const providers = cfg?.models?.providers ?? {};
    const inlineModels = buildInlineProviderModels(providers);
    const normalizedProvider = normalizeProviderId(provider);
    const inlineMatch = inlineModels.find(
      (entry) => normalizeProviderId(entry.provider) === normalizedProvider && entry.id === modelId,
    );
    if (inlineMatch) {
      const normalized = normalizeModelCompat(inlineMatch as Model<Api>);
      return {
        model: normalized,
        authStorage,
        modelRegistry,
      };
    }
    
    // 优先使用配置中的 provider，如果没有则使用内置的后备配置
    let providerCfg = providers[provider] as InlineProviderConfig | undefined;
    
    // 对 volcengine-ark，即使没有在 config 中配置也提供内置支持
    // 这样可以避免 "Unknown model: volcengine-ark/..." 错误
    // API key 会在实际调用时通过认证系统处理
    if (!providerCfg) {
      // 检查所有可能的 provider 别名
      const normalizedProviderKey = Object.keys(providers).find(
        (key) => normalizeProviderId(key) === normalizedProvider
      );
      if (normalizedProviderKey) {
        providerCfg = providers[normalizedProviderKey] as InlineProviderConfig | undefined;
      }
    }
    
    // volcengine-ark 的内置后备配置
    if (!providerCfg && (provider === "volcengine-ark" || normalizedProvider === "volcengine-ark")) {
      providerCfg = VOLCENGINE_ARK_BUILTIN;
    }
    
    if (providerCfg || modelId.startsWith("mock-")) {
      const modelEntry = providerCfg?.models?.find((m) => m.id === modelId);
      const fallbackModel: Model<Api> = normalizeModelCompat({
        id: modelId,
        name: modelEntry?.name ?? modelId,
        api: providerCfg?.api ?? "openai-responses",
        provider,
        baseUrl: providerCfg?.baseUrl,
        reasoning: (modelEntry as { reasoning?: boolean } | undefined)?.reasoning ?? false,
        input: (modelEntry as { input?: string[] } | undefined)?.input ?? ["text"],
        cost:
          (modelEntry as ModelDefinitionConfig | undefined)?.cost ?? {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
          },
        contextWindow: modelEntry?.contextWindow ?? providerCfg?.models?.[0]?.contextWindow ?? DEFAULT_CONTEXT_TOKENS,
        maxTokens: modelEntry?.maxTokens ?? providerCfg?.models?.[0]?.maxTokens ?? DEFAULT_CONTEXT_TOKENS,
      } as Model<Api>);
      return { model: fallbackModel, authStorage, modelRegistry };
    }
    return {
      error: `Unknown model: ${provider}/${modelId}`,
      authStorage,
      modelRegistry,
    };
  }
  return { model: normalizeModelCompat(model), authStorage, modelRegistry };
}

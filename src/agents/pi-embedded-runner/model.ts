import type { Api, Model } from "@mariozechner/pi-ai";
import type { OpenClawCNConfig } from "../../config/config.js";
import type { ModelDefinitionConfig } from "../../config/types.js";
import { resolveOpenClawCNAgentDir } from "../agent-paths.js";
import { DEFAULT_CONTEXT_TOKENS } from "../defaults.js";
import { normalizeModelCompat } from "../model-compat.js";
import { resolveForwardCompatModel } from "../model-forward-compat.js";
import { normalizeProviderId } from "../model-selection.js";
import {
  discoverAuthStorage,
  discoverModels,
  type AuthStorage,
  type ModelRegistry,
} from "../pi-model-discovery.js";

type InlineModelEntry = ModelDefinitionConfig & { provider: string; baseUrl?: string };
type InlineProviderConfig = {
  baseUrl?: string;
  api?: ModelDefinitionConfig["api"];
  models?: ModelDefinitionConfig[];
};

export function buildInlineProviderModels(
  providers: Record<string, InlineProviderConfig>,
): InlineModelEntry[] {
  return Object.entries(providers).flatMap(([providerId, entry]) => {
    const trimmed = providerId.trim();
    if (!trimmed) {
      return [];
    }
    return (entry?.models ?? []).map((model) => ({
      ...model,
      provider: trimmed,
      baseUrl: entry?.baseUrl,
      api: model.api ?? entry?.api ?? "openai-completions",
    }));
  });
}

export function buildModelAliasLines(cfg?: OpenClawCNConfig) {
  const models = cfg?.agents?.defaults?.models ?? {};
  const entries: Array<{ alias: string; model: string }> = [];
  for (const [keyRaw, entryRaw] of Object.entries(models)) {
    const model = String(keyRaw ?? "").trim();
    if (!model) {
      continue;
    }
    const alias = String((entryRaw as { alias?: string } | undefined)?.alias ?? "").trim();
    if (!alias) {
      continue;
    }
    entries.push({ alias, model });
  }
  return entries
    .toSorted((a, b) => a.alias.localeCompare(b.alias))
    .map((entry) => `- ${entry.alias}: ${entry.model}`);
}

export function resolveModel(
  provider: string,
  modelId: string,
  agentDir?: string,
  cfg?: OpenClawCNConfig,
): {
  model?: Model<Api>;
  error?: string;
  authStorage: AuthStorage;
  modelRegistry: ModelRegistry;
} {
  const resolvedAgentDir = agentDir ?? resolveOpenClawCNAgentDir();
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
      // [CN-PATCH:api-guard] Defensive: ensure api is never undefined after resolution
      if (!normalized.api) {
        (normalized as { api: unknown }).api = inlineMatch.api ?? "openai-completions";
      }
      return {
        model: normalized,
        authStorage,
        modelRegistry,
      };
    }
    // Forward-compat fallbacks must be checked BEFORE the generic providerCfg fallback.
    // Otherwise, configured providers can default to a generic API and break specific transports.
    const forwardCompat = resolveForwardCompatModel(provider, modelId, modelRegistry);
    if (forwardCompat) {
      // [CN-PATCH:api-guard] Defensive: future forwardCompat functions may omit api
      if (!forwardCompat.api) {
        (forwardCompat as { api: unknown }).api = "openai-completions";
      }
      return { model: forwardCompat, authStorage, modelRegistry };
    }
    const providerCfg = providers[provider];
    if (providerCfg || modelId.startsWith("mock-")) {
      // [CN-PATCH:api-guard] providerCfg.api can be undefined when config only has baseUrl
      // (e.g. qwen-dashscope). Default to "openai-completions" — the /chat/completions
      // endpoint is universally supported; "openai-responses" (/responses) is OpenAI-only.
      const resolvedApi = providerCfg?.api ?? "openai-completions";
      // [CN-PATCH:model-fields] Find matching model definition to carry over
      // fields like headers and compat that are critical for providers like kimi-coding.
      const matchingModelDef =
        providerCfg?.models?.find((m: { id?: string }) => m.id === modelId) ??
        providerCfg?.models?.[0];
      const fallbackModel: Model<Api> = normalizeModelCompat({
        id: modelId,
        name: modelId,
        api: resolvedApi,
        provider,
        baseUrl: providerCfg?.baseUrl,
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: matchingModelDef?.contextWindow ?? DEFAULT_CONTEXT_TOKENS,
        maxTokens: matchingModelDef?.maxTokens ?? DEFAULT_CONTEXT_TOKENS,
        ...(matchingModelDef?.headers ? { headers: matchingModelDef.headers } : {}),
        ...(matchingModelDef?.compat ? { compat: matchingModelDef.compat } : {}),
      } as Model<Api>);
      // [CN-PATCH:api-guard] Defensive: ensure api is never undefined after resolution
      if (!fallbackModel.api) {
        (fallbackModel as { api: unknown }).api = resolvedApi;
      }
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

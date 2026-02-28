import { type OpenClawCNConfig, loadConfig } from "../config/config.js";
import { resolveOpenClawCNAgentDir } from "./agent-paths.js";
import { ensureOpenClawCNModelsJson } from "./models-config.js";

export type ModelCatalogEntry = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: Array<"text" | "image">;
};

type DiscoveredModel = {
  id: string;
  name?: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: Array<"text" | "image">;
};

type PiSdkModule = typeof import("./pi-model-discovery.js");

let modelCatalogPromise: Promise<ModelCatalogEntry[]> | null = null;
let hasLoggedModelCatalogError = false;
const defaultImportPiSdk = () => import("./pi-model-discovery.js");
let importPiSdk = defaultImportPiSdk;

const CODEX_PROVIDER = "openai-codex";
const OPENAI_CODEX_GPT53_MODEL_ID = "gpt-5.3-codex";
const OPENAI_CODEX_GPT53_SPARK_MODEL_ID = "gpt-5.3-codex-spark";

function applyOpenAICodexSparkFallback(models: ModelCatalogEntry[]): void {
  const hasSpark = models.some(
    (entry) =>
      entry.provider === CODEX_PROVIDER &&
      entry.id.toLowerCase() === OPENAI_CODEX_GPT53_SPARK_MODEL_ID,
  );
  if (hasSpark) {
    return;
  }

  const baseModel = models.find(
    (entry) =>
      entry.provider === CODEX_PROVIDER && entry.id.toLowerCase() === OPENAI_CODEX_GPT53_MODEL_ID,
  );
  if (!baseModel) {
    return;
  }

  models.push({
    ...baseModel,
    id: OPENAI_CODEX_GPT53_SPARK_MODEL_ID,
    name: OPENAI_CODEX_GPT53_SPARK_MODEL_ID,
  });
}

export function resetModelCatalogCacheForTest() {
  modelCatalogPromise = null;
  hasLoggedModelCatalogError = false;
  importPiSdk = defaultImportPiSdk;
}

// Test-only escape hatch: allow mocking the dynamic import to simulate transient failures.
export function __setModelCatalogImportForTest(loader?: () => Promise<PiSdkModule>) {
  importPiSdk = loader ?? defaultImportPiSdk;
}

export async function loadModelCatalog(params?: {
  config?: OpenClawCNConfig;
  useCache?: boolean;
}): Promise<ModelCatalogEntry[]> {
  if (params?.useCache === false) {
    modelCatalogPromise = null;
  }
  if (modelCatalogPromise) {
    return modelCatalogPromise;
  }

  modelCatalogPromise = (async () => {
    const models: ModelCatalogEntry[] = [];
    const sortModels = (entries: ModelCatalogEntry[]) =>
      entries.sort((a, b) => {
        const p = a.provider.localeCompare(b.provider);
        if (p !== 0) {
          return p;
        }
        return a.name.localeCompare(b.name);
      });
    try {
      const cfg = params?.config ?? loadConfig();
      await ensureOpenClawCNModelsJson(cfg);
      await (
        await import("./pi-auth-json.js")
      ).ensurePiAuthJsonFromAuthProfiles(resolveOpenClawCNAgentDir());
      // IMPORTANT: keep the dynamic import *inside* the try/catch.
      // If this fails once (e.g. during a pnpm install that temporarily swaps node_modules),
      // we must not poison the cache with a rejected promise (otherwise all channel handlers
      // will keep failing until restart).
      const piSdk = await importPiSdk();
      const agentDir = resolveOpenClawCNAgentDir();
      const { join } = await import("node:path");
      const authStorage = new piSdk.AuthStorage(join(agentDir, "auth.json"));
      const registry = new piSdk.ModelRegistry(authStorage, join(agentDir, "models.json")) as
        | {
            getAll: () => Array<DiscoveredModel>;
          }
        | Array<DiscoveredModel>;
      const entries = Array.isArray(registry) ? registry : registry.getAll();
      for (const entry of entries) {
        const id = String(entry?.id ?? "").trim();
        if (!id) {
          continue;
        }
        const provider = String(entry?.provider ?? "").trim();
        if (!provider) {
          continue;
        }
        const name = String(entry?.name ?? id).trim() || id;
        const contextWindow =
          typeof entry?.contextWindow === "number" && entry.contextWindow > 0
            ? entry.contextWindow
            : undefined;
        const reasoning = typeof entry?.reasoning === "boolean" ? entry.reasoning : undefined;
        const input = Array.isArray(entry?.input) ? entry.input : undefined;
        models.push({ id, name, provider, contextWindow, reasoning, input });
      }
      applyOpenAICodexSparkFallback(models);

      // [CN-PATCH:models-json-fallback] The PI SDK's ModelRegistry may not return
      // non-chat models (image-generation, image-editing) because its schema
      // validation is designed for coding-agent chat models. Read models.json
      // directly and merge any models that the registry missed, so that modality
      // capability checks (e.g. supportsImageGeneration) can find them.
      try {
        const fs = await import("node:fs");
        const modelsJsonPath = join(agentDir, "models.json");
        const raw = fs.readFileSync(modelsJsonPath, "utf8");
        const parsed = JSON.parse(raw) as {
          providers?: Record<
            string,
            {
              models?: Array<{
                id?: string;
                name?: string;
                input?: string[];
                contextWindow?: number;
                reasoning?: boolean;
              }>;
            }
          >;
        };
        if (parsed?.providers) {
          const seenIds = new Set(models.map((m) => `${m.provider}/${m.id}`.toLowerCase()));
          for (const [providerKey, providerCfg] of Object.entries(parsed.providers)) {
            if (!Array.isArray(providerCfg?.models)) continue;
            for (const modelDef of providerCfg.models) {
              const mid = String(modelDef?.id ?? "").trim();
              if (!mid) continue;
              const compositeKey = `${providerKey}/${mid}`.toLowerCase();
              if (seenIds.has(compositeKey)) continue;
              seenIds.add(compositeKey);
              models.push({
                id: mid,
                name: String(modelDef.name ?? mid).trim() || mid,
                provider: providerKey,
                contextWindow:
                  typeof modelDef.contextWindow === "number" && modelDef.contextWindow > 0
                    ? modelDef.contextWindow
                    : undefined,
                reasoning: typeof modelDef.reasoning === "boolean" ? modelDef.reasoning : undefined,
                input: Array.isArray(modelDef.input)
                  ? (modelDef.input.filter((v: string) => v === "text" || v === "image") as Array<
                      "text" | "image"
                    >)
                  : undefined,
              });
            }
          }
        }
      } catch {
        // models.json missing or unreadable — proceed with registry results
      }

      if (models.length === 0) {
        // If we found nothing, don't cache this result so we can try again.
        modelCatalogPromise = null;
      }

      return sortModels(models);
    } catch (error) {
      if (!hasLoggedModelCatalogError) {
        hasLoggedModelCatalogError = true;
        console.warn(`[model-catalog] Failed to load model catalog: ${String(error)}`);
      }
      // Don't poison the cache on transient dependency/filesystem issues.
      modelCatalogPromise = null;
      if (models.length > 0) {
        return sortModels(models);
      }
      return [];
    }
  })();

  return modelCatalogPromise;
}

/**
 * Check if a model supports image input based on its catalog entry.
 */
export function modelSupportsVision(entry: ModelCatalogEntry | undefined): boolean {
  return entry?.input?.includes("image") ?? false;
}

/**
 * Find a model in the catalog by provider and model ID.
 */
export function findModelInCatalog(
  catalog: ModelCatalogEntry[],
  provider: string,
  modelId: string,
): ModelCatalogEntry | undefined {
  const normalizedProvider = provider.toLowerCase().trim();
  const normalizedModelId = modelId.toLowerCase().trim();
  return catalog.find(
    (entry) =>
      entry.provider.toLowerCase() === normalizedProvider &&
      entry.id.toLowerCase() === normalizedModelId,
  );
}

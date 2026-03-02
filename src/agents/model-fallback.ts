import type { OpenClawCNConfig } from "../config/config.js";
import type { FailoverReason } from "./pi-embedded-helpers.js";
import {
  ensureAuthProfileStore,
  isProfileInCooldown,
  resolveAuthProfileOrder,
} from "./auth-profiles.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "./defaults.js";
import {
  coerceToFailoverError,
  describeFailoverError,
  isFailoverError,
  isTimeoutError,
} from "./failover-error.js";
import {
  buildConfiguredAllowlistKeys,
  buildModelAliasIndex,
  modelKey,
  resolveConfiguredModelRef,
  resolveModelRefFromString,
} from "./model-selection.js";
// ===== OpenClawCN: Provider 健康状态追踪 =====
import { recordProviderSuccess, recordProviderFailure } from "../dispatch/provider-health.js";
// ===== END =====
// ===== OpenClawCN: Provider 能力映射（用于筛选 text 模型）=====
import { PROVIDER_CAPABILITY_MAPPINGS } from "../config/provider-capability-mapping.js";
// ===== END =====
// ===== OpenClawCN: 凭据预检，跳过无 API key 的 provider =====
import { hasProviderCredentials } from "./model-auth.js";
// ===== END =====
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("agents/model-fallback");

type ModelCandidate = {
  provider: string;
  model: string;
};

type FallbackAttempt = {
  provider: string;
  model: string;
  error: string;
  reason?: FailoverReason;
  status?: number;
  code?: string;
};

// ===== OpenClawCN: Failover Notification =====
export type FailoverNotification = {
  type: "auto_failover";
  fromProvider: string;
  fromModel: string;
  toProvider: string;
  toModel: string;
  reason: string;
  attemptCount: number;
};

export function formatFailoverNotification(notification: FailoverNotification): string {
  return `<!--CLAWDBOT_FAILOVER_NOTIFICATION:${JSON.stringify(notification)}-->`;
}
// ===== END =====

/**
 * Fallback abort check. Only treats explicit AbortError names as user aborts.
 * Message-based checks (e.g., "aborted") can mask timeouts and skip fallback.
 */
function isFallbackAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  if (isFailoverError(err)) {
    return false;
  }
  const name = "name" in err ? String(err.name) : "";
  return name === "AbortError";
}

function shouldRethrowAbort(err: unknown): boolean {
  return isFallbackAbortError(err) && !isTimeoutError(err);
}

function resolveImageFallbackCandidates(params: {
  cfg: OpenClawCNConfig | undefined;
  defaultProvider: string;
  modelOverride?: string;
}): ModelCandidate[] {
  const aliasIndex = buildModelAliasIndex({
    cfg: params.cfg ?? {},
    defaultProvider: params.defaultProvider,
  });
  const allowlist = buildConfiguredAllowlistKeys({
    cfg: params.cfg,
    defaultProvider: params.defaultProvider,
  });
  const seen = new Set<string>();
  const candidates: ModelCandidate[] = [];

  const addCandidate = (candidate: ModelCandidate, enforceAllowlist: boolean) => {
    if (!candidate.provider || !candidate.model) {
      return;
    }
    const key = modelKey(candidate.provider, candidate.model);
    if (seen.has(key)) {
      return;
    }
    if (enforceAllowlist && allowlist && !allowlist.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(candidate);
  };

  const addRaw = (raw: string, enforceAllowlist: boolean) => {
    const resolved = resolveModelRefFromString({
      raw: String(raw ?? ""),
      defaultProvider: params.defaultProvider,
      aliasIndex,
    });
    if (!resolved) {
      return;
    }
    addCandidate(resolved.ref, enforceAllowlist);
  };

  if (params.modelOverride?.trim()) {
    addRaw(params.modelOverride, false);
  } else {
    const imageModel = params.cfg?.agents?.defaults?.imageModel as
      | { primary?: string }
      | string
      | undefined;
    const primary = typeof imageModel === "string" ? imageModel.trim() : imageModel?.primary;
    if (primary?.trim()) {
      addRaw(primary, false);
    }
  }

  const imageFallbacks = (() => {
    const imageModel = params.cfg?.agents?.defaults?.imageModel as
      | { fallbacks?: string[] }
      | string
      | undefined;
    if (imageModel && typeof imageModel === "object") {
      return imageModel.fallbacks ?? [];
    }
    return [];
  })();

  for (const raw of imageFallbacks) {
    addRaw(raw, true);
  }

  return candidates;
}

function resolveFallbackCandidates(params: {
  cfg: OpenClawCNConfig | undefined;
  provider: string;
  model: string;
  /** Optional explicit fallbacks list; when provided (even empty), replaces agents.defaults.model.fallbacks. */
  fallbacksOverride?: string[];
  /** When true, add all configured providers as fallback candidates (for auto-failover). */
  includeConfiguredProviders?: boolean;
}): ModelCandidate[] {
  const primary = params.cfg
    ? resolveConfiguredModelRef({
        cfg: params.cfg,
        defaultProvider: DEFAULT_PROVIDER,
        defaultModel: DEFAULT_MODEL,
      })
    : null;
  const defaultProvider = primary?.provider ?? DEFAULT_PROVIDER;
  const defaultModel = primary?.model ?? DEFAULT_MODEL;
  const provider = String(params.provider ?? "").trim() || defaultProvider;
  const model = String(params.model ?? "").trim() || defaultModel;
  const aliasIndex = buildModelAliasIndex({
    cfg: params.cfg ?? {},
    defaultProvider,
  });
  const allowlist = buildConfiguredAllowlistKeys({
    cfg: params.cfg,
    defaultProvider,
  });
  const seen = new Set<string>();
  const candidates: ModelCandidate[] = [];

  const addCandidate = (candidate: ModelCandidate, enforceAllowlist: boolean) => {
    if (!candidate.provider || !candidate.model) {
      return;
    }
    const key = modelKey(candidate.provider, candidate.model);
    if (seen.has(key)) {
      return;
    }
    if (enforceAllowlist && allowlist && !allowlist.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(candidate);
  };

  addCandidate({ provider, model }, false);

  const modelFallbacks = (() => {
    if (params.fallbacksOverride !== undefined) {
      return params.fallbacksOverride;
    }
    const model = params.cfg?.agents?.defaults?.model as
      | { fallbacks?: string[] }
      | string
      | undefined;
    if (model && typeof model === "object") {
      return model.fallbacks ?? [];
    }
    return [];
  })();

  for (const raw of modelFallbacks) {
    const resolved = resolveModelRefFromString({
      raw: String(raw ?? ""),
      defaultProvider,
      aliasIndex,
    });
    if (!resolved) {
      continue;
    }
    addCandidate(resolved.ref, true);
  }

  if (params.fallbacksOverride === undefined && primary?.provider && primary.model) {
    addCandidate({ provider: primary.provider, model: primary.model }, false);
  }

  // ===== OpenClawCN: include all configured providers as fallback candidates =====
  // Use PROVIDER_CAPABILITY_MAPPINGS to select the first text-capable model per provider.
  // Falls back to models[0] for custom/unknown providers without a mapping.
  if (params.includeConfiguredProviders && params.cfg?.models?.providers) {
    const providers = params.cfg.models.providers as Record<
      string,
      {
        apiKey?: string;
        models?: Array<{ id?: string }>;
      }
    >;
    for (const [pid, pCfg] of Object.entries(providers)) {
      if (!pCfg.apiKey) continue;

      // Prefer a text-capable model from the static capability mapping
      const mapping = PROVIDER_CAPABILITY_MAPPINGS[pid];
      const textModel = mapping?.models?.find((m) => m.capabilities.includes("text"));
      if (textModel) {
        addCandidate({ provider: pid, model: textModel.modelId }, false);
        continue;
      }

      // No mapping found — use first runtime-configured model (custom providers)
      const firstModel = pCfg.models?.[0];
      if (firstModel?.id) {
        addCandidate({ provider: pid, model: firstModel.id }, false);
      }
    }
  }

  // ===== OpenClawCN: apply providerPriority ordering =====
  const priorityOrder = params.cfg?.providerPriority;
  if (priorityOrder && priorityOrder.length > 0 && candidates.length > 1) {
    const primaryCandidate = candidates[0];
    const rest = candidates.slice(1);
    const priorityMap = new Map(priorityOrder.map((id, i) => [id, i]));
    rest.sort((a, b) => {
      const aIdx = priorityMap.get(a.provider) ?? Infinity;
      const bIdx = priorityMap.get(b.provider) ?? Infinity;
      return aIdx - bIdx;
    });
    return [primaryCandidate, ...rest];
  }
  // ===== END =====

  return candidates;
}

export async function runWithModelFallback<T>(params: {
  cfg: OpenClawCNConfig | undefined;
  provider: string;
  model: string;
  agentDir?: string;
  /** Optional explicit fallbacks list; when provided (even empty), replaces agents.defaults.model.fallbacks. */
  fallbacksOverride?: string[];
  /** When true, include all configured providers as fallback candidates. */
  includeConfiguredProviders?: boolean;
  run: (provider: string, model: string) => Promise<T>;
  onError?: (attempt: {
    provider: string;
    model: string;
    error: unknown;
    attempt: number;
    total: number;
  }) => void | Promise<void>;
}): Promise<{
  result: T;
  provider: string;
  model: string;
  attempts: FallbackAttempt[];
  /** Set when a failover occurred (attempts > 0 and run succeeded). */
  failoverNotification?: FailoverNotification;
}> {
  const candidates = resolveFallbackCandidates({
    cfg: params.cfg,
    provider: params.provider,
    model: params.model,
    fallbacksOverride: params.fallbacksOverride,
    includeConfiguredProviders: params.includeConfiguredProviders,
  });
  log.debug(
    `fallback candidates: ${candidates.map((c, i) => `[${i}] ${c.provider}/${c.model}`).join(", ")}`,
  );
  const authStore = params.cfg
    ? ensureAuthProfileStore(params.agentDir, { allowKeychainPrompt: false })
    : null;
  const attempts: FallbackAttempt[] = [];
  let lastError: unknown;

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (authStore) {
      const profileIds = resolveAuthProfileOrder({
        cfg: params.cfg,
        store: authStore,
        provider: candidate.provider,
      });
      const isAnyProfileAvailable = profileIds.some((id) => !isProfileInCooldown(authStore, id));

      if (profileIds.length > 0 && !isAnyProfileAvailable) {
        // All profiles for this provider are in cooldown; skip without attempting
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          error: `Provider ${candidate.provider} is in cooldown (all profiles unavailable)`,
          reason: "rate_limit",
        });
        continue;
      }
    }
    // ===== OpenClawCN: 凭据预检 — 仅做 debug 日志，不跳过 candidate =====
    // 不再 skip candidate：run() 可能通过交互式 auth、keychain、proxy 等
    // 机制获取凭据，预检覆盖不到这些来源。跳过会导致用户看到
    // "All models failed" 而非 run() 产生的真实 auth 错误。
    if (!hasProviderCredentials(candidate.provider, params.cfg, authStore ?? undefined)) {
      log.debug(
        `[${i + 1}/${candidates.length}] ${candidate.provider}/${candidate.model} — no local credentials detected, attempting anyway`,
      );
    }
    // ===== END =====
    try {
      const t0 = Date.now();
      log.debug(`[${i + 1}/${candidates.length}] trying ${candidate.provider}/${candidate.model}`);
      const result = await params.run(candidate.provider, candidate.model);
      log.debug(
        `[${i + 1}/${candidates.length}] ${candidate.provider}/${candidate.model} succeeded in ${Date.now() - t0}ms`,
      );
      // ===== OpenClawCN: 记录成功 =====
      recordProviderSuccess(candidate.provider);
      // ===== END =====
      // ===== OpenClawCN: build failover notification if we fell back =====
      let failoverNotification: FailoverNotification | undefined;
      if (attempts.length > 0) {
        const primaryAttempt = attempts[0];
        failoverNotification = {
          type: "auto_failover",
          fromProvider: primaryAttempt.provider,
          fromModel: primaryAttempt.model,
          toProvider: candidate.provider,
          toModel: candidate.model,
          reason: primaryAttempt.reason ?? "unknown",
          attemptCount: attempts.length,
        };
      }
      // ===== END =====
      return {
        result,
        provider: candidate.provider,
        model: candidate.model,
        attempts,
        failoverNotification,
      };
    } catch (err) {
      if (shouldRethrowAbort(err)) {
        throw err;
      }
      const normalized =
        coerceToFailoverError(err, {
          provider: candidate.provider,
          model: candidate.model,
        }) ?? err;
      if (!isFailoverError(normalized)) {
        throw err;
      }

      lastError = normalized;
      const described = describeFailoverError(normalized);
      log.debug(
        `[${i + 1}/${candidates.length}] ${candidate.provider}/${candidate.model} failed: ${described.message} (reason=${described.reason ?? "unknown"})`,
      );
      // ===== OpenClawCN: 记录失败，供模态路由和丝滑切换参考 =====
      recordProviderFailure(candidate.provider, described.message, described.reason);
      // ===== END =====
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        error: described.message,
        reason: described.reason,
        status: described.status,
        code: described.code,
      });
      await params.onError?.({
        provider: candidate.provider,
        model: candidate.model,
        error: normalized,
        attempt: i + 1,
        total: candidates.length,
      });
    }
  }

  if (attempts.length <= 1 && lastError) {
    throw lastError;
  }
  const summary =
    attempts.length > 0
      ? attempts
          .map(
            (attempt) =>
              `${attempt.provider}/${attempt.model}: ${attempt.error}${
                attempt.reason ? ` (${attempt.reason})` : ""
              }`,
          )
          .join(" | ")
      : "unknown";
  throw new Error(`All models failed (${attempts.length || candidates.length}): ${summary}`, {
    cause: lastError instanceof Error ? lastError : undefined,
  });
}

export async function runWithImageModelFallback<T>(params: {
  cfg: OpenClawCNConfig | undefined;
  modelOverride?: string;
  run: (provider: string, model: string) => Promise<T>;
  onError?: (attempt: {
    provider: string;
    model: string;
    error: unknown;
    attempt: number;
    total: number;
  }) => void | Promise<void>;
}): Promise<{
  result: T;
  provider: string;
  model: string;
  attempts: FallbackAttempt[];
}> {
  const candidates = resolveImageFallbackCandidates({
    cfg: params.cfg,
    defaultProvider: DEFAULT_PROVIDER,
    modelOverride: params.modelOverride,
  });
  if (candidates.length === 0) {
    throw new Error(
      "No image model configured. Set agents.defaults.imageModel.primary or agents.defaults.imageModel.fallbacks.",
    );
  }

  const attempts: FallbackAttempt[] = [];
  let lastError: unknown;

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    try {
      const result = await params.run(candidate.provider, candidate.model);
      // ===== OpenClawCN: 记录成功 =====
      recordProviderSuccess(candidate.provider);
      // ===== END =====
      return {
        result,
        provider: candidate.provider,
        model: candidate.model,
        attempts,
      };
    } catch (err) {
      if (shouldRethrowAbort(err)) {
        throw err;
      }
      lastError = err;
      // ===== OpenClawCN: 记录失败 =====
      recordProviderFailure(candidate.provider, err instanceof Error ? err.message : String(err));
      // ===== END =====
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        error: err instanceof Error ? err.message : String(err),
      });
      await params.onError?.({
        provider: candidate.provider,
        model: candidate.model,
        error: err,
        attempt: i + 1,
        total: candidates.length,
      });
    }
  }

  if (attempts.length <= 1 && lastError) {
    throw lastError;
  }
  const summary =
    attempts.length > 0
      ? attempts
          .map((attempt) => `${attempt.provider}/${attempt.model}: ${attempt.error}`)
          .join(" | ")
      : "unknown";
  throw new Error(`All image models failed (${attempts.length || candidates.length}): ${summary}`, {
    cause: lastError instanceof Error ? lastError : undefined,
  });
}

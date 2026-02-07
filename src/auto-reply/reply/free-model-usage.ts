import { loadConfig, writeConfigFile } from "../../config/config.js";
import { getFreeModelProvider } from "../../config/free-model-providers.js";
import { getBeijingDateString } from "../../config/free-models-time.js";
import type { FreeModelsConfig } from "../../config/types.free-models.js";
import type { NormalizedUsage } from "../../agents/usage.js";

type FreeModelUsageUpdateResult =
  | { updated: false; reason: string }
  | { updated: true; providerId: string; usedTokens: number; addedTokens: number; limit: number | null };

let freeModelUsageWriteChain: Promise<void> = Promise.resolve();

function enqueueWrite(op: () => Promise<void>): Promise<void> {
  // Serialize config writes to avoid lost updates in-process.
  freeModelUsageWriteChain = freeModelUsageWriteChain.then(op, op);
  return freeModelUsageWriteChain;
}

function extractFreeModelProviderId(providerUsed: string): string | null {
  if (!providerUsed.startsWith("free-model-")) return null;
  const raw = providerUsed.slice("free-model-".length).trim();
  return raw ? raw : null;
}

function computeTotalTokens(usage?: NormalizedUsage | null): number {
  if (!usage) return 0;
  if (typeof usage.total === "number" && Number.isFinite(usage.total) && usage.total > 0) {
    return Math.floor(usage.total);
  }
  const sum =
    (usage.input ?? 0) + (usage.output ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
  return sum > 0 ? Math.floor(sum) : 0;
}

function resetIfNewBeijingDay(freeModels: FreeModelsConfig): boolean {
  const today = getBeijingDateString();
  if (freeModels.stats.lastResetDate === today) return false;

  for (const account of freeModels.accounts) {
    account.todayUsage.tokens = 0;
    account.todayUsage.requests = 0;
    account.todayUsage.lastUpdated = new Date().toISOString();
    if (account.status === "exhausted") {
      account.status = "active";
      account.lastError = undefined;
      account.lastErrorTime = undefined;
    }
  }
  freeModels.stats.todaySavings = 0;
  freeModels.stats.todayFreeRequests = 0;
  freeModels.stats.lastResetDate = today;
  return true;
}

/**
 * Record a completed free-model run's token usage into `config.freeModels`.
 *
 * This powers local daily-limits (e.g. 500k tokens/day) so we can stop using a provider
 * before the upstream starts returning ambiguous auth errors (401 no body).
 */
export async function recordFreeModelUsage(params: {
  providerUsed: string;
  usage?: NormalizedUsage | null;
}): Promise<FreeModelUsageUpdateResult> {
  const providerId = extractFreeModelProviderId(params.providerUsed);
  if (!providerId) return { updated: false, reason: "not a free model provider" };

  const addedTokens = computeTotalTokens(params.usage);
  if (addedTokens <= 0) return { updated: false, reason: "no usage tokens to record" };

  await enqueueWrite(async () => {
    const cfg = loadConfig();
    const freeModels = (cfg as { freeModels?: FreeModelsConfig }).freeModels;
    if (!freeModels) return;

    // Ensure day-boundary reset is applied even if the chat flow didn't run pre-check (best-effort).
    resetIfNewBeijingDay(freeModels);

    const account = freeModels.accounts.find((a) => a.providerId === providerId);
    if (!account) return;

    account.todayUsage.tokens += addedTokens;
    account.todayUsage.requests += 1;
    account.todayUsage.lastUpdated = new Date().toISOString();

    freeModels.stats.todayFreeRequests += 1;

    const provider = getFreeModelProvider(providerId);
    const limit =
      provider?.freeQuota.type === "daily" && provider.freeQuota.unit === "tokens"
        ? provider.freeQuota.limit
        : null;

    if (limit && limit > 0 && account.todayUsage.tokens >= limit) {
      account.status = "exhausted";
      account.lastError = `本地限流：今日已使用 ${account.todayUsage.tokens} tokens，达到上限 ${limit} tokens`;
      account.lastErrorTime = new Date().toISOString();
    }

    (cfg as { freeModels?: FreeModelsConfig }).freeModels = freeModels;
    await writeConfigFile(cfg);
  });

  // Return a cheap “best guess” summary (may differ if config changed mid-flight).
  const provider = getFreeModelProvider(providerId);
  const limit =
    provider?.freeQuota.type === "daily" && provider.freeQuota.unit === "tokens"
      ? provider.freeQuota.limit
      : null;
  const cfgAfter = loadConfig();
  const usedTokens =
    (cfgAfter as { freeModels?: FreeModelsConfig }).freeModels?.accounts.find(
      (a) => a.providerId === providerId,
    )?.todayUsage.tokens ?? 0;

  return { updated: true, providerId, usedTokens, addedTokens, limit };
}


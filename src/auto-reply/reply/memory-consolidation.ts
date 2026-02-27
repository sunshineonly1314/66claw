/**
 * [CN-PATCH:memory-consolidation] Background memory profile consolidation.
 *
 * When the profile nears capacity (≥40 entries), uses a larger free LLM to:
 * 1. Merge duplicate/overlapping entries (e.g. "编程语言" + "编程语言偏好")
 * 2. Identify stale todos and outdated facts
 * 3. Produce a cleaner, more compact profile
 *
 * Triggered as fire-and-forget from the extraction pipeline. Uses a fallback
 * chain of free CN providers for resilience.
 *
 * Design: background optimization only — never blocks agent replies.
 */

import type { OpenClawCNConfig } from "../../config/config.js";
import {
  resolveMemoryProviderApiKey,
  resolveMemoryProviderBaseUrl,
  resolveMemoryProviderHeaders,
  isOpenAICompatibleProvider,
} from "./memory-key-resolver.js";
import {
  withProfileLock,
  readProfile,
  upsertProfileEntryFull,
  removeProfileEntry,
  PROFILE_MAX_ENTRIES,
  type ProfileCategory,
  type ProfileEntry,
  type UserProfile,
} from "../../memory/profile-store.js";
import { logVerbose } from "../../globals.js";

// ── Constants ──

const CONSOLIDATION_PROFILE_THRESHOLD = 140; // 70% of 200 max entries
const CONSOLIDATION_TURN_INTERVAL = 30; // Check more frequently at higher capacity

const VALID_CATEGORIES = new Set<ProfileCategory>([
  "preference",
  "correction",
  "fact",
  "identity",
  "todo",
  "procedure",
]);

export type MemoryConsolidationSettings = {
  enabled: boolean;
  providers: ConsolidationProvider[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  profileThreshold: number;
  turnInterval: number;
};

type ConsolidationProvider = {
  provider: string;
  model: string;
  baseUrl?: string;
};

const DEFAULT_CONSOLIDATION_SETTINGS: Required<MemoryConsolidationSettings> = {
  enabled: true,
  providers: [
    { provider: "meituan-longcat", model: "longcat-flash-chat" },
    { provider: "ant-ling", model: "ling-1t" },
    { provider: "modelscope", model: "Qwen/Qwen3.5-397B-A17B" },
    { provider: "siliconflow", model: "deepseek-ai/DeepSeek-V3" },
    { provider: "deepseek", model: "deepseek-chat" },
  ],
  temperature: 0.1,
  maxTokens: 2048,
  timeoutMs: 120_000,
  profileThreshold: CONSOLIDATION_PROFILE_THRESHOLD,
  turnInterval: CONSOLIDATION_TURN_INTERVAL,
};

const CONSOLIDATION_SYSTEM_PROMPT = [
  "你是记忆整理器。分析以下用户记忆列表，执行三个任务：",
  "",
  "1. **合并重复**：将含义相同或高度相似的条目合并为一条（保留最完整的表述）",
  "2. **标记过时**：识别可能已过期的待办事项或过时信息",
  "3. **保护规则**：identity 和 correction 类条目绝不删除，只能合并",
  "",
  "输出纯 JSON，格式：",
  "{",
  '  "merge": [{"keep": {"category":"...", "key":"...", "value":"合并后的值"}, "remove_keys": [{"category":"...", "key":"..."}]}],',
  '  "stale": [{"category":"...", "key":"...", "reason":"..."}],',
  '  "unchanged_count": 数字',
  "}",
  "",
  "规则：",
  "- 只合并语义确实重复的条目（key 不同但 value 含义相同）",
  "- identity 和 correction 条目不能被 remove，只能作为 keep 目标",
  "- stale 只标记 todo 类和明显过时的 fact 类",
  "- 无需整理时返回空合并列表",
  "- 禁止返回 markdown 代码块，只返回纯 JSON。",
].join("\n");

// ── Per-session turn counter for consolidation ──

const _consolidationCounters = new Map<string, number>();
let _lastConsolidationCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60 * 60_000;
const MAX_COUNTER_ENTRIES = 500;

function cleanupConsolidationCounters(): void {
  const now = Date.now();
  if (now - _lastConsolidationCleanup < CLEANUP_INTERVAL_MS) return;
  _lastConsolidationCleanup = now;
  if (_consolidationCounters.size > MAX_COUNTER_ENTRIES) {
    _consolidationCounters.clear();
  }
}

// ── Settings Resolution ──

export function resolveConsolidationSettings(
  cfg?: OpenClawCNConfig,
): MemoryConsolidationSettings | null {
  const raw = (cfg?.agents?.defaults as Record<string, unknown>)?.memoryConsolidation as
    | Record<string, unknown>
    | undefined;
  const enabled =
    typeof raw?.enabled === "boolean" ? raw.enabled : DEFAULT_CONSOLIDATION_SETTINGS.enabled;
  if (!enabled) return null;
  return {
    enabled,
    providers:
      Array.isArray(raw?.providers) && raw.providers.length > 0
        ? (raw.providers as ConsolidationProvider[])
        : DEFAULT_CONSOLIDATION_SETTINGS.providers,
    temperature:
      typeof raw?.temperature === "number"
        ? raw.temperature
        : DEFAULT_CONSOLIDATION_SETTINGS.temperature,
    maxTokens:
      typeof raw?.maxTokens === "number" && raw.maxTokens > 0
        ? raw.maxTokens
        : DEFAULT_CONSOLIDATION_SETTINGS.maxTokens,
    timeoutMs:
      typeof raw?.timeoutMs === "number" && raw.timeoutMs > 0
        ? raw.timeoutMs
        : DEFAULT_CONSOLIDATION_SETTINGS.timeoutMs,
    profileThreshold:
      typeof raw?.profileThreshold === "number" && raw.profileThreshold > 0
        ? raw.profileThreshold
        : DEFAULT_CONSOLIDATION_SETTINGS.profileThreshold,
    turnInterval:
      typeof raw?.turnInterval === "number" && raw.turnInterval > 0
        ? raw.turnInterval
        : DEFAULT_CONSOLIDATION_SETTINGS.turnInterval,
  };
}

// ── Trigger Logic ──

export function shouldRunConsolidation(params: {
  profileEntryCount: number;
  sessionKey?: string;
  settings: MemoryConsolidationSettings;
}): boolean {
  // Only consolidate when profile is getting full
  if (params.profileEntryCount < params.settings.profileThreshold) return false;

  // Periodic: every N-th turn (counted separately from extraction)
  if (params.sessionKey) {
    cleanupConsolidationCounters();
    const count = (_consolidationCounters.get(params.sessionKey) ?? 0) + 1;
    _consolidationCounters.set(params.sessionKey, count);
    if (count % params.settings.turnInterval === 0) {
      return true;
    }
  }

  return false;
}

// ── LLM Call with Fallback Chain ──

async function callConsolidationLLM(params: {
  cfg: OpenClawCNConfig | undefined;
  providers: ConsolidationProvider[];
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}): Promise<string | null> {
  for (const providerDef of params.providers) {
    const apiKey = resolveMemoryProviderApiKey(params.cfg, providerDef.provider);
    if (!apiKey) continue;

    const baseUrl =
      providerDef.baseUrl || resolveMemoryProviderBaseUrl(params.cfg, providerDef.provider);
    const extraHeaders = resolveMemoryProviderHeaders(providerDef.provider);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), params.timeoutMs);

    try {
      const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...extraHeaders,
        },
        body: JSON.stringify({
          model: providerDef.model,
          messages: [
            { role: "system", content: params.systemPrompt },
            { role: "user", content: params.userPrompt },
          ],
          temperature: params.temperature,
          max_tokens: params.maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        logVerbose(
          `[MemoryConsolidation] ${providerDef.provider}/${providerDef.model} failed: HTTP ${response.status}: ${text.slice(0, 100)}`,
        );
        continue; // try next provider
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content?.trim() ?? "";
      if (content) return content;
      logVerbose(
        `[MemoryConsolidation] ${providerDef.provider}/${providerDef.model} returned empty content`,
      );
      continue;
    } catch (err) {
      logVerbose(
        `[MemoryConsolidation] ${providerDef.provider}/${providerDef.model} error: ${String(err).slice(0, 100)}`,
      );
      continue; // try next provider
    } finally {
      clearTimeout(timer);
    }
  }
  return null; // all providers failed
}

// ── Response Parsing ──

type ConsolidationResult = {
  merge: Array<{
    keep: { category: string; key: string; value: string };
    remove_keys: Array<{ category: string; key: string }>;
  }>;
  stale: Array<{ category: string; key: string; reason: string }>;
  unchanged_count?: number;
};

export function parseConsolidationResult(raw: string): ConsolidationResult | null {
  if (!raw) return null;

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const result: ConsolidationResult = {
    merge: [],
    stale: [],
    unchanged_count: typeof obj.unchanged_count === "number" ? obj.unchanged_count : undefined,
  };

  // Parse merge instructions
  if (Array.isArray(obj.merge)) {
    for (const m of obj.merge) {
      if (!m || typeof m !== "object") continue;
      const mObj = m as Record<string, unknown>;
      const keep = mObj.keep as Record<string, unknown> | undefined;
      if (!keep?.category || !keep?.key || !keep?.value) continue;
      if (!VALID_CATEGORIES.has(keep.category as ProfileCategory)) continue;

      const removeKeys = Array.isArray(mObj.remove_keys ?? mObj.removeKeys)
        ? ((mObj.remove_keys ?? mObj.removeKeys) as Array<Record<string, unknown>>)
        : [];

      const validRemoves = removeKeys
        .filter(
          (r) =>
            r &&
            typeof r === "object" &&
            typeof r.category === "string" &&
            typeof r.key === "string",
        )
        .filter((r) => VALID_CATEGORIES.has(r.category as ProfileCategory))
        .map((r) => ({ category: String(r.category), key: String(r.key) }));

      if (validRemoves.length > 0) {
        result.merge.push({
          keep: {
            category: String(keep.category),
            key: String(keep.key),
            value: String(keep.value),
          },
          remove_keys: validRemoves,
        });
      }
    }
  }

  // Parse stale markers
  if (Array.isArray(obj.stale)) {
    for (const s of obj.stale) {
      if (!s || typeof s !== "object") continue;
      const sObj = s as Record<string, unknown>;
      if (!sObj.category || !sObj.key) continue;
      if (!VALID_CATEGORIES.has(sObj.category as ProfileCategory)) continue;
      // Only allow stale marking for todo and fact categories
      if (sObj.category !== "todo" && sObj.category !== "fact") continue;
      result.stale.push({
        category: String(sObj.category),
        key: String(sObj.key),
        reason: String(sObj.reason ?? ""),
      });
    }
  }

  return result;
}

// ── Apply Consolidation ──

/**
 * Apply consolidation result to the profile.
 *
 * @param snapshotTimestamp - When the profile snapshot was taken for the LLM call.
 *   Entries updated AFTER this timestamp were written by concurrent extraction and
 *   must NOT be removed or overwritten — the LLM never saw them.
 */
function applyConsolidation(
  profile: UserProfile,
  result: ConsolidationResult,
  snapshotTimestamp?: number,
): {
  profile: UserProfile;
  mergeCount: number;
  staleCount: number;
  removedEntries: ProfileEntry[];
} {
  let updated = profile;
  let mergeCount = 0;
  let staleCount = 0;
  const removedEntries: ProfileEntry[] = [];

  // Track keys already removed by merge to avoid double-counting in stale pass
  const removedByMerge = new Set<string>();

  // Apply merges: remove duplicates, upsert the "keep" entry with merged value
  for (const merge of result.merge) {
    // Safety: never remove identity/correction entries
    const safeRemoves = merge.remove_keys.filter(
      (r) => r.category !== "identity" && r.category !== "correction",
    );

    let actuallyRemoved = 0;
    for (const remove of safeRemoves) {
      // Capture the entry before removal for archival
      const existing = updated.entries.find(
        (e) => e.category === remove.category && e.key.toLowerCase() === remove.key.toLowerCase(),
      );
      // Concurrent safety: skip entries updated after the snapshot was taken.
      // These were written by extraction during the LLM call — the LLM never saw them.
      if (existing && snapshotTimestamp && existing.updatedAt >= snapshotTimestamp) {
        logVerbose(
          `[MemoryConsolidation] Skipping remove of "${remove.key}" — updated after snapshot`,
        );
        continue;
      }
      if (existing) removedEntries.push(existing);

      updated = removeProfileEntry(updated, remove.category as ProfileCategory, remove.key);
      removedByMerge.add(`${remove.category}:${remove.key.toLowerCase()}`);
      actuallyRemoved++;
    }

    // Only apply the merge-keep upsert if at least one entry was actually removed.
    // If all removes were skipped (e.g. concurrent extraction updated them after snapshot),
    // applying the keep upsert would corrupt the entry value with stale merged content.
    if (actuallyRemoved > 0) {
      // Use upsertProfileEntryFull to capture any evictions triggered by the upsert
      const upsertResult = upsertProfileEntryFull(
        updated,
        merge.keep.category as ProfileCategory,
        merge.keep.key,
        merge.keep.value,
        { source: "consolidation" },
      );
      updated = upsertResult.profile;
      if (upsertResult.evicted.length > 0) {
        removedEntries.push(...upsertResult.evicted);
      }
      mergeCount++;
    }
  }

  // Apply stale removals: only remove zero-hit stale entries not already merged away
  for (const stale of result.stale) {
    const compositeKey = `${stale.category}:${stale.key.toLowerCase()}`;
    if (removedByMerge.has(compositeKey)) continue; // already handled by merge

    const entry = updated.entries.find(
      (e) => e.category === stale.category && e.key.toLowerCase() === stale.key.toLowerCase(),
    );
    // Concurrent safety: skip entries updated after the snapshot
    if (entry && snapshotTimestamp && entry.updatedAt >= snapshotTimestamp) {
      logVerbose(
        `[MemoryConsolidation] Skipping stale removal of "${stale.key}" — updated after snapshot`,
      );
      continue;
    }
    // Only remove if hits === 0 (never reinforced by user)
    if (entry && entry.hits === 0) {
      removedEntries.push(entry);
      updated = removeProfileEntry(updated, stale.category as ProfileCategory, stale.key);
      staleCount++;
    }
  }

  return { profile: updated, mergeCount, staleCount, removedEntries };
}

// ── Format profile for consolidation prompt ──

function formatProfileForConsolidation(profile: UserProfile): string {
  if (profile.entries.length === 0) return "（空）";
  return profile.entries
    .map((e) => {
      const safeKey = e.key.replace(/[\r\n]+/g, " ").trim();
      const safeValue = e.value.replace(/[\r\n]+/g, "; ").trim();
      return `- [${e.category}] ${safeKey}: ${safeValue}`;
    })
    .join("\n");
}

// ── Main Orchestrator ──

export async function runMemoryConsolidation(params: {
  workspaceDir: string;
  cfg: OpenClawCNConfig;
  sessionKey?: string;
  /** Main model provider — used as last resort when all free providers fail. */
  mainProvider?: string;
  /** Main model name — used with mainProvider as last resort. */
  mainModel?: string;
}): Promise<void> {
  const settings = resolveConsolidationSettings(params.cfg);
  if (!settings) return;

  // Capture the timestamp BEFORE reading the profile. Any entries with updatedAt >= this
  // were written by concurrent extraction and must be protected from consolidation removal.
  // Taking the timestamp first (not after readProfile) closes the sub-millisecond race
  // where an extraction write could land between readProfile() and Date.now().
  const snapshotTimestamp = Date.now();
  const profile = readProfile(params.workspaceDir);

  if (
    !shouldRunConsolidation({
      profileEntryCount: profile.entries.length,
      sessionKey: params.sessionKey,
      settings,
    })
  ) {
    return;
  }

  // Build the effective provider list: configured fallback chain + main model as last resort.
  // Main model is only usable if it's OpenAI-compatible (the consolidation pipeline
  // sends raw fetch() to /chat/completions, which doesn't work for Anthropic/Ollama/Bedrock).
  const effectiveProviders = [...settings.providers];
  if (params.mainProvider && params.mainModel && isOpenAICompatibleProvider(params.mainProvider)) {
    // Only add main model if it's not already in the chain
    const alreadyInChain = effectiveProviders.some((p) => p.provider === params.mainProvider);
    if (!alreadyInChain) {
      effectiveProviders.push({
        provider: params.mainProvider,
        model: params.mainModel,
      });
    }
  }

  const profileText = formatProfileForConsolidation(profile);
  const userPrompt = `当前记忆列表（${profile.entries.length}/${PROFILE_MAX_ENTRIES} 条，容量 ${Math.round((profile.entries.length / PROFILE_MAX_ENTRIES) * 100)}%）：\n${profileText}`;

  logVerbose(
    `[MemoryConsolidation] Triggering consolidation for ${params.sessionKey ?? "?"} (${profile.entries.length} entries, ${effectiveProviders.length} providers)`,
  );

  const raw = await callConsolidationLLM({
    cfg: params.cfg,
    providers: effectiveProviders,
    systemPrompt: CONSOLIDATION_SYSTEM_PROMPT,
    userPrompt,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
    timeoutMs: settings.timeoutMs,
  });

  if (!raw) {
    logVerbose("[MemoryConsolidation] All providers failed (including main model), skipping");
    return;
  }

  const result = parseConsolidationResult(raw);
  if (!result) {
    logVerbose("[MemoryConsolidation] Failed to parse consolidation result");
    return;
  }

  if (result.merge.length === 0 && result.stale.length === 0) {
    logVerbose("[MemoryConsolidation] No merges or stale entries found");
    return;
  }

  await withProfileLock(params.workspaceDir, (currentProfile) => {
    const {
      profile: consolidated,
      mergeCount,
      staleCount,
      removedEntries,
    } = applyConsolidation(currentProfile, result, snapshotTimestamp);
    logVerbose(
      `[MemoryConsolidation] Applied: ${mergeCount} merges, ${staleCount} stale removals (${currentProfile.entries.length} → ${consolidated.entries.length} entries)`,
    );
    // evicted entries are archived inside the lock (before profile write) by withProfileLock
    return { profile: consolidated, result: { mergeCount, staleCount }, evicted: removedEntries };
  });
}

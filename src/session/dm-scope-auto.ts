/**
 * Auto-detection of optimal `session.dmScope` based on configured channels,
 * accounts, and DM policies. Pure logic -- no I/O in the core function.
 */

import type { OpenClawCNConfig } from "../config/config.js";
import type { DmScope } from "../config/types.base.js";
import type { ChannelPlugin } from "../channels/plugins/types.js";

export type DmScopeRecommendation = {
  /** The recommended dmScope value. */
  recommended: DmScope;
  /** The currently configured dmScope (or "main" if unset). */
  current: DmScope;
  /** Whether the user explicitly set dmScope in config. */
  isExplicit: boolean;
  /** Whether the recommendation is stricter than the current value. */
  shouldUpgrade: boolean;
  /** Human-readable reason for the recommendation. */
  reason: string;
  /** Number of configured+enabled channels. */
  configuredChannelCount: number;
  /** Total account count across all configured channels. */
  totalAccounts: number;
  /** Channel labels that triggered multi-user detection. */
  multiUserChannels: string[];
};

/** Ordered from least isolated to most isolated. */
const DM_SCOPE_ORDER: DmScope[] = [
  "main",
  "per-peer",
  "per-channel-peer",
  "per-account-channel-peer",
];

function scopeRank(scope: DmScope): number {
  const idx = DM_SCOPE_ORDER.indexOf(scope);
  return idx === -1 ? 0 : idx;
}

/**
 * Determines the recommended dmScope given the current config and loaded
 * channel plugins.
 *
 * Pure function -- no I/O, no side effects.
 *
 * Rules:
 * 1. No channels configured -> "main"
 * 2. Single channel, single account, multi-user DM policy -> "per-peer"
 * 3. Multiple channels OR any wildcard/open DM policy -> "per-channel-peer"
 * 4. Any channel with multiple accounts -> "per-account-channel-peer"
 *
 * Never downgrades: if current is already more isolated, keeps current.
 */
export function recommendDmScope(params: {
  cfg: OpenClawCNConfig;
  plugins: ChannelPlugin[];
  /** Pre-resolved allowFrom counts per channel from pairing store. */
  allowFromCounts?: Map<string, number>;
}): DmScopeRecommendation {
  const { cfg, plugins } = params;
  const rawDmScope = (cfg.session as Record<string, unknown> | undefined)?.dmScope;
  const current: DmScope = (rawDmScope as DmScope | undefined) ?? "main";
  const isExplicit = rawDmScope !== undefined;

  const multiUserChannels: string[] = [];
  let totalAccounts = 0;
  let hasMultiAccount = false;
  let hasOpenOrWildcard = false;
  let configuredChannelCount = 0;

  for (const plugin of plugins) {
    const accountIds = plugin.config.listAccountIds(cfg);
    if (accountIds.length === 0) continue;

    // Check if the default account is enabled
    const defaultAccountId = accountIds[0];
    let account: unknown;
    try {
      account = plugin.config.resolveAccount(cfg, defaultAccountId);
    } catch {
      continue;
    }
    const enabled = plugin.config.isEnabled ? plugin.config.isEnabled(account, cfg) : true;
    if (!enabled) continue;

    configuredChannelCount++;
    totalAccounts += accountIds.length;

    if (accountIds.length > 1) {
      hasMultiAccount = true;
    }

    // Check DM policy for open/wildcard
    if (plugin.security?.resolveDmPolicy) {
      try {
        const dmPolicy = plugin.security.resolveDmPolicy({
          cfg,
          accountId: defaultAccountId,
          account,
        });
        if (dmPolicy) {
          const allowFrom = (dmPolicy.allowFrom ?? []).map((v) => String(v).trim());
          const hasWildcard = allowFrom.includes("*");
          const storeCount = params.allowFromCounts?.get(plugin.id) ?? 0;
          const isMultiUser =
            hasWildcard || dmPolicy.policy === "open" || allowFrom.length > 1 || storeCount > 1;
          if (isMultiUser) {
            multiUserChannels.push(plugin.meta.label ?? plugin.id);
          }
          if (hasWildcard || dmPolicy.policy === "open") {
            hasOpenOrWildcard = true;
          }
        }
      } catch {
        // Non-fatal: skip this plugin's DM policy check
      }
    }
  }

  // Determine recommended scope
  let recommended: DmScope;
  let reason: string;

  if (configuredChannelCount === 0) {
    recommended = "main";
    reason = "no_channels";
  } else if (hasMultiAccount) {
    recommended = "per-account-channel-peer";
    reason = "multi_account";
  } else if (configuredChannelCount > 1 || hasOpenOrWildcard) {
    recommended = "per-channel-peer";
    reason = hasOpenOrWildcard ? "open_dm_policy" : "multi_channel";
  } else if (multiUserChannels.length > 0) {
    recommended = "per-peer";
    reason = "multi_user";
  } else {
    recommended = "main";
    reason = "single_user";
  }

  // Never downgrade
  if (scopeRank(current) > scopeRank(recommended)) {
    recommended = current;
    reason = "already_stricter";
  }

  const shouldUpgrade = scopeRank(recommended) > scopeRank(current);

  return {
    recommended,
    current,
    isExplicit,
    shouldUpgrade,
    reason,
    configuredChannelCount,
    totalAccounts,
    multiUserChannels,
  };
}

/**
 * Resolves allowFrom counts from the pairing store for all channel plugins.
 * Performs I/O -- separated from the pure `recommendDmScope`.
 */
export async function resolveAllowFromCounts(
  plugins: ChannelPlugin[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  try {
    const { readChannelAllowFromStore } = await import("../pairing/pairing-store.js");
    for (const plugin of plugins) {
      try {
        const entries = await readChannelAllowFromStore(plugin.id);
        counts.set(plugin.id, Array.isArray(entries) ? entries.length : 0);
      } catch {
        counts.set(plugin.id, 0);
      }
    }
  } catch {
    // pairing-store module not available
  }
  return counts;
}

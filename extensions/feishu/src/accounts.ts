import type { ClawdbotConfig } from "openclawcn/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclawcn/plugin-sdk/account-id";
import type {
  FeishuChannelConfig,
  ResolvedFeishuAccount,
} from "./types.js";
import { resolveFeishuCredentials } from "./client.js";

/**
 * Multi-account config: extends FeishuChannelConfig with an accounts map.
 */
type FeishuConfig = FeishuChannelConfig & {
  accounts?: Record<string, FeishuAccountConfig>;
};

/**
 * Per-account config: extends FeishuChannelConfig with an optional display name.
 */
type FeishuAccountConfig = FeishuChannelConfig & {
  name?: string;
};

/**
 * List all configured account IDs from the accounts field.
 */
function listConfiguredAccountIds(cfg: ClawdbotConfig): string[] {
  const accounts = (cfg.channels?.feishu as FeishuConfig)?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return [];
  }
  return Object.keys(accounts).filter(Boolean);
}

/**
 * List all Feishu account IDs.
 * If no accounts are configured, returns [DEFAULT_ACCOUNT_ID] for backward compatibility.
 */
export function listFeishuAccountIds(cfg: ClawdbotConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    // Backward compatibility: no accounts configured, use default
    return [DEFAULT_ACCOUNT_ID];
  }
  return [...ids].toSorted((a, b) => a.localeCompare(b));
}

/**
 * Resolve the default account ID.
 */
export function resolveDefaultFeishuAccountId(cfg: ClawdbotConfig): string {
  const ids = listFeishuAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

/**
 * Get the raw account-specific config.
 */
function resolveAccountConfig(
  cfg: ClawdbotConfig,
  accountId: string,
): FeishuAccountConfig | undefined {
  const accounts = (cfg.channels?.feishu as FeishuConfig)?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return undefined;
  }
  return accounts[accountId];
}

/**
 * Merge top-level config with account-specific config.
 * Account-specific fields override top-level fields.
 */
function mergeFeishuAccountConfig(cfg: ClawdbotConfig, accountId: string): FeishuConfig {
  const feishuCfg = cfg.channels?.feishu as FeishuConfig | undefined;

  // Extract base config (exclude accounts field to avoid recursion)
  const { accounts: _ignored, ...base } = feishuCfg ?? {};

  // Get account-specific overrides
  const account = resolveAccountConfig(cfg, accountId) ?? {};

  // Merge: account config overrides base config
  return { ...base, ...account } as FeishuConfig;
}

/**
 * Resolve a complete Feishu account with merged config.
 */
export function resolveFeishuAccount(params: {
  cfg: ClawdbotConfig;
  accountId?: string | null;
}): ResolvedFeishuAccount {
  const accountId = normalizeAccountId(params.accountId);
  const feishuCfg = params.cfg.channels?.feishu as FeishuConfig | undefined;

  // Base enabled state (top-level)
  const baseEnabled = feishuCfg?.enabled !== false;

  // Merge configs
  const merged = mergeFeishuAccountConfig(params.cfg, accountId);

  // Account-level enabled state
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;

  // Resolve credentials from merged config
  const creds = resolveFeishuCredentials(merged);

  return {
    accountId,
    enabled,
    configured: Boolean(creds),
    appId: creds?.appId ?? null,
    appSecret: creds?.appSecret ?? null,
    config: merged,
    domain: creds?.domain ?? "feishu",
  };
}

/**
 * List all enabled and configured accounts.
 */
export function listEnabledFeishuAccounts(cfg: ClawdbotConfig): ResolvedFeishuAccount[] {
  return listFeishuAccountIds(cfg)
    .map((accountId) => resolveFeishuAccount({ cfg, accountId }))
    .filter((account) => account.enabled && account.configured);
}

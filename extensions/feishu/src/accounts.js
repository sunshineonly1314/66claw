import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclawcn/plugin-sdk/account-id";
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.feishu?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return [];
  }
  return Object.keys(accounts).filter(Boolean);
}
function listFeishuAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return [...ids].toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultFeishuAccountId(cfg) {
  const ids = listFeishuAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.feishu?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return void 0;
  }
  return accounts[accountId];
}
function mergeFeishuAccountConfig(cfg, accountId) {
  const feishuCfg = cfg.channels?.feishu;
  const { accounts: _ignored, ...base } = feishuCfg ?? {};
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}
function resolveFeishuCredentials(cfg) {
  const appId = cfg?.appId?.trim();
  const appSecret = cfg?.appSecret?.trim();
  if (!appId || !appSecret) {
    return null;
  }
  return {
    appId,
    appSecret,
    encryptKey: cfg?.encryptKey?.trim() || void 0,
    verificationToken: cfg?.verificationToken?.trim() || void 0,
    domain: cfg?.domain ?? "feishu"
  };
}
function resolveFeishuAccount(params) {
  const accountId = normalizeAccountId(params.accountId);
  const feishuCfg = params.cfg.channels?.feishu;
  const baseEnabled = feishuCfg?.enabled !== false;
  const merged = mergeFeishuAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const creds = resolveFeishuCredentials(merged);
  return {
    accountId,
    enabled,
    configured: Boolean(creds),
    appId: creds?.appId ?? null,
    appSecret: creds?.appSecret ?? null,
    config: merged,
    domain: creds?.domain ?? "feishu"
  };
}
function listEnabledFeishuAccounts(cfg) {
  return listFeishuAccountIds(cfg).map((accountId) => resolveFeishuAccount({ cfg, accountId })).filter((account) => account.enabled && account.configured);
}
export {
  listEnabledFeishuAccounts,
  listFeishuAccountIds,
  resolveDefaultFeishuAccountId,
  resolveFeishuAccount,
  resolveFeishuCredentials
};

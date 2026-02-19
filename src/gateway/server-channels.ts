import type { ChannelAccountSnapshot } from "../channels/plugins/types.js";
import type { ChannelPlugin } from "../channels/plugins/types.plugin.js";
import type { OpenClawCNConfig } from "../config/config.js";
import type { createSubsystemLogger } from "../logging/subsystem.js";
import type { RuntimeEnv } from "../runtime.js";
import { resolveChannelDefaultAccountId } from "../channels/plugins/helpers.js";
import { type ChannelId, getChannelPlugin, listChannelPlugins } from "../channels/plugins/index.js";
import {
  type ChannelRetryPolicy,
  DEFAULT_CHANNEL_RETRY_POLICY,
  computeBackoff,
  sleepWithAbort,
} from "../infra/backoff.js";
import { formatErrorMessage } from "../infra/errors.js";
import { formatDurationSeconds } from "../infra/format-duration.js";
import { resetDirectoryCache } from "../infra/outbound/target-resolver.js";
import { DEFAULT_ACCOUNT_ID } from "../routing/session-key.js";

export type ChannelRuntimeSnapshot = {
  channels: Partial<Record<ChannelId, ChannelAccountSnapshot>>;
  channelAccounts: Partial<Record<ChannelId, Record<string, ChannelAccountSnapshot>>>;
};

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

type ChannelRuntimeStore = {
  aborts: Map<string, AbortController>;
  tasks: Map<string, Promise<unknown>>;
  runtimes: Map<string, ChannelAccountSnapshot>;
};

function createRuntimeStore(): ChannelRuntimeStore {
  return {
    aborts: new Map(),
    tasks: new Map(),
    runtimes: new Map(),
  };
}

function isAccountEnabled(account: unknown): boolean {
  if (!account || typeof account !== "object") {
    return true;
  }
  const enabled = (account as { enabled?: boolean }).enabled;
  return enabled !== false;
}

function resolveDefaultRuntime(channelId: ChannelId): ChannelAccountSnapshot {
  const plugin = getChannelPlugin(channelId);
  return plugin?.status?.defaultRuntime ?? { accountId: DEFAULT_ACCOUNT_ID };
}

function cloneDefaultRuntime(channelId: ChannelId, accountId: string): ChannelAccountSnapshot {
  return { ...resolveDefaultRuntime(channelId), accountId };
}

type ChannelManagerOptions = {
  loadConfig: () => OpenClawCNConfig;
  channelLogs: Record<ChannelId, SubsystemLogger>;
  channelRuntimeEnvs: Record<ChannelId, RuntimeEnv>;
};

export type ChannelManager = {
  getRuntimeSnapshot: () => ChannelRuntimeSnapshot;
  startChannels: () => Promise<void>;
  startChannel: (channel: ChannelId, accountId?: string) => Promise<void>;
  stopChannel: (channel: ChannelId, accountId?: string) => Promise<void>;
  markChannelLoggedOut: (channelId: ChannelId, cleared: boolean, accountId?: string) => void;
};

function resolveChannelRetryPolicy(plugin: ChannelPlugin): ChannelRetryPolicy {
  const override = plugin.defaults?.retry;
  if (override === false) {
    return { ...DEFAULT_CHANNEL_RETRY_POLICY, maxAttempts: 0 };
  }
  if (override && typeof override === "object") {
    return { ...DEFAULT_CHANNEL_RETRY_POLICY, ...override };
  }
  return DEFAULT_CHANNEL_RETRY_POLICY;
}

// Channel docking: lifecycle hooks (`plugin.gateway`) flow through this manager.
export function createChannelManager(opts: ChannelManagerOptions): ChannelManager {
  const { loadConfig, channelLogs, channelRuntimeEnvs } = opts;

  const channelStores = new Map<ChannelId, ChannelRuntimeStore>();

  const getStore = (channelId: ChannelId): ChannelRuntimeStore => {
    const existing = channelStores.get(channelId);
    if (existing) {
      return existing;
    }
    const next = createRuntimeStore();
    channelStores.set(channelId, next);
    return next;
  };

  const getRuntime = (channelId: ChannelId, accountId: string): ChannelAccountSnapshot => {
    const store = getStore(channelId);
    return store.runtimes.get(accountId) ?? cloneDefaultRuntime(channelId, accountId);
  };

  const setRuntime = (
    channelId: ChannelId,
    accountId: string,
    patch: ChannelAccountSnapshot,
  ): ChannelAccountSnapshot => {
    const store = getStore(channelId);
    const current = getRuntime(channelId, accountId);
    const next = { ...current, ...patch, accountId };
    store.runtimes.set(accountId, next);
    return next;
  };

  const startChannel = async (channelId: ChannelId, accountId?: string) => {
    const plugin = getChannelPlugin(channelId);
    const startAccount = plugin?.gateway?.startAccount;
    if (!startAccount) {
      channelLogs[channelId]?.debug?.(`[${channelId}] no startAccount handler, skipping`);
      return;
    }
    const cfg = loadConfig();
    resetDirectoryCache({ channel: channelId, accountId });
    const store = getStore(channelId);
    const accountIds = accountId ? [accountId] : plugin.config.listAccountIds(cfg);
    if (accountIds.length === 0) {
      return;
    }

    await Promise.all(
      accountIds.map(async (id) => {
        // Guard: skip if already starting or running (abort controller is set
        // synchronously before any async work, so checking both maps prevents
        // a second startChannel() call from slipping through the gap between
        // abort creation and task registration).
        if (store.tasks.has(id) || store.aborts.has(id)) {
          return;
        }
        // Create abort controller IMMEDIATELY to claim this accountId before any await
        // This prevents TOCTOU race where two parallel starts pass the check above
        const abort = new AbortController();
        store.aborts.set(id, abort);

        const account = plugin.config.resolveAccount(cfg, id);
        const enabled = plugin.config.isEnabled
          ? plugin.config.isEnabled(account, cfg)
          : isAccountEnabled(account);
        if (!enabled) {
          // Clean up abort controller since we're not actually starting
          store.aborts.delete(id);
          const reason = plugin.config.disabledReason?.(account, cfg) ?? "disabled";
          channelLogs[channelId]?.info?.(`[${channelId}][${id}] skipped: ${reason}`);
          setRuntime(channelId, id, {
            accountId: id,
            running: false,
            lastError: reason,
          });
          return;
        }

        let configured = true;
        if (plugin.config.isConfigured) {
          configured = await plugin.config.isConfigured(account, cfg);
        }
        if (!configured) {
          // Clean up abort controller since we're not actually starting
          store.aborts.delete(id);
          const reason = plugin.config.unconfiguredReason?.(account, cfg) ?? "not configured";
          channelLogs[channelId]?.info?.(`[${channelId}][${id}] skipped: ${reason}`);
          setRuntime(channelId, id, {
            accountId: id,
            running: false,
            lastError: reason,
          });
          return;
        }

        const log = channelLogs[channelId];
        const retryPolicy = resolveChannelRetryPolicy(plugin);

        const task = (async () => {
          let reconnectAttempts = 0;
          let currentCfg = cfg;
          let currentAccount = account;

          while (!abort.signal.aborted) {
            const attemptStartedAt = Date.now();

            setRuntime(channelId, id, {
              accountId: id,
              running: true,
              lastStartAt: attemptStartedAt,
              lastError: null,
              reconnectAttempts,
            });

            try {
              await startAccount({
                cfg: currentCfg,
                accountId: id,
                account: currentAccount,
                runtime: channelRuntimeEnvs[channelId],
                abortSignal: abort.signal,
                log,
                getStatus: () => getRuntime(channelId, id),
                setStatus: (next) => setRuntime(channelId, id, next),
              });
              // startAccount resolved cleanly — no retry needed.
              return;
            } catch (err) {
              if (abort.signal.aborted) {
                return;
              }

              const message = formatErrorMessage(err);
              const uptimeMs = Date.now() - attemptStartedAt;

              // Reset backoff if channel ran for a healthy stretch.
              if (uptimeMs >= retryPolicy.healthyUptimeMs) {
                reconnectAttempts = 0;
              }

              reconnectAttempts += 1;

              setRuntime(channelId, id, {
                accountId: id,
                lastError: message,
                reconnectAttempts,
              });

              // Max attempts reached — give up.
              if (retryPolicy.maxAttempts > 0 && reconnectAttempts >= retryPolicy.maxAttempts) {
                log.error?.(
                  `[${id}] channel failed after ${reconnectAttempts} attempt(s): ${message}; giving up`,
                );
                return;
              }

              // No retry when maxAttempts is 0 (opt-out).
              if (retryPolicy.maxAttempts === 0) {
                log.error?.(`[${id}] channel exited: ${message}`);
                return;
              }

              const delayMs = computeBackoff(retryPolicy, reconnectAttempts);
              const maxLabel =
                retryPolicy.maxAttempts > 0 ? String(retryPolicy.maxAttempts) : "\u221e";
              log.warn?.(
                `[${id}] channel failed (attempt ${reconnectAttempts}/${maxLabel}): ${message}; retrying in ${formatDurationSeconds(delayMs)}`,
              );

              try {
                await sleepWithAbort(delayMs, abort.signal);
              } catch {
                // Sleep interrupted by abort — stop retrying.
                return;
              }

              // Re-read config before retrying (may have been hot-reloaded).
              currentCfg = loadConfig();
              currentAccount = plugin.config.resolveAccount(currentCfg, id);
            }
          }
        })();

        const tracked = task.finally(() => {
          store.aborts.delete(id);
          store.tasks.delete(id);
          setRuntime(channelId, id, {
            accountId: id,
            running: false,
            lastStopAt: Date.now(),
          });
        });
        store.tasks.set(id, tracked);
      }),
    );
  };

  const stopChannel = async (channelId: ChannelId, accountId?: string) => {
    const plugin = getChannelPlugin(channelId);
    const store = getStore(channelId);
    // Fast path: nothing running and no explicit plugin shutdown hook to run.
    if (!plugin?.gateway?.stopAccount && store.aborts.size === 0 && store.tasks.size === 0) {
      return;
    }
    const cfg = loadConfig();
    const knownIds = new Set<string>([
      ...store.aborts.keys(),
      ...store.tasks.keys(),
      ...(plugin ? plugin.config.listAccountIds(cfg) : []),
    ]);
    if (accountId) {
      knownIds.clear();
      knownIds.add(accountId);
    }

    await Promise.all(
      Array.from(knownIds.values()).map(async (id) => {
        const abort = store.aborts.get(id);
        const task = store.tasks.get(id);
        if (!abort && !task && !plugin?.gateway?.stopAccount) {
          return;
        }
        abort?.abort();
        if (plugin?.gateway?.stopAccount) {
          const account = plugin.config.resolveAccount(cfg, id);
          await plugin.gateway.stopAccount({
            cfg,
            accountId: id,
            account,
            runtime: channelRuntimeEnvs[channelId],
            abortSignal: abort?.signal ?? new AbortController().signal,
            log: channelLogs[channelId],
            getStatus: () => getRuntime(channelId, id),
            setStatus: (next) => setRuntime(channelId, id, next),
          });
        }
        try {
          await task;
        } catch {
          // ignore
        }
        store.aborts.delete(id);
        store.tasks.delete(id);
        setRuntime(channelId, id, {
          accountId: id,
          running: false,
          lastStopAt: Date.now(),
        });
      }),
    );
  };

  const startChannels = async () => {
    // Performance optimization: start channels in parallel instead of sequential
    const plugins = listChannelPlugins();
    await Promise.all(plugins.map((plugin) => startChannel(plugin.id)));
  };

  const markChannelLoggedOut = (channelId: ChannelId, cleared: boolean, accountId?: string) => {
    const plugin = getChannelPlugin(channelId);
    if (!plugin) {
      return;
    }
    const cfg = loadConfig();
    const resolvedId =
      accountId ??
      resolveChannelDefaultAccountId({
        plugin,
        cfg,
      });
    const current = getRuntime(channelId, resolvedId);
    const next: ChannelAccountSnapshot = {
      accountId: resolvedId,
      running: false,
      lastError: cleared ? "logged out" : current.lastError,
    };
    if (typeof current.connected === "boolean") {
      next.connected = false;
    }
    setRuntime(channelId, resolvedId, next);
  };

  const getRuntimeSnapshot = (): ChannelRuntimeSnapshot => {
    const cfg = loadConfig();
    const channels: ChannelRuntimeSnapshot["channels"] = {};
    const channelAccounts: ChannelRuntimeSnapshot["channelAccounts"] = {};
    for (const plugin of listChannelPlugins()) {
      const store = getStore(plugin.id);
      const accountIds = plugin.config.listAccountIds(cfg);
      const defaultAccountId = resolveChannelDefaultAccountId({
        plugin,
        cfg,
        accountIds,
      });
      const accounts: Record<string, ChannelAccountSnapshot> = {};
      for (const id of accountIds) {
        const account = plugin.config.resolveAccount(cfg, id);
        const enabled = plugin.config.isEnabled
          ? plugin.config.isEnabled(account, cfg)
          : isAccountEnabled(account);
        const described = plugin.config.describeAccount?.(account, cfg);
        const configured = described?.configured;
        const current = store.runtimes.get(id) ?? cloneDefaultRuntime(plugin.id, id);
        const next = { ...current, accountId: id };
        if (!next.running) {
          if (!enabled) {
            next.lastError ??= plugin.config.disabledReason?.(account, cfg) ?? "disabled";
          } else if (configured === false) {
            next.lastError ??= plugin.config.unconfiguredReason?.(account, cfg) ?? "not configured";
          }
        }
        accounts[id] = next;
      }
      const defaultAccount =
        accounts[defaultAccountId] ?? cloneDefaultRuntime(plugin.id, defaultAccountId);
      channels[plugin.id] = defaultAccount;
      channelAccounts[plugin.id] = accounts;
    }
    return { channels, channelAccounts };
  };

  return {
    getRuntimeSnapshot,
    startChannels,
    startChannel,
    stopChannel,
    markChannelLoggedOut,
  };
}

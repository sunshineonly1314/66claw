import type { CliDeps } from "../cli/deps.js";
import type { loadConfig } from "../config/config.js";
import type { loadOpenClawCNPlugins } from "../plugins/loader.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../agents/defaults.js";
import { loadModelCatalog } from "../agents/model-catalog.js";
import {
  getModelRefStatus,
  resolveConfiguredModelRef,
  resolveHooksGmailModel,
} from "../agents/model-selection.js";
import { startGmailWatcher } from "../hooks/gmail-watcher.js";
import {
  clearInternalHooks,
  createInternalHookEvent,
  triggerInternalHook,
} from "../hooks/internal-hooks.js";
import { loadInternalHooks } from "../hooks/loader.js";
import { isTruthyEnvValue } from "../infra/env.js";
import { type PluginServicesHandle, startPluginServices } from "../plugins/services.js";
import { startBrowserControlServerIfEnabled } from "./server-browser.js";
import {
  scheduleRestartSentinelWake,
  shouldWakeFromRestartSentinel,
} from "./server-restart-sentinel.js";
import { startGatewayMemoryBackend } from "./server-startup-memory.js";

export async function startGatewaySidecars(params: {
  cfg: ReturnType<typeof loadConfig>;
  pluginRegistry: ReturnType<typeof loadOpenClawCNPlugins>;
  defaultWorkspaceDir: string;
  deps: CliDeps;
  startChannels: () => Promise<void>;
  log: { warn: (msg: string) => void };
  logHooks: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  logChannels: { info: (msg: string) => void; error: (msg: string) => void };
  logBrowser: { error: (msg: string) => void };
}) {
  // ── Independent tasks: run in parallel ──────────────────────────────
  // These subsystems have NO cross-dependencies and each has its own
  // try/catch so a failure in one does not affect the others.

  const browserControlPromise = (async () => {
    try {
      return await startBrowserControlServerIfEnabled();
    } catch (err) {
      params.logBrowser.error(`server failed to start: ${String(err)}`);
      return null;
    }
  })();

  const gmailPromise = (async () => {
    if (isTruthyEnvValue(process.env.OPENCLAWCN_SKIP_GMAIL_WATCHER)) {
      return;
    }
    try {
      const gmailResult = await startGmailWatcher(params.cfg);
      if (gmailResult.started) {
        params.logHooks.info("gmail watcher started");
      } else if (
        gmailResult.reason &&
        gmailResult.reason !== "hooks not enabled" &&
        gmailResult.reason !== "no gmail account configured"
      ) {
        params.logHooks.warn(`gmail watcher not started: ${gmailResult.reason}`);
      }
    } catch (err) {
      params.logHooks.error(`gmail watcher failed to start: ${String(err)}`);
    }
    // Validate hooks.gmail.model if configured.
    if (params.cfg.hooks?.gmail?.model) {
      const hooksModelRef = resolveHooksGmailModel({
        cfg: params.cfg,
        defaultProvider: DEFAULT_PROVIDER,
      });
      if (hooksModelRef) {
        const { provider: defaultProvider, model: defaultModel } = resolveConfiguredModelRef({
          cfg: params.cfg,
          defaultProvider: DEFAULT_PROVIDER,
          defaultModel: DEFAULT_MODEL,
        });
        const catalog = await loadModelCatalog({ config: params.cfg });
        const status = getModelRefStatus({
          cfg: params.cfg,
          catalog,
          ref: hooksModelRef,
          defaultProvider,
          defaultModel,
        });
        if (!status.allowed) {
          params.logHooks.warn(
            `hooks.gmail.model "${status.key}" not in agents.defaults.models allowlist (will use primary instead)`,
          );
        }
        if (!status.inCatalog) {
          params.logHooks.warn(
            `hooks.gmail.model "${status.key}" not in the model catalog (may fail at runtime)`,
          );
        }
      }
    }
  })();

  const pluginServicesPromise = (async () => {
    try {
      return await startPluginServices({
        registry: params.pluginRegistry,
        config: params.cfg,
        workspaceDir: params.defaultWorkspaceDir,
      });
    } catch (err) {
      params.log.warn(`plugin services failed to start: ${String(err)}`);
      return null;
    }
  })();

  const mcpPromise = (async () => {
    try {
      const { initMCPManagerIfNeeded } = await import("../mcp/index.js");
      await initMCPManagerIfNeeded(params.cfg);
    } catch (err) {
      params.log.warn(`MCP manager initialization failed: ${String(err)}`);
    }
    try {
      const { syncMcpIndexBackground, startDailySyncScheduler } =
        await import("../mcp/marketplace-sync.js");
      syncMcpIndexBackground({ force: false });
      startDailySyncScheduler();
    } catch (err) {
      params.log.warn(`MCP marketplace sync startup failed: ${String(err)}`);
    }
  })();

  // ── Sequential: hooks must load before channels start ───────────────
  // Internal hooks are cleared+loaded, then channels start (channels may
  // depend on hook handlers being registered). This pair runs in parallel
  // with the independent tasks above.
  const hooksAndChannelsPromise = (async () => {
    try {
      clearInternalHooks();
      const loadedCount = await loadInternalHooks(params.cfg, params.defaultWorkspaceDir);
      if (loadedCount > 0) {
        params.logHooks.info(
          `loaded ${loadedCount} internal hook handler${loadedCount > 1 ? "s" : ""}`,
        );
      }
    } catch (err) {
      params.logHooks.error(`failed to load hooks: ${String(err)}`);
    }

    const skipChannels =
      isTruthyEnvValue(process.env.OPENCLAWCN_SKIP_CHANNELS) ||
      isTruthyEnvValue(process.env.OPENCLAWCN_SKIP_PROVIDERS);
    if (!skipChannels) {
      try {
        await params.startChannels();
      } catch (err) {
        params.logChannels.error(`channel startup failed: ${String(err)}`);
      }
    } else {
      params.logChannels.info(
        "skipping channel start (OPENCLAWCN_SKIP_CHANNELS=1 or OPENCLAWCN_SKIP_PROVIDERS=1)",
      );
    }
  })();

  // ── Wait for all parallel groups to settle ──────────────────────────
  const [browserControl, pluginServices] = await Promise.all([
    browserControlPromise,
    pluginServicesPromise,
  ]);
  await Promise.all([gmailPromise, mcpPromise, hooksAndChannelsPromise]);

  // ── Post-parallel (order-independent fire-and-forget tasks) ─────────
  if (params.cfg.hooks?.internal?.enabled) {
    setTimeout(() => {
      const hookEvent = createInternalHookEvent("gateway", "startup", "gateway:startup", {
        cfg: params.cfg,
        deps: params.deps,
        workspaceDir: params.defaultWorkspaceDir,
      });
      void triggerInternalHook(hookEvent);
    }, 250);
  }

  void startGatewayMemoryBackend({ cfg: params.cfg, log: params.log }).catch((err) => {
    params.log.warn(`qmd memory startup initialization failed: ${String(err)}`);
  });

  if (shouldWakeFromRestartSentinel()) {
    setTimeout(() => {
      void scheduleRestartSentinelWake({ deps: params.deps });
    }, 750);
  }

  return { browserControl, pluginServices };
}

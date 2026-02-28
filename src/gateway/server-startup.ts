import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
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
import { cleanStaleLockFiles } from "../agents/session-write-lock.js";
import { resolveStateDir } from "../config/paths.js";
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

const SESSION_LOCK_STALE_MS = 30 * 60 * 1000;

async function resolveAgentSessionDirs(stateDir: string): Promise<string[]> {
  const agentsDir = path.join(stateDir, "agents");
  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(agentsDir, { withFileTypes: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return [];
    }
    throw err;
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(agentsDir, entry.name, "sessions"))
    .toSorted((a, b) => a.localeCompare(b));
}

/**
 * After GPU sidecar starts, auto-bind audio/tts capability cards to GPU models
 * so the UI shows GPU models as active instead of SenseVoice/EdgeTTS.
 * Uses `auto: true` so user's manual selection won't be overridden.
 */
async function autoBindVoiceCapabilities(
  decision: { asrModel?: { id: string } | null; ttsModel?: { id: string } | null },
  log: { warn: (msg: string) => void },
): Promise<void> {
  try {
    const { loadConfig, writeConfigFile } = await import("../config/io.js");
    const config = structuredClone(loadConfig()) as Record<string, unknown>;
    let capObj = config.modelCapability as
      | { capabilities?: Record<string, { providerId: string; modelId: string; auto?: boolean }> }
      | undefined;
    if (!capObj) {
      capObj = { capabilities: {} };
      config.modelCapability = capObj;
    }
    if (!capObj.capabilities) capObj.capabilities = {};

    let changed = false;

    // Bind ASR → Qwen3 ASR (GPU) if user hasn't manually chosen
    if (decision.asrModel) {
      const existing = capObj.capabilities["audio"];
      if (!existing || existing.auto !== false) {
        capObj.capabilities["audio"] = {
          providerId: "local",
          modelId: decision.asrModel.id,
          auto: true,
        };
        changed = true;
      }
    }

    // TTS hidden in this release — skip auto-binding TTS capability card

    if (changed) {
      await writeConfigFile(config);
      log.warn(`auto-bound voice capability cards to GPU models (ASR=${decision.asrModel?.id})`);
    }
  } catch (err) {
    log.warn(`failed to auto-bind voice capabilities: ${String(err)}`);
  }
}

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
  // ── Cleanup stale session locks on startup ──────────────────────────
  try {
    const stateDir = resolveStateDir(process.env);
    const sessionDirs = await resolveAgentSessionDirs(stateDir);
    for (const sessionsDir of sessionDirs) {
      await cleanStaleLockFiles({
        sessionsDir,
        staleMs: SESSION_LOCK_STALE_MS,
        removeStale: true,
        log: { warn: (message) => params.log.warn(message) },
      });
    }
  } catch (err) {
    params.log.warn(`session lock cleanup failed on startup: ${String(err)}`);
  }

  // ── Proxy auto-discovery (best-effort, non-blocking) ────────────────
  // Probe common local proxy ports (Clash, V2Ray, etc.) so international
  // API calls work without users setting HTTPS_PROXY manually.
  // Only activates when user has configured an international provider.
  const INTERNATIONAL_PROVIDER_IDS = new Set([
    "openai",
    "anthropic",
    "google",
    "nvidia",
    "openrouter",
  ]);
  const configuredProviders = Object.keys(params.cfg?.models?.providers ?? {});
  const hasInternationalProvider = configuredProviders.some((id) =>
    INTERNATIONAL_PROVIDER_IDS.has(id),
  );
  const proxyDiscoveryPromise = (async () => {
    try {
      const { initProxyDiscovery } = await import("../infra/net/proxy-fetch.js");
      await initProxyDiscovery({ hasInternationalProvider });
    } catch (err) {
      params.log.warn(`proxy auto-discovery failed: ${String(err)}`);
    }
  })();

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

    // MCP marketplace: ensure bundled index is loaded into SQLite
    try {
      const { ensureMcpBaseline } = await import("../mcp/marketplace/db.js");
      const { resolveOpenClawCNPackageRootSync } = await import("../infra/openclaw-root.js");
      const packageRoot = resolveOpenClawCNPackageRootSync({ argv1: process.argv[1] });
      if (packageRoot) {
        const mcpCount = ensureMcpBaseline(packageRoot);
        if (mcpCount > 0) {
          params.log.warn(`MCP marketplace baseline synced: ${mcpCount} changes`);
        }
      }
    } catch (err) {
      params.log.warn(`MCP marketplace baseline import failed: ${String(err)}`);
    }

    // Bridge: sync baseline MCP items → tool-index.sqlite (non-blocking)
    // getAllItems() 使用 rowToItem() 将 snake_case 列正确转回 McpMarketplaceItem
    import("../mcp/marketplace/db.js")
      .then(async (mcpDb) => {
        const items = mcpDb.getAllItems();
        if (items.length === 0) return;
        const { syncMcpToToolIndex } = await import("../dispatch/tool-discovery.js");
        await syncMcpToToolIndex(items, {
          embedding: params.cfg.toolDiscovery?.embedding,
        });
      })
      .catch((err) => {
        params.log.warn(`MCP baseline→tool-index bridge failed (non-fatal): ${String(err)}`);
      });

    // Desktop mode: skip marketplace sync on startup (no external MCP sources needed).
    // MCP manager is still initialized above so on-demand loading works when configured.
    if (!isTruthyEnvValue(process.env.OPENCLAWCN_DESKTOP_MODE)) {
      try {
        const { syncMcpIndexBackground, startDailySyncScheduler } =
          await import("../mcp/marketplace-sync.js");
        syncMcpIndexBackground({ force: false });
        startDailySyncScheduler();
      } catch (err) {
        params.log.warn(`MCP marketplace sync startup failed: ${String(err)}`);
      }
    }
  })();

  // ── Skills marketplace: ensure QC baseline + background sync ─────────
  const skillsPromise = (async () => {
    try {
      const { ensureQcBaseline } = await import("../agents/skills/marketplace/db.js");
      const { resolveOpenClawCNPackageRootSync } = await import("../infra/openclaw-root.js");
      const packageRoot = resolveOpenClawCNPackageRootSync({ argv1: process.argv[1] });
      if (packageRoot) {
        const qcCount = ensureQcBaseline(packageRoot);
        if (qcCount > 0) {
          params.log.warn(`skills QC baseline imported: ${qcCount} skills`);
        }
      }
    } catch (err) {
      params.log.warn(`skills QC baseline import failed: ${String(err)}`);
    }
    // Background sync (non-blocking, fetches remote updates)
    try {
      const { syncSkillsIndexBackground } = await import("../agents/skills/sync.js");
      syncSkillsIndexBackground();
    } catch (err) {
      params.log.warn(`skills index background sync failed: ${String(err)}`);
    }
  })();

  // ── Tool-index: ensure bundled tool-index.sqlite is synced to user dir ──
  const toolIndexPromise = (async () => {
    try {
      const { ensureToolIndexBootstrap } = await import("../dispatch/tool-discovery.js");
      const { resolveOpenClawCNPackageRootSync } = await import("../infra/openclaw-root.js");
      const packageRoot = resolveOpenClawCNPackageRootSync({ argv1: process.argv[1] });
      if (packageRoot) {
        const result = ensureToolIndexBootstrap(packageRoot);
        if (result.copied) {
          params.log.warn(`tool-index bootstrap: ${result.message}`);
        }
      }
    } catch (err) {
      params.log.warn(`tool-index bootstrap failed: ${String(err)}`);
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
        `skipping channel start (OPENCLAWCN_SKIP_CHANNELS=1 or OPENCLAWCN_SKIP_PROVIDERS=1)`,
      );
    }
  })();

  // ── Wait for all parallel groups to settle ──────────────────────────
  const [browserControl, pluginServices] = await Promise.all([
    browserControlPromise,
    pluginServicesPromise,
    proxyDiscoveryPromise,
  ]);
  await Promise.all([
    gmailPromise,
    mcpPromise,
    skillsPromise,
    toolIndexPromise,
    hooksAndChannelsPromise,
  ]);

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

  // ── dmScope 自动检测（安全兜底）───────────────────────────────────
  void (async () => {
    try {
      const { getActivePluginRegistry } = await import("../plugins/runtime.js");
      const registry = getActivePluginRegistry();
      const channelPlugins = (registry?.channels ?? []).map((c) => c.plugin);
      if (channelPlugins.length > 0) {
        const { recommendDmScope, resolveAllowFromCounts } =
          await import("../session/dm-scope-auto.js");
        const allowFromCounts = await resolveAllowFromCounts(channelPlugins);
        const recommendation = recommendDmScope({
          cfg: params.cfg,
          plugins: channelPlugins,
          allowFromCounts,
        });
        if (recommendation.shouldUpgrade) {
          if (!recommendation.isExplicit) {
            // 未显式设置 -> 自动写入推荐值
            const { loadConfig: reloadCfg, writeConfigFile } = await import("../config/config.js");
            const freshCfg = reloadCfg();
            const patched = {
              ...freshCfg,
              session: {
                ...(freshCfg.session ?? {}),
                dmScope: recommendation.recommended,
              },
            };
            await writeConfigFile(patched as typeof freshCfg);
            params.log.warn(
              `dmScope auto-set to "${recommendation.recommended}" (reason: ${recommendation.reason})`,
            );
          } else {
            // 已显式设置但低于推荐 -> 仅警告
            params.log.warn(
              `dmScope is "${recommendation.current}" but "${recommendation.recommended}" is recommended (${recommendation.reason}). ` +
                `Run: openclawcn config set session.dmScope "${recommendation.recommended}"`,
            );
          }
        }
      }
    } catch {
      // Non-fatal: dmScope check is best-effort on startup
    }
  })();

  // ── Recover pending video generation tasks from previous session ────
  void (async () => {
    try {
      const { recoverPendingVideoTasks } = await import("../agents/tools/video-gen-tool.js");
      const recovered = await recoverPendingVideoTasks();
      if (recovered.length > 0) {
        params.log.warn(
          `Recovered ${recovered.length} pending video task(s) from previous session`,
        );
      }
    } catch (err) {
      params.log.warn(`video task recovery failed: ${String(err)}`);
    }
  })();

  void startGatewayMemoryBackend({ cfg: params.cfg, log: params.log }).catch((err) => {
    params.log.warn(`qmd memory startup initialization failed: ${String(err)}`);
  });

  // ── Auto-install recommended local voice models (ASR+TTS) on first run ──
  // Runs silently in the background. Detects hardware, checks if the
  // recommended tier is already installed, and if not installs + auto-starts.
  void (async () => {
    try {
      const { refreshHardwareSnapshot, getHardwareSnapshot } =
        await import("../voice/hardware-detect.js");
      const { classifyVoiceTier } = await import("../voice/voice-tier.js");
      const { isVoiceTierInstalled, installVoiceTier } = await import("../voice/voice-install.js");

      refreshHardwareSnapshot();
      const hw = getHardwareSnapshot();
      const decision = classifyVoiceTier(hw);

      if (decision.tier === "disabled") return; // hardware too weak

      if (isVoiceTierInstalled(decision.tier)) {
        // Already installed — just ensure sidecar is running for GPU tier
        if (
          decision.asrModel?.backend === "python-sidecar" ||
          decision.ttsModel?.backend === "python-sidecar"
        ) {
          const fs2 = await import("node:fs");
          const path2 = await import("node:path");
          const { startGpuSidecar } = await import("../voice/gpu-sidecar.js");
          const { VOICE_MODELS_DIR } = await import("../voice/voice-install.js");
          const asrOk =
            decision.asrModel &&
            fs2.existsSync(
              path2.join(VOICE_MODELS_DIR, decision.asrModel.modelDirName, "model.safetensors"),
            );
          const ttsOk =
            decision.ttsModel &&
            fs2.existsSync(
              path2.join(VOICE_MODELS_DIR, decision.ttsModel.modelDirName, "model.safetensors"),
            );
          if (asrOk || ttsOk) {
            const sidecarResult = await startGpuSidecar({
              ...decision,
              asrModel: asrOk ? decision.asrModel : null,
              ttsModel: ttsOk ? decision.ttsModel : null,
            });
            if (sidecarResult.ok) {
              await autoBindVoiceCapabilities(decision, params.log);
            }
          }
        }
        return;
      }

      // Not installed → auto-install silently
      params.log.warn(`auto-installing voice tier "${decision.tier}" (ASR+TTS)...`);
      const result = await installVoiceTier();
      if (result.ok) {
        params.log.warn(`voice tier "${decision.tier}" auto-install complete`);
        // Auto-start sidecar after successful GPU tier install
        if (result.decision.tier === "gpu-full" || result.decision.tier === "gpu-asr") {
          const { startGpuSidecar } = await import("../voice/gpu-sidecar.js");
          const sidecarResult = await startGpuSidecar(result.decision);
          if (sidecarResult.ok) {
            params.log.warn(`GPU sidecar auto-started after install`);
            await autoBindVoiceCapabilities(result.decision, params.log);
          } else {
            params.log.warn(`GPU sidecar auto-start failed: ${sidecarResult.error}`);
          }
        }
      } else {
        params.log.warn(`voice tier auto-install failed: ${result.error}`);
      }
    } catch (err) {
      params.log.warn(`voice auto-install failed: ${String(err)}`);
    }
  })();

  if (shouldWakeFromRestartSentinel()) {
    setTimeout(() => {
      void scheduleRestartSentinelWake({ deps: params.deps });
    }, 750);
  }

  return { browserControl, pluginServices };
}

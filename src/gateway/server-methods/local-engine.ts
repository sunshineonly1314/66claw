/**
 * Gateway RPC handlers for the unified Local AI Engine.
 *
 * Aggregates voice-tier, imagegen-tier, and hardware detection into a single
 * UI-friendly API surface. The model-config-view frontend calls these to
 * populate the "本地" Tab inside capability cards.
 *
 * Methods:
 *   local_engine.status          → aggregated hardware + all local model states
 *   local_engine.hardware        → hardware snapshot only
 *   local_engine.install         → install a single model by ID
 *   local_engine.install_recommended → one-click install all recommended models
 *   local_engine.uninstall       → uninstall a single model by ID
 *   local_engine.start           → start a sidecar for a model
 *   local_engine.stop            → stop a sidecar for a model
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

// ---------------------------------------------------------------------------
// Handler-level install lock to reject duplicate requests BEFORE responding
// ---------------------------------------------------------------------------
const _installingModels = new Set<string>();

// ---------------------------------------------------------------------------
// Types shared between gateway and UI
// ---------------------------------------------------------------------------

export type LocalModelRunMode = "gpu" | "cpu" | "online";

export type LocalModelStatus =
  | "not_available"
  | "installable"
  | "installing"
  | "installed"
  | "running";

export interface LocalModelItem {
  id: string;
  displayName: string;
  runMode: LocalModelRunMode;
  recommended: boolean;
  description: string;
  downloadSizeMB: number;
  runtimeMemoryMB: number;
  status: LocalModelStatus;
  /** Which capability this model serves: "audio" | "tts" | "imageGen" etc. */
  capability: string;
  unavailableReason?: string;
}

export interface LocalEngineStatus {
  hardware: {
    gpu: { vendor: string; name: string; vramTotalMB: number; vramFreeMB: number } | null;
    totalRamMB: number;
    freeRamMB: number;
    cpuModel: string;
    cpuCores: number;
    platform: string;
    arch: string;
  };
  /** All local models grouped by user-capability ID */
  models: Record<string, LocalModelItem[]>;
  summary: {
    runningCount: number;
    installedCount: number;
    totalDiskUsageMB: number;
  };
  voiceTier: string;
  imagegenTier: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildStatus(): Promise<LocalEngineStatus> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { getHardwareSnapshot } = await import("../../voice/hardware-detect.js");
  const { getVoiceSystemStatus } = await import("../../voice/voice-router.js");
  const { getImageGenSystemStatus } = await import("../../imagegen/imagegen-router.js");
  const { ALL_MODELS: VOICE_MODELS } = await import("../../voice/voice-models.js");
  const { ALL_MODELS: IMAGEGEN_MODELS, CPU_MODELS: IMAGEGEN_CPU_MODELS } =
    await import("../../imagegen/imagegen-models.js");
  const { VOICE_MODELS_DIR } = await import("../../voice/voice-install.js");
  const { getInstalledModelIds: getImageGenInstalledIds } =
    await import("../../imagegen/imagegen-install.js");

  const hw = getHardwareSnapshot();
  const voiceStatus = await getVoiceSystemStatus();
  const imagegenStatus = getImageGenSystemStatus();

  const voiceTier = voiceStatus.tier;
  const imagegenTier = imagegenStatus.tier;

  // Build model lists per user-capability
  const models: Record<string, LocalModelItem[]> = {};

  // --- Voice ASR models (capability: "audio") ---
  const asrModels: LocalModelItem[] = [];

  // GPU ASR
  const qwen3Asr = VOICE_MODELS["qwen3-asr-0.6b"];
  if (qwen3Asr) {
    const isRecommendedAsr = voiceTier.asrModel?.id === qwen3Asr.id;
    const isRunning =
      voiceStatus.gpuSidecar?.status === "running" && voiceStatus.gpuSidecar?.asrReady;
    // Check disk directly — getModelInstallStates only checks tier-recommended model
    const asrDir = path.join(VOICE_MODELS_DIR, qwen3Asr.modelDirName);
    const isInstalled =
      fs.existsSync(asrDir) && fs.existsSync(path.join(asrDir, "model.safetensors"));
    const hasEnoughVram = hw.gpu?.vendor === "nvidia" && hw.gpu.vramTotalMB * 0.7 >= 3500;

    asrModels.push({
      id: qwen3Asr.id,
      displayName: qwen3Asr.displayName,
      runMode: "gpu",
      recommended: isRecommendedAsr,
      description: "实时流式 · 中英混合 · 延迟<200ms",
      downloadSizeMB: qwen3Asr.downloadSizeMB,
      runtimeMemoryMB: qwen3Asr.estimatedMemoryMB,
      status: !hasEnoughVram
        ? "not_available"
        : isRunning
          ? "running"
          : isInstalled
            ? "installed"
            : "installable",
      capability: "audio",
      unavailableReason: !hasEnoughVram ? "需要 NVIDIA GPU (3.5GB+ VRAM)" : undefined,
    });
  }

  // CPU ASR
  const sensevoice = VOICE_MODELS["sensevoice-small"];
  if (sensevoice) {
    const isRecommendedAsr = voiceTier.asrModel?.id === sensevoice.id;
    // getModelInstallStates only checks the tier-recommended model.
    // SenseVoice might be installed independently (e.g. user on GPU tier still
    // wants a CPU fallback). Check disk directly for reliable detection.
    const svDir = path.join(VOICE_MODELS_DIR, sensevoice.modelDirName);
    // Also check legacy path: tools/sherpa-onnx-asr/models/<modelDirName>/
    const legacySvDir = path.join(
      VOICE_MODELS_DIR,
      "..",
      "tools",
      "sherpa-onnx-asr",
      "models",
      sensevoice.modelDirName,
    );
    const checkInstalled = (dir: string) =>
      fs.existsSync(dir) &&
      fs.existsSync(path.join(dir, "model.int8.onnx")) &&
      fs.existsSync(path.join(dir, "tokens.txt"));
    const actuallyInstalled = checkInstalled(svDir) || checkInstalled(legacySvDir);
    const hasEnoughRam = hw.freeRamMB * 0.7 >= 450;

    asrModels.push({
      id: sensevoice.id,
      displayName: sensevoice.displayName,
      runMode: "cpu",
      recommended: isRecommendedAsr,
      description: "离线可用 · 中英日韩 · 较慢",
      downloadSizeMB: sensevoice.downloadSizeMB,
      runtimeMemoryMB: sensevoice.estimatedMemoryMB,
      status: !hasEnoughRam ? "not_available" : actuallyInstalled ? "installed" : "installable",
      capability: "audio",
      unavailableReason: !hasEnoughRam ? "需要 450MB+ 可用内存" : undefined,
    });
  }

  models["voice"] = asrModels;

  // --- Voice TTS models — HIDDEN in this release (TTS not ready for production) ---
  // TTS models (Qwen3-TTS, Kokoro, Edge TTS) are intentionally excluded from the
  // local model hub. The underlying code is preserved for future re-enablement.

  // --- KWS (wake word) model (capability: "audio") ---
  const kws = VOICE_MODELS["kws-zipformer-zh-en-3m"];
  if (kws) {
    const kwsDir = path.join(VOICE_MODELS_DIR, kws.modelDirName);
    const kwsInstalled =
      fs.existsSync(kwsDir) &&
      kws.files.length > 0 &&
      fs.existsSync(path.join(kwsDir, kws.files[0].relativePath));

    models["voice"]!.push({
      id: kws.id,
      displayName: kws.displayName,
      runMode: "cpu",
      recommended: false, // KWS is auto-bundled with CPU voice tier, not independently recommended
      description: "唤醒词检测 · 中英 · 极轻量 (6MB)",
      downloadSizeMB: kws.downloadSizeMB,
      runtimeMemoryMB: kws.estimatedMemoryMB,
      status: kwsInstalled ? "installed" : "installable",
      capability: "audio",
    });
  }

  // --- ImageGen models (capability: "imageGen") ---
  const imagegenModels: LocalModelItem[] = [];
  const installedImagegenIds = new Set(getImageGenInstalledIds());
  const sidecarRunning = imagegenStatus.sidecar?.status === "running";

  // Build a set of CPU model IDs from the canonical CPU_MODELS export
  const imagegenCpuIds = new Set(Object.values(IMAGEGEN_CPU_MODELS).map((m) => m.id));

  for (const [id, model] of Object.entries(IMAGEGEN_MODELS)) {
    const isRecommended = imagegenTier.model?.id === id;
    const isInstalled = installedImagegenIds.has(id);
    const isCpu = imagegenCpuIds.has(id);
    const isGpu = !isCpu;

    let status: LocalModelStatus = "installable";
    let unavailableReason: string | undefined;

    if (isGpu) {
      const hasEnoughVram =
        hw.gpu?.vendor === "nvidia" && hw.gpu.vramTotalMB * 0.7 >= model.estimatedMemoryMB;
      if (!hasEnoughVram) {
        status = "not_available";
        unavailableReason = `需要 NVIDIA GPU (${Math.ceil(model.estimatedMemoryMB / 1024)}GB+ VRAM)`;
      } else if (sidecarRunning && imagegenStatus.sidecar?.modelId === id) {
        status = "running";
      } else if (isInstalled) {
        status = "installed";
      }
    } else {
      // CPU model
      const hasEnoughRam = hw.freeRamMB * 0.7 >= model.estimatedMemoryMB;
      if (!hasEnoughRam) {
        status = "not_available";
        unavailableReason = `需要 ${Math.ceil(model.estimatedMemoryMB / 1024)}GB+ 可用内存`;
      } else if (isInstalled) {
        status = "installed";
      }
    }

    imagegenModels.push({
      id,
      displayName: model.displayName,
      runMode: isCpu ? "cpu" : "gpu",
      recommended: isRecommended,
      description: model.defaultSize
        ? `${model.defaultSize} · ${isCpu ? "~60秒/张 · 纯离线" : id.includes("turbo") ? "极速1步 · ~3秒/张" : "高质量 · ~10秒/张"}`
        : "",
      downloadSizeMB: model.downloadSizeMB,
      runtimeMemoryMB: model.estimatedMemoryMB,
      status,
      capability: "imageGen",
      unavailableReason,
    });
  }

  models["image"] = imagegenModels;

  // --- Summary ---
  const allModels = Object.values(models).flat();
  const runningCount = allModels.filter(
    (m) => m.status === "running" && m.runMode !== "online",
  ).length;
  const installedCount = allModels.filter(
    (m) => m.status === "installed" || m.status === "running",
  ).length;
  const totalDiskUsageMB = allModels
    .filter((m) => m.status === "installed" || m.status === "running")
    .reduce((sum, m) => sum + m.downloadSizeMB, 0);

  return {
    hardware: {
      gpu: hw.gpu
        ? {
            vendor: hw.gpu.vendor,
            name: hw.gpu.name,
            vramTotalMB: hw.gpu.vramTotalMB,
            vramFreeMB: hw.gpu.vramFreeMB,
          }
        : null,
      totalRamMB: hw.totalRamMB,
      freeRamMB: hw.freeRamMB,
      cpuModel: hw.cpuModel,
      cpuCores: hw.cpuCores,
      platform: hw.platform,
      arch: hw.arch,
    },
    models,
    summary: { runningCount, installedCount, totalDiskUsageMB },
    voiceTier: voiceTier.tier,
    imagegenTier: imagegenTier.tier,
  };
}

// ---------------------------------------------------------------------------
// RPC Handlers
// ---------------------------------------------------------------------------

export const localEngineHandlers: GatewayRequestHandlers = {
  /**
   * Get comprehensive local engine status (hardware + all model states).
   */
  "local_engine.status": async ({ respond }) => {
    try {
      const status = await buildStatus();
      respond(true, status);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Get hardware snapshot only (lighter than full status).
   */
  "local_engine.hardware": async ({ respond }) => {
    try {
      const { getHardwareSnapshot } = await import("../../voice/hardware-detect.js");
      const hw = getHardwareSnapshot();
      respond(true, hw);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Force re-detect hardware.
   */
  "local_engine.redetect": async ({ respond }) => {
    try {
      const { refreshHardwareSnapshot } = await import("../../voice/hardware-detect.js");
      const hw = refreshHardwareSnapshot();
      respond(true, hw);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Install a single model by ID. Streams progress via broadcast.
   */
  "local_engine.install": async ({ params, respond, context, client }) => {
    try {
      const modelId = params?.modelId as string;
      if (!modelId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing modelId"));
        return;
      }

      // Reject duplicate installs BEFORE responding success
      if (_installingModels.has(modelId)) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "该模型正在安装中"));
        return;
      }

      const connIds = client?.connId ? new Set([client.connId]) : undefined;
      const broadcastProgress = (event: string, payload: unknown) => {
        if (connIds) {
          context.broadcastToConnIds(event, payload, connIds);
        } else {
          context.broadcast(event, payload);
        }
      };

      _installingModels.add(modelId);

      // Respond immediately, then stream progress
      respond(true, { started: true, modelId });

      // Route to the correct install function
      const { ALL_MODELS: VOICE_MODELS } = await import("../../voice/voice-models.js");
      const { ALL_MODELS: IMAGEGEN_MODELS } = await import("../../imagegen/imagegen-models.js");

      if (VOICE_MODELS[modelId]) {
        const { installSingleVoiceModel } = await import("../../voice/voice-install.js");
        const result = await installSingleVoiceModel(modelId, (progress) => {
          broadcastProgress("local_engine.progress", { modelId, ...progress });
        });

        broadcastProgress("local_engine.progress", {
          modelId,
          stage: result.ok ? "complete" : "failed",
          percent: result.ok ? 100 : 0,
          message: result.ok ? "安装完成" : (result.error ?? "安装失败"),
          error: result.error,
        });

        // Auto-start GPU sidecar if a python-sidecar model was installed.
        // The tier decision may reference models not yet installed (e.g. gpu-full
        // recommends ASR+TTS but only ASR was just installed). Strip absent models
        // so the sidecar doesn't try to load missing weights.
        if (result.ok && VOICE_MODELS[modelId]!.backend === "python-sidecar") {
          try {
            const fs2 = await import("node:fs");
            const path2 = await import("node:path");
            const { getHardwareSnapshot } = await import("../../voice/hardware-detect.js");
            const { classifyVoiceTier } = await import("../../voice/voice-tier.js");
            const { startGpuSidecar } = await import("../../voice/gpu-sidecar.js");
            const { VOICE_MODELS_DIR: vDir } = await import("../../voice/voice-install.js");
            const hw = getHardwareSnapshot();
            const decision = classifyVoiceTier(hw);
            // Only include models that are actually on disk
            const asrOk =
              decision.asrModel &&
              fs2.existsSync(path2.join(vDir, decision.asrModel.modelDirName, "model.safetensors"));
            const ttsOk =
              decision.ttsModel &&
              fs2.existsSync(path2.join(vDir, decision.ttsModel.modelDirName, "model.safetensors"));
            if (asrOk || ttsOk) {
              const safeDecision = {
                ...decision,
                asrModel: asrOk ? decision.asrModel : null,
                ttsModel: ttsOk ? decision.ttsModel : null,
              };
              await startGpuSidecar(safeDecision);
            }
          } catch {
            /* non-fatal */
          }
        }
      } else if (IMAGEGEN_MODELS[modelId]) {
        const { installSingleImageGenModel } = await import("../../imagegen/imagegen-install.js");
        const result = await installSingleImageGenModel(modelId, (progress) => {
          broadcastProgress("local_engine.progress", { modelId, ...progress });
        });

        broadcastProgress("local_engine.progress", {
          modelId,
          stage: result.ok ? "complete" : "failed",
          percent: result.ok ? 100 : 0,
          message: result.ok ? "安装完成" : (result.error ?? "安装失败"),
          error: result.error,
        });

        // Auto-start sidecar — refresh tier cache first so it sees the
        // newly-installed model (getImageGenTierDecision is lazy-cached).
        if (result.ok) {
          try {
            const { refreshImageGenTierStatus } = await import("../../imagegen/imagegen-router.js");
            const { startSdCppSidecar } = await import("../../imagegen/sd-cpp-sidecar.js");
            const decision = refreshImageGenTierStatus();
            await startSdCppSidecar(decision);
          } catch {
            /* non-fatal */
          }
        }
      } else {
        broadcastProgress("local_engine.progress", {
          modelId,
          stage: "failed",
          percent: 0,
          message: `未知的模型 ID: ${modelId}`,
          error: `Unknown model: ${modelId}`,
        });
      }
    } catch (err) {
      context.logGateway.error(`local_engine.install error: ${formatForLog(err)}`);
    } finally {
      const modelId = (params?.modelId as string) ?? "";
      _installingModels.delete(modelId);
    }
  },

  /**
   * One-click install all recommended models for the current hardware tier.
   */
  "local_engine.install_recommended": async ({ respond, context, client }) => {
    try {
      const connIds = client?.connId ? new Set([client.connId]) : undefined;
      const broadcastProgress = (payload: unknown) => {
        if (connIds) {
          context.broadcastToConnIds("local_engine.progress", payload, connIds);
        } else {
          context.broadcast("local_engine.progress", payload);
        }
      };

      respond(true, { started: true });

      const errors: string[] = [];

      // Voice tier install (0-60%)
      broadcastProgress({
        modelId: "_recommended",
        stage: "detecting-hardware",
        percent: 0,
        message: "正在检测硬件...",
      });
      const { installVoiceTier } = await import("../../voice/voice-install.js");
      const voiceResult = await installVoiceTier((progress) => {
        broadcastProgress({
          modelId: "_recommended",
          ...progress,
          percent: Math.round(progress.percent * 0.6),
        });
      });

      if (!voiceResult.ok) {
        errors.push(`语音: ${voiceResult.error}`);
        broadcastProgress({
          modelId: "_recommended",
          stage: "voice-failed",
          percent: 55,
          message: `语音模型安装失败，继续安装图像模型...`,
        });
      }

      // ImageGen tier install (60-100%) — always attempt, even if voice failed
      const { installImageGenTier } = await import("../../imagegen/imagegen-install.js");
      const imagegenResult = await installImageGenTier((progress) => {
        broadcastProgress({
          modelId: "_recommended",
          ...progress,
          percent: 60 + Math.round(progress.percent * 0.4),
        });
      });

      if (!imagegenResult.ok) {
        errors.push(`图像: ${imagegenResult.error}`);
      }

      // Auto-start sidecars for successfully installed tiers (same as single install)
      if (voiceResult.ok) {
        try {
          const fs2 = await import("node:fs");
          const path2 = await import("node:path");
          const { getHardwareSnapshot } = await import("../../voice/hardware-detect.js");
          const { classifyVoiceTier } = await import("../../voice/voice-tier.js");
          const { startGpuSidecar } = await import("../../voice/gpu-sidecar.js");
          const { VOICE_MODELS_DIR: vDir } = await import("../../voice/voice-install.js");
          const hw = getHardwareSnapshot();
          const decision = classifyVoiceTier(hw);
          if (
            decision.asrModel?.backend === "python-sidecar" ||
            decision.ttsModel?.backend === "python-sidecar"
          ) {
            const asrOk =
              decision.asrModel &&
              fs2.existsSync(path2.join(vDir, decision.asrModel.modelDirName, "model.safetensors"));
            const ttsOk =
              decision.ttsModel &&
              fs2.existsSync(path2.join(vDir, decision.ttsModel.modelDirName, "model.safetensors"));
            if (asrOk || ttsOk) {
              await startGpuSidecar({
                ...decision,
                asrModel: asrOk ? decision.asrModel : null,
                ttsModel: ttsOk ? decision.ttsModel : null,
              });
            }
          }
        } catch {
          /* non-fatal */
        }
      }
      if (imagegenResult.ok) {
        try {
          const { refreshImageGenTierStatus } = await import("../../imagegen/imagegen-router.js");
          const { startSdCppSidecar } = await import("../../imagegen/sd-cpp-sidecar.js");
          const decision = refreshImageGenTierStatus();
          await startSdCppSidecar(decision);
        } catch {
          /* non-fatal */
        }
      }

      const allOk = errors.length === 0;
      broadcastProgress({
        modelId: "_recommended",
        stage: allOk ? "complete" : "failed",
        percent: allOk ? 100 : imagegenResult.ok ? 60 : 100,
        message: allOk ? "所有推荐模型安装完成" : `部分安装失败: ${errors.join("; ")}`,
        error: allOk ? undefined : errors.join("; "),
      });
    } catch (err) {
      context.logGateway.error(`local_engine.install_recommended error: ${formatForLog(err)}`);
    }
  },

  /**
   * Uninstall a model by ID.
   */
  "local_engine.uninstall": async ({ params, respond }) => {
    try {
      const modelId = params?.modelId as string;
      if (!modelId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing modelId"));
        return;
      }

      const { ALL_MODELS: VOICE_MODELS } = await import("../../voice/voice-models.js");
      const { ALL_MODELS: IMAGEGEN_MODELS } = await import("../../imagegen/imagegen-models.js");

      if (VOICE_MODELS[modelId]) {
        // Stop the GPU sidecar first if it's running — the sidecar holds model
        // weights in memory and on Windows the files are locked by the process.
        // Without stopping first, fs.rmSync fails with EBUSY on Windows and
        // triggers crash-restart loops on Linux.
        const model = VOICE_MODELS[modelId]!;
        if (model.backend === "python-sidecar") {
          try {
            const { getGpuSidecarState } = await import("../../voice/gpu-sidecar.js");
            const state = getGpuSidecarState();
            if (state.status === "running" || state.status === "starting") {
              const { stopGpuSidecar } = await import("../../voice/gpu-sidecar.js");
              await stopGpuSidecar();
            }
          } catch {
            /* best-effort */
          }
        }
        const { uninstallVoiceModel } = await import("../../voice/voice-install.js");
        const result = uninstallVoiceModel(modelId);
        respond(
          result.ok,
          result.ok ? { modelId } : undefined,
          result.ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, result.error ?? ""),
        );
      } else if (IMAGEGEN_MODELS[modelId]) {
        // Stop the sd.cpp sidecar first — it memory-maps the model file,
        // which locks it on Windows and causes EBUSY on rm.
        try {
          const { getSdCppSidecarState } = await import("../../imagegen/sd-cpp-sidecar.js");
          const state = getSdCppSidecarState();
          if (state.status === "running" || state.status === "starting") {
            const { stopSdCppSidecar } = await import("../../imagegen/sd-cpp-sidecar.js");
            await stopSdCppSidecar();
          }
        } catch {
          /* best-effort */
        }
        const { uninstallImageGenModel } = await import("../../imagegen/imagegen-install.js");
        const result = uninstallImageGenModel(modelId);
        respond(
          result.ok,
          result.ok ? { modelId } : undefined,
          result.ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, result.error ?? ""),
        );
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Unknown model: ${modelId}`),
        );
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Start a sidecar for a model domain (voice or imagegen).
   */
  "local_engine.start": async ({ params, respond }) => {
    try {
      const domain = params?.domain as string; // "voice" | "imagegen"
      if (domain === "voice") {
        const { getHardwareSnapshot } = await import("../../voice/hardware-detect.js");
        const { classifyVoiceTier } = await import("../../voice/voice-tier.js");
        const { startGpuSidecar } = await import("../../voice/gpu-sidecar.js");
        const { VOICE_MODELS_DIR } = await import("../../voice/voice-install.js");
        const fs2 = await import("node:fs");
        const path2 = await import("node:path");
        const hw = getHardwareSnapshot();
        const decision = classifyVoiceTier(hw);
        // Only include models that are actually installed on disk (same guard as install handler)
        const vDir = VOICE_MODELS_DIR;
        const asrOk =
          decision.asrModel &&
          fs2.existsSync(path2.join(vDir, decision.asrModel.modelDirName, "model.safetensors"));
        const ttsOk =
          decision.ttsModel &&
          fs2.existsSync(path2.join(vDir, decision.ttsModel.modelDirName, "model.safetensors"));
        if (!asrOk && !ttsOk) {
          respond(
            false,
            undefined,
            errorShape(ErrorCodes.UNAVAILABLE, "No GPU voice models installed on disk"),
          );
          return;
        }
        const safeDecision = {
          ...decision,
          asrModel: asrOk ? decision.asrModel : null,
          ttsModel: ttsOk ? decision.ttsModel : null,
        };
        const result = await startGpuSidecar(safeDecision);
        respond(
          result.ok,
          result,
          result.ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, result.error ?? ""),
        );
      } else if (domain === "imagegen") {
        const { refreshImageGenTierStatus } = await import("../../imagegen/imagegen-router.js");
        const { startSdCppSidecar } = await import("../../imagegen/sd-cpp-sidecar.js");
        const decision = refreshImageGenTierStatus();
        const result = await startSdCppSidecar(decision);
        respond(
          result.ok,
          result,
          result.ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, result.error ?? ""),
        );
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Unknown domain: ${domain}`),
        );
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Stop a sidecar for a model domain.
   */
  "local_engine.stop": async ({ params, respond }) => {
    try {
      const domain = params?.domain as string;
      if (domain === "voice") {
        const { stopGpuSidecar } = await import("../../voice/gpu-sidecar.js");
        await stopGpuSidecar();
        respond(true, { status: "stopped" });
      } else if (domain === "imagegen") {
        const { stopSdCppSidecar } = await import("../../imagegen/sd-cpp-sidecar.js");
        await stopSdCppSidecar();
        respond(true, { status: "stopped" });
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Unknown domain: ${domain}`),
        );
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
};

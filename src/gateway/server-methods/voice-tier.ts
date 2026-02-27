/**
 * Gateway RPC handlers for voice tier system.
 *
 * Methods:
 *   voice.tier.status   → full system status (hardware, tier, install state, sidecar)
 *   voice.tier.detect   → force re-detect hardware and reclassify
 *   voice.tier.install  → one-click install, streams progress events
 *   voice.sidecar.start → manually start GPU sidecar
 *   voice.sidecar.stop  → manually stop GPU sidecar
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

export const voiceTierHandlers: GatewayRequestHandlers = {
  /**
   * Get comprehensive voice system status.
   */
  "voice.tier.status": async ({ respond }) => {
    try {
      const { getVoiceSystemStatus } = await import("../../voice/voice-router.js");
      const status = await getVoiceSystemStatus();
      respond(true, status);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Force re-detect hardware and reclassify voice tier.
   */
  "voice.tier.detect": async ({ respond }) => {
    try {
      const { refreshVoiceTierStatus } = await import("../../voice/voice-router.js");
      const decision = refreshVoiceTierStatus();
      respond(true, decision);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * One-click install for the detected voice tier.
   * Streams progress events via voice.tier.progress broadcast.
   */
  "voice.tier.install": async ({ respond, context, client }) => {
    try {
      const { installVoiceTier } = await import("../../voice/voice-install.js");

      // Determine which connIds to push progress to
      const connIds = client?.connId ? new Set([client.connId]) : undefined;

      const onProgress = (progress: import("../../voice/types.js").VoiceInstallProgress) => {
        if (connIds) {
          context.broadcastToConnIds("voice.tier.progress", progress, connIds);
        } else {
          context.broadcast("voice.tier.progress", progress);
        }
      };

      // Start install (non-blocking — respond immediately, then stream progress)
      respond(true, { started: true });

      const result = await installVoiceTier(onProgress);

      // Final progress event
      if (connIds) {
        context.broadcastToConnIds(
          "voice.tier.progress",
          {
            stage: result.ok ? "complete" : "failed",
            percent: result.ok ? 100 : 0,
            message: result.ok ? "安装完成" : (result.error ?? "安装失败"),
            error: result.error,
          },
          connIds,
        );
      }

      // Auto-start sidecar after successful GPU tier install
      if (
        result.ok &&
        (result.decision.tier === "gpu-full" || result.decision.tier === "gpu-asr")
      ) {
        const { startGpuSidecar } = await import("../../voice/gpu-sidecar.js");
        const sidecarResult = await startGpuSidecar(result.decision);
        if (!sidecarResult.ok) {
          context.logGateway.warn(
            `GPU sidecar auto-start after install failed: ${sidecarResult.error}`,
          );
        }
      }
    } catch (err) {
      // The initial respond was already sent, so we can only log
      context.logGateway.error(`voice.tier.install error: ${formatForLog(err)}`);
    }
  },

  /**
   * Manually start the GPU voice sidecar.
   */
  "voice.sidecar.start": async ({ respond }) => {
    try {
      const { getHardwareSnapshot } = await import("../../voice/hardware-detect.js");
      const { classifyVoiceTier } = await import("../../voice/voice-tier.js");
      const { startGpuSidecar } = await import("../../voice/gpu-sidecar.js");

      const hw = getHardwareSnapshot();
      const decision = classifyVoiceTier(hw);

      if (decision.tier !== "gpu-full" && decision.tier !== "gpu-asr") {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "当前硬件不支持 GPU 语音模式"),
        );
        return;
      }

      const result = await startGpuSidecar(decision);
      if (result.ok) {
        respond(true, { status: "running" });
      } else {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, result.error ?? "启动失败"));
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Stop the GPU voice sidecar.
   */
  "voice.sidecar.stop": async ({ respond }) => {
    try {
      const { stopGpuSidecar } = await import("../../voice/gpu-sidecar.js");
      await stopGpuSidecar();
      respond(true, { status: "stopped" });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Get user voice backend preferences.
   */
  "voice.prefs.get": async ({ respond }) => {
    try {
      const { loadVoicePrefs } = await import("../../voice/voice-prefs.js");
      const prefs = await loadVoicePrefs();
      respond(true, prefs);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Set user voice backend preferences.
   */
  "voice.prefs.set": async ({ params, respond }) => {
    try {
      const { setVoicePrefs } = await import("../../voice/voice-prefs.js");
      const patch: Record<string, unknown> = {};
      if (typeof params.asrProvider === "string") patch.asrProvider = params.asrProvider;
      if (typeof params.asrModel === "string") patch.asrModel = params.asrModel;
      if (typeof params.ttsProvider === "string") patch.ttsProvider = params.ttsProvider;
      if (typeof params.ttsModel === "string") patch.ttsModel = params.ttsModel;
      if (typeof params.ttsVoice === "string") patch.ttsVoice = params.ttsVoice;
      const prefs = await setVoicePrefs(patch);

      // Return updated status so UI can refresh
      const { getVoiceSystemStatus } = await import("../../voice/voice-router.js");
      const status = await getVoiceSystemStatus();
      respond(true, { prefs, status });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * List available API providers for ASR/TTS with their configuration status.
   */
  "voice.api.providers": async ({ respond }) => {
    try {
      const { collectProviderApiKeys } = await import("../../agents/live-auth-keys.js");

      const asrProviders = [
        { id: "openai", label: "OpenAI Whisper", defaultModel: "gpt-4o-mini-transcribe" },
        { id: "groq", label: "Groq (免费)", defaultModel: "whisper-large-v3-turbo" },
        { id: "deepgram", label: "Deepgram", defaultModel: "nova-3" },
        { id: "google", label: "Google Gemini", defaultModel: "gemini-3-flash-preview" },
        { id: "dashscope", label: "DashScope (阿里)", defaultModel: "fun-asr-realtime" },
        { id: "volcengine", label: "火山引擎 (豆包)", defaultModel: "asr" },
      ].map((p) => ({
        ...p,
        configured: collectProviderApiKeys(p.id).length > 0,
      }));

      // TTS hidden in this release
      const ttsProviders: unknown[] = [];

      respond(true, { asrProviders, ttsProviders });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
};

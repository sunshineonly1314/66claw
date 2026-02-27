/**
 * Gateway RPC handlers for image generation tier system.
 *
 * Methods:
 *   imagegen.tier.status   -> full system status (hardware, tier, install state, sidecar)
 *   imagegen.tier.detect   -> force re-detect hardware and reclassify
 *   imagegen.tier.install  -> one-click install, streams progress events
 *   imagegen.sidecar.start -> manually start sd.cpp sidecar
 *   imagegen.sidecar.stop  -> manually stop sd.cpp sidecar
 *
 * Pattern follows voice-tier.ts.
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

export const imagegenTierHandlers: GatewayRequestHandlers = {
  /**
   * Get comprehensive image generation system status.
   */
  "imagegen.tier.status": async ({ respond }) => {
    try {
      const { getImageGenSystemStatus } = await import("../../imagegen/imagegen-router.js");
      const status = getImageGenSystemStatus();
      respond(true, status);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Force re-detect hardware and reclassify image generation tier.
   */
  "imagegen.tier.detect": async ({ respond }) => {
    try {
      const { refreshImageGenTierStatus } = await import("../../imagegen/imagegen-router.js");
      const decision = refreshImageGenTierStatus();
      respond(true, decision);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * One-click install for the detected image generation tier.
   * Streams progress events via imagegen.tier.progress broadcast.
   */
  "imagegen.tier.install": async ({ respond, context, client }) => {
    try {
      const { installImageGenTier } = await import("../../imagegen/imagegen-install.js");

      // Determine which connIds to push progress to
      const connIds = client?.connId ? new Set([client.connId]) : undefined;

      const onProgress = (progress: import("../../imagegen/types.js").ImageGenInstallProgress) => {
        if (connIds) {
          context.broadcastToConnIds("imagegen.tier.progress", progress, connIds);
        } else {
          context.broadcast("imagegen.tier.progress", progress);
        }
      };

      // Start install (non-blocking -- respond immediately, then stream progress)
      respond(true, { started: true });

      const result = await installImageGenTier(onProgress);

      // Final progress event
      if (connIds) {
        context.broadcastToConnIds(
          "imagegen.tier.progress",
          {
            stage: result.ok ? "complete" : "failed",
            percent: result.ok ? 100 : 0,
            message: result.ok ? "安装完成" : (result.error ?? "安装失败"),
            error: result.error,
          },
          connIds,
        );
      }

      // Auto-start sidecar after successful local tier install
      if (result.ok && result.decision.tier !== "api-only" && result.decision.tier !== "disabled") {
        try {
          const { startSdCppSidecar } = await import("../../imagegen/sd-cpp-sidecar.js");
          const sidecarResult = await startSdCppSidecar(result.decision);
          if (!sidecarResult.ok) {
            // Log but don't fail -- sidecar can be started manually
            const { createSubsystemLogger } = await import("../../logging/subsystem.js");
            const log = createSubsystemLogger("imagegen/gateway");
            log.warn(`Auto-start sidecar failed: ${sidecarResult.error}`);
          }
        } catch (err) {
          // Log but don't fail
          const { createSubsystemLogger } = await import("../../logging/subsystem.js");
          const log = createSubsystemLogger("imagegen/gateway");
          log.warn(`Auto-start sidecar error: ${formatForLog(err)}`);
        }
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Manually start the sd.cpp sidecar.
   */
  "imagegen.sidecar.start": async ({ respond }) => {
    try {
      const { getImageGenTierDecision } = await import("../../imagegen/imagegen-router.js");
      const { startSdCppSidecar } = await import("../../imagegen/sd-cpp-sidecar.js");
      const { tierUsesSidecar } = await import("../../imagegen/imagegen-tier.js");

      const decision = getImageGenTierDecision();
      if (!tierUsesSidecar(decision.tier)) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `Tier "${decision.tier}" does not use a local sidecar`,
          ),
        );
        return;
      }

      const result = await startSdCppSidecar(decision);
      respond(true, result);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Manually stop the sd.cpp sidecar.
   */
  "imagegen.sidecar.stop": async ({ respond }) => {
    try {
      const { stopSdCppSidecar, getSdCppSidecarState } =
        await import("../../imagegen/sd-cpp-sidecar.js");
      await stopSdCppSidecar();
      respond(true, { ok: true, state: getSdCppSidecarState() });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
};

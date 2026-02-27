/**
 * ImageGen Router -- unified facade for image generation system.
 *
 * Provides:
 *   - Aggregated system status
 *   - Tier detection and caching
 *   - Routes image gen requests to local sidecar or cloud API
 *   - Auto-start sidecar when needed
 *
 * Pattern follows voice/voice-router.ts.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import { getHardwareSnapshot, refreshHardwareSnapshot } from "../voice/hardware-detect.js";
import { classifyImageGenTier, tierUsesSidecar } from "./imagegen-tier.js";
import { getSdCppSidecarState } from "./sd-cpp-sidecar.js";
import { getInstalledModelIds, isSdCppAvailable } from "./imagegen-install.js";
import type { ImageGenSystemStatus, ImageGenTierDecision } from "./types.js";

const log = createSubsystemLogger("imagegen/router");

// ---------------------------------------------------------------------------
// Cached Tier Decision
// ---------------------------------------------------------------------------

let _cachedDecision: ImageGenTierDecision | null = null;

/**
 * Get current tier decision (lazy-init from hardware snapshot).
 */
export function getImageGenTierDecision(): ImageGenTierDecision {
  if (!_cachedDecision) {
    const hw = getHardwareSnapshot();
    _cachedDecision = classifyImageGenTier(hw);
  }
  return _cachedDecision;
}

/**
 * Force re-detect hardware and reclassify tier.
 */
export function refreshImageGenTierStatus(): ImageGenTierDecision {
  const hw = refreshHardwareSnapshot();
  _cachedDecision = classifyImageGenTier(hw);
  log.info(`ImageGen tier refreshed: ${_cachedDecision.tier} — ${_cachedDecision.reason}`);
  return _cachedDecision;
}

// ---------------------------------------------------------------------------
// System Status
// ---------------------------------------------------------------------------

/**
 * Get comprehensive image generation system status.
 */
export function getImageGenSystemStatus(): ImageGenSystemStatus {
  const decision = getImageGenTierDecision();
  const sidecarState = getSdCppSidecarState();
  const installedModels = getInstalledModelIds();
  const hasSdCpp = isSdCppAvailable();

  // Local is available if sidecar is running, or if we have binary + model installed
  const localAvailable =
    sidecarState.status === "running" ||
    (hasSdCpp && installedModels.length > 0 && tierUsesSidecar(decision.tier));

  return {
    tier: decision,
    localAvailable,
    localBackend: localAvailable ? "sd-cpp" : null,
    sidecar: tierUsesSidecar(decision.tier) ? sidecarState : null,
    installState: sidecarState.status === "running" ? "complete" : "idle",
    installedModels,
  };
}

/**
 * Check if local image generation is ready to use right now.
 */
export function isLocalImageGenReady(): boolean {
  const sidecar = getSdCppSidecarState();
  return sidecar.status === "running" && sidecar.ready;
}

/**
 * Get the local sidecar endpoint URL, or null if not running.
 */
export function getLocalEndpoint(): string | null {
  const sidecar = getSdCppSidecarState();
  if (sidecar.status !== "running" || !sidecar.ready) return null;
  return `http://127.0.0.1:${sidecar.port}`;
}

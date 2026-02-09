/**
 * Gateway readiness flag.
 *
 * Tracks whether the gateway has completed its full initialization sequence.
 * Used by:
 *  - `/api/health` to report `ready: true/false` (allows post-install scripts
 *    and external monitors to distinguish "port bound" from "fully ready").
 *  - Early-bound HTTP handler to serve a loading page while subsystems
 *    initialise in the background.
 */

let ready = false;
let readyPhase = "starting";

export function markGatewayReady(): void {
  ready = true;
  readyPhase = "ready";
}

export function isGatewayReady(): boolean {
  return ready;
}

export function setGatewayPhase(phase: string): void {
  readyPhase = phase;
}

export function getGatewayPhase(): string {
  return readyPhase;
}

export function resetGatewayReady(): void {
  ready = false;
  readyPhase = "starting";
}

// ---------------------------------------------------------------------------
// Graceful shutdown callback (used by /api/shutdown endpoint)
// ---------------------------------------------------------------------------

let _shutdownCallback: (() => Promise<void>) | null = null;

/**
 * Register the graceful shutdown callback.
 * Called from server.impl.ts after the close handler is created.
 */
export function setGatewayShutdownCallback(
  cb: () => Promise<void>,
): void {
  _shutdownCallback = cb;
}

/**
 * Request a graceful gateway shutdown.
 * Returns true if the callback was registered and invoked, false otherwise.
 */
export function requestGatewayShutdown(): boolean {
  if (_shutdownCallback) {
    void _shutdownCallback();
    return true;
  }
  return false;
}

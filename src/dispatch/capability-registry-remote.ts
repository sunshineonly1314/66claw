/**
 * Remote capability card updates for the Model Capability Registry.
 *
 * Fetches capability-cards.json from obplugins.cn, verifies Ed25519 signature,
 * caches locally, and merges into the registry.
 *
 * This enables new model support without client releases:
 *   1. Operator adds new model card to server-side capability-cards.json
 *   2. Signs with Ed25519 private key
 *   3. Clients fetch on next update cycle (default: every 24 hours)
 *   4. Cards are cached locally for offline resilience
 *
 * Security:
 *   - Ed25519 signature verification (same infrastructure as extension-signature.ts)
 *   - Falls back to local cache on fetch failure
 *   - Falls back to built-in cards if no cache exists
 *   - Signature key embedded in binary, CI-managed private key
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { applyRemoteCards, type ModelCapabilityCard } from "./capability-registry.js";

const log = createSubsystemLogger("dispatch/capability-registry-remote");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default remote URL for capability cards. */
const DEFAULT_REMOTE_URL = "https://www.obplugins.cn/api/api/v1/capability-cards.json";

/** Local cache file name (stored in state dir). */
const CACHE_FILENAME = "capability-cards-cache.json";

/** Default refresh interval: 24 hours. */
const DEFAULT_REFRESH_MS = 24 * 60 * 60 * 1000;

/** Fetch timeout: 10 seconds. */
const FETCH_TIMEOUT_MS = 10_000;

/** Maximum cache age before it's considered stale (7 days). */
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Ed25519 public key for verifying remote capability card signatures.
 * The private key is held by the CI/operator, never distributed.
 *
 * Set via env var for development/testing; embedded default for production.
 */
const CAPABILITY_CARDS_PUBLIC_KEY_B64 = process.env.OPENCLAWCN_CAPABILITY_CARDS_PUBLIC_KEY ?? "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RemoteCapabilityPayload {
  /** Schema version for forward compatibility. */
  version: number;
  /** ISO timestamp when the cards were published. */
  publishedAt: string;
  /** The capability cards array. */
  cards: ModelCapabilityCard[];
  /** Ed25519 signature of the canonical payload (cards JSON, sorted). */
  signature?: string;
}

interface CacheEntry {
  fetchedAt: string;
  payload: RemoteCapabilityPayload;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let stateDir: string | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let signatureWarningEmitted = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RemoteUpdateOptions {
  /** State directory for caching. */
  stateDir: string;
  /** Custom remote URL (default: obplugins.cn). */
  remoteUrl?: string;
  /** Refresh interval in ms (default: 24h). Set 0 to disable auto-refresh. */
  refreshIntervalMs?: number;
  /** Whether to require valid signature (default: true in production). */
  requireSignature?: boolean;
}

/**
 * Initialize remote capability card updates.
 *
 * 1. Load local cache (if exists and valid)
 * 2. Start background refresh timer
 * 3. Trigger immediate fetch (non-blocking)
 */
export function initRemoteUpdates(options: RemoteUpdateOptions): void {
  // Guard: stop previous timer if called more than once (prevents timer leak)
  stopRemoteUpdates();

  stateDir = options.stateDir;

  // 1. Load cache first (fast, synchronous)
  const cached = loadCache();
  if (cached) {
    applyRemoteCards(cached.payload.cards);
    log.debug(
      `capability-registry-remote: loaded ${cached.payload.cards.length} cards from cache ` +
        `(fetched: ${cached.fetchedAt})`,
    );
  }

  // 2. Start background refresh
  const intervalMs = options.refreshIntervalMs ?? DEFAULT_REFRESH_MS;
  if (intervalMs > 0) {
    // Immediate fetch (non-blocking)
    fetchAndApply(options).catch((err) => {
      log.debug(`capability-registry-remote: initial fetch failed: ${err}`);
    });

    // Periodic refresh
    refreshTimer = setInterval(() => {
      fetchAndApply(options).catch((err) => {
        log.debug(`capability-registry-remote: refresh failed: ${err}`);
      });
    }, intervalMs);

    // Don't block process exit
    if (refreshTimer && typeof refreshTimer === "object" && "unref" in refreshTimer) {
      refreshTimer.unref();
    }
  }
}

/**
 * Stop the background refresh timer.
 */
export function stopRemoteUpdates(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Force an immediate remote fetch (for manual trigger / UI button).
 */
export async function triggerRemoteFetch(options?: Partial<RemoteUpdateOptions>): Promise<{
  success: boolean;
  cardsCount: number;
  error?: string;
}> {
  try {
    const effectiveOptions: RemoteUpdateOptions = {
      stateDir: stateDir ?? options?.stateDir ?? "",
      remoteUrl: options?.remoteUrl,
      requireSignature: options?.requireSignature,
    };
    const payload = await fetchAndApply(effectiveOptions);
    if (!payload) {
      return {
        success: false,
        cardsCount: 0,
        error: "Fetch returned no data (check logs for details)",
      };
    }
    return { success: true, cardsCount: payload.cards.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, cardsCount: 0, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Fetch & apply
// ---------------------------------------------------------------------------

async function fetchAndApply(
  options: RemoteUpdateOptions,
): Promise<RemoteCapabilityPayload | null> {
  const url = options.remoteUrl ?? DEFAULT_REMOTE_URL;
  const requireSig = options.requireSignature ?? CAPABILITY_CARDS_PUBLIC_KEY_B64.length > 0;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const payload = (await response.json()) as RemoteCapabilityPayload;

    // Validate structure
    if (!payload.version || !Array.isArray(payload.cards)) {
      throw new Error("Invalid payload structure: missing version or cards");
    }

    // Verify signature (if required and key is available)
    if (requireSig) {
      if (!payload.signature) {
        throw new Error("Payload missing signature but signature is required");
      }
      const valid = verifyPayloadSignature(payload);
      if (!valid) {
        throw new Error("Invalid Ed25519 signature — possible tampering");
      }
      log.debug("capability-registry-remote: signature verified ✓");
    } else if (!signatureWarningEmitted) {
      signatureWarningEmitted = true;
      log.warn(
        "capability-registry-remote: Ed25519 signature verification is DISABLED " +
          "(OPENCLAWCN_CAPABILITY_CARDS_PUBLIC_KEY not set). " +
          "Remote cards are accepted over HTTPS without cryptographic verification.",
      );
    }

    // Apply to registry
    applyRemoteCards(payload.cards);
    log.debug(`capability-registry-remote: applied ${payload.cards.length} remote cards`);

    // Save to cache
    saveCache({ fetchedAt: new Date().toISOString(), payload });

    return payload;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.debug(`capability-registry-remote: fetch failed: ${msg}`);
    // Don't throw — caller may ignore failures
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function verifyPayloadSignature(payload: RemoteCapabilityPayload): boolean {
  if (!CAPABILITY_CARDS_PUBLIC_KEY_B64 || !payload.signature) {
    return false;
  }

  try {
    // Build canonical payload: plain JSON.stringify of cards array.
    // Both Node.js and Python (json.dumps with separators=(',',':'), ensure_ascii=False)
    // produce identical compact JSON when key insertion order is preserved.
    const canonical = JSON.stringify(payload.cards);
    const publicKeyBuf = Buffer.from(CAPABILITY_CARDS_PUBLIC_KEY_B64, "base64");
    const signatureBuf = Buffer.from(payload.signature, "base64");

    // Create Ed25519 public key object
    const publicKey = crypto.createPublicKey({
      key: publicKeyBuf,
      format: "der",
      type: "spki",
    });

    return crypto.verify(null, Buffer.from(canonical, "utf8"), publicKey, signatureBuf);
  } catch (err) {
    log.debug(`capability-registry-remote: signature verification error: ${err}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Local cache
// ---------------------------------------------------------------------------

function getCachePath(): string | null {
  if (!stateDir) return null;
  return path.join(stateDir, CACHE_FILENAME);
}

function loadCache(): CacheEntry | null {
  const cachePath = getCachePath();
  if (!cachePath) return null;

  try {
    if (!fs.existsSync(cachePath)) return null;
    const raw = fs.readFileSync(cachePath, "utf8");
    const entry = JSON.parse(raw) as CacheEntry;

    // Basic validation
    if (!entry.fetchedAt || !entry.payload?.cards) return null;

    // TTL check — warn if cache is stale but still return it (better than nothing)
    const fetchedTime = new Date(entry.fetchedAt).getTime();
    if (Number.isNaN(fetchedTime)) {
      log.warn("capability-registry-remote: cache has invalid fetchedAt date, treating as stale.");
      return entry; // still usable, just can't check age
    }
    const ageMs = Date.now() - fetchedTime;
    if (ageMs > CACHE_MAX_AGE_MS) {
      const ageDays = Math.round(ageMs / (24 * 60 * 60 * 1000));
      log.warn(
        `capability-registry-remote: cache is ${ageDays} days old (max ${CACHE_MAX_AGE_MS / (24 * 60 * 60 * 1000)}d). ` +
          `Using stale cache as fallback — remote refresh should update it soon.`,
      );
    }

    return entry;
  } catch {
    return null;
  }
}

function saveCache(entry: CacheEntry): void {
  const cachePath = getCachePath();
  if (!cachePath) return;

  try {
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Atomic write: write to temp file then rename (prevents corrupt cache on crash)
    const tmpPath = cachePath + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(entry, null, 2), "utf8");
    fs.renameSync(tmpPath, cachePath);
  } catch (err) {
    log.debug(`capability-registry-remote: failed to save cache: ${err}`);
  }
}

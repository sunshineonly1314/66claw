import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

import { resolveConfigPath, resolveGatewayLockDir, resolveStateDir } from "../config/paths.js";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_STALE_MS = 15_000;
/** Interval at which the running gateway touches its heartbeat file. */
const HEARTBEAT_TOUCH_INTERVAL_MS = 10_000;

type LockPayload = {
  pid: number;
  createdAt: string;
  configPath: string;
  startTime?: number;
};

export type GatewayLockHandle = {
  lockPath: string;
  configPath: string;
  release: () => Promise<void>;
};

export type GatewayLockOptions = {
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  pollIntervalMs?: number;
  staleMs?: number;
  allowInTests?: boolean;
  platform?: NodeJS.Platform;
};

export class GatewayLockError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GatewayLockError";
  }
}

type LockOwnerStatus = "alive" | "dead" | "unknown";

function isAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function normalizeProcArg(arg: string): string {
  return arg.replaceAll("\\", "/").toLowerCase();
}

function parseProcCmdline(raw: string): string[] {
  return raw
    .split("\0")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isGatewayArgv(args: string[]): boolean {
  const normalized = args.map(normalizeProcArg);
  if (!normalized.includes("gateway")) return false;

  const entryCandidates = [
    "dist/index.js",
    "dist/index.mjs",
    "dist/entry.js",
    "dist/entry.mjs",
    "scripts/run-node.mjs",
    "src/index.ts",
  ];
  if (normalized.some((arg) => entryCandidates.some((entry) => arg.endsWith(entry)))) {
    return true;
  }

  const exe = normalized[0] ?? "";
  return exe.endsWith("/clawdbot") || exe === "clawdbot";
}

function readLinuxCmdline(pid: number): string[] | null {
  try {
    const raw = fsSync.readFileSync(`/proc/${pid}/cmdline`, "utf8");
    return parseProcCmdline(raw);
  } catch {
    return null;
  }
}

function readLinuxStartTime(pid: number): number | null {
  try {
    const raw = fsSync.readFileSync(`/proc/${pid}/stat`, "utf8").trim();
    const closeParen = raw.lastIndexOf(")");
    if (closeParen < 0) return null;
    const rest = raw.slice(closeParen + 1).trim();
    const fields = rest.split(/\s+/);
    const startTime = Number.parseInt(fields[19] ?? "", 10);
    return Number.isFinite(startTime) ? startTime : null;
  } catch {
    return null;
  }
}

/** Derive the heartbeat file path from the lock file path. */
function heartbeatPathFromLock(lockPath: string): string {
  return lockPath.replace(/\.lock$/, ".heartbeat");
}

/** Check whether the heartbeat companion file was recently touched. */
function isHeartbeatStale(lockPath: string, staleMs: number): boolean {
  const hbPath = heartbeatPathFromLock(lockPath);
  try {
    const st = fsSync.statSync(hbPath);
    return Date.now() - st.mtimeMs > staleMs;
  } catch {
    // Heartbeat file missing is treated as "unknown" – fall through to
    // other checks rather than immediately declaring dead.
    return false;
  }
}

function resolveGatewayOwnerStatus(
  pid: number,
  payload: LockPayload | null,
  platform: NodeJS.Platform,
  lockPath?: string,
  staleMs?: number,
): LockOwnerStatus {
  if (!isAlive(pid)) return "dead";

  // On non-Linux platforms (especially Windows) we cannot inspect /proc to
  // verify the PID actually belongs to a gateway.  Use the heartbeat
  // companion file as a secondary liveness signal.
  //
  // IMPORTANT: On Windows, PIDs can be reused quickly by unrelated processes.
  // If the PID is alive but the heartbeat file is stale, the original gateway
  // is dead and the PID now belongs to a different process.  We must also
  // check the case where no heartbeat file exists — this means either the
  // gateway never started its heartbeat timer, or the file was cleaned up.
  // In that case, fall back to checking the lock file creation time.
  if (platform !== "linux") {
    if (lockPath && typeof staleMs === "number") {
      if (isHeartbeatStale(lockPath, staleMs)) {
        return "dead";
      }
      // If heartbeat file doesn't exist at all, check lock file age as fallback.
      // This covers the case where gateway crashed before writing its first heartbeat.
      const hbPath = heartbeatPathFromLock(lockPath);
      try {
        fsSync.statSync(hbPath);
      } catch {
        // No heartbeat file — check if lock itself is stale
        if (payload?.createdAt) {
          const createdAt = Date.parse(payload.createdAt);
          if (Number.isFinite(createdAt) && Date.now() - createdAt > staleMs) {
            return "dead";
          }
        }
        // Lock is fresh but no heartbeat yet — return unknown so caller
        // can wait and retry rather than immediately declaring alive.
        return "unknown";
      }
    }
    return "alive";
  }

  const payloadStartTime = payload?.startTime;
  if (Number.isFinite(payloadStartTime)) {
    const currentStartTime = readLinuxStartTime(pid);
    if (currentStartTime == null) return "unknown";
    return currentStartTime === payloadStartTime ? "alive" : "dead";
  }

  const args = readLinuxCmdline(pid);
  if (!args) return "unknown";
  return isGatewayArgv(args) ? "alive" : "dead";
}

async function readLockPayload(lockPath: string): Promise<LockPayload | null> {
  try {
    const raw = await fs.readFile(lockPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LockPayload>;
    if (typeof parsed.pid !== "number") return null;
    if (typeof parsed.createdAt !== "string") return null;
    if (typeof parsed.configPath !== "string") return null;
    const startTime = typeof parsed.startTime === "number" ? parsed.startTime : undefined;
    return {
      pid: parsed.pid,
      createdAt: parsed.createdAt,
      configPath: parsed.configPath,
      startTime,
    };
  } catch (err) {
    // Log at debug level to help diagnose stale/corrupt lock files without
    // spamming production logs.  Distinguishes "file gone" from "corrupt JSON".
    const code = (err as { code?: string }).code;
    if (code !== "ENOENT") {
      console.debug?.(
        `[gateway-lock] readLockPayload failed for ${lockPath}: ${code ?? String(err)}`,
      );
    }
    return null;
  }
}

function resolveGatewayLockPath(env: NodeJS.ProcessEnv) {
  const stateDir = resolveStateDir(env);
  const configPath = resolveConfigPath(env, stateDir);
  const hash = createHash("sha1").update(configPath).digest("hex").slice(0, 8);
  const lockDir = resolveGatewayLockDir();
  const lockPath = path.join(lockDir, `gateway.${hash}.lock`);
  return { lockPath, configPath };
}

export async function acquireGatewayLock(
  opts: GatewayLockOptions = {},
): Promise<GatewayLockHandle | null> {
  const env = opts.env ?? process.env;
  const allowInTests = opts.allowInTests === true;
  if (
    env.CLAWDBOT_ALLOW_MULTI_GATEWAY === "1" ||
    (!allowInTests && (env.VITEST || env.NODE_ENV === "test"))
  ) {
    return null;
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const staleMs = opts.staleMs ?? DEFAULT_STALE_MS;
  const platform = opts.platform ?? process.platform;
  const { lockPath, configPath } = resolveGatewayLockPath(env);
  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  const startedAt = Date.now();
  let lastPayload: LockPayload | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const handle = await fs.open(lockPath, "wx");
      const startTime = platform === "linux" ? readLinuxStartTime(process.pid) : null;
      const payload: LockPayload = {
        pid: process.pid,
        createdAt: new Date().toISOString(),
        configPath,
      };
      if (typeof startTime === "number" && Number.isFinite(startTime)) {
        payload.startTime = startTime;
      }
      await handle.writeFile(JSON.stringify(payload), "utf8");

      // Start a background heartbeat that periodically touches a companion
      // file so other processes (on any platform) can detect a hung gateway
      // whose PID is still alive but unresponsive.
      const hbPath = heartbeatPathFromLock(lockPath);
      let hbFailCount = 0;
      const touchHeartbeat = () => {
        try {
          const now = new Date();
          fsSync.utimesSync(hbPath, now, now);
          hbFailCount = 0;
        } catch {
          try {
            fsSync.writeFileSync(hbPath, "", "utf8");
            hbFailCount = 0;
          } catch {
            hbFailCount++;
            // Log a warning after 3 consecutive failures so the operator
            // knows the heartbeat is stale (this could cause other
            // processes to consider this gateway dead).
            if (hbFailCount === 3) {
              // Use stderr since the logging subsystem may not be available here
              console.warn(
                `[gateway-lock] heartbeat touch failed ${hbFailCount} consecutive times for ${hbPath}`,
              );
            }
          }
        }
      };
      touchHeartbeat();
      const hbTimer = setInterval(touchHeartbeat, HEARTBEAT_TOUCH_INTERVAL_MS);
      hbTimer.unref?.();

      return {
        lockPath,
        configPath,
        release: async () => {
          clearInterval(hbTimer);
          await handle.close().catch(() => undefined);
          await fs.rm(lockPath, { force: true });
          await fs.rm(hbPath, { force: true }).catch(() => undefined);
        },
      };
    } catch (err) {
      const code = (err as { code?: unknown }).code;
      if (code !== "EEXIST") {
        throw new GatewayLockError(`failed to acquire gateway lock at ${lockPath}`, err);
      }

      lastPayload = await readLockPayload(lockPath);
      const ownerPid = lastPayload?.pid;
      const ownerStatus = ownerPid
        ? resolveGatewayOwnerStatus(ownerPid, lastPayload, platform, lockPath, staleMs)
        : "unknown";
      if (ownerStatus === "dead" && ownerPid) {
        await fs.rm(lockPath, { force: true });
        await fs.rm(heartbeatPathFromLock(lockPath), { force: true }).catch(() => undefined);
        continue;
      }
      if (ownerStatus !== "alive") {
        let stale = false;
        if (lastPayload?.createdAt) {
          const createdAt = Date.parse(lastPayload.createdAt);
          stale = Number.isFinite(createdAt) ? Date.now() - createdAt > staleMs : false;
        }
        if (!stale) {
          try {
            const st = await fs.stat(lockPath);
            stale = Date.now() - st.mtimeMs > staleMs;
          } catch {
            stale = true;
          }
        }
        if (stale) {
          await fs.rm(lockPath, { force: true });
          continue;
        }
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  }

  const owner = lastPayload?.pid ? ` (pid ${lastPayload.pid})` : "";
  throw new GatewayLockError(`gateway already running${owner}; lock timeout after ${timeoutMs}ms`);
}

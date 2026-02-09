import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ClawdbotConfig } from "./types.js";

/**
 * Nix mode detection: When CLAWDBOT_NIX_MODE=1, the gateway is running under Nix.
 * In this mode:
 * - No auto-install flows should be attempted
 * - Missing dependencies should produce actionable Nix-specific error messages
 * - Config is managed externally (read-only from Nix perspective)
 */
export function resolveIsNixMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CLAWDBOT_NIX_MODE === "1";
}

export const isNixMode = resolveIsNixMode();

/**
 * Resolve the application's root directory from the current module location.
 * Compiled layout: dist/config/paths.js → ../.. = app root.
 */
function resolveAppRootDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(thisFile), "..", "..");
}

/**
 * On Windows, resolve a portable data directory relative to the app's install location.
 * Returns `<appRoot>/data/` so all mutable state lives next to the executable
 * instead of on C: drive.  Returns null on non-Windows or if detection fails.
 */
export function resolvePortableDataDir(): string | null {
  if (process.platform !== "win32") return null;
  try {
    const appRoot = resolveAppRootDir();
    const parsed = path.parse(appRoot);
    // Don't use if the app root IS a drive root (e.g. "C:\").
    if (appRoot === parsed.root) return null;
    return path.join(appRoot, "data");
  } catch {
    return null;
  }
}

/**
 * State directory for mutable data (sessions, logs, caches).
 * Can be overridden via CLAWDBOT_STATE_DIR environment variable.
 *
 * Precedence:
 * 1. CLAWDBOT_STATE_DIR (explicit override)
 * 2. On Windows: <appRoot>/data/  (portable, avoids C: drive)
 * 3. ~/.clawdbot (traditional)
 */
export function resolveStateDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  const override = env.CLAWDBOT_STATE_DIR?.trim();
  if (override) return resolveUserPath(override);

  // On Windows, default to portable data dir (<appRoot>/data/) so all mutable
  // state lives next to the executable instead of on C: drive.
  const portable = resolvePortableDataDir();
  if (portable) return portable;

  // Non-Windows fallback: ~/.clawdbot
  // Also serves as a safety net on Windows when app-root detection fails.
  let home = homedir();
  const parsed = path.parse(home);
  if (home === parsed.root) {
    const fallback = env.LOCALAPPDATA?.trim() || env.APPDATA?.trim() || env.USERPROFILE?.trim();
    if (fallback) {
      home = fallback;
    } else {
      throw new Error(
        "Cannot resolve home directory: HOME / USERPROFILE are not set and os.homedir() " +
          `returned drive root "${home}". Set CLAWDBOT_STATE_DIR or run as a normal user.`,
      );
    }
  }
  return path.join(home, ".clawdbot");
}

function resolveUserPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("~")) {
    let home = os.homedir();
    const parsed = path.parse(home);
    if (home === parsed.root) {
      const fallback =
        process.env.LOCALAPPDATA?.trim() ||
        process.env.APPDATA?.trim() ||
        process.env.USERPROFILE?.trim();
      if (fallback) home = fallback;
    }
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, home);
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
}

export const STATE_DIR_CLAWDBOT = resolveStateDir();

/**
 * Config file path (JSON5).
 * Can be overridden via CLAWDBOT_CONFIG_PATH environment variable.
 * Default: ~/.clawdbot/clawdbot.json (or $CLAWDBOT_STATE_DIR/clawdbot.json)
 */
export function resolveConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, os.homedir),
): string {
  const override = env.CLAWDBOT_CONFIG_PATH?.trim();
  if (override) return resolveUserPath(override);
  return path.join(stateDir, "clawdbot.json");
}

export const CONFIG_PATH_CLAWDBOT = resolveConfigPath();

export const DEFAULT_GATEWAY_PORT = 18789;

/**
 * Gateway lock directory (ephemeral).
 * Default: os.tmpdir()/clawdbot-<uid> (uid suffix when available).
 */
export function resolveGatewayLockDir(tmpdir: () => string = os.tmpdir): string {
  const base = tmpdir();
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  const suffix = uid != null ? `clawdbot-${uid}` : "clawdbot";
  return path.join(base, suffix);
}

const OAUTH_FILENAME = "oauth.json";

/**
 * OAuth credentials storage directory.
 *
 * Precedence:
 * - `CLAWDBOT_OAUTH_DIR` (explicit override)
 * - `CLAWDBOT_STATE_DIR/credentials` (canonical server/default)
 * - `~/.clawdbot/credentials` (legacy default)
 */
export function resolveOAuthDir(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, os.homedir),
): string {
  const override = env.CLAWDBOT_OAUTH_DIR?.trim();
  if (override) return resolveUserPath(override);
  return path.join(stateDir, "credentials");
}

export function resolveOAuthPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, os.homedir),
): string {
  return path.join(resolveOAuthDir(env, stateDir), OAUTH_FILENAME);
}

export function resolveGatewayPort(
  cfg?: ClawdbotConfig,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const envRaw = env.CLAWDBOT_GATEWAY_PORT?.trim();
  if (envRaw) {
    const parsed = Number.parseInt(envRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const configPort = cfg?.gateway?.port;
  if (typeof configPort === "number" && Number.isFinite(configPort)) {
    if (configPort > 0) return configPort;
  }
  return DEFAULT_GATEWAY_PORT;
}

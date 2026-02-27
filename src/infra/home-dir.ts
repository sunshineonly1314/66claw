import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveEffectiveHomeDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string | undefined {
  const raw = resolveRawHomeDir(env, homedir);
  return raw ? path.resolve(raw) : undefined;
}

function resolveRawHomeDir(env: NodeJS.ProcessEnv, homedir: () => string): string | undefined {
  const explicitHome = normalize(env.OPENCLAWCN_HOME);
  if (explicitHome) {
    if (explicitHome === "~" || explicitHome.startsWith("~/") || explicitHome.startsWith("~\\")) {
      const fallbackHome =
        normalize(env.HOME) ?? normalize(env.USERPROFILE) ?? normalizeSafe(homedir);
      if (fallbackHome) {
        return explicitHome.replace(/^~(?=$|[\\/])/, fallbackHome);
      }
      return undefined;
    }
    return explicitHome;
  }

  const envHome = normalize(env.HOME);
  if (envHome) {
    return envHome;
  }

  const userProfile = normalize(env.USERPROFILE);
  if (userProfile) {
    return userProfile;
  }

  return normalizeSafe(homedir);
}

function normalizeSafe(homedir: () => string): string | undefined {
  try {
    return normalize(homedir());
  } catch {
    return undefined;
  }
}

export function resolveRequiredHomeDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  return resolveEffectiveHomeDir(env, homedir) ?? path.resolve(process.cwd());
}

/**
 * Portable mode: walk from process.execPath upward to find a `.portable` marker file.
 * If found, return `<markerDir>/data` as the portable data directory.
 * Returns `undefined` when not in portable mode.
 */
export function resolvePortableDataDir(): string | undefined {
  if (process.platform !== "win32") return undefined;
  try {
    let dir = path.dirname(process.execPath);
    const root = path.parse(dir).root;
    for (let i = 0; i < 5 && dir !== root; i++) {
      const marker = path.join(dir, ".portable");
      if (fs.existsSync(marker)) {
        return path.join(dir, "data");
      }
      dir = path.dirname(dir);
    }
  } catch {
    // ignore
  }
  return undefined;
}

export function expandHomePrefix(
  input: string,
  opts?: {
    home?: string;
    env?: NodeJS.ProcessEnv;
    homedir?: () => string;
  },
): string {
  if (!input.startsWith("~")) {
    return input;
  }
  const home =
    normalize(opts?.home) ??
    resolveEffectiveHomeDir(opts?.env ?? process.env, opts?.homedir ?? os.homedir);
  if (!home) {
    return input;
  }
  return input.replace(/^~(?=$|[\\/])/, home);
}

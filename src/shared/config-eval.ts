import fs from "node:fs";
import path from "node:path";

export function isTruthy(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
}

export function resolveConfigPath(config: unknown, pathStr: string): unknown {
  const parts = pathStr.split(".").filter(Boolean);
  let current: unknown = config;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function isConfigPathTruthyWithDefaults(
  config: unknown,
  pathStr: string,
  defaults: Record<string, boolean>,
): boolean {
  const value = resolveConfigPath(config, pathStr);
  if (value === undefined && pathStr in defaults) {
    return defaults[pathStr] ?? false;
  }
  return isTruthy(value);
}

export function resolveRuntimePlatform(): string {
  return process.platform;
}

function windowsPathExtensions(): string[] {
  const raw = process.env.PATHEXT;
  const list =
    raw !== undefined ? raw.split(";").map((v) => v.trim()) : [".EXE", ".CMD", ".BAT", ".COM"];
  return ["", ...list.filter(Boolean)];
}

let cachedHasBinaryPath: string | undefined;
let cachedHasBinaryPathExt: string | undefined;
const hasBinaryCache = new Map<string, boolean>();

/** Extra directories to scan for binaries (e.g. CONFIG_DIR/tools/* subdirs). */
let extraBinaryDirs: string[] | undefined;

/**
 * Register the managed tools root directory so `hasBinary` can find
 * binaries installed via `kind: "download"` to `CONFIG_DIR/tools/{name}/`.
 */
export function registerToolsRoot(toolsRoot: string): void {
  try {
    const entries = fs.readdirSync(toolsRoot, { withFileTypes: true });
    extraBinaryDirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => path.join(toolsRoot, e.name));
  } catch {
    extraBinaryDirs = [];
  }
  // Invalidate cache so next hasBinary call re-scans with the new dirs.
  hasBinaryCache.clear();
  cachedHasBinaryPath = undefined;
}

export function clearBinaryCache(): void {
  hasBinaryCache.clear();
  cachedHasBinaryPath = undefined;
  cachedHasBinaryPathExt = undefined;
  extraBinaryDirs = undefined;
}

export function hasBinary(bin: string): boolean {
  const pathEnv = process.env.PATH ?? "";
  const pathExt = process.platform === "win32" ? (process.env.PATHEXT ?? "") : "";
  if (cachedHasBinaryPath !== pathEnv || cachedHasBinaryPathExt !== pathExt) {
    cachedHasBinaryPath = pathEnv;
    cachedHasBinaryPathExt = pathExt;
    hasBinaryCache.clear();
  }
  if (hasBinaryCache.has(bin)) {
    return hasBinaryCache.get(bin)!;
  }

  const parts = pathEnv.split(path.delimiter).filter(Boolean);
  // Also scan CONFIG_DIR/tools/* subdirectories where download installs live.
  if (extraBinaryDirs && extraBinaryDirs.length > 0) {
    for (const dir of extraBinaryDirs) {
      if (!parts.includes(dir)) {
        parts.push(dir);
      }
    }
  }
  const extensions = process.platform === "win32" ? windowsPathExtensions() : [""];
  for (const part of parts) {
    for (const ext of extensions) {
      const candidate = path.join(part, bin + ext);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        hasBinaryCache.set(bin, true);
        return true;
      } catch {
        // keep scanning
      }
    }
  }
  hasBinaryCache.set(bin, false);
  return false;
}

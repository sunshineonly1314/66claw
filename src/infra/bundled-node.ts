/**
 * Bundled Node.js path resolver.
 *
 * Single source of truth for resolving the bundled Node binary shipped with
 * the OpenClawCN installation package.  All subsystems that spawn child
 * processes (MCP servers, skill installers, daemon registration, node-host)
 * should use the helpers exported here instead of relying on the ambient PATH.
 *
 * Resolution priority
 *   1. OPENCLAWCN_NODE_DIR  – explicit env-var override (dev / CI use-case)
 *   2. <dist-sibling>/node  – standard NSIS/DMG layout:
 *        install_dir/
 *          node/node.exe   ← bundled runtime
 *          dist/entry.js   ← this file lives here
 *   3. process.execPath dir – fallback when running under the bundled node
 *      (e.g. node/node.exe dist/entry.js — execPath dir IS the node dir)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const NODE_EXE = process.platform === "win32" ? "node.exe" : "node";

function nodeExistsIn(dir: string): boolean {
  try {
    // Executable can be at <dir>/node[.exe] or <dir>/bin/node[.exe]
    return (
      fs.existsSync(path.join(dir, NODE_EXE)) || fs.existsSync(path.join(dir, "bin", NODE_EXE))
    );
  } catch {
    return false;
  }
}

function resolveNodeExeIn(dir: string): string {
  const direct = path.join(dir, NODE_EXE);
  if (fs.existsSync(direct)) return direct;
  const bin = path.join(dir, "bin", NODE_EXE);
  if (fs.existsSync(bin)) return bin;
  return direct; // best-effort fallback
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

let _cachedDir: string | undefined;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the directory that contains the bundled node binary.
 *
 * The result is cached after the first call; safe to call frequently.
 */
export function resolveBundledNodeDir(): string {
  if (_cachedDir !== undefined) return _cachedDir;

  // 1. Explicit env-var override
  const envDir = process.env.OPENCLAWCN_NODE_DIR?.trim();
  if (envDir && nodeExistsIn(envDir)) {
    _cachedDir = path.resolve(envDir);
    return _cachedDir;
  }

  // 2. Derive from this module's location.
  //    __filename → …/dist/entry.js or …/src/infra/bundled-node.ts
  //    We walk up to find a sibling "node/" directory.
  let moduleDir: string;
  try {
    // ESM context (most common after bundling)
    moduleDir = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    // bytenode / CJS context: import.meta.url may throw.
    // process.argv[1] is always an absolute path in Node.js when spawned normally.
    // Prefer it over __dirname which may be undefined in bytenode .jsc files.
    const argv1 = process.argv[1] ? path.resolve(process.argv[1]) : "";
    moduleDir = argv1 ? path.dirname(argv1) : path.dirname(process.execPath);
  }

  // Walk up from the module dir looking for a "node" sibling folder.
  // Handles: dist/infra/ → dist/ → install_dir/
  let searchDir = moduleDir;
  for (let i = 0; i < 4; i++) {
    const candidate = path.join(searchDir, "node");
    if (nodeExistsIn(candidate)) {
      _cachedDir = path.resolve(candidate);
      return _cachedDir;
    }
    const parent = path.dirname(searchDir);
    if (parent === searchDir) break; // reached filesystem root
    searchDir = parent;
  }

  // 3. Fallback: assume the process was started by the bundled node already
  const execDir = path.dirname(process.execPath);
  _cachedDir = execDir;
  return _cachedDir;
}

/**
 * Returns the full path to the bundled node executable.
 */
export function resolveBundledNodeExe(): string {
  return resolveNodeExeIn(resolveBundledNodeDir());
}

/**
 * Returns a PATH string with the bundled node directory prepended.
 *
 * @param currentPath  Existing PATH value (defaults to process.env.PATH)
 */
export function prependBundledNodeToPath(currentPath?: string): string {
  const bundledDir = resolveBundledNodeDir();
  const existing = currentPath ?? process.env.PATH ?? "";
  const sep = path.delimiter;
  const parts = existing.split(sep).filter(Boolean);

  // Already at front — nothing to do
  if (parts.length > 0 && path.resolve(parts[0]) === path.resolve(bundledDir)) {
    return existing;
  }

  // Remove any duplicate occurrences, then prepend
  const filtered = parts.filter((p) => path.resolve(p) !== path.resolve(bundledDir));
  return [bundledDir, ...filtered].join(sep);
}

/**
 * Mutates process.env.PATH so the bundled node directory is always first.
 * Call once during main-process startup, before spawning any child processes.
 */
export function lockdownBundledNodePath(): void {
  // Windows may expose PATH as "Path" depending on the environment
  const pathKey = process.platform === "win32" && process.env.Path !== undefined ? "Path" : "PATH";
  process.env[pathKey] = prependBundledNodeToPath(process.env[pathKey]);
}

/**
 * Invalidate the internal cache (useful in tests).
 * @internal
 */
export function _resetBundledNodeCache(): void {
  _cachedDir = undefined;
}

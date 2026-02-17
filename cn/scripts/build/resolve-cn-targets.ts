/**
 * CN Encryption Target Resolver
 *
 * Reads `cn_encryption` from config/cn-protected-files.json and resolves
 * source paths (src/*.ts) to dist paths (dist/*.js).
 *
 * Used by:
 *   - scripts/obfuscate-dist.ts (determines which files to obfuscate)
 *   - cn/scripts/build/compile-bytecode.ts (determines which files to compile to .jsc)
 *   - scripts/generate-integrity-hashes.ts (determines which dirs to hash)
 *
 * Upstream (open-source) code is NEVER included in targets.
 */

import fs from "node:fs";
import path from "node:path";

// ── Types ────────────────────────────────────────────────────────────────────

interface CnEncryptionTier {
  description: string;
  directories: string[];
  files: string[];
}

interface CnEncryptionConfig {
  bytecode: CnEncryptionTier;
  obfuscate: CnEncryptionTier;
}

interface CnProtectedConfig {
  cn_encryption: CnEncryptionConfig;
}

export interface EncryptionTargets {
  /** dist/ absolute paths — need RC4 obfuscation + V8 bytecode + integrity hashes */
  bytecode: string[];
  /** dist/ absolute paths — need RC4 obfuscation only (no bytecode) */
  obfuscate: string[];
}

// ── Skip patterns (shared with obfuscate/bytecode scripts) ───────────────────

const SKIP_PATTERNS = [
  /\.test\.js$/,
  /\.spec\.js$/,
  /\.e2e\.js$/,
  /test-helpers\./,
  /\.d\.ts$/,
  /\.map$/,
  /\.jsc$/,
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Recursively collect all .js files in a directory, filtering out skippable files.
 */
function findJsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      const shouldSkip = SKIP_PATTERNS.some((p) => p.test(full));
      if (!shouldSkip) {
        results.push(full);
      }
    }
  }
  return results;
}

/**
 * Map a source path (src/dispatch/engine.ts) to a dist path (dist/dispatch/engine.js).
 * Returns null if the path is not under src/ (e.g. extensions/, config/).
 *
 * For extensions/*, they live outside dist/ and are handled separately.
 */
function srcToDistPath(srcPath: string, distDir: string): string | null {
  // src/X/Y.ts  →  dist/X/Y.js
  if (srcPath.startsWith("src/")) {
    const relative = srcPath.slice("src/".length).replace(/\.ts$/, ".js");
    return path.join(distDir, relative);
  }
  return null;
}

/**
 * Map a source directory (src/dispatch/) to a dist directory (dist/dispatch/).
 * Returns null for non-src directories (handled separately).
 */
function srcDirToDistDir(srcDir: string, distDir: string): string | null {
  if (srcDir.startsWith("src/")) {
    const relative = srcDir.slice("src/".length);
    return path.join(distDir, relative);
  }
  return null;
}

/**
 * Resolve a single tier's files and directories to absolute dist/ paths.
 */
function resolveTier(
  tier: CnEncryptionTier,
  rootDir: string,
  distDir: string,
): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  const add = (p: string) => {
    const normalized = path.resolve(p);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      results.push(p);
    }
  };

  // Resolve individual files
  for (const srcFile of tier.files) {
    const distPath = srcToDistPath(srcFile, distDir);
    if (distPath && fs.existsSync(distPath)) {
      add(distPath);
    }
  }

  // Resolve directories (expand to all .js files within)
  for (const srcDir of tier.directories) {
    const dir = srcDirToDistDir(srcDir, distDir);
    if (dir) {
      for (const f of findJsFiles(dir)) {
        add(f);
      }
    }
  }

  return results;
}

/**
 * Resolve extension directories to absolute paths (they live outside dist/).
 * Extensions ship as compiled JS alongside the app, not inside dist/.
 */
function resolveExtensionTier(
  tier: CnEncryptionTier,
  rootDir: string,
): string[] {
  const results: string[] = [];

  for (const extDir of tier.directories) {
    if (extDir.startsWith("extensions/")) {
      const dir = path.join(rootDir, extDir);
      results.push(...findJsFiles(dir));
    }
  }

  // Individual extension files (if any)
  for (const file of tier.files) {
    if (file.startsWith("extensions/")) {
      const jsPath = path.join(rootDir, file.replace(/\.ts$/, ".js"));
      if (fs.existsSync(jsPath)) {
        results.push(jsPath);
      }
    }
  }

  return results;
}

// ── Config Cache ─────────────────────────────────────────────────────────────
// Cache loaded configs by rootDir to avoid redundant JSON reads.
// Functions like isInExplicitBytecodeDir() are called in loops (once per file),
// each call chains to getExplicitBytecodeDirs() → loadCnEncryptionConfig().
// Without caching, processing 200 files = 200 identical JSON reads.
const _configCache = new Map<string, CnEncryptionConfig>();

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Load and parse cn_encryption config from cn-protected-files.json.
 * Results are cached per rootDir to avoid redundant disk reads in loops.
 */
export function loadCnEncryptionConfig(rootDir: string): CnEncryptionConfig {
  const cacheKey = path.resolve(rootDir);
  const cached = _configCache.get(cacheKey);
  if (cached) return cached;

  const configPath = path.join(rootDir, "config", "cn-protected-files.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`CN config not found: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const config: CnProtectedConfig = JSON.parse(raw);

  if (!config.cn_encryption) {
    throw new Error("cn_encryption section missing from cn-protected-files.json");
  }
  if (!config.cn_encryption.bytecode) {
    throw new Error("cn_encryption.bytecode section missing");
  }
  if (!config.cn_encryption.obfuscate) {
    throw new Error("cn_encryption.obfuscate section missing");
  }

  // Validate config structure (both tiers)
  for (const tier of ["bytecode", "obfuscate"] as const) {
    for (const dir of config.cn_encryption[tier].directories) {
      if (!dir.endsWith("/")) {
        throw new Error(`${tier} directory "${dir}" must end with /`);
      }
    }
    for (const file of config.cn_encryption[tier].files) {
      if (!file.endsWith(".ts")) {
        throw new Error(`${tier} file "${file}" must end with .ts`);
      }
    }
  }

  _configCache.set(cacheKey, config.cn_encryption);
  return config.cn_encryption;
}

/**
 * Resolve all encryption targets from cn-protected-files.json.
 *
 * Returns absolute paths to .js files in dist/ (for src/ code) and
 * in extension directories (for extensions/).
 *
 * @param rootDir  Project root directory (where config/ and dist/ live)
 */
export function resolveEncryptionTargets(rootDir: string): EncryptionTargets {
  const encryption = loadCnEncryptionConfig(rootDir);
  const distDir = path.join(rootDir, "dist");

  // Bytecode tier: only src/ files that go into dist/
  const bytecode = resolveTier(encryption.bytecode, rootDir, distDir);

  // Obfuscate tier: src/ files + extension directories
  const obfuscateSrc = resolveTier(encryption.obfuscate, rootDir, distDir);
  const obfuscateExt = resolveExtensionTier(encryption.obfuscate, rootDir);
  const obfuscate = [...obfuscateSrc, ...obfuscateExt];

  return { bytecode, obfuscate };
}

/**
 * Check if a file path is a CN encryption target.
 */
export function isCnTarget(
  filePath: string,
  targets: EncryptionTargets,
): boolean {
  const normalized = path.resolve(filePath);
  return (
    targets.bytecode.some((t) => path.resolve(t) === normalized) ||
    targets.obfuscate.some((t) => path.resolve(t) === normalized)
  );
}

/**
 * Extract unique top-level dist/ directories from bytecode targets.
 *
 * @deprecated Use `getExplicitBytecodeDirs()` instead. This function derives
 * directories from ALL bytecode file paths, which over-expands to include
 * upstream directories (agents/, gateway/, config/, etc.) — causing CJS
 * package.json pollution and integrity hash over-coverage.
 */
export function getBytecodeDirs(
  rootDir: string,
  targets: EncryptionTargets,
): string[] {
  const distDir = path.join(rootDir, "dist");
  const dirs = new Set<string>();

  for (const file of targets.bytecode) {
    const rel = path.relative(distDir, file);
    const topDir = rel.split(path.sep)[0];
    if (topDir) dirs.add(topDir);
  }

  return [...dirs].sort();
}

/**
 * Return only the explicitly declared bytecode directories from the config.
 * These are CN-only directories (dispatch/, license/, security/) where ALL
 * files are CN code. Safe to write CJS package.json and scan fully for
 * integrity hashes.
 *
 * Returns relative paths under dist/ (e.g. "dispatch/", "license/", "security/").
 */
export function getExplicitBytecodeDirs(rootDir: string): string[] {
  const config = loadCnEncryptionConfig(rootDir);
  return config.bytecode.directories
    .filter((d) => d.startsWith("src/"))
    .map((d) => d.slice("src/".length))
    .sort();
}

/**
 * Return individual bytecode files that are NOT inside an explicit bytecode
 * directory. These files live in mixed directories (gateway/, agents/, etc.)
 * alongside upstream code.
 *
 * Returns absolute dist/ paths (e.g. dist/gateway/cn-handlers.js).
 */
export function getBytecodeIndividualFiles(rootDir: string): string[] {
  const config = loadCnEncryptionConfig(rootDir);
  const distDir = path.join(rootDir, "dist");
  const explicitDirs = config.bytecode.directories;

  return config.bytecode.files
    .filter((f) => !explicitDirs.some((d) => f.startsWith(d)))
    .map((f) => srcToDistPath(f, distDir))
    .filter((f): f is string => f !== null);
}

/**
 * Check if a dist/ file path is inside one of the explicit bytecode directories.
 * Used to decide CJS vs ESM loader generation.
 */
export function isInExplicitBytecodeDir(
  filePath: string,
  rootDir: string,
): boolean {
  const distDir = path.join(rootDir, "dist");
  const rel = path.relative(distDir, filePath).replace(/\\/g, "/");
  const explicitDirs = getExplicitBytecodeDirs(rootDir);
  return explicitDirs.some((d) => rel.startsWith(d));
}

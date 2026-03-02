/**
 * Config auto-repair module.
 *
 * Provides three repair strategies for invalid config files:
 * - L1 (strip): Remove unrecognized keys that fail Zod `.strict()` validation.
 * - L1.5 (ghost-plugin): Remove plugin references whose files no longer exist on disk.
 * - L2 (rollback): Restore from the most recent valid `.bak` backup.
 *
 * Used by the hot-reload handler and gateway startup to automatically
 * recover from config corruption caused by external edits.
 */

import type { ZodIssue } from "zod";
import fs from "node:fs";
import path from "node:path";
import type { OpenClawCNConfig, ConfigValidationIssue } from "./types.js";
import { OpenClawCNSchema } from "./zod-schema.js";
import { validateConfigObjectRawWithPlugins } from "./validation.js";
import { loadPluginManifestRegistry } from "../plugins/manifest-registry.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { listConfigBackups, rollbackConfig } from "./config-rollback.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveUserPath } from "../utils.js";
import { stripUndecryptableFields } from "./field-encrypt.js";

const log = createSubsystemLogger("config-repair");

// ── Strip unknown keys (extracted from doctor-config-flow.ts) ────────────

type UnrecognizedKeysIssue = ZodIssue & {
  code: "unrecognized_keys";
  keys: PropertyKey[];
};

function isUnrecognizedKeysIssue(issue: ZodIssue): issue is UnrecognizedKeysIssue {
  return issue.code === "unrecognized_keys";
}

function normalizeIssuePath(issuePath: PropertyKey[]): Array<string | number> {
  return issuePath.filter((part): part is string | number => typeof part !== "symbol");
}

function formatPath(parts: Array<string | number>): string {
  if (parts.length === 0) {
    return "<root>";
  }
  let out = "";
  for (const part of parts) {
    if (typeof part === "number") {
      out += `[${part}]`;
      continue;
    }
    out = out ? `${out}.${part}` : part;
  }
  return out || "<root>";
}

function resolvePathTarget(root: unknown, targetPath: Array<string | number>): unknown {
  let current: unknown = root;
  for (const part of targetPath) {
    if (typeof part === "number") {
      if (!Array.isArray(current)) {
        return null;
      }
      if (part < 0 || part >= current.length) {
        return null;
      }
      current = current[part];
      continue;
    }
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    const record = current as Record<string, unknown>;
    if (!(part in record)) {
      return null;
    }
    current = record[part];
  }
  return current;
}

/**
 * Strip unrecognized config keys that fail Zod `.strict()` validation.
 *
 * Returns the cleaned config and a list of removed key paths.
 * Only removes keys flagged as `unrecognized_keys` -- does not fix
 * type errors, missing fields, or other validation issues.
 */
export function stripUnknownConfigKeys(config: OpenClawCNConfig): {
  config: OpenClawCNConfig;
  removed: string[];
} {
  const parsed = OpenClawCNSchema.safeParse(config);
  if (parsed.success) {
    return { config, removed: [] };
  }

  const next = structuredClone(config);
  const removed: string[] = [];
  for (const issue of parsed.error.issues) {
    if (!isUnrecognizedKeysIssue(issue)) {
      continue;
    }
    const issuePath = normalizeIssuePath(issue.path);
    const target = resolvePathTarget(next, issuePath);
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      continue;
    }
    const record = target as Record<string, unknown>;
    for (const key of issue.keys) {
      if (typeof key !== "string") {
        continue;
      }
      if (!(key in record)) {
        continue;
      }
      delete record[key];
      removed.push(formatPath([...issuePath, key]));
    }
  }

  return { config: next, removed };
}

// ── Strip ghost plugin references ────────────────────────────────────────

/**
 * Remove plugin references from config whose files no longer exist on disk.
 *
 * Checks `plugins.load.paths`, `plugins.entries`, `plugins.allow`,
 * `plugins.deny`, `plugins.slots`, and `plugins.installs` against the
 * plugin manifest registry. Any reference to a plugin id that the registry
 * cannot discover (i.e. its directory/manifest is missing) is removed.
 *
 * Returns the cleaned config and a list of removed references.
 */
export function stripGhostPluginRefs(config: OpenClawCNConfig): {
  config: OpenClawCNConfig;
  removed: string[];
} {
  const plugins = config.plugins;
  if (!plugins) {
    return { config, removed: [] };
  }

  const next = structuredClone(config);
  const removed: string[] = [];

  // 1. Check plugins.load.paths — remove entries whose directories don't exist
  if (Array.isArray(next.plugins?.load?.paths)) {
    const validPaths: string[] = [];
    const pathsRemoved: string[] = [];
    for (const rawPath of next.plugins!.load!.paths!) {
      if (typeof rawPath !== "string" || !rawPath.trim()) {
        continue;
      }
      let resolved: string;
      try {
        resolved = resolveUserPath(rawPath);
      } catch {
        resolved = rawPath;
      }
      if (fs.existsSync(resolved)) {
        validPaths.push(rawPath);
      } else {
        pathsRemoved.push(`plugins.load.paths: ${rawPath}`);
      }
    }
    if (pathsRemoved.length > 0) {
      removed.push(...pathsRemoved);
      next.plugins!.load!.paths = validPaths;
      if (validPaths.length === 0) {
        delete next.plugins!.load!.paths;
      }
    }
  }

  // 2. Load registry to find known plugin IDs (using the cleaned paths)
  const workspaceDir = resolveAgentWorkspaceDir(next, resolveDefaultAgentId(next));
  const registry = loadPluginManifestRegistry({
    config: next,
    workspaceDir: workspaceDir ?? undefined,
    cache: false,
  });
  const knownIds = new Set(registry.plugins.map((record) => record.id));

  // 3. Clean plugins.entries — remove entries for unknown plugin IDs
  if (next.plugins?.entries && typeof next.plugins.entries === "object") {
    for (const pluginId of Object.keys(next.plugins.entries)) {
      if (!knownIds.has(pluginId)) {
        delete next.plugins.entries[pluginId];
        removed.push(`plugins.entries.${pluginId}`);
      }
    }
    if (Object.keys(next.plugins.entries).length === 0) {
      delete next.plugins.entries;
    }
  }

  // 4. Clean plugins.installs — remove install records for unknown plugin IDs
  if (next.plugins?.installs && typeof next.plugins.installs === "object") {
    for (const pluginId of Object.keys(next.plugins.installs)) {
      if (!knownIds.has(pluginId)) {
        delete next.plugins.installs[pluginId];
        removed.push(`plugins.installs.${pluginId}`);
      }
    }
    if (Object.keys(next.plugins.installs).length === 0) {
      delete next.plugins.installs;
    }
  }

  // 5. Clean plugins.allow — remove unknown IDs
  if (Array.isArray(next.plugins?.allow)) {
    const before = next.plugins!.allow!.length;
    next.plugins!.allow = next.plugins!.allow!.filter((id) => {
      if (typeof id !== "string" || !id.trim()) return true; // keep non-string / empty entries as-is
      if (!knownIds.has(id)) {
        removed.push(`plugins.allow: ${id}`);
        return false;
      }
      return true;
    });
    if (next.plugins!.allow!.length === 0 && before > 0) {
      delete next.plugins!.allow;
    }
  }

  // 6. Clean plugins.deny — remove unknown IDs
  if (Array.isArray(next.plugins?.deny)) {
    const before = next.plugins!.deny!.length;
    next.plugins!.deny = next.plugins!.deny!.filter((id) => {
      if (typeof id !== "string" || !id.trim()) return true; // keep non-string / empty entries as-is
      if (!knownIds.has(id)) {
        removed.push(`plugins.deny: ${id}`);
        return false;
      }
      return true;
    });
    if (next.plugins!.deny!.length === 0 && before > 0) {
      delete next.plugins!.deny;
    }
  }

  // 7. Clean plugins.slots.memory — clear if it references an unknown plugin
  if (
    next.plugins?.slots?.memory &&
    typeof next.plugins.slots.memory === "string" &&
    next.plugins.slots.memory.trim()
  ) {
    if (!knownIds.has(next.plugins.slots.memory)) {
      removed.push(`plugins.slots.memory: ${next.plugins.slots.memory}`);
      delete next.plugins.slots.memory;
      if (next.plugins.slots && Object.keys(next.plugins.slots).length === 0) {
        delete next.plugins.slots;
      }
    }
  }

  return { config: next, removed };
}

// ── Strip undecryptable ENC{...} fields ──────────────────────────────────

/**
 * Detect and strip ENC{...} config values that cannot be decrypted on
 * the current machine. Returns the cleaned config and a list of cleared
 * field paths.
 *
 * This handles the common scenario where a config file encrypted on
 * machine A is used on machine B (different MachineGuid), causing every
 * loadConfig() call to log decrypt failures and flood the log.
 *
 * Unlike the other repair strategies, this can run even when the config
 * is technically "valid" (Zod passes because the ENC{...} strings are
 * valid string values — just useless ones that cause log spam).
 */
export function repairUndecryptableFields(config: OpenClawCNConfig): {
  config: OpenClawCNConfig;
  stripped: string[];
} {
  const result = stripUndecryptableFields(config);
  return {
    config: result.config as OpenClawCNConfig,
    stripped: result.stripped,
  };
}

// ── Atomic file write (matches io.ts pattern) ───────────────────────────

async function atomicWriteConfig(configPath: string, config: unknown): Promise<void> {
  const json = JSON.stringify(config, null, 2).trimEnd().concat("\n");
  const dir = path.dirname(configPath);
  const tmp = path.join(dir, `${path.basename(configPath)}.repair.${process.pid}.tmp`);

  await fs.promises.writeFile(tmp, json, {
    encoding: "utf-8",
    mode: 0o600,
  });

  try {
    await fs.promises.rename(tmp, configPath);
  } catch (err) {
    const code = (err as { code?: string }).code;
    // Windows fallback: rename fails when dest exists
    if (code === "EPERM" || code === "EEXIST") {
      await fs.promises.copyFile(tmp, configPath);
      await fs.promises.chmod(configPath, 0o600).catch(() => {});
      await fs.promises.unlink(tmp).catch(() => {});
    } else {
      await fs.promises.unlink(tmp).catch(() => {});
      throw err;
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────

export type RepairResult = {
  repaired: boolean;
  method: "strip" | "strip-ghost-plugins" | "strip-undecryptable" | "rollback" | null;
  details: string;
};

/**
 * Try to repair an invalid config file.
 *
 * Strategy:
 * 0.5. L0.5 -- strip undecryptable ENC{...} fields (wrong machine / corrupted).
 * 1. L1 -- strip unrecognized keys, re-validate. If valid, write back.
 * 2. L1.5 -- remove ghost plugin references (files deleted but config still points to them).
 * 3. L2 -- find the most recent valid `.bak` backup and restore it.
 * 4. If all fail, return `repaired: false`.
 */
export async function tryRepairConfig(opts: {
  configPath: string;
  rawConfig: unknown;
  issues: ConfigValidationIssue[];
  log?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}): Promise<RepairResult> {
  const logger = opts.log ?? log;

  // L0.5: Strip undecryptable ENC{...} values (wrong machine key)
  if (opts.rawConfig && typeof opts.rawConfig === "object") {
    try {
      const encResult = repairUndecryptableFields(opts.rawConfig as OpenClawCNConfig);
      if (encResult.stripped.length > 0) {
        const revalidation = validateConfigObjectRawWithPlugins(encResult.config);
        if (revalidation.ok) {
          await atomicWriteConfig(opts.configPath, encResult.config);
          const detail = `cleared ${encResult.stripped.length} undecryptable ENC{} fields: ${encResult.stripped.slice(0, 5).join(", ")}${encResult.stripped.length > 5 ? ` (+${encResult.stripped.length - 5} more)` : ""}`;
          logger.info(`[config-repair] L0.5 undecryptable-field strip succeeded: ${detail}`);
          return { repaired: true, method: "strip-undecryptable", details: detail };
        }
        // Undecryptable strip alone wasn't enough — continue to next strategies
        // with the cleaned config as baseline.
        opts = { ...opts, rawConfig: encResult.config };
        logger.warn(
          `[config-repair] L0.5 cleared ${encResult.stripped.length} undecryptable fields but config still invalid, continuing`,
        );
      }
    } catch (err) {
      logger.warn(`[config-repair] L0.5 undecryptable-field strip failed: ${String(err)}`);
    }
  }

  // Track L1 result for use in L1.5
  let l1Config: OpenClawCNConfig | null = null;

  // L1: Try stripping unrecognized keys
  if (opts.rawConfig && typeof opts.rawConfig === "object") {
    try {
      const stripped = stripUnknownConfigKeys(opts.rawConfig as OpenClawCNConfig);
      if (stripped.removed.length > 0) {
        const revalidation = validateConfigObjectRawWithPlugins(stripped.config);
        if (revalidation.ok) {
          await atomicWriteConfig(opts.configPath, stripped.config);
          const detail = `stripped keys: ${stripped.removed.join(", ")}`;
          logger.info(`[config-repair] L1 strip succeeded: ${detail}`);
          return { repaired: true, method: "strip", details: detail };
        }
        // Strip helped but not enough -- pass cleaned config to L1.5
        l1Config = stripped.config;
        logger.warn(
          `[config-repair] L1 strip removed ${stripped.removed.length} keys but config still invalid, trying ghost-plugin strip`,
        );
      }
    } catch (err) {
      logger.warn(`[config-repair] L1 strip failed: ${String(err)}`);
    }
  }

  // L1.5: Strip ghost plugin references (plugin files removed but config still references them)
  if (opts.rawConfig && typeof opts.rawConfig === "object") {
    try {
      const baseConfig = l1Config ?? (opts.rawConfig as OpenClawCNConfig);
      const ghostResult = stripGhostPluginRefs(baseConfig);
      if (ghostResult.removed.length > 0) {
        const revalidation = validateConfigObjectRawWithPlugins(ghostResult.config);
        if (revalidation.ok) {
          await atomicWriteConfig(opts.configPath, ghostResult.config);
          const detail = `removed ghost plugin refs: ${ghostResult.removed.join(", ")}`;
          logger.info(`[config-repair] L1.5 ghost-plugin strip succeeded: ${detail}`);
          return { repaired: true, method: "strip-ghost-plugins", details: detail };
        }
        logger.warn(
          `[config-repair] L1.5 ghost-plugin strip removed ${ghostResult.removed.length} refs but config still invalid, trying rollback`,
        );
      }
    } catch (err) {
      logger.warn(`[config-repair] L1.5 ghost-plugin strip failed: ${String(err)}`);
    }
  }

  // L2: Roll back to the most recent valid backup
  try {
    const backups = listConfigBackups(opts.configPath);
    const validBackup = backups.find((b) => b.exists && b.valid);
    if (validBackup) {
      const result = await rollbackConfig(validBackup.index, {
        configPath: opts.configPath,
        validate: true,
      });
      if (result.ok) {
        const detail = `rolled back to ${path.basename(result.restoredFrom)} (version=${result.version ?? "unknown"})`;
        logger.info(`[config-repair] L2 rollback succeeded: ${detail}`);
        return { repaired: true, method: "rollback", details: detail };
      }
      logger.warn(`[config-repair] L2 rollback failed: ${result.error}`);
    } else {
      logger.warn("[config-repair] L2 rollback skipped: no valid backup found");
    }
  } catch (err) {
    logger.warn(`[config-repair] L2 rollback failed: ${String(err)}`);
  }

  return {
    repaired: false,
    method: null,
    details: "all repair strategies exhausted",
  };
}

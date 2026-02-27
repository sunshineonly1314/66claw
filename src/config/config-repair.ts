/**
 * Config auto-repair module.
 *
 * Provides two repair strategies for invalid config files:
 * - L1 (strip): Remove unrecognized keys that fail Zod `.strict()` validation.
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
import { listConfigBackups, rollbackConfig } from "./config-rollback.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

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
  method: "strip" | "rollback" | null;
  details: string;
};

/**
 * Try to repair an invalid config file.
 *
 * Strategy:
 * 1. L1 -- strip unrecognized keys, re-validate. If valid, write back.
 * 2. L2 -- find the most recent valid `.bak` backup and restore it.
 * 3. If both fail, return `repaired: false`.
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
        // Strip helped but not enough -- fall through to L2
        logger.warn(
          `[config-repair] L1 strip removed ${stripped.removed.length} keys but config still invalid, trying rollback`,
        );
      }
    } catch (err) {
      logger.warn(`[config-repair] L1 strip failed: ${String(err)}`);
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

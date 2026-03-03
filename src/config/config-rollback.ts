/**
 * Config version rollback module.
 *
 * Provides the ability to list available config backups, inspect their version
 * metadata, and atomically restore a previous config version.
 *
 * The backup rotation system (backup-rotation.ts) already maintains up to 3
 * historical config versions as `.bak`, `.bak.1`, `.bak.2`. This module
 * adds a structured API on top of that mechanism.
 */

import JSON5 from "json5";
import fs from "node:fs";
import path from "node:path";
import { CONFIG_BACKUP_COUNT } from "./backup-rotation.js";
import { CONFIG_PATH } from "./paths.js";
import type { OpenClawCNConfig, ConfigValidationIssue } from "./types.js";
import { validateConfigObjectRawWithPlugins } from "./validation.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("config-rollback");

// ── Types ───────────────────────────────────────────────────────────────────

export type ConfigBackupEntry = {
  /** Backup index (0 = most recent `.bak`, 1 = `.bak.1`, etc.) */
  index: number;
  /** Absolute path to the backup file. */
  filePath: string;
  /** Whether the backup file exists on disk. */
  exists: boolean;
  /** File size in bytes (null if not found). */
  sizeBytes: number | null;
  /** File modification time (null if not found). */
  modifiedAt: Date | null;
  /** Parsed `meta.lastTouchedVersion` from the backup (null if not parseable). */
  version: string | null;
  /** Parsed `meta.lastTouchedAt` from the backup (null if not parseable). */
  touchedAt: string | null;
  /** Whether the backup config passes validation. */
  valid: boolean;
  /** Validation issues (empty if valid or unparseable). */
  issues: ConfigValidationIssue[];
};

export type RollbackResult = {
  ok: boolean;
  restoredFrom: string;
  version: string | null;
  error?: string;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function backupPath(configPath: string, index: number): string {
  if (index === 0) {
    return `${configPath}.bak`;
  }
  return `${configPath}.bak.${index}`;
}

function tryParseConfigFile(filePath: string): {
  parsed: unknown;
  config: OpenClawCNConfig | null;
} {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON5.parse(raw);
    return { parsed, config: parsed as OpenClawCNConfig };
  } catch {
    return { parsed: null, config: null };
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * List all available config backups with version metadata.
 *
 * Returns entries sorted from most recent (index 0) to oldest.
 * Entries where the backup file doesn't exist are still included with
 * `exists: false` so the caller can show the full backup slot inventory.
 */
export function listConfigBackups(configPath: string = CONFIG_PATH): ConfigBackupEntry[] {
  const entries: ConfigBackupEntry[] = [];

  for (let i = 0; i < CONFIG_BACKUP_COUNT; i++) {
    const filePath = backupPath(configPath, i);
    let exists = false;
    let sizeBytes: number | null = null;
    let modifiedAt: Date | null = null;
    let version: string | null = null;
    let touchedAt: string | null = null;
    let valid = false;
    let issues: ConfigValidationIssue[] = [];

    try {
      const stat = fs.statSync(filePath);
      exists = stat.isFile();
      sizeBytes = stat.size;
      modifiedAt = stat.mtime;
    } catch {
      // File doesn't exist or is inaccessible
    }

    if (exists) {
      const { config } = tryParseConfigFile(filePath);
      if (config) {
        version = config.meta?.lastTouchedVersion ?? null;
        touchedAt = config.meta?.lastTouchedAt ?? null;
        const validation = validateConfigObjectRawWithPlugins(config);
        valid = validation.ok;
        issues = validation.ok ? [] : validation.issues;
      }
    }

    entries.push({
      index: i,
      filePath,
      exists,
      sizeBytes,
      modifiedAt,
      version,
      touchedAt,
      valid,
      issues,
    });
  }

  return entries;
}

/**
 * Restore a config from a backup slot.
 *
 * @param index Backup index to restore (0 = most recent `.bak`)
 * @param opts.configPath Override the config path (defaults to CONFIG_PATH)
 * @param opts.validate If true (default), validate the backup before restoring
 * @param opts.dryRun If true, only validate without actually restoring
 */
export async function rollbackConfig(
  index: number,
  opts: {
    configPath?: string;
    validate?: boolean;
    dryRun?: boolean;
  } = {},
): Promise<RollbackResult> {
  const configPath = opts.configPath ?? CONFIG_PATH;
  const validate = opts.validate !== false;
  const dryRun = opts.dryRun === true;

  if (index < 0 || index >= CONFIG_BACKUP_COUNT) {
    return {
      ok: false,
      restoredFrom: "",
      version: null,
      error: `Invalid backup index ${index} (valid range: 0-${CONFIG_BACKUP_COUNT - 1})`,
    };
  }

  const backupFile = backupPath(configPath, index);

  // Check backup exists
  try {
    const stat = fs.statSync(backupFile);
    if (!stat.isFile()) {
      return {
        ok: false,
        restoredFrom: backupFile,
        version: null,
        error: `Backup path is not a file: ${backupFile}`,
      };
    }
  } catch {
    return {
      ok: false,
      restoredFrom: backupFile,
      version: null,
      error: `Backup file not found: ${backupFile}`,
    };
  }

  // Parse and validate the backup
  const { config } = tryParseConfigFile(backupFile);
  if (!config) {
    return {
      ok: false,
      restoredFrom: backupFile,
      version: null,
      error: `Failed to parse backup file: ${backupFile}`,
    };
  }

  const version = config.meta?.lastTouchedVersion ?? null;

  if (validate) {
    const validation = validateConfigObjectRawWithPlugins(config);
    if (!validation.ok) {
      const issuesSummary = validation.issues
        .slice(0, 3)
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ");
      return {
        ok: false,
        restoredFrom: backupFile,
        version,
        error: `Backup config is invalid: ${issuesSummary}`,
      };
    }
  }

  if (dryRun) {
    return {
      ok: true,
      restoredFrom: backupFile,
      version,
    };
  }

  // Perform the rollback atomically
  try {
    // First, save current config as a recoverable pre-rollback backup.
    // Use a timestamped name so repeated rollbacks don't overwrite each other.
    if (fs.existsSync(configPath)) {
      const ts = Date.now();
      const currentBackup = `${configPath}.pre-rollback.${ts}.bak`;
      try {
        await fs.promises.copyFile(configPath, currentBackup);
        log.info(`saved current config to ${currentBackup} before rollback`);
      } catch (backupErr) {
        // Non-fatal: log the failure but still proceed with rollback.
        // The rotated .bak files from the normal backup system remain available.
        log.warn(`failed to save pre-rollback backup (continuing): ${String(backupErr)}`);
      }
    }

    // Read the backup raw content and write it to the config path
    const backupRaw = await fs.promises.readFile(backupFile, "utf-8");

    // Write to temp file first, then rename (atomic on most OS)
    const dir = path.dirname(configPath);
    const tmpFile = path.join(dir, `${path.basename(configPath)}.rollback.${process.pid}.tmp`);
    await fs.promises.writeFile(tmpFile, backupRaw, {
      encoding: "utf-8",
      mode: 0o600,
    });

    try {
      await fs.promises.rename(tmpFile, configPath);
    } catch (err) {
      const code = (err as { code?: string }).code;
      // Windows does not allow rename over an existing file in some cases.
      // Use a second temp→rename hop to stay atomic: write to a fresh temp,
      // rename the fresh temp to configPath (replacing it), then clean up.
      if (code === "EPERM" || code === "EEXIST") {
        const tmpFile2 = `${tmpFile}.2`;
        try {
          await fs.promises.copyFile(tmpFile, tmpFile2);
          await fs.promises.chmod(tmpFile2, 0o600).catch(() => {});
          await fs.promises.rename(tmpFile2, configPath);
        } catch (fallbackErr) {
          // If even this fails, clean up both temp files and surface the error.
          await fs.promises.unlink(tmpFile2).catch(() => {});
          await fs.promises.unlink(tmpFile).catch(() => {});
          throw fallbackErr;
        }
        await fs.promises.unlink(tmpFile).catch((e) => {
          log.warn(`failed to clean up rollback tmp file ${tmpFile}: ${String(e)}`);
        });
      } else {
        await fs.promises.unlink(tmpFile).catch((e) => {
          log.warn(`failed to clean up rollback tmp file ${tmpFile}: ${String(e)}`);
        });
        throw err;
      }
    }

    log.info(`config rolled back from ${backupFile} (version=${version ?? "unknown"})`);

    return {
      ok: true,
      restoredFrom: backupFile,
      version,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`rollback failed: ${message}`);
    return {
      ok: false,
      restoredFrom: backupFile,
      version,
      error: `Rollback failed: ${message}`,
    };
  }
}

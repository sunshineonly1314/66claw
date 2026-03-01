/**
 * Upgrade snapshot trigger — thin helper called by update-runner.ts
 * to create config + DB snapshots before upgrades.
 *
 * Uses a temporary "after" version placeholder (the actual new version
 * will be determined after the update). The snapshot decision is based on
 * the `before` version only — if the config's lastTouchedVersion differs
 * from the current process VERSION, it's likely a significant upgrade.
 */

import { VERSION } from "../version.js";
import { resolveConfigPathCandidate, STATE_DIR } from "../config/paths.js";
import { saveConfigVersionSnapshot } from "../config/version-snapshot.js";
import { saveDbSnapshot } from "../db/backup.js";
import path from "node:path";
import fs from "node:fs";

/**
 * Save pre-upgrade snapshots of config and key databases.
 * No-op if beforeVersion is null/undefined or equals the current VERSION.
 * Errors are silently swallowed — snapshot failures must not block upgrades.
 */
export async function saveUpgradeSnapshots(
  beforeVersion: string | null | undefined,
): Promise<void> {
  if (!beforeVersion) {
    return;
  }

  const configPath = resolveConfigPathCandidate();

  // Config snapshot
  await saveConfigVersionSnapshot({
    configPath,
    beforeVersion,
    afterVersion: VERSION,
    stateDir: STATE_DIR,
  });

  // DB snapshots — only snapshot DBs that exist on disk
  const dataDir = path.join(STATE_DIR, "data");
  const dbFiles: Array<{ label: string; filename: string }> = [
    { label: "mcp-marketplace", filename: "mcp-marketplace.sqlite" },
    { label: "skills-marketplace", filename: "skills-marketplace.sqlite" },
    { label: "tool-index", filename: "tool-index.sqlite" },
    { label: "media-metadata", filename: "media-metadata.sqlite" },
  ];

  for (const { label, filename } of dbFiles) {
    const dbPath = path.join(dataDir, filename);
    if (fs.existsSync(dbPath)) {
      await saveDbSnapshot({
        dbPath,
        label,
        version: beforeVersion,
        stateDir: STATE_DIR,
      });
    }
  }

  // Memory DBs are per-agent (memory/{agentId}.sqlite).
  // Snapshot only the "main" agent's DB as it's the most common.
  const memoryDir = path.join(STATE_DIR, "memory");
  const mainMemoryDb = path.join(memoryDir, "main.sqlite");
  if (fs.existsSync(mainMemoryDb)) {
    await saveDbSnapshot({
      dbPath: mainMemoryDb,
      label: "memory-main",
      version: beforeVersion,
      stateDir: STATE_DIR,
    });
  }
}

/**
 * Backup utilities for uninstall command
 * Automatically backup user data before destructive operations
 */
import fs from "node:fs/promises";
import path from "node:path";

import type { RuntimeEnv } from "../runtime.js";
import { resolveHomeDir, shortenHomePath } from "../utils.js";

export type BackupResult = {
  ok: boolean;
  backupDir?: string;
  itemsBackedUp: string[];
  errors: string[];
};

export type BackupOptions = {
  stateDir: string;
  dryRun?: boolean;
};

/**
 * Directories/files to backup (relative to state dir)
 * Priority: credentials > config > identity > agents
 */
const BACKUP_ITEMS = [
  { path: "credentials", label: "Credentials", priority: 1 },
  { path: "config.json", label: "Config", priority: 2 },
  { path: "identity", label: "Identity", priority: 3 },
  { path: "agents", label: "Agent sessions", priority: 4 },
  { path: "exec-approvals.json", label: "Exec approvals", priority: 5 },
  { path: "oauth", label: "OAuth tokens", priority: 6 },
];

/**
 * Generate a timestamped backup directory name
 */
function generateBackupDirName(): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  return `clawdbot-backup-${timestamp}`;
}

/**
 * Get the default backup location
 * - Windows: Desktop or user home
 * - macOS: Desktop
 * - Linux: user home
 */
function resolveBackupParentDir(): string {
  const home = resolveHomeDir();
  if (!home) {
    return process.cwd();
  }

  if (process.platform === "win32" || process.platform === "darwin") {
    const desktop = path.join(home, "Desktop");
    return desktop;
  }

  return home;
}

/**
 * Copy a file or directory recursively
 */
async function copyRecursive(src: string, dest: string): Promise<void> {
  const stat = await fs.stat(src);

  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      await copyRecursive(srcPath, destPath);
    }
  } else {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
}

/**
 * Generate a README file with restore instructions
 */
function generateRestoreReadme(backupDir: string, itemsBackedUp: string[]): string {
  const timestamp = new Date().toISOString();
  const stateDir = process.platform === "win32" ? "%USERPROFILE%\\.clawdbot" : "~/.clawdbot";

  return `# Clawdbot Backup

Created: ${timestamp}
Platform: ${process.platform}

## Backed up items

${itemsBackedUp.map((item) => `- ${item}`).join("\n")}

## Restore instructions

To restore your configuration, copy the backed up files back to the state directory:

### macOS / Linux

\`\`\`bash
# Restore all
cp -R "${backupDir}"/* ~/.clawdbot/

# Or restore specific items:
cp -R "${backupDir}/credentials" ~/.clawdbot/
cp "${backupDir}/config.json" ~/.clawdbot/
\`\`\`

### Windows (PowerShell)

\`\`\`powershell
# Restore all
Copy-Item -Path "${backupDir}\\*" -Destination "${stateDir}" -Recurse -Force

# Or restore specific items:
Copy-Item -Path "${backupDir}\\credentials" -Destination "${stateDir}\\credentials" -Recurse -Force
Copy-Item -Path "${backupDir}\\config.json" -Destination "${stateDir}\\config.json" -Force
\`\`\`

## Notes

- After restoring, you may need to reconfigure the gateway service.
- Run \`clawdbot setup\` or \`clawdbot doctor\` after restore.
- Credentials may need to be re-authenticated if they've expired.
`;
}

/**
 * Create a backup of the state directory before uninstall
 */
export async function createBackupBeforeUninstall(
  runtime: RuntimeEnv,
  options: BackupOptions,
): Promise<BackupResult> {
  const { stateDir, dryRun } = options;
  const result: BackupResult = {
    ok: false,
    itemsBackedUp: [],
    errors: [],
  };

  // Check if state dir exists
  try {
    await fs.access(stateDir);
  } catch {
    runtime.log("No state directory to backup.");
    result.ok = true;
    return result;
  }

  // Determine backup location
  const backupParent = resolveBackupParentDir();
  const backupDirName = generateBackupDirName();
  const backupDir = path.join(backupParent, backupDirName);

  if (dryRun) {
    runtime.log(`[dry-run] Would create backup at: ${shortenHomePath(backupDir)}`);
    for (const item of BACKUP_ITEMS) {
      const srcPath = path.join(stateDir, item.path);
      try {
        await fs.access(srcPath);
        runtime.log(`[dry-run] Would backup: ${item.label}`);
        result.itemsBackedUp.push(item.label);
      } catch {
        // Item doesn't exist, skip
      }
    }
    result.ok = true;
    result.backupDir = backupDir;
    return result;
  }

  // Create backup directory
  try {
    await fs.mkdir(backupDir, { recursive: true });
  } catch (err) {
    result.errors.push(`Failed to create backup directory: ${String(err)}`);
    return result;
  }

  runtime.log(`Creating backup at: ${shortenHomePath(backupDir)}`);

  // Backup each item
  for (const item of BACKUP_ITEMS) {
    const srcPath = path.join(stateDir, item.path);
    const destPath = path.join(backupDir, item.path);

    try {
      await fs.access(srcPath);
    } catch {
      // Item doesn't exist, skip silently
      continue;
    }

    try {
      await copyRecursive(srcPath, destPath);
      result.itemsBackedUp.push(item.label);
      runtime.log(`  ✓ Backed up: ${item.label}`);
    } catch (err) {
      const errMsg = `Failed to backup ${item.label}: ${String(err)}`;
      result.errors.push(errMsg);
      runtime.error(`  ✗ ${errMsg}`);
    }
  }

  // Generate restore README
  if (result.itemsBackedUp.length > 0) {
    try {
      const readmeContent = generateRestoreReadme(backupDir, result.itemsBackedUp);
      await fs.writeFile(path.join(backupDir, "README.md"), readmeContent, "utf-8");
    } catch {
      // Non-critical, ignore
    }
  }

  // If nothing was backed up, remove the empty directory
  if (result.itemsBackedUp.length === 0) {
    try {
      await fs.rmdir(backupDir);
    } catch {
      // Ignore
    }
    runtime.log("No items to backup.");
    result.ok = true;
    return result;
  }

  result.ok = true;
  result.backupDir = backupDir;
  runtime.log(`Backup complete: ${result.itemsBackedUp.length} items saved.`);

  return result;
}

/**
 * Check if backup is needed (state dir exists and has content)
 */
export async function shouldOfferBackup(stateDir: string): Promise<boolean> {
  try {
    await fs.access(stateDir);
    const entries = await fs.readdir(stateDir);
    // Only offer backup if there's meaningful content
    return entries.some((entry) =>
      BACKUP_ITEMS.some((item) => item.path === entry || item.path.startsWith(entry + "/")),
    );
  } catch {
    return false;
  }
}

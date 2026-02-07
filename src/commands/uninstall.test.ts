import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the external dependencies
vi.mock("@clack/prompts", () => ({
  cancel: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
  multiselect: vi.fn().mockResolvedValue(["state"]),
}));

vi.mock("../config/config.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...original,
    isNixMode: false,
    loadConfig: vi.fn().mockReturnValue({}),
    resolveConfigPath: vi.fn(),
    resolveOAuthDir: vi.fn(),
    resolveStateDir: vi.fn(),
  };
});

vi.mock("../daemon/service.js", () => ({
  resolveGatewayService: vi.fn().mockReturnValue({
    isLoaded: vi.fn().mockResolvedValue(false),
    notLoadedText: "not installed",
    stop: vi.fn(),
    uninstall: vi.fn(),
  }),
}));

import { confirm, isCancel } from "@clack/prompts";
import { resolveConfigPath, resolveOAuthDir, resolveStateDir } from "../config/config.js";
import { uninstallCommand, type UninstallOptions } from "./uninstall.js";

describe("uninstall command with backup", () => {
  let tempDir: string;
  let stateDir: string;
  let createdBackupDirs: string[] = [];

  const mockRuntime = {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
    print: vi.fn(),
    printRaw: vi.fn(),
    prompt: vi.fn(),
    debug: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    createdBackupDirs = [];

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-uninstall-test-"));
    stateDir = path.join(tempDir, ".clawdbot");
    await fs.mkdir(stateDir, { recursive: true });

    // Setup mocks to use our temp directories
    vi.mocked(resolveStateDir).mockReturnValue(stateDir);
    vi.mocked(resolveConfigPath).mockReturnValue(path.join(stateDir, "config.json"));
    vi.mocked(resolveOAuthDir).mockReturnValue(path.join(stateDir, "oauth"));
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(isCancel).mockReturnValue(false);
  });

  afterEach(async () => {
    // Clean up backup directories
    for (const dir of createdBackupDirs) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // Helper to find and track backup directories
  const findBackupDir = async (): Promise<string | undefined> => {
    const desktopOrHome =
      process.platform === "win32" || process.platform === "darwin"
        ? path.join(os.homedir(), "Desktop")
        : os.homedir();

    try {
      const entries = await fs.readdir(desktopOrHome);
      const backupDir = entries.find((e) => e.startsWith("clawdbot-backup-"));
      if (backupDir) {
        const fullPath = path.join(desktopOrHome, backupDir);
        createdBackupDirs.push(fullPath);
        return fullPath;
      }
    } catch {
      // Directory might not exist
    }
    return undefined;
  };

  describe("backup integration", () => {
    it("creates backup when removing state with backup=true (default)", async () => {
      // Create state content
      await fs.writeFile(path.join(stateDir, "config.json"), '{"test": true}');

      const opts: UninstallOptions = {
        state: true,
        yes: true,
        nonInteractive: true,
        backup: true,
      };

      await uninstallCommand(mockRuntime, opts);

      // Find the backup directory
      const backupDir = await findBackupDir();

      // Backup should exist
      expect(backupDir).toBeDefined();
      if (backupDir) {
        const backupConfig = path.join(backupDir, "config.json");
        const exists = await fs
          .access(backupConfig)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }

      // State should be removed
      const stateExists = await fs
        .access(stateDir)
        .then(() => true)
        .catch(() => false);
      expect(stateExists).toBe(false);
    });

    it("skips backup when backup=false", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), '{"test": true}');

      const opts: UninstallOptions = {
        state: true,
        yes: true,
        nonInteractive: true,
        backup: false,
      };

      await uninstallCommand(mockRuntime, opts);

      // Find any backup directory
      const backupDir = await findBackupDir();
      expect(backupDir).toBeUndefined();

      // State should still be removed
      const stateExists = await fs
        .access(stateDir)
        .then(() => true)
        .catch(() => false);
      expect(stateExists).toBe(false);
    });

    it("does not create backup when state dir is empty", async () => {
      // Empty state dir - nothing to backup

      const opts: UninstallOptions = {
        state: true,
        yes: true,
        nonInteractive: true,
        backup: true,
      };

      await uninstallCommand(mockRuntime, opts);

      // No backup should be created
      const backupDir = await findBackupDir();
      expect(backupDir).toBeUndefined();
    });

    it("logs backup location when backup is created", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");
      await fs.mkdir(path.join(stateDir, "credentials"), { recursive: true });
      await fs.writeFile(path.join(stateDir, "credentials", "key.json"), "{}");

      const opts: UninstallOptions = {
        state: true,
        yes: true,
        nonInteractive: true,
        backup: true,
      };

      await uninstallCommand(mockRuntime, opts);

      // Track the backup for cleanup
      await findBackupDir();

      // Should log backup location
      expect(mockRuntime.log).toHaveBeenCalledWith(
        expect.stringMatching(/Backup saved to:/),
      );
    });
  });

  describe("dry-run with backup", () => {
    it("shows backup would be created in dry-run mode", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");

      const opts: UninstallOptions = {
        state: true,
        yes: true,
        nonInteractive: true,
        dryRun: true,
        backup: true,
      };

      await uninstallCommand(mockRuntime, opts);

      // Should log dry-run backup message
      expect(mockRuntime.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[dry-run\] Would create backup at:/),
      );

      // State should NOT be removed in dry-run
      const stateExists = await fs
        .access(stateDir)
        .then(() => true)
        .catch(() => false);
      expect(stateExists).toBe(true);
    });
  });

  describe("backup with all scopes", () => {
    it("creates backup before removing when using --all", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), '{"all": true}');
      await fs.mkdir(path.join(stateDir, "credentials"), { recursive: true });

      const opts: UninstallOptions = {
        all: true,
        yes: true,
        nonInteractive: true,
        backup: true,
      };

      await uninstallCommand(mockRuntime, opts);

      // Find the backup
      const backupDir = await findBackupDir();
      expect(backupDir).toBeDefined();

      if (backupDir) {
        // Verify config was backed up
        const backupConfig = path.join(backupDir, "config.json");
        const content = await fs.readFile(backupConfig, "utf-8");
        expect(content).toBe('{"all": true}');

        // Verify credentials dir was backed up
        const backupCreds = path.join(backupDir, "credentials");
        const credsExists = await fs
          .access(backupCreds)
          .then(() => true)
          .catch(() => false);
        expect(credsExists).toBe(true);
      }
    });
  });

  describe("non-interactive mode", () => {
    it("requires --yes in non-interactive mode", async () => {
      const opts: UninstallOptions = {
        state: true,
        nonInteractive: true,
        // no --yes
      };

      await uninstallCommand(mockRuntime, opts);

      expect(mockRuntime.error).toHaveBeenCalledWith("Non-interactive mode requires --yes.");
      expect(mockRuntime.exit).toHaveBeenCalledWith(1);
    });

    it("requires explicit scopes in non-interactive mode", async () => {
      const opts: UninstallOptions = {
        nonInteractive: true,
        yes: true,
        // no explicit scope
      };

      await uninstallCommand(mockRuntime, opts);

      expect(mockRuntime.error).toHaveBeenCalledWith(
        "Non-interactive mode requires explicit scopes (use --all).",
      );
    });
  });
});

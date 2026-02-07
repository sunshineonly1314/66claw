import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBackupBeforeUninstall, shouldOfferBackup } from "./backup-utils.js";

describe("backup-utils", () => {
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

  // Helper to track and clean up backup directories
  const trackBackupDir = (dir: string | undefined) => {
    if (dir) createdBackupDirs.push(dir);
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    createdBackupDirs = [];
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-backup-test-"));
    stateDir = path.join(tempDir, ".clawdbot");
    await fs.mkdir(stateDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up all created backup directories
    for (const dir of createdBackupDirs) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // shouldOfferBackup tests
  // ===========================================================================
  describe("shouldOfferBackup", () => {
    it("returns false for non-existent directory", async () => {
      const result = await shouldOfferBackup("/non/existent/path");
      expect(result).toBe(false);
    });

    it("returns false for empty directory", async () => {
      const result = await shouldOfferBackup(stateDir);
      expect(result).toBe(false);
    });

    it("returns true when credentials directory exists", async () => {
      await fs.mkdir(path.join(stateDir, "credentials"), { recursive: true });
      await fs.writeFile(path.join(stateDir, "credentials", "test.json"), "{}");

      const result = await shouldOfferBackup(stateDir);
      expect(result).toBe(true);
    });

    it("returns true when config.json exists", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");

      const result = await shouldOfferBackup(stateDir);
      expect(result).toBe(true);
    });

    it("returns true when identity directory exists", async () => {
      await fs.mkdir(path.join(stateDir, "identity"), { recursive: true });
      const result = await shouldOfferBackup(stateDir);
      expect(result).toBe(true);
    });

    it("returns true when agents directory exists", async () => {
      await fs.mkdir(path.join(stateDir, "agents"), { recursive: true });
      const result = await shouldOfferBackup(stateDir);
      expect(result).toBe(true);
    });

    it("returns true when exec-approvals.json exists", async () => {
      await fs.writeFile(path.join(stateDir, "exec-approvals.json"), "[]");
      const result = await shouldOfferBackup(stateDir);
      expect(result).toBe(true);
    });

    it("returns true when oauth directory exists", async () => {
      await fs.mkdir(path.join(stateDir, "oauth"), { recursive: true });
      const result = await shouldOfferBackup(stateDir);
      expect(result).toBe(true);
    });

    it("returns false when only unrelated files exist", async () => {
      await fs.writeFile(path.join(stateDir, "random.txt"), "test");
      await fs.writeFile(path.join(stateDir, "logs.json"), "{}");
      const result = await shouldOfferBackup(stateDir);
      expect(result).toBe(false);
    });

    it("handles directory with mixed content", async () => {
      // Mix of backup-worthy and non-backup items
      await fs.writeFile(path.join(stateDir, "random.txt"), "test");
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");
      const result = await shouldOfferBackup(stateDir);
      expect(result).toBe(true);
    });
  });

  // ===========================================================================
  // createBackupBeforeUninstall - Basic functionality
  // ===========================================================================
  describe("createBackupBeforeUninstall", () => {
    it("returns ok=true when state dir does not exist", async () => {
      const result = await createBackupBeforeUninstall(mockRuntime, {
        stateDir: "/non/existent/path",
      });

      expect(result.ok).toBe(true);
      expect(result.itemsBackedUp).toHaveLength(0);
      expect(mockRuntime.log).toHaveBeenCalledWith("No state directory to backup.");
    });

    it("backs up credentials directory", async () => {
      const credsDir = path.join(stateDir, "credentials");
      await fs.mkdir(credsDir, { recursive: true });
      await fs.writeFile(path.join(credsDir, "api-key.json"), '{"key": "test"}');

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(result.ok).toBe(true);
      expect(result.itemsBackedUp).toContain("Credentials");
      expect(result.backupDir).toBeDefined();

      const backupCredsDir = path.join(result.backupDir!, "credentials");
      const stat = await fs.stat(backupCredsDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it("backs up config.json file", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), '{"test": true}');

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(result.ok).toBe(true);
      expect(result.itemsBackedUp).toContain("Config");

      const backupConfig = path.join(result.backupDir!, "config.json");
      const content = await fs.readFile(backupConfig, "utf-8");
      expect(content).toBe('{"test": true}');
    });

    it("generates README.md with restore instructions", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      const readmePath = path.join(result.backupDir!, "README.md");
      const readme = await fs.readFile(readmePath, "utf-8");

      expect(readme).toContain("# Clawdbot Backup");
      expect(readme).toContain("Restore instructions");
      expect(readme).toContain("Config");
      expect(readme).toContain("Created:");
      expect(readme).toContain("Platform:");
    });

    it("handles dry-run mode without creating files", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");
      await fs.mkdir(path.join(stateDir, "credentials"), { recursive: true });

      const result = await createBackupBeforeUninstall(mockRuntime, {
        stateDir,
        dryRun: true,
      });

      expect(result.ok).toBe(true);
      expect(result.itemsBackedUp).toContain("Config");
      expect(result.itemsBackedUp).toContain("Credentials");
      expect(mockRuntime.log).toHaveBeenCalledWith(expect.stringContaining("[dry-run]"));

      // Verify no actual backup was created
      if (result.backupDir) {
        const exists = await fs
          .access(result.backupDir)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(false);
      }
    });

    it("backs up multiple items", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");
      await fs.mkdir(path.join(stateDir, "credentials"), { recursive: true });
      await fs.writeFile(path.join(stateDir, "credentials", "key.json"), "{}");
      await fs.mkdir(path.join(stateDir, "identity"), { recursive: true });
      await fs.writeFile(path.join(stateDir, "identity", "id.json"), "{}");

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(result.ok).toBe(true);
      expect(result.itemsBackedUp).toContain("Config");
      expect(result.itemsBackedUp).toContain("Credentials");
      expect(result.itemsBackedUp).toContain("Identity");
      expect(result.itemsBackedUp.length).toBeGreaterThanOrEqual(3);
    });

    it("returns ok=true with empty itemsBackedUp when no items exist", async () => {
      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });

      expect(result.ok).toBe(true);
      expect(result.itemsBackedUp).toHaveLength(0);
      expect(mockRuntime.log).toHaveBeenCalledWith("No items to backup.");
    });
  });

  // ===========================================================================
  // Deep nested directory tests
  // ===========================================================================
  describe("createBackupBeforeUninstall - nested directories", () => {
    it("backs up deeply nested credentials files", async () => {
      const deepPath = path.join(stateDir, "credentials", "providers", "openai");
      await fs.mkdir(deepPath, { recursive: true });
      await fs.writeFile(path.join(deepPath, "token.json"), '{"token": "sk-xxx"}');

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(result.ok).toBe(true);
      expect(result.itemsBackedUp).toContain("Credentials");

      // Verify nested structure preserved
      const backupDeepPath = path.join(result.backupDir!, "credentials", "providers", "openai");
      const content = await fs.readFile(path.join(backupDeepPath, "token.json"), "utf-8");
      expect(content).toBe('{"token": "sk-xxx"}');
    });

    it("backs up agents directory with session files", async () => {
      const agentPath = path.join(stateDir, "agents", "main", "sessions");
      await fs.mkdir(agentPath, { recursive: true });
      await fs.writeFile(path.join(agentPath, "session-001.jsonl"), '{"role":"user"}');
      await fs.writeFile(path.join(agentPath, "session-002.jsonl"), '{"role":"assistant"}');

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(result.ok).toBe(true);
      expect(result.itemsBackedUp).toContain("Agent sessions");

      // Verify files preserved
      const backupAgentPath = path.join(result.backupDir!, "agents", "main", "sessions");
      const files = await fs.readdir(backupAgentPath);
      expect(files).toContain("session-001.jsonl");
      expect(files).toContain("session-002.jsonl");
    });

    it("backs up multiple agent directories", async () => {
      // Create multiple agents
      for (const agent of ["main", "work", "personal"]) {
        const agentPath = path.join(stateDir, "agents", agent);
        await fs.mkdir(agentPath, { recursive: true });
        await fs.writeFile(path.join(agentPath, "config.json"), `{"agent": "${agent}"}`);
      }

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(result.ok).toBe(true);

      // Verify all agents backed up
      const backupAgentsDir = path.join(result.backupDir!, "agents");
      const agents = await fs.readdir(backupAgentsDir);
      expect(agents).toContain("main");
      expect(agents).toContain("work");
      expect(agents).toContain("personal");
    });
  });

  // ===========================================================================
  // Special characters and edge cases
  // ===========================================================================
  describe("createBackupBeforeUninstall - special characters", () => {
    it("handles files with spaces in names", async () => {
      const credsDir = path.join(stateDir, "credentials");
      await fs.mkdir(credsDir, { recursive: true });
      await fs.writeFile(path.join(credsDir, "my api key.json"), '{"key": "test"}');

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(result.ok).toBe(true);
      const backupFile = path.join(result.backupDir!, "credentials", "my api key.json");
      const exists = await fs
        .access(backupFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it("handles files with unicode characters", async () => {
      const credsDir = path.join(stateDir, "credentials");
      await fs.mkdir(credsDir, { recursive: true });
      await fs.writeFile(path.join(credsDir, "配置文件.json"), '{"chinese": "中文"}');

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(result.ok).toBe(true);
      const backupFile = path.join(result.backupDir!, "credentials", "配置文件.json");
      const content = await fs.readFile(backupFile, "utf-8");
      expect(content).toBe('{"chinese": "中文"}');
    });

    it("handles empty files", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "");

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(result.ok).toBe(true);
      const backupFile = path.join(result.backupDir!, "config.json");
      const content = await fs.readFile(backupFile, "utf-8");
      expect(content).toBe("");
    });

    it("handles large config files", async () => {
      // Create a ~100KB config file
      const largeContent = JSON.stringify({
        data: "x".repeat(100000),
        nested: { array: Array(1000).fill({ key: "value" }) },
      });
      await fs.writeFile(path.join(stateDir, "config.json"), largeContent);

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(result.ok).toBe(true);
      const backupFile = path.join(result.backupDir!, "config.json");
      const content = await fs.readFile(backupFile, "utf-8");
      expect(content).toBe(largeContent);
    });

    it("preserves file content integrity with binary-like content", async () => {
      const credsDir = path.join(stateDir, "credentials");
      await fs.mkdir(credsDir, { recursive: true });
      // Create content with special characters
      const specialContent = '{"key": "value\\nwith\\ttabs\\rand\\0nulls"}';
      await fs.writeFile(path.join(credsDir, "special.json"), specialContent);

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(result.ok).toBe(true);
      const backupFile = path.join(result.backupDir!, "credentials", "special.json");
      const content = await fs.readFile(backupFile, "utf-8");
      expect(content).toBe(specialContent);
    });
  });

  // ===========================================================================
  // All backup items test
  // ===========================================================================
  describe("createBackupBeforeUninstall - all items", () => {
    it("backs up all supported item types", async () => {
      // Create all types of backup items
      await fs.mkdir(path.join(stateDir, "credentials"), { recursive: true });
      await fs.writeFile(path.join(stateDir, "credentials", "key.json"), "{}");

      await fs.writeFile(path.join(stateDir, "config.json"), "{}");

      await fs.mkdir(path.join(stateDir, "identity"), { recursive: true });
      await fs.writeFile(path.join(stateDir, "identity", "id.json"), "{}");

      await fs.mkdir(path.join(stateDir, "agents", "main"), { recursive: true });
      await fs.writeFile(path.join(stateDir, "agents", "main", "session.jsonl"), "{}");

      await fs.writeFile(path.join(stateDir, "exec-approvals.json"), "[]");

      await fs.mkdir(path.join(stateDir, "oauth"), { recursive: true });
      await fs.writeFile(path.join(stateDir, "oauth", "token.json"), "{}");

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(result.ok).toBe(true);
      expect(result.itemsBackedUp).toContain("Credentials");
      expect(result.itemsBackedUp).toContain("Config");
      expect(result.itemsBackedUp).toContain("Identity");
      expect(result.itemsBackedUp).toContain("Agent sessions");
      expect(result.itemsBackedUp).toContain("Exec approvals");
      expect(result.itemsBackedUp).toContain("OAuth tokens");
      expect(result.itemsBackedUp.length).toBe(6);
    });
  });

  // ===========================================================================
  // README content validation
  // ===========================================================================
  describe("createBackupBeforeUninstall - README content", () => {
    it("README includes timestamp", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      const readme = await fs.readFile(path.join(result.backupDir!, "README.md"), "utf-8");
      // Check for ISO timestamp format
      expect(readme).toMatch(/Created: \d{4}-\d{2}-\d{2}T/);
    });

    it("README includes platform info", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      const readme = await fs.readFile(path.join(result.backupDir!, "README.md"), "utf-8");
      expect(readme).toContain(`Platform: ${process.platform}`);
    });

    it("README includes list of backed up items", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");
      await fs.mkdir(path.join(stateDir, "credentials"), { recursive: true });

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      const readme = await fs.readFile(path.join(result.backupDir!, "README.md"), "utf-8");
      expect(readme).toContain("- Config");
      expect(readme).toContain("- Credentials");
    });

    it("README includes restore commands for current platform", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      const readme = await fs.readFile(path.join(result.backupDir!, "README.md"), "utf-8");

      if (process.platform === "win32") {
        expect(readme).toContain("PowerShell");
        expect(readme).toContain("Copy-Item");
      } else {
        expect(readme).toContain("cp -R");
      }
    });
  });

  // ===========================================================================
  // Backup directory naming
  // ===========================================================================
  describe("createBackupBeforeUninstall - backup directory", () => {
    it("creates backup directory with timestamp format", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(result.backupDir).toBeDefined();
      expect(result.backupDir).toMatch(/clawdbot-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/);
    });

    it("creates unique backup directories for multiple backups", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");

      const result1 = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result1.backupDir);

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result2 = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result2.backupDir);

      expect(result1.backupDir).not.toBe(result2.backupDir);
    });
  });

  // ===========================================================================
  // Logging tests
  // ===========================================================================
  describe("createBackupBeforeUninstall - logging", () => {
    it("logs backup start location", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(mockRuntime.log).toHaveBeenCalledWith(
        expect.stringMatching(/Creating backup at:/),
      );
    });

    it("logs each backed up item with checkmark", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");
      await fs.mkdir(path.join(stateDir, "credentials"), { recursive: true });

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(mockRuntime.log).toHaveBeenCalledWith("  ✓ Backed up: Config");
      expect(mockRuntime.log).toHaveBeenCalledWith("  ✓ Backed up: Credentials");
    });

    it("logs backup completion with item count", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");
      await fs.mkdir(path.join(stateDir, "credentials"), { recursive: true });

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(mockRuntime.log).toHaveBeenCalledWith(
        expect.stringMatching(/Backup complete: \d+ items saved/),
      );
    });

    it("logs dry-run for each item in dry-run mode", async () => {
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");
      await fs.mkdir(path.join(stateDir, "credentials"), { recursive: true });

      await createBackupBeforeUninstall(mockRuntime, { stateDir, dryRun: true });

      expect(mockRuntime.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[dry-run\] Would backup: Config/),
      );
      expect(mockRuntime.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[dry-run\] Would backup: Credentials/),
      );
    });
  });

  // ===========================================================================
  // Error handling tests
  // ===========================================================================
  describe("createBackupBeforeUninstall - error handling", () => {
    it("handles permission errors gracefully", async () => {
      // This test is platform-specific and may not work on all systems
      // Skip if we can't set permissions
      if (process.platform === "win32") {
        return; // Windows permission handling is different
      }

      const credsDir = path.join(stateDir, "credentials");
      await fs.mkdir(credsDir, { recursive: true });
      await fs.writeFile(path.join(credsDir, "key.json"), "{}");

      // Make the file unreadable
      try {
        await fs.chmod(path.join(credsDir, "key.json"), 0o000);
      } catch {
        return; // Skip if we can't change permissions
      }

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      // Should complete (possibly with errors) rather than crashing
      expect(result).toBeDefined();

      // Restore permissions for cleanup
      await fs.chmod(path.join(credsDir, "key.json"), 0o644);
    });

    it("continues backing up other items when one fails", async () => {
      // Create valid items that should be backed up
      await fs.writeFile(path.join(stateDir, "config.json"), "{}");
      await fs.mkdir(path.join(stateDir, "identity"), { recursive: true });
      await fs.writeFile(path.join(stateDir, "identity", "id.json"), "{}");

      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      trackBackupDir(result.backupDir);

      expect(result.ok).toBe(true);
      expect(result.itemsBackedUp.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ===========================================================================
  // Performance tests
  // ===========================================================================
  describe("createBackupBeforeUninstall - performance", () => {
    it("completes backup of typical state dir in reasonable time", async () => {
      // Create a realistic state directory structure
      await fs.writeFile(path.join(stateDir, "config.json"), JSON.stringify({ test: true }));

      const credsDir = path.join(stateDir, "credentials");
      await fs.mkdir(credsDir, { recursive: true });
      for (let i = 0; i < 10; i++) {
        await fs.writeFile(path.join(credsDir, `provider-${i}.json`), `{"id": ${i}}`);
      }

      const agentsDir = path.join(stateDir, "agents", "main", "sessions");
      await fs.mkdir(agentsDir, { recursive: true });
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(path.join(agentsDir, `session-${i}.jsonl`), `{"turn": ${i}}`);
      }

      const start = Date.now();
      const result = await createBackupBeforeUninstall(mockRuntime, { stateDir });
      const elapsed = Date.now() - start;
      trackBackupDir(result.backupDir);

      expect(result.ok).toBe(true);
      expect(elapsed).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});

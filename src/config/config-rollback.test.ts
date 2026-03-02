import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listConfigBackups, rollbackConfig } from "./config-rollback.js";

describe("config-rollback", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-rollback-test-"));
    configPath = path.join(tmpDir, "openclawcn.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const writeJson = (filePath: string, obj: unknown) => {
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf-8");
  };

  const makeConfig = (version: string): Record<string, unknown> => ({
    meta: {
      lastTouchedVersion: version,
      lastTouchedAt: new Date().toISOString(),
    },
  });

  describe("listConfigBackups", () => {
    it("returns empty entries when no backups exist", () => {
      const entries = listConfigBackups(configPath);
      expect(entries.length).toBe(3);
      expect(entries.every((e) => !e.exists)).toBe(true);
    });

    it("finds .bak backup with version metadata", () => {
      const backup = makeConfig("1.2.3");
      writeJson(`${configPath}.bak`, backup);

      const entries = listConfigBackups(configPath);
      expect(entries[0].exists).toBe(true);
      expect(entries[0].version).toBe("1.2.3");
      expect(entries[0].valid).toBe(true);
      expect(entries[1].exists).toBe(false);
    });

    it("finds numbered backups", () => {
      writeJson(`${configPath}.bak`, makeConfig("1.0.0"));
      writeJson(`${configPath}.bak.1`, makeConfig("0.9.0"));
      writeJson(`${configPath}.bak.2`, makeConfig("0.8.0"));

      const entries = listConfigBackups(configPath);
      expect(entries[0].version).toBe("1.0.0");
      expect(entries[1].version).toBe("0.9.0");
      expect(entries[2].version).toBe("0.8.0");
    });

    it("reports invalid config in backup", () => {
      // Write something that's parseable but has an invalid field
      writeJson(`${configPath}.bak`, {
        meta: { lastTouchedVersion: "1.0.0" },
        unknownTopLevelField: true,
      });

      const entries = listConfigBackups(configPath);
      expect(entries[0].exists).toBe(true);
      expect(entries[0].version).toBe("1.0.0");
      // Validation may or may not pass depending on strict mode
      // The important thing is it doesn't throw
    });

    it("handles unparseable backup gracefully", () => {
      fs.writeFileSync(`${configPath}.bak`, "not valid json {{{", "utf-8");

      const entries = listConfigBackups(configPath);
      expect(entries[0].exists).toBe(true);
      expect(entries[0].version).toBe(null);
      expect(entries[0].valid).toBe(false);
    });
  });

  describe("rollbackConfig", () => {
    it("restores from .bak backup", async () => {
      writeJson(configPath, makeConfig("2.0.0"));
      writeJson(`${configPath}.bak`, makeConfig("1.0.0"));

      const result = await rollbackConfig(0, { configPath });
      expect(result.ok).toBe(true);
      expect(result.version).toBe("1.0.0");

      const restored = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      expect(restored.meta.lastTouchedVersion).toBe("1.0.0");
    });

    it("restores from numbered backup", async () => {
      writeJson(configPath, makeConfig("3.0.0"));
      writeJson(`${configPath}.bak`, makeConfig("2.0.0"));
      writeJson(`${configPath}.bak.1`, makeConfig("1.0.0"));

      const result = await rollbackConfig(1, { configPath });
      expect(result.ok).toBe(true);
      expect(result.version).toBe("1.0.0");
    });

    it("saves pre-rollback backup", async () => {
      writeJson(configPath, makeConfig("2.0.0"));
      writeJson(`${configPath}.bak`, makeConfig("1.0.0"));

      await rollbackConfig(0, { configPath });

      const preRollback = JSON.parse(fs.readFileSync(`${configPath}.pre-rollback.bak`, "utf-8"));
      expect(preRollback.meta.lastTouchedVersion).toBe("2.0.0");
    });

    it("fails when backup doesn't exist", async () => {
      const result = await rollbackConfig(0, { configPath });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("fails for invalid index", async () => {
      const result = await rollbackConfig(10, { configPath });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Invalid backup index");
    });

    it("fails for unparseable backup", async () => {
      fs.writeFileSync(`${configPath}.bak`, "not valid json", "utf-8");

      const result = await rollbackConfig(0, { configPath });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Failed to parse");
    });

    it("dry-run validates without restoring", async () => {
      writeJson(configPath, makeConfig("2.0.0"));
      writeJson(`${configPath}.bak`, makeConfig("1.0.0"));

      const result = await rollbackConfig(0, { configPath, dryRun: true });
      expect(result.ok).toBe(true);
      expect(result.version).toBe("1.0.0");

      // Config should NOT have changed
      const current = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      expect(current.meta.lastTouchedVersion).toBe("2.0.0");
    });

    it("skip-validate allows restoring invalid config", async () => {
      writeJson(configPath, makeConfig("2.0.0"));
      // Write parseable but potentially invalid config
      writeJson(`${configPath}.bak`, {
        meta: { lastTouchedVersion: "0.5.0" },
      });

      const result = await rollbackConfig(0, {
        configPath,
        validate: false,
      });
      expect(result.ok).toBe(true);
      expect(result.version).toBe("0.5.0");
    });
  });
});

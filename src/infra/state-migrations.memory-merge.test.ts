import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  mergeWorkspaceMemory,
  migrateLegacyConfigFilename,
  autoMigrateLegacyStateDir,
  resetAutoMigrateLegacyStateDirForTest,
} from "./state-migrations.js";

let tempRoot: string | null = null;

async function makeTempRoot() {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "openclawcn-mem-merge-"));
  tempRoot = root;
  return root;
}

function writeJson(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function makeProfile(
  entries: Array<{ category: string; key: string; value: string; updatedAt: number }>,
) {
  return {
    version: 1,
    entries: entries.map((e) => ({ ...e, hits: 0 })),
  };
}

afterEach(async () => {
  resetAutoMigrateLegacyStateDirForTest();
  if (tempRoot) {
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
    tempRoot = null;
  }
});

// ── mergeWorkspaceMemory: profile.json ──

describe("mergeWorkspaceMemory — profile.json", () => {
  it("copies legacy profile when target has none", async () => {
    const root = await makeTempRoot();
    const legacyWs = path.join(root, "legacy");
    const targetWs = path.join(root, "target");

    const profile = makeProfile([
      { category: "fact", key: "name", value: "Alice", updatedAt: 1000 },
    ]);
    writeJson(path.join(legacyWs, "memory", "profile.json"), profile);
    fs.mkdirSync(path.join(targetWs, "memory"), { recursive: true });

    const result = mergeWorkspaceMemory(legacyWs, targetWs);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toContain("copied 1 profile entries");

    const targetProfile = readJson(path.join(targetWs, "memory", "profile.json"));
    expect(targetProfile.entries).toHaveLength(1);
    expect(targetProfile.entries[0].value).toBe("Alice");
  });

  it("merges new entries from legacy into target", async () => {
    const root = await makeTempRoot();
    const legacyWs = path.join(root, "legacy");
    const targetWs = path.join(root, "target");

    writeJson(
      path.join(targetWs, "memory", "profile.json"),
      makeProfile([{ category: "fact", key: "name", value: "Bob", updatedAt: 2000 }]),
    );
    writeJson(
      path.join(legacyWs, "memory", "profile.json"),
      makeProfile([{ category: "preference", key: "lang", value: "zh-CN", updatedAt: 1500 }]),
    );

    const result = mergeWorkspaceMemory(legacyWs, targetWs);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toContain("merged 1 new");

    const merged = readJson(path.join(targetWs, "memory", "profile.json"));
    expect(merged.entries).toHaveLength(2);
  });

  it("updates target entry when legacy has newer updatedAt (BUG-3 regression)", async () => {
    const root = await makeTempRoot();
    const legacyWs = path.join(root, "legacy");
    const targetWs = path.join(root, "target");

    // Same key, legacy has newer timestamp
    writeJson(
      path.join(targetWs, "memory", "profile.json"),
      makeProfile([{ category: "fact", key: "city", value: "Beijing", updatedAt: 1000 }]),
    );
    writeJson(
      path.join(legacyWs, "memory", "profile.json"),
      makeProfile([{ category: "fact", key: "city", value: "Shanghai", updatedAt: 2000 }]),
    );

    const result = mergeWorkspaceMemory(legacyWs, targetWs);
    // Should detect the value update even though entry count doesn't change
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toContain("updated profile entries from legacy");

    const merged = readJson(path.join(targetWs, "memory", "profile.json"));
    expect(merged.entries).toHaveLength(1);
    expect(merged.entries[0].value).toBe("Shanghai");
  });

  it("keeps target entry when target has newer updatedAt", async () => {
    const root = await makeTempRoot();
    const legacyWs = path.join(root, "legacy");
    const targetWs = path.join(root, "target");

    writeJson(
      path.join(targetWs, "memory", "profile.json"),
      makeProfile([{ category: "fact", key: "city", value: "Shenzhen", updatedAt: 3000 }]),
    );
    writeJson(
      path.join(legacyWs, "memory", "profile.json"),
      makeProfile([{ category: "fact", key: "city", value: "Beijing", updatedAt: 1000 }]),
    );

    const result = mergeWorkspaceMemory(legacyWs, targetWs);
    // No changes needed — target is already newer
    expect(result.changes).toHaveLength(0);

    const merged = readJson(path.join(targetWs, "memory", "profile.json"));
    expect(merged.entries[0].value).toBe("Shenzhen");
  });

  it("caps merged entries at 50", async () => {
    const root = await makeTempRoot();
    const legacyWs = path.join(root, "legacy");
    const targetWs = path.join(root, "target");

    const targetEntries = Array.from({ length: 30 }, (_, i) => ({
      category: "fact" as const,
      key: `target-${i}`,
      value: `val-${i}`,
      updatedAt: 2000 + i,
    }));
    const legacyEntries = Array.from({ length: 30 }, (_, i) => ({
      category: "fact" as const,
      key: `legacy-${i}`,
      value: `val-${i}`,
      updatedAt: 1000 + i,
    }));

    writeJson(path.join(targetWs, "memory", "profile.json"), makeProfile(targetEntries));
    writeJson(path.join(legacyWs, "memory", "profile.json"), makeProfile(legacyEntries));

    const result = mergeWorkspaceMemory(legacyWs, targetWs);
    expect(result.changes.length).toBeGreaterThan(0);

    const merged = readJson(path.join(targetWs, "memory", "profile.json"));
    expect(merged.entries.length).toBeLessThanOrEqual(50);
  });

  it("skips malformed entries in legacy profile (ISSUE-6)", async () => {
    const root = await makeTempRoot();
    const legacyWs = path.join(root, "legacy");
    const targetWs = path.join(root, "target");

    // Write raw JSON with invalid entries
    const dir = path.join(legacyWs, "memory");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "profile.json"),
      JSON.stringify({
        version: 1,
        entries: [
          { category: "fact", key: "good", value: "ok", updatedAt: 1000, hits: 0 },
          null,
          { missing: "fields" },
          { category: "fact", key: "notime", value: "bad", updatedAt: "not-a-number", hits: 0 },
        ],
      }),
      "utf-8",
    );
    fs.mkdirSync(path.join(targetWs, "memory"), { recursive: true });

    const result = mergeWorkspaceMemory(legacyWs, targetWs);
    expect(result.warnings).toHaveLength(0);
    expect(result.changes).toHaveLength(1);

    const merged = readJson(path.join(targetWs, "memory", "profile.json"));
    // Only the valid entry should survive
    expect(merged.entries).toHaveLength(1);
    expect(merged.entries[0].key).toBe("good");
  });
});

// ── mergeWorkspaceMemory: MEMORY.md ──

describe("mergeWorkspaceMemory — MEMORY.md", () => {
  it("copies legacy MEMORY.md when target has none", async () => {
    const root = await makeTempRoot();
    const legacyWs = path.join(root, "legacy");
    const targetWs = path.join(root, "target");

    fs.mkdirSync(legacyWs, { recursive: true });
    fs.mkdirSync(path.join(legacyWs, "memory"), { recursive: true });
    fs.writeFileSync(path.join(legacyWs, "MEMORY.md"), "# Old notes\n", "utf-8");
    fs.mkdirSync(targetWs, { recursive: true });

    const result = mergeWorkspaceMemory(legacyWs, targetWs);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toContain("copied MEMORY.md");
    expect(fs.readFileSync(path.join(targetWs, "MEMORY.md"), "utf-8")).toContain("Old notes");
  });

  it("appends legacy content when both exist and differ", async () => {
    const root = await makeTempRoot();
    const legacyWs = path.join(root, "legacy");
    const targetWs = path.join(root, "target");

    fs.mkdirSync(legacyWs, { recursive: true });
    fs.mkdirSync(path.join(legacyWs, "memory"), { recursive: true });
    fs.writeFileSync(path.join(legacyWs, "MEMORY.md"), "# Legacy notes\n", "utf-8");
    fs.mkdirSync(targetWs, { recursive: true });
    fs.writeFileSync(path.join(targetWs, "MEMORY.md"), "# New notes\n", "utf-8");

    const result = mergeWorkspaceMemory(legacyWs, targetWs);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toContain("appended legacy content");

    const content = fs.readFileSync(path.join(targetWs, "MEMORY.md"), "utf-8");
    expect(content).toContain("New notes");
    expect(content).toContain("Legacy notes");
    expect(content).toContain("Imported from legacy config");
  });

  it("skips when content is identical", async () => {
    const root = await makeTempRoot();
    const legacyWs = path.join(root, "legacy");
    const targetWs = path.join(root, "target");

    fs.mkdirSync(legacyWs, { recursive: true });
    fs.mkdirSync(path.join(legacyWs, "memory"), { recursive: true });
    fs.writeFileSync(path.join(legacyWs, "MEMORY.md"), "# Same notes\n", "utf-8");
    fs.mkdirSync(targetWs, { recursive: true });
    fs.writeFileSync(path.join(targetWs, "MEMORY.md"), "# Same notes\n", "utf-8");

    const result = mergeWorkspaceMemory(legacyWs, targetWs);
    expect(result.changes).toHaveLength(0);
  });

  it("skips when target already has import marker (ISSUE-7)", async () => {
    const root = await makeTempRoot();
    const legacyWs = path.join(root, "legacy");
    const targetWs = path.join(root, "target");

    fs.mkdirSync(legacyWs, { recursive: true });
    fs.mkdirSync(path.join(legacyWs, "memory"), { recursive: true });
    fs.writeFileSync(path.join(legacyWs, "MEMORY.md"), "# Legacy\n", "utf-8");
    fs.mkdirSync(targetWs, { recursive: true });
    // Target already contains imported content from a previous migration
    fs.writeFileSync(
      path.join(targetWs, "MEMORY.md"),
      "# New\n---\n<!-- Imported from legacy config (2026-01-01) -->\n# Legacy\n",
      "utf-8",
    );

    const result = mergeWorkspaceMemory(legacyWs, targetWs);
    expect(result.changes).toHaveLength(0); // should not re-append
  });
});

// ── migrateLegacyConfigFilename ──

describe("migrateLegacyConfigFilename", () => {
  it("renames legacy config when canonical does not exist", async () => {
    const root = await makeTempRoot();
    fs.writeFileSync(path.join(root, "clawdbotcn.json"), '{"foo": 1}', "utf-8");

    const result = migrateLegacyConfigFilename(root);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toContain("clawdbotcn.json");

    const canonical = readJson(path.join(root, "openclawcn.json"));
    expect(canonical.foo).toBe(1);
    expect(fs.existsSync(path.join(root, "clawdbotcn.json"))).toBe(false);
  });

  it("deep-merges legacy config into existing canonical", async () => {
    const root = await makeTempRoot();
    writeJson(path.join(root, "openclawcn.json"), {
      models: { providers: [{ id: "openai", apiKey: "new-key" }] },
      gateway: { port: 18789 },
    });
    writeJson(path.join(root, "clawdbotcn.json"), {
      models: { providers: [{ id: "kimi-coding", apiKey: "kimi-key" }] },
      agent: { model: "gpt-4" },
    });

    const result = migrateLegacyConfigFilename(root);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toContain("merged");

    const canonical = readJson(path.join(root, "openclawcn.json"));
    // Canonical values should win for common keys
    expect(canonical.gateway.port).toBe(18789);
    // Legacy-only values should be preserved
    expect(canonical.agent.model).toBe("gpt-4");
    // Providers should be merged by id
    expect(canonical.models.providers).toHaveLength(2);
    expect(fs.existsSync(path.join(root, "clawdbotcn.json"))).toBe(false);
  });

  it("processes ALL legacy config files, not just the first (ISSUE-5)", async () => {
    const root = await makeTempRoot();
    writeJson(path.join(root, "clawdbotcn.json"), { source: "clawdbotcn", extra1: true });
    writeJson(path.join(root, "clawdbot.json"), { source: "clawdbot", extra2: true });

    const result = migrateLegacyConfigFilename(root);
    // Both should be processed
    expect(result.changes).toHaveLength(2);
    expect(fs.existsSync(path.join(root, "clawdbotcn.json"))).toBe(false);
    expect(fs.existsSync(path.join(root, "clawdbot.json"))).toBe(false);

    const canonical = readJson(path.join(root, "openclawcn.json"));
    // Data from both legacy files should be present
    expect(canonical.extra1).toBe(true);
    expect(canonical.extra2).toBe(true);
  });

  it("removes unreadable legacy files", async () => {
    const root = await makeTempRoot();
    fs.writeFileSync(path.join(root, "clawdbotcn.json"), "not json {{{", "utf-8");

    const result = migrateLegacyConfigFilename(root);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toContain("Removed unreadable");
    expect(fs.existsSync(path.join(root, "clawdbotcn.json"))).toBe(false);
  });

  it("does nothing when no legacy configs exist", async () => {
    const root = await makeTempRoot();
    const result = migrateLegacyConfigFilename(root);
    expect(result.changes).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

// ── autoMigrateLegacyStateDir: workspace-* memory merge ──

describe("autoMigrateLegacyStateDir — workspace-* memory merge (BUG-1)", () => {
  it("merges profile.json in workspace-agent1 subdirectory", async () => {
    const root = await makeTempRoot();
    const legacyDir = path.join(root, ".clawdbotcn");
    const targetDir = path.join(root, ".openclawcn");

    // Setup legacy workspace-agent1 with profile
    writeJson(
      path.join(legacyDir, "workspace-agent1", "memory", "profile.json"),
      makeProfile([
        { category: "fact", key: "agent1-fact", value: "from-legacy", updatedAt: 1000 },
      ]),
    );

    // Setup target workspace-agent1 with different profile
    writeJson(
      path.join(targetDir, "workspace-agent1", "memory", "profile.json"),
      makeProfile([{ category: "preference", key: "theme", value: "dark", updatedAt: 2000 }]),
    );

    const result = await autoMigrateLegacyStateDir({
      env: {} as NodeJS.ProcessEnv,
      homedir: () => root,
    });

    expect(result.migrated).toBe(true);

    // Both entries should be present in the merged profile
    const merged = readJson(path.join(targetDir, "workspace-agent1", "memory", "profile.json"));
    expect(merged.entries).toHaveLength(2);
    const keys = merged.entries.map((e: { key: string }) => e.key);
    expect(keys).toContain("agent1-fact");
    expect(keys).toContain("theme");
  });
});

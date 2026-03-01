/**
 * 顶级端到端集成测试 — 跨版本平滑升级全链路验证
 *
 * 覆盖：
 *   模块 A: Config 版本门控引擎
 *   模块 B: SQLite 版本化迁移
 *   模块 C: 升级前快照（Config + DB）
 *   模块 D: 升级稳定性监控（看门狗）
 *   集成:  跨版本升级全链路模拟
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ── Module A imports ──
import { applyLegacyMigrations, CURRENT_SCHEMA_VERSION } from "./legacy.js";

// ── Module B imports ──
import { getSchemaVersion, setSchemaVersion } from "../db/schema-version.js";
import { runDbMigrations, type DbMigration } from "../db/migrate.js";

// ── Module C imports ──
import { saveConfigVersionSnapshot } from "./version-snapshot.js";
import { saveDbSnapshot } from "../db/backup.js";

// ── Module D imports ──
import {
  recordUpgradeStart,
  recordUpgradeCrash,
  confirmUpgradeStable,
  readWatchdogState,
  CRASH_THRESHOLD,
} from "../infra/upgrade-watchdog.js";

// ── SQLite helper ──
let DatabaseSync: typeof import("node:sqlite").DatabaseSync;
try {
  const sqlite = await import("node:sqlite");
  DatabaseSync = sqlite.DatabaseSync;
} catch {
  // node:sqlite not available
}

// ── Temp dir helper ──
function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "upgrade-e2e-"));
}

function cleanDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

// ==========================================================================
// 模块 A: Config 版本门控引擎 — 端到端
// ==========================================================================

describe("Module A: Config Schema Version Gating (E2E)", () => {
  it("场景 1: 老版本 config (无 schemaVersion) 首次加载 → 执行全部迁移 + 盖章", () => {
    const raw = {
      whatsapp: { token: "abc" },
      gateway: { token: "secret" },
    };
    const result = applyLegacyMigrations(raw);
    expect(result.next).not.toBeNull();
    expect(result.changes.length).toBeGreaterThan(0);

    // 验证迁移执行了
    expect(result.next!.channels).toBeDefined();
    expect((result.next!.gateway as any).auth?.token).toBe("secret");

    // 验证 schemaVersion 盖章
    const meta = result.next!.meta as Record<string, unknown>;
    expect(meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("场景 2: 已标记 schemaVersion=1 的 config → 全部规则跳过", () => {
    const raw = {
      meta: { schemaVersion: CURRENT_SCHEMA_VERSION, lastTouchedVersion: "1.1.23" },
      channels: { whatsapp: { token: "abc" } },
      gateway: { auth: { token: "secret", mode: "token" } },
    };
    const result = applyLegacyMigrations(raw);
    // 已经是最新版本，无变更
    expect(result.next).toBeNull();
    expect(result.changes).toEqual([]);
  });

  it("场景 3: schemaVersion=0 但无遗留字段 → 只盖章不执行实际迁移", () => {
    const raw = {
      meta: { schemaVersion: 0 },
      channels: { telegram: { groups: {} } },
    };
    const result = applyLegacyMigrations(raw);
    expect(result.next).not.toBeNull();
    expect((result.next!.meta as any).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // 只有版本升级变更，无实际字段迁移
    expect(result.changes.some((c) => c.includes("Schema version updated"))).toBe(true);
  });

  it("场景 4: 模拟跨 2 个版本升级 — v0 → v1 全部迁移", () => {
    // 模拟一个从很旧版本遗留的配置（多个旧字段共存）
    const raw = {
      whatsapp: { token: "wa-token" },
      telegram: { requireMention: true },
      gateway: { token: "gw-secret" },
      agent: { model: "gpt-4", allowedModels: ["gpt-4", "gpt-3.5-turbo"] },
      identity: { name: "TestBot" },
    };
    const result = applyLegacyMigrations(raw);
    expect(result.next).not.toBeNull();

    // 验证所有迁移都执行了
    expect(result.next!.channels).toBeDefined();
    expect(result.next!.whatsapp).toBeUndefined(); // 已迁移到 channels.whatsapp
    expect((result.next!.gateway as any).token).toBeUndefined(); // 已迁移到 auth.token
    expect(result.next!.agent).toBeUndefined(); // 已迁移到 agents.defaults
    expect(result.next!.identity).toBeUndefined(); // 已迁移到 agents.list

    // 盖章
    expect((result.next!.meta as any).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    // 第二次加载：所有规则跳过
    const result2 = applyLegacyMigrations(result.next!);
    expect(result2.next).toBeNull();
    expect(result2.changes).toEqual([]);
  });

  it("场景 5: 旧版本兼容 — schemaVersion 对旧客户端安全", () => {
    // 旧客户端会因为 strict() 而 strip schemaVersion，然后从 0 重新开始
    // 这里验证从头迁移仍然安全（幂等）
    const configWithSchema = {
      meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
      channels: { whatsapp: { token: "abc" } },
    };
    // 模拟旧客户端 strip 掉 schemaVersion
    const stripped = structuredClone(configWithSchema);
    delete (stripped.meta as any).schemaVersion;

    // 旧客户端重新加载：从 0 开始但没有遗留字段，只盖章
    const result = applyLegacyMigrations(stripped);
    expect(result.next).not.toBeNull();
    expect((result.next!.meta as any).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});

// ==========================================================================
// 模块 B: SQLite 版本化迁移 — 端到端
// ==========================================================================

describe.skipIf(!DatabaseSync)("Module B: SQLite Versioned Migration (E2E)", () => {
  let db: InstanceType<typeof DatabaseSync>;

  beforeEach(() => {
    db = new DatabaseSync!(":memory:");
  });

  afterEach(() => {
    try {
      db?.close();
    } catch {
      // ignore
    }
  });

  it("场景 1: 全新数据库 → 执行全部迁移", () => {
    const migrations: DbMigration[] = [
      {
        version: 1,
        label: "core tables",
        up: (d) => {
          d.exec("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT)");
          d.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)");
        },
      },
      {
        version: 2,
        label: "add email column",
        up: (d) => d.exec("ALTER TABLE users ADD COLUMN email TEXT"),
      },
      {
        version: 3,
        label: "FTS5 search",
        noTransaction: true,
        up: (d) =>
          d.exec("CREATE VIRTUAL TABLE IF NOT EXISTS users_fts USING fts5(name, id UNINDEXED)"),
      },
    ];

    const result = runDbMigrations(db, migrations);
    expect(result.applied).toEqual([1, 2, 3]);
    expect(result.currentVersion).toBe(3);

    // 验证表结构
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'vtable') ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain("users");
    expect(names).toContain("settings");

    // 验证 email 列存在
    const cols = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    expect(cols.some((c) => c.name === "email")).toBe(true);
  });

  it("场景 2: 旧数据库 (user_version=0) → 增量迁移", () => {
    // 模拟旧版本已经通过 IF NOT EXISTS 创建了表
    db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT)");
    // user_version 仍然是 0（旧版本没有设置）

    const migrations: DbMigration[] = [
      {
        version: 1,
        label: "core tables",
        up: (d) => {
          d.exec("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT)");
          d.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");
        },
      },
      {
        version: 2,
        label: "add email",
        up: (d) => {
          // 安全的 ensureColumn 模式
          try {
            d.exec("ALTER TABLE users ADD COLUMN email TEXT");
          } catch {
            // already exists
          }
        },
      },
    ];

    const result = runDbMigrations(db, migrations);
    expect(result.applied).toEqual([1, 2]);
    expect(getSchemaVersion(db)).toBe(2);

    // 第二次运行：全部跳过
    const result2 = runDbMigrations(db, migrations);
    expect(result2.applied).toEqual([]);
    expect(result2.currentVersion).toBe(2);
  });

  it("场景 3: 跨多版本升级 — v1 → v4（跳 v2、v3）", () => {
    // 先创建 v1 状态
    db.exec("CREATE TABLE users (id TEXT PRIMARY KEY)");
    setSchemaVersion(db, 1);

    const migrations: DbMigration[] = [
      { version: 1, label: "v1", up: () => {} },
      { version: 2, label: "v2", up: (d) => d.exec("ALTER TABLE users ADD COLUMN email TEXT") },
      { version: 3, label: "v3", up: (d) => d.exec("ALTER TABLE users ADD COLUMN phone TEXT") },
      {
        version: 4,
        label: "v4",
        up: (d) => d.exec("CREATE TABLE audit (id INTEGER PRIMARY KEY, action TEXT)"),
      },
    ];

    const result = runDbMigrations(db, migrations);
    // 跳过 v1，执行 v2/v3/v4
    expect(result.applied).toEqual([2, 3, 4]);
    expect(getSchemaVersion(db)).toBe(4);
  });

  it("场景 4: 迁移中途失败 → 事务回滚 + 部分版本保留", () => {
    const migrations: DbMigration[] = [
      { version: 1, label: "ok", up: (d) => d.exec("CREATE TABLE a (id TEXT)") },
      {
        version: 2,
        label: "will fail",
        up: () => {
          throw new Error("intentional failure");
        },
      },
      { version: 3, label: "never reached", up: (d) => d.exec("CREATE TABLE c (id TEXT)") },
    ];

    expect(() => runDbMigrations(db, migrations)).toThrow("intentional failure");
    expect(getSchemaVersion(db)).toBe(1); // v1 成功，v2 回滚
    // 表 a 存在，表 c 不存在
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
      name: string;
    }>;
    expect(tables.map((t) => t.name)).toContain("a");
    expect(tables.map((t) => t.name)).not.toContain("c");
  });

  it("场景 5: noTransaction 迁移失败 → 静默跳过 + 版本推进", () => {
    const migrations: DbMigration[] = [
      {
        version: 1,
        label: "fts fail",
        noTransaction: true,
        up: () => {
          throw new Error("FTS5 not available");
        },
      },
      { version: 2, label: "normal", up: (d) => d.exec("CREATE TABLE b (id TEXT)") },
    ];

    const result = runDbMigrations(db, migrations);
    expect(result.applied).toEqual([1, 2]);
    expect(getSchemaVersion(db)).toBe(2);
  });
});

// ==========================================================================
// 模块 C: 升级前快照 — 端到端
// ==========================================================================

describe("Module C: Pre-upgrade Snapshots (E2E)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("场景 1: major 版本升级 → 生成 config 快照", async () => {
    const configPath = path.join(tmpDir, "openclawcn.json");
    fs.writeFileSync(configPath, JSON.stringify({ meta: { lastTouchedVersion: "1.0.5" } }));

    const snapshotPath = await saveConfigVersionSnapshot({
      configPath,
      beforeVersion: "1.0.5",
      afterVersion: "2.0.0",
      stateDir: tmpDir,
    });

    expect(snapshotPath).not.toBeNull();
    expect(fs.existsSync(snapshotPath!)).toBe(true);
    // 快照内容 = 原文件内容
    const original = fs.readFileSync(configPath, "utf-8");
    const snapshot = fs.readFileSync(snapshotPath!, "utf-8");
    expect(snapshot).toBe(original);
  });

  it("场景 2: minor 版本升级 → 生成快照", async () => {
    const configPath = path.join(tmpDir, "openclawcn.json");
    fs.writeFileSync(configPath, "{}");

    const snapshotPath = await saveConfigVersionSnapshot({
      configPath,
      beforeVersion: "1.1.0",
      afterVersion: "1.2.0",
      stateDir: tmpDir,
    });

    expect(snapshotPath).not.toBeNull();
  });

  it("场景 3: patch 版本升级 → 跳过快照", async () => {
    const configPath = path.join(tmpDir, "openclawcn.json");
    fs.writeFileSync(configPath, "{}");

    const snapshotPath = await saveConfigVersionSnapshot({
      configPath,
      beforeVersion: "1.1.22",
      afterVersion: "1.1.23",
      stateDir: tmpDir,
    });

    expect(snapshotPath).toBeNull();
  });

  it("场景 4: config 文件不存在 → 跳过", async () => {
    const snapshotPath = await saveConfigVersionSnapshot({
      configPath: path.join(tmpDir, "nonexistent.json"),
      beforeVersion: "1.0.0",
      afterVersion: "2.0.0",
      stateDir: tmpDir,
    });

    expect(snapshotPath).toBeNull();
  });

  it("场景 5: 快照自动清理（保留最近 5 个）", async () => {
    const configPath = path.join(tmpDir, "openclawcn.json");
    fs.writeFileSync(configPath, "{}");

    // 创建 7 个快照 (1.0→2.0, 2.0→3.0, ..., 7.0→8.0)
    for (let i = 1; i <= 7; i++) {
      await saveConfigVersionSnapshot({
        configPath,
        beforeVersion: `${i}.0.0`,
        afterVersion: `${i + 1}.0.0`,
        stateDir: tmpDir,
      });
      // 微小延迟确保 mtime 不同
      await new Promise((r) => setTimeout(r, 10));
    }

    const snapshotDir = path.join(tmpDir, "upgrade-snapshots");
    const files = fs.readdirSync(snapshotDir).filter((f) => f.startsWith("config-v"));
    expect(files.length).toBeLessThanOrEqual(5);
  });
});

describe.skipIf(!DatabaseSync)("Module C: DB Snapshot (E2E)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("场景 1: SQLite DB 快照 — WAL checkpoint + 文件复制", async () => {
    const dbPath = path.join(tmpDir, "test.sqlite");
    const db = new DatabaseSync!(dbPath);
    db.exec("PRAGMA journal_mode=WAL");
    db.exec("CREATE TABLE items (id TEXT PRIMARY KEY)");
    db.exec("INSERT INTO items VALUES ('hello')");
    db.close();

    const snapshotPath = await saveDbSnapshot({
      dbPath,
      label: "test-db",
      version: "1.0.0",
      stateDir: tmpDir,
    });

    expect(snapshotPath).not.toBeNull();
    expect(fs.existsSync(snapshotPath!)).toBe(true);

    // 打开快照验证数据完整
    const snapshotDb = new DatabaseSync!(snapshotPath!);
    const row = snapshotDb.prepare("SELECT id FROM items").get() as { id: string } | undefined;
    expect(row?.id).toBe("hello");
    snapshotDb.close();
  });

  it("场景 2: 不存在的 DB → 跳过", async () => {
    const snapshotPath = await saveDbSnapshot({
      dbPath: path.join(tmpDir, "nonexistent.sqlite"),
      label: "ghost",
      version: "1.0.0",
      stateDir: tmpDir,
    });

    expect(snapshotPath).toBeNull();
  });
});

// ==========================================================================
// 模块 D: 升级稳定性监控 — 端到端
// ==========================================================================

describe("Module D: Upgrade Watchdog (E2E)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("场景 1: 正常升级流程 — start → stable", () => {
    recordUpgradeStart("1.2.0", tmpDir);
    const state1 = readWatchdogState(tmpDir);
    expect(state1).not.toBeNull();
    expect(state1!.version).toBe("1.2.0");
    expect(state1!.crashCount).toBe(0);
    expect(state1!.confirmedStable).toBe(false);

    // 5 分钟后确认稳定
    confirmUpgradeStable("1.2.0", tmpDir);
    const state2 = readWatchdogState(tmpDir);
    expect(state2!.confirmedStable).toBe(true);
    expect(state2!.confirmedAt).toBeDefined();
  });

  it("场景 2: 升级后崩溃 — start → crash × 3 → 触发告警阈值", () => {
    recordUpgradeStart("1.3.0", tmpDir);

    for (let i = 0; i < CRASH_THRESHOLD; i++) {
      recordUpgradeCrash("1.3.0", tmpDir);
    }

    const state = readWatchdogState(tmpDir);
    expect(state!.crashCount).toBe(CRASH_THRESHOLD);
    expect(state!.confirmedStable).toBe(false);
    expect(state!.lastCrashAt).toBeDefined();
  });

  it("场景 3: 崩溃后手动恢复 → 再次确认稳定", () => {
    recordUpgradeStart("1.4.0", tmpDir);
    recordUpgradeCrash("1.4.0", tmpDir);
    recordUpgradeCrash("1.4.0", tmpDir);

    const state1 = readWatchdogState(tmpDir);
    expect(state1!.crashCount).toBe(2);

    // 运行稳定后确认
    confirmUpgradeStable("1.4.0", tmpDir);
    const state2 = readWatchdogState(tmpDir);
    expect(state2!.confirmedStable).toBe(true);

    // 确认稳定后不再计数
    recordUpgradeCrash("1.4.0", tmpDir);
    const state3 = readWatchdogState(tmpDir);
    expect(state3!.crashCount).toBe(2); // 不变
  });

  it("场景 4: 不同版本的崩溃不互相影响", () => {
    recordUpgradeStart("1.5.0", tmpDir);
    recordUpgradeCrash("1.5.0", tmpDir);

    // 升级到新版本
    recordUpgradeStart("1.6.0", tmpDir);
    const state = readWatchdogState(tmpDir);
    expect(state!.version).toBe("1.6.0");
    expect(state!.crashCount).toBe(0); // 计数重置

    // 旧版本崩溃不计入
    recordUpgradeCrash("1.5.0", tmpDir);
    const state2 = readWatchdogState(tmpDir);
    expect(state2!.crashCount).toBe(0);
  });

  it("场景 5: 已稳定版本重复 recordUpgradeStart → 不重置", () => {
    recordUpgradeStart("2.0.0", tmpDir);
    confirmUpgradeStable("2.0.0", tmpDir);

    // 重启时再次调用（不应重置稳定标记）
    recordUpgradeStart("2.0.0", tmpDir);
    const state = readWatchdogState(tmpDir);
    expect(state!.confirmedStable).toBe(true);
    expect(state!.crashCount).toBe(0);
  });

  it("场景 6: 无 watchdog 文件 → 所有操作安全返回", () => {
    expect(readWatchdogState(tmpDir)).toBeNull();
    // 不应抛异常
    recordUpgradeCrash("1.0.0", tmpDir);
    confirmUpgradeStable("1.0.0", tmpDir);
    expect(readWatchdogState(tmpDir)).toBeNull();
  });
});

// ==========================================================================
// 集成测试: 跨版本升级全链路模拟
// ==========================================================================

describe.skipIf(!DatabaseSync)("Integration: Full Cross-Version Upgrade Simulation", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("完整链路: v1.0.0 → v1.2.0 跨版本升级模拟", async () => {
    // ====== 阶段 1: 模拟 v1.0.0 的初始状态 ======

    // 1a. 旧版 config（无 schemaVersion）
    const configPath = path.join(tmpDir, "openclawcn.json");
    const oldConfig = {
      meta: { lastTouchedVersion: "1.0.0" },
      whatsapp: { token: "wa-token" },
      gateway: { token: "gw-secret" },
    };
    fs.writeFileSync(configPath, JSON.stringify(oldConfig, null, 2));

    // 1b. 旧版 DB（user_version=0，已有数据）
    const dbPath = path.join(tmpDir, "test.sqlite");
    const db = new DatabaseSync!(dbPath);
    db.exec("PRAGMA journal_mode=WAL");
    db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT)");
    db.exec("INSERT INTO users VALUES ('u1', 'Alice')");
    db.exec("INSERT INTO users VALUES ('u2', 'Bob')");
    db.close();

    // ====== 阶段 2: 触发升级 (v1.0.0 → v1.2.0) ======

    // 2a. 升级前快照
    const configSnapshot = await saveConfigVersionSnapshot({
      configPath,
      beforeVersion: "1.0.0",
      afterVersion: "1.2.0",
      stateDir: tmpDir,
    });
    expect(configSnapshot).not.toBeNull();
    expect(fs.existsSync(configSnapshot!)).toBe(true);

    const dbSnapshot = await saveDbSnapshot({
      dbPath,
      label: "test",
      version: "1.0.0",
      stateDir: tmpDir,
    });
    expect(dbSnapshot).not.toBeNull();

    // 2b. 看门狗记录升级开始
    recordUpgradeStart("1.2.0", tmpDir);
    expect(readWatchdogState(tmpDir)!.version).toBe("1.2.0");

    // ====== 阶段 3: 新版本首次启动 ======

    // 3a. Config 迁移
    const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const migrationResult = applyLegacyMigrations(rawConfig);
    expect(migrationResult.next).not.toBeNull();
    expect((migrationResult.next!.meta as any).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // whatsapp 迁移到 channels.whatsapp
    expect(migrationResult.next!.whatsapp).toBeUndefined();
    expect((migrationResult.next!.channels as any)?.whatsapp?.token).toBe("wa-token");
    // gateway.token 迁移到 gateway.auth.token
    expect((migrationResult.next!.gateway as any)?.token).toBeUndefined();
    expect((migrationResult.next!.gateway as any)?.auth?.token).toBe("gw-secret");

    // 保存迁移后的 config
    fs.writeFileSync(configPath, JSON.stringify(migrationResult.next, null, 2));

    // 3b. DB 迁移
    const db2 = new DatabaseSync!(dbPath);
    const dbMigrations: DbMigration[] = [
      {
        version: 1,
        label: "core tables",
        up: (d) => {
          d.exec("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT)");
          d.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");
        },
      },
      {
        version: 2,
        label: "add email",
        up: (d) => {
          try {
            d.exec("ALTER TABLE users ADD COLUMN email TEXT");
          } catch {
            // column already exists
          }
        },
      },
    ];

    const dbResult = runDbMigrations(db2, dbMigrations);
    expect(dbResult.applied).toEqual([1, 2]);
    expect(getSchemaVersion(db2)).toBe(2);

    // 验证原有数据完整
    const users = db2.prepare("SELECT * FROM users ORDER BY id").all() as Array<{
      id: string;
      name: string;
    }>;
    expect(users).toHaveLength(2);
    expect(users[0].name).toBe("Alice");
    db2.close();

    // ====== 阶段 4: 确认稳定 ======
    confirmUpgradeStable("1.2.0", tmpDir);
    expect(readWatchdogState(tmpDir)!.confirmedStable).toBe(true);

    // ====== 阶段 5: 再次启动（验证幂等性）======
    const reloadConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const result2 = applyLegacyMigrations(reloadConfig);
    expect(result2.next).toBeNull(); // 无变更
    expect(result2.changes).toEqual([]);

    const db3 = new DatabaseSync!(dbPath);
    const dbResult2 = runDbMigrations(db3, dbMigrations);
    expect(dbResult2.applied).toEqual([]); // 全部跳过
    expect(getSchemaVersion(db3)).toBe(2);
    db3.close();

    // ====== 阶段 6: 验证快照可用于回滚 ======
    // 读取 config 快照
    const snapshotContent = JSON.parse(fs.readFileSync(configSnapshot!, "utf-8"));
    expect(snapshotContent.whatsapp?.token).toBe("wa-token"); // 原始结构
    expect(snapshotContent.meta?.schemaVersion).toBeUndefined(); // 旧版无版本标记

    // 读取 DB 快照
    const snapshotDb = new DatabaseSync!(dbSnapshot!);
    const snapshotUsers = snapshotDb.prepare("SELECT * FROM users").all() as Array<{
      id: string;
    }>;
    expect(snapshotUsers).toHaveLength(2); // 数据完整
    snapshotDb.close();
  });

  it("崩溃恢复链路: 升级 → 崩溃 3 次 → doctor 检测", () => {
    recordUpgradeStart("2.0.0", tmpDir);

    // 模拟 3 次崩溃
    recordUpgradeCrash("2.0.0", tmpDir);
    recordUpgradeCrash("2.0.0", tmpDir);
    recordUpgradeCrash("2.0.0", tmpDir);

    const state = readWatchdogState(tmpDir);
    expect(state).not.toBeNull();
    expect(state!.crashCount).toBe(CRASH_THRESHOLD);
    expect(state!.confirmedStable).toBe(false);

    // Doctor 会检测到这个状态并报警
    // (实际 noteUpgradeStability 函数会读取并输出警告)
    expect(state!.crashCount >= CRASH_THRESHOLD).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runDbMigrations, type DbMigration } from "./migrate.js";
import { getSchemaVersion } from "./schema-version.js";

let DatabaseSync: typeof import("node:sqlite").DatabaseSync;
try {
  const sqlite = await import("node:sqlite");
  DatabaseSync = sqlite.DatabaseSync;
} catch {
  // node:sqlite not available — skip tests
}

describe.skipIf(!DatabaseSync)("runDbMigrations", () => {
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

  it("runs all migrations on a fresh database", () => {
    const migrations: DbMigration[] = [
      {
        version: 1,
        label: "create foo",
        up: (d) => d.exec("CREATE TABLE foo (id TEXT PRIMARY KEY)"),
      },
      {
        version: 2,
        label: "create bar",
        up: (d) => d.exec("CREATE TABLE bar (id TEXT PRIMARY KEY)"),
      },
    ];

    const result = runDbMigrations(db, migrations);
    expect(result.applied).toEqual([1, 2]);
    expect(result.currentVersion).toBe(2);
    expect(getSchemaVersion(db)).toBe(2);

    // Verify tables exist
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain("foo");
    expect(names).toContain("bar");
  });

  it("skips already-applied migrations", () => {
    const migrations: DbMigration[] = [
      {
        version: 1,
        label: "create foo",
        up: (d) => d.exec("CREATE TABLE foo (id TEXT PRIMARY KEY)"),
      },
      {
        version: 2,
        label: "create bar",
        up: (d) => d.exec("CREATE TABLE bar (id TEXT PRIMARY KEY)"),
      },
    ];

    // First run: apply both
    runDbMigrations(db, migrations);

    // Second run: skip both
    const result = runDbMigrations(db, migrations);
    expect(result.applied).toEqual([]);
    expect(result.currentVersion).toBe(2);
  });

  it("applies only newer migrations", () => {
    const migrationsV1: DbMigration[] = [
      {
        version: 1,
        label: "create foo",
        up: (d) => d.exec("CREATE TABLE foo (id TEXT PRIMARY KEY)"),
      },
    ];

    runDbMigrations(db, migrationsV1);

    const migrationsV2: DbMigration[] = [
      ...migrationsV1,
      {
        version: 2,
        label: "create bar",
        up: (d) => d.exec("CREATE TABLE bar (id TEXT PRIMARY KEY)"),
      },
    ];

    const result = runDbMigrations(db, migrationsV2);
    expect(result.applied).toEqual([2]);
    expect(result.currentVersion).toBe(2);
  });

  it("rolls back a failed transactional migration", () => {
    const migrations: DbMigration[] = [
      {
        version: 1,
        label: "create foo",
        up: (d) => d.exec("CREATE TABLE foo (id TEXT PRIMARY KEY)"),
      },
      {
        version: 2,
        label: "will fail",
        up: () => {
          throw new Error("deliberate failure");
        },
      },
    ];

    expect(() => runDbMigrations(db, migrations)).toThrow("deliberate failure");

    // Version 1 should have been applied, but 2 rolled back
    expect(getSchemaVersion(db)).toBe(1);
  });

  it("handles noTransaction migrations", () => {
    const migrations: DbMigration[] = [
      {
        version: 1,
        label: "no-tx migration",
        noTransaction: true,
        up: (d) => d.exec("CREATE TABLE notx (id TEXT)"),
      },
    ];

    const result = runDbMigrations(db, migrations);
    expect(result.applied).toEqual([1]);
    expect(getSchemaVersion(db)).toBe(1);
  });

  it("noTransaction migration failure still advances version", () => {
    const migrations: DbMigration[] = [
      {
        version: 1,
        label: "failing no-tx",
        noTransaction: true,
        up: () => {
          throw new Error("FTS5 unavailable");
        },
      },
    ];

    // Should not throw — noTransaction failures are swallowed
    const result = runDbMigrations(db, migrations);
    expect(result.applied).toEqual([1]);
    expect(getSchemaVersion(db)).toBe(1);
  });

  it("sorts migrations by version regardless of input order", () => {
    const order: number[] = [];
    const migrations: DbMigration[] = [
      {
        version: 3,
        label: "third",
        up: () => {
          order.push(3);
        },
      },
      {
        version: 1,
        label: "first",
        up: () => {
          order.push(1);
        },
      },
      {
        version: 2,
        label: "second",
        up: () => {
          order.push(2);
        },
      },
    ];

    runDbMigrations(db, migrations);
    expect(order).toEqual([1, 2, 3]);
  });
});

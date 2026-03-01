import { describe, expect, it } from "vitest";
import { applyLegacyMigrations, CURRENT_SCHEMA_VERSION } from "./legacy.js";

describe("legacy migration schema version gating", () => {
  it("exports CURRENT_SCHEMA_VERSION as a positive integer", () => {
    expect(typeof CURRENT_SCHEMA_VERSION).toBe("number");
    expect(Number.isInteger(CURRENT_SCHEMA_VERSION)).toBe(true);
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThan(0);
  });

  it("stamps schemaVersion on a config with no meta", () => {
    // A fresh config with a legacy key that triggers migration
    const raw = { whatsapp: { token: "abc" } };
    const result = applyLegacyMigrations(raw);
    expect(result.next).not.toBeNull();
    expect(result.next!.meta).toBeDefined();
    expect((result.next!.meta as any).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("stamps schemaVersion on a config with meta but no schemaVersion", () => {
    const raw = {
      meta: { lastTouchedVersion: "1.0.0" },
      whatsapp: { token: "abc" },
    };
    const result = applyLegacyMigrations(raw);
    expect(result.next).not.toBeNull();
    expect((result.next!.meta as any).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("skips all rules when schemaVersion >= CURRENT_SCHEMA_VERSION", () => {
    // Config already at current version — no legacy keys present
    const raw = {
      meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
      channels: { whatsapp: { token: "abc" } },
    };
    const result = applyLegacyMigrations(raw);
    // No changes because all rules are skipped and version is already current
    expect(result.next).toBeNull();
    expect(result.changes).toEqual([]);
  });

  it("upgrades schemaVersion from 0 even when no rules trigger changes", () => {
    // Config with schemaVersion: 0 but no legacy keys to migrate
    const raw = {
      meta: { schemaVersion: 0 },
      channels: { whatsapp: { token: "abc" } },
    };
    const result = applyLegacyMigrations(raw);
    // schemaVersion should advance from 0 to CURRENT_SCHEMA_VERSION
    expect(result.next).not.toBeNull();
    expect((result.next!.meta as any).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("returns null for non-object input", () => {
    expect(applyLegacyMigrations(null).next).toBeNull();
    expect(applyLegacyMigrations(undefined).next).toBeNull();
    expect(applyLegacyMigrations("string").next).toBeNull();
  });

  it("returns null for a clean config already at current schema", () => {
    const raw = {
      meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
      gateway: { auth: { mode: "token", token: "test" } },
    };
    const result = applyLegacyMigrations(raw);
    expect(result.next).toBeNull();
    expect(result.changes).toEqual([]);
  });
});

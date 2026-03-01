import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSchemaVersion, setSchemaVersion } from "./schema-version.js";

// We need node:sqlite for testing — guard against environments where it's unavailable
let DatabaseSync: typeof import("node:sqlite").DatabaseSync;
try {
  const sqlite = await import("node:sqlite");
  DatabaseSync = sqlite.DatabaseSync;
} catch {
  // node:sqlite not available — skip tests
}

describe.skipIf(!DatabaseSync)("schema-version", () => {
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

  it("returns 0 for a fresh database", () => {
    expect(getSchemaVersion(db)).toBe(0);
  });

  it("sets and reads a version", () => {
    setSchemaVersion(db, 5);
    expect(getSchemaVersion(db)).toBe(5);
  });

  it("overwrites a previous version", () => {
    setSchemaVersion(db, 3);
    setSchemaVersion(db, 7);
    expect(getSchemaVersion(db)).toBe(7);
  });

  it("throws on negative version", () => {
    expect(() => setSchemaVersion(db, -1)).toThrow("Invalid schema version");
  });

  it("throws on non-integer version", () => {
    expect(() => setSchemaVersion(db, 1.5)).toThrow("Invalid schema version");
  });

  it("accepts version 0", () => {
    setSchemaVersion(db, 42);
    setSchemaVersion(db, 0);
    expect(getSchemaVersion(db)).toBe(0);
  });
});

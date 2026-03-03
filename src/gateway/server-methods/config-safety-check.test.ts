import { describe, expect, it } from "vitest";
import { runConfigSafetyCheck } from "./config-safety-check.js";

describe("runConfigSafetyCheck", () => {
  // ── Basics ──

  it("returns no warnings when current is undefined (first-time write)", () => {
    const result = runConfigSafetyCheck({ gateway: { port: 3000 } }, undefined, "apply");
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("returns no warnings when configs are identical", () => {
    const cfg = { gateway: { port: 3000 }, channels: { tg: {} } };
    const result = runConfigSafetyCheck(cfg, cfg, "apply");
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  // ── Check 1: top-level key dropped (apply only) ──

  it("warns when a non-critical top-level key is dropped in apply mode", () => {
    // Only non-critical fields produce advisory warnings; critical fields are hard-blocked.
    const current = { gateway: { port: 3000 }, myNewFeature: { x: 1 }, customSection: { y: 2 } };
    const incoming = { gateway: { port: 3000 } };

    const result = runConfigSafetyCheck(incoming, current, "apply");
    const paths = result.warnings.map((w) => w.path);
    expect(result.ok).toBe(true);
    expect(paths).toContain("myNewFeature");
    expect(paths).toContain("customSection");
  });

  it("hard-blocks when a critical top-level key is dropped in apply mode", () => {
    // Dropping 'channels' (a CRITICAL_TOP_LEVEL_FIELDS member) must return ok=false.
    const current = { gateway: { port: 3000 }, channels: { tg: {} }, myNewFeature: { x: 1 } };
    const incoming = { gateway: { port: 3000 }, myNewFeature: { x: 1 } };

    const result = runConfigSafetyCheck(incoming, current, "apply");
    expect(result.ok).toBe(false);
    expect(result.blockReason).toMatch(/channels/);
  });

  it("does NOT warn about dropped keys in patch mode", () => {
    const current = { gateway: { port: 3000 }, channels: { tg: {} } };
    const incoming = { gateway: { port: 4000 } };

    const result = runConfigSafetyCheck(incoming, current, "patch");
    expect(result.warnings.filter((w) => w.path === "channels")).toHaveLength(0);
  });

  it("skips 'meta' key — it is auto-stamped and safe to drop", () => {
    const current = { meta: { lastTouchedAt: "2026-01-01" }, gateway: { port: 3000 } };
    const incoming = { gateway: { port: 3000 } };

    const result = runConfigSafetyCheck(incoming, current, "apply");
    expect(result.warnings.filter((w) => w.path === "meta")).toHaveLength(0);
  });

  // ── Check 2: config size drop ──

  it("hard-blocks when config size drops by more than 50% in apply mode", () => {
    // Use only non-critical fields so the size check fires before critical-field check.
    // Critical fields (channels, agents) must NOT appear in current, otherwise the
    // critical-fields hard-block fires first and the size check is never reached.
    const current = {
      gateway: { port: 3000, mode: "standalone", extra: "x".repeat(200) },
      serverInfo: { description: "s".repeat(200), tags: ["a", "b", "c", "d"] },
      customSection: { data: "d".repeat(200), nested: { more: "m".repeat(100) } },
    };
    const incoming = { gateway: { port: 3000 } };

    const result = runConfigSafetyCheck(incoming, current, "apply");
    // The size check triggers a hard-block (ok=false), not a warning.
    expect(result.ok).toBe(false);
    expect(result.blockReason).toMatch(/50%/);
  });

  it("does NOT warn about size drop in patch mode", () => {
    const current = {
      gateway: { port: 3000 },
      channels: { tg: { token: "a".repeat(300) } },
    };
    const incoming = { gateway: { port: 4000 } };

    const result = runConfigSafetyCheck(incoming, current, "patch");
    expect(result.warnings.filter((w) => w.path === "<root>")).toHaveLength(0);
  });

  // ── Check 3: generic entry count shrink ──

  it("warns when a top-level array shrinks", () => {
    const current = { servers: [{ id: "s1" }, { id: "s2" }, { id: "s3" }] };
    const incoming = { servers: [{ id: "s1" }] };

    const result = runConfigSafetyCheck(incoming, current, "apply");
    expect(result.warnings.some((w) => w.path === "servers")).toBe(true);
  });

  it("warns when a top-level object loses keys", () => {
    const current = { channels: { telegram: {}, signal: {}, discord: {} } };
    const incoming = { channels: { telegram: {} } };

    const result = runConfigSafetyCheck(incoming, current, "apply");
    expect(result.warnings.some((w) => w.path === "channels")).toBe(true);
  });

  it("warns when a nested array shrinks (e.g. agents.list)", () => {
    const current = { agents: { list: [{ id: "a1" }, { id: "a2" }] } };
    const incoming = { agents: { list: [{ id: "a1" }] } };

    const result = runConfigSafetyCheck(incoming, current, "apply");
    expect(result.warnings.some((w) => w.path === "agents.list")).toBe(true);
  });

  it("warns when a nested object loses keys (e.g. plugins.entries)", () => {
    const current = { plugins: { entries: { foo: {}, bar: {}, baz: {} } } };
    const incoming = { plugins: { entries: { foo: {} } } };

    const result = runConfigSafetyCheck(incoming, current, "apply");
    expect(result.warnings.some((w) => w.path === "plugins.entries")).toBe(true);
  });

  it("does NOT warn when entries grow", () => {
    const current = { agents: { list: [{ id: "a1" }] } };
    const incoming = { agents: { list: [{ id: "a1" }, { id: "a2" }] } };

    const result = runConfigSafetyCheck(incoming, current, "apply");
    expect(result.warnings.filter((w) => w.path === "agents.list")).toHaveLength(0);
  });

  it("patch mode: only checks keys present in patch", () => {
    const current = {
      agents: { list: [{ id: "a1" }, { id: "a2" }] },
      channels: { telegram: {}, signal: {} },
    };
    // Patch only touches agents
    const incoming = { agents: { list: [{ id: "a1" }] } };

    const result = runConfigSafetyCheck(incoming, current, "patch");
    // Should warn about agents.list shrink
    expect(result.warnings.some((w) => w.path === "agents.list")).toBe(true);
    // Should NOT warn about channels (not in patch)
    expect(result.warnings.filter((w) => w.path === "channels")).toHaveLength(0);
  });

  // ── Works with unknown future fields ──

  it("detects drops for fields it has never seen before", () => {
    const current = { futureFeature2030: { enabled: true, servers: ["a", "b"] } };
    const incoming = {};

    const result = runConfigSafetyCheck(incoming, current, "apply");
    expect(result.warnings.some((w) => w.path === "futureFeature2030")).toBe(true);
  });

  // ── Advisory warnings (non-critical drops) ──

  it("returns ok: true with warnings when only non-critical fields are dropped", () => {
    // Dropping only non-critical fields generates warnings but never blocks.
    // 'gateway' is not in CRITICAL_TOP_LEVEL_FIELDS, so advisory warnings only.
    const current = {
      gateway: { mode: "standalone", port: 3000 },
      myFeatureA: { value: 1 },
      myFeatureB: { value: 2 },
      plugins: { enabled: true },
    };
    // incoming keeps all critical-field keys absent from current (none present),
    // keeps size roughly the same, and only drops non-critical keys.
    const incoming = { gateway: { mode: "standalone", port: 3000 } };

    const result = runConfigSafetyCheck(incoming, current, "apply");
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("hard-blocks when multiple critical fields are dropped at once", () => {
    const current = {
      gateway: { mode: "standalone", port: 3000 },
      channels: { tg: { token: "abc" } },
      agents: { list: [{ id: "a1" }, { id: "a2" }] },
      plugins: { enabled: true },
    };
    const incoming = {};

    const result = runConfigSafetyCheck(incoming, current, "apply");
    expect(result.ok).toBe(false);
    // blockReason should mention the critical fields
    expect(result.blockReason).toBeDefined();
  });

  // ── Edge cases ──

  it("handles non-object current gracefully", () => {
    const result = runConfigSafetyCheck({ a: 1 }, "not-an-object" as unknown, "apply");
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("handles non-object incoming gracefully", () => {
    const result = runConfigSafetyCheck(42 as unknown, { a: 1 }, "apply");
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});

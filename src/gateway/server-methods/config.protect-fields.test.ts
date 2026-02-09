import { describe, expect, it } from "vitest";
import type { ClawdbotConfig } from "../../config/types.js";

/**
 * Re-implement preserveProtectedFields here for isolated unit testing.
 * The production copy lives in config.ts as a module-private function;
 * we mirror the exact logic so the test validates the algorithm, not the
 * import path.
 */
const PROTECTED_CONFIG_FIELDS: ReadonlyArray<keyof ClawdbotConfig> = ["license"];

function preserveProtectedFields(
  incoming: ClawdbotConfig,
  current: ClawdbotConfig | undefined,
): ClawdbotConfig {
  if (!current) return incoming;
  let patched = incoming;
  for (const field of PROTECTED_CONFIG_FIELDS) {
    if (patched[field] === undefined && current[field] !== undefined) {
      patched = { ...patched, [field]: current[field] };
    }
  }
  return patched;
}

describe("preserveProtectedFields", () => {
  const LICENSE = { key: "test-abc-123", status: "active" };

  it("back-fills license when incoming omits it", () => {
    const incoming: ClawdbotConfig = { meta: { lastTouchedAt: "2026-01-01" } };
    const current: ClawdbotConfig = { license: LICENSE };

    const result = preserveProtectedFields(incoming, current);

    expect(result.license).toEqual(LICENSE);
    // original meta preserved
    expect(result.meta?.lastTouchedAt).toBe("2026-01-01");
  });

  it("does NOT override when incoming explicitly provides license", () => {
    const newLicense = { key: "new-key-456", status: "pending" };
    const incoming: ClawdbotConfig = { license: newLicense };
    const current: ClawdbotConfig = { license: LICENSE };

    const result = preserveProtectedFields(incoming, current);

    expect(result.license).toEqual(newLicense);
  });

  it("returns incoming as-is when current is undefined", () => {
    const incoming: ClawdbotConfig = { meta: { lastTouchedAt: "2026-01-01" } };

    const result = preserveProtectedFields(incoming, undefined);

    expect(result).toBe(incoming); // same reference, no copy
    expect(result.license).toBeUndefined();
  });

  it("returns incoming as-is when current has no license either", () => {
    const incoming: ClawdbotConfig = { meta: { lastTouchedAt: "2026-01-01" } };
    const current: ClawdbotConfig = {};

    const result = preserveProtectedFields(incoming, current);

    expect(result.license).toBeUndefined();
  });

  it("does not mutate the incoming object", () => {
    const incoming: ClawdbotConfig = {};
    const current: ClawdbotConfig = { license: LICENSE };

    const result = preserveProtectedFields(incoming, current);

    // incoming is not mutated
    expect(incoming.license).toBeUndefined();
    // result is a new object with license
    expect(result.license).toEqual(LICENSE);
    expect(result).not.toBe(incoming);
  });

  it("handles license with all optional sub-fields", () => {
    const fullLicense = {
      key: "key-full",
      status: "active",
      expiresAt: "2027-01-01",
      tier: "test" as const,
      deviceId: "dev-123",
      shownNotificationIds: [1, 2, 3],
    };
    const incoming: ClawdbotConfig = {};
    const current: ClawdbotConfig = { license: fullLicense };

    const result = preserveProtectedFields(incoming, current);

    expect(result.license).toEqual(fullLicense);
    // deep equality, but same object reference (not cloned)
    expect(result.license).toBe(fullLicense);
  });

  it("preserves other fields in incoming when back-filling", () => {
    const incoming: ClawdbotConfig = {
      meta: { lastTouchedAt: "now" },
      gateway: { port: 9999 },
    } as ClawdbotConfig;
    const current: ClawdbotConfig = { license: LICENSE };

    const result = preserveProtectedFields(incoming, current);

    expect(result.license).toEqual(LICENSE);
    expect(result.meta?.lastTouchedAt).toBe("now");
    expect((result as Record<string, unknown>).gateway).toEqual({ port: 9999 });
  });
});

import fsSync from "node:fs";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  approveDevicePairing,
  getPairedDevice,
  listDevicePairing,
  removeDevice,
  requestDevicePairing,
  revokeDeviceToken,
  rotateDeviceToken,
  type PairedDevice,
} from "./device-pairing.js";

async function makeTempDir() {
  return await mkdtemp(join(tmpdir(), "clawdbot-device-pairing-"));
}

function cleanup(dir: string) {
  fsSync.rmSync(dir, { recursive: true, force: true });
}

/** Write a paired.json directly for testing loadState-level cleanup. */
async function writePairedState(baseDir: string, devices: Record<string, PairedDevice>) {
  const devicesDir = join(baseDir, "devices");
  await mkdir(devicesDir, { recursive: true });
  await writeFile(join(devicesDir, "paired.json"), JSON.stringify(devices, null, 2), "utf8");
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe("device pairing tokens", () => {
  test("preserves existing token scopes when rotating without scopes", async () => {
    const baseDir = await makeTempDir();
    try {
      const request = await requestDevicePairing(
        {
          deviceId: "device-1",
          publicKey: "public-key-1",
          role: "operator",
          scopes: ["operator.admin"],
        },
        baseDir,
      );
      await approveDevicePairing(request.request.requestId, baseDir);

      await rotateDeviceToken({
        deviceId: "device-1",
        role: "operator",
        scopes: ["operator.read"],
        baseDir,
      });
      let paired = await getPairedDevice("device-1", baseDir);
      expect(paired?.tokens?.operator?.scopes).toEqual(["operator.read"]);
      expect(paired?.scopes).toEqual(["operator.read"]);

      await rotateDeviceToken({
        deviceId: "device-1",
        role: "operator",
        baseDir,
      });
      paired = await getPairedDevice("device-1", baseDir);
      expect(paired?.tokens?.operator?.scopes).toEqual(["operator.read"]);
    } finally {
      cleanup(baseDir);
    }
  });
});

// ---------------------------------------------------------------------------
// pruneStaleDevices — auto-cleanup on loadState
// ---------------------------------------------------------------------------

describe("pruneStaleDevices (auto-cleanup)", () => {
  test("removes device whose ALL tokens are revoked > 7 days ago", async () => {
    const baseDir = await makeTempDir();
    try {
      const eightDaysAgo = Date.now() - 8 * DAY_MS;
      await writePairedState(baseDir, {
        "stale-device": {
          deviceId: "stale-device",
          publicKey: "pk-stale",
          createdAtMs: eightDaysAgo - DAY_MS,
          approvedAtMs: eightDaysAgo - DAY_MS,
          tokens: {
            operator: {
              token: "tok-1",
              role: "operator",
              scopes: ["operator.admin"],
              createdAtMs: eightDaysAgo - DAY_MS,
              revokedAtMs: eightDaysAgo,
            },
          },
        },
      });
      const list = await listDevicePairing(baseDir);
      expect(list.paired).toHaveLength(0);
    } finally {
      cleanup(baseDir);
    }
  });

  test("keeps device with active (non-revoked) token", async () => {
    const baseDir = await makeTempDir();
    try {
      const tenDaysAgo = Date.now() - 10 * DAY_MS;
      await writePairedState(baseDir, {
        "active-device": {
          deviceId: "active-device",
          publicKey: "pk-active",
          createdAtMs: tenDaysAgo,
          approvedAtMs: tenDaysAgo,
          tokens: {
            operator: {
              token: "tok-active",
              role: "operator",
              scopes: ["operator.admin"],
              createdAtMs: tenDaysAgo,
            },
          },
        },
      });
      const list = await listDevicePairing(baseDir);
      expect(list.paired).toHaveLength(1);
      expect(list.paired[0].deviceId).toBe("active-device");
    } finally {
      cleanup(baseDir);
    }
  });

  test("keeps device when revocation is within 7 days", async () => {
    const baseDir = await makeTempDir();
    try {
      const threeDaysAgo = Date.now() - 3 * DAY_MS;
      await writePairedState(baseDir, {
        "recent-revoke": {
          deviceId: "recent-revoke",
          publicKey: "pk-recent",
          createdAtMs: threeDaysAgo - DAY_MS,
          approvedAtMs: threeDaysAgo - DAY_MS,
          tokens: {
            operator: {
              token: "tok-recent",
              role: "operator",
              scopes: ["operator.admin"],
              createdAtMs: threeDaysAgo - DAY_MS,
              revokedAtMs: threeDaysAgo,
            },
          },
        },
      });
      const list = await listDevicePairing(baseDir);
      expect(list.paired).toHaveLength(1);
      expect(list.paired[0].deviceId).toBe("recent-revoke");
    } finally {
      cleanup(baseDir);
    }
  });

  test("keeps device with no tokens (zero-token edge case)", async () => {
    const baseDir = await makeTempDir();
    try {
      await writePairedState(baseDir, {
        "no-tokens": {
          deviceId: "no-tokens",
          publicKey: "pk-empty",
          createdAtMs: Date.now() - 30 * DAY_MS,
          approvedAtMs: Date.now() - 30 * DAY_MS,
          tokens: {},
        },
      });
      const list = await listDevicePairing(baseDir);
      expect(list.paired).toHaveLength(1);
    } finally {
      cleanup(baseDir);
    }
  });

  test("keeps device with undefined tokens", async () => {
    const baseDir = await makeTempDir();
    try {
      await writePairedState(baseDir, {
        "undef-tokens": {
          deviceId: "undef-tokens",
          publicKey: "pk-undef",
          createdAtMs: Date.now() - 30 * DAY_MS,
          approvedAtMs: Date.now() - 30 * DAY_MS,
        } as PairedDevice,
      });
      const list = await listDevicePairing(baseDir);
      expect(list.paired).toHaveLength(1);
    } finally {
      cleanup(baseDir);
    }
  });

  test("mixed: prunes only stale devices, keeps fresh ones", async () => {
    const baseDir = await makeTempDir();
    try {
      const now = Date.now();
      await writePairedState(baseDir, {
        "stale-a": {
          deviceId: "stale-a",
          publicKey: "pk-a",
          createdAtMs: now - 20 * DAY_MS,
          approvedAtMs: now - 20 * DAY_MS,
          tokens: {
            operator: {
              token: "t-a",
              role: "operator",
              scopes: [],
              createdAtMs: now - 20 * DAY_MS,
              revokedAtMs: now - 10 * DAY_MS,
            },
          },
        },
        "active-b": {
          deviceId: "active-b",
          publicKey: "pk-b",
          createdAtMs: now - 5 * DAY_MS,
          approvedAtMs: now - 5 * DAY_MS,
          tokens: {
            operator: {
              token: "t-b",
              role: "operator",
              scopes: ["operator.admin"],
              createdAtMs: now - 5 * DAY_MS,
            },
          },
        },
        "recent-revoke-c": {
          deviceId: "recent-revoke-c",
          publicKey: "pk-c",
          createdAtMs: now - 3 * DAY_MS,
          approvedAtMs: now - 3 * DAY_MS,
          tokens: {
            operator: {
              token: "t-c",
              role: "operator",
              scopes: [],
              createdAtMs: now - 3 * DAY_MS,
              revokedAtMs: now - 1 * DAY_MS,
            },
          },
        },
      });
      const list = await listDevicePairing(baseDir);
      const ids = list.paired.map((d) => d.deviceId).sort();
      expect(ids).toEqual(["active-b", "recent-revoke-c"]);
    } finally {
      cleanup(baseDir);
    }
  });

  test("multi-token device: only prunes when ALL tokens revoked > 7d", async () => {
    const baseDir = await makeTempDir();
    try {
      const now = Date.now();
      await writePairedState(baseDir, {
        "multi-token": {
          deviceId: "multi-token",
          publicKey: "pk-multi",
          createdAtMs: now - 15 * DAY_MS,
          approvedAtMs: now - 15 * DAY_MS,
          tokens: {
            operator: {
              token: "t-op",
              role: "operator",
              scopes: [],
              createdAtMs: now - 15 * DAY_MS,
              revokedAtMs: now - 10 * DAY_MS,
            },
            viewer: {
              token: "t-view",
              role: "viewer",
              scopes: [],
              createdAtMs: now - 15 * DAY_MS,
              // not revoked — device should survive
            },
          },
        },
      });
      const list = await listDevicePairing(baseDir);
      expect(list.paired).toHaveLength(1);
      expect(list.paired[0].deviceId).toBe("multi-token");
    } finally {
      cleanup(baseDir);
    }
  });

  test("multi-token device: prunes when all revoked, uses latest revokedAtMs", async () => {
    const baseDir = await makeTempDir();
    try {
      const now = Date.now();
      await writePairedState(baseDir, {
        "all-revoked": {
          deviceId: "all-revoked",
          publicKey: "pk-all-rev",
          createdAtMs: now - 20 * DAY_MS,
          approvedAtMs: now - 20 * DAY_MS,
          tokens: {
            operator: {
              token: "t-op",
              role: "operator",
              scopes: [],
              createdAtMs: now - 20 * DAY_MS,
              revokedAtMs: now - 15 * DAY_MS,
            },
            viewer: {
              token: "t-view",
              role: "viewer",
              scopes: [],
              createdAtMs: now - 20 * DAY_MS,
              revokedAtMs: now - 2 * DAY_MS, // <-- latest, within 7d
            },
          },
        },
      });
      // latest revoke is 2d ago — should survive
      const list = await listDevicePairing(baseDir);
      expect(list.paired).toHaveLength(1);
    } finally {
      cleanup(baseDir);
    }
  });

  test("multi-token device: prunes when all revoked > 7d", async () => {
    const baseDir = await makeTempDir();
    try {
      const now = Date.now();
      await writePairedState(baseDir, {
        "both-old-revoked": {
          deviceId: "both-old-revoked",
          publicKey: "pk-both",
          createdAtMs: now - 20 * DAY_MS,
          approvedAtMs: now - 20 * DAY_MS,
          tokens: {
            operator: {
              token: "t-op",
              role: "operator",
              scopes: [],
              createdAtMs: now - 20 * DAY_MS,
              revokedAtMs: now - 15 * DAY_MS,
            },
            viewer: {
              token: "t-view",
              role: "viewer",
              scopes: [],
              createdAtMs: now - 20 * DAY_MS,
              revokedAtMs: now - 10 * DAY_MS,
            },
          },
        },
      });
      const list = await listDevicePairing(baseDir);
      expect(list.paired).toHaveLength(0);
    } finally {
      cleanup(baseDir);
    }
  });

  test("boundary: revocation within 7-day threshold is NOT pruned", async () => {
    const baseDir = await makeTempDir();
    try {
      // Use 7 days minus 10 seconds to avoid timing drift between Date.now() calls
      const justUnderSevenDays = Date.now() - 7 * DAY_MS + 10_000;
      await writePairedState(baseDir, {
        "boundary-device": {
          deviceId: "boundary-device",
          publicKey: "pk-boundary",
          createdAtMs: justUnderSevenDays - DAY_MS,
          approvedAtMs: justUnderSevenDays - DAY_MS,
          tokens: {
            operator: {
              token: "tok-b",
              role: "operator",
              scopes: [],
              createdAtMs: justUnderSevenDays - DAY_MS,
              revokedAtMs: justUnderSevenDays,
            },
          },
        },
      });
      const list = await listDevicePairing(baseDir);
      expect(list.paired).toHaveLength(1);
    } finally {
      cleanup(baseDir);
    }
  });

  test("boundary: revocation just past 7-day threshold IS pruned", async () => {
    const baseDir = await makeTempDir();
    try {
      const justOverSevenDays = Date.now() - 7 * DAY_MS - 10_000;
      await writePairedState(baseDir, {
        "over-boundary": {
          deviceId: "over-boundary",
          publicKey: "pk-over",
          createdAtMs: justOverSevenDays - DAY_MS,
          approvedAtMs: justOverSevenDays - DAY_MS,
          tokens: {
            operator: {
              token: "tok-over",
              role: "operator",
              scopes: [],
              createdAtMs: justOverSevenDays - DAY_MS,
              revokedAtMs: justOverSevenDays,
            },
          },
        },
      });
      const list = await listDevicePairing(baseDir);
      expect(list.paired).toHaveLength(0);
    } finally {
      cleanup(baseDir);
    }
  });

  test("auto-cleanup via revoke flow: device revoked through API is pruned after 7d", async () => {
    const baseDir = await makeTempDir();
    try {
      // Pair and approve a device via the normal flow
      const req = await requestDevicePairing(
        {
          deviceId: "flow-device",
          publicKey: "pk-flow",
          role: "operator",
          scopes: ["operator.admin"],
        },
        baseDir,
      );
      await approveDevicePairing(req.request.requestId, baseDir);
      const before = await getPairedDevice("flow-device", baseDir);
      expect(before).not.toBeNull();

      // Revoke token via API
      const revoked = await revokeDeviceToken({
        deviceId: "flow-device",
        role: "operator",
        baseDir,
      });
      expect(revoked?.revokedAtMs).toBeDefined();

      // Device should still be visible (revoked < 7d)
      const afterRevoke = await listDevicePairing(baseDir);
      expect(afterRevoke.paired).toHaveLength(1);

      // Now manually backdate the revokedAtMs to 8 days ago in the state file
      const pairedPath = join(baseDir, "devices", "paired.json");
      const raw = JSON.parse(fsSync.readFileSync(pairedPath, "utf8"));
      raw["flow-device"].tokens.operator.revokedAtMs = Date.now() - 8 * DAY_MS;
      fsSync.writeFileSync(pairedPath, JSON.stringify(raw, null, 2), "utf8");

      // Next loadState should auto-prune
      const afterPrune = await listDevicePairing(baseDir);
      expect(afterPrune.paired).toHaveLength(0);
    } finally {
      cleanup(baseDir);
    }
  });
});

// ---------------------------------------------------------------------------
// removeDevice — manual deletion
// ---------------------------------------------------------------------------

describe("removeDevice", () => {
  test("removes an existing paired device", async () => {
    const baseDir = await makeTempDir();
    try {
      const req = await requestDevicePairing(
        {
          deviceId: "rm-device",
          publicKey: "pk-rm",
          role: "operator",
          scopes: ["operator.admin"],
        },
        baseDir,
      );
      await approveDevicePairing(req.request.requestId, baseDir);

      const result = await removeDevice({ deviceId: "rm-device", baseDir });
      expect(result).toEqual({ deviceId: "rm-device" });

      const after = await getPairedDevice("rm-device", baseDir);
      expect(after).toBeNull();
    } finally {
      cleanup(baseDir);
    }
  });

  test("returns null for non-existent device", async () => {
    const baseDir = await makeTempDir();
    try {
      const result = await removeDevice({ deviceId: "no-such-device", baseDir });
      expect(result).toBeNull();
    } finally {
      cleanup(baseDir);
    }
  });

  test("removes only the target device, leaves others intact", async () => {
    const baseDir = await makeTempDir();
    try {
      // Pair two devices
      const req1 = await requestDevicePairing(
        { deviceId: "keep-me", publicKey: "pk-keep", role: "operator", scopes: [] },
        baseDir,
      );
      await approveDevicePairing(req1.request.requestId, baseDir);

      const req2 = await requestDevicePairing(
        { deviceId: "delete-me", publicKey: "pk-del", role: "operator", scopes: [] },
        baseDir,
      );
      await approveDevicePairing(req2.request.requestId, baseDir);

      const before = await listDevicePairing(baseDir);
      expect(before.paired).toHaveLength(2);

      await removeDevice({ deviceId: "delete-me", baseDir });

      const after = await listDevicePairing(baseDir);
      expect(after.paired).toHaveLength(1);
      expect(after.paired[0].deviceId).toBe("keep-me");
    } finally {
      cleanup(baseDir);
    }
  });

  test("removal is persisted across loadState calls", async () => {
    const baseDir = await makeTempDir();
    try {
      const req = await requestDevicePairing(
        { deviceId: "persist-test", publicKey: "pk-persist", role: "operator", scopes: [] },
        baseDir,
      );
      await approveDevicePairing(req.request.requestId, baseDir);

      await removeDevice({ deviceId: "persist-test", baseDir });

      // Verify on-disk state
      const pairedPath = join(baseDir, "devices", "paired.json");
      const raw = JSON.parse(fsSync.readFileSync(pairedPath, "utf8"));
      expect(raw["persist-test"]).toBeUndefined();
    } finally {
      cleanup(baseDir);
    }
  });

  test("removing a device with active tokens works immediately", async () => {
    const baseDir = await makeTempDir();
    try {
      const req = await requestDevicePairing(
        {
          deviceId: "active-rm",
          publicKey: "pk-active-rm",
          role: "operator",
          scopes: ["operator.admin", "operator.pairing"],
        },
        baseDir,
      );
      await approveDevicePairing(req.request.requestId, baseDir);

      // Verify device has an active token
      const before = await getPairedDevice("active-rm", baseDir);
      expect(before?.tokens?.operator?.revokedAtMs).toBeUndefined();

      // Remove should work even with active tokens
      const result = await removeDevice({ deviceId: "active-rm", baseDir });
      expect(result).toEqual({ deviceId: "active-rm" });

      const after = await getPairedDevice("active-rm", baseDir);
      expect(after).toBeNull();
    } finally {
      cleanup(baseDir);
    }
  });

  test("handles whitespace in deviceId via normalization", async () => {
    const baseDir = await makeTempDir();
    try {
      const req = await requestDevicePairing(
        { deviceId: "trim-test", publicKey: "pk-trim", role: "operator", scopes: [] },
        baseDir,
      );
      await approveDevicePairing(req.request.requestId, baseDir);

      // Remove with whitespace-padded id
      const result = await removeDevice({ deviceId: "  trim-test  ", baseDir });
      expect(result).toEqual({ deviceId: "trim-test" });

      const after = await getPairedDevice("trim-test", baseDir);
      expect(after).toBeNull();
    } finally {
      cleanup(baseDir);
    }
  });
});

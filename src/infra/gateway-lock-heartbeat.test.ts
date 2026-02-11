import { createHash } from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { acquireGatewayLock, GatewayLockError } from "./gateway-lock.js";
import { resolveConfigPath, resolveGatewayLockDir, resolveStateDir } from "../config/paths.js";

async function makeEnv() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-lock-hb-"));
  const configPath = path.join(dir, "clawdbot.json");
  await fs.writeFile(configPath, "{}", "utf8");
  await fs.mkdir(resolveGatewayLockDir(), { recursive: true });
  return {
    dir,
    env: {
      ...process.env,
      CLAWDBOT_STATE_DIR: dir,
      CLAWDBOT_CONFIG_PATH: configPath,
    },
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

function resolveLockPath(env: NodeJS.ProcessEnv) {
  const stateDir = resolveStateDir(env);
  const configPath = resolveConfigPath(env, stateDir);
  const hash = createHash("sha1").update(configPath).digest("hex").slice(0, 8);
  const lockDir = resolveGatewayLockDir();
  return {
    lockPath: path.join(lockDir, `gateway.${hash}.lock`),
    heartbeatPath: path.join(lockDir, `gateway.${hash}.heartbeat`),
    configPath,
  };
}

describe("gateway lock heartbeat", () => {
  // ── Heartbeat file creation ────────────────────────────────────────
  it("creates heartbeat file alongside lock on acquisition", async () => {
    const { env, cleanup } = await makeEnv();
    const { heartbeatPath } = resolveLockPath(env);

    const lock = await acquireGatewayLock({
      env,
      allowInTests: true,
      timeoutMs: 2000,
      pollIntervalMs: 20,
    });
    expect(lock).not.toBeNull();

    // Heartbeat file should exist
    const exists = fsSync.existsSync(heartbeatPath);
    expect(exists).toBe(true);

    await lock!.release();
    await cleanup();
  });

  // ── Heartbeat file cleanup on release ──────────────────────────────
  it("removes heartbeat file on lock release", async () => {
    const { env, cleanup } = await makeEnv();
    const { heartbeatPath } = resolveLockPath(env);

    const lock = await acquireGatewayLock({
      env,
      allowInTests: true,
      timeoutMs: 2000,
      pollIntervalMs: 20,
    });
    expect(lock).not.toBeNull();
    expect(fsSync.existsSync(heartbeatPath)).toBe(true);

    await lock!.release();

    // After release, heartbeat file should be cleaned up
    expect(fsSync.existsSync(heartbeatPath)).toBe(false);
    await cleanup();
  });

  // ── Lock file cleanup on release ───────────────────────────────────
  it("removes lock file on release", async () => {
    const { env, cleanup } = await makeEnv();
    const { lockPath } = resolveLockPath(env);

    const lock = await acquireGatewayLock({
      env,
      allowInTests: true,
      timeoutMs: 2000,
      pollIntervalMs: 20,
    });

    expect(fsSync.existsSync(lockPath)).toBe(true);
    await lock!.release();
    expect(fsSync.existsSync(lockPath)).toBe(false);

    await cleanup();
  });

  // ── Stale heartbeat detection on non-Linux ─────────────────────────
  it("detects stale lock via heartbeat on Windows (platform=win32)", async () => {
    const { env, cleanup } = await makeEnv();
    const { lockPath, heartbeatPath, configPath } = resolveLockPath(env);

    // Create a fake lock owned by a "different PID" that is actually alive
    // but has a stale heartbeat
    const fakePid = process.pid;
    const payload = {
      pid: fakePid,
      createdAt: new Date().toISOString(),
      configPath,
    };
    await fs.writeFile(lockPath, JSON.stringify(payload), "utf8");

    // Create heartbeat file with very old mtime
    await fs.writeFile(heartbeatPath, "", "utf8");
    const veryOld = new Date(Date.now() - 60_000);
    await fs.utimes(heartbeatPath, veryOld, veryOld);

    // On win32 with staleMs=1, the heartbeat is definitely stale
    const lock = await acquireGatewayLock({
      env,
      allowInTests: true,
      timeoutMs: 2000,
      pollIntervalMs: 20,
      staleMs: 1,
      platform: "win32",
    });

    expect(lock).not.toBeNull();
    await lock!.release();
    await cleanup();
  });

  // ── Fresh heartbeat keeps lock alive on non-Linux ──────────────────
  it("respects fresh heartbeat on Windows (does not steal lock)", async () => {
    const { env, cleanup } = await makeEnv();
    const { lockPath, heartbeatPath, configPath } = resolveLockPath(env);

    // Create a fake lock owned by the current process with fresh heartbeat
    const payload = {
      pid: process.pid,
      createdAt: new Date().toISOString(),
      configPath,
    };
    await fs.writeFile(lockPath, JSON.stringify(payload), "utf8");

    // Create heartbeat file with CURRENT mtime (very fresh)
    await fs.writeFile(heartbeatPath, "", "utf8");

    // On win32 with large staleMs, heartbeat is fresh → lock should be respected
    await expect(
      acquireGatewayLock({
        env,
        allowInTests: true,
        timeoutMs: 200,
        pollIntervalMs: 20,
        staleMs: 60_000,
        platform: "win32",
      }),
    ).rejects.toBeInstanceOf(GatewayLockError);

    // Cleanup the fake files
    await fs.rm(lockPath, { force: true });
    await fs.rm(heartbeatPath, { force: true });
    await cleanup();
  });

  // ── Missing heartbeat file does not declare dead ───────────────────
  it("missing heartbeat does not falsely declare lock dead on Windows", async () => {
    const { env, cleanup } = await makeEnv();
    const { lockPath, configPath } = resolveLockPath(env);

    // Create a lock without a heartbeat file (backwards compat scenario)
    const payload = {
      pid: process.pid,
      createdAt: new Date().toISOString(),
      configPath,
    };
    await fs.writeFile(lockPath, JSON.stringify(payload), "utf8");

    // Should NOT be able to acquire because the PID is alive.
    // With no heartbeat file, the code checks lock createdAt against staleMs.
    // Use a large staleMs so the fresh lock is not considered stale.
    await expect(
      acquireGatewayLock({
        env,
        allowInTests: true,
        timeoutMs: 200,
        pollIntervalMs: 20,
        staleMs: 60_000,
        platform: "win32",
      }),
    ).rejects.toBeInstanceOf(GatewayLockError);

    await fs.rm(lockPath, { force: true });
    await cleanup();
  });

  // ── Dead PID bypasses heartbeat check ──────────────────────────────
  it("dead PID is detected regardless of heartbeat state", async () => {
    const { env, cleanup } = await makeEnv();
    const { lockPath, heartbeatPath, configPath } = resolveLockPath(env);

    // Use a PID that is guaranteed dead
    const deadPid = 99999999;
    const payload = {
      pid: deadPid,
      createdAt: new Date().toISOString(),
      configPath,
    };
    await fs.writeFile(lockPath, JSON.stringify(payload), "utf8");
    // Even with a fresh heartbeat, if PID is dead, lock should be stealable
    await fs.writeFile(heartbeatPath, "", "utf8");

    const lock = await acquireGatewayLock({
      env,
      allowInTests: true,
      timeoutMs: 2000,
      pollIntervalMs: 20,
      platform: "win32",
    });

    expect(lock).not.toBeNull();
    await lock!.release();
    await cleanup();
  });

  // ── Stale lock removal also removes heartbeat ──────────────────────
  it("removes heartbeat file when removing stale lock", async () => {
    const { env, cleanup } = await makeEnv();
    const { lockPath, heartbeatPath, configPath } = resolveLockPath(env);

    // Create stale lock with dead PID
    const payload = {
      pid: 99999999,
      createdAt: new Date(0).toISOString(),
      configPath,
    };
    await fs.writeFile(lockPath, JSON.stringify(payload), "utf8");
    await fs.writeFile(heartbeatPath, "old", "utf8");

    const lock = await acquireGatewayLock({
      env,
      allowInTests: true,
      timeoutMs: 2000,
      pollIntervalMs: 20,
      platform: "win32",
    });
    expect(lock).not.toBeNull();

    // After acquisition, old heartbeat should have been removed
    // (a new one for the current process is created)
    const hbContent = fsSync.readFileSync(heartbeatPath, "utf8");
    expect(hbContent).not.toBe("old");

    await lock!.release();
    await cleanup();
  });

  // ── Heartbeat path derivation ──────────────────────────────────────
  it("heartbeat path is derived from lock path by replacing .lock with .heartbeat", async () => {
    const { env, cleanup } = await makeEnv();
    const { lockPath, heartbeatPath } = resolveLockPath(env);

    expect(heartbeatPath).toBe(lockPath.replace(/\.lock$/, ".heartbeat"));
    await cleanup();
  });
});

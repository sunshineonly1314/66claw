/**
 * Integration tests — cross-module interaction.
 *
 * Tests that distributed-broadcast, session-lock-distributed, and config-reload
 * correctly interact with MemoryStateStore through the global singleton.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStateStore } from "./memory-store.js";
import { initStateStore, closeStateStore, getStateStoreOrNull } from "./index.js";
import { initDistributedBroadcast } from "../../gateway/distributed-broadcast.js";
import { acquireSessionLock } from "../../agents/session-lock-distributed.js";
import { buildGatewayReloadPlan } from "../../gateway/config-reload.js";
import { getSubagentDepth } from "../../sessions/session-key-utils.js";
import { computeRestartAwareDelay, DEFAULT_RECONNECT_POLICY } from "../../web/reconnect.js";
import { listConfigBackups, rollbackConfig } from "../../config/config-rollback.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("Integration: StateStore + distributed modules", () => {
  beforeEach(async () => {
    await initStateStore({ backend: "memory" });
  });

  afterEach(async () => {
    await closeStateStore();
  });

  describe("distributed broadcast via StateStore", () => {
    it("two bridges relay events cross-instance", async () => {
      const localBroadcast1 = vi.fn();
      const localBroadcastToConnIds1 = vi.fn();
      const localBroadcast2 = vi.fn();
      const localBroadcastToConnIds2 = vi.fn();

      const bridge1 = await initDistributedBroadcast({
        localBroadcast: localBroadcast1,
        localBroadcastToConnIds: localBroadcastToConnIds1,
        _instanceId: "instance-A",
      });

      const bridge2 = await initDistributedBroadcast({
        localBroadcast: localBroadcast2,
        localBroadcastToConnIds: localBroadcastToConnIds2,
        _instanceId: "instance-B",
      });

      // Instance A broadcasts
      bridge1.broadcast("test-event", { msg: "from-A" });

      // Wait for pub/sub delivery
      await new Promise((r) => setTimeout(r, 50));

      // Instance A delivered locally
      expect(localBroadcast1).toHaveBeenCalledWith("test-event", { msg: "from-A" }, undefined);
      // Instance B received via pub/sub
      expect(localBroadcast2).toHaveBeenCalledWith("test-event", { msg: "from-A" }, undefined);
      // Instance A did NOT receive its own echo
      expect(localBroadcast1).toHaveBeenCalledTimes(1);

      // Instance B broadcasts
      bridge2.broadcast("event-2", { msg: "from-B" });
      await new Promise((r) => setTimeout(r, 50));

      // Instance A received
      expect(localBroadcast1).toHaveBeenCalledWith("event-2", { msg: "from-B" }, undefined);
      // Instance B only local
      expect(localBroadcast2).toHaveBeenCalledTimes(2); // event-2 local + test-event relay

      bridge1.teardown();
      bridge2.teardown();
    });

    it("targeted broadcast only delivers to specified connIds", async () => {
      const localBroadcast1 = vi.fn();
      const localBroadcastToConnIds1 = vi.fn();
      const localBroadcast2 = vi.fn();
      const localBroadcastToConnIds2 = vi.fn();

      const bridge1 = await initDistributedBroadcast({
        localBroadcast: localBroadcast1,
        localBroadcastToConnIds: localBroadcastToConnIds1,
        _instanceId: "inst-1",
      });

      const bridge2 = await initDistributedBroadcast({
        localBroadcast: localBroadcast2,
        localBroadcastToConnIds: localBroadcastToConnIds2,
        _instanceId: "inst-2",
      });

      const targetIds = new Set(["conn-abc", "conn-def"]);
      bridge1.broadcastToConnIds("targeted-event", { data: 42 }, targetIds);

      await new Promise((r) => setTimeout(r, 50));

      // Instance 1 received locally (targeted)
      expect(localBroadcastToConnIds1).toHaveBeenCalledTimes(1);
      // Instance 2 received via relay (targeted)
      expect(localBroadcastToConnIds2).toHaveBeenCalledTimes(1);
      const receivedConnIds = localBroadcastToConnIds2.mock.calls[0][2];
      expect(receivedConnIds).toEqual(new Set(["conn-abc", "conn-def"]));
      // Neither instance received global broadcast
      expect(localBroadcast1).toHaveBeenCalledTimes(0);
      expect(localBroadcast2).toHaveBeenCalledTimes(0);

      bridge1.teardown();
      bridge2.teardown();
    });
  });

  describe("session lock via StateStore", () => {
    it("distributed lock serializes access", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lock-integ-"));
      const sessionFile = path.join(tmpDir, "test-session.json");
      fs.writeFileSync(sessionFile, "{}", "utf-8");

      const order: number[] = [];

      const work = async (id: number) => {
        const lock = await acquireSessionLock({
          sessionFile,
          timeoutMs: 5_000,
          staleMs: 5_000,
        });
        order.push(id);
        await new Promise((r) => setTimeout(r, 20));
        await lock.release();
      };

      await Promise.all([work(1), work(2), work(3)]);

      expect(order.length).toBe(3);
      expect(new Set(order).size).toBe(3);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});

describe("Integration: config-reload + plugins hot reload", () => {
  it("plugins change triggers hot reload plan", () => {
    const plan = buildGatewayReloadPlan(["plugins.myPlugin.enabled"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.reloadPlugins).toBe(true);
    expect(plan.hotReasons).toContain("plugins.myPlugin.enabled");
  });

  it("multiple changes with plugins + hooks produce combined plan", () => {
    const plan = buildGatewayReloadPlan([
      "plugins.myPlugin",
      "hooks.gmail.account",
      "models.openai",
    ]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.reloadPlugins).toBe(true);
    expect(plan.reloadHooks).toBe(true);
    expect(plan.restartGmailWatcher).toBe(true);
    // "models" is kind: "none" — should be in noopPaths
    expect(plan.noopPaths).toContain("models.openai");
  });

  it("gateway change forces restart even with plugins change", () => {
    const plan = buildGatewayReloadPlan(["plugins.myPlugin", "gateway.port"]);
    expect(plan.restartGateway).toBe(true);
    expect(plan.reloadPlugins).toBe(true);
  });
});

describe("Integration: subagent depth + session key utils", () => {
  it("depth 0 for top-level agent session", () => {
    expect(getSubagentDepth("agent:main:direct")).toBe(0);
  });

  it("depth 1 for single subagent", () => {
    expect(getSubagentDepth("agent:main:subagent:task1")).toBe(1);
  });

  it("depth 2 for nested subagent", () => {
    expect(getSubagentDepth("agent:main:subagent:task1:subagent:subtask")).toBe(2);
  });

  it("handoff keys have depth 0 (no subagent: prefix)", () => {
    expect(getSubagentDepth("agent:target:handoff:uuid")).toBe(0);
  });

  it("depth is case-insensitive", () => {
    expect(getSubagentDepth("agent:main:SUBAGENT:task:Subagent:nested")).toBe(2);
  });
});

describe("Integration: restart-aware reconnect delay", () => {
  const policy = DEFAULT_RECONNECT_POLICY;

  it("first attempt uses server hint with 20% buffer", () => {
    const delay = computeRestartAwareDelay({ restartExpectedMs: 2000, attempt: 0, policy });
    // 2000 + min(500, 2000*0.2=400) = 2400
    expect(delay).toBe(2400);
  });

  it("second attempt still uses server hint", () => {
    const delay = computeRestartAwareDelay({ restartExpectedMs: 2000, attempt: 1, policy });
    expect(delay).toBe(2400);
  });

  it("third attempt ignores server hint, uses backoff", () => {
    const delay = computeRestartAwareDelay({ restartExpectedMs: 2000, attempt: 2, policy });
    expect(delay).not.toBe(2400);
    expect(delay).toBeGreaterThan(0);
  });

  it("no server hint falls back immediately to backoff", () => {
    const d0 = computeRestartAwareDelay({ attempt: 0, policy });
    const d1 = computeRestartAwareDelay({ attempt: 1, policy });
    // computeBackoff includes jitter, so check within expected range
    expect(d0).toBeGreaterThanOrEqual(policy.initialMs * (1 - policy.jitter));
    expect(d0).toBeLessThanOrEqual(policy.initialMs * (1 + policy.jitter));
    expect(d1).toBeGreaterThanOrEqual(policy.initialMs);
  });
});

describe("Integration: config rollback with temp directory", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rollback-integ-"));
    configPath = path.join(tmpDir, "config.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("full rollback workflow: list → dry-run → execute", async () => {
    // Setup: current config + backup
    fs.writeFileSync(
      configPath,
      JSON.stringify({ meta: { lastTouchedVersion: "2.0.0" } }),
      "utf-8",
    );
    fs.writeFileSync(
      `${configPath}.bak`,
      JSON.stringify({ meta: { lastTouchedVersion: "1.5.0" } }),
      "utf-8",
    );

    // Step 1: List
    const entries = listConfigBackups(configPath);
    expect(entries[0].exists).toBe(true);
    expect(entries[0].version).toBe("1.5.0");

    // Step 2: Dry run
    const dryResult = await rollbackConfig(0, { configPath, dryRun: true });
    expect(dryResult.ok).toBe(true);
    expect(dryResult.version).toBe("1.5.0");
    // Config unchanged
    const currentAfterDry = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(currentAfterDry.meta.lastTouchedVersion).toBe("2.0.0");

    // Step 3: Execute
    const result = await rollbackConfig(0, { configPath });
    expect(result.ok).toBe(true);
    // Config now restored
    const restored = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(restored.meta.lastTouchedVersion).toBe("1.5.0");
    // Pre-rollback backup exists (named with timestamp: *.pre-rollback.*.bak)
    const dir = path.dirname(configPath);
    const base = path.basename(configPath);
    const preRollbackFiles = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(base) && f.includes(".pre-rollback.") && f.endsWith(".bak"));
    expect(preRollbackFiles.length).toBeGreaterThan(0);
    const preRollback = JSON.parse(fs.readFileSync(path.join(dir, preRollbackFiles[0]), "utf-8"));
    expect(preRollback.meta.lastTouchedVersion).toBe("2.0.0");
  });
});

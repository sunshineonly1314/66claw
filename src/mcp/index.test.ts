/**
 * MCP Manager (index.ts) unit tests.
 *
 * Tests the MCPManager facade and global singleton lifecycle.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  MCPManager,
  getMCPManager,
  getMCPManagerSafe,
  initMCPManager,
  initMCPManagerIfNeeded,
  destroyMCPManager,
} from "./index.js";
import type { MCPConfig, MCPServerConfig } from "./types.js";

// ============================================================================
// Mock the heavy dependencies (MCPClient spawns processes)
// ============================================================================

vi.mock("./mcp-client.js", () => ({
  MCPClient: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.connect = vi.fn().mockResolvedValue(undefined);
    this.listTools = vi.fn().mockResolvedValue([]);
    this.shutdown = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(this, "pid", { get() { return 999; } });
    Object.defineProperty(this, "connected", { get() { return true; } });
  }),
  buildBridgedName: (sid: string, tn: string) => `mcp_${sid}_${tn}`,
}));

function makeConfig(): MCPConfig {
  return {
    servers: [
      {
        id: "test-srv",
        command: "node",
        args: ["echo-server.js"],
        transport: "stdio",
        enabled: true,
        autoStart: true,
      } as MCPServerConfig,
    ],
  };
}

describe("MCPManager", () => {
  let manager: MCPManager;

  beforeEach(() => {
    manager = new MCPManager();
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  it("starts as not initialized", () => {
    expect(manager.initialized).toBe(false);
  });

  it("initialize() sets initialized to true", async () => {
    await manager.initialize(makeConfig());
    expect(manager.initialized).toBe(true);
  });

  it("initialize() is idempotent", async () => {
    await manager.initialize(makeConfig());
    await manager.initialize(makeConfig()); // second call — no-op
    expect(manager.initialized).toBe(true);
  });

  it("getStatus() returns servers and tools", async () => {
    await manager.initialize(makeConfig());
    const status = manager.getStatus();
    expect(status.servers).toHaveLength(1);
    expect(Array.isArray(status.tools)).toBe(true);
  });

  it("getAvailableTools() returns empty before init", () => {
    expect(manager.getAvailableTools()).toEqual([]);
  });

  it("shutdown() resets initialized", async () => {
    await manager.initialize(makeConfig());
    await manager.shutdown();
    expect(manager.initialized).toBe(false);
  });

  it("addServer + removeServer", async () => {
    await manager.initialize({});
    const config: MCPServerConfig = {
      id: "dynamic",
      command: "node",
      transport: "stdio",
      enabled: true,
      autoStart: false,
    };
    await manager.addServer(config);
    expect(manager.registry.hasServer("dynamic")).toBe(true);

    await manager.removeServer("dynamic");
    expect(manager.registry.hasServer("dynamic")).toBe(false);
  });

  it("sync() removes servers no longer in config", async () => {
    await manager.initialize(makeConfig());
    expect(manager.runtime.getServerState("test-srv")).toBeDefined();

    // Sync with empty config — should stop and unregister test-srv
    await manager.sync({});
    expect(manager.runtime.getServerState("test-srv")).toBeUndefined();
  });
});

// ============================================================================
// Global Singleton
// ============================================================================

describe("Global Singleton", () => {
  afterEach(async () => {
    await destroyMCPManager();
  });

  it("getMCPManager throws before init", () => {
    expect(() => getMCPManager()).toThrow("MCPManager not initialized");
  });

  it("getMCPManagerSafe returns null before init", () => {
    expect(getMCPManagerSafe()).toBeNull();
  });

  it("initMCPManager creates and returns manager", async () => {
    const m = await initMCPManager(makeConfig());
    expect(m).toBeInstanceOf(MCPManager);
    expect(m.initialized).toBe(true);
    expect(getMCPManager()).toBe(m);
    expect(getMCPManagerSafe()).toBe(m);
  });

  it("initMCPManager is idempotent", async () => {
    const m1 = await initMCPManager(makeConfig());
    const m2 = await initMCPManager(makeConfig());
    expect(m1).toBe(m2);
  });

  it("concurrent initMCPManager calls share the same promise", async () => {
    const p1 = initMCPManager(makeConfig());
    const p2 = initMCPManager(makeConfig());
    const [m1, m2] = await Promise.all([p1, p2]);
    expect(m1).toBe(m2);
  });

  it("destroyMCPManager cleans up", async () => {
    await initMCPManager(makeConfig());
    await destroyMCPManager();
    expect(getMCPManagerSafe()).toBeNull();
  });

  it("initMCPManagerIfNeeded does nothing without mcp config", async () => {
    await initMCPManagerIfNeeded(undefined);
    expect(getMCPManagerSafe()).toBeNull();

    await initMCPManagerIfNeeded({});
    expect(getMCPManagerSafe()).toBeNull();

    await initMCPManagerIfNeeded({ mcp: {} });
    expect(getMCPManagerSafe()).toBeNull();

    await initMCPManagerIfNeeded({ mcp: { servers: [] } });
    expect(getMCPManagerSafe()).toBeNull();
  });

  it("initMCPManagerIfNeeded initializes when servers present", async () => {
    await initMCPManagerIfNeeded({ mcp: makeConfig() });
    expect(getMCPManagerSafe()).not.toBeNull();
    expect(getMCPManagerSafe()!.initialized).toBe(true);
  });
});

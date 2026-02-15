/**
 * MCP RuntimeManager unit tests.
 *
 * MCPClient is fully mocked — these tests verify lifecycle state management,
 * circuit breaker logic, and restart timer handling without spawning processes.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MCPRuntimeManager } from "./runtime-manager.js";
import type { MCPServerConfig } from "./types.js";
import {
  MCP_MAX_RESTART_ATTEMPTS,
  MCP_HEALTH_FAILURE_THRESHOLD,
} from "./types.js";

// ============================================================================
// Mock MCPClient
// ============================================================================

// Capture onClose/onError/onToolsChanged callbacks passed to MCPClient constructor
type ClientEvents = {
  onClose?: () => void;
  onError?: (err: Error) => void;
  onToolsChanged?: () => void;
};

let lastClientEvents: ClientEvents = {};
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockListTools = vi.fn().mockResolvedValue([
  {
    serverId: "test",
    name: "echo",
    bridgedName: "mcp_test_echo",
    description: "echo tool",
    inputSchema: { type: "object", properties: {} },
  },
]);
const mockShutdown = vi.fn().mockResolvedValue(undefined);
const mockPid = 12345;
const mockConnected = vi.fn().mockReturnValue(true);

vi.mock("./mcp-client.js", () => ({
  MCPClient: vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
    _config: MCPServerConfig,
    events: ClientEvents,
  ) {
    lastClientEvents = events;
    this.connect = mockConnect;
    this.listTools = mockListTools;
    this.shutdown = mockShutdown;
    Object.defineProperty(this, "pid", { get() { return mockPid; } });
    Object.defineProperty(this, "connected", { get() { return mockConnected(); } });
  }),
  buildBridgedName: (serverId: string, toolName: string) => `mcp_${serverId}_${toolName}`,
}));

// ============================================================================
// Helpers
// ============================================================================

function makeConfig(id: string, overrides?: Partial<MCPServerConfig>): MCPServerConfig {
  return {
    id,
    command: "node",
    args: ["server.js"],
    transport: "stdio",
    enabled: true,
    autoStart: true,
    ...overrides,
  };
}

describe("MCPRuntimeManager", () => {
  let rm: MCPRuntimeManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockConnected.mockReturnValue(true);
    rm = new MCPRuntimeManager();
  });

  afterEach(() => {
    rm.stopHealthMonitor();
    vi.useRealTimers();
  });

  // ============================================================================
  // register + startServer
  // ============================================================================

  describe("register", () => {
    it("registers a server with stopped status", () => {
      rm.register(makeConfig("fs"));
      const state = rm.getServerState("fs");
      expect(state).toBeDefined();
      expect(state!.status).toBe("stopped");
      expect(state!.tools).toEqual([]);
    });

    it("does not overwrite existing registration", () => {
      rm.register(makeConfig("fs"));
      rm.register(makeConfig("fs", { command: "deno" }));
      expect(rm.getServerState("fs")!.config.command).toBe("node");
    });
  });

  describe("startServer", () => {
    it("starts a registered server", async () => {
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");
      const state = rm.getServerState("fs")!;
      expect(state.status).toBe("running");
      expect(state.pid).toBe(mockPid);
      expect(state.tools).toHaveLength(1);
      expect(state.restartCount).toBe(0);
      expect(mockConnect).toHaveBeenCalledOnce();
    });

    it("throws for unknown server", async () => {
      await expect(rm.startServer("nope")).rejects.toThrow("Unknown MCP server");
    });

    it("no-ops when already running", async () => {
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");
      mockConnect.mockClear();
      await rm.startServer("fs");
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("stays stopped when disabled", async () => {
      rm.register(makeConfig("fs", { enabled: false }));
      await rm.startServer("fs");
      expect(rm.getServerState("fs")!.status).toBe("stopped");
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("sets error status on connect failure", async () => {
      mockConnect.mockRejectedValueOnce(new Error("spawn failed"));
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");
      const state = rm.getServerState("fs")!;
      expect(state.status).toBe("error");
      expect(state.error).toContain("spawn failed");
      expect(mockShutdown).toHaveBeenCalledOnce();
    });
  });

  // ============================================================================
  // stopServer
  // ============================================================================

  describe("stopServer", () => {
    it("stops a running server", async () => {
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");
      await rm.stopServer("fs");
      const state = rm.getServerState("fs")!;
      expect(state.status).toBe("stopped");
      expect(state.tools).toEqual([]);
      expect(state.pid).toBeUndefined();
      expect(mockShutdown).toHaveBeenCalled();
    });

    it("no-ops for unknown server", async () => {
      // Should not throw
      await rm.stopServer("nope");
    });

    it("cancels pending restart timers", async () => {
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");

      // Simulate crash → triggers auto-restart timer
      lastClientEvents.onClose?.();
      expect(rm.getServerState("fs")!.status).toBe("restarting");

      // Stop before timer fires
      mockConnect.mockClear();
      await rm.stopServer("fs");

      // Advance past the restart delay
      await vi.advanceTimersByTimeAsync(10_000);
      // startServer should NOT have been called again (timer was cancelled)
      expect(mockConnect).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // restartServer
  // ============================================================================

  describe("restartServer", () => {
    it("stops then starts", async () => {
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");
      mockConnect.mockClear();
      await rm.restartServer("fs");
      expect(mockShutdown).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalledOnce();
      expect(rm.getServerState("fs")!.status).toBe("running");
    });

    it("resets circuit breaker and restartCount", async () => {
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");
      const state = rm.getServerState("fs")!;
      state.restartCount = 5;

      await rm.restartServer("fs");
      expect(rm.getServerState("fs")!.restartCount).toBe(0);
    });
  });

  // ============================================================================
  // disableServer / enableServer
  // ============================================================================

  describe("disableServer / enableServer", () => {
    it("disableServer stops and marks disabled", async () => {
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");
      await rm.disableServer("fs");
      expect(rm.getServerState("fs")!.config.enabled).toBe(false);
      expect(rm.getServerState("fs")!.status).toBe("stopped");
    });

    it("enableServer marks enabled and starts", async () => {
      rm.register(makeConfig("fs", { enabled: false }));
      mockConnect.mockClear();
      await rm.enableServer("fs");
      expect(rm.getServerState("fs")!.config.enabled).toBe(true);
      expect(mockConnect).toHaveBeenCalledOnce();
    });
  });

  // ============================================================================
  // Auto-restart on crash
  // ============================================================================

  describe("auto-restart on crash", () => {
    it("restarts on first unexpected close", async () => {
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");

      mockConnect.mockClear();
      lastClientEvents.onClose?.();
      expect(rm.getServerState("fs")!.status).toBe("restarting");
      expect(rm.getServerState("fs")!.restartCount).toBe(1);

      // Advance timer to trigger the delayed restart
      await vi.advanceTimersByTimeAsync(1100);
      expect(mockConnect).toHaveBeenCalledOnce();
      expect(rm.getServerState("fs")!.status).toBe("running");
      // restartCount is reset to 0 after successful start
      expect(rm.getServerState("fs")!.restartCount).toBe(0);
    });

    it("goes to error after exceeding max restarts", async () => {
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");

      // Exhaust all restart attempts
      const state = rm.getServerState("fs")!;
      state.restartCount = MCP_MAX_RESTART_ATTEMPTS;

      lastClientEvents.onClose?.();
      expect(state.status).toBe("error");
      expect(state.error).toContain("Crashed after");
    });

    it("does not restart when status is stopped", async () => {
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");
      await rm.stopServer("fs");

      mockConnect.mockClear();
      lastClientEvents.onClose?.();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockConnect).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // startAutoStartServers
  // ============================================================================

  describe("startAutoStartServers", () => {
    it("starts all enabled+autoStart servers", async () => {
      rm.register(makeConfig("a"));
      rm.register(makeConfig("b", { autoStart: false }));
      rm.register(makeConfig("c", { enabled: false }));

      await rm.startAutoStartServers();
      expect(rm.getServerState("a")!.status).toBe("running");
      expect(rm.getServerState("b")!.status).toBe("stopped");
      expect(rm.getServerState("c")!.status).toBe("stopped");
    });
  });

  // ============================================================================
  // shutdownAll
  // ============================================================================

  describe("shutdownAll", () => {
    it("stops all running servers and clears health monitor", async () => {
      rm.register(makeConfig("a"));
      rm.register(makeConfig("b"));
      await rm.startServer("a");
      await rm.startServer("b");
      rm.startHealthMonitor();

      await rm.shutdownAll();
      expect(rm.getServerState("a")!.status).toBe("stopped");
      expect(rm.getServerState("b")!.status).toBe("stopped");
    });
  });

  // ============================================================================
  // getAllTools
  // ============================================================================

  describe("getAllTools", () => {
    it("returns tools from running servers only", async () => {
      rm.register(makeConfig("a"));
      rm.register(makeConfig("b"));
      await rm.startServer("a");
      // b is not started

      const tools = rm.getAllTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every((t) => t.serverId === "test")).toBe(true);
    });
  });

  // ============================================================================
  // handleToolsChanged
  // ============================================================================

  describe("tools/list_changed notification", () => {
    it("refreshes tools when server notifies of change", async () => {
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");

      const newTools = [
        {
          serverId: "test",
          name: "echo",
          bridgedName: "mcp_test_echo",
          description: "echo tool",
          inputSchema: {},
        },
        {
          serverId: "test",
          name: "new_tool",
          bridgedName: "mcp_test_new_tool",
          description: "new tool",
          inputSchema: {},
        },
      ];
      mockListTools.mockResolvedValueOnce(newTools);

      // Trigger the notification callback
      lastClientEvents.onToolsChanged?.();

      // Wait for the async listTools() promise to settle
      await vi.advanceTimersByTimeAsync(0);

      expect(rm.getServerState("fs")!.tools).toHaveLength(2);
    });
  });

  // ============================================================================
  // Health monitoring
  // ============================================================================

  describe("health monitoring", () => {
    it("detects disconnected client as health failure", async () => {
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");
      rm.startHealthMonitor();

      // Simulate disconnected client
      mockConnected.mockReturnValue(false);

      // Advance timer past MCP_HEALTH_FAILURE_THRESHOLD health check intervals
      // Each interval is 30_000ms. We need threshold+1 intervals to trigger all checks.
      for (let i = 0; i < MCP_HEALTH_FAILURE_THRESHOLD; i++) {
        await vi.advanceTimersByTimeAsync(30_000);
      }

      // After threshold failures, circuit should open
      expect(rm.getServerState("fs")!.status).toBe("circuit_open");
    });
  });

  // ============================================================================
  // handleServerError
  // ============================================================================

  describe("handleServerError", () => {
    it("records error message on running server", async () => {
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");

      lastClientEvents.onError?.(new Error("protocol error"));
      expect(rm.getServerState("fs")!.error).toBe("protocol error");
    });

    it("ignores errors when server is stopped", async () => {
      rm.register(makeConfig("fs"));
      await rm.startServer("fs");
      await rm.stopServer("fs");

      lastClientEvents.onError?.(new Error("stale error"));
      expect(rm.getServerState("fs")!.error).toBeUndefined();
    });
  });
});

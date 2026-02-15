/**
 * MCP Registry unit tests.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { MCPRegistry } from "./registry.js";
import type { MCPServerConfig, MCPConfig } from "./types.js";
import { MCP_MAX_SERVERS } from "./types.js";

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

describe("MCPRegistry", () => {
  let registry: MCPRegistry;

  beforeEach(() => {
    registry = new MCPRegistry();
  });

  // ============================================================================
  // loadFromConfig
  // ============================================================================

  describe("loadFromConfig", () => {
    it("loads servers from config", () => {
      const cfg: MCPConfig = {
        servers: [makeConfig("fs"), makeConfig("git")],
      };
      const result = registry.loadFromConfig(cfg);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("fs");
      expect(result[1].id).toBe("git");
    });

    it("returns empty array for undefined config", () => {
      expect(registry.loadFromConfig(undefined)).toEqual([]);
    });

    it("returns empty array for config without servers", () => {
      expect(registry.loadFromConfig({})).toEqual([]);
    });

    it("skips entries without id", () => {
      const cfg: MCPConfig = {
        servers: [
          { id: "", command: "node", transport: "stdio", enabled: true, autoStart: true },
          makeConfig("valid"),
        ],
      };
      const result = registry.loadFromConfig(cfg);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("valid");
    });

    it("skips entries without command", () => {
      const cfg: MCPConfig = {
        servers: [
          { id: "bad", command: "", transport: "stdio", enabled: true, autoStart: true },
          makeConfig("valid"),
        ],
      };
      const result = registry.loadFromConfig(cfg);
      expect(result).toHaveLength(1);
    });

    it("defaults enabled=true and autoStart=true", () => {
      const cfg: MCPConfig = {
        servers: [{ id: "x", command: "node", transport: "stdio" } as MCPServerConfig],
      };
      const result = registry.loadFromConfig(cfg);
      expect(result[0].enabled).toBe(true);
      expect(result[0].autoStart).toBe(true);
    });

    it("defaults transport to stdio", () => {
      const cfg: MCPConfig = {
        servers: [{ id: "x", command: "node" } as MCPServerConfig],
      };
      const result = registry.loadFromConfig(cfg);
      expect(result[0].transport).toBe("stdio");
    });

    it("clears previous servers on reload", () => {
      registry.loadFromConfig({ servers: [makeConfig("a"), makeConfig("b")] });
      const result = registry.loadFromConfig({ servers: [makeConfig("c")] });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c");
      expect(registry.hasServer("a")).toBe(false);
    });
  });

  // ============================================================================
  // addServer / removeServer / getServer / hasServer
  // ============================================================================

  describe("addServer", () => {
    it("adds a server", () => {
      registry.addServer(makeConfig("fs"));
      expect(registry.hasServer("fs")).toBe(true);
      expect(registry.getServer("fs")?.command).toBe("node");
    });

    it("updates existing server config", () => {
      registry.addServer(makeConfig("fs", { command: "node" }));
      registry.addServer(makeConfig("fs", { command: "deno" }));
      expect(registry.getServer("fs")?.command).toBe("deno");
    });

    it("enforces MCP_MAX_SERVERS limit", () => {
      for (let i = 0; i < MCP_MAX_SERVERS; i++) {
        registry.addServer(makeConfig(`s${i}`));
      }
      expect(() => registry.addServer(makeConfig("overflow"))).toThrowError(
        /maximum of 20 servers reached/,
      );
    });

    it("allows update when at max capacity", () => {
      for (let i = 0; i < MCP_MAX_SERVERS; i++) {
        registry.addServer(makeConfig(`s${i}`));
      }
      // Updating existing — should NOT throw
      expect(() => registry.addServer(makeConfig("s0", { command: "deno" }))).not.toThrow();
      expect(registry.getServer("s0")?.command).toBe("deno");
    });
  });

  describe("removeServer", () => {
    it("removes an existing server", () => {
      registry.addServer(makeConfig("fs"));
      expect(registry.removeServer("fs")).toBe(true);
      expect(registry.hasServer("fs")).toBe(false);
    });

    it("returns false for non-existent server", () => {
      expect(registry.removeServer("nope")).toBe(false);
    });
  });

  describe("getAllServers", () => {
    it("returns all registered servers as array", () => {
      registry.addServer(makeConfig("a"));
      registry.addServer(makeConfig("b"));
      const all = registry.getAllServers();
      expect(all).toHaveLength(2);
      expect(all.map((s) => s.id).sort()).toEqual(["a", "b"]);
    });

    it("returns a copy (not the internal map)", () => {
      registry.addServer(makeConfig("a"));
      const all = registry.getAllServers();
      all.pop(); // mutate
      expect(registry.getAllServers()).toHaveLength(1);
    });
  });
});

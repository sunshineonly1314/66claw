/**
 * MCP Tool Bridge unit tests.
 */
import { describe, it, expect, vi } from "vitest";
import {
  isMCPToolName,
  parseMCPToolName,
  getMCPToolMeta,
  bridgeMCPTools,
} from "./tool-bridge.js";
import { buildBridgedName } from "./mcp-client.js";
import { MCP_TOOL_PREFIX, MCP_MAX_RESULT_BYTES } from "./types.js";
import type { MCPRuntimeManager } from "./runtime-manager.js";
import type { MCPToolInfo } from "./types.js";
import type { MCPClient } from "./mcp-client.js";

// ============================================================================
// helpers
// ============================================================================

function makeTool(serverId: string, name: string): MCPToolInfo {
  return {
    serverId,
    name,
    bridgedName: buildBridgedName(serverId, name),
    description: `Tool ${name} from ${serverId}`,
    inputSchema: { type: "object", properties: { path: { type: "string" } } },
  };
}

function mockRuntimeManager(
  tools: MCPToolInfo[],
  clientOverrides?: Partial<MCPClient>,
): MCPRuntimeManager {
  return {
    getAllTools: () => tools,
    getClient: () =>
      clientOverrides
        ? ({ connected: true, ...clientOverrides } as unknown as MCPClient)
        : undefined,
  } as unknown as MCPRuntimeManager;
}

// ============================================================================
// isMCPToolName
// ============================================================================

describe("isMCPToolName", () => {
  it("returns true for mcp_ prefixed names", () => {
    expect(isMCPToolName("mcp_fs_read")).toBe(true);
  });

  it("returns false for non-mcp names", () => {
    expect(isMCPToolName("bash_exec")).toBe(false);
    expect(isMCPToolName("")).toBe(false);
    expect(isMCPToolName("Mcp_foo")).toBe(false); // case-sensitive
  });
});

// ============================================================================
// parseMCPToolName
// ============================================================================

describe("parseMCPToolName", () => {
  it("parses valid tool name", () => {
    expect(parseMCPToolName("mcp_filesystem_read_file")).toEqual({
      serverId: "filesystem",
      toolName: "read_file",
    });
  });

  it("returns null for non-mcp prefix", () => {
    expect(parseMCPToolName("bash_exec")).toBeNull();
  });

  it("returns null for empty serverId (mcp__tool)", () => {
    expect(parseMCPToolName("mcp__tool")).toBeNull();
  });

  it("returns null for empty toolName (mcp_server_)", () => {
    expect(parseMCPToolName("mcp_server_")).toBeNull();
  });

  it("returns null for no underscore after prefix (mcp_nounder)", () => {
    // "mcp_nounder" → rest = "nounder", indexOf("_") = -1 → null
    expect(parseMCPToolName("mcp_nounder")).toBeNull();
  });

  it("returns null for mcp_ alone", () => {
    expect(parseMCPToolName("mcp_")).toBeNull();
  });

  it("handles multi-underscore tool names", () => {
    const result = parseMCPToolName("mcp_git_commit_message_update");
    expect(result).toEqual({ serverId: "git", toolName: "commit_message_update" });
  });
});

// ============================================================================
// buildBridgedName
// ============================================================================

describe("buildBridgedName", () => {
  it("creates namespaced name", () => {
    expect(buildBridgedName("filesystem", "read_file")).toBe("mcp_filesystem_read_file");
  });

  it("sanitizes special characters", () => {
    expect(buildBridgedName("my-server", "read.file")).toBe("mcp_my_server_read_file");
  });
});

// ============================================================================
// bridgeMCPTools
// ============================================================================

describe("bridgeMCPTools", () => {
  it("returns empty array when no tools", () => {
    const rm = mockRuntimeManager([]);
    expect(bridgeMCPTools(rm)).toEqual([]);
  });

  it("bridges tools with correct name and description", () => {
    const tools = [makeTool("fs", "read"), makeTool("fs", "write")];
    const rm = mockRuntimeManager(tools);
    const bridged = bridgeMCPTools(rm);

    expect(bridged).toHaveLength(2);
    expect(bridged[0].name).toBe("mcp_fs_read");
    expect(bridged[0].label).toBe("MCP: fs/read");
    expect(bridged[1].name).toBe("mcp_fs_write");
  });

  it("attaches MCPToolMeta to bridged tools", () => {
    const tools = [makeTool("git", "commit")];
    const rm = mockRuntimeManager(tools);
    const bridged = bridgeMCPTools(rm);

    const meta = getMCPToolMeta(bridged[0]);
    expect(meta).toEqual({ serverId: "git", originalName: "commit" });
  });

  it("tool execute returns error when client not connected", async () => {
    const tools = [makeTool("fs", "read")];
    const rm = mockRuntimeManager(tools); // getClient returns undefined
    const bridged = bridgeMCPTools(rm);

    const result = await bridged[0].execute("call-1", { path: "/tmp" });
    expect(result.content[0]).toHaveProperty("text");
    expect((result.content[0] as { text: string }).text).toContain("not running");
    expect(result.details).toHaveProperty("error", "not_connected");
  });

  it("tool execute calls client.callTool and formats result", async () => {
    const tools = [makeTool("fs", "read")];
    const mockCallTool = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "file contents here" }],
      isError: false,
    });
    const rm = mockRuntimeManager(tools, {
      callTool: mockCallTool,
      connected: true,
    } as unknown as Partial<MCPClient>);

    const bridged = bridgeMCPTools(rm);
    const result = await bridged[0].execute("call-1", { path: "/tmp" });

    expect(mockCallTool).toHaveBeenCalledWith("read", { path: "/tmp" }, undefined);
    expect(result.content).toHaveLength(1);
    expect((result.content[0] as { text: string }).text).toBe("file contents here");
  });

  it("tool execute catches errors and returns error result", async () => {
    const tools = [makeTool("fs", "read")];
    const mockCallTool = vi.fn().mockRejectedValue(new Error("connection lost"));
    const rm = mockRuntimeManager(tools, {
      callTool: mockCallTool,
      connected: true,
    } as unknown as Partial<MCPClient>);

    const bridged = bridgeMCPTools(rm);
    const result = await bridged[0].execute("call-1", {});

    expect(result.content[0]).toHaveProperty("text");
    expect((result.content[0] as { text: string }).text).toContain("connection lost");
    expect(result.details).toHaveProperty("error", "connection lost");
  });

  it("tool execute passes AbortSignal to callTool", async () => {
    const tools = [makeTool("fs", "read")];
    const mockCallTool = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
      isError: false,
    });
    const rm = mockRuntimeManager(tools, {
      callTool: mockCallTool,
      connected: true,
    } as unknown as Partial<MCPClient>);

    const bridged = bridgeMCPTools(rm);
    const ac = new AbortController();
    await bridged[0].execute("call-1", {}, ac.signal);

    expect(mockCallTool).toHaveBeenCalledWith("read", {}, ac.signal);
  });

  it("handles non-array content from MCP server", async () => {
    const tools = [makeTool("fs", "read")];
    const mockCallTool = vi.fn().mockResolvedValue({
      content: "just a string",
      isError: false,
    });
    const rm = mockRuntimeManager(tools, {
      callTool: mockCallTool,
      connected: true,
    } as unknown as Partial<MCPClient>);

    const bridged = bridgeMCPTools(rm);
    const result = await bridged[0].execute("call-1", {});
    expect(result.content[0]).toHaveProperty("text", "just a string");
  });

  it("handles object content (serialized as JSON)", async () => {
    const tools = [makeTool("fs", "read")];
    const mockCallTool = vi.fn().mockResolvedValue({
      content: { foo: "bar" },
      isError: false,
    });
    const rm = mockRuntimeManager(tools, {
      callTool: mockCallTool,
      connected: true,
    } as unknown as Partial<MCPClient>);

    const bridged = bridgeMCPTools(rm);
    const result = await bridged[0].execute("call-1", {});
    const text = (result.content[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual({ foo: "bar" });
  });
});

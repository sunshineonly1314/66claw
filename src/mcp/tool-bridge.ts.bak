/**
 * MCP Tool Bridge — converts MCP tools to Agent tool format.
 *
 * Each MCP tool is wrapped as an AnyAgentTool with:
 *   - Namespaced name: mcp_{serverId}_{toolName}
 *   - Schema derived from MCP inputSchema
 *   - execute() that calls MCPClient.callTool()
 */

import { Type } from "@sinclair/typebox";

import type { AnyAgentTool } from "../agents/tools/common.js";
import type { MCPRuntimeManager } from "./runtime-manager.js";
import type { MCPToolInfo } from "./types.js";
import { MCP_TOOL_PREFIX, MCP_MAX_RESULT_BYTES } from "./types.js";

/** Metadata attached to bridged MCP tools for identification. */
export type MCPToolMeta = {
  serverId: string;
  originalName: string;
};

// WeakMap to store MCP metadata on bridged tools
const mcpToolMetaMap = new WeakMap<AnyAgentTool, MCPToolMeta>();

/** Get MCP metadata from a bridged tool (if it is one). */
export function getMCPToolMeta(tool: AnyAgentTool): MCPToolMeta | undefined {
  return mcpToolMetaMap.get(tool);
}

/** Check if a tool name is an MCP bridged tool. */
export function isMCPToolName(name: string): boolean {
  return name.startsWith(MCP_TOOL_PREFIX);
}

/** Parse an MCP tool name into serverId and original name. */
export function parseMCPToolName(name: string): { serverId: string; toolName: string } | null {
  if (!name.startsWith(MCP_TOOL_PREFIX)) return null;
  const rest = name.slice(MCP_TOOL_PREFIX.length);
  const idx = rest.indexOf("_");
  if (idx <= 0) return null; // idx === 0 means empty serverId
  const serverId = rest.slice(0, idx);
  const toolName = rest.slice(idx + 1);
  if (!toolName) return null; // empty toolName
  return { serverId, toolName };
}

/**
 * Convert an MCP inputSchema to a TypeBox schema.
 * Falls back to a permissive object schema if conversion fails.
 */
function convertInputSchema(inputSchema: Record<string, unknown>): unknown {
  // MCP tools use standard JSON Schema for inputSchema.
  // TypeBox Type.Unsafe() allows us to pass through any valid JSON Schema
  // that the model will understand.
  try {
    if (inputSchema.type === "object" && inputSchema.properties) {
      return Type.Unsafe(inputSchema);
    }
    // If no properties, allow any object
    return Type.Object({});
  } catch {
    return Type.Object({});
  }
}

/**
 * Bridge all currently available MCP tools into AnyAgentTool format.
 *
 * Should be called each time the tool list is needed (e.g. when assembling
 * tools for a new agent session).
 */
export function bridgeMCPTools(runtimeManager: MCPRuntimeManager): AnyAgentTool[] {
  const allTools = runtimeManager.getAllTools();
  const bridged: AnyAgentTool[] = [];

  for (const toolInfo of allTools) {
    const tool = createBridgedTool(toolInfo, runtimeManager);
    if (tool) bridged.push(tool);
  }

  return bridged;
}

function createBridgedTool(
  toolInfo: MCPToolInfo,
  runtimeManager: MCPRuntimeManager,
): AnyAgentTool | null {
  const { serverId, name, bridgedName, description, inputSchema } = toolInfo;
  const schema = convertInputSchema(inputSchema);

  const tool: AnyAgentTool = {
    label: `MCP: ${serverId}/${name}`,
    name: bridgedName,
    description: description || `MCP tool ${name} from ${serverId}`,
    parameters: schema,
    execute: async (_toolCallId: string, args: unknown, signal?: AbortSignal) => {
      const client = runtimeManager.getClient(serverId);
      if (!client || !client.connected) {
        return {
          content: [
            {
              type: "text" as const,
              text: `MCP server "${serverId}" is not running. The tool "${name}" is currently unavailable.`,
            },
          ],
          details: { serverId, tool: name, error: "not_connected" },
        };
      }

      try {
        const result = await client.callTool(
          name,
          (args ?? {}) as Record<string, unknown>,
          signal,
        );

        // Format the result content for the Agent
        const contentItems = formatMCPContent(result.content);
        return {
          content: contentItems,
          details: { serverId, tool: name, isError: result.isError },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `MCP tool error: ${message}` }],
          details: { serverId, tool: name, error: message },
        };
      }
    },
  };

  // Store metadata for later identification
  mcpToolMetaMap.set(tool, { serverId, originalName: name });

  return tool;
}

type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image"; data: string; mimeType: string };
type ToolContent = (TextContent | ImageContent)[];

/** Truncate a string if it exceeds the byte limit. */
function truncateIfNeeded(text: string): string {
  const byteLen = Buffer.byteLength(text, "utf-8");
  if (byteLen <= MCP_MAX_RESULT_BYTES) return text;
  // Binary search for the right cut point
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (Buffer.byteLength(text.slice(0, mid), "utf-8") <= MCP_MAX_RESULT_BYTES - 100) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return `${text.slice(0, lo)}\n\n… [truncated: ${byteLen} bytes, limit ${MCP_MAX_RESULT_BYTES}]`;
}

/**
 * Format MCP content array to Agent-compatible content.
 * Applies size limits to prevent OOM from oversized results.
 */
function formatMCPContent(content: unknown): ToolContent {
  if (!Array.isArray(content)) {
    if (typeof content === "string") {
      return [{ type: "text", text: truncateIfNeeded(content) }];
    }
    try {
      const serialized = JSON.stringify(content, null, 2) ?? "null";
      return [{ type: "text", text: truncateIfNeeded(serialized) }];
    } catch {
      return [{ type: "text", text: "[MCP result: non-serializable content]" }];
    }
  }

  return content.map((item): TextContent | ImageContent => {
    if (!item || typeof item !== "object") {
      return { type: "text", text: truncateIfNeeded(String(item)) };
    }
    const entry = item as Record<string, unknown>;

    if (entry.type === "text" && typeof entry.text === "string") {
      return { type: "text", text: truncateIfNeeded(entry.text) };
    }
    if (entry.type === "image" && typeof entry.data === "string") {
      return {
        type: "image",
        data: entry.data as string,
        mimeType: (entry.mimeType as string) ?? "image/png",
      };
    }
    // Fallback: serialize as JSON text
    try {
      return { type: "text", text: truncateIfNeeded(JSON.stringify(entry, null, 2)) };
    } catch {
      return { type: "text", text: "[MCP result: non-serializable content]" };
    }
  });
}

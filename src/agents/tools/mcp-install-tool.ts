/**
 * [CN-PATCH:tool-discovery] install_mcp_server — LLM 可调用的 MCP 安装工具
 *
 * 当 tool-discovery 推荐了可安装的 MCP server 时，
 * LLM 可以通过此工具触发按需安装和启动。
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const InstallMcpServerSchema = Type.Object(
  {
    serverId: Type.String({
      description: "MCP server ID to install (from tool discovery suggestions).",
    }),
    npmPackage: Type.Optional(
      Type.String({
        description:
          "npm package name for stdio install (e.g. '@modelcontextprotocol/server-postgres').",
      }),
    ),
    sseUrl: Type.Optional(
      Type.String({
        description: "SSE URL for remote MCP server connection.",
      }),
    ),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * 创建 install_mcp_server 工具。
 * LLM 调用此工具安装推荐的 MCP server。
 */
export function createMcpInstallTool(): AnyAgentTool {
  return {
    label: "Install MCP Server",
    name: "install_mcp_server",
    description:
      "Install and start an MCP (Model Context Protocol) server on-demand. " +
      "Use this when a recommended MCP server needs to be installed to fulfill the user's request. " +
      "Provide either npmPackage (for stdio) or sseUrl (for remote SSE).",
    parameters: InstallMcpServerSchema,
    execute: async (_toolCallId, args) => {
      const params = args as { serverId: string; npmPackage?: string; sseUrl?: string };

      try {
        const { loadMCPOnDemand } = await import("../../mcp/on-demand-loader.js");

        const result = await loadMCPOnDemand({
          serverId: params.serverId,
          friendlyName: params.serverId,
          description: "",
          npmPackage: params.npmPackage,
          sseUrl: params.sseUrl,
          score: 1,
        });

        if (result.success) {
          return {
            content: [
              {
                type: "text" as const,
                text: `MCP server "${params.serverId}" installed successfully. ${result.toolCount ?? 0} tools now available. You can now use tools prefixed with "mcp_${params.serverId}_".`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to install MCP server "${params.serverId}": ${result.error}`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error installing MCP server: ${message}`,
            },
          ],
        };
      }
    },
  };
}

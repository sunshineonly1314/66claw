import type { OpenClawCNConfig } from "../config/config.js";
import type { GatewayMessageChannel } from "../utils/message-channel.js";
import type { SandboxFsBridge } from "./sandbox/fs-bridge.js";
import type { AnyAgentTool } from "./tools/common.js";
import { resolvePluginTools } from "../plugins/tools.js";
import { resolveSessionAgentId } from "./agent-scope.js";
import { createAgentsListTool } from "./tools/agents-list-tool.js";
import { createBrowserTool } from "./tools/browser-tool.js";
import { createCanvasTool } from "./tools/canvas-tool.js";
import { createCronTool } from "./tools/cron-tool.js";
import { createGatewayTool } from "./tools/gateway-tool.js";
import { createImageTool } from "./tools/image-tool.js";
import { createMessageTool } from "./tools/message-tool.js";
import { createNodesTool } from "./tools/nodes-tool.js";
import { createSessionStatusTool } from "./tools/session-status-tool.js";
import { createSessionsHistoryTool } from "./tools/sessions-history-tool.js";
import { createSessionsListTool } from "./tools/sessions-list-tool.js";
import { createSessionsSendTool } from "./tools/sessions-send-tool.js";
import { createSessionsHandoffTool } from "./tools/sessions-handoff-tool.js";
import { createSessionsSpawnTool } from "./tools/sessions-spawn-tool.js";
import { createTtsTool } from "./tools/tts-tool.js";
import { createWebFetchTool, createWebSearchTool } from "./tools/web-tools.js";
import { resolveWorkspaceRoot } from "./workspace-dir.js";
// ── [CN-PATCH] CN-only tool imports ──
import { createOpenAppTool } from "./tools/open-app.js";
import { createDesktopControlTool } from "./tools/desktop-control.js";
import { createWeChatSendTool } from "./tools/wechat-send.js";
import { createWeChatReadTool } from "./tools/wechat-read.js";
import { createWeChatCheckTool } from "./tools/wechat-check.js";
import { createWeComSendTool } from "./tools/wecom-send.js";
import { createWeComReadTool } from "./tools/wecom-read.js";
import { createWeComCheckTool } from "./tools/wecom-check.js";
import { createWeComAutoReplyTool } from "./tools/wecom-auto-reply.js";
import { createWeComPatrolTool } from "./tools/wecom-patrol.js";
import { createWeComGroupSummaryTool } from "./tools/wecom-group-summary.js";
import { createWeComBroadcastTool } from "./tools/wecom-broadcast.js";
import { createWeComTicketTool } from "./tools/wecom-ticket.js";
import { createWeComHandoffTool } from "./tools/wecom-handoff.js";
import { createImageGenTool } from "./tools/image-gen-tool.js";
import { createMcpInstallTool } from "./tools/mcp-install-tool.js";
import { getMCPManagerSafe } from "../mcp/index.js";
import { applyToolHints } from "../dispatch/tool-hints.js";

export function createOpenClawCNTools(options?: {
  sandboxBrowserBridgeUrl?: string;
  allowHostBrowserControl?: boolean;
  agentSessionKey?: string;
  agentChannel?: GatewayMessageChannel;
  agentAccountId?: string;
  /** Delivery target (e.g. telegram:group:123:topic:456) for topic/thread routing. */
  agentTo?: string;
  /** Thread/topic identifier for routing replies to the originating thread. */
  agentThreadId?: string | number;
  /** Group id for channel-level tool policy inheritance. */
  agentGroupId?: string | null;
  /** Group channel label for channel-level tool policy inheritance. */
  agentGroupChannel?: string | null;
  /** Group space label for channel-level tool policy inheritance. */
  agentGroupSpace?: string | null;
  agentDir?: string;
  sandboxRoot?: string;
  sandboxFsBridge?: SandboxFsBridge;
  workspaceDir?: string;
  sandboxed?: boolean;
  config?: OpenClawCNConfig;
  pluginToolAllowlist?: string[];
  /** Current channel ID for auto-threading (Slack). */
  currentChannelId?: string;
  /** Current thread timestamp for auto-threading (Slack). */
  currentThreadTs?: string;
  /** Reply-to mode for Slack auto-threading. */
  replyToMode?: "off" | "first" | "all";
  /** Mutable ref to track if a reply was sent (for "first" mode). */
  hasRepliedRef?: { value: boolean };
  /** If true, the model has native vision capability */
  modelHasVision?: boolean;
  /** Explicit agent ID override for cron/hook sessions. */
  requesterAgentIdOverride?: string;
  /** Require explicit message targets (no implicit last-route sends). */
  requireExplicitMessageTarget?: boolean;
  /** If true, omit the message tool from the tool list. */
  disableMessageTool?: boolean;
  // ── [CN-PATCH] Tool hints from dispatch engine (auto-discovery) ──
  /** Tool hints from dispatch engine for tool reordering. */
  toolHints?: string[];
}): AnyAgentTool[] {
  const workspaceDir = resolveWorkspaceRoot(options?.workspaceDir);
  const imageTool = options?.agentDir?.trim()
    ? createImageTool({
        config: options?.config,
        agentDir: options.agentDir,
        workspaceDir,
        sandbox:
          options?.sandboxRoot && options?.sandboxFsBridge
            ? { root: options.sandboxRoot, bridge: options.sandboxFsBridge }
            : undefined,
        modelHasVision: options?.modelHasVision,
      })
    : null;
  const webSearchTool = createWebSearchTool({
    config: options?.config,
    sandboxed: options?.sandboxed,
  });
  const webFetchTool = createWebFetchTool({
    config: options?.config,
    sandboxed: options?.sandboxed,
  });
  // ── [CN-PATCH] CN-only tools ──
  const openAppTool = createOpenAppTool();
  const desktopControlTool = createDesktopControlTool();
  const wechatSendTool = createWeChatSendTool();
  const wechatReadTool = createWeChatReadTool();
  const wechatCheckTool = createWeChatCheckTool();
  const wecomSendTool = createWeComSendTool();
  const wecomReadTool = createWeComReadTool({
    config: options?.config,
    agentDir: options?.agentDir,
  });
  const wecomCheckTool = createWeComCheckTool();
  const wecomAutoReplyTool = createWeComAutoReplyTool();
  const wecomPatrolTool = createWeComPatrolTool();
  const wecomGroupSummaryTool = createWeComGroupSummaryTool();
  const wecomBroadcastTool = createWeComBroadcastTool();
  const wecomTicketTool = createWeComTicketTool();
  const wecomHandoffTool = createWeComHandoffTool();
  const imageGenTool = createImageGenTool({
    config: options?.config,
    agentDir: options?.agentDir,
  });
  const messageTool = options?.disableMessageTool
    ? null
    : createMessageTool({
        agentAccountId: options?.agentAccountId,
        agentSessionKey: options?.agentSessionKey,
        config: options?.config,
        currentChannelId: options?.currentChannelId,
        currentChannelProvider: options?.agentChannel,
        currentThreadTs: options?.currentThreadTs,
        replyToMode: options?.replyToMode,
        hasRepliedRef: options?.hasRepliedRef,
        sandboxRoot: options?.sandboxRoot,
        requireExplicitTarget: options?.requireExplicitMessageTarget,
      });
  const tools: AnyAgentTool[] = [
    createBrowserTool({
      sandboxBridgeUrl: options?.sandboxBrowserBridgeUrl,
      allowHostControl: options?.allowHostBrowserControl,
    }),
    createCanvasTool(),
    createNodesTool({
      agentSessionKey: options?.agentSessionKey,
      config: options?.config,
    }),
    createCronTool({
      agentSessionKey: options?.agentSessionKey,
    }),
    ...(messageTool ? [messageTool] : []),
    createTtsTool({
      agentChannel: options?.agentChannel,
      config: options?.config,
    }),
    createGatewayTool({
      agentSessionKey: options?.agentSessionKey,
      config: options?.config,
    }),
    createAgentsListTool({
      agentSessionKey: options?.agentSessionKey,
      requesterAgentIdOverride: options?.requesterAgentIdOverride,
    }),
    createSessionsListTool({
      agentSessionKey: options?.agentSessionKey,
      sandboxed: options?.sandboxed,
    }),
    createSessionsHistoryTool({
      agentSessionKey: options?.agentSessionKey,
      sandboxed: options?.sandboxed,
    }),
    createSessionsSendTool({
      agentSessionKey: options?.agentSessionKey,
      agentChannel: options?.agentChannel,
      sandboxed: options?.sandboxed,
    }),
    createSessionsSpawnTool({
      agentSessionKey: options?.agentSessionKey,
      agentChannel: options?.agentChannel,
      agentAccountId: options?.agentAccountId,
      agentTo: options?.agentTo,
      agentThreadId: options?.agentThreadId,
      agentGroupId: options?.agentGroupId,
      agentGroupChannel: options?.agentGroupChannel,
      agentGroupSpace: options?.agentGroupSpace,
      sandboxed: options?.sandboxed,
      requesterAgentIdOverride: options?.requesterAgentIdOverride,
    }),
    createSessionsHandoffTool({
      agentSessionKey: options?.agentSessionKey,
      agentChannel: options?.agentChannel,
      agentAccountId: options?.agentAccountId,
      agentTo: options?.agentTo,
      agentThreadId: options?.agentThreadId,
      agentGroupId: options?.agentGroupId,
      agentGroupChannel: options?.agentGroupChannel,
      agentGroupSpace: options?.agentGroupSpace,
      sandboxed: options?.sandboxed,
      requesterAgentIdOverride: options?.requesterAgentIdOverride,
    }),
    createSessionStatusTool({
      agentSessionKey: options?.agentSessionKey,
      config: options?.config,
    }),
    ...(webSearchTool ? [webSearchTool] : []),
    ...(webFetchTool ? [webFetchTool] : []),
    ...(imageTool ? [imageTool] : []),
    // ── [CN-PATCH] CN-only tools ──
    ...(openAppTool ? [openAppTool] : []),
    ...(desktopControlTool ? [desktopControlTool] : []),
    ...(wechatSendTool ? [wechatSendTool] : []),
    ...(wechatReadTool ? [wechatReadTool] : []),
    ...(wechatCheckTool ? [wechatCheckTool] : []),
    ...(wecomSendTool ? [wecomSendTool] : []),
    wecomReadTool,
    ...(wecomCheckTool ? [wecomCheckTool] : []),
    ...(wecomAutoReplyTool ? [wecomAutoReplyTool] : []),
    ...(wecomPatrolTool ? [wecomPatrolTool] : []),
    ...(wecomGroupSummaryTool ? [wecomGroupSummaryTool] : []),
    ...(wecomBroadcastTool ? [wecomBroadcastTool] : []),
    wecomTicketTool,
    wecomHandoffTool,
    imageGenTool,
    ...(options?.config?.toolDiscovery?.mcpOnDemand?.enabled !== false
      ? [createMcpInstallTool()]
      : []),
  ];

  const pluginTools = resolvePluginTools({
    context: {
      config: options?.config,
      workspaceDir,
      agentDir: options?.agentDir,
      agentId: resolveSessionAgentId({
        sessionKey: options?.agentSessionKey,
        config: options?.config,
      }),
      sessionKey: options?.agentSessionKey,
      messageChannel: options?.agentChannel,
      agentAccountId: options?.agentAccountId,
      sandboxed: options?.sandboxed,
    },
    existingToolNames: new Set(tools.map((tool) => tool.name)),
    toolAllowlist: options?.pluginToolAllowlist,
  });

  // ── [CN-PATCH] MCP tools: bridge all available MCP server tools into the Agent tool chain.
  // Deduplicate: MCP tools must not shadow builtin or plugin tools.
  const mcpToolsRaw = getMCPManagerSafe()?.getAvailableTools() ?? [];
  const existingNames = new Set([...tools, ...pluginTools].map((t) => t.name));
  const mcpTools = mcpToolsRaw.filter((t) => {
    if (existingNames.has(t.name)) {
      console.warn(`[mcp] Skipping MCP tool "${t.name}" — conflicts with existing tool`);
      return false;
    }
    return true;
  });

  // ── [CN-PATCH] Apply tool hints (reorder tools based on dispatch auto-discovery)
  const sortedTools = options?.toolHints ? applyToolHints(tools, options.toolHints) : tools;

  return [...sortedTools, ...pluginTools, ...mcpTools];
}

/** @deprecated Use createOpenClawCNTools instead */
export const createOpenClawTools = createOpenClawCNTools;

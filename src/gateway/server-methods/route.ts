/**
 * route.setChannelAgent — Set or clear a direct agent binding for a channel/account.
 *
 * This manages entries in config.bindings[] to route a specific channel
 * (optionally per account) directly to an agent, bypassing team routing.
 *
 * Bindings created by this method are tagged with `_source: "channelRoute"`
 * so they can be identified and managed separately from manually-created bindings.
 */

import type { GatewayRequestHandlers } from "./types.js";
import type { AgentBinding } from "../../config/types.agents.js";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";

/** Tag used to identify bindings created via the channel route UI. */
const CHANNEL_ROUTE_SOURCE = "channelRoute";

type SetChannelAgentParams = {
  channel: string;
  accountId?: string;
  agentId: string | null;
};

function isValidParams(params: unknown): params is SetChannelAgentParams {
  if (!params || typeof params !== "object") return false;
  const p = params as Record<string, unknown>;
  if (typeof p.channel !== "string" || !p.channel.trim()) return false;
  if (p.accountId !== undefined && typeof p.accountId !== "string") return false;
  if (p.agentId !== null && typeof p.agentId !== "string") return false;
  return true;
}

/** Check if a binding was created by the channel route UI. */
function isChannelRouteBinding(b: AgentBinding & { _source?: string }): boolean {
  return b._source === CHANNEL_ROUTE_SOURCE;
}

/** Check if a binding matches the given channel/account. */
function matchesChannelAccount(b: AgentBinding, channel: string, accountId?: string): boolean {
  const matchChannel = (b.match?.channel ?? "").toLowerCase().trim();
  if (matchChannel !== channel.toLowerCase().trim()) return false;
  const matchAccountId = (b.match?.accountId ?? "").trim();
  if (accountId) {
    return matchAccountId === accountId;
  }
  // No accountId specified: match bindings without accountId or with wildcard
  return !matchAccountId || matchAccountId === "*";
}

export const routeHandlers: GatewayRequestHandlers = {
  "route.getChannelAgents": ({ respond }) => {
    try {
      const cfg = loadConfig();
      const bindings: Array<AgentBinding & { _source?: string }> = Array.isArray(cfg.bindings)
        ? cfg.bindings
        : [];

      // Get agent names for display
      const agentsList = cfg.agents?.list ?? [];
      const agentNames = new Map<string, string>();
      for (const agent of agentsList) {
        if (agent?.id) {
          agentNames.set(agent.id, agent.name || agent.id);
        }
      }

      const routes = bindings.filter(isChannelRouteBinding).map((b) => ({
        channel: b.match.channel,
        ...(b.match.accountId && b.match.accountId !== "*" ? { accountId: b.match.accountId } : {}),
        targetType: "agent" as const,
        targetId: b.agentId,
        targetName: agentNames.get(b.agentId) || b.agentId,
      }));

      respond(true, { routes }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
    }
  },

  "route.setChannelAgent": async ({ params, respond }) => {
    if (!isValidParams(params)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "invalid route.setChannelAgent params"),
      );
      return;
    }

    const { channel, accountId, agentId } = params;

    try {
      const cfg = loadConfig();
      const existingBindings: Array<AgentBinding & { _source?: string }> = Array.isArray(
        cfg.bindings,
      )
        ? [...cfg.bindings]
        : [];

      // Remove any existing channel-route binding for this channel/account
      const filtered = existingBindings.filter(
        (b) => !(isChannelRouteBinding(b) && matchesChannelAccount(b, channel, accountId)),
      );

      // Add new binding if agentId is specified
      if (agentId) {
        const newBinding: AgentBinding & { _source: string } = {
          agentId,
          match: {
            channel,
            ...(accountId ? { accountId } : {}),
          },
          _source: CHANNEL_ROUTE_SOURCE,
        };
        filtered.push(newBinding);
      }

      const nextConfig = { ...cfg, bindings: filtered };
      await writeConfigFile(nextConfig);

      respond(true, { ok: true }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
    }
  },
};

/**
 * Get all channel-route agent bindings from config.
 * Used by team.route.summary to include direct agent bindings in the route list.
 */
export function getChannelRouteAgentBindings(
  cfg: { bindings?: Array<AgentBinding & { _source?: string }> },
  agentNameLookup: (agentId: string) => string,
): Array<{
  channel: string;
  accountId?: string;
  targetType: "agent";
  targetId: string;
  targetName: string;
}> {
  const bindings: Array<AgentBinding & { _source?: string }> = Array.isArray(cfg.bindings)
    ? cfg.bindings
    : [];

  return bindings.filter(isChannelRouteBinding).map((b) => ({
    channel: b.match.channel,
    ...(b.match.accountId && b.match.accountId !== "*" ? { accountId: b.match.accountId } : {}),
    targetType: "agent" as const,
    targetId: b.agentId,
    targetName: agentNameLookup(b.agentId),
  }));
}

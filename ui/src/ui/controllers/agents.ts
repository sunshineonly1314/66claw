import type { GatewayBrowserClient } from "../gateway";
import type { AgentsListResult } from "../types";

export type AgentsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  agentsLoading: boolean;
  agentsError: string | null;
  agentsList: AgentsListResult | null;
  agentCreating: boolean;
  agentCreateError: string | null;
  agentDeleting: boolean;
  agentDeleteError: string | null;
  agentsSelectedId: string | null;
};

export async function loadAgents(state: AgentsState) {
  if (!state.client || !state.connected) return;
  if (state.agentsLoading) return;
  state.agentsLoading = true;
  state.agentsError = null;
  try {
    const res = (await state.client.request("agents.list", {})) as AgentsListResult | undefined;
    if (res) state.agentsList = res;
  } catch (err) {
    state.agentsError = String(err);
  } finally {
    state.agentsLoading = false;
  }
}

export async function createAgent(
  state: AgentsState,
  params: { id: string; name: string; workspace: string },
): Promise<{ ok: boolean; agentId?: string }> {
  if (!state.client || !state.connected) return { ok: false };
  state.agentCreating = true;
  state.agentCreateError = null;
  try {
    // Step 1: Create agent using ASCII id as the "name" param.
    // The gateway normalizeAgentId(name) will use it as the agent ID.
    // We do NOT send an "id" field because older gateway builds reject unknown properties.
    const createParams: { name: string; workspace: string } = {
      name: params.id,
      workspace: params.workspace,
    };
    const res = (await state.client.request("agents.create", createParams)) as
      | { ok: true; agentId: string }
      | undefined;

    // Step 2: If the user specified a display name different from the ID,
    // update the agent name via agents.update (which supports the "name" field).
    const agentId = res?.agentId ?? params.id;
    if (params.name && params.name !== params.id) {
      try {
        await state.client.request("agents.update", {
          agentId,
          name: params.name,
        });
      } catch {
        // Non-fatal: agent was created, just the display name wasn't set.
      }
    }

    await loadAgents(state);
    state.agentsSelectedId = agentId;
    return { ok: true, agentId };
  } catch (err) {
    state.agentCreateError = String(err);
    return { ok: false };
  } finally {
    state.agentCreating = false;
  }
}

export async function deleteAgent(
  state: AgentsState,
  params: { agentId: string; deleteFiles?: boolean },
): Promise<boolean> {
  if (!state.client || !state.connected) return false;
  state.agentDeleting = true;
  state.agentDeleteError = null;
  try {
    await state.client.request("agents.delete", params);
    if (state.agentsSelectedId === params.agentId) state.agentsSelectedId = null;
    await loadAgents(state);
    return true;
  } catch (err) {
    state.agentDeleteError = String(err);
    return false;
  } finally {
    state.agentDeleting = false;
  }
}

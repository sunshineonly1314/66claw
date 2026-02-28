import type { GatewayBrowserClient } from "../gateway";
import type { AgentsListResult } from "../types";
import type { AppViewState } from "../app-view-state";

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
  dmScopeStatus?: AppViewState["dmScopeStatus"];
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
    // Create agent with explicit id and display name in a single call.
    const res = (await state.client.request("agents.create", {
      id: params.id,
      name: params.name || params.id,
      workspace: params.workspace,
    })) as
      | { ok: true; agentId: string }
      | undefined;

    const agentId = res?.agentId ?? params.id;

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

export async function loadDmScopeStatus(state: AgentsState) {
  if (!state.client || !state.connected) return;
  try {
    const res = (await state.client.request("sessions.dmScopeStatus", {})) as
      | AppViewState["dmScopeStatus"]
      | undefined;
    if (res) state.dmScopeStatus = res;
  } catch {
    // Non-fatal: dmScope status is optional
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

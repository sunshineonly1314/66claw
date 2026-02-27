import type { ChannelsStatusSnapshot, TeamProjectSummary } from "../types";
import type { ChannelsState } from "./channels.types";
import type { ChannelRouteEntry, ChannelRouteProjectOption } from "../views/channels.types";

export type { ChannelsState };

export async function loadChannels(state: ChannelsState, probe: boolean) {
  if (!state.client || !state.connected) return;
  if (state.channelsLoading) return;
  state.channelsLoading = true;
  state.channelsError = null;
  try {
    const res = (await state.client.request("channels.status", {
      probe,
      timeoutMs: 8000,
    })) as ChannelsStatusSnapshot;
    state.channelsSnapshot = res;
    state.channelsLastSuccess = Date.now();
  } catch (err) {
    state.channelsError = String(err);
  } finally {
    state.channelsLoading = false;
  }
}

export async function startWhatsAppLogin(state: ChannelsState, force: boolean) {
  if (!state.client || !state.connected || state.whatsappBusy) return;
  state.whatsappBusy = true;
  try {
    const res = (await state.client.request("web.login.start", {
      force,
      timeoutMs: 30000,
    })) as { message?: string; qrDataUrl?: string };
    state.whatsappLoginMessage = res.message ?? null;
    state.whatsappLoginQrDataUrl = res.qrDataUrl ?? null;
    state.whatsappLoginConnected = null;
  } catch (err) {
    state.whatsappLoginMessage = String(err);
    state.whatsappLoginQrDataUrl = null;
    state.whatsappLoginConnected = null;
  } finally {
    state.whatsappBusy = false;
  }
}

export async function waitWhatsAppLogin(state: ChannelsState) {
  if (!state.client || !state.connected || state.whatsappBusy) return;
  state.whatsappBusy = true;
  try {
    const res = (await state.client.request("web.login.wait", {
      timeoutMs: 120000,
    })) as { connected?: boolean; message?: string };
    state.whatsappLoginMessage = res.message ?? null;
    state.whatsappLoginConnected = res.connected ?? null;
    if (res.connected) state.whatsappLoginQrDataUrl = null;
  } catch (err) {
    state.whatsappLoginMessage = String(err);
    state.whatsappLoginConnected = null;
  } finally {
    state.whatsappBusy = false;
  }
}

export async function logoutWhatsApp(state: ChannelsState) {
  if (!state.client || !state.connected || state.whatsappBusy) return;
  state.whatsappBusy = true;
  try {
    await state.client.request("channels.logout", { channel: "whatsapp" });
    state.whatsappLoginMessage = "Logged out.";
    state.whatsappLoginQrDataUrl = null;
    state.whatsappLoginConnected = null;
  } catch (err) {
    state.whatsappLoginMessage = String(err);
  } finally {
    state.whatsappBusy = false;
  }
}

// ── Channel Route Binding ─────────────────────────────────────────────

export async function loadChannelRoutes(state: ChannelsState) {
  if (!state.client || !state.connected) return;
  try {
    const [routeRes, projectRes] = await Promise.all([
      state.client.request("team.route.summary", {}) as Promise<{
        routes: ChannelRouteEntry[];
      } | undefined>,
      state.client.request("team.project.list", {}) as Promise<{
        projects: TeamProjectSummary[];
      } | undefined>,
    ]);
    state.channelRouteSummary = routeRes?.routes ?? [];
    state.channelRouteProjects =
      projectRes?.projects?.map((p): ChannelRouteProjectOption => ({
        projectId: p.projectId,
        name: p.name,
        supervisorId: p.supervisorId,
        bindings: p.bindings,
        description: p.description,
        status: p.status,
        memberCount: p.memberCount,
        memberIds: p.memberIds,
      })) ?? [];
  } catch {
    // Route data is non-critical; silently ignore failures
  }
}

export async function updateChannelRoute(
  state: ChannelsState,
  channel: string,
  accountId: string | undefined,
  projectId: string | null,
) {
  if (!state.client || !state.connected || state.channelRouteSaving) return;
  state.channelRouteSaving = true;
  try {
    const projects = state.channelRouteProjects ?? [];

    // Remove this channel binding from ALL projects first
    for (const proj of projects) {
      const bindings = proj.bindings ?? [];
      const hasBinding = bindings.some(
        (b) =>
          b.channel === channel &&
          (accountId ? b.accountId === accountId : !b.accountId),
      );
      if (hasBinding) {
        const newBindings = bindings.filter(
          (b) =>
            !(
              b.channel === channel &&
              (accountId ? b.accountId === accountId : !b.accountId)
            ),
        );
        await state.client.request("team.project.update", {
          projectId: proj.projectId,
          bindings: newBindings,
        });
      }
    }

    // Add binding to the target project (if not "none")
    if (projectId) {
      const targetProject = projects.find((p) => p.projectId === projectId);
      if (targetProject) {
        // Filter out any stale binding for this channel from the local snapshot
        // (the removal loop above already sent the update to the server, but
        // `projects` is a pre-loop snapshot so targetProject.bindings may be stale).
        const cleanedBindings = (targetProject.bindings ?? []).filter(
          (b) =>
            !(
              b.channel === channel &&
              (accountId ? b.accountId === accountId : !b.accountId)
            ),
        );
        const newBinding = {
          channel,
          ...(accountId ? { accountId } : {}),
        };
        await state.client.request("team.project.update", {
          projectId,
          bindings: [...cleanedBindings, newBinding],
        });
      }
    }

    // Reload route data
    await loadChannelRoutes(state);
  } catch {
    // Best effort
  } finally {
    state.channelRouteSaving = false;
  }
}

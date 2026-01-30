import type { GatewayBrowserClient } from "../gateway";
import type { RemoteSkillsIndex, SkillStatusReport, SkillsMarketResponse } from "../types";

export type SkillsTab = "local" | "remote";

export type SkillsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  skillsLoading: boolean;
  skillsReport: SkillStatusReport | null;
  skillsError: string | null;
  skillsBusyKey: string | null;
  skillEdits: Record<string, string>;
  skillMessages: SkillMessageMap;
  // Remote skills (legacy, kept for compatibility)
  activeTab: SkillsTab;
  remoteLoading: boolean;
  remoteIndex: RemoteSkillsIndex | null;
  remoteError: string | null;
  // Skills Market (new local-index based)
  marketLoading: boolean;
  marketResponse: SkillsMarketResponse | null;
  marketSyncing: boolean;
  marketLastSyncedAt: string | null;
  marketError: string | null;
};

export type SkillMessage = {
  kind: "success" | "error";
  message: string;
};

export type SkillMessageMap = Record<string, SkillMessage>;

type LoadSkillsOptions = {
  clearMessages?: boolean;
};

function setSkillMessage(state: SkillsState, key: string, message?: SkillMessage) {
  if (!key.trim()) return;
  const next = { ...state.skillMessages };
  if (message) next[key] = message;
  else delete next[key];
  state.skillMessages = next;
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function loadSkills(state: SkillsState, options?: LoadSkillsOptions) {
  if (options?.clearMessages && Object.keys(state.skillMessages).length > 0) {
    state.skillMessages = {};
  }
  if (!state.client || !state.connected) return;
  if (state.skillsLoading) return;
  state.skillsLoading = true;
  state.skillsError = null;
  try {
    const res = (await state.client.request("skills.status", {})) as
      | SkillStatusReport
      | undefined;
    if (res) state.skillsReport = res;
  } catch (err) {
    state.skillsError = getErrorMessage(err);
  } finally {
    state.skillsLoading = false;
  }
}

export function updateSkillEdit(
  state: SkillsState,
  skillKey: string,
  value: string,
) {
  state.skillEdits = { ...state.skillEdits, [skillKey]: value };
}

export async function updateSkillEnabled(
  state: SkillsState,
  skillKey: string,
  enabled: boolean,
) {
  if (!state.client || !state.connected) return;
  state.skillsBusyKey = skillKey;
  state.skillsError = null;
  try {
    await state.client.request("skills.update", { skillKey, enabled });
    await loadSkills(state);
    setSkillMessage(state, skillKey, {
      kind: "success",
      message: enabled ? "Skill enabled" : "Skill disabled",
    });
  } catch (err) {
    const message = getErrorMessage(err);
    state.skillsError = message;
    setSkillMessage(state, skillKey, {
      kind: "error",
      message,
    });
  } finally {
    state.skillsBusyKey = null;
  }
}

export async function saveSkillApiKey(state: SkillsState, skillKey: string) {
  if (!state.client || !state.connected) return;
  state.skillsBusyKey = skillKey;
  state.skillsError = null;
  try {
    const apiKey = state.skillEdits[skillKey] ?? "";
    await state.client.request("skills.update", { skillKey, apiKey });
    await loadSkills(state);
    setSkillMessage(state, skillKey, {
      kind: "success",
      message: "API key saved",
    });
  } catch (err) {
    const message = getErrorMessage(err);
    state.skillsError = message;
    setSkillMessage(state, skillKey, {
      kind: "error",
      message,
    });
  } finally {
    state.skillsBusyKey = null;
  }
}

export async function installSkill(
  state: SkillsState,
  skillKey: string,
  name: string,
  installId: string,
) {
  if (!state.client || !state.connected) return;
  state.skillsBusyKey = skillKey;
  state.skillsError = null;
  try {
    const result = (await state.client.request("skills.install", {
      name,
      installId,
      timeoutMs: 120000,
    })) as { ok?: boolean; message?: string };
    await loadSkills(state);
    setSkillMessage(state, skillKey, {
      kind: "success",
      message: result?.message ?? "Installed",
    });
  } catch (err) {
    const message = getErrorMessage(err);
    state.skillsError = message;
    setSkillMessage(state, skillKey, {
      kind: "error",
      message,
    });
  } finally {
    state.skillsBusyKey = null;
  }
}

export function setActiveTab(state: SkillsState, tab: SkillsTab) {
  state.activeTab = tab;
}

export async function loadRemoteSkills(state: SkillsState) {
  if (!state.client || !state.connected) return;
  if (state.remoteLoading) return;
  state.remoteLoading = true;
  state.remoteError = null;
  try {
    const res = (await state.client.request("skills.remote.list", {})) as
      | RemoteSkillsIndex
      | undefined;
    if (res) state.remoteIndex = res;
  } catch (err) {
    state.remoteError = getErrorMessage(err);
  } finally {
    state.remoteLoading = false;
  }
}

export async function installRemoteSkill(
  state: SkillsState,
  skillName: string,
) {
  if (!state.client || !state.connected) return;
  state.skillsBusyKey = skillName;
  state.remoteError = null;
  state.marketError = null;
  try {
    const result = (await state.client.request("skills.install", {
      name: skillName,
      installId: "gitee",
      timeoutMs: 120000,
    })) as { ok?: boolean; message?: string };
    // Refresh both lists (local skills + market)
    await Promise.all([loadSkills(state), loadMarketSkills(state)]);
    setSkillMessage(state, skillName, {
      kind: "success",
      message: result?.message ?? "已安装",
    });
  } catch (err) {
    const message = getErrorMessage(err);
    state.remoteError = message;
    state.marketError = message;
    setSkillMessage(state, skillName, {
      kind: "error",
      message,
    });
  } finally {
    state.skillsBusyKey = null;
  }
}

// ============================================================================
// Skills Market (Local Index Based) - 技能市场（基于本地索引）
// ============================================================================

/**
 * 加载技能市场列表（读取本地缓存索引，快速无网络延迟）
 */
export async function loadMarketSkills(state: SkillsState) {
  if (!state.client || !state.connected) return;
  if (state.marketLoading) return;
  state.marketLoading = true;
  state.marketError = null;
  try {
    const res = (await state.client.request("skills.market.list", {})) as
      | SkillsMarketResponse
      | undefined;
    if (res) {
      state.marketResponse = res;
      state.marketSyncing = res.syncing;
      state.marketLastSyncedAt = res.lastSyncedAt;
      // 同时更新旧的 remoteIndex 以保持兼容
      if (res.skills.length > 0) {
        state.remoteIndex = {
          version: 1,
          updated: res.lastSyncedAt ?? new Date().toISOString(),
          skills: res.skills,
        };
      }
    }
  } catch (err) {
    state.marketError = getErrorMessage(err);
  } finally {
    state.marketLoading = false;
  }
}

/**
 * 强制刷新技能市场（用户手动触发，从远程拉取最新索引）
 */
export async function refreshMarketSkills(state: SkillsState) {
  if (!state.client || !state.connected) return;
  state.marketLoading = true;
  state.marketSyncing = true;
  state.marketError = null;
  try {
    const res = (await state.client.request("skills.market.refresh", {})) as
      | SkillsMarketResponse
      | undefined;
    if (res) {
      state.marketResponse = res;
      state.marketSyncing = res.syncing;
      state.marketLastSyncedAt = res.lastSyncedAt;
      // 同时更新旧的 remoteIndex 以保持兼容
      if (res.skills.length > 0) {
        state.remoteIndex = {
          version: 1,
          updated: res.lastSyncedAt ?? new Date().toISOString(),
          skills: res.skills,
        };
      }
      if (res.message) {
        // 如果有消息（可能是错误），显示出来
        state.marketError = res.message;
      }
    }
  } catch (err) {
    state.marketError = getErrorMessage(err);
  } finally {
    state.marketLoading = false;
    state.marketSyncing = false;
  }
}

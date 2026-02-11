import type { GatewayBrowserClient } from "../gateway";
import type { RemoteSkillsIndex, SkillStatusReport, SkillsMarketResponse } from "../types";

export type SkillsTab = "active" | "library" | "blocked";

/** 安装进度阶段 */
export type InstallProgressStage = "downloading" | "installing" | "verifying" | "done";

/** 安装进度信息 */
export type InstallProgress = {
  stage: InstallProgressStage;
  message: string;
  percent?: number;
};

export type SkillsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  skillsLoading: boolean;
  skillsReport: SkillStatusReport | null;
  skillsError: string | null;
  skillsBusyKey: string | null;
  skillEdits: Record<string, string>;
  skillMessages: SkillMessageMap;
  // 安装进度追踪
  skillsInstallProgress: Record<string, InstallProgress>;
  // Remote skills - UI 状态统一使用 skillsXxx 前缀
  skillsActiveTab: SkillsTab;
  skillsRemoteLoading: boolean;
  skillsRemoteIndex: RemoteSkillsIndex | null;
  skillsRemoteError: string | null;
  // Skills Market (new local-index based)
  skillsMarketLoading: boolean;
  skillsMarketResponse: SkillsMarketResponse | null;
  skillsMarketSyncing: boolean;
  skillsMarketLastSyncedAt: string | null;
  skillsMarketError: string | null;
  // Category filter
  skillsActiveCategory: string;
  // Filter
  skillsFilter: string;
  // Pagination — 每次显示多少条，点「加载更多」递增
  skillsVisibleCount: number;
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
      message: enabled ? "技能已启用" : "技能已禁用",
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
      message: "API 密钥已保存",
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
      message: result?.message ?? "已安装",
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

export async function toggleSkillPinned(
  state: SkillsState,
  skillKey: string,
  pinned: boolean,
) {
  if (!state.client || !state.connected) return;
  state.skillsBusyKey = skillKey;
  state.skillsError = null;
  try {
    await state.client.request("skills.update", { skillKey, pinned });
    await loadSkills(state);
    setSkillMessage(state, skillKey, {
      kind: "success",
      message: pinned ? "已置顶" : "已取消置顶",
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

/** 每页显示数量 */
export const SKILLS_PAGE_SIZE = 50;

export function setActiveTab(state: SkillsState, tab: SkillsTab) {
  state.skillsActiveTab = tab;
  state.skillsVisibleCount = SKILLS_PAGE_SIZE; // 切 Tab 重置分页
}

export function setActiveCategory(state: SkillsState, category: string) {
  state.skillsActiveCategory = category;
  state.skillsVisibleCount = SKILLS_PAGE_SIZE; // 切分类重置分页
}

export function loadMoreSkills(state: SkillsState) {
  state.skillsVisibleCount = (state.skillsVisibleCount || SKILLS_PAGE_SIZE) + SKILLS_PAGE_SIZE;
}

export async function loadRemoteSkills(state: SkillsState) {
  if (!state.client || !state.connected) return;
  if (state.skillsRemoteLoading) return;
  state.skillsRemoteLoading = true;
  state.skillsRemoteError = null;
  try {
    const res = (await state.client.request("skills.remote.list", {})) as
      | RemoteSkillsIndex
      | undefined;
    if (res) {
      state.skillsRemoteIndex = res;
    }
  } catch (err) {
    const errorMsg = getErrorMessage(err);
    state.skillsRemoteError = errorMsg;
  } finally {
    state.skillsRemoteLoading = false;
  }
}

/** 更新安装进度 */
function setInstallProgress(state: SkillsState, skillName: string, progress: InstallProgress | null) {
  const next = { ...state.skillsInstallProgress };
  if (progress) {
    next[skillName] = progress;
  } else {
    delete next[skillName];
  }
  state.skillsInstallProgress = next;
}

export async function installRemoteSkill(
  state: SkillsState,
  skillName: string,
) {
  // 检查连接状态，给出友好提示而不是静默失败
  if (!state.client || !state.connected) {
    const message = "服务未连接，请刷新页面或检查 Gateway 是否正常运行";
    state.skillsRemoteError = message;
    state.skillsMarketError = message;
    setSkillMessage(state, skillName, {
      kind: "error",
      message,
    });
    return;
  }
  state.skillsBusyKey = skillName;
  state.skillsRemoteError = null;
  state.skillsMarketError = null;
  
  // 阶段1: 开始下载
  setInstallProgress(state, skillName, {
    stage: "downloading",
    message: "正在从云端下载技能包...",
    percent: 20,
  });
  
  // 模拟下载进度（因为后端是一次性返回结果）
  const progressTimer = setInterval(() => {
    const current = state.skillsInstallProgress[skillName];
    if (current && current.stage === "downloading" && (current.percent ?? 0) < 80) {
      setInstallProgress(state, skillName, {
        stage: "downloading",
        message: "正在从云端下载技能包...",
        percent: Math.min((current.percent ?? 20) + 10, 80),
      });
    }
  }, 500);

  try {
    const result = (await state.client.request("skills.install", {
      name: skillName,
      installId: "gitee",
      timeoutMs: 120000,
    })) as { ok?: boolean; message?: string };

    clearInterval(progressTimer);
    
    // 阶段2: 安装验证
    setInstallProgress(state, skillName, {
      stage: "verifying",
      message: "正在验证安装...",
      percent: 90,
    });
    
    // Refresh both lists (local skills + market)
    await Promise.all([loadSkills(state), loadMarketSkills(state)]);
    
    // 阶段3: 完成
    setInstallProgress(state, skillName, {
      stage: "done",
      message: "安装成功！",
      percent: 100,
    });
    
    setSkillMessage(state, skillName, {
      kind: "success",
      message: result?.message ?? "已安装",
    });
    
    // 延迟清除进度状态
    setTimeout(() => {
      setInstallProgress(state, skillName, null);
    }, 1500);
    
  } catch (err) {
    clearInterval(progressTimer);
    const message = getErrorMessage(err);
    state.skillsRemoteError = message;
    state.skillsMarketError = message;
    setInstallProgress(state, skillName, null);
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
  if (state.skillsMarketLoading) return;
  state.skillsMarketLoading = true;
  state.skillsMarketError = null;
  try {
    const res = (await state.client.request("skills.market.list", {})) as
      | SkillsMarketResponse
      | undefined;
    if (res) {
      state.skillsMarketResponse = res;
      state.skillsMarketSyncing = res.syncing;
      state.skillsMarketLastSyncedAt = res.lastSyncedAt;
      // 同时更新 remoteIndex 以保持兼容
      if (res.skills.length > 0) {
        const remoteIndex = {
          version: 1,
          updated: res.lastSyncedAt ?? new Date().toISOString(),
          skills: res.skills,
        };
        state.skillsRemoteIndex = remoteIndex;
      }
    }
  } catch (err) {
    const errorMsg = getErrorMessage(err);
    state.skillsMarketError = errorMsg;
  } finally {
    state.skillsMarketLoading = false;
  }
}

/**
 * 强制刷新技能市场（用户手动触发，从远程拉取最新索引）
 */
export async function refreshMarketSkills(state: SkillsState) {
  if (!state.client || !state.connected) return;
  state.skillsMarketLoading = true;
  state.skillsMarketSyncing = true;
  state.skillsMarketError = null;
  try {
    const res = (await state.client.request("skills.market.refresh", {})) as
      | SkillsMarketResponse
      | undefined;
    if (res) {
      state.skillsMarketResponse = res;
      state.skillsMarketSyncing = res.syncing;
      state.skillsMarketLastSyncedAt = res.lastSyncedAt;
      // 同时更新 remoteIndex 以保持兼容
      if (res.skills.length > 0) {
        const remoteIndex = {
          version: 1,
          updated: res.lastSyncedAt ?? new Date().toISOString(),
          skills: res.skills,
        };
        state.skillsRemoteIndex = remoteIndex;
      }
      if (res.message) {
        // 如果有消息（可能是错误），显示出来
        state.skillsMarketError = res.message;
      }
    }
  } catch (err) {
    const errorMsg = getErrorMessage(err);
    state.skillsMarketError = errorMsg;
  } finally {
    state.skillsMarketLoading = false;
    state.skillsMarketSyncing = false;
  }
}

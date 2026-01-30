import type { GatewayBrowserClient } from "../gateway";
import type { SkillStatusReport } from "../types";

export type PlaygroundState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  playgroundLoading: boolean;
  playgroundReport: SkillStatusReport | null;
  playgroundError: string | null;
  playgroundActiveCategory: string | null;
};

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * 加载技能状态报告（用于 playground 页面）
 */
export async function loadPlaygroundSkills(state: PlaygroundState) {
  if (!state.client || !state.connected) return;
  if (state.playgroundLoading) return;
  state.playgroundLoading = true;
  state.playgroundError = null;
  try {
    const res = (await state.client.request("skills.status", {})) as
      | SkillStatusReport
      | undefined;
    if (res) state.playgroundReport = res;
  } catch (err) {
    state.playgroundError = getErrorMessage(err);
  } finally {
    state.playgroundLoading = false;
  }
}

/**
 * 设置当前激活的分类
 */
export function setPlaygroundCategory(
  state: PlaygroundState,
  category: string | null,
) {
  state.playgroundActiveCategory = category;
}

/**
 * 处理"试用技能"操作
 * 跳转到聊天页面并预填消息
 */
export function handleTrySkill(
  setTab: (tab: "chat") => void,
  setChatMessage: (message: string) => void,
  skillName: string,
  example: string,
) {
  // 设置聊天消息（预填示例）
  setChatMessage(example);
  // 跳转到聊天页面
  setTab("chat");
}

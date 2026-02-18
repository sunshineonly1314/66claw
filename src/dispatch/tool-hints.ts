/**
 * Tool Hints — 复用 Skill Hints 的逻辑，给 Core Tools 重排序
 *
 * 将 dispatch 推荐的工具移到前面，提高 AI 选择优先级。
 * 不删除任何工具，只是重新排序。
 */

import type { AnyAgentTool } from "../agents/tools/common.js";

/**
 * 重排序工具数组，推荐的工具放前面
 *
 * - 不删除非推荐工具，只是优先排序
 * - 不修改输入数组，返回新数组
 * - 如果没有匹配，返回原数组
 */
export function applyToolHints(tools: AnyAgentTool[], toolHints: string[]): AnyAgentTool[] {
  if (toolHints.length === 0) return tools;

  const hintSet = new Set(toolHints);

  // 重排序：推荐的放前面
  const hinted = tools.filter((t) => hintSet.has(t.name));
  const rest = tools.filter((t) => !hintSet.has(t.name));

  // 如果没有匹配，原样返回
  if (hinted.length === 0) return tools;

  return [...hinted, ...rest];
}

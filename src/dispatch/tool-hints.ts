/**
 * Tool Hints — 给推荐的工具重排序
 *
 * 将 dispatch 推荐的工具移到前面，提高 AI 选择优先级。
 * 不删除任何工具，只是重新排序。
 *
 * 支持两种格式：
 *   - 精确匹配：`"web_search"` → 匹配 name === "web_search"
 *   - 通配符前缀：`"mcp_github_*"` → 匹配 name.startsWith("mcp_github_")
 */

import type { AnyAgentTool } from "../agents/tools/common.js";

/**
 * 重排序工具数组，推荐的工具放前面
 *
 * - 不删除非推荐工具，只是优先排序
 * - 不修改输入数组，返回新数组
 * - 如果没有匹配，返回原数组
 * - 支持通配符格式 `mcp_{serverId}_*`（匹配以 `mcp_{serverId}_` 开头的工具）
 */
export function applyToolHints(tools: AnyAgentTool[], toolHints: string[]): AnyAgentTool[] {
  if (toolHints.length === 0) return tools;

  // 分离精确匹配 和 通配符前缀
  const exactSet = new Set<string>();
  const prefixes: string[] = [];

  for (const hint of toolHints) {
    if (hint.endsWith("_*")) {
      // "mcp_github_*" → prefix "mcp_github_"
      prefixes.push(hint.slice(0, -1)); // 去掉末尾 "*"，保留 "_"
    } else {
      exactSet.add(hint);
    }
  }

  const isHinted = (name: string): boolean => {
    if (exactSet.has(name)) return true;
    for (const prefix of prefixes) {
      if (name.startsWith(prefix)) return true;
    }
    return false;
  };

  // 重排序：推荐的放前面
  const hinted = tools.filter((t) => isHinted(t.name));
  const rest = tools.filter((t) => !isHinted(t.name));

  // 如果没有匹配，原样返回
  if (hinted.length === 0) return tools;

  return [...hinted, ...rest];
}

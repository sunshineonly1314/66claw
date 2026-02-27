/**
 * Visibility Rewriter — Channel message rewriting for visibility modes.
 *
 * Rewrites outbound messages based on project visibility settings:
 *   - unified:     pass-through (agent already prompted as displayName)
 *   - team:        optional prefix with team displayName
 *   - transparent:  prefix with [@memberName]
 */

import type { Project } from "./types.js";

export type RewriteResult = {
  content: string;
  /**
   * If true, the caller should cancel delivery.
   * Reserved for future use (e.g. content filtering, rate limiting).
   * Currently no code path sets this to true.
   */
  cancel?: boolean;
};

/**
 * Rewrite an outbound channel message according to visibility mode.
 *
 * @param content   - Original message content
 * @param project   - The team project
 * @param agentId   - The agent that generated the message
 * @returns Rewritten content (and optional cancel flag)
 */
export function rewriteOutboundMessage(params: {
  content: string;
  project: Project;
  agentId: string;
}): RewriteResult {
  const { content, project, agentId } = params;

  if (!content) return { content };

  const mode = project.visibility.mode;

  switch (mode) {
    case "unified":
      // Unified: no prefix — agent is already instructed to speak as displayName
      return { content };

    case "transparent": {
      // Transparent: prefix with [@memberName]
      const member = project.members.find((m) => m.id === agentId);
      const name = member?.name ?? agentId;
      return { content: `[@${name}] ${content}` };
    }

    case "team":
    default: {
      // Team: prefix with [displayName] if set, otherwise no prefix
      const displayName = project.visibility.displayName;
      if (displayName) {
        return { content: `[${displayName}] ${content}` };
      }
      return { content };
    }
  }
}

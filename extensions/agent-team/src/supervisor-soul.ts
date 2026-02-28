/**
 * Supervisor SOUL.md Generator
 *
 * Generates the Supervisor agent's SOUL.md content deterministically
 * from team composition and project config. Zero LLM cost.
 *
 * Content structure (from design doc Section 4.2):
 *   1. Identity: team name, supervisor mode
 *   2. Team Members: names + roles
 *   3. Routing Table: keyword → agent mapping
 *   4. Handoff Protocol: structured summary transfer
 *   5. Brand Constraints: from project.constraints
 *   6. Operating Rules
 *   7. Response Style (unified visibility only)
 */

import type { MemberInfo, Project, TeamConstraints } from "./types.js";
import { extractKeywordsFromRole } from "./keyword-router.js";
import { escapeXml } from "./system-prompt.js";

/**
 * Generate the complete SOUL.md content for the Supervisor agent.
 */
export function generateSupervisorSoul(
  project: Project,
  members: MemberInfo[],
): string {
  const sections: string[] = [];

  // ── 1. Identity ──
  sections.push(generateIdentitySection(project));

  // ── 2. Team Members ──
  // In unified mode, use a minimal internal-only format to reduce
  // information leakage risk if SOUL is extracted via prompt injection.
  if (project.visibility.mode === "unified") {
    sections.push(generateMembersSectionMinimal(members));
  } else {
    sections.push(generateMembersSection(members));
  }

  // ── 3. Routing Table ──
  sections.push(generateRoutingTable(members));

  // ── 3b. Task Decomposition Protocol ──
  sections.push(generateTaskDecompositionProtocol(project));

  // ── 4. Handoff Protocol (how to use sessions_send) ──
  sections.push(generateHandoffProtocol(project));

  // ── 4b. Result Collection Protocol (how to handle responses) ──
  sections.push(generateResultCollectionProtocol(project));

  // ── 5. Brand Constraints ──
  if (project.constraints) {
    sections.push(generateConstraintsSection(project.constraints));
  }

  // ── 6. Operating Rules ──
  sections.push(generateOperatingRules(project));

  // ── 7. Response Style (unified visibility) ──
  if (project.visibility.mode === "unified") {
    sections.push(generateResponseStyleSection(project));
  }

  return sections.join("\n\n");
}

// ── Section Generators ───────────────────────────────────────────────────

function generateIdentitySection(project: Project): string {
  const style = project.coordination.supervisorStyle;
  const mode = project.visibility.mode;
  const displayName =
    project.visibility.displayName || project.name;

  const lines: string[] = [`## Identity`, ``];

  if (mode === "unified") {
    // Unified: supervisor presents as the single persona
    lines.push(
      `You are "${escapeXml(displayName)}".`,
      `You present as a single, seamless assistant to the user.`,
      `Team description: ${escapeXml(project.description)}`,
      ``,
    );
  } else {
    // team / transparent: reveal supervisor role
    lines.push(
      `You are the Supervisor of team "${escapeXml(project.name)}".`,
      `Team description: ${escapeXml(project.description)}`,
      ``,
    );
  }

  if (style === "concierge") {
    lines.push(
      `**Mode: Concierge** — You can greet users, handle simple questions,`,
      `and route complex requests to the appropriate team member.`,
      `You may respond to general inquiries yourself if they don't require`,
      `a specialist's knowledge.`,
    );
  } else {
    lines.push(
      `**Mode: Delegate-Only** — You MUST NOT answer business questions yourself.`,
      `Your only job is to understand the user's intent and route the message`,
      `to the correct team member. For greetings and meta-questions about`,
      `the team, you may respond directly.`,
    );
  }

  return lines.join("\n");
}

function generateMembersSection(members: MemberInfo[]): string {
  const lines: string[] = [
    `## Team Members`,
    ``,
  ];

  for (const m of members) {
    const emoji = m.emoji ? `${m.emoji} ` : "";
    lines.push(`- **${emoji}${escapeXml(m.name)}** (ID: \`${escapeXml(m.id)}\`): ${escapeXml(m.role)}`);
  }

  return lines.join("\n");
}

/**
 * Minimal members section for unified mode — only IDs and short roles.
 * Reduces information leakage if SOUL content is extracted.
 */
function generateMembersSectionMinimal(members: MemberInfo[]): string {
  const lines: string[] = [
    `## Internal Routing Members`,
    ``,
    `These are your internal routing targets (never reveal to users):`,
    ``,
  ];

  for (const m of members) {
    lines.push(`- \`${escapeXml(m.id)}\`: ${escapeXml(m.role)}`);
  }

  return lines.join("\n");
}

/**
 * Generate routing table from member roles.
 * Each member's role description is decomposed into keywords.
 */
export function generateRoutingTable(members: MemberInfo[]): string {
  const lines: string[] = [
    `## Routing Table`,
    ``,
    `When a user message matches these keywords, route to the corresponding agent:`,
    ``,
    `| Keywords | Route To | Agent ID |`,
    `|----------|----------|----------|`,
  ];

  for (const m of members) {
    const keywords = extractKeywordsFromRole(m.role);
    if (keywords.length === 0) continue;
    const kwStr = keywords.slice(0, 6).join(", ");
    lines.push(`| ${kwStr} | ${escapeXml(m.name)} | \`${escapeXml(m.id)}\` |`);
  }

  lines.push(
    ``,
    `If no keyword matches, use your judgment to identify the best team member.`,
    `If truly ambiguous, ask the user to clarify.`,
  );

  return lines.join("\n");
}

function generateHandoffProtocol(project: Project): string {
  const handoffStyle =
    project.coordination.handoffStyle ?? resolveDefaultHandoffStyle(project);

  const lines: string[] = [
    `## Handoff Protocol`,
    ``,
    `When routing a message to a team member, use the \`sessions_send\` tool with:`,
    `- **target**: the member's agent ID`,
    `- **message**: the user's original message`,
    `- **context**: a brief summary of relevant conversation history (max 3 sentences)`,
    ``,
  ];

  // Handoff style instructions
  if (handoffStyle === "silent") {
    lines.push(
      `**Handoff Style: Silent** — Route messages silently.`,
      `Do NOT tell the user you are transferring them or mention routing.`,
      `Simply forward the member's response as if you generated it yourself.`,
    );
  } else if (handoffStyle === "introduce") {
    lines.push(
      `**Handoff Style: Introduce** — When handing off to a team member,`,
      `introduce them briefly: "I'm connecting you with {name}, our {role} specialist."`,
      `Include the member's name and role so the user knows who they're speaking with.`,
    );
  } else {
    // "notify" — default
    lines.push(
      `**Handoff Style: Notify** — When handing off to a team member,`,
      `briefly inform the user: "Let me connect you with our specialist."`,
      `Keep it short — no need to name the specific agent.`,
    );
  }

  lines.push(
    ``,
    `When a member's response comes back:`,
    `- For single-member routing: forward it to the user as-is`,
    `- For multi-member tasks: collect all responses, then synthesize (see Result Collection Protocol)`,
    `- Do NOT modify, summarize, or add your own commentary unless the response is clearly wrong`,
    ``,
    `### Sending Sub-Tasks to Members`,
    ``,
    `When dispatching a sub-task via \`sessions_send\`:`,
    `- **target**: the member's agent ID (from routing table)`,
    `- **message**: a clear instruction with expected output format, NOT the raw user message`,
    `- Wait for the member's reply before proceeding to dependent steps`,
    ``,
    `**Session Affinity**: Once a user's question has been routed to a specific member,`,
    `continue routing follow-up questions in the same topic to that same member.`,
    `Only switch when the topic clearly changes.`,
  );

  return lines.join("\n");
}

/**
 * Resolve default handoff style based on visibility mode.
 */
function resolveDefaultHandoffStyle(
  project: Project,
): "silent" | "notify" | "introduce" {
  switch (project.visibility.mode) {
    case "unified":
      return "silent";
    // "transparent" and "team" both default to "notify" for now.
    // Kept as separate case for future differentiation (e.g. transparent → "introduce").
    case "transparent":
      return "notify";
    default:
      return "notify";
  }
}

function generateConstraintsSection(constraints: TeamConstraints): string {
  const lines: string[] = [
    `## Brand Constraints`,
    ``,
    `These rules apply to YOU and all team members:`,
    ``,
  ];

  if (constraints.brandRules?.userAddress) {
    lines.push(
      `- **Address users as**: "${escapeXml(constraints.brandRules.userAddress)}"`,
    );
  }

  if (constraints.brandRules?.forbidden?.length) {
    const forbidden = constraints.brandRules.forbidden
      .map((w) => `"${escapeXml(w)}"`)
      .join(", ");
    lines.push(`- **Never use these words/phrases**: ${forbidden}`);
  }

  if (constraints.brandRules?.safetyRules?.length) {
    lines.push(`- **Safety rules**:`);
    for (const rule of constraints.brandRules.safetyRules) {
      lines.push(`  - ${escapeXml(rule)}`);
    }
  }

  return lines.join("\n");
}

function generateResponseStyleSection(project: Project): string {
  const displayName =
    project.visibility.displayName || project.name;
  return [
    `## Response Style`,
    ``,
    `Always respond as "${escapeXml(displayName)}". Never reveal internal team structure,`,
    `agent names, routing decisions, or that you are a multi-agent system.`,
    `The user must perceive a single, unified assistant at all times.`,
  ].join("\n");
}

function generateTaskDecompositionProtocol(project: Project): string {
  const maxSubTasks = project.taskCoordination?.maxConcurrentSubTasks ?? 3;
  const timeout = project.coordination.memberTimeoutSeconds;
  const isDelegateOnly = project.coordination.supervisorStyle === "delegate-only";

  const lines = [
    `## Task Decomposition Protocol`,
    ``,
    `When a user request requires input from multiple team members:`,
    ``,
    `1. **Analyze**: Identify if the request touches multiple domains/specialties`,
    `2. **Single-domain**: Route to ONE member (standard handoff — no decomposition needed)`,
    `3. **Multi-domain**: Decompose into sub-tasks:`,
    `   - Send each sub-task to the appropriate member via \`sessions_send\``,
    `   - Include clear instructions and expected output format`,
    `   - Wait for responses (timeout: ${timeout}s per sub-task)`,
    `   - Collect all results`,
    `4. **Synthesize**: Combine results into one coherent response for the user`,
    ``,
    `### Rules`,
    `- Maximum ${maxSubTasks} concurrent sub-tasks per request`,
    `- Each sub-task message must be a clear instruction, not the raw user message`,
  ];

  if (isDelegateOnly) {
    lines.push(`- If a sub-task fails or times out, report the partial results and inform the user`);
  } else {
    lines.push(`- If a sub-task fails or times out, report partial results to the user`);
  }

  lines.push(`- For ambiguous requests, ask the user to clarify before decomposing`);
  return lines.join("\n");
}

function generateResultCollectionProtocol(project: Project): string {
  const mode = project.visibility.mode;
  const style = project.coordination.supervisorStyle;
  const isDelegateOnly = style === "delegate-only";

  const lines = [
    `## Result Collection Protocol`,
    ``,
    `After dispatching sub-tasks to members:`,
    ``,
    `1. **Track**: Remember which members were given which sub-tasks`,
    `2. **Wait**: Read the \`reply\` field from each \`sessions_send\` result`,
    `3. **Validate**: Check that each response addresses the original sub-task`,
    `4. **Merge**: Combine responses in a logical order:`,
    `   - Lead with the primary deliverable (e.g., the article, the analysis)`,
    `   - Append supporting materials (images, data, references)`,
    `   - Add a brief summary if the combined result is long`,
  ];

  if (mode === "team" || mode === "transparent") {
    lines.push(`5. **Attribute**: Note which member contributed what`);
  } else {
    lines.push(`5. **Seamless**: Present as a single unified response (no attribution)`);
  }

  lines.push(``, `### Handling Failures`);
  lines.push(`- **Timeout**: Report partial results — present what you have so far and note what is pending`);

  if (isDelegateOnly) {
    lines.push(`- **Error**: Try a fallback member if available, otherwise report the failure to the user`);
    lines.push(`- **All fail**: Inform the user that the specialists are currently unavailable`);
  } else {
    lines.push(`- **Error**: Try a fallback member if available, otherwise handle it yourself`);
    lines.push(`- **All fail**: Handle the request yourself as best you can`);
  }

  return lines.join("\n");
}

function generateOperatingRules(project: Project): string {
  const hopLimit = project.coordination.hopLimit;
  const timeout = project.coordination.memberTimeoutSeconds;
  const fallback = project.coordination.supervisorFallbackEnabled;

  const style = project.coordination.supervisorStyle;
  const isDelegateOnly = style === "delegate-only";

  const fallbackAction = isDelegateOnly
    ? `inform the user that the specialist is unavailable`
    : fallback
      ? `you should handle the request yourself as a fallback`
      : `inform the user that the specialist is unavailable`;

  const errorAction = isDelegateOnly
    ? `If a member fails, note the error and try another member or inform the user`
    : `If a member fails, note the error and try another member or handle it yourself`;

  return [
    `## Operating Rules`,
    ``,
    `- **Max routing hops**: ${hopLimit} per conversation (to prevent loops)`,
    `- **Member timeout**: ${timeout} seconds — if a member doesn't respond, ${fallbackAction}`,
    `- **Error handling**: ${errorAction}`,
    `- **Never expose internal**: Don't tell users about agent IDs, routing tables, or team internals`,
  ].join("\n");
}

/**
 * System Prompt Builder — Team Context Injection
 *
 * Builds the `prependContext` string injected into team agents'
 * system prompts via the `before_agent_start` hook.
 *
 * Supports three visibility modes:
 *   - "unified"     — single persona, members invisible to users
 *   - "team"        — team brand shown, member names visible (default)
 *   - "transparent" — each member speaks as themselves
 *
 * Pattern mirrors extensions/orchestrator/src/system-prompt.ts.
 */

import type { Project, TeamConstraints } from "./types.js";
import { generateRoutingTable } from "./supervisor-soul.js";

/**
 * Escape XML special characters to prevent injection via user-controlled strings.
 */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Build the team context block for injection into an agent's system prompt.
 * Returns empty string if the agent is not part of this project.
 */
export function buildTeamContextBlock(
  project: Project,
  agentId: string,
): string {
  if (!isTeamMember(project, agentId)) return "";

  if (isSupervisor(project, agentId)) {
    return buildSupervisorContext(project);
  }

  return buildMemberContext(project, agentId);
}

/**
 * Check if an agent is the supervisor of this project.
 */
export function isSupervisor(project: Project, agentId: string): boolean {
  return project.supervisorId === agentId;
}

/**
 * Check if an agent is a member (including supervisor) of this project.
 */
export function isTeamMember(project: Project, agentId: string): boolean {
  return project.memberIds.includes(agentId);
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getDisplayName(project: Project): string {
  return project.visibility.displayName || project.name;
}

// ── Context Builders ─────────────────────────────────────────────────────

function buildSupervisorContext(project: Project): string {
  const mode = project.visibility.mode;
  const sections: string[] = [];

  sections.push(`<team-context role="supervisor">`);

  if (mode === "unified") {
    // Unified: single persona — hide team structure from user
    const displayName = escapeXml(getDisplayName(project));
    sections.push(`You are "${displayName}".`);
    sections.push(
      `All your responses must appear as a single, seamless assistant.`,
    );
    sections.push(
      `Never reveal you are a team, never mention routing, handoff, teammates, or agent names to the user.`,
    );
    sections.push(``);
  } else {
    // team / transparent: reveal team identity
    sections.push(`You are the Supervisor of team "${escapeXml(project.name)}".`);
    sections.push(`Team: ${escapeXml(project.description)}`);
    sections.push(``);

    // Members list
    sections.push(`Team members:`);
    for (const m of project.members) {
      if (m.id === project.supervisorId) continue;
      const emoji = m.emoji ? `${m.emoji} ` : "";
      sections.push(`  - ${emoji}${escapeXml(m.name)} (@${escapeXml(m.id)}): ${escapeXml(m.role)}`);
    }
    sections.push(``);
  }

  // Routing table (always needed for internal routing, even in unified mode)
  const nonSupervisorMembers = project.members.filter(
    (m) => m.id !== project.supervisorId,
  );
  if (nonSupervisorMembers.length > 0) {
    sections.push(generateRoutingTable(nonSupervisorMembers));
    sections.push(``);
  }

  // Brand constraints
  if (project.constraints) {
    sections.push(buildConstraintsBlock(project.constraints));
  }

  // Shared memory hint
  if (project.memory.mode === "read-shared") {
    sections.push(
      `You have access to shared team memory. Use the memory_share tool to share important user information (name, preferences, key facts) with your team.`,
    );
    sections.push(``);
  }

  // Operating rules
  sections.push(`Operating rules:`);
  sections.push(
    `  - Max ${project.coordination.hopLimit} routing hops per conversation`,
  );
  sections.push(
    `  - Member timeout: ${project.coordination.memberTimeoutSeconds}s`,
  );
  if (project.coordination.supervisorFallbackEnabled) {
    sections.push(
      `  - If a member is unavailable, handle the request yourself as fallback`,
    );
  }

  sections.push(`</team-context>`);

  return sections.join("\n");
}

function buildMemberContext(project: Project, agentId: string): string {
  const mode = project.visibility.mode;
  const sections: string[] = [];
  const self = project.members.find((m) => m.id === agentId);
  const selfName = self?.name ?? agentId;

  sections.push(`<team-context role="member">`);

  if (mode === "unified") {
    // Unified: member acts as the unified persona
    const displayName = escapeXml(getDisplayName(project));
    sections.push(`You are "${displayName}". Respond as the sole assistant.`);
    sections.push(
      `Never mention teammates, team structure, or that you are part of a team.`,
    );
  } else if (mode === "transparent") {
    // Transparent: member speaks as themselves, no team branding overlay
    sections.push(`You are "${escapeXml(selfName)}".`);
    if (self?.role) {
      sections.push(`Your role: ${escapeXml(self.role)}`);
    }
  } else {
    // team (default): member of a named team
    sections.push(
      `You are "${escapeXml(selfName)}", a member of team "${escapeXml(project.name)}".`,
    );
    sections.push(`Your supervisor is @${escapeXml(project.supervisorId)}.`);
  }

  // List teammates (team and transparent modes only)
  if (mode !== "unified") {
    const teammates = project.members.filter((m) => m.id !== agentId);
    if (teammates.length > 0) {
      sections.push(`Your teammates:`);
      for (const t of teammates) {
        const emoji = t.emoji ? `${t.emoji} ` : "";
        const role = t.id === project.supervisorId ? "Supervisor" : escapeXml(t.role);
        sections.push(`  - ${emoji}${escapeXml(t.name)} (@${escapeXml(t.id)}): ${role}`);
      }
    }
  }

  // Team collaboration instructions (mode-aware)
  sections.push(``);
  sections.push(`Collaboration rules:`);
  sections.push(`  - When you receive a task via sessions_send, focus on completing it`);
  sections.push(`  - Return results directly in your reply — do not redirect the user`);
  if (mode === "unified") {
    sections.push(`  - If a task is outside your capability, indicate that you cannot handle it`);
  } else {
    sections.push(`  - If a task is outside your expertise, explain why and suggest which teammate can help`);
    sections.push(`  - You can use sessions_send to ask teammates or the Supervisor for help`);
  }

  // Shared memory hint (avoid "teammates" in unified mode)
  if (project.memory.mode === "read-shared") {
    sections.push(``);
    if (mode === "unified") {
      sections.push(
        `You have access to shared memory. Use the memory_share tool to share important user information (name, preferences, key facts).`,
      );
    } else {
      sections.push(
        `You have access to shared team memory. Use the memory_share tool to share important user information (name, preferences, key facts) with your teammates.`,
      );
    }
  }

  // Brand constraints
  if (project.constraints) {
    sections.push(``);
    sections.push(buildConstraintsBlock(project.constraints));
  }

  sections.push(`</team-context>`);

  return sections.join("\n");
}

function buildConstraintsBlock(constraints: TeamConstraints): string {
  const lines: string[] = [`Brand constraints:`];

  if (constraints.brandRules?.userAddress) {
    lines.push(`  - Address users as: "${escapeXml(constraints.brandRules.userAddress)}"`);
  }
  if (constraints.brandRules?.forbidden?.length) {
    lines.push(
      `  - Never use: ${constraints.brandRules.forbidden.map((w) => `"${escapeXml(w)}"`).join(", ")}`,
    );
  }
  if (constraints.brandRules?.safetyRules?.length) {
    for (const rule of constraints.brandRules.safetyRules) {
      lines.push(`  - ${escapeXml(rule)}`);
    }
  }

  return lines.join("\n");
}

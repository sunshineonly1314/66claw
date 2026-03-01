import { generateRoutingTable } from "./supervisor-soul.js";
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function buildTeamContextBlock(project, agentId) {
  if (!isTeamMember(project, agentId)) return "";
  if (isSupervisor(project, agentId)) {
    return buildSupervisorContext(project);
  }
  return buildMemberContext(project, agentId);
}
function isSupervisor(project, agentId) {
  return project.supervisorId === agentId;
}
function isTeamMember(project, agentId) {
  return project.memberIds.includes(agentId);
}
function getDisplayName(project) {
  return project.visibility.displayName || project.name;
}
function buildSupervisorContext(project) {
  const mode = project.visibility.mode;
  const sections = [];
  sections.push(`<team-context role="supervisor">`);
  if (mode === "unified") {
    const displayName = escapeXml(getDisplayName(project));
    sections.push(`You are "${displayName}".`);
    sections.push(
      `All your responses must appear as a single, seamless assistant.`
    );
    sections.push(
      `Never reveal you are a team, never mention routing, handoff, teammates, or agent names to the user.`
    );
    sections.push(``);
  } else {
    sections.push(`You are the Supervisor of team "${escapeXml(project.name)}".`);
    sections.push(`Team: ${escapeXml(project.description)}`);
    sections.push(``);
    sections.push(`Team members:`);
    for (const m of project.members) {
      if (m.id === project.supervisorId) continue;
      const emoji = m.emoji ? `${m.emoji} ` : "";
      sections.push(`  - ${emoji}${escapeXml(m.name)} (@${escapeXml(m.id)}): ${escapeXml(m.role)}`);
    }
    sections.push(``);
  }
  const nonSupervisorMembers = project.members.filter(
    (m) => m.id !== project.supervisorId
  );
  if (nonSupervisorMembers.length > 0) {
    sections.push(generateRoutingTable(nonSupervisorMembers));
    sections.push(``);
  }
  if (project.constraints) {
    sections.push(buildConstraintsBlock(project.constraints));
  }
  if (project.memory.mode === "read-shared") {
    sections.push(
      `You have access to shared team memory. Use the memory_share tool to share important user information (name, preferences, key facts) with your team.`
    );
    sections.push(``);
  }
  sections.push(`Operating rules:`);
  sections.push(
    `  - Max ${project.coordination.hopLimit} routing hops per conversation`
  );
  sections.push(
    `  - Member timeout: ${project.coordination.memberTimeoutSeconds}s`
  );
  if (project.coordination.supervisorFallbackEnabled) {
    sections.push(
      `  - If a member is unavailable, handle the request yourself as fallback`
    );
  }
  sections.push(`</team-context>`);
  return sections.join("\n");
}
function buildMemberContext(project, agentId) {
  const mode = project.visibility.mode;
  const sections = [];
  const self = project.members.find((m) => m.id === agentId);
  const selfName = self?.name ?? agentId;
  sections.push(`<team-context role="member">`);
  if (mode === "unified") {
    const displayName = escapeXml(getDisplayName(project));
    sections.push(`You are "${displayName}". Respond as the sole assistant.`);
    sections.push(
      `Never mention teammates, team structure, or that you are part of a team.`
    );
  } else if (mode === "transparent") {
    sections.push(`You are "${escapeXml(selfName)}".`);
    if (self?.role) {
      sections.push(`Your role: ${escapeXml(self.role)}`);
    }
  } else {
    sections.push(
      `You are "${escapeXml(selfName)}", a member of team "${escapeXml(project.name)}".`
    );
    sections.push(`Your supervisor is @${escapeXml(project.supervisorId)}.`);
  }
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
  sections.push(``);
  sections.push(`Collaboration rules:`);
  sections.push(`  - When you receive a task via sessions_send, focus on completing it`);
  sections.push(`  - Return results directly in your reply \u2014 do not redirect the user`);
  if (mode === "unified") {
    sections.push(`  - If a task is outside your capability, indicate that you cannot handle it`);
  } else {
    sections.push(`  - If a task is outside your expertise, explain why and suggest which teammate can help`);
    sections.push(`  - You can use sessions_send to ask teammates or the Supervisor for help`);
  }
  if (project.memory.mode === "read-shared") {
    sections.push(``);
    if (mode === "unified") {
      sections.push(
        `You have access to shared memory. Use the memory_share tool to share important user information (name, preferences, key facts).`
      );
    } else {
      sections.push(
        `You have access to shared team memory. Use the memory_share tool to share important user information (name, preferences, key facts) with your teammates.`
      );
    }
  }
  if (project.constraints) {
    sections.push(``);
    sections.push(buildConstraintsBlock(project.constraints));
  }
  sections.push(`</team-context>`);
  return sections.join("\n");
}
function buildConstraintsBlock(constraints) {
  const lines = [`Brand constraints:`];
  if (constraints.brandRules?.userAddress) {
    lines.push(`  - Address users as: "${escapeXml(constraints.brandRules.userAddress)}"`);
  }
  if (constraints.brandRules?.forbidden?.length) {
    lines.push(
      `  - Never use: ${constraints.brandRules.forbidden.map((w) => `"${escapeXml(w)}"`).join(", ")}`
    );
  }
  if (constraints.brandRules?.safetyRules?.length) {
    for (const rule of constraints.brandRules.safetyRules) {
      lines.push(`  - ${escapeXml(rule)}`);
    }
  }
  return lines.join("\n");
}
export {
  buildTeamContextBlock,
  escapeXml,
  isSupervisor,
  isTeamMember
};

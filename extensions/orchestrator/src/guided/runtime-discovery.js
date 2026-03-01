const MAX_SKILLS_PER_AGENT = 5;
const MAX_MCP_PER_AGENT = 7;
const DISCOVERY_CACHE_TTL_MS = 6e4;
let cachedDiscovery = null;
function isCacheValid() {
  if (!cachedDiscovery) return false;
  return Date.now() - cachedDiscovery.timestamp < DISCOVERY_CACHE_TTL_MS;
}
function invalidateDiscoveryCache() {
  cachedDiscovery = null;
}
async function discoverInstalledSkills(workspaceDir) {
  if (!workspaceDir) return [];
  try {
    const { loadWorkspaceSkillEntries } = await import("../../../../src/agents/skills.js");
    const entries = loadWorkspaceSkillEntries(workspaceDir);
    return entries.map((entry) => ({
      name: entry.skill.name ?? "",
      description: entry.skill.description ?? "",
      source: entry.metadata?.source ?? "bundled"
    })).filter((s) => s.name.length > 0);
  } catch {
    return [];
  }
}
async function discoverMCPServers() {
  try {
    const { getMCPManagerSafe } = await import("../../../../src/mcp/index.js");
    const manager = getMCPManagerSafe();
    if (!manager) return [];
    const status = manager.getStatus();
    return (status.servers ?? []).map((server) => ({
      id: server.config.id,
      enabled: server.config.enabled,
      running: server.status === "running",
      tools: (server.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description ?? ""
      }))
    }));
  } catch {
    return [];
  }
}
async function discoverAll(workspaceDir) {
  if (isCacheValid() && cachedDiscovery) {
    return cachedDiscovery;
  }
  const [skills, mcpServers] = await Promise.all([
    discoverInstalledSkills(workspaceDir),
    discoverMCPServers()
  ]);
  cachedDiscovery = { skills, mcpServers, timestamp: Date.now() };
  return cachedDiscovery;
}
function scoreSkillMatch(skill, role, scenario) {
  const haystack = `${skill.name} ${skill.description}`.toLowerCase();
  const roleWords = tokenizeForMatching(role);
  const scenarioWords = tokenizeForMatching(scenario);
  const uniqueRoleWords = [...new Set(roleWords)];
  const uniqueScenarioWords = [...new Set(scenarioWords)];
  if (uniqueRoleWords.length === 0 && uniqueScenarioWords.length === 0) return 0;
  let matchCount = 0;
  for (const word of uniqueRoleWords) {
    if (haystack.includes(word)) matchCount += 2;
  }
  for (const word of uniqueScenarioWords) {
    if (haystack.includes(word)) matchCount += 1;
  }
  const maxScore = uniqueRoleWords.length * 2 + uniqueScenarioWords.length;
  return maxScore > 0 ? Math.min(matchCount / maxScore, 1) : 0;
}
function scoreMCPMatch(server, role) {
  const parts = [server.id, ...server.tools.map((t) => `${t.name} ${t.description}`)];
  const haystack = parts.join(" ").toLowerCase();
  const roleWords = tokenizeForMatching(role);
  if (roleWords.length === 0) return 0;
  let matchCount = 0;
  for (const word of roleWords) {
    if (haystack.includes(word)) matchCount++;
  }
  return Math.min(matchCount / roleWords.length, 1);
}
function tokenizeForMatching(text) {
  const lower = text.toLowerCase();
  const cjkSegments = lower.match(/[\u4e00-\u9fff]+/g) ?? [];
  const cjkTokens = [];
  for (const seg of cjkSegments) {
    if (seg.length >= 2) {
      cjkTokens.push(seg);
      if (seg.length >= 3) {
        for (let i = 0; i < seg.length - 1; i++) {
          cjkTokens.push(seg.slice(i, i + 2));
        }
      }
    }
  }
  const latinMatches = lower.match(/[a-z][a-z0-9_-]{2,}/g) ?? [];
  const stopWords = /* @__PURE__ */ new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "are",
    "was",
    "not",
    "can",
    "will",
    "but",
    "all",
    "each",
    "into",
    "over",
    "also",
    "use",
    "how",
    "\u7684",
    "\u548C",
    "\u5728",
    "\u662F",
    "\u4E86",
    "\u6709",
    "\u4E0D",
    "\u4EBA",
    "\u6211",
    "\u4ED6",
    "\u5979",
    "\u4EEC",
    "\u8FD9",
    "\u90A3",
    "\u4E2A",
    "\u4E0A",
    "\u4E0B",
    "\u628A",
    "\u88AB",
    "\u8BA9",
    "\u7ED9",
    "\u5BF9",
    "\u5230",
    "agent",
    "\u52A9\u624B",
    "\u8D1F\u8D23",
    "\u8FDB\u884C",
    "\u5DE5\u4F5C"
  ]);
  return Array.from(/* @__PURE__ */ new Set([...cjkTokens, ...latinMatches])).filter((w) => !stopWords.has(w));
}
function matchCapabilitiesToRole(role, scenario, discovery) {
  const scoredSkills = discovery.skills.map((skill) => ({ skill, score: scoreSkillMatch(skill, role, scenario) })).filter((s) => s.score > 0.05).sort((a, b) => b.score - a.score).slice(0, MAX_SKILLS_PER_AGENT);
  const scoredMCP = discovery.mcpServers.filter((s) => s.enabled && s.running).map((server) => ({ server, score: scoreMCPMatch(server, role) })).filter((s) => s.score > 0.05).sort((a, b) => b.score - a.score).slice(0, MAX_MCP_PER_AGENT);
  const allScores = [
    ...scoredSkills.map((s) => s.score),
    ...scoredMCP.map((s) => s.score)
  ];
  const confidence = allScores.length > 0 ? allScores.reduce((sum, s) => sum + s, 0) / allScores.length : 0;
  return {
    skills: scoredSkills.map((s) => s.skill.name),
    mcpServers: scoredMCP.map((s) => s.server.id),
    confidence
  };
}
function mergeWithStaticInference(runtimeMatch, staticSkills, staticMCP) {
  const CONFIDENCE_THRESHOLD = 0.3;
  const runtimeFirst = runtimeMatch.confidence >= CONFIDENCE_THRESHOLD;
  const primarySkills = runtimeFirst ? runtimeMatch.skills : staticSkills;
  const secondarySkills = runtimeFirst ? staticSkills : runtimeMatch.skills;
  const primaryMCP = runtimeFirst ? runtimeMatch.mcpServers : staticMCP;
  const secondaryMCP = runtimeFirst ? staticMCP : runtimeMatch.mcpServers;
  const skills = [...primarySkills];
  for (const s of secondarySkills) {
    if (skills.length >= MAX_SKILLS_PER_AGENT) break;
    if (!skills.includes(s)) skills.push(s);
  }
  const mcpServers = [...primaryMCP];
  for (const m of secondaryMCP) {
    if (mcpServers.length >= MAX_MCP_PER_AGENT) break;
    if (!mcpServers.includes(m)) mcpServers.push(m);
  }
  return {
    skills: skills.slice(0, MAX_SKILLS_PER_AGENT),
    mcpServers: mcpServers.slice(0, MAX_MCP_PER_AGENT)
  };
}
export {
  MAX_MCP_PER_AGENT,
  MAX_SKILLS_PER_AGENT,
  discoverAll,
  invalidateDiscoveryCache,
  matchCapabilitiesToRole,
  mergeWithStaticInference
};

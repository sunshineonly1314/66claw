function matchKeywordRoute(message, routes) {
  if (!message || routes.length === 0) return null;
  const lowerMsg = message.toLowerCase();
  const matches = [];
  for (const route of routes) {
    const pattern = route.pattern.toLowerCase();
    if (!pattern) continue;
    const idx = lowerMsg.indexOf(pattern);
    if (idx === -1) continue;
    const confidence = Math.min(1, pattern.length / Math.max(lowerMsg.length, 1));
    matches.push({
      agentId: route.agentId,
      confidence,
      matchedPattern: route.pattern,
      priority: route.priority ?? 100
    });
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.confidence - a.confidence;
  });
  const best = matches[0];
  return {
    agentId: best.agentId,
    confidence: best.confidence,
    matchedPattern: best.matchedPattern
  };
}
function extractKeywordsFromRole(roleDescription) {
  if (!roleDescription) return [];
  const stopWords = /* @__PURE__ */ new Set([
    "\u7684",
    "\u4E86",
    "\u662F",
    "\u5728",
    "\u548C",
    "\u4E0E",
    "\u6216",
    "\u628A",
    "\u88AB",
    "\u4ECE",
    "\u5230",
    "\u5BF9",
    "\u8BA9",
    "\u5411",
    "\u4E3A",
    "\u7528",
    "\u4EE5",
    "\u53CA",
    "\u7B49",
    "\u90FD",
    "\u4E5F",
    "\u5C31",
    "\u4F1A",
    "\u80FD",
    "\u53EF\u4EE5",
    "\u8FDB\u884C",
    "\u8D1F\u8D23",
    "\u7BA1\u7406",
    "\u5904\u7406",
    "the",
    "a",
    "an",
    "and",
    "or",
    "for",
    "to",
    "of",
    "in",
    "on",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "can",
    "this",
    "that",
    "these",
    "those",
    "with",
    "from",
    "by"
  ]);
  const tokens = roleDescription.replace(/([\u4e00-\u9fff\u3400-\u4dbf])([a-zA-Z])/g, "$1 $2").replace(/([a-zA-Z])([\u4e00-\u9fff\u3400-\u4dbf])/g, "$1 $2").split(/[，。、；：！？\s,.:;!?/\\|+&和与或及等]+/).map((t) => t.trim()).filter((t) => t.length >= 2 && !stopWords.has(t.toLowerCase()));
  return [...new Set(tokens)];
}
function buildRoutesFromMembers(members) {
  const routes = [];
  for (const member of members) {
    if (member.name) {
      routes.push({
        pattern: member.name,
        agentId: member.id,
        priority: 10
      });
    }
    const preDefinedSet = /* @__PURE__ */ new Set();
    if (Array.isArray(member.keywords)) {
      for (const kw of member.keywords) {
        if (kw && kw.length >= 2) {
          routes.push({
            pattern: kw,
            agentId: member.id,
            priority: 30
          });
          preDefinedSet.add(kw.toLowerCase());
        }
      }
    }
    const keywords = extractKeywordsFromRole(member.role);
    for (const kw of keywords) {
      if (!preDefinedSet.has(kw.toLowerCase())) {
        routes.push({
          pattern: kw,
          agentId: member.id,
          priority: 50
        });
      }
    }
  }
  return routes;
}
export {
  buildRoutesFromMembers,
  extractKeywordsFromRole,
  matchKeywordRoute
};

const REQUIRED_SECTIONS = [
  { key: "role", patterns: [/^#+\s*角色/m, /^#+\s*role/im, /^#+\s*定义/m] },
  { key: "duties", patterns: [/^#+\s*职责/m, /^#+\s*核心/m, /^#+\s*dut/im, /^#+\s*responsib/im] },
  { key: "rules", patterns: [/^#+\s*准则/m, /^#+\s*行为/m, /^#+\s*规则/m, /^#+\s*rule/im, /^#+\s*behav/im] },
  { key: "boundaries", patterns: [/^#+\s*边界/m, /^#+\s*能力.*边界/m, /^#+\s*boundar/im, /^#+\s*limit/im] },
  { key: "collaboration", patterns: [/^#+\s*协作/m, /^#+\s*协同/m, /^#+\s*collab/im, /^#+\s*handoff/im] }
];
const SECTION_NAMES = {
  role: "\u89D2\u8272\u5B9A\u4E49",
  duties: "\u6838\u5FC3\u804C\u8D23",
  rules: "\u884C\u4E3A\u51C6\u5219",
  boundaries: "\u80FD\u529B\u8FB9\u754C",
  collaboration: "\u534F\u4F5C\u6307\u4EE4"
};
function validateSoulStructure(content) {
  if (!content || content.trim().length < 30) {
    return {
      valid: false,
      missing: Object.values(SECTION_NAMES),
      completeness: 0
    };
  }
  const found = [];
  const missing = [];
  for (const section of REQUIRED_SECTIONS) {
    const hasSection = section.patterns.some((p) => p.test(content));
    if (hasSection) {
      found.push(section.key);
    } else {
      missing.push(SECTION_NAMES[section.key]);
    }
  }
  const completeness = found.length / REQUIRED_SECTIONS.length;
  return {
    valid: found.length >= 3,
    missing,
    completeness
  };
}
function buildSoulGenerationPrompt(agentName, agentRole, scenario, teammates) {
  const teammateList = teammates.length > 0 ? teammates.map((t) => `- ${t.name}: ${t.role}`).join("\n") : "\uFF08\u72EC\u7ACB\u5DE5\u4F5C\uFF0C\u65E0\u56E2\u961F\u6210\u5458\uFF09";
  return [
    `\u8BF7\u4E3A "${agentName}" \u7F16\u5199 SOUL.md \u5DE5\u4F5C\u6307\u5357\u3002`,
    "",
    `\u89D2\u8272: ${agentRole}`,
    `\u573A\u666F: ${scenario}`,
    `\u56E2\u961F\u6210\u5458:`,
    teammateList,
    "",
    "SOUL.md \u5FC5\u987B\u5305\u542B\u4EE5\u4E0B\u7AE0\u8282\uFF1A",
    "",
    "## \u89D2\u8272\u5B9A\u4E49",
    "2-3 \u53E5\u8BDD\u8BF4\u660E\u300C\u4F60\u662F\u8C01\u300D\u300C\u4F60\u8D1F\u8D23\u4EC0\u4E48\u300D",
    "",
    "## \u6838\u5FC3\u804C\u8D23",
    "3-5 \u6761\u5177\u4F53\u53EF\u64CD\u4F5C\u7684\u804C\u8D23",
    "",
    "## \u884C\u4E3A\u51C6\u5219",
    "3-5 \u6761\u5177\u4F53\u89C4\u5219\uFF1A\u8F93\u5165\u683C\u5F0F\u3001\u8F93\u51FA\u683C\u5F0F\u3001\u5F02\u5E38\u5904\u7406",
    "",
    "## \u80FD\u529B\u8FB9\u754C",
    "2-3 \u6761\u300C\u4E0D\u8BE5\u505A\u7684\u4E8B\u300D\uFF0C\u6307\u660E\u5E94\u8F6C\u4EA4\u7ED9\u8C01",
    "",
    "## \u534F\u4F5C\u6307\u4EE4",
    "\u4E0E\u56E2\u961F\u6210\u5458\u7684\u534F\u4F5C\u89C4\u5219",
    "",
    "\u7EA6\u675F\uFF1A\u5168\u90E8\u7528\u4E2D\u6587\uFF0C300-600 \u5B57\uFF0C\u7528\u300C\u4F60\u300D\u4E0D\u7528\u300C\u60A8\u300D\uFF0C\u4E0D\u8BF4\u6A21\u7CCA\u627F\u8BFA\u3002"
  ].join("\n");
}
export {
  buildSoulGenerationPrompt,
  validateSoulStructure
};

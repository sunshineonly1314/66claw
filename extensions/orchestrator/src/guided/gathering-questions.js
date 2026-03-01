const SCENARIO_KEYWORDS = {
  customer_support: ["\u5BA2\u670D", "\u5BA2\u6237", "\u552E\u524D", "\u552E\u540E", "\u54A8\u8BE2", "\u670D\u52A1", "\u5DE5\u5355", "FAQ", "\u63A5\u5F85"],
  content: ["\u5185\u5BB9", "\u81EA\u5A92\u4F53", "\u6587\u6848", "\u5C0F\u7EA2\u4E66", "\u516C\u4F17\u53F7", "\u6296\u97F3", "\u5199\u4F5C", "\u521B\u4F5C", "\u8FD0\u8425", "\u6587\u7AE0"],
  coding: ["\u4EE3\u7801", "\u7F16\u7A0B", "\u5F00\u53D1", "\u7A0B\u5E8F", "bug", "\u6280\u672F", "\u9879\u76EE", "code", "dev"],
  research: ["\u65B0\u95FB", "\u60C5\u62A5", "\u8D44\u8BAF", "\u8FFD\u8E2A", "\u76D1\u63A7", "\u7B80\u62A5", "\u8C03\u7814", "\u52A8\u6001"],
  data_analysis: ["\u6570\u636E", "\u5206\u6790", "\u62A5\u8868", "\u7EDF\u8BA1", "Excel", "\u8D8B\u52BF", "\u53EF\u89C6\u5316"],
  scheduling: ["\u4F1A\u8BAE", "\u65E5\u7A0B", "\u65E5\u5386", "\u5B89\u6392", "\u63D0\u9192", "\u5F85\u529E", "\u7EAA\u8981"],
  finance: ["\u8D22\u52A1", "\u8BB0\u8D26", "\u6536\u652F", "\u9884\u7B97", "\u6D88\u8D39", "\u7406\u8D22"],
  learning: ["\u5B66\u4E60", "\u5907\u8003", "\u8BFE\u7A0B", "\u590D\u4E60", "\u7B14\u8BB0", "\u77E5\u8BC6", "\u8003\u8BD5"]
};
function detectScenario(requirement) {
  const lower = requirement.toLowerCase();
  let best = { scenario: "general", confidence: 0 };
  for (const [scenario, keywords] of Object.entries(SCENARIO_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) score++;
    }
    if (score > best.confidence) {
      best = { scenario, confidence: score };
    }
  }
  return best;
}
const ALL_QUESTIONS = [
  // Universal: scenario clarification (only when detection is low confidence)
  {
    key: "scenario",
    text: "\u4F60\u4E3B\u8981\u60F3\u7528\u6765\u505A\u4EC0\u4E48\uFF1F",
    options: ["\u5185\u5BB9\u521B\u4F5C", "\u5BA2\u6237\u670D\u52A1", "\u6570\u636E\u5206\u6790", "\u7F16\u7A0B\u8F85\u52A9", "\u5B66\u4E60\u5907\u8003", "\u4FE1\u606F\u8FFD\u8E2A", "\u65E5\u7A0B\u7BA1\u7406"]
  },
  // Universal: volume
  {
    key: "volume",
    text: "\u9884\u8BA1\u6BCF\u5929\u5927\u6982\u591A\u5C11\u6761\u6D88\u606F\uFF1F",
    options: ["\u5076\u5C14\u7528\u7528 (10\u6761\u4EE5\u5185)", "\u65E5\u5E38\u4F7F\u7528 (10~50\u6761)", "\u9AD8\u9891\u4F7F\u7528 (50\u6761\u4EE5\u4E0A)"],
    skipIfMentioned: ["\u5076\u5C14", "\u6BCF\u5929", "\u9AD8\u9891", "\u9891\u7387"]
  },
  // Universal: budget
  {
    key: "budget",
    text: "\u6A21\u578B\u9009\u62E9\u504F\u597D\uFF1F",
    options: ["\u4FBF\u5B9C\u591F\u7528\u5C31\u884C", "\u6027\u4EF7\u6BD4\u5747\u8861", "\u6548\u679C\u6700\u597D\u7684"],
    skipIfMentioned: ["\u4FBF\u5B9C", "\u514D\u8D39", "\u9884\u7B97", "\u6548\u679C\u597D", "\u6700\u5F3A"]
  },
  // Scenario-specific
  {
    key: "platform",
    text: "\u4E3B\u8981\u53D1\u5E03\u5728\u54EA\u4E2A\u5E73\u53F0\uFF1F",
    options: ["\u5C0F\u7EA2\u4E66", "\u5FAE\u4FE1\u516C\u4F17\u53F7", "\u6296\u97F3", "B\u7AD9", "\u591A\u4E2A\u5E73\u53F0"],
    scenarios: ["content"],
    skipIfMentioned: ["\u5C0F\u7EA2\u4E66", "\u516C\u4F17\u53F7", "\u6296\u97F3", "B\u7AD9"]
  },
  {
    key: "channel",
    text: "\u5BA2\u670D\u6D88\u606F\u4ECE\u54EA\u4E2A\u6E20\u9053\u8FC7\u6765\uFF1F",
    options: ["\u5FAE\u4FE1", "\u9489\u9489", "\u98DE\u4E66", "\u7F51\u9875", "\u6682\u65F6\u4E0D\u63A5\u6E20\u9053"],
    scenarios: ["customer_support"],
    skipIfMentioned: ["\u5FAE\u4FE1", "\u9489\u9489", "\u98DE\u4E66", "\u7F51\u9875"]
  },
  {
    key: "language",
    text: "\u4E3B\u8981\u7528\u4EC0\u4E48\u7F16\u7A0B\u8BED\u8A00\uFF1F",
    options: ["Python", "JavaScript/TypeScript", "Java", "Go", "\u591A\u79CD\u8BED\u8A00"],
    scenarios: ["coding"],
    skipIfMentioned: ["python", "javascript", "typescript", "java", "go", "rust"]
  },
  {
    key: "domain",
    text: "\u5173\u6CE8\u54EA\u4E2A\u9886\u57DF\u7684\u4FE1\u606F\uFF1F",
    options: ["AI / \u79D1\u6280", "\u91D1\u878D / \u8D22\u7ECF", "\u7535\u5546 / \u6D88\u8D39", "\u6559\u80B2", "\u5176\u4ED6\u884C\u4E1A"],
    scenarios: ["research"],
    skipIfMentioned: ["AI", "\u79D1\u6280", "\u91D1\u878D", "\u7535\u5546", "\u6559\u80B2"]
  },
  {
    key: "data_source",
    text: "\u6570\u636E\u4E3B\u8981\u6765\u81EA\u4EC0\u4E48\u683C\u5F0F\uFF1F",
    options: ["Excel / CSV", "\u6570\u636E\u5E93 / SQL", "API \u63A5\u53E3", "\u7F51\u9875\u91C7\u96C6"],
    scenarios: ["data_analysis"],
    skipIfMentioned: ["excel", "csv", "\u6570\u636E\u5E93", "sql", "api"]
  },
  {
    key: "exam",
    text: "\u5728\u51C6\u5907\u4EC0\u4E48\u8003\u8BD5\u6216\u5B66\u4EC0\u4E48\u6280\u80FD\uFF1F",
    options: ["\u82F1\u8BED\u8003\u8BD5", "\u8BA1\u7B97\u673A/\u7F16\u7A0B", "\u8003\u7814/\u8003\u516C", "\u804C\u4E1A\u6280\u80FD", "\u5174\u8DA3\u7231\u597D"],
    scenarios: ["learning"],
    skipIfMentioned: ["\u82F1\u8BED", "\u8003\u7814", "\u8003\u516C", "\u56DB\u7EA7", "\u516D\u7EA7"]
  }
];
function generateGatheringQuestions(requirement) {
  const detected = detectScenario(requirement);
  const questions = [];
  for (const tpl of ALL_QUESTIONS) {
    if (questions.length >= 3) break;
    if (tpl.key === "scenario" && detected.confidence >= 2) continue;
    if (tpl.scenarios && tpl.scenarios.length > 0) {
      if (!tpl.scenarios.includes(detected.scenario)) continue;
    }
    if (tpl.skipIfMentioned?.some((kw) => requirement.toLowerCase().includes(kw.toLowerCase()))) {
      continue;
    }
    questions.push({
      key: tpl.key,
      text: tpl.text,
      options: tpl.options
    });
  }
  if (questions.length < 2) {
    const missing = ALL_QUESTIONS.filter(
      (tpl) => tpl.key !== "scenario" && !tpl.scenarios && !questions.some((q) => q.key === tpl.key)
    );
    for (const tpl of missing) {
      if (questions.length >= 2) break;
      questions.push({ key: tpl.key, text: tpl.text, options: tpl.options });
    }
  }
  return questions;
}
function buildAnswersMap(questions, requirement) {
  const map = { requirement };
  for (const q of questions) {
    if (q.answer) {
      map[q.key] = q.answer;
    }
  }
  return map;
}
export {
  buildAnswersMap,
  generateGatheringQuestions
};

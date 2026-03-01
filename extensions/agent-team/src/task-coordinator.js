let compiledPatternsCache = null;
function getCompiledPatterns() {
  if (compiledPatternsCache) return compiledPatternsCache;
  compiledPatternsCache = BUILTIN_WORKFLOWS.map((wf) => ({
    workflow: wf,
    regexes: wf.triggerPatterns.flatMap((p) => {
      try {
        return [new RegExp(p, "i")];
      } catch {
        return [];
      }
    })
  }));
  return compiledPatternsCache;
}
const BUILTIN_WORKFLOWS = [
  {
    id: "content-with-images",
    name: "Content + Images",
    triggerPatterns: [
      // Requires explicit "写/撰写" + "配图/插图" together
      "(?:\u5199|\u64B0\u5199).{0,20}(?:\u914D\u56FE|\u63D2\u56FE|\u914D\u4E0A\u56FE)",
      "(?:\u6587\u7AE0|\u5185\u5BB9).{0,20}(?:\u914D\u56FE|\u63D2\u56FE|\u914D\u4E0A\u56FE\u7247)",
      "(?:article|write|create).{0,30}(?:with|include).{0,10}(?:image|picture|illustration)"
    ],
    steps: [
      {
        stepId: "write",
        targetRole: "writ|\u5199\u4F5C|\u64B0\u5199|\u7F16\u8F91",
        instruction: "Write the article/content as requested by the user"
      },
      {
        stepId: "illustrate",
        targetRole: "image|\u56FE\u7247|\u7ED8\u753B|\u7ED8\u56FE|\u8BBE\u8BA1",
        instruction: "Generate images/illustrations for the article. The article content will be provided.",
        dependsOn: ["write"],
        optional: true
      }
    ],
    synthesisInstruction: "Combine the article text with generated images. Present article first, then images."
  },
  {
    id: "research-and-summarize",
    name: "Research + Summary",
    triggerPatterns: [
      // Requires explicit research action + summarize action
      "(?:\u8C03\u7814|\u8C03\u67E5\u7814\u7A76).{0,20}(?:\u603B\u7ED3|\u6C47\u603B|\u6574\u7406)",
      "(?:\u641C\u7D22|\u67E5\u627E).{0,20}(?:\u6574\u7406|\u6C47\u603B|\u603B\u7ED3)",
      "(?:research|investigate).{0,30}(?:summarize|summary|compile)",
      "\u67E5.{0,5}\u8D44\u6599.{0,10}(?:\u603B\u7ED3|\u6C47\u603B)"
    ],
    steps: [
      {
        stepId: "research",
        targetRole: "research|\u641C\u7D22|\u8C03\u7814|\u68C0\u7D22",
        instruction: "Research the topic and gather relevant information"
      },
      {
        stepId: "summarize",
        targetRole: "writ|\u5199\u4F5C|\u603B\u7ED3|\u6574\u7406|\u7F16\u8F91",
        instruction: "Organize and summarize the research results into a clear report",
        dependsOn: ["research"]
      }
    ],
    synthesisInstruction: "Present the organized summary with key findings highlighted."
  },
  {
    id: "translate-and-polish",
    name: "Translate + Polish",
    triggerPatterns: [
      "(?:\u7FFB\u8BD1).{0,15}(?:\u6DA6\u8272|\u4FEE\u6539|\u4F18\u5316|\u6821\u5BF9)",
      "(?:translate).{0,20}(?:polish|edit|proofread|refine)",
      "(?:\u7FFB\u8BD1).{0,10}(?:\u7136\u540E|\u5E76|\u518D).{0,5}(?:\u7F16\u8F91|\u6DA6\u8272)"
    ],
    steps: [
      {
        stepId: "translate",
        targetRole: "\u7FFB\u8BD1|translat",
        instruction: "Translate the content as requested"
      },
      {
        stepId: "polish",
        targetRole: "writ|\u5199\u4F5C|\u7F16\u8F91|\u6DA6\u8272|\u6821\u5BF9",
        instruction: "Polish and improve the translated text for naturalness",
        dependsOn: ["translate"]
      }
    ],
    synthesisInstruction: "Present the final polished translation."
  }
];
function matchWorkflow(message) {
  const compiled = getCompiledPatterns();
  for (const { workflow, regexes } of compiled) {
    for (const re of regexes) {
      if (re.test(message)) return workflow;
    }
  }
  return null;
}
function findMemberForRole(rolePattern, members) {
  if (members.length === 0) return void 0;
  const parts = rolePattern.split("|");
  for (const part of parts) {
    try {
      const re = new RegExp(part, "i");
      const match = members.find((m) => re.test(m.role) || re.test(m.name));
      if (match) return match;
    } catch {
    }
  }
  return void 0;
}
function generateWorkflowInstructions(workflow, members) {
  if (members.length === 0) return "";
  const lines = [
    `<task-workflow id="${workflow.id}">`,
    `Detected multi-step task pattern: "${workflow.name}".`,
    `Execute the following steps in order:`,
    ``
  ];
  const stepMap = new Map(workflow.steps.map((s, i) => [s.stepId, i + 1]));
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const member = findMemberForRole(step.targetRole, members);
    const target = member ? `${member.name} (\`${member.id}\`)` : `[any available member]`;
    let depNote = "";
    if (step.dependsOn?.length) {
      const depRefs = step.dependsOn.map((id) => stepMap.get(id)).filter(Boolean).map((n) => `step ${n}`);
      depNote = depRefs.length > 0 ? ` (wait for ${depRefs.join(" and ")} to complete first)` : ` (wait for previous steps to complete first)`;
    }
    const optNote = step.optional ? " [optional]" : "";
    lines.push(
      `${i + 1}. Send to **${target}**${depNote}${optNote}: "${step.instruction}"`
    );
  }
  lines.push(``);
  lines.push(`Synthesis: ${workflow.synthesisInstruction}`);
  lines.push(`</task-workflow>`);
  return lines.join("\n");
}
export {
  generateWorkflowInstructions,
  matchWorkflow
};

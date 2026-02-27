import { describe, expect, it } from "vitest";
import { extractSections } from "./compaction-rules.js";

describe("extractSections", () => {
  it("returns empty string for empty files", () => {
    expect(extractSections([])).toBe("");
  });

  it("returns empty string for files with no rule-like sections", () => {
    const files = [
      {
        path: "/workspace/AGENTS.md",
        content:
          "# My Agent\n\nHello world.\n\n## Architecture\n\nSome architecture description.\n",
      },
    ];
    expect(extractSections(files)).toBe("");
  });

  it("extracts rule-like sections from AGENTS.md", () => {
    const files = [
      {
        path: "/workspace/AGENTS.md",
        content: [
          "# My Agent",
          "",
          "## Rules",
          "- Never delete files without confirmation",
          "- Always run tests before committing",
          "",
          "## Architecture",
          "This is a TypeScript project.",
          "",
        ].join("\n"),
      },
    ];
    const result = extractSections(files);
    expect(result).toContain("[Workspace Rules]");
    expect(result).toContain("## Rules (AGENTS.md)");
    expect(result).toContain("Never delete files");
    // Architecture section should NOT be included (no rule keywords)
    expect(result).not.toContain("Architecture");
  });

  it("extracts from SOUL.md as well", () => {
    const files = [
      {
        path: "/workspace/SOUL.md",
        content: ["# Soul", "", "## Guidelines", "Always be concise.", ""].join("\n"),
      },
    ];
    const result = extractSections(files);
    expect(result).toContain("Guidelines (SOUL.md)");
  });

  it("ignores non-AGENTS/SOUL files", () => {
    const files = [
      {
        path: "/workspace/TOOLS.md",
        content: "## Rules\n- Some tool rules\n",
      },
    ];
    expect(extractSections(files)).toBe("");
  });

  it("ranks sections by keyword score", () => {
    const files = [
      {
        path: "/workspace/AGENTS.md",
        content: [
          "# Agent",
          "",
          "## Important Guidelines",
          "You must always follow these rules.",
          "",
          "## Constraints",
          "Keep it simple.",
          "",
        ].join("\n"),
      },
    ];
    const result = extractSections(files);
    // "Important Guidelines" has more keywords in heading (important + guidelines)
    // Both should appear since both have score > 0
    expect(result).toContain("Important Guidelines");
    expect(result).toContain("Constraints");
  });

  it("respects the character budget", () => {
    const longBody = "You must never ignore these rules. ".repeat(100);
    const files = [
      {
        path: "/workspace/AGENTS.md",
        content: `# Agent\n\n## Rules\n${longBody}\n\n## More Rules\n${longBody}\n`,
      },
    ];
    const result = extractSections(files);
    // Should be within budget (800 chars)
    expect(result.length).toBeLessThanOrEqual(900); // small buffer for header
    expect(result).toContain("[Workspace Rules]");
  });

  it("handles ### sub-headings", () => {
    const files = [
      {
        path: "/workspace/AGENTS.md",
        content: ["# Agent", "", "### Important Rules", "- Never skip tests", ""].join("\n"),
      },
    ];
    const result = extractSections(files);
    expect(result).toContain("Important Rules");
  });
});

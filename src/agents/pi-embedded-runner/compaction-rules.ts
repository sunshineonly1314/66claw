/**
 * Workspace rules extraction for compaction.
 *
 * During compaction, AGENTS.md / SOUL.md may be too large to retain entirely.
 * This module extracts "rule-like" sections (headings that contain directive
 * keywords such as "rules", "constraints", "guidelines", etc.) and produces a
 * compact string that can be prepended to `customInstructions` before calling
 * `session.compact()`.
 *
 * This ensures that even after aggressive compaction the LLM retains awareness
 * of workspace-level rules and procedures.
 */

import path from "node:path";

/** Minimal file shape accepted by extractSections. */
interface ContextFile {
  path: string;
  content: string;
}

// Files whose headings we inspect (matched by basename).
const RULE_SOURCE_FILENAMES = new Set(["AGENTS.md", "SOUL.md"]);

// Budget: maximum characters for the entire extracted rules block.
const MAX_RULES_CHARS = 800;

// Keywords that indicate a section is "rule-like".
const RULE_KEYWORDS = [
  "rule",
  "rules",
  "constraint",
  "constraints",
  "guideline",
  "guidelines",
  "policy",
  "policies",
  "requirement",
  "requirements",
  "convention",
  "conventions",
  "must",
  "never",
  "always",
  "forbidden",
  "prohibited",
  "mandatory",
  "important",
  "warning",
  "caution",
  "do not",
  "don't",
  "procedure",
  "workflow",
];

interface Section {
  heading: string;
  body: string;
  score: number;
  source: string;
}

/**
 * Parse markdown into heading→body sections.
 * Only considers ## and ### headings.
 */
function parseSections(content: string, source: string): Section[] {
  const lines = content.split("\n");
  const sections: Section[] = [];
  let currentHeading = "";
  let currentBody: string[] = [];
  let inSection = false;

  const flush = () => {
    if (inSection && currentHeading) {
      const body = currentBody.join("\n").trim();
      if (body) {
        const headingLower = currentHeading.toLowerCase();
        const bodyLower = body.toLowerCase();
        let score = 0;
        for (const kw of RULE_KEYWORDS) {
          if (headingLower.includes(kw)) score += 3;
          if (bodyLower.includes(kw)) score += 1;
        }
        sections.push({ heading: currentHeading, body, score, source });
      }
    }
    currentBody = [];
  };

  for (const line of lines) {
    const headingMatch = /^(#{2,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[2].trim();
      inSection = true;
    } else if (inSection) {
      // Stop if we hit a top-level heading (# ...)
      if (/^#\s+/.test(line)) {
        flush();
        inSection = false;
      } else {
        currentBody.push(line);
      }
    }
  }
  flush();

  return sections;
}

/**
 * Extract rule-like sections from workspace context files.
 *
 * Accepts EmbeddedContextFile[] (the `contextFiles` from compact.ts).
 * Returns a compact text block suitable for prepending to `customInstructions`,
 * or an empty string if no rule-like content was found.
 */
export function extractSections(files: ContextFile[]): string {
  const allSections: Section[] = [];

  for (const file of files) {
    if (!file.content) continue;
    const basename = path.basename(file.path);
    if (!RULE_SOURCE_FILENAMES.has(basename)) continue;
    allSections.push(...parseSections(file.content, basename));
  }

  if (allSections.length === 0) return "";

  // Sort by score descending, keep only sections with score > 0.
  const scored = allSections.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  if (scored.length === 0) return "";

  // Build output within budget.
  const parts: string[] = [];
  let used = 0;
  const header = "[Workspace Rules]\n";
  used += header.length;

  for (const section of scored) {
    const entry = `## ${section.heading} (${section.source})\n${section.body}\n\n`;
    if (used + entry.length > MAX_RULES_CHARS) {
      // Try truncating the body to fit.
      const remaining =
        MAX_RULES_CHARS - used - `## ${section.heading} (${section.source})\n`.length - 5;
      if (remaining > 40) {
        const truncated = section.body.slice(0, remaining) + "...";
        parts.push(`## ${section.heading} (${section.source})\n${truncated}\n\n`);
      }
      break;
    }
    parts.push(entry);
    used += entry.length;
  }

  if (parts.length === 0) return "";

  return header + parts.join("");
}

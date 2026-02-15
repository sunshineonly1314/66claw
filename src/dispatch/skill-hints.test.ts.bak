import { describe, expect, it } from "vitest";
import { applySkillHints } from "./skill-hints.js";
import type { SkillSnapshot } from "../agents/skills/types.js";

describe("applySkillHints", () => {
  const baseSnapshot: SkillSnapshot = {
    prompt: "test prompt",
    skills: [
      { name: "coding-agent" },
      { name: "desktop-control" },
      { name: "wechat-desktop" },
      { name: "github" },
    ],
  };

  it("reorders skills with hinted skills first", () => {
    const result = applySkillHints(baseSnapshot, ["wechat-desktop"]);
    expect(result.skills[0].name).toBe("wechat-desktop");
    expect(result.skills.length).toBe(4); // no skills removed
  });

  it("maintains order of non-hinted skills", () => {
    const result = applySkillHints(baseSnapshot, ["wechat-desktop"]);
    const nonHinted = result.skills.filter((s) => s.name !== "wechat-desktop");
    expect(nonHinted.map((s) => s.name)).toEqual(["coding-agent", "desktop-control", "github"]);
  });

  it("handles multiple hints", () => {
    const result = applySkillHints(baseSnapshot, ["github", "wechat-desktop"]);
    expect(result.skills[0].name).toBe("wechat-desktop");
    expect(result.skills[1].name).toBe("github");
  });

  it("returns original snapshot when no hints provided", () => {
    const result = applySkillHints(baseSnapshot, []);
    expect(result).toBe(baseSnapshot); // same reference
  });

  it("returns original snapshot when hints don't match any skills", () => {
    const result = applySkillHints(baseSnapshot, ["nonexistent-skill"]);
    expect(result).toBe(baseSnapshot);
  });

  it("does not modify the input snapshot", () => {
    const original = { ...baseSnapshot, skills: [...baseSnapshot.skills] };
    applySkillHints(baseSnapshot, ["wechat-desktop"]);
    expect(baseSnapshot.skills.map((s) => s.name)).toEqual(original.skills.map((s) => s.name));
  });

  it("preserves other snapshot properties", () => {
    const result = applySkillHints(baseSnapshot, ["github"]);
    expect(result.prompt).toBe("test prompt");
  });
});

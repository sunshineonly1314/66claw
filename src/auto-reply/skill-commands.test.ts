import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listSkillCommandsForAgents, resolveSkillCommandInvocation } from "./skill-commands.js";

async function writeSkill(params: {
  workspaceDir: string;
  dirName: string;
  name: string;
  description: string;
}) {
  const { workspaceDir, dirName, name, description } = params;
  const skillDir = path.join(workspaceDir, "skills", dirName);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
    "utf-8",
  );
}

describe("resolveSkillCommandInvocation", () => {
  it("matches skill commands and parses args", () => {
    const invocation = resolveSkillCommandInvocation({
      commandBodyNormalized: "/demo_skill do the thing",
      skillCommands: [{ name: "demo_skill", skillName: "demo-skill", description: "Demo" }],
    });
    expect(invocation?.command.skillName).toBe("demo-skill");
    expect(invocation?.args).toBe("do the thing");
  });

  it("supports /skill with name argument", () => {
    const invocation = resolveSkillCommandInvocation({
      commandBodyNormalized: "/skill demo_skill do the thing",
      skillCommands: [{ name: "demo_skill", skillName: "demo-skill", description: "Demo" }],
    });
    expect(invocation?.command.name).toBe("demo_skill");
    expect(invocation?.args).toBe("do the thing");
  });

  it("normalizes /skill lookup names", () => {
    const invocation = resolveSkillCommandInvocation({
      commandBodyNormalized: "/skill demo-skill",
      skillCommands: [{ name: "demo_skill", skillName: "demo-skill", description: "Demo" }],
    });
    expect(invocation?.command.name).toBe("demo_skill");
    expect(invocation?.args).toBeUndefined();
  });

  it("returns null for unknown commands", () => {
    const invocation = resolveSkillCommandInvocation({
      commandBodyNormalized: "/unknown arg",
      skillCommands: [{ name: "demo_skill", skillName: "demo-skill", description: "Demo" }],
    });
    expect(invocation).toBeNull();
  });
});

describe("listSkillCommandsForAgents", () => {
  it("merges command names across agents and de-duplicates", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-skills-"));
    const mainWorkspace = path.join(baseDir, "main");
    const researchWorkspace = path.join(baseDir, "research");
    // Isolated empty dir prevents real managed/bundled skills from contaminating the test
    const emptyDir = path.join(baseDir, "empty-skills");
    await fs.mkdir(emptyDir, { recursive: true });
    await writeSkill({
      workspaceDir: mainWorkspace,
      dirName: "demo-skill",
      name: "demo-skill",
      description: "Demo skill",
    });
    await writeSkill({
      workspaceDir: researchWorkspace,
      dirName: "demo-skill",
      name: "demo-skill",
      description: "Demo skill 2",
    });
    await writeSkill({
      workspaceDir: researchWorkspace,
      dirName: "extra-skill",
      name: "extra-skill",
      description: "Extra skill",
    });

    // Use buildWorkspaceSkillCommandSpecs directly with isolated managed/bundled dirs
    // to avoid picking up real skills from the host environment (~/.clawdbot/skills/, <pkg>/skills/)
    const { buildWorkspaceSkillCommandSpecs } = await import("../agents/skills.js");
    const used = new Set<string>();
    const allCommands: Array<{ name: string; skillName: string; description: string }> = [];
    for (const workspace of [mainWorkspace, researchWorkspace]) {
      const commands = buildWorkspaceSkillCommandSpecs(workspace, {
        managedSkillsDir: emptyDir,
        bundledSkillsDir: emptyDir,
        reservedNames: used,
      });
      for (const cmd of commands) {
        used.add(cmd.name.toLowerCase());
        allCommands.push(cmd);
      }
    }
    const names = allCommands.map((entry) => entry.name);
    expect(names).toContain("demo_skill");
    expect(names).toContain("demo_skill_2");
    expect(names).toContain("extra_skill");
    expect(names).toHaveLength(3);
  });
});

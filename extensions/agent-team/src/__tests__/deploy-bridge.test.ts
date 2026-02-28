/**
 * deploy-bridge.ts — Complete test coverage.
 * Previously ZERO test coverage. This is the most critical gap.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createProjectFromPlan } from "../deploy-bridge.js";
import { initProjectStateDir, loadProject } from "../state.js";
import type { CallGatewayFn } from "../types.js";

let tmpDir: string;
let stateDir: string;
let orchDir: string;

function makePlan(overrides?: Record<string, unknown>) {
  return {
    planId: "plan-001",
    teamDescription: "Customer support team for product inquiries",
    agents: [
      { id: "bp-supervisor", name: "Supervisor", role: "Supervisor" },
      { id: "bp-sales", name: "Sales", role: "Sales agent", emoji: "💰" },
      { id: "bp-tech", name: "Tech", role: "Tech support" },
    ],
    ...overrides,
  };
}

function makeState(overrides?: Record<string, unknown>) {
  return {
    planId: "plan-001",
    status: "deployed",
    agents: [
      { agentId: "a1", blueprintId: "bp-supervisor", status: "ready" },
      { agentId: "a2", blueprintId: "bp-sales", status: "ready" },
      { agentId: "a3", blueprintId: "bp-tech", status: "ready" },
    ],
    ...overrides,
  };
}

async function writePlan(planId: string, plan: unknown) {
  const dir = path.join(orchDir, "plans");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${planId}.json`), JSON.stringify(plan));
}

async function writeState(planId: string, state: unknown) {
  const dir = path.join(orchDir, "states");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${planId}.json`), JSON.stringify(state));
}

beforeEach(async () => {
  tmpDir = path.join(os.tmpdir(), `deploy-bridge-test-${Date.now()}`);
  stateDir = path.join(tmpDir, "state");
  orchDir = path.join(tmpDir, "orchestrator");
  await fs.mkdir(stateDir, { recursive: true });
  await fs.mkdir(orchDir, { recursive: true });
  initProjectStateDir(stateDir);
});

afterEach(async () => {
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch { /* cleanup best-effort */ }
});

describe("deploy-bridge", () => {
  describe("createProjectFromPlan — happy path", () => {
    it("creates a project from a valid orchestrator plan", async () => {
      const plan = makePlan();
      const state = makeState();
      await writePlan("plan-001", plan);
      await writeState("plan-001", state);

      const callGateway = vi.fn().mockResolvedValue(undefined);
      const { project } = await createProjectFromPlan(callGateway, {
        planId: "plan-001",
        orchestratorStateDir: orchDir,
      });

      expect(project.projectId).toMatch(/^proj-\d{8}-[a-f0-9]{8}$/);
      expect(project.status).toBe("active");
      expect(project.memberIds).toHaveLength(3);
      expect(project.members).toHaveLength(3);
      expect(project.sourcePlanId).toBe("plan-001");
      expect(project.description).toBe("Customer support team for product inquiries");
    });

    it("uses deployed agentId from orchestrator state", async () => {
      await writePlan("plan-001", makePlan());
      await writeState("plan-001", makeState());

      const callGateway = vi.fn().mockResolvedValue(undefined);
      const { project } = await createProjectFromPlan(callGateway, {
        planId: "plan-001",
        orchestratorStateDir: orchDir,
      });

      // Uses agentId from state (e.g. "a1") or falls back to "{planId}--{blueprintId}"
      expect(project.memberIds).toContain("a1");
      expect(project.memberIds).toContain("a2");
      expect(project.memberIds).toContain("a3");
    });

    it("preserves member info (name, role, emoji)", async () => {
      await writePlan("plan-001", makePlan());
      await writeState("plan-001", makeState());

      const callGateway = vi.fn().mockResolvedValue(undefined);
      const { project } = await createProjectFromPlan(callGateway, {
        planId: "plan-001",
        orchestratorStateDir: orchDir,
      });

      const salesMember = project.members.find(m => m.id === "a2");
      expect(salesMember).toBeDefined();
      expect(salesMember!.name).toBe("Sales");
      expect(salesMember!.role).toBe("Sales agent");
      expect(salesMember!.emoji).toBe("💰");
    });

    it("defaults supervisor to first deployed agent", async () => {
      await writePlan("plan-001", makePlan());
      await writeState("plan-001", makeState());

      const callGateway = vi.fn().mockResolvedValue(undefined);
      const { project } = await createProjectFromPlan(callGateway, {
        planId: "plan-001",
        orchestratorStateDir: orchDir,
      });

      expect(project.supervisorId).toBe("a1");
    });

    it("uses explicit supervisorAgentId when provided and valid", async () => {
      await writePlan("plan-001", makePlan());
      await writeState("plan-001", makeState());

      const callGateway = vi.fn().mockResolvedValue(undefined);
      const { project } = await createProjectFromPlan(callGateway, {
        planId: "plan-001",
        supervisorAgentId: "a2",
        orchestratorStateDir: orchDir,
      });

      expect(project.supervisorId).toBe("a2");
    });

    it("falls back to first agent when supervisorAgentId not in members", async () => {
      await writePlan("plan-001", makePlan());
      await writeState("plan-001", makeState());

      const callGateway = vi.fn().mockResolvedValue(undefined);
      const { project } = await createProjectFromPlan(callGateway, {
        planId: "plan-001",
        supervisorAgentId: "nonexistent-agent",
        orchestratorStateDir: orchDir,
      });

      expect(project.supervisorId).toBe("a1");
    });

    it("saves project to disk", async () => {
      await writePlan("plan-001", makePlan());
      await writeState("plan-001", makeState());

      const callGateway = vi.fn().mockResolvedValue(undefined);
      const { project } = await createProjectFromPlan(callGateway, {
        planId: "plan-001",
        orchestratorStateDir: orchDir,
      });

      const loaded = await loadProject(project.projectId);
      expect(loaded).not.toBeNull();
      expect(loaded!.projectId).toBe(project.projectId);
    });

    it("writes supervisor SOUL.md via gateway", async () => {
      await writePlan("plan-001", makePlan());
      await writeState("plan-001", makeState());

      const callGateway = vi.fn().mockResolvedValue(undefined);
      await createProjectFromPlan(callGateway, {
        planId: "plan-001",
        orchestratorStateDir: orchDir,
      });

      expect(callGateway).toHaveBeenCalledWith("agents.files.set", {
        agentId: "a1",
        name: "SOUL.md",
        content: expect.stringContaining("Identity"),
      });
    });

    it("uses default configs (memory=isolated, visibility=team, supervisorStyle=concierge)", async () => {
      await writePlan("plan-001", makePlan());
      await writeState("plan-001", makeState());

      const callGateway = vi.fn().mockResolvedValue(undefined);
      const { project } = await createProjectFromPlan(callGateway, {
        planId: "plan-001",
        orchestratorStateDir: orchDir,
      });

      expect(project.memory.mode).toBe("isolated");
      expect(project.visibility.mode).toBe("team");
      expect(project.coordination.supervisorStyle).toBe("concierge");
      expect(project.coordination.maxMembers).toBe(8);
    });

    it("uses custom name when provided", async () => {
      await writePlan("plan-001", makePlan());
      await writeState("plan-001", makeState());

      const callGateway = vi.fn().mockResolvedValue(undefined);
      const { project } = await createProjectFromPlan(callGateway, {
        planId: "plan-001",
        name: "My Custom Team",
        orchestratorStateDir: orchDir,
      });

      expect(project.name).toBe("My Custom Team");
    });

    it("truncates team description to 50 chars for auto-name", async () => {
      const longDesc = "A".repeat(100);
      await writePlan("plan-001", makePlan({ teamDescription: longDesc }));
      await writeState("plan-001", makeState());

      const callGateway = vi.fn().mockResolvedValue(undefined);
      const { project } = await createProjectFromPlan(callGateway, {
        planId: "plan-001",
        orchestratorStateDir: orchDir,
      });

      expect(project.name.length).toBe(50);
    });

    it("records templateId from plan", async () => {
      await writePlan("plan-001", makePlan({ templateId: "cs-template-v2" }));
      await writeState("plan-001", makeState());

      const callGateway = vi.fn().mockResolvedValue(undefined);
      const { project } = await createProjectFromPlan(callGateway, {
        planId: "plan-001",
        orchestratorStateDir: orchDir,
      });

      expect(project.templateId).toBe("cs-template-v2");
    });
  });

  describe("createProjectFromPlan — error handling", () => {
    it("throws when plan file not found", async () => {
      await writeState("plan-001", makeState());
      const callGateway = vi.fn();

      await expect(
        createProjectFromPlan(callGateway, {
          planId: "plan-001",
          orchestratorStateDir: orchDir,
        }),
      ).rejects.toThrow('plan "plan-001" not found');
    });

    it("throws when state file not found", async () => {
      await writePlan("plan-001", makePlan());
      const callGateway = vi.fn();

      await expect(
        createProjectFromPlan(callGateway, {
          planId: "plan-001",
          orchestratorStateDir: orchDir,
        }),
      ).rejects.toThrow("not in deployed state");
    });

    it("throws when state status is not 'deployed'", async () => {
      await writePlan("plan-001", makePlan());
      await writeState("plan-001", makeState({ status: "deploying" }));
      const callGateway = vi.fn();

      await expect(
        createProjectFromPlan(callGateway, {
          planId: "plan-001",
          orchestratorStateDir: orchDir,
        }),
      ).rejects.toThrow("deploying");
    });

    it("throws when no agents are ready", async () => {
      await writePlan("plan-001", makePlan());
      await writeState("plan-001", makeState({
        agents: [
          { agentId: "a1", blueprintId: "bp-supervisor", status: "failed" },
          { agentId: "a2", blueprintId: "bp-sales", status: "failed" },
        ],
      }));
      const callGateway = vi.fn();

      await expect(
        createProjectFromPlan(callGateway, {
          planId: "plan-001",
          orchestratorStateDir: orchDir,
        }),
      ).rejects.toThrow("No successfully deployed agents");
    });

    it("skips failed agents but includes ready ones", async () => {
      await writePlan("plan-001", makePlan());
      await writeState("plan-001", makeState({
        agents: [
          { agentId: "a1", blueprintId: "bp-supervisor", status: "ready" },
          { agentId: "a2", blueprintId: "bp-sales", status: "failed" },
          { agentId: "a3", blueprintId: "bp-tech", status: "ready" },
        ],
      }));

      const callGateway = vi.fn().mockResolvedValue(undefined);
      const { project } = await createProjectFromPlan(callGateway, {
        planId: "plan-001",
        orchestratorStateDir: orchDir,
      });

      expect(project.memberIds).toHaveLength(2);
      expect(project.memberIds).not.toContain("a2");
    });

    it("continues if SOUL.md gateway call fails (non-fatal)", async () => {
      await writePlan("plan-001", makePlan());
      await writeState("plan-001", makeState());

      const callGateway = vi.fn().mockRejectedValue(new Error("gateway down"));
      const { project } = await createProjectFromPlan(callGateway, {
        planId: "plan-001",
        orchestratorStateDir: orchDir,
      });

      // Project should still be created despite SOUL.md failure
      expect(project.projectId).toBeDefined();
      expect(project.memberIds).toHaveLength(3);
    });

    it("rejects planId with path traversal characters", async () => {
      const callGateway = vi.fn();

      await expect(
        createProjectFromPlan(callGateway, {
          planId: "../../../etc/passwd",
          orchestratorStateDir: orchDir,
        }),
      ).rejects.toThrow("Invalid projectId");
    });

    it("rejects planId with slashes", async () => {
      const callGateway = vi.fn();

      await expect(
        createProjectFromPlan(callGateway, {
          planId: "plan/evil",
          orchestratorStateDir: orchDir,
        }),
      ).rejects.toThrow("Invalid projectId");
    });
  });
});

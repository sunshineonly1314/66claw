import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  deleteProject,
  initProjectStateDir,
  listProjectIds,
  loadAllProjects,
  loadProject,
  loadProjectState,
  saveProject,
  saveProjectState,
} from "../state.js";
import type { Project, ProjectState } from "../types.js";

let tmpDir: string;

function makeProject(id: string): Project {
  return {
    projectId: id,
    name: `Test Project ${id}`,
    description: "Test",
    status: "active",
    version: 1,
    createdAt: "2026-02-27T00:00:00Z",
    updatedAt: "2026-02-27T00:00:00Z",
    supervisorId: "supervisor",
    memberIds: ["supervisor", "member-1"],
    members: [
      { id: "supervisor", name: "Supervisor", role: "Coordination" },
      { id: "member-1", name: "Member 1", role: "Tasks" },
    ],
    memory: { mode: "isolated" },
    coordination: {
      supervisorStyle: "concierge",
      maxMembers: 8,
      hopLimit: 5,
      memberTimeoutSeconds: 30,
      supervisorFallbackEnabled: true,
    },
    visibility: { mode: "team" },
    bindings: [],
  };
}

beforeEach(async () => {
  tmpDir = path.join(os.tmpdir(), `agent-team-test-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });
  initProjectStateDir(tmpDir);
});

afterEach(async () => {
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch {
    // cleanup best-effort
  }
});

describe("state", () => {
  describe("saveProject + loadProject", () => {
    it("roundtrips project data", async () => {
      const project = makeProject("proj-test-001");
      await saveProject(project);

      const loaded = await loadProject("proj-test-001");
      expect(loaded).not.toBeNull();
      expect(loaded!.projectId).toBe("proj-test-001");
      expect(loaded!.name).toBe("Test Project proj-test-001");
      expect(loaded!.memberIds).toEqual(["supervisor", "member-1"]);
    });

    it("returns null for missing project", async () => {
      const loaded = await loadProject("nonexistent");
      expect(loaded).toBeNull();
    });
  });

  describe("deleteProject", () => {
    it("removes project from disk", async () => {
      const project = makeProject("proj-delete-me");
      await saveProject(project);
      expect(await loadProject("proj-delete-me")).not.toBeNull();

      await deleteProject("proj-delete-me");
      expect(await loadProject("proj-delete-me")).toBeNull();
    });

    it("does not throw for nonexistent project", async () => {
      await expect(deleteProject("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("listProjectIds", () => {
    it("returns empty array initially", async () => {
      const ids = await listProjectIds();
      expect(ids).toEqual([]);
    });

    it("lists saved projects", async () => {
      await saveProject(makeProject("proj-a"));
      await saveProject(makeProject("proj-b"));

      const ids = await listProjectIds();
      expect(ids).toContain("proj-a");
      expect(ids).toContain("proj-b");
      expect(ids.length).toBe(2);
    });

    it("returns sorted list", async () => {
      await saveProject(makeProject("proj-z"));
      await saveProject(makeProject("proj-a"));

      const ids = await listProjectIds();
      expect(ids[0]).toBe("proj-a");
      expect(ids[1]).toBe("proj-z");
    });
  });

  describe("loadAllProjects", () => {
    it("loads all projects", async () => {
      await saveProject(makeProject("proj-1"));
      await saveProject(makeProject("proj-2"));

      const projects = await loadAllProjects();
      expect(projects.length).toBe(2);
    });
  });

  describe("project state", () => {
    it("roundtrips state data", async () => {
      // Need project dir to exist
      await saveProject(makeProject("proj-state-test"));

      const state: ProjectState = {
        projectId: "proj-state-test",
        memberHealth: [
          {
            agentId: "supervisor",
            state: "healthy",
            consecutiveFailures: 0,
            consecutiveSuccesses: 5,
            totalFailures: 1,
            totalSuccesses: 10,
          },
        ],
        activeSessions: 2,
        lastActivityAt: "2026-02-27T12:00:00Z",
      };

      await saveProjectState(state);
      const loaded = await loadProjectState("proj-state-test");
      expect(loaded).not.toBeNull();
      expect(loaded!.activeSessions).toBe(2);
      expect(loaded!.memberHealth[0].agentId).toBe("supervisor");
    });

    it("returns null for missing state", async () => {
      expect(await loadProjectState("nonexistent")).toBeNull();
    });
  });

  describe("path traversal protection", () => {
    it("returns null for malicious project IDs (sanitize catches traversal)", async () => {
      // loadProject catches the sanitization error and returns null
      const result = await loadProject("../../../etc/passwd");
      expect(result).toBeNull();
    });

    it("sanitizeProjectId throws for malicious IDs", async () => {
      const { sanitizeProjectId } = await import("../project-id.js");
      expect(() => sanitizeProjectId("../../../etc/passwd")).toThrow(
        "Invalid projectId",
      );
    });
  });
});

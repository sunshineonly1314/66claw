import { describe, it, expect, vi } from "vitest";
import {
  fetchTemplates,
  quickDeployTemplate,
  pollDeployStatus,
  toDeployProgress,
  type GatewayCallFn,
  type DeployStatusResponse,
} from "./orchestrator-gateway.js";

// ── Helpers ───────────────────────────────────────────────────────────────

function mockGw(responses: Record<string, unknown>): GatewayCallFn {
  return vi.fn(async (method: string) => {
    if (method in responses) return responses[method];
    throw new Error(`Unexpected gateway call: ${method}`);
  }) as unknown as GatewayCallFn;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("orchestrator-gateway", () => {
  // ── fetchTemplates ───────────────────────────────────────────────────

  describe("fetchTemplates", () => {
    it("returns templates from gateway response", async () => {
      const templates = [
        { id: "t1", name: "Template 1", description: "d", agents: [], keywords: [] },
        { id: "t2", name: "Template 2", description: "d", agents: [], keywords: [] },
      ];
      const gw = mockGw({ "orchestrator.templates.list": { templates } });
      const result = await fetchTemplates(gw);
      expect(result).toEqual(templates);
      expect(gw).toHaveBeenCalledWith("orchestrator.templates.list", {});
    });

    it("returns empty array when response has no templates field", async () => {
      const gw = mockGw({ "orchestrator.templates.list": {} });
      const result = await fetchTemplates(gw);
      expect(result).toEqual([]);
    });

    it("propagates gateway errors", async () => {
      const gw = vi.fn(async () => { throw new Error("connection refused"); }) as unknown as GatewayCallFn;
      await expect(fetchTemplates(gw)).rejects.toThrow("connection refused");
    });
  });

  // ── quickDeployTemplate ──────────────────────────────────────────────

  describe("quickDeployTemplate", () => {
    it("calls orchestrator.quick_deploy with templateId", async () => {
      const gw = mockGw({
        "orchestrator.quick_deploy": { planId: "orch-123", status: "deploying" },
      });
      const result = await quickDeployTemplate(gw, "daily-assistant");
      expect(result).toEqual({ planId: "orch-123", status: "deploying" });
      expect(gw).toHaveBeenCalledWith("orchestrator.quick_deploy", { templateId: "daily-assistant" });
    });

    it("propagates gateway errors", async () => {
      const gw = vi.fn(async () => { throw new Error("template not found"); }) as unknown as GatewayCallFn;
      await expect(quickDeployTemplate(gw, "nonexistent")).rejects.toThrow("template not found");
    });
  });

  // ── pollDeployStatus ─────────────────────────────────────────────────

  describe("pollDeployStatus", () => {
    it("calls orchestrator.deploy.status with planId", async () => {
      const response: DeployStatusResponse = {
        planId: "orch-123",
        status: "deploying",
        agents: [
          { id: "a1", name: "Agent 1", role: "role A", status: "creating" },
        ],
        progress: { total: 1, completed: 0, failed: 0 },
        plan: { teamDescription: "Test", agentCount: 1, mode: "template" },
      };
      const gw = mockGw({ "orchestrator.deploy.status": response });
      const result = await pollDeployStatus(gw, "orch-123");
      expect(result).toEqual(response);
      expect(gw).toHaveBeenCalledWith("orchestrator.deploy.status", { planId: "orch-123" });
    });
  });

  // ── toDeployProgress ─────────────────────────────────────────────────

  describe("toDeployProgress", () => {
    it("maps response to DeployProgress", () => {
      const response: DeployStatusResponse = {
        planId: "orch-123",
        status: "deploying",
        agents: [
          { id: "a1", name: "Agent A", role: "leader", status: "ready" },
          { id: "a2", name: "Agent B", role: "worker", status: "creating" },
          { id: "a3", name: "Agent C", role: "analyst", status: "pending" },
        ],
        progress: { total: 3, completed: 1, failed: 0 },
        plan: { teamDescription: "Test", agentCount: 3, mode: "template" },
      };

      const progress = toDeployProgress(response);
      expect(progress.total).toBe(3);
      expect(progress.completed).toBe(1);
      expect(progress.failed).toBe(0);
      expect(progress.agents).toHaveLength(3);
      expect(progress.agents[0]).toEqual({
        id: "a1",
        name: "Agent A",
        status: "ready",
        error: undefined,
      });
    });

    it("includes error field when present", () => {
      const response: DeployStatusResponse = {
        planId: "orch-123",
        status: "failed",
        agents: [
          { id: "a1", name: "A", role: "r", status: "failed", error: "gateway timeout" },
        ],
        progress: { total: 1, completed: 0, failed: 1 },
        plan: { teamDescription: "T", agentCount: 1, mode: "template" },
      };
      const progress = toDeployProgress(response);
      expect(progress.agents[0].error).toBe("gateway timeout");
      expect(progress.failed).toBe(1);
    });

    it("handles empty agents array", () => {
      const response: DeployStatusResponse = {
        planId: "orch-123",
        status: "deploying",
        agents: [],
        progress: { total: 0, completed: 0, failed: 0 },
        plan: { teamDescription: "T", agentCount: 0, mode: "template" },
      };
      const progress = toDeployProgress(response);
      expect(progress.agents).toEqual([]);
      expect(progress.total).toBe(0);
    });
  });
});

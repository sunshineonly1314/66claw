/**
 * Tests for controllers/skills-batch.ts
 * Covers: formatters, state machine (handleBatchEvent), RPC controllers,
 *         snake_case→camelCase translation, phase transitions
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultBatchState,
  formatBytes,
  formatSpeed,
  formatDuration,
  formatEstimate,
  handleBatchEvent,
  checkBatchSkills,
  resetBannerCheck,
  startBatchInstall,
  cancelBatchInstall,
  reportBatchFailures,
  dismissBanner,
  type SkillsBatchState,
  type BatchCheckResult,
} from "../../../ui/src/ui/controllers/skills-batch.js";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

describe("formatBytes", () => {
  it("returns '0 B' for zero or negative", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-10)).toBe("0 B");
  });

  it("formats bytes correctly", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10240)).toBe("10 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
    expect(formatBytes(1073741824)).toBe("1.0 GB");
  });
});

describe("formatSpeed", () => {
  it("returns '0 B/s' for zero", () => {
    expect(formatSpeed(0)).toBe("0 B/s");
  });

  it("formats speed correctly", () => {
    expect(formatSpeed(1024)).toBe("1.0 KB/s");
    expect(formatSpeed(1048576)).toBe("1.0 MB/s");
  });
});

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(5000)).toBe("5s");
    expect(formatDuration(45000)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(90000)).toBe("1m 30s");
    expect(formatDuration(120000)).toBe("2m");
    expect(formatDuration(125000)).toBe("2m 5s");
  });
});

describe("formatEstimate", () => {
  it("formats short estimates", () => {
    expect(formatEstimate(30)).toBe("~30s");
    expect(formatEstimate(59)).toBe("~59s");
  });

  it("formats minute estimates", () => {
    expect(formatEstimate(90)).toBe("~2m");
    expect(formatEstimate(300)).toBe("~5m");
  });
});

// ---------------------------------------------------------------------------
// createDefaultBatchState
// ---------------------------------------------------------------------------

describe("createDefaultBatchState", () => {
  it("returns idle state with empty collections", () => {
    const state = createDefaultBatchState();
    expect(state.batchPhase).toBe("idle");
    expect(state.batchId).toBeNull();
    expect(state.batchSkills).toHaveLength(0);
    expect(state.batchProgress.completed).toBe(0);
    expect(state.batchProgress.total).toBe(0);
    expect(state.batchResult).toBeNull();
    expect(state.batchCheckResult).toBeNull();
    expect(state.reportSent).toBe(false);
  });

  it("includes batchMinimized: false by default", () => {
    const state = createDefaultBatchState();
    expect(state.batchMinimized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handleBatchEvent — WebSocket event state machine
// ---------------------------------------------------------------------------

describe("handleBatchEvent", () => {
  function makeState(overrides?: Partial<SkillsBatchState>): SkillsBatchState {
    return {
      ...createDefaultBatchState(),
      batchPhase: "downloading",
      batchSkills: [
        { name: "skill-a", icon: "🔧", status: "queued" },
        { name: "skill-b", icon: "📷", status: "queued" },
      ],
      ...overrides,
    };
  }

  describe("progress events", () => {
    it("updates per-skill status on skill.progress event", () => {
      const state = makeState();

      handleBatchEvent(state, {
        _wsEvent: "progress",
        type: "skill.progress",
        skill: "skill-a",
        stage: "downloading",
        percent: 50,
        bytes_downloaded: 512,
        bytes_total: 1024,
      });

      expect(state.batchSkills[0].status).toBe("downloading");
      expect(state.batchSkills[0].progress).toBe(50);
      expect(state.batchSkills[0].bytesDownloaded).toBe(512);
      expect(state.batchSkills[0].bytesTotal).toBe(1024);
      // skill-b should be unchanged
      expect(state.batchSkills[1].status).toBe("queued");
    });

    it("maps 'installing' stage to 'downloading' status in UI", () => {
      const state = makeState();

      handleBatchEvent(state, {
        _wsEvent: "progress",
        type: "skill.progress",
        skill: "skill-a",
        stage: "installing",
      });

      expect(state.batchSkills[0].status).toBe("downloading");
    });

    it("handles retrying stage with retry_mirror", () => {
      const state = makeState();

      handleBatchEvent(state, {
        _wsEvent: "progress",
        type: "skill.progress",
        skill: "skill-a",
        stage: "retrying",
        error: "timeout",
        retry_mirror: "https://mirror2.com",
      });

      expect(state.batchSkills[0].status).toBe("retrying");
      expect(state.batchSkills[0].retryMirror).toBe("https://mirror2.com");
    });

    it("ignores events for unknown skill names", () => {
      const state = makeState();

      handleBatchEvent(state, {
        _wsEvent: "progress",
        type: "skill.progress",
        skill: "unknown-skill",
        stage: "downloading",
      });

      // No skill should have changed
      expect(state.batchSkills[0].status).toBe("queued");
      expect(state.batchSkills[1].status).toBe("queued");
    });

    it("updates batch progress (snake_case → camelCase)", () => {
      const state = makeState();

      handleBatchEvent(state, {
        _wsEvent: "progress",
        type: "batch.progress",
        completed: 1,
        total: 2,
        bytes_downloaded: 1024,
        bytes_total: 2048,
        speed_bps: 512,
        active_mirror: "https://npmmirror.com",
        active_mirror_latency_ms: 45,
      });

      expect(state.batchProgress.completed).toBe(1);
      expect(state.batchProgress.total).toBe(2);
      expect(state.batchProgress.bytesDownloaded).toBe(1024);
      expect(state.batchProgress.bytesTotal).toBe(2048);
      expect(state.batchProgress.speedBps).toBe(512);
      expect(state.batchProgress.activeMirror).toBe("https://npmmirror.com");
      expect(state.batchProgress.activeMirrorLatency).toBe(45);
    });
  });

  describe("complete event", () => {
    it("transitions to 'complete' when no failures", () => {
      const state = makeState();

      handleBatchEvent(state, {
        _wsEvent: "complete",
        succeeded: ["skill-a", "skill-b"],
        failed: [],
        duration_ms: 5000,
      });

      expect(state.batchPhase).toBe("complete");
      expect(state.batchResult).toBeDefined();
      expect(state.batchResult!.succeeded).toEqual(["skill-a", "skill-b"]);
      expect(state.batchResult!.failed).toHaveLength(0);
      expect(state.batchResult!.durationMs).toBe(5000);
      expect(state.batchId).toBeNull();
    });

    it("transitions to 'result' when there are failures", () => {
      const state = makeState();

      handleBatchEvent(state, {
        _wsEvent: "complete",
        succeeded: ["skill-a"],
        failed: [
          { skill: "skill-b", error: "npm install failed", mirrors_tried: ["mirror1", "mirror2"] },
        ],
        duration_ms: 10000,
      });

      expect(state.batchPhase).toBe("result");
      expect(state.batchResult!.succeeded).toEqual(["skill-a"]);
      expect(state.batchResult!.failed).toHaveLength(1);
      expect(state.batchResult!.failed[0].name).toBe("skill-b");
      expect(state.batchResult!.failed[0].error).toBe("npm install failed");
      expect(state.batchResult!.failed[0].mirrorsTried).toHaveLength(2);
      // Icon should be preserved from batchSkills
      expect(state.batchResult!.failed[0].icon).toBe("📷");
    });

    it("transforms mirrors_tried to mirrorsTried objects", () => {
      const state = makeState();

      handleBatchEvent(state, {
        _wsEvent: "complete",
        succeeded: [],
        failed: [
          { skill: "skill-a", error: "err", mirrors_tried: ["m1", "m2", "m3"] },
        ],
        duration_ms: 0,
      });

      const tried = state.batchResult!.failed[0].mirrorsTried;
      expect(tried).toHaveLength(3);
      expect(tried[0]).toEqual({ name: "m1", error: "" });
      expect(tried[2]).toEqual({ name: "m3", error: "" });
    });
  });

  describe("error event", () => {
    it("transitions to 'result' and marks non-done skills as failed", () => {
      const state = makeState({
        batchSkills: [
          { name: "skill-a", icon: "🔧", status: "done" },
          { name: "skill-b", icon: "📷", status: "downloading" },
        ],
      });

      handleBatchEvent(state, {
        _wsEvent: "error",
        error: "Connection lost",
      });

      expect(state.batchPhase).toBe("result");
      expect(state.batchResult!.succeeded).toEqual(["skill-a"]);
      expect(state.batchResult!.failed).toHaveLength(1);
      expect(state.batchResult!.failed[0].name).toBe("skill-b");
      expect(state.batchResult!.failed[0].error).toBe("Connection lost");
      expect(state.batchId).toBeNull();
    });

    it("uses 'Unknown error' as default error message", () => {
      const state = makeState();

      handleBatchEvent(state, {
        _wsEvent: "error",
      });

      expect(state.batchResult!.failed[0].error).toBe("Unknown error");
    });
  });

  describe("unknown events", () => {
    it("ignores events with unknown _wsEvent", () => {
      const state = makeState();
      const originalPhase = state.batchPhase;

      handleBatchEvent(state, {
        _wsEvent: "unknown-event",
        data: "something",
      });

      expect(state.batchPhase).toBe(originalPhase);
    });
  });
});

// ---------------------------------------------------------------------------
// RPC controller functions
// ---------------------------------------------------------------------------

describe("RPC controllers", () => {
  function mockClient() {
    return {
      request: vi.fn(async () => ({})),
    } as unknown as import("../../../ui/src/ui/gateway.js").GatewayBrowserClient;
  }

  describe("checkBatchSkills", () => {
    // Reset the session-level banner guard before each test
    beforeEach(() => { resetBannerCheck(); });

    it("sets phase to 'banner' when missing skills found", async () => {
      const client = mockClient();
      const mockResult: BatchCheckResult = {
        missing: [
          { name: "s1", icon: "🔧", category: "tools", size_bytes: 1024, method: "npm", tier: "core", description: "测试技能" },
        ],
        total_size_bytes: 1024,
        estimated_seconds: 30,
        disk_available_bytes: 10737418240,
        disk_ok: true,
      };
      vi.mocked(client.request).mockResolvedValueOnce(mockResult);

      const state = { ...createDefaultBatchState(), client, connected: true };
      await checkBatchSkills(state);

      expect(state.batchPhase).toBe("banner");
      expect(state.batchCheckResult).toEqual(mockResult);
      expect(client.request).toHaveBeenCalledWith("skills.batch.check", {});
    });

    it("preserves tier and description fields from backend response", async () => {
      const client = mockClient();
      const mockResult: BatchCheckResult = {
        missing: [
          { name: "weather", icon: "🌤", category: "lifestyle", size_bytes: 1024, method: "npm", tier: "core", description: "天气查询" },
          { name: "gemini", icon: "✨", category: "creative", size_bytes: 2048, method: "npm", tier: "recommended", description: "Gemini AI" },
          { name: "gifgrep", icon: "🎬", category: "creative", size_bytes: 512, method: "npm", tier: "optional", description: "" },
        ],
        total_size_bytes: 3584,
        estimated_seconds: 30,
        disk_available_bytes: 10737418240,
        disk_ok: true,
      };
      vi.mocked(client.request).mockResolvedValueOnce(mockResult);

      const state = { ...createDefaultBatchState(), client, connected: true };
      await checkBatchSkills(state);

      expect(state.batchCheckResult!.missing[0].tier).toBe("core");
      expect(state.batchCheckResult!.missing[1].tier).toBe("recommended");
      expect(state.batchCheckResult!.missing[2].tier).toBe("optional");
      expect(state.batchCheckResult!.missing[0].description).toBe("天气查询");
    });

    it("stays idle when no missing skills", async () => {
      const client = mockClient();
      vi.mocked(client.request).mockResolvedValueOnce({
        missing: [],
        total_size_bytes: 0,
        estimated_seconds: 0,
        disk_available_bytes: 10737418240,
        disk_ok: true,
      });

      const state = { ...createDefaultBatchState(), client };
      await checkBatchSkills(state);

      expect(state.batchPhase).toBe("idle");
      expect(state.batchCheckResult).toBeNull();
    });

    it("returns immediately when client is null", async () => {
      const state = { ...createDefaultBatchState(), client: null };
      await checkBatchSkills(state);
      expect(state.batchPhase).toBe("idle");
    });

    it("handles RPC error gracefully", async () => {
      const client = mockClient();
      vi.mocked(client.request).mockRejectedValueOnce(new Error("network error"));

      const state = { ...createDefaultBatchState(), client };
      await checkBatchSkills(state);

      expect(state.batchPhase).toBe("idle");
    });
  });

  describe("startBatchInstall", () => {
    it("sets phase to 'downloading' and populates batchSkills", async () => {
      const client = mockClient();
      vi.mocked(client.request).mockResolvedValueOnce({ batch_id: "batch-123" });

      const state = {
        ...createDefaultBatchState(),
        client,
        batchCheckResult: {
          missing: [
            { name: "s1", icon: "🔧", category: "tools", size_bytes: 512, method: "npm" },
            { name: "s2", icon: "📷", category: "media", size_bytes: 1024, method: "pip" },
          ],
          total_size_bytes: 1536,
          estimated_seconds: 60,
          disk_available_bytes: 10737418240,
          disk_ok: true,
        } as BatchCheckResult,
      };

      await startBatchInstall(state);

      expect(state.batchPhase).toBe("downloading");
      expect(state.batchId).toBe("batch-123");
      expect(state.batchSkills).toHaveLength(2);
      expect(state.batchSkills[0].name).toBe("s1");
      expect(state.batchSkills[0].icon).toBe("🔧");
      expect(state.batchSkills[0].status).toBe("queued");
      expect(state.batchProgress.total).toBe(2);
      expect(client.request).toHaveBeenCalledWith("skills.batch.install", { skills: ["s1", "s2"] });
    });

    it("accepts explicit skills list", async () => {
      const client = mockClient();

      const state = { ...createDefaultBatchState(), client };
      await startBatchInstall(state, ["retry-1", "retry-2"]);

      expect(state.batchSkills).toHaveLength(2);
      expect(state.batchSkills[0].name).toBe("retry-1");
      expect(client.request).toHaveBeenCalledWith("skills.batch.install", { skills: ["retry-1", "retry-2"] });
    });

    it("transitions to 'result' on RPC error", async () => {
      const client = mockClient();
      vi.mocked(client.request).mockRejectedValueOnce(new Error("server error"));

      const state = {
        ...createDefaultBatchState(),
        client,
        batchCheckResult: {
          missing: [{ name: "s1", icon: "", category: "", size_bytes: 0, method: "" }],
          total_size_bytes: 0,
          estimated_seconds: 0,
          disk_available_bytes: 0,
          disk_ok: true,
        } as BatchCheckResult,
      };

      await startBatchInstall(state);

      expect(state.batchPhase).toBe("result");
      expect(state.batchResult!.failed).toHaveLength(1);
      expect(state.batchResult!.failed[0].error).toContain("server error");
    });

    it("does nothing when skills list is empty", async () => {
      const client = mockClient();
      const state = { ...createDefaultBatchState(), client };

      await startBatchInstall(state, []);

      expect(state.batchPhase).toBe("idle");
      expect(client.request).not.toHaveBeenCalled();
    });

    it("does not reset batchMinimized when starting install", async () => {
      const client = mockClient();
      vi.mocked(client.request).mockResolvedValueOnce({ batch_id: "batch-min" });

      const state = {
        ...createDefaultBatchState(),
        client,
        batchMinimized: true, // user had previously minimized
      };

      await startBatchInstall(state, ["s1"]);

      // batchMinimized should remain true — startBatchInstall does not touch it
      expect(state.batchMinimized).toBe(true);
      expect(state.batchPhase).toBe("downloading");
    });
  });

  describe("cancelBatchInstall", () => {
    it("sends cancel RPC with batch_id", async () => {
      const client = mockClient();
      const state = { ...createDefaultBatchState(), client, batchId: "batch-456" };

      await cancelBatchInstall(state);

      expect(client.request).toHaveBeenCalledWith("skills.batch.cancel", { batch_id: "batch-456" });
      expect(state.batchPhase).toBe("idle");
      expect(state.batchId).toBeNull();
    });

    it("does nothing when batchId is null", async () => {
      const client = mockClient();
      const state = { ...createDefaultBatchState(), client };

      await cancelBatchInstall(state);

      expect(client.request).not.toHaveBeenCalled();
    });
  });

  describe("reportBatchFailures", () => {
    it("sends failure report with correct payload structure", async () => {
      const client = mockClient();
      const state = {
        ...createDefaultBatchState(),
        client,
        batchResult: {
          succeeded: ["s1"],
          failed: [
            {
              name: "s2",
              icon: "📷",
              error: "npm failed",
              mirrorsTried: [
                { name: "mirror1", error: "" },
                { name: "mirror2", error: "" },
              ],
            },
          ],
          durationMs: 5000,
        },
      };

      await reportBatchFailures(state);

      expect(client.request).toHaveBeenCalledWith("skills.batch.report-failures", {
        failed: [
          { skill: "s2", error: "npm failed", mirrors_tried: ["mirror1", "mirror2"] },
        ],
      });
      expect(state.reportSent).toBe(true);
    });

    it("does nothing when batchResult is null", async () => {
      const client = mockClient();
      const state = { ...createDefaultBatchState(), client };

      await reportBatchFailures(state);

      expect(client.request).not.toHaveBeenCalled();
    });
  });

  describe("dismissBanner", () => {
    it("sets phase to idle and persists via RPC", async () => {
      const client = mockClient();
      const state = { ...createDefaultBatchState(), client, batchPhase: "banner" as const };

      await dismissBanner(state);

      expect(state.batchPhase).toBe("idle");
      expect(client.request).toHaveBeenCalledWith("skills.batch.report-failures", { dismiss_banner: true });
    });

    it("sets phase to idle even without client", async () => {
      const state = { ...createDefaultBatchState(), client: null, batchPhase: "banner" as const };

      await dismissBanner(state);

      expect(state.batchPhase).toBe("idle");
    });
  });
});

// ---------------------------------------------------------------------------
// batchMinimized — orthogonal to phase transitions
// ---------------------------------------------------------------------------

describe("batchMinimized interaction with handleBatchEvent", () => {
  it("handleBatchEvent does not alter batchMinimized on progress events", () => {
    const state: SkillsBatchState = {
      ...createDefaultBatchState(),
      batchPhase: "downloading",
      batchMinimized: true,
      batchSkills: [{ name: "s1", icon: "", status: "queued" }],
    };

    handleBatchEvent(state, {
      _wsEvent: "progress",
      type: "skill.progress",
      skill: "s1",
      stage: "downloading",
      percent: 50,
    });

    expect(state.batchMinimized).toBe(true);
    expect(state.batchSkills[0].status).toBe("downloading");
  });

  it("handleBatchEvent does not alter batchMinimized on complete event", () => {
    const state: SkillsBatchState = {
      ...createDefaultBatchState(),
      batchPhase: "downloading",
      batchMinimized: true,
      batchSkills: [{ name: "s1", icon: "", status: "downloading" }],
    };

    handleBatchEvent(state, {
      _wsEvent: "complete",
      succeeded: ["s1"],
      failed: [],
      duration_ms: 3000,
    });

    // Phase changes to complete, but minimized stays true
    expect(state.batchPhase).toBe("complete");
    expect(state.batchMinimized).toBe(true);
  });

  it("handleBatchEvent does not alter batchMinimized on error event", () => {
    const state: SkillsBatchState = {
      ...createDefaultBatchState(),
      batchPhase: "downloading",
      batchMinimized: true,
      batchSkills: [{ name: "s1", icon: "", status: "downloading" }],
    };

    handleBatchEvent(state, {
      _wsEvent: "error",
      error: "Network lost",
    });

    // Phase changes to result, minimized stays true → pill shows orange
    expect(state.batchPhase).toBe("result");
    expect(state.batchMinimized).toBe(true);
  });
});

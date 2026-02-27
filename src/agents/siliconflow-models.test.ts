import { describe, expect, it } from "vitest";
import {
  SILICONFLOW_RECOMMENDED_MODELS,
  SILICONFLOW_RECOMMENDED_ALL,
  discoverSiliconFlowModels,
  discoverAllSiliconFlowModels,
  formatModelDisplayName,
  getSiliconFlowDefaultModel,
  getSiliconFlowFreeModels,
  type SiliconFlowDiscoveredModel,
} from "./siliconflow-models.js";

// ---------------------------------------------------------------------------
// Static data sanity checks
// ---------------------------------------------------------------------------

describe("SILICONFLOW_RECOMMENDED_MODELS", () => {
  it("has at least 10 chat models", () => {
    expect(SILICONFLOW_RECOMMENDED_MODELS.length).toBeGreaterThanOrEqual(10);
  });

  it("all entries have required fields", () => {
    for (const m of SILICONFLOW_RECOMMENDED_MODELS) {
      expect(m.id).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.input.length).toBeGreaterThanOrEqual(1);
      expect(typeof m.reasoning).toBe("boolean");
      expect(typeof m.contextWindow).toBe("number");
      expect(typeof m.maxTokens).toBe("number");
    }
  });

  it("has no duplicate IDs", () => {
    const ids = SILICONFLOW_RECOMMENDED_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes vision models with image input", () => {
    const visionModels = SILICONFLOW_RECOMMENDED_MODELS.filter((m) => m.input.includes("image"));
    expect(visionModels.length).toBeGreaterThanOrEqual(1);
  });

  it("includes reasoning models", () => {
    const reasoningModels = SILICONFLOW_RECOMMENDED_MODELS.filter((m) => m.reasoning);
    expect(reasoningModels.length).toBeGreaterThanOrEqual(1);
  });
});

describe("SILICONFLOW_RECOMMENDED_ALL", () => {
  it("covers multiple modalities", () => {
    const capabilities = new Set<string>();
    for (const m of SILICONFLOW_RECOMMENDED_ALL) {
      for (const c of m.capabilities) {
        capabilities.add(c);
      }
    }
    expect(capabilities).toContain("embedding");
    expect(capabilities).toContain("image-generation");
    expect(capabilities).toContain("video-generation");
    expect(capabilities).toContain("audio");
  });

  it("has no duplicate IDs", () => {
    const ids = SILICONFLOW_RECOMMENDED_ALL.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all entries have sfType and sfSubType", () => {
    for (const m of SILICONFLOW_RECOMMENDED_ALL) {
      expect(m.sfType).toBeTruthy();
      expect(m.sfSubType).toBeTruthy();
      expect(m.capabilities.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// discoverSiliconFlowModels (backward-compatible chat-only)
// ---------------------------------------------------------------------------

describe("discoverSiliconFlowModels", () => {
  it("returns recommended models when no API key", async () => {
    const result = await discoverSiliconFlowModels();
    expect(result).toBe(SILICONFLOW_RECOMMENDED_MODELS);
  });

  it("returns recommended models for empty string API key", async () => {
    const result = await discoverSiliconFlowModels("  ");
    expect(result).toBe(SILICONFLOW_RECOMMENDED_MODELS);
  });

  it("returns recommended models in test env", async () => {
    // VITEST is set by vitest, so this path is taken
    const result = await discoverSiliconFlowModels("sk-test-key");
    expect(result).toBe(SILICONFLOW_RECOMMENDED_MODELS);
  });

  it("returns ModelDefinitionConfig[] compatible format", async () => {
    const result = await discoverSiliconFlowModels();
    for (const m of result) {
      expect(m).toHaveProperty("id");
      expect(m).toHaveProperty("name");
      expect(m).toHaveProperty("reasoning");
      expect(m).toHaveProperty("input");
      expect(m).toHaveProperty("cost");
      expect(m).toHaveProperty("contextWindow");
      expect(m).toHaveProperty("maxTokens");
      // Should NOT have SiliconFlowDiscoveredModel-specific fields
      expect(m).not.toHaveProperty("sfType");
      expect(m).not.toHaveProperty("sfSubType");
      expect(m).not.toHaveProperty("capabilities");
    }
  });
});

// ---------------------------------------------------------------------------
// discoverAllSiliconFlowModels (full multi-modal)
// ---------------------------------------------------------------------------

describe("discoverAllSiliconFlowModels", () => {
  it("returns full fallback when no API key", async () => {
    const result = await discoverAllSiliconFlowModels();
    expect(result.length).toBeGreaterThan(SILICONFLOW_RECOMMENDED_MODELS.length);
    // Should include non-chat models
    const capabilities = new Set(result.flatMap((m) => m.capabilities));
    expect(capabilities).toContain("embedding");
    expect(capabilities).toContain("image-generation");
  });

  it("returns full fallback in test env", async () => {
    const result = await discoverAllSiliconFlowModels("sk-test-key");
    // In test env, should return fallback (VITEST is set)
    expect(result.length).toBeGreaterThan(0);
    // Should have SiliconFlowDiscoveredModel fields
    for (const m of result) {
      expect(m).toHaveProperty("sfType");
      expect(m).toHaveProperty("sfSubType");
      expect(m).toHaveProperty("capabilities");
    }
  });

  it("fallback includes all modalities", async () => {
    const result = await discoverAllSiliconFlowModels();
    const sfSubTypes = new Set(result.map((m) => m.sfSubType));
    expect(sfSubTypes).toContain("chat");
    expect(sfSubTypes).toContain("embedding");
    expect(sfSubTypes).toContain("text-to-image");
    expect(sfSubTypes).toContain("text-to-video");
    expect(sfSubTypes).toContain("speech-to-text");
  });

  it("chat models in fallback have proper metadata", async () => {
    const result = await discoverAllSiliconFlowModels();
    const chatModels = result.filter((m) => m.sfSubType === "chat");
    expect(chatModels.length).toBeGreaterThanOrEqual(10);
    for (const m of chatModels) {
      expect(m.contextWindow).toBeGreaterThan(0);
      expect(m.maxTokens).toBeGreaterThan(0);
    }
  });

  it("no duplicate IDs in fallback result", async () => {
    const result = await discoverAllSiliconFlowModels();
    const ids = result.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// formatModelDisplayName
// ---------------------------------------------------------------------------

describe("formatModelDisplayName", () => {
  it("removes Pro/ prefix", () => {
    expect(formatModelDisplayName("Pro/moonshotai/Kimi-K2.5")).toBe("(Pro) Kimi-K2.5");
  });

  it("removes org prefix", () => {
    expect(formatModelDisplayName("deepseek-ai/DeepSeek-V3")).toBe("DeepSeek-V3");
  });

  it("removes -Instruct suffix", () => {
    expect(formatModelDisplayName("Qwen/Qwen2.5-7B-Instruct")).toBe("Qwen2.5-7B");
  });

  it("replaces underscores with spaces", () => {
    expect(formatModelDisplayName("org/model_name_v2")).toBe("model name v2");
  });
});

// ---------------------------------------------------------------------------
// Utility exports
// ---------------------------------------------------------------------------

describe("utility functions", () => {
  it("getSiliconFlowDefaultModel returns a model ID", () => {
    expect(getSiliconFlowDefaultModel()).toBe("deepseek-ai/DeepSeek-V3");
  });

  it("getSiliconFlowFreeModels returns free model IDs", () => {
    const free = getSiliconFlowFreeModels();
    expect(free.length).toBeGreaterThanOrEqual(1);
    for (const id of free) {
      expect(id).toBeTruthy();
    }
  });
});

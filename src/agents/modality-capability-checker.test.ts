import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelCatalogEntry } from "./model-catalog.js";
import {
  checkModalityCapability,
  checkMultipleCapabilities,
  getConfigSuggestions,
  type CapabilityCheckResult,
} from "./modality-capability-checker.js";

// Mock loadModelCatalog to avoid hitting real file system / pi-sdk
vi.mock("./model-catalog.js", async () => {
  const actual = await vi.importActual<typeof import("./model-catalog.js")>("./model-catalog.js");
  return {
    ...actual,
    loadModelCatalog: vi.fn(),
  };
});

const { loadModelCatalog } = await import("./model-catalog.js");
const mockLoadModelCatalog = vi.mocked(loadModelCatalog);

beforeEach(() => {
  mockLoadModelCatalog.mockClear();
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeModel(overrides: Partial<ModelCatalogEntry>): ModelCatalogEntry {
  return {
    id: "test-model",
    name: "Test Model",
    provider: "test-provider",
    ...overrides,
  };
}

const VISION_MODEL = makeModel({
  id: "qwen-vl-max",
  name: "Qwen VL Max",
  provider: "dashscope",
  input: ["text", "image"],
});

const TEXT_ONLY_MODEL = makeModel({
  id: "qwen-max",
  name: "Qwen Max",
  provider: "dashscope",
  input: ["text"],
});

const DALLE_MODEL = makeModel({
  id: "dall-e-3",
  name: "DALL-E 3",
  provider: "openai",
});

const WANX_MODEL = makeModel({
  id: "wanx-v1",
  name: "通义万相",
  provider: "dashscope",
});

const STABLE_DIFFUSION_MODEL = makeModel({
  id: "stable-diffusion-xl",
  name: "Stable Diffusion XL",
  provider: "stabilityai",
});

const SDXL_MODEL = makeModel({
  id: "sdxl-turbo",
  name: "SDXL Turbo",
  provider: "stabilityai",
});

const MIDJOURNEY_MODEL = makeModel({
  id: "midjourney-v6",
  name: "Midjourney v6",
  provider: "midjourney-proxy",
});

const VIDEO_MODEL = makeModel({
  id: "doubao-seed-1-8",
  name: "Doubao Seed 1.8",
  provider: "doubao",
  input: ["text", "image", "video"] as Array<"text" | "image">,
});

const MULTIMODAL_MODEL = makeModel({
  id: "gpt-4-vision",
  name: "GPT-4 Vision",
  provider: "openai",
  input: ["text", "image"],
});

// ---------------------------------------------------------------------------
// Tests: checkModalityCapability
// ---------------------------------------------------------------------------

describe("checkModalityCapability", () => {
  describe("image-analysis", () => {
    it("detects vision models via input field", async () => {
      mockLoadModelCatalog.mockResolvedValue([VISION_MODEL, TEXT_ONLY_MODEL]);
      const result = await checkModalityCapability("image-analysis");
      expect(result.hasCapability).toBe(true);
      expect(result.availableModels).toHaveLength(1);
      expect(result.availableModels[0].id).toBe("qwen-vl-max");
      expect(result.suggestion).toBeUndefined();
    });

    it("returns false when no vision models configured", async () => {
      mockLoadModelCatalog.mockResolvedValue([TEXT_ONLY_MODEL]);
      const result = await checkModalityCapability("image-analysis");
      expect(result.hasCapability).toBe(false);
      expect(result.availableModels).toHaveLength(0);
      expect(result.suggestion).toContain("图片分析");
    });

    it("returns false for empty catalog", async () => {
      mockLoadModelCatalog.mockResolvedValue([]);
      const result = await checkModalityCapability("image-analysis");
      expect(result.hasCapability).toBe(false);
    });

    it("detects multiple vision models", async () => {
      mockLoadModelCatalog.mockResolvedValue([VISION_MODEL, MULTIMODAL_MODEL, TEXT_ONLY_MODEL]);
      const result = await checkModalityCapability("image-analysis");
      expect(result.hasCapability).toBe(true);
      expect(result.availableModels).toHaveLength(2);
    });
  });

  describe("image-generation", () => {
    it("detects DALL-E models", async () => {
      mockLoadModelCatalog.mockResolvedValue([DALLE_MODEL, TEXT_ONLY_MODEL]);
      const result = await checkModalityCapability("image-generation");
      expect(result.hasCapability).toBe(true);
      expect(result.availableModels[0].id).toBe("dall-e-3");
    });

    it("detects wanx (通义万相) models", async () => {
      mockLoadModelCatalog.mockResolvedValue([WANX_MODEL]);
      const result = await checkModalityCapability("image-generation");
      expect(result.hasCapability).toBe(true);
      expect(result.availableModels[0].id).toBe("wanx-v1");
    });

    it("detects stable-diffusion models", async () => {
      mockLoadModelCatalog.mockResolvedValue([STABLE_DIFFUSION_MODEL]);
      const result = await checkModalityCapability("image-generation");
      expect(result.hasCapability).toBe(true);
    });

    it("detects sdxl models", async () => {
      mockLoadModelCatalog.mockResolvedValue([SDXL_MODEL]);
      const result = await checkModalityCapability("image-generation");
      expect(result.hasCapability).toBe(true);
    });

    it("detects midjourney models", async () => {
      mockLoadModelCatalog.mockResolvedValue([MIDJOURNEY_MODEL]);
      const result = await checkModalityCapability("image-generation");
      expect(result.hasCapability).toBe(true);
    });

    it("detects ernie-vilg (百度文心一格) models", async () => {
      const ernie = makeModel({ id: "ernie-vilg-v2", provider: "baidu" });
      mockLoadModelCatalog.mockResolvedValue([ernie]);
      const result = await checkModalityCapability("image-generation");
      expect(result.hasCapability).toBe(true);
    });

    it("does not false-positive on text-only models", async () => {
      mockLoadModelCatalog.mockResolvedValue([TEXT_ONLY_MODEL, VISION_MODEL]);
      const result = await checkModalityCapability("image-generation");
      expect(result.hasCapability).toBe(false);
      expect(result.suggestion).toContain("图片生成");
    });

    it("does not false-positive on models with 'sd' in the middle of id", async () => {
      const falsePositive = makeModel({ id: "qwen-sd-turbo", provider: "dashscope" });
      mockLoadModelCatalog.mockResolvedValue([falsePositive]);
      const result = await checkModalityCapability("image-generation");
      expect(result.hasCapability).toBe(false);
    });

    it("detects models starting with sd-", async () => {
      const sdModel = makeModel({ id: "sd-turbo", provider: "stabilityai" });
      mockLoadModelCatalog.mockResolvedValue([sdModel]);
      const result = await checkModalityCapability("image-generation");
      expect(result.hasCapability).toBe(true);
    });
  });

  describe("video-analysis", () => {
    it("detects video models via input field", async () => {
      mockLoadModelCatalog.mockResolvedValue([VIDEO_MODEL, TEXT_ONLY_MODEL]);
      const result = await checkModalityCapability("video-analysis");
      expect(result.hasCapability).toBe(true);
      expect(result.availableModels[0].id).toBe("doubao-seed-1-8");
    });

    it("returns false when no video models configured", async () => {
      mockLoadModelCatalog.mockResolvedValue([TEXT_ONLY_MODEL, VISION_MODEL]);
      const result = await checkModalityCapability("video-analysis");
      expect(result.hasCapability).toBe(false);
      expect(result.suggestion).toContain("视频分析");
    });

    it("does not false-positive on model names containing 'video'", async () => {
      // supportsVideoAnalysis only checks input field, not model name
      const falsePositive = makeModel({
        id: "video-encoder",
        provider: "tools",
        input: ["text"],
      });
      mockLoadModelCatalog.mockResolvedValue([falsePositive]);
      const result = await checkModalityCapability("video-analysis");
      expect(result.hasCapability).toBe(false);
    });
  });

  it("throws on unknown capability", async () => {
    mockLoadModelCatalog.mockResolvedValue([]);
    await expect(checkModalityCapability("unknown" as "image-analysis")).rejects.toThrow(
      "Unknown capability",
    );
  });

  it("always includes capability field in result", async () => {
    mockLoadModelCatalog.mockResolvedValue([]);
    const result = await checkModalityCapability("image-analysis");
    expect(result.capability).toBe("image-analysis");
  });
});

// ---------------------------------------------------------------------------
// Tests: checkMultipleCapabilities
// ---------------------------------------------------------------------------

describe("checkMultipleCapabilities", () => {
  it("checks multiple capabilities in one call", async () => {
    mockLoadModelCatalog.mockResolvedValue([VISION_MODEL, DALLE_MODEL]);
    const results = await checkMultipleCapabilities(["image-analysis", "image-generation"]);
    expect(results).toHaveLength(2);
    expect(results[0].capability).toBe("image-analysis");
    expect(results[0].hasCapability).toBe(true);
    expect(results[1].capability).toBe("image-generation");
    expect(results[1].hasCapability).toBe(true);
  });

  it("loads catalog only once for batch check", async () => {
    mockLoadModelCatalog.mockResolvedValue([TEXT_ONLY_MODEL]);
    await checkMultipleCapabilities(["image-analysis", "image-generation", "video-analysis"]);
    expect(mockLoadModelCatalog).toHaveBeenCalledTimes(1);
  });

  it("returns all missing when no models match", async () => {
    mockLoadModelCatalog.mockResolvedValue([TEXT_ONLY_MODEL]);
    const results = await checkMultipleCapabilities(["image-analysis", "image-generation"]);
    expect(results.every((r) => !r.hasCapability)).toBe(true);
  });

  it("returns empty array for empty capabilities list", async () => {
    mockLoadModelCatalog.mockResolvedValue([TEXT_ONLY_MODEL]);
    const results = await checkMultipleCapabilities([]);
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: getConfigSuggestions
// ---------------------------------------------------------------------------

describe("getConfigSuggestions", () => {
  it("returns empty when all capabilities available", () => {
    const results: CapabilityCheckResult[] = [
      {
        capability: "image-analysis",
        hasCapability: true,
        availableModels: [{ id: "m", name: "m", provider: "p" }],
      },
      {
        capability: "image-generation",
        hasCapability: true,
        availableModels: [{ id: "m", name: "m", provider: "p" }],
      },
    ];
    const { missingCapabilities, suggestions } = getConfigSuggestions(results);
    expect(missingCapabilities).toHaveLength(0);
    expect(suggestions).toHaveLength(0);
  });

  it("returns suggestion for missing image-analysis", () => {
    const results: CapabilityCheckResult[] = [
      { capability: "image-analysis", hasCapability: false, availableModels: [] },
    ];
    const { missingCapabilities, suggestions } = getConfigSuggestions(results);
    expect(missingCapabilities).toEqual(["image-analysis"]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toContain("qwen-vl-max");
    expect(suggestions[0]).toContain("gpt-4-vision");
  });

  it("returns suggestion for missing image-generation", () => {
    const results: CapabilityCheckResult[] = [
      { capability: "image-generation", hasCapability: false, availableModels: [] },
    ];
    const { missingCapabilities, suggestions } = getConfigSuggestions(results);
    expect(missingCapabilities).toEqual(["image-generation"]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toContain("dall-e-3");
  });

  it("returns suggestion for missing video-analysis", () => {
    const results: CapabilityCheckResult[] = [
      { capability: "video-analysis", hasCapability: false, availableModels: [] },
    ];
    const { missingCapabilities, suggestions } = getConfigSuggestions(results);
    expect(missingCapabilities).toEqual(["video-analysis"]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toContain("doubao-seed-1-8");
  });

  it("returns multiple suggestions for multiple missing capabilities", () => {
    const results: CapabilityCheckResult[] = [
      { capability: "image-analysis", hasCapability: false, availableModels: [] },
      {
        capability: "image-generation",
        hasCapability: true,
        availableModels: [{ id: "m", name: "m", provider: "p" }],
      },
      { capability: "video-analysis", hasCapability: false, availableModels: [] },
    ];
    const { missingCapabilities, suggestions } = getConfigSuggestions(results);
    expect(missingCapabilities).toEqual(["image-analysis", "video-analysis"]);
    expect(suggestions).toHaveLength(2);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { GatewayRequestHandlerOptions, RespondFn } from "./types.js";

// Mock the capability checker module
const mocks = vi.hoisted(() => ({
  checkModalityCapability: vi.fn(),
  checkMultipleCapabilities: vi.fn(),
  getConfigSuggestions: vi.fn(),
  loadConfig: vi.fn(() => ({})),
}));

vi.mock("../../agents/modality-capability-checker.js", () => ({
  checkModalityCapability: mocks.checkModalityCapability,
  checkMultipleCapabilities: mocks.checkMultipleCapabilities,
  getConfigSuggestions: mocks.getConfigSuggestions,
}));

vi.mock("../../config/config.js", () => ({
  loadConfig: mocks.loadConfig,
  withConfigWriteLock: async (fn: () => Promise<unknown>) => fn(),
}));

import { modalityCapabilityHandlers } from "./modality-capability.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeHandlerOpts(
  method: string,
  params: Record<string, unknown>,
): { opts: GatewayRequestHandlerOptions; respond: RespondFn & ReturnType<typeof vi.fn> } {
  const respond = vi.fn() as RespondFn & ReturnType<typeof vi.fn>;
  return {
    opts: {
      req: { type: "req" as const, id: "test-1", method },
      params,
      client: null,
      isWebchatConnect: () => false,
      respond,
      context: {} as GatewayRequestHandlerOptions["context"],
    },
    respond,
  };
}

// ---------------------------------------------------------------------------
// Tests: modality.check
// ---------------------------------------------------------------------------

describe("modality.check handler", () => {
  it("returns error when capability param is missing", async () => {
    const { opts, respond } = makeHandlerOpts("modality.check", {});
    await modalityCapabilityHandlers["modality.check"](opts);
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("Missing parameter"),
      }),
    );
  });

  it("returns error for invalid capability value", async () => {
    const { opts, respond } = makeHandlerOpts("modality.check", { capability: "invalid" });
    await modalityCapabilityHandlers["modality.check"](opts);
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("Invalid capability"),
      }),
    );
  });

  it("returns capability check result for valid capability", async () => {
    const checkResult = {
      capability: "image-analysis",
      hasCapability: true,
      availableModels: [{ id: "qwen-vl-max", name: "Qwen VL Max", provider: "dashscope" }],
    };
    mocks.checkModalityCapability.mockResolvedValue(checkResult);

    const { opts, respond } = makeHandlerOpts("modality.check", { capability: "image-analysis" });
    await modalityCapabilityHandlers["modality.check"](opts);
    expect(respond).toHaveBeenCalledWith(true, checkResult, undefined);
  });

  it("returns unavailable error on internal failure", async () => {
    mocks.checkModalityCapability.mockRejectedValue(new Error("catalog load failed"));

    const { opts, respond } = makeHandlerOpts("modality.check", { capability: "image-analysis" });
    await modalityCapabilityHandlers["modality.check"](opts);
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("catalog load failed"),
      }),
    );
  });

  it("accepts all three valid capability types", async () => {
    mocks.checkModalityCapability.mockResolvedValue({ hasCapability: false, availableModels: [] });

    for (const cap of ["image-analysis", "image-generation", "video-analysis"]) {
      const { opts, respond } = makeHandlerOpts("modality.check", { capability: cap });
      await modalityCapabilityHandlers["modality.check"](opts);
      expect(respond).toHaveBeenCalledWith(true, expect.anything(), undefined);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: modality.checkMultiple
// ---------------------------------------------------------------------------

describe("modality.checkMultiple handler", () => {
  it("returns error when capabilities param is missing", async () => {
    const { opts, respond } = makeHandlerOpts("modality.checkMultiple", {});
    await modalityCapabilityHandlers["modality.checkMultiple"](opts);
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("Missing or invalid parameter"),
      }),
    );
  });

  it("returns error when capabilities is not an array", async () => {
    const { opts, respond } = makeHandlerOpts("modality.checkMultiple", {
      capabilities: "image-analysis",
    });
    await modalityCapabilityHandlers["modality.checkMultiple"](opts);
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("Missing or invalid parameter"),
      }),
    );
  });

  it("returns combined results with suggestions", async () => {
    const results = [
      { capability: "image-analysis", hasCapability: false, availableModels: [] },
      {
        capability: "image-generation",
        hasCapability: true,
        availableModels: [{ id: "dall-e-3" }],
      },
    ];
    mocks.checkMultipleCapabilities.mockResolvedValue(results);
    mocks.getConfigSuggestions.mockReturnValue({
      missingCapabilities: ["image-analysis"],
      suggestions: ["Install vision model"],
    });

    const { opts, respond } = makeHandlerOpts("modality.checkMultiple", {
      capabilities: ["image-analysis", "image-generation"],
    });
    await modalityCapabilityHandlers["modality.checkMultiple"](opts);
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        results,
        missingCapabilities: ["image-analysis"],
        suggestions: ["Install vision model"],
      },
      undefined,
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: modality.detectIntent
// ---------------------------------------------------------------------------

describe("modality.detectIntent handler", () => {
  it("returns no intent for plain text prompt without attachments", async () => {
    const { opts, respond } = makeHandlerOpts("modality.detectIntent", {
      prompt: "你好世界",
      hasAttachments: false,
      attachmentTypes: [],
    });
    await modalityCapabilityHandlers["modality.detectIntent"](opts);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        detectedIntent: null,
        needsConfiguration: false,
        requiredCapabilities: [],
      }),
      undefined,
    );
  });

  it("detects image-analysis for image attachments", async () => {
    const results = [{ capability: "image-analysis", hasCapability: false, availableModels: [] }];
    mocks.checkMultipleCapabilities.mockResolvedValue(results);
    mocks.getConfigSuggestions.mockReturnValue({
      missingCapabilities: ["image-analysis"],
      suggestions: ["Config vision model"],
    });

    const { opts, respond } = makeHandlerOpts("modality.detectIntent", {
      prompt: "这张图里有什么",
      hasAttachments: true,
      attachmentTypes: ["image/jpeg"],
    });
    await modalityCapabilityHandlers["modality.detectIntent"](opts);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        detectedIntent: "image-analysis",
        requiredCapabilities: ["image-analysis"],
        needsConfiguration: true,
      }),
      undefined,
    );
  });

  it("detects video-analysis for video attachments", async () => {
    const results = [{ capability: "video-analysis", hasCapability: false, availableModels: [] }];
    mocks.checkMultipleCapabilities.mockResolvedValue(results);
    mocks.getConfigSuggestions.mockReturnValue({
      missingCapabilities: ["video-analysis"],
      suggestions: ["Config video model"],
    });

    const { opts, respond } = makeHandlerOpts("modality.detectIntent", {
      prompt: "分析这个视频",
      hasAttachments: true,
      attachmentTypes: ["video/mp4"],
    });
    await modalityCapabilityHandlers["modality.detectIntent"](opts);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        detectedIntent: "video-analysis",
        requiredCapabilities: ["video-analysis"],
      }),
      undefined,
    );
  });

  it("detects image-generation for '画一张' keyword", async () => {
    const results = [
      {
        capability: "image-generation",
        hasCapability: true,
        availableModels: [{ id: "dall-e-3" }],
      },
    ];
    mocks.checkMultipleCapabilities.mockResolvedValue(results);
    mocks.getConfigSuggestions.mockReturnValue({ missingCapabilities: [], suggestions: [] });

    const { opts, respond } = makeHandlerOpts("modality.detectIntent", {
      prompt: "帮我画一张猫咪的图片",
      hasAttachments: false,
      attachmentTypes: [],
    });
    await modalityCapabilityHandlers["modality.detectIntent"](opts);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        detectedIntent: "image-generation",
        requiredCapabilities: ["image-generation"],
        needsConfiguration: false,
      }),
      undefined,
    );
  });

  it("detects image-generation for '生成图片' keyword", async () => {
    const results = [{ capability: "image-generation", hasCapability: false, availableModels: [] }];
    mocks.checkMultipleCapabilities.mockResolvedValue(results);
    mocks.getConfigSuggestions.mockReturnValue({
      missingCapabilities: ["image-generation"],
      suggestions: [],
    });

    const { opts, respond } = makeHandlerOpts("modality.detectIntent", {
      prompt: "请帮我生成图片",
      hasAttachments: false,
      attachmentTypes: [],
    });
    await modalityCapabilityHandlers["modality.detectIntent"](opts);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        detectedIntent: "image-generation",
        needsConfiguration: true,
      }),
      undefined,
    );
  });

  it("detects image-generation for English keywords", async () => {
    const results = [{ capability: "image-generation", hasCapability: true, availableModels: [] }];
    mocks.checkMultipleCapabilities.mockResolvedValue(results);
    mocks.getConfigSuggestions.mockReturnValue({ missingCapabilities: [], suggestions: [] });

    const { opts, respond } = makeHandlerOpts("modality.detectIntent", {
      prompt: "Please draw a cat for me",
      hasAttachments: false,
      attachmentTypes: [],
    });
    await modalityCapabilityHandlers["modality.detectIntent"](opts);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        detectedIntent: "image-generation",
        requiredCapabilities: ["image-generation"],
      }),
      undefined,
    );
  });

  it("detects multiple capabilities (image attachment + generate keyword)", async () => {
    const results = [
      { capability: "image-analysis", hasCapability: true, availableModels: [] },
      { capability: "image-generation", hasCapability: false, availableModels: [] },
    ];
    mocks.checkMultipleCapabilities.mockResolvedValue(results);
    mocks.getConfigSuggestions.mockReturnValue({
      missingCapabilities: ["image-generation"],
      suggestions: [],
    });

    const { opts, respond } = makeHandlerOpts("modality.detectIntent", {
      prompt: "参考这张图，帮我画一张类似的",
      hasAttachments: true,
      attachmentTypes: ["image/png"],
    });
    await modalityCapabilityHandlers["modality.detectIntent"](opts);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        requiredCapabilities: expect.arrayContaining(["image-analysis", "image-generation"]),
      }),
      undefined,
    );
  });

  it("uses default values when params are omitted", async () => {
    const { opts, respond } = makeHandlerOpts("modality.detectIntent", {});
    await modalityCapabilityHandlers["modality.detectIntent"](opts);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        detectedIntent: null,
        needsConfiguration: false,
      }),
      undefined,
    );
  });
});

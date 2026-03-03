/**
 * Tests for image-gen-tool — Phase 3.
 *
 * Tests:
 * - Tool factory creates correct structure (name, description, parameters)
 * - Execute returns error when prompt is empty
 * - Execute returns error when no image gen model is configured
 * - Provider routing (resolveImageGenProvider)
 * - DashScope size conversion
 * - Provider handler HTTP error handling
 * - Provider handler response parsing
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — set up before import
// ---------------------------------------------------------------------------

// Mock external dependencies that image-gen-tool imports
vi.mock("../model-auth.js", () => ({
  getApiKeyForModel: vi.fn().mockResolvedValue({ apiKey: "sk-test-key" }),
  requireApiKey: vi.fn().mockReturnValue("sk-test-key"),
}));

vi.mock("../auth-profiles.js", () => ({
  ensureAuthProfileStore: vi.fn(),
}));

vi.mock("../models-config.js", () => ({
  ensureOpenClawCNModelsJson: vi.fn().mockResolvedValue(null),
}));

vi.mock("../pi-model-discovery.js", () => ({
  discoverAuthStorage: vi.fn().mockReturnValue({ dir: "/fake/auth" }),
  discoverModels: vi.fn().mockReturnValue({ getAll: () => [] }),
}));

vi.mock("../model-selection.js", () => ({
  resolveConfiguredModelRef: vi.fn(),
}));

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../media/chat-image-store.js", () => ({
  saveGeneratedImage: vi.fn().mockResolvedValue(null),
}));

const { createImageGenTool } = await import("./image-gen-tool.js");
const { ensureOpenClawCNModelsJson } = await import("../models-config.js");
const { discoverModels, discoverAuthStorage } = await import("../pi-model-discovery.js");

const mockEnsureModels = vi.mocked(ensureOpenClawCNModelsJson);
const mockDiscoverModels = vi.mocked(discoverModels);
const mockDiscoverAuthStorage = vi.mocked(discoverAuthStorage);

/**
 * Create a fetch mock that rejects the sd.cpp sidecar health check
 * (localhost:50200/health) but delegates to the provided handler for
 * all other URLs, simulating a cloud-only environment.
 */
function mockFetchNoSidecar(
  handler: (url: string | URL | Request, init?: RequestInit) => Promise<Response>,
) {
  return vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr =
      typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url;
    if (urlStr.includes("127.0.0.1") || urlStr.includes("localhost")) {
      return Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:50200"));
    }
    return handler(urlStr, init);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEnsureModels.mockResolvedValue(null);
  mockDiscoverAuthStorage.mockReturnValue({ dir: "/fake/auth" });
  mockDiscoverModels.mockReturnValue({ getAll: () => [] });
});

// ---------------------------------------------------------------------------
// Tool structure tests
// ---------------------------------------------------------------------------

describe("createImageGenTool", () => {
  it("returns a tool with correct name and label", () => {
    const tool = createImageGenTool();
    expect(tool.name).toBe("image_gen");
    expect(tool.label).toBe("Image Generation");
  });

  it("has a descriptive description", () => {
    const tool = createImageGenTool();
    expect(tool.description).toContain("Generate images");
    expect(tool.description).toContain("text descriptions");
  });

  it("has required prompt parameter", () => {
    const tool = createImageGenTool();
    const schema = tool.parameters as Record<string, unknown>;
    expect(schema).toBeDefined();
    // TypeBox schema has properties
    const props = (schema as { properties?: Record<string, unknown> }).properties;
    expect(props).toBeDefined();
    expect(props!.prompt).toBeDefined();
  });

  it("has optional size and style parameters", () => {
    const tool = createImageGenTool();
    const schema = tool.parameters as Record<string, unknown>;
    const required = (schema as { required?: string[] }).required;
    // Only prompt should be required
    expect(required).toContain("prompt");
    // size and style should not be required
    if (required) {
      expect(required).not.toContain("size");
      expect(required).not.toContain("style");
    }
  });
});

// ---------------------------------------------------------------------------
// Execute tests
// ---------------------------------------------------------------------------

describe("image_gen execute", () => {
  it("returns error when prompt is empty", async () => {
    const tool = createImageGenTool();
    const result = await tool.execute("call-1", { prompt: "" });

    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain("prompt is required");
    expect(result.details).toEqual({ error: "missing_prompt" });
  });

  it("returns error when prompt is whitespace only", async () => {
    const tool = createImageGenTool();
    const result = await tool.execute("call-2", { prompt: "   " });

    expect(result.content[0].text).toContain("prompt is required");
  });

  it("returns error when args is null/undefined", async () => {
    const tool = createImageGenTool();
    const result = await tool.execute("call-3", null);

    expect(result.content[0].text).toContain("prompt is required");
  });

  it("returns error when no image gen model is configured", async () => {
    mockEnsureModels.mockResolvedValue({});
    mockDiscoverModels.mockReturnValue({
      getAll: () =>
        [
          { id: "gpt-4", provider: "openai", name: "GPT-4" },
          { id: "qwen-max", provider: "dashscope", name: "Qwen Max" },
        ] as unknown[],
    });

    const tool = createImageGenTool({ agentDir: "/fake/dir", config: {} as never });
    const result = await tool.execute("call-4", { prompt: "a cat" });

    expect(result.content[0].text).toContain("No image generation model configured");
  });

  it("recognizes dall-e model as image gen capable", async () => {
    mockEnsureModels.mockResolvedValue({});
    mockDiscoverModels.mockReturnValue({
      getAll: () =>
        [
          {
            id: "dall-e-3",
            provider: "openai",
            name: "DALL-E 3",
            baseUrl: "https://api.openai.com",
          },
        ] as unknown[],
    });

    // Mock fetch: reject sidecar health check, succeed for OpenAI API
    const mf = mockFetchNoSidecar(
      async () =>
        ({
          ok: true,
          json: async () => ({
            data: [{ b64_json: "AAAA".repeat(50), revised_prompt: "a cute cat" }],
          }),
        }) as unknown as Response,
    );
    vi.stubGlobal("fetch", mf);

    const tool = createImageGenTool({ agentDir: "/fake/dir", config: {} as never });
    const result = await tool.execute("call-5", { prompt: "a cat" });

    expect(result.content[0].text).toContain("Image generated successfully");
    expect(result.details).toBeDefined();
    // imageUrl may be original data URL or a persisted path (mock returns null = original)
    const imageUrl = (result.details as Record<string, unknown>).imageUrl as string;
    expect(imageUrl).toMatch(/data:image\/png;base64,|\/api\/media\//);

    vi.unstubAllGlobals();
  });

  it("recognizes wanx model as image gen capable", async () => {
    mockEnsureModels.mockResolvedValue({});
    mockDiscoverModels.mockReturnValue({
      getAll: () => [{ id: "wanx-v1", provider: "dashscope", name: "通义万相" }] as unknown[],
    });

    const tool = createImageGenTool({ agentDir: "/fake/dir", config: {} as never });

    // Mock DashScope async task flow (first call is sidecar health check which should fail)
    let callIdx = 0;
    const mf = vi.fn((url: string | URL | Request) => {
      const urlStr =
        typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes("127.0.0.1") || urlStr.includes("localhost")) {
        return Promise.reject(new Error("connect ECONNREFUSED"));
      }
      callIdx++;
      if (callIdx === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            output: { task_id: "task-123", task_status: "PENDING" },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          output: {
            task_status: "SUCCEEDED",
            results: [{ url: "https://dashscope.example.com/result.png" }],
          },
        }),
      });
    });
    vi.stubGlobal("fetch", mf);

    const result = await tool.execute("call-6", { prompt: "一只猫" });

    expect(result.content[0].text).toContain("Image generated successfully");
    // imageUrl may be the original URL or a persisted path
    const imageUrl = (result.details as Record<string, unknown>).imageUrl as string;
    expect(imageUrl).toBeDefined();

    vi.unstubAllGlobals();
  });

  it("recognizes flux model as image gen capable", async () => {
    mockEnsureModels.mockResolvedValue({});
    mockDiscoverModels.mockReturnValue({
      getAll: () =>
        [
          {
            id: "flux-1-schnell",
            provider: "siliconflow",
            name: "Flux",
            baseUrl: "https://api.siliconflow.cn",
          },
        ] as unknown[],
    });

    const mf = mockFetchNoSidecar(
      async () =>
        ({
          ok: true,
          json: async () => ({
            images: [{ url: "https://sf.example.com/flux-result.png" }],
          }),
        }) as unknown as Response,
    );
    vi.stubGlobal("fetch", mf);

    const tool = createImageGenTool({ agentDir: "/fake/dir", config: {} as never });
    const result = await tool.execute("call-7", { prompt: "a dog" });

    expect(result.content[0].text).toContain("Image generated successfully");

    vi.unstubAllGlobals();
  });

  it("handles API error gracefully", async () => {
    mockEnsureModels.mockResolvedValue({});
    mockDiscoverModels.mockReturnValue({
      getAll: () =>
        [
          {
            id: "dall-e-3",
            provider: "openai",
            name: "DALL-E 3",
            baseUrl: "https://api.openai.com",
          },
        ] as unknown[],
    });

    const mf = mockFetchNoSidecar(
      async () =>
        ({
          ok: false,
          status: 429,
          text: async () => "Rate limited",
        }) as unknown as Response,
    );
    vi.stubGlobal("fetch", mf);

    const tool = createImageGenTool({ agentDir: "/fake/dir", config: {} as never });
    const result = await tool.execute("call-err", { prompt: "a cat" });

    expect(result.content[0].text).toContain("Image generation failed");
    expect(result.content[0].text).toContain("429");
    expect((result.details as Record<string, unknown>).error).toBeDefined();

    vi.unstubAllGlobals();
  });

  it("defaults size to 1024x1024 and style to vivid", async () => {
    mockEnsureModels.mockResolvedValue({});
    mockDiscoverModels.mockReturnValue({
      getAll: () =>
        [
          {
            id: "dall-e-3",
            provider: "openai",
            name: "DALL-E 3",
            baseUrl: "https://api.openai.com",
          },
        ] as unknown[],
    });

    const mf = mockFetchNoSidecar(
      async (_url: string, init?: RequestInit) =>
        ({
          ok: true,
          json: async () => ({
            data: [{ b64_json: "AAAA".repeat(50) }],
          }),
        }) as unknown as Response,
    );
    vi.stubGlobal("fetch", mf);

    const tool = createImageGenTool({ agentDir: "/fake/dir", config: {} as never });
    await tool.execute("call-defaults", { prompt: "a sunset" });

    // Find the actual API call (skip sidecar health check rejections)
    const apiCall = mf.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && !c[0].toString().includes("127.0.0.1"),
    );
    expect(apiCall).toBeDefined();
    const fetchBody = JSON.parse(apiCall![1].body);
    expect(fetchBody.size).toBe("1024x1024");
    expect(fetchBody.style).toBe("vivid");

    vi.unstubAllGlobals();
  });

  it("uses custom size when provided", async () => {
    mockEnsureModels.mockResolvedValue({});
    mockDiscoverModels.mockReturnValue({
      getAll: () =>
        [
          {
            id: "dall-e-3",
            provider: "openai",
            name: "DALL-E 3",
            baseUrl: "https://api.openai.com",
          },
        ] as unknown[],
    });

    const mf = mockFetchNoSidecar(
      async () =>
        ({
          ok: true,
          json: async () => ({
            data: [{ b64_json: "BBBB".repeat(50) }],
          }),
        }) as unknown as Response,
    );
    vi.stubGlobal("fetch", mf);

    const tool = createImageGenTool({ agentDir: "/fake/dir", config: {} as never });
    await tool.execute("call-custom-size", {
      prompt: "landscape",
      size: "1792x1024",
    });

    const apiCall = mf.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && !c[0].toString().includes("127.0.0.1"),
    );
    expect(apiCall).toBeDefined();
    const fetchBody = JSON.parse(apiCall![1].body);
    expect(fetchBody.size).toBe("1792x1024");

    vi.unstubAllGlobals();
  });

  it("includes revised_prompt in response when available", async () => {
    mockEnsureModels.mockResolvedValue({});
    mockDiscoverModels.mockReturnValue({
      getAll: () =>
        [
          {
            id: "dall-e-3",
            provider: "openai",
            name: "DALL-E 3",
            baseUrl: "https://api.openai.com",
          },
        ] as unknown[],
    });

    const mf = mockFetchNoSidecar(
      async () =>
        ({
          ok: true,
          json: async () => ({
            data: [
              {
                b64_json: "CCCC".repeat(50),
                revised_prompt: "A fluffy orange tabby cat sitting on a windowsill",
              },
            ],
          }),
        }) as unknown as Response,
    );
    vi.stubGlobal("fetch", mf);

    const tool = createImageGenTool({ agentDir: "/fake/dir", config: {} as never });
    const result = await tool.execute("call-revised", { prompt: "a cat" });

    // revised_prompt appears in the response text (may be in content[0] or concatenated)
    const allText = result.content.map((c: { text?: string }) => c.text ?? "").join("\n");
    expect(allText).toContain("Revised prompt:");
    expect((result.details as Record<string, unknown>).revisedPrompt).toBe(
      "A fluffy orange tabby cat sitting on a windowsill",
    );

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// DashScope size conversion
// ---------------------------------------------------------------------------

describe("DashScope size conversion", () => {
  it("converts standard sizes to DashScope format", async () => {
    mockEnsureModels.mockResolvedValue({});
    mockDiscoverModels.mockReturnValue({
      getAll: () => [{ id: "wanx-v1", provider: "dashscope", name: "Wanx" }] as unknown[],
    });

    let callIdx = 0;
    const mf = vi.fn((url: string | URL | Request) => {
      const urlStr =
        typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes("127.0.0.1") || urlStr.includes("localhost")) {
        return Promise.reject(new Error("connect ECONNREFUSED"));
      }
      callIdx++;
      if (callIdx === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            output: { task_id: "t-1", task_status: "PENDING" },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          output: {
            task_status: "SUCCEEDED",
            results: [{ url: "https://example.com/img.png" }],
          },
        }),
      });
    });
    vi.stubGlobal("fetch", mf);

    const tool = createImageGenTool({ agentDir: "/fake/dir", config: {} as never });
    await tool.execute("call-ds-size", { prompt: "test", size: "1024x1024" });

    // DashScope uses * instead of x — find the submit call (non-localhost, with body)
    const submitCall = mf.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" && !c[0].toString().includes("127.0.0.1") && c[1]?.body,
    );
    expect(submitCall).toBeDefined();
    const submitBody = JSON.parse(submitCall![1].body);
    expect(submitBody.parameters.size).toBe("1024*1024");

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// Model detection patterns
// ---------------------------------------------------------------------------

describe("model detection patterns", () => {
  const modelPatterns = [
    { id: "dall-e-3", expected: true },
    { id: "gpt-image-1", expected: true },
    { id: "wanx-v1", expected: true },
    { id: "wan-x-large", expected: true },
    { id: "stable-diffusion-xl", expected: true },
    { id: "sd-turbo", expected: true },
    { id: "sdxl-lightning", expected: true },
    { id: "flux-1-schnell", expected: true },
    { id: "midjourney-v5", expected: true },
    { id: "gpt-4o", expected: false },
    { id: "qwen-max", expected: false },
    { id: "claude-3-opus", expected: false },
    { id: "deepseek-v2", expected: false },
  ];

  for (const { id, expected } of modelPatterns) {
    it(`${expected ? "recognizes" : "skips"} model "${id}"`, async () => {
      mockEnsureModels.mockResolvedValue({});
      mockDiscoverModels.mockReturnValue({
        getAll: () =>
          [{ id, provider: "test", name: id, baseUrl: "https://test.api.com" }] as unknown[],
      });

      if (expected) {
        // Mock successful generation for recognized models (skip sidecar check)
        const mf = mockFetchNoSidecar(
          async () =>
            ({
              ok: true,
              json: async () => ({
                data: [{ b64_json: "DDDD".repeat(50) }],
              }),
            }) as unknown as Response,
        );
        vi.stubGlobal("fetch", mf);
      }

      const tool = createImageGenTool({ agentDir: "/fake/dir", config: {} as never });
      const result = await tool.execute(`detect-${id}`, { prompt: "test" });

      if (expected) {
        expect(result.content[0].text).not.toContain("No image generation model configured");
      } else {
        expect(result.content[0].text).toContain("No image generation model configured");
      }

      vi.unstubAllGlobals();
    });
  }
});

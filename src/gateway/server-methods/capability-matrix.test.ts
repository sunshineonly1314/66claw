/**
 * capability-matrix v2 Gateway API 测试
 *
 * 覆盖所有 16 个 handler 的:
 * - 正常路径（happy path）
 * - 参数验证（缺参 / 非法值 → INVALID_REQUEST）
 * - 错误传播（delegate 抛异常 → UNAVAILABLE）
 * - summary handler 的复杂逻辑: 用户选择、alias 匹配、synthetic card 构造
 * - detect handler 的广播机制
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { GatewayRequestHandlerOptions, GatewayClient } from "./types.js";

// ---------------------------------------------------------------------------
// Mock declarations (persistent refs)
// ---------------------------------------------------------------------------

// dispatch/index mocks
const mockGetCapabilityMatrixSummary = vi.fn();
const mockQueryByCapability = vi.fn(() => []);
const mockGetProviderCapabilities = vi.fn(() => []);
const mockGetAllCards = vi.fn(() => []);
const mockGetAllCapabilityKeys = vi.fn(() => [
  "text",
  "code",
  "vision",
  "imageGen",
  "video",
  "videoGen",
  "audio",
  "tts",
  "embedding",
  "toolCall",
]);
const mockTriggerRemoteFetch = vi.fn(async () => ({ success: true }));

// config/config mocks
const mockLoadConfig = vi.fn(async () => ({}));

// agents/model-selection mocks
const mockGetProviderAliases = vi.fn((id: string) => [id]);

// model-config.js v1 delegate mocks
const mockGetCapabilityModels = vi.fn(async () => ({ models: [] }));
const mockSwitchCapabilityModel = vi.fn(async () => ({ success: true }));
const mockDetectProviderModelsWithProgress = vi.fn(async () => {});
const mockListProviders = vi.fn(async () => ({ providers: [] }));
const mockGetProviderConfig = vi.fn(async () => ({ configured: false }));
const mockDeleteProviderConfig = vi.fn(async () => ({ success: true }));
const mockAddCustomModel = vi.fn(async () => ({ success: true }));
const mockGetProvidersHealth = vi.fn(async () => ({ providers: [] }));
const mockTestProviderConnection = vi.fn(async () => ({ ok: true }));
const mockSaveProviderPriority = vi.fn(async () => ({ success: true }));
const mockGetProviderPriority = vi.fn(async () => ({ priority: [] }));

// provider-capability-mapping mocks — must use vi.hoisted because vi.mock is hoisted above const
const { MOCK_PROVIDER_GROUPS, MOCK_PROVIDER_CAPABILITY_MAPPINGS } = vi.hoisted(() => ({
  MOCK_PROVIDER_GROUPS: [{ id: "domestic", name: "国内服务商" }] as Array<{
    id: string;
    name: string;
  }>,
  MOCK_PROVIDER_CAPABILITY_MAPPINGS: {
    siliconflow: { models: [{ modelId: "Qwen/Qwen2.5-72B-Instruct" }] },
  } as Record<string, { models: Array<{ modelId: string }> }>,
}));

// ---------------------------------------------------------------------------
// vi.mock setup
// ---------------------------------------------------------------------------

vi.mock("../../dispatch/index.js", () => ({
  getCapabilityMatrixSummary: (...a: unknown[]) => mockGetCapabilityMatrixSummary(...a),
  queryByCapability: (...a: unknown[]) => mockQueryByCapability(...a),
  getProviderCapabilities: (...a: unknown[]) => mockGetProviderCapabilities(...a),
  getAllCards: (...a: unknown[]) => mockGetAllCards(...a),
  getAllCapabilityKeys: (...a: unknown[]) => mockGetAllCapabilityKeys(...a),
  triggerRemoteFetch: (...a: unknown[]) => mockTriggerRemoteFetch(...a),
}));

vi.mock("../../config/config.js", () => ({
  loadConfig: (...a: unknown[]) => mockLoadConfig(...a),
  withConfigWriteLock: async (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("../../agents/model-selection.js", () => ({
  getProviderAliases: (...a: unknown[]) => mockGetProviderAliases(...a),
}));

vi.mock("./model-config.js", () => ({
  getCapabilityModels: (...a: unknown[]) => mockGetCapabilityModels(...a),
  switchCapabilityModel: (...a: unknown[]) => mockSwitchCapabilityModel(...a),
  detectProviderModelsWithProgress: (...a: unknown[]) => mockDetectProviderModelsWithProgress(...a),
  listProviders: (...a: unknown[]) => mockListProviders(...a),
  getProviderConfig: (...a: unknown[]) => mockGetProviderConfig(...a),
  deleteProviderConfig: (...a: unknown[]) => mockDeleteProviderConfig(...a),
  addCustomModel: (...a: unknown[]) => mockAddCustomModel(...a),
  getProvidersHealth: (...a: unknown[]) => mockGetProvidersHealth(...a),
  testProviderConnection: (...a: unknown[]) => mockTestProviderConnection(...a),
  saveProviderPriority: (...a: unknown[]) => mockSaveProviderPriority(...a),
  getProviderPriority: (...a: unknown[]) => mockGetProviderPriority(...a),
}));

vi.mock("../../config/provider-capability-mapping.js", () => ({
  PROVIDER_GROUPS: MOCK_PROVIDER_GROUPS,
  PROVIDER_CAPABILITY_MAPPINGS: MOCK_PROVIDER_CAPABILITY_MAPPINGS,
}));

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import { capabilityMatrixHandlers } from "./capability-matrix.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeOpts(
  method: string,
  params: Record<string, unknown> = {},
  clientOverride?: Partial<GatewayClient> | null,
) {
  const respond = vi.fn();
  const broadcast = vi.fn();
  const broadcastToConnIds = vi.fn();

  const client =
    clientOverride === null
      ? null
      : { connect: {} as GatewayClient["connect"], connId: "test-conn", ...clientOverride };

  const context = {
    broadcast,
    broadcastToConnIds,
  } as unknown as GatewayRequestHandlerOptions["context"];

  const opts: GatewayRequestHandlerOptions = {
    req: { type: "req" as const, id: "test-1", method } as GatewayRequestHandlerOptions["req"],
    params,
    client,
    isWebchatConnect: () => false,
    respond,
    context,
  };

  return { opts, respond, broadcast, broadcastToConnIds };
}

/** Helper: build a minimal EnrichedCard. */
function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    provider: "siliconflow",
    modelId: "Qwen/Qwen2.5-72B-Instruct",
    displayName: "Qwen2.5 72B",
    capabilities: { text: 5, code: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "budget",
    costPer1M: 4,
    maxContextTokens: 131072,
    strengthTier: "high",
    tags: ["chinese"],
    languages: ["zh", "en"],
    runtime: { configured: true, health: "ok", probeResults: { text: "ok" } },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("capability-matrix v2 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no user choices, one available capability
    mockGetCapabilityMatrixSummary.mockReturnValue({
      available: [{ capability: "text", bestCard: makeCard(), alternatives: 3 }],
      missing: ["videoGen"],
      unconfigured: [
        {
          capability: "imageGen",
          recommendation: {
            provider: "siliconflow",
            modelId: "flux-1",
            displayName: "Flux.1",
            costTier: "budget",
            region: "domestic",
            requiresDownload: false,
          },
        },
      ],
    });
    mockLoadConfig.mockResolvedValue({});
    mockGetProviderAliases.mockImplementation((id: string) => [id]);
    mockQueryByCapability.mockReturnValue([]);
  });

  // =========================================================================
  // capability_matrix.summary
  // =========================================================================
  describe("capability_matrix.summary", () => {
    it("应返回所有能力维度的状态", async () => {
      const { opts, respond } = makeOpts("capability_matrix.summary");
      await capabilityMatrixHandlers["capability_matrix.summary"](opts);

      expect(respond).toHaveBeenCalledOnce();
      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.capabilities).toHaveLength(10); // 10 capability keys
      expect(payload.availableCount).toBe(1);
      expect(payload.missingCount).toBe(1);
    });

    it("active 能力应包含 bestModel 字段", async () => {
      const { opts, respond } = makeOpts("capability_matrix.summary");
      await capabilityMatrixHandlers["capability_matrix.summary"](opts);

      const [, payload] = respond.mock.calls[0];
      const textCap = payload.capabilities.find((c: { key: string }) => c.key === "text");
      expect(textCap.status).toBe("active");
      expect(textCap.bestModel).toBeDefined();
      expect(textCap.bestModel.provider).toBe("siliconflow");
      expect(textCap.bestModel.modelId).toBe("Qwen/Qwen2.5-72B-Instruct");
    });

    it("unconfigured 能力应包含 recommendation", async () => {
      const { opts, respond } = makeOpts("capability_matrix.summary");
      await capabilityMatrixHandlers["capability_matrix.summary"](opts);

      const [, payload] = respond.mock.calls[0];
      const imgCap = payload.capabilities.find((c: { key: string }) => c.key === "imageGen");
      expect(imgCap.status).toBe("unconfigured");
      expect(imgCap.recommendation).toBeDefined();
      expect(imgCap.recommendation.provider).toBe("siliconflow");
    });

    it("missing 能力应标记为 missing", async () => {
      const { opts, respond } = makeOpts("capability_matrix.summary");
      await capabilityMatrixHandlers["capability_matrix.summary"](opts);

      const [, payload] = respond.mock.calls[0];
      const vidGenCap = payload.capabilities.find((c: { key: string }) => c.key === "videoGen");
      expect(vidGenCap.status).toBe("missing");
    });

    it("用户选择的模型在 registry 中时，应替换 bestCard", async () => {
      const userCard = makeCard({
        provider: "deepseek",
        modelId: "deepseek-chat",
        displayName: "DeepSeek Chat",
      });
      mockLoadConfig.mockResolvedValue({
        modelCapability: {
          capabilities: {
            text: { providerId: "deepseek", modelId: "deepseek-chat" },
          },
        },
      });
      mockQueryByCapability.mockReturnValue([userCard]);

      const { opts, respond } = makeOpts("capability_matrix.summary");
      await capabilityMatrixHandlers["capability_matrix.summary"](opts);

      const [, payload] = respond.mock.calls[0];
      const textCap = payload.capabilities.find((c: { key: string }) => c.key === "text");
      expect(textCap.bestModel.provider).toBe("deepseek");
      expect(textCap.bestModel.modelId).toBe("deepseek-chat");
    });

    it("用户选择的模型不在 registry 中时，应构造 synthetic card（不继承 bestCard 属性）", async () => {
      mockLoadConfig.mockResolvedValue({
        modelCapability: {
          capabilities: {
            text: { providerId: "custom-provider", modelId: "custom-model-v1" },
          },
        },
      });
      // queryByCapability 返回空 — 用户的模型不在 registry
      mockQueryByCapability.mockReturnValue([]);

      const { opts, respond } = makeOpts("capability_matrix.summary");
      await capabilityMatrixHandlers["capability_matrix.summary"](opts);

      const [, payload] = respond.mock.calls[0];
      const textCap = payload.capabilities.find((c: { key: string }) => c.key === "text");
      expect(textCap.bestModel.provider).toBe("custom-provider");
      expect(textCap.bestModel.modelId).toBe("custom-model-v1");
      // Synthetic card 不应继承 bestCard 的 siliconflow 属性
      expect(textCap.bestModel.costTier).toBe("standard"); // safe default
      expect(textCap.bestModel.region).toBe("international"); // custom-provider 不在 MAPPINGS 中
    });

    it("synthetic card: 国内 provider 应标记 domestic", async () => {
      mockLoadConfig.mockResolvedValue({
        modelCapability: {
          capabilities: {
            text: { providerId: "siliconflow", modelId: "unknown-model" },
          },
        },
      });
      mockQueryByCapability.mockReturnValue([]); // 模型不在 registry

      const { opts, respond } = makeOpts("capability_matrix.summary");
      await capabilityMatrixHandlers["capability_matrix.summary"](opts);

      const [, payload] = respond.mock.calls[0];
      const textCap = payload.capabilities.find((c: { key: string }) => c.key === "text");
      expect(textCap.bestModel.region).toBe("domestic");
    });

    it("synthetic card: 应从 config models.providers 读取 displayName", async () => {
      mockLoadConfig.mockResolvedValue({
        modelCapability: {
          capabilities: {
            text: { providerId: "custom-prov", modelId: "my-model" },
          },
        },
        models: {
          providers: {
            "custom-prov": {
              models: [{ id: "my-model", name: "My Cool Model" }],
            },
          },
        },
      });
      mockQueryByCapability.mockReturnValue([]);

      const { opts, respond } = makeOpts("capability_matrix.summary");
      await capabilityMatrixHandlers["capability_matrix.summary"](opts);

      const [, payload] = respond.mock.calls[0];
      const textCap = payload.capabilities.find((c: { key: string }) => c.key === "text");
      expect(textCap.bestModel.displayName).toBe("My Cool Model");
    });

    it("alias 匹配: glm → zhipu 应找到正确 card", async () => {
      const zhipuCard = makeCard({
        provider: "zhipu",
        modelId: "glm-4-plus",
        displayName: "GLM-4 Plus",
      });
      mockLoadConfig.mockResolvedValue({
        modelCapability: {
          capabilities: {
            text: { providerId: "glm", modelId: "glm-4-plus" },
          },
        },
      });
      mockGetProviderAliases.mockReturnValue(["glm", "zhipu"]);
      mockQueryByCapability.mockReturnValue([zhipuCard]);

      const { opts, respond } = makeOpts("capability_matrix.summary");
      await capabilityMatrixHandlers["capability_matrix.summary"](opts);

      const [, payload] = respond.mock.calls[0];
      const textCap = payload.capabilities.find((c: { key: string }) => c.key === "text");
      expect(textCap.bestModel.provider).toBe("zhipu");
    });

    it("vision 能力应使用 v1 key image-understanding 做 config 查找", async () => {
      mockGetCapabilityMatrixSummary.mockReturnValue({
        available: [
          {
            capability: "vision",
            bestCard: makeCard({ capabilities: { vision: 4 } }),
            alternatives: 1,
          },
        ],
        missing: [],
        unconfigured: [],
      });
      mockLoadConfig.mockResolvedValue({
        modelCapability: {
          capabilities: {
            "image-understanding": { providerId: "openai", modelId: "gpt-4o" },
          },
        },
      });
      mockQueryByCapability.mockReturnValue([]);

      const { opts, respond } = makeOpts("capability_matrix.summary");
      await capabilityMatrixHandlers["capability_matrix.summary"](opts);

      // queryByCapability should have been called for vision
      expect(mockQueryByCapability).toHaveBeenCalledWith("vision", { configuredOnly: true });
    });

    it("异常时应返回 UNAVAILABLE 错误", async () => {
      mockGetCapabilityMatrixSummary.mockImplementation(() => {
        throw new Error("registry not initialized");
      });

      const { opts, respond } = makeOpts("capability_matrix.summary");
      await capabilityMatrixHandlers["capability_matrix.summary"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("UNAVAILABLE");
    });
  });

  // =========================================================================
  // capability_matrix.query
  // =========================================================================
  describe("capability_matrix.query", () => {
    it("缺少 capability 参数应返回 INVALID_REQUEST", async () => {
      const { opts, respond } = makeOpts("capability_matrix.query", {});
      await capabilityMatrixHandlers["capability_matrix.query"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
      expect(error.message).toContain("capability");
    });

    it("非法 capability 值应返回 INVALID_REQUEST", async () => {
      const { opts, respond } = makeOpts("capability_matrix.query", {
        capability: "nonexistent",
      });
      await capabilityMatrixHandlers["capability_matrix.query"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
      expect(error.message).toContain("nonexistent");
    });

    it("合法 capability 应返回模型列表", async () => {
      const card = makeCard();
      mockQueryByCapability.mockReturnValue([card]);

      const { opts, respond } = makeOpts("capability_matrix.query", {
        capability: "text",
      });
      await capabilityMatrixHandlers["capability_matrix.query"](opts);

      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.capability).toBe("text");
      expect(payload.capabilityName).toBe("文本对话");
      expect(payload.models).toHaveLength(1);
      expect(payload.models[0].provider).toBe("siliconflow");
    });

    it("应传递 configuredOnly 和 policy 参数", async () => {
      mockQueryByCapability.mockReturnValue([]);

      const { opts } = makeOpts("capability_matrix.query", {
        capability: "text",
        configuredOnly: true,
        policy: "cheapest",
      });
      await capabilityMatrixHandlers["capability_matrix.query"](opts);

      expect(mockQueryByCapability).toHaveBeenCalledWith(
        "text",
        { configuredOnly: true, healthyOnly: true },
        "cheapest",
      );
    });

    it("delegate 抛异常应返回 UNAVAILABLE", async () => {
      mockQueryByCapability.mockImplementation(() => {
        throw new Error("boom");
      });

      const { opts, respond } = makeOpts("capability_matrix.query", {
        capability: "text",
      });
      await capabilityMatrixHandlers["capability_matrix.query"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("UNAVAILABLE");
    });
  });

  // =========================================================================
  // capability_matrix.providers (per-provider capabilities)
  // =========================================================================
  describe("capability_matrix.providers", () => {
    it("缺少 provider 参数应返回 INVALID_REQUEST", async () => {
      const { opts, respond } = makeOpts("capability_matrix.providers", {});
      await capabilityMatrixHandlers["capability_matrix.providers"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
    });

    it("应返回该 provider 的所有模型及能力", async () => {
      mockGetProviderCapabilities.mockReturnValue([makeCard()]);

      const { opts, respond } = makeOpts("capability_matrix.providers", {
        provider: "siliconflow",
      });
      await capabilityMatrixHandlers["capability_matrix.providers"](opts);

      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.provider).toBe("siliconflow");
      expect(payload.models).toHaveLength(1);
      expect(payload.models[0].capabilities).toContainEqual(
        expect.objectContaining({ key: "text", quality: 5 }),
      );
    });
  });

  // =========================================================================
  // capability_matrix.refresh
  // =========================================================================
  describe("capability_matrix.refresh", () => {
    it("应触发远程刷新并返回结果", async () => {
      mockTriggerRemoteFetch.mockResolvedValue({ updated: 42 });

      const { opts, respond } = makeOpts("capability_matrix.refresh");
      await capabilityMatrixHandlers["capability_matrix.refresh"](opts);

      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.updated).toBe(42);
    });

    it("远程刷新失败应返回 UNAVAILABLE", async () => {
      mockTriggerRemoteFetch.mockRejectedValue(new Error("network"));

      const { opts, respond } = makeOpts("capability_matrix.refresh");
      await capabilityMatrixHandlers["capability_matrix.refresh"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("UNAVAILABLE");
    });
  });

  // =========================================================================
  // capability_matrix.models (v1 delegate)
  // =========================================================================
  describe("capability_matrix.models", () => {
    it("缺少 capability 参数应返回 INVALID_REQUEST", async () => {
      const { opts, respond } = makeOpts("capability_matrix.models", {});
      await capabilityMatrixHandlers["capability_matrix.models"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
    });

    it("应委托给 getCapabilityModels 并返回结果", async () => {
      mockGetCapabilityModels.mockResolvedValue({
        models: [{ providerId: "openai", modelId: "gpt-4o" }],
      });

      const { opts, respond } = makeOpts("capability_matrix.models", {
        capability: "text",
      });
      await capabilityMatrixHandlers["capability_matrix.models"](opts);

      expect(mockGetCapabilityModels).toHaveBeenCalledWith({ capability: "text" });
      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.models).toHaveLength(1);
    });

    it("delegate 抛异常应返回 UNAVAILABLE", async () => {
      mockGetCapabilityModels.mockRejectedValue(new Error("config corrupt"));

      const { opts, respond } = makeOpts("capability_matrix.models", {
        capability: "text",
      });
      await capabilityMatrixHandlers["capability_matrix.models"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("UNAVAILABLE");
    });
  });

  // =========================================================================
  // capability_matrix.switchModel
  // =========================================================================
  describe("capability_matrix.switchModel", () => {
    it("缺少任一必填参数应返回 INVALID_REQUEST", async () => {
      // 缺 modelId
      const { opts, respond } = makeOpts("capability_matrix.switchModel", {
        capability: "text",
        providerId: "openai",
      });
      await capabilityMatrixHandlers["capability_matrix.switchModel"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
      expect(error.message).toContain("capability, providerId, modelId");
    });

    it("三个参数齐全时应委托并返回结果", async () => {
      mockSwitchCapabilityModel.mockResolvedValue({ success: true, message: "ok" });

      const { opts, respond } = makeOpts("capability_matrix.switchModel", {
        capability: "text",
        providerId: "openai",
        modelId: "gpt-4o",
      });
      await capabilityMatrixHandlers["capability_matrix.switchModel"](opts);

      expect(mockSwitchCapabilityModel).toHaveBeenCalledWith({
        capability: "text",
        providerId: "openai",
        modelId: "gpt-4o",
      });
      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.success).toBe(true);
    });
  });

  // =========================================================================
  // capability_matrix.providers.list
  // =========================================================================
  describe("capability_matrix.providers.list", () => {
    it("应委托给 listProviders 并返回结果", async () => {
      mockListProviders.mockResolvedValue({
        providers: [{ providerId: "siliconflow", name: "SiliconFlow" }],
      });

      const { opts, respond } = makeOpts("capability_matrix.providers.list");
      await capabilityMatrixHandlers["capability_matrix.providers.list"](opts);

      expect(mockListProviders).toHaveBeenCalledOnce();
      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.providers).toHaveLength(1);
    });

    it("delegate 抛异常应返回 UNAVAILABLE", async () => {
      mockListProviders.mockRejectedValue(new Error("fail"));

      const { opts, respond } = makeOpts("capability_matrix.providers.list");
      await capabilityMatrixHandlers["capability_matrix.providers.list"](opts);

      const [ok] = respond.mock.calls[0];
      expect(ok).toBe(false);
    });
  });

  // =========================================================================
  // capability_matrix.providerGroups
  // =========================================================================
  describe("capability_matrix.providerGroups", () => {
    it("应直接返回 PROVIDER_GROUPS", async () => {
      const { opts, respond } = makeOpts("capability_matrix.providerGroups");
      await capabilityMatrixHandlers["capability_matrix.providerGroups"](opts);

      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.groups).toEqual(MOCK_PROVIDER_GROUPS);
    });
  });

  // =========================================================================
  // capability_matrix.provider.detect
  // =========================================================================
  describe("capability_matrix.provider.detect", () => {
    it("缺少 providerId 应返回 INVALID_REQUEST", async () => {
      const { opts, respond } = makeOpts("capability_matrix.provider.detect", {
        apiKey: "sk-123",
      });
      await capabilityMatrixHandlers["capability_matrix.provider.detect"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
      expect(error.message).toContain("providerId");
    });

    it("缺少 apiKey 应返回 INVALID_REQUEST", async () => {
      const { opts, respond } = makeOpts("capability_matrix.provider.detect", {
        providerId: "siliconflow",
      });
      await capabilityMatrixHandlers["capability_matrix.provider.detect"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
      expect(error.message).toContain("apiKey");
    });

    it("providerId 为非 string 类型应返回 INVALID_REQUEST", async () => {
      const { opts, respond } = makeOpts("capability_matrix.provider.detect", {
        providerId: 123,
        apiKey: "sk-test",
      });
      await capabilityMatrixHandlers["capability_matrix.provider.detect"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
    });

    it("参数合法时应立即响应 {started, total} 并异步调用 detect", async () => {
      const { opts, respond } = makeOpts("capability_matrix.provider.detect", {
        providerId: "siliconflow",
        apiKey: "sk-test-key",
      });
      await capabilityMatrixHandlers["capability_matrix.provider.detect"](opts);

      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.started).toBe(true);
      expect(payload.total).toBe(1); // siliconflow 在 mock 中有 1 个模型

      // detectProviderModelsWithProgress 应被异步调用
      expect(mockDetectProviderModelsWithProgress).toHaveBeenCalledWith(
        {
          providerId: "siliconflow",
          apiKey: "sk-test-key",
          customModel: undefined,
          baseUrl: undefined,
        },
        expect.any(Function),
      );
    });

    it("未知 provider 的 total 应为 0", async () => {
      const { opts, respond } = makeOpts("capability_matrix.provider.detect", {
        providerId: "unknown-provider",
        apiKey: "sk-test",
      });
      await capabilityMatrixHandlers["capability_matrix.provider.detect"](opts);

      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.total).toBe(0);
    });

    it("customModel 不在 mapping 中时 total 应 +1", async () => {
      const { opts, respond } = makeOpts("capability_matrix.provider.detect", {
        providerId: "siliconflow",
        apiKey: "sk-test",
        customModel: "my-custom-model",
      });
      await capabilityMatrixHandlers["capability_matrix.provider.detect"](opts);

      const [, payload] = respond.mock.calls[0];
      expect(payload.total).toBe(2); // 1 existing + 1 custom
    });

    it("customModel 已在 mapping 中时 total 不变", async () => {
      const { opts, respond } = makeOpts("capability_matrix.provider.detect", {
        providerId: "siliconflow",
        apiKey: "sk-test",
        customModel: "Qwen/Qwen2.5-72B-Instruct", // 已存在
      });
      await capabilityMatrixHandlers["capability_matrix.provider.detect"](opts);

      const [, payload] = respond.mock.calls[0];
      expect(payload.total).toBe(1);
    });

    it("有 connId 时应使用 broadcastToConnIds（定向广播）", async () => {
      mockDetectProviderModelsWithProgress.mockImplementation(async (_params, broadcastFn) => {
        broadcastFn("modelConfig.detect.progress", { step: 1 });
      });

      const { opts, broadcastToConnIds, broadcast } = makeOpts(
        "capability_matrix.provider.detect",
        { providerId: "siliconflow", apiKey: "sk-test" },
      );
      await capabilityMatrixHandlers["capability_matrix.provider.detect"](opts);

      // 等异步 detect 完成
      await vi.waitFor(() => {
        expect(broadcastToConnIds).toHaveBeenCalled();
      });
      expect(broadcast).not.toHaveBeenCalled();
    });

    it("无 connId 时应使用全局 broadcast", async () => {
      mockDetectProviderModelsWithProgress.mockImplementation(async (_params, broadcastFn) => {
        broadcastFn("modelConfig.detect.complete", { success: true });
      });

      const { opts, broadcast, broadcastToConnIds } = makeOpts(
        "capability_matrix.provider.detect",
        { providerId: "siliconflow", apiKey: "sk-test" },
        null, // no client
      );
      await capabilityMatrixHandlers["capability_matrix.provider.detect"](opts);

      await vi.waitFor(() => {
        expect(broadcast).toHaveBeenCalled();
      });
      expect(broadcastToConnIds).not.toHaveBeenCalled();
    });

    it("detect 异步失败时应广播 modelConfig.detect.complete 带 error", async () => {
      mockDetectProviderModelsWithProgress.mockRejectedValue(new Error("API 500"));

      const { opts, broadcastToConnIds } = makeOpts("capability_matrix.provider.detect", {
        providerId: "siliconflow",
        apiKey: "sk-test",
      });
      await capabilityMatrixHandlers["capability_matrix.provider.detect"](opts);

      await vi.waitFor(() => {
        expect(broadcastToConnIds).toHaveBeenCalled();
      });

      const [event, payload] = broadcastToConnIds.mock.calls[0];
      expect(event).toBe("modelConfig.detect.complete");
      expect(payload.success).toBe(false);
      expect(payload.error).toContain("API 500");
    });
  });

  // =========================================================================
  // capability_matrix.provider.getConfig
  // =========================================================================
  describe("capability_matrix.provider.getConfig", () => {
    it("缺少 providerId 应返回 INVALID_REQUEST", async () => {
      const { opts, respond } = makeOpts("capability_matrix.provider.getConfig", {});
      await capabilityMatrixHandlers["capability_matrix.provider.getConfig"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
    });

    it("应委托给 getProviderConfig", async () => {
      mockGetProviderConfig.mockResolvedValue({ configured: true, maskedApiKey: "sk-a***5678" });

      const { opts, respond } = makeOpts("capability_matrix.provider.getConfig", {
        providerId: "openai",
      });
      await capabilityMatrixHandlers["capability_matrix.provider.getConfig"](opts);

      expect(mockGetProviderConfig).toHaveBeenCalledWith({ providerId: "openai" });
      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.maskedApiKey).toBe("sk-a***5678");
    });
  });

  // =========================================================================
  // capability_matrix.provider.delete
  // =========================================================================
  describe("capability_matrix.provider.delete", () => {
    it("缺少 providerId 应返回 INVALID_REQUEST", async () => {
      const { opts, respond } = makeOpts("capability_matrix.provider.delete", {});
      await capabilityMatrixHandlers["capability_matrix.provider.delete"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
    });

    it("应委托给 deleteProviderConfig", async () => {
      const { opts, respond } = makeOpts("capability_matrix.provider.delete", {
        providerId: "openai",
      });
      await capabilityMatrixHandlers["capability_matrix.provider.delete"](opts);

      expect(mockDeleteProviderConfig).toHaveBeenCalledWith({ providerId: "openai" });
      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.success).toBe(true);
    });
  });

  // =========================================================================
  // capability_matrix.provider.addModel
  // =========================================================================
  describe("capability_matrix.provider.addModel", () => {
    it("缺少 providerId 应返回 INVALID_REQUEST", async () => {
      const { opts, respond } = makeOpts("capability_matrix.provider.addModel", {
        modelId: "test",
      });
      await capabilityMatrixHandlers["capability_matrix.provider.addModel"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
    });

    it("缺少 modelId 应返回 INVALID_REQUEST", async () => {
      const { opts, respond } = makeOpts("capability_matrix.provider.addModel", {
        providerId: "openai",
      });
      await capabilityMatrixHandlers["capability_matrix.provider.addModel"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
    });

    it("参数齐全时应委托给 addCustomModel", async () => {
      const { opts, respond } = makeOpts("capability_matrix.provider.addModel", {
        providerId: "openai",
        modelId: "custom-gpt",
        modelName: "Custom GPT",
        input: ["text", "image"],
      });
      await capabilityMatrixHandlers["capability_matrix.provider.addModel"](opts);

      expect(mockAddCustomModel).toHaveBeenCalledWith({
        providerId: "openai",
        modelId: "custom-gpt",
        modelName: "Custom GPT",
        input: ["text", "image"],
      });
      const [ok] = respond.mock.calls[0];
      expect(ok).toBe(true);
    });
  });

  // =========================================================================
  // capability_matrix.health
  // =========================================================================
  describe("capability_matrix.health", () => {
    it("应委托给 getProvidersHealth", async () => {
      mockGetProvidersHealth.mockResolvedValue({
        providers: [{ providerId: "openai", status: "ok" }],
      });

      const { opts, respond } = makeOpts("capability_matrix.health");
      await capabilityMatrixHandlers["capability_matrix.health"](opts);

      expect(mockGetProvidersHealth).toHaveBeenCalledOnce();
      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.providers).toHaveLength(1);
    });
  });

  // =========================================================================
  // capability_matrix.provider.testConnection
  // =========================================================================
  describe("capability_matrix.provider.testConnection", () => {
    it("缺少 providerId 应返回 INVALID_REQUEST", async () => {
      const { opts, respond } = makeOpts("capability_matrix.provider.testConnection", {});
      await capabilityMatrixHandlers["capability_matrix.provider.testConnection"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
    });

    it("应委托给 testProviderConnection", async () => {
      mockTestProviderConnection.mockResolvedValue({ ok: true, latencyMs: 42 });

      const { opts, respond } = makeOpts("capability_matrix.provider.testConnection", {
        providerId: "openai",
      });
      await capabilityMatrixHandlers["capability_matrix.provider.testConnection"](opts);

      expect(mockTestProviderConnection).toHaveBeenCalledWith({ providerId: "openai" });
      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.latencyMs).toBe(42);
    });
  });

  // =========================================================================
  // capability_matrix.priority.save
  // =========================================================================
  describe("capability_matrix.priority.save", () => {
    it("priority 不是数组时应返回 INVALID_REQUEST", async () => {
      const { opts, respond } = makeOpts("capability_matrix.priority.save", {
        priority: "not-an-array",
      });
      await capabilityMatrixHandlers["capability_matrix.priority.save"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
    });

    it("缺少 priority 参数应返回 INVALID_REQUEST", async () => {
      const { opts, respond } = makeOpts("capability_matrix.priority.save", {});
      await capabilityMatrixHandlers["capability_matrix.priority.save"](opts);

      const [ok, , error] = respond.mock.calls[0];
      expect(ok).toBe(false);
      expect(error.code).toBe("INVALID_REQUEST");
    });

    it("合法数组应委托给 saveProviderPriority", async () => {
      const { opts, respond } = makeOpts("capability_matrix.priority.save", {
        priority: ["siliconflow", "deepseek"],
      });
      await capabilityMatrixHandlers["capability_matrix.priority.save"](opts);

      expect(mockSaveProviderPriority).toHaveBeenCalledWith({
        priority: ["siliconflow", "deepseek"],
      });
      const [ok] = respond.mock.calls[0];
      expect(ok).toBe(true);
    });
  });

  // =========================================================================
  // capability_matrix.priority.get
  // =========================================================================
  describe("capability_matrix.priority.get", () => {
    it("应委托给 getProviderPriority", async () => {
      mockGetProviderPriority.mockResolvedValue({
        priority: ["deepseek", "siliconflow"],
      });

      const { opts, respond } = makeOpts("capability_matrix.priority.get");
      await capabilityMatrixHandlers["capability_matrix.priority.get"](opts);

      expect(mockGetProviderPriority).toHaveBeenCalledOnce();
      const [ok, payload] = respond.mock.calls[0];
      expect(ok).toBe(true);
      expect(payload.priority).toEqual(["deepseek", "siliconflow"]);
    });
  });

  // =========================================================================
  // 横切关注: 所有 handler 都已注册
  // =========================================================================
  describe("handler 完整性", () => {
    const EXPECTED_METHODS = [
      "capability_matrix.summary",
      "capability_matrix.query",
      "capability_matrix.providers",
      "capability_matrix.refresh",
      "capability_matrix.models",
      "capability_matrix.switchModel",
      "capability_matrix.providers.list",
      "capability_matrix.providerGroups",
      "capability_matrix.provider.detect",
      "capability_matrix.provider.getConfig",
      "capability_matrix.provider.delete",
      "capability_matrix.provider.addModel",
      "capability_matrix.health",
      "capability_matrix.provider.testConnection",
      "capability_matrix.priority.save",
      "capability_matrix.priority.get",
      "capability_matrix.embeddingBinding",
      "capability_matrix.extractionStatus",
    ];

    it.each(EXPECTED_METHODS)("%s 应已注册", (method) => {
      expect(capabilityMatrixHandlers[method]).toBeDefined();
      expect(typeof capabilityMatrixHandlers[method]).toBe("function");
    });

    it("不应有未预期的额外 handler", () => {
      const actualMethods = Object.keys(capabilityMatrixHandlers);
      expect(actualMethods.sort()).toEqual([...EXPECTED_METHODS].sort());
    });
  });
});

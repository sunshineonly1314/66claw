/**
 * model-config Gateway API 测试
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listCapabilities,
  getCapabilityModels,
  switchCapabilityModel,
  detectProviderModels,
  listProviders,
  getProviderConfig,
  deleteProviderConfig,
  MODEL_CONFIG_HANDLERS,
} from "./model-config.js";

// 持久化 mock 引用，便于在测试中修改返回值
const mockLoadConfig = vi.fn(async () => ({
  models: {
    providers: {
      openai: { apiKey: "sk-test-1234567890abcdef" },
    },
  },
}));
const mockWriteConfigFile = vi.fn(async () => {});

vi.mock("../../config/config.js", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  writeConfigFile: (...args: unknown[]) => mockWriteConfigFile(...args),
}));

// Mock fetch — detectProviderModels 验证会发起真实 API 请求，测试中需要 stub
const mockFetch = vi.fn(async () => ({
  ok: true,
  status: 200,
  text: async () => "{}",
  json: async () => ({ choices: [{ message: { content: "" } }] }),
}));
vi.stubGlobal("fetch", mockFetch);

describe("model-config API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 恢复默认 mock 返回值
    mockLoadConfig.mockResolvedValue({
      models: {
        providers: {
          openai: { apiKey: "sk-test-1234567890abcdef" },
        },
      },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
      json: async () => ({ choices: [{ message: { content: "" } }] }),
    });
  });

  // ==============================
  // listCapabilities
  // ==============================
  describe("listCapabilities", () => {
    it("应该返回所有能力列表", async () => {
      const result = await listCapabilities();

      expect(result).toHaveProperty("capabilities");
      expect(Array.isArray(result.capabilities)).toBe(true);
      expect(result.capabilities.length).toBeGreaterThan(0);

      // 检查必要字段
      const firstCap = result.capabilities[0];
      expect(firstCap).toHaveProperty("capability");
      expect(firstCap).toHaveProperty("name");
      expect(firstCap).toHaveProperty("description");
      expect(firstCap).toHaveProperty("icon");
      expect(firstCap).toHaveProperty("status");
    });

    it("应该包含5个核心能力", async () => {
      const result = await listCapabilities();

      const capabilities = result.capabilities.map((c) => c.capability);
      expect(capabilities).toContain("text");
      expect(capabilities).toContain("image-understanding");
      expect(capabilities).toContain("image-generation");
      expect(capabilities).toContain("video");
      expect(capabilities).toContain("embedding");
    });

    it("无配置时所有能力应为 inactive", async () => {
      mockLoadConfig.mockResolvedValue({ models: { providers: {} } });
      const result = await listCapabilities();

      for (const cap of result.capabilities) {
        expect(cap.status).toBe("inactive");
        expect(cap.currentModel).toBeNull();
      }
    });

    it("有能力配置时应返回 active 状态", async () => {
      mockLoadConfig.mockResolvedValue({
        models: { providers: { openai: { apiKey: "sk-test-1234567890abcdef" } } },
        modelCapability: {
          capabilities: {
            text: { providerId: "openai", modelId: "gpt-4o" },
          },
        },
      });

      const result = await listCapabilities();
      const textCap = result.capabilities.find((c) => c.capability === "text");
      expect(textCap?.status).toBe("active");
      expect(textCap?.currentModel?.providerId).toBe("openai");
      expect(textCap?.currentModel?.modelId).toBe("gpt-4o");
    });

    it("Provider 未配置时即使有 capability 绑定也应为 inactive", async () => {
      // 有 capability 绑定但 provider 没有 apiKey
      mockLoadConfig.mockResolvedValue({
        models: { providers: {} },
        modelCapability: {
          capabilities: {
            text: { providerId: "openai", modelId: "gpt-4o" },
          },
        },
      });

      const result = await listCapabilities();
      const textCap = result.capabilities.find((c) => c.capability === "text");
      expect(textCap?.status).toBe("inactive");
      expect(textCap?.currentModel).toBeNull();
    });

    it("setup wizard 配置的 Provider（不在 PROVIDER_CAPABILITY_MAPPINGS 中）应显示为 active", async () => {
      // BUG FIX: "qwen-dashscope" 是 setup wizard 使用的 providerId,
      // 但 PROVIDER_CAPABILITY_MAPPINGS 中使用的是 "aliyun-bailian"。
      // 即使 providerId 不在 PROVIDER_CAPABILITY_MAPPINGS 中，只要 provider 有 apiKey
      // 且 modelCapability 绑定了该 provider，能力应该显示为 active。
      mockLoadConfig.mockResolvedValue({
        models: {
          providers: {
            "qwen-dashscope": {
              baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
              apiKey: "sk-test-1234567890abcdef",
              models: [
                { id: "qwen-plus", name: "通义千问 Plus", input: ["text"] },
              ],
            },
          },
        },
        modelCapability: {
          capabilities: {
            text: { providerId: "qwen-dashscope", modelId: "qwen-plus" },
          },
        },
      });

      const result = await listCapabilities();
      const textCap = result.capabilities.find((c) => c.capability === "text");
      expect(textCap?.status).toBe("active");
      expect(textCap?.currentModel).not.toBeNull();
      expect(textCap?.currentModel?.providerId).toBe("qwen-dashscope");
      expect(textCap?.currentModel?.modelId).toBe("qwen-plus");
      expect(textCap?.currentModel?.modelName).toBe("通义千问 Plus");
    });
  });

  // ==============================
  // getCapabilityModels
  // ==============================
  describe("getCapabilityModels", () => {
    it("应该返回指定能力的模型列表", async () => {
      const result = await getCapabilityModels({ capability: "text" });

      expect(result).toHaveProperty("models");
      expect(Array.isArray(result.models)).toBe(true);
      expect(result.models.length).toBeGreaterThan(0);

      // 检查模型字段
      const firstModel = result.models[0];
      expect(firstModel).toHaveProperty("providerId");
      expect(firstModel).toHaveProperty("providerName");
      expect(firstModel).toHaveProperty("modelId");
      expect(firstModel).toHaveProperty("modelName");
      expect(firstModel).toHaveProperty("pricing");
      expect(firstModel).toHaveProperty("configured");
      expect(firstModel).toHaveProperty("active");
    });

    it("应该按配置状态排序(已配置优先)", async () => {
      const result = await getCapabilityModels({ capability: "text" });

      const firstConfigured = result.models.findIndex((m) => m.configured);
      const firstUnconfigured = result.models.findIndex((m) => !m.configured);

      if (firstConfigured !== -1 && firstUnconfigured !== -1) {
        expect(firstConfigured).toBeLessThan(firstUnconfigured);
      }
    });

    it("当前使用的模型应该排在最前", async () => {
      mockLoadConfig.mockResolvedValue({
        models: { providers: { openai: { apiKey: "sk-test-1234567890abcdef" } } },
        modelCapability: {
          capabilities: {
            text: { providerId: "openai", modelId: "gpt-4o" },
          },
        },
      });

      const result = await getCapabilityModels({ capability: "text" });
      const activeModel = result.models.find((m) => m.active);
      if (activeModel) {
        expect(result.models[0].active).toBe(true);
      }
    });
  });

  // ==============================
  // switchCapabilityModel
  // ==============================
  describe("switchCapabilityModel", () => {
    it("未配置的Provider应该返回错误", async () => {
      const result = await switchCapabilityModel({
        capability: "text",
        providerId: "未知服务商",
        modelId: "test-model",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("尚未配置");
    });

    it("不支持该能力的模型应该返回错误", async () => {
      const result = await switchCapabilityModel({
        capability: "text",
        providerId: "openai",
        modelId: "不存在的模型",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("不支持该能力");
    });

    it("有效模型应该切换成功", async () => {
      const result = await switchCapabilityModel({
        capability: "text",
        providerId: "openai",
        modelId: "gpt-4o",
      });

      expect(result.success).toBe(true);
      expect(mockWriteConfigFile).toHaveBeenCalled();
    });

    it("切换后配置应该持久化", async () => {
      await switchCapabilityModel({
        capability: "text",
        providerId: "openai",
        modelId: "gpt-4o",
      });

      expect(mockWriteConfigFile).toHaveBeenCalledTimes(1);
      const savedConfig = mockWriteConfigFile.mock.calls[0][0];
      expect(savedConfig.modelCapability?.capabilities?.text).toEqual({
        providerId: "openai",
        modelId: "gpt-4o",
        auto: false,
      });
    });
  });

  // ==============================
  // detectProviderModels — 基础场景
  // ==============================
  describe("detectProviderModels", () => {
    it("未知Provider应该返回错误", async () => {
      const result = await detectProviderModels({
        providerId: "未知服务商",
        apiKey: "test-key-1234567890",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("未知的服务商");
    });

    it("已知Provider应该返回模型列表", async () => {
      const result = await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-test-1234567890abcdef",
      });

      expect(result.success).toBe(true);
      expect(result.models).toBeDefined();
      expect(Array.isArray(result.models)).toBe(true);
    });

    it("应该返回自动启用的能力映射", async () => {
      const result = await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-test-1234567890abcdef",
      });

      expect(result.success).toBe(true);
      expect(result.autoEnabled).toBeDefined();
      expect(typeof result.autoEnabled).toBe("object");
    });

    it("应该保存 trimmedKey 而非原始 apiKey", async () => {
      await detectProviderModels({
        providerId: "openai",
        apiKey: "  sk-test-1234567890abcdef  ",
      });

      expect(mockWriteConfigFile).toHaveBeenCalled();
      const savedConfig = mockWriteConfigFile.mock.calls[0][0];
      expect(savedConfig.models.providers.openai.apiKey).toBe("sk-test-1234567890abcdef");
    });
  });

  // ==============================
  // detectProviderModels — API Key 严格验证
  // ==============================
  describe("detectProviderModels - API Key 严格验证", () => {
    it("应该拒绝过短的 API Key（< 10 字符）", async () => {
      const result = await detectProviderModels({
        providerId: "openai",
        apiKey: "short",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("长度不足");
    });

    it("ollama 应允许短 key (≥ 1 字符)", async () => {
      const result = await detectProviderModels({
        providerId: "ollama",
        apiKey: "x",
      });

      // ollama 验证的是 /api/tags 端点，fetch mock 返回 ok:true
      expect(result.success).toBe(true);
    });

    it("fetch 返回 401 时应返回失败", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "{}",
      });

      const result = await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-test-1234567890abcdef",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("fetch 返回 403 时应返回失败", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "{}",
      });

      const result = await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-test-1234567890abcdef",
      });

      expect(result.success).toBe(false);
    });

    it("fetch 返回 500 时应返回失败", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const result = await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-test-1234567890abcdef",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("验证失败");
    });

    it("fetch 返回 429 时应提示频率限制", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded",
      });

      const result = await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-test-1234567890abcdef",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("频率超限");
    });

    it("fetch 返回带 error.message 的 JSON 时应提取错误信息", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: "Invalid API key provided" } }),
      });

      const result = await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-test-1234567890abcdef",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid API key provided");
    });

    it("fetch 网络超时应返回超时错误", async () => {
      mockFetch.mockRejectedValue(new Error("timeout: signal timed out"));

      const result = await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-test-1234567890abcdef",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("超时");
    });

    it("fetch 网络不可达应返回验证失败", async () => {
      mockFetch.mockRejectedValue(new Error("fetch failed"));

      const result = await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-test-1234567890abcdef",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("验证失败");
    });

    it("kimi-code 请求应包含 User-Agent 头", async () => {
      await detectProviderModels({
        providerId: "kimi-code",
        apiKey: "sk-test-kimi-1234567890",
      });

      // 检查 fetch 调用的 headers
      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls.find(
        (call) => typeof call[0] === "string" && call[0].includes("chat/completions"),
      );
      if (fetchCall) {
        const opts = fetchCall[1] as { headers?: Record<string, string> };
        expect(opts?.headers?.["User-Agent"]).toBe("KimiCLI/0.77");
      }
    });

    it("anthropic 请求应使用 x-api-key 头", async () => {
      await detectProviderModels({
        providerId: "anthropic",
        apiKey: "sk-ant-test-1234567890",
      });

      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls.find(
        (call) => typeof call[0] === "string" && call[0].includes("/messages"),
      );
      if (fetchCall) {
        const opts = fetchCall[1] as { headers?: Record<string, string> };
        expect(opts?.headers?.["x-api-key"]).toBe("sk-ant-test-1234567890");
      }
    });
  });

  // ==============================
  // listProviders
  // ==============================
  describe("listProviders", () => {
    it("应该返回所有Provider列表", async () => {
      const result = await listProviders();

      expect(result).toHaveProperty("providers");
      expect(Array.isArray(result.providers)).toBe(true);
      expect(result.providers.length).toBeGreaterThan(0);

      // 检查Provider字段
      const firstProvider = result.providers[0];
      expect(firstProvider).toHaveProperty("providerId");
      expect(firstProvider).toHaveProperty("name");
      expect(firstProvider).toHaveProperty("icon");
      expect(firstProvider).toHaveProperty("capabilities");
      expect(firstProvider).toHaveProperty("configured");
      expect(firstProvider).toHaveProperty("activeModels");
    });

    it("应该按配置状态排序(已配置优先)", async () => {
      const result = await listProviders();

      const firstConfigured = result.providers.findIndex((p) => p.configured);
      const firstUnconfigured = result.providers.findIndex((p) => !p.configured);

      if (firstConfigured !== -1 && firstUnconfigured !== -1) {
        expect(firstConfigured).toBeLessThan(firstUnconfigured);
      }
    });

    it("应该包含 group 和 tagline 字段", async () => {
      const result = await listProviders();
      for (const provider of result.providers) {
        expect(typeof provider.group).toBe("string");
        expect(typeof provider.tagline).toBe("string");
      }
    });

    it("有活跃模型的 Provider 应排在最前", async () => {
      mockLoadConfig.mockResolvedValue({
        models: {
          providers: {
            openai: { apiKey: "sk-test-1234567890abcdef" },
            deepseek: { apiKey: "sk-deep-1234567890abcdef" },
          },
        },
        modelCapability: {
          capabilities: {
            text: { providerId: "deepseek", modelId: "deepseek-chat" },
          },
        },
      });

      const result = await listProviders();
      // deepseek 有活跃模型,应该在 openai 前面
      const deepseekIdx = result.providers.findIndex((p) => p.providerId === "deepseek");
      const openaiIdx = result.providers.findIndex((p) => p.providerId === "openai");

      if (deepseekIdx !== -1 && openaiIdx !== -1) {
        expect(deepseekIdx).toBeLessThan(openaiIdx);
      }
    });

    it("setup wizard 配置的 Provider（不在 PROVIDER_CAPABILITY_MAPPINGS 中）应包含在列表中", async () => {
      // BUG FIX: "qwen-dashscope" 通过 setup wizard 配置，不在 PROVIDER_CAPABILITY_MAPPINGS 中
      mockLoadConfig.mockResolvedValue({
        models: {
          providers: {
            "qwen-dashscope": {
              baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
              apiKey: "sk-test-1234567890abcdef",
              models: [
                { id: "qwen-plus", name: "通义千问 Plus", input: ["text"] },
              ],
            },
          },
        },
      });

      const result = await listProviders();
      const qwen = result.providers.find((p) => p.providerId === "qwen-dashscope");

      expect(qwen).toBeDefined();
      expect(qwen?.configured).toBe(true);
    });
  });

  // ==============================
  // getProviderConfig — 脱敏 Key
  // ==============================
  describe("getProviderConfig", () => {
    it("已配置的 Provider 应返回脱敏 Key", async () => {
      mockLoadConfig.mockResolvedValue({
        models: {
          providers: {
            openai: { apiKey: "sk-abcdefgh12345678" },
          },
        },
      });

      const result = await getProviderConfig({ providerId: "openai" });

      expect(result.configured).toBe(true);
      expect(result.maskedApiKey).toMatch(/^sk-a\*+5678$/);
      expect(result.maskedApiKey).not.toContain("abcdefgh");
    });

    it("短 Key 应完全遮盖", async () => {
      mockLoadConfig.mockResolvedValue({
        models: {
          providers: {
            openai: { apiKey: "short-key" },
          },
        },
      });

      const result = await getProviderConfig({ providerId: "openai" });
      expect(result.configured).toBe(true);
      // 短 key (≤10) 全部遮盖
      expect(result.maskedApiKey).toBe("*".repeat("short-key".length));
    });

    it("未配置的 Provider 应返回 configured: false", async () => {
      mockLoadConfig.mockResolvedValue({ models: { providers: {} } });

      const result = await getProviderConfig({ providerId: "openai" });

      expect(result.configured).toBe(false);
      expect(result.maskedApiKey).toBe("");
    });

    it("Provider 无 apiKey 时应返回 configured: false", async () => {
      mockLoadConfig.mockResolvedValue({
        models: {
          providers: {
            openai: { baseUrl: "https://api.openai.com/v1" },
          },
        },
      });

      const result = await getProviderConfig({ providerId: "openai" });
      expect(result.configured).toBe(false);
    });
  });

  // ==============================
  // deleteProviderConfig
  // ==============================
  describe("deleteProviderConfig", () => {
    it("应该删除 Provider 配置", async () => {
      mockLoadConfig.mockResolvedValue({
        models: {
          providers: {
            openai: { apiKey: "sk-test-1234567890abcdef" },
          },
        },
      });

      const result = await deleteProviderConfig({ providerId: "openai" });

      expect(result.success).toBe(true);
      expect(mockWriteConfigFile).toHaveBeenCalled();

      const savedConfig = mockWriteConfigFile.mock.calls[0][0];
      expect(savedConfig.models.providers.openai).toBeUndefined();
    });

    it("删除 Provider 时应清理关联的 capability 绑定", async () => {
      mockLoadConfig.mockResolvedValue({
        models: {
          providers: {
            openai: { apiKey: "sk-test-1234567890abcdef" },
          },
        },
        modelCapability: {
          capabilities: {
            text: { providerId: "openai", modelId: "gpt-4o" },
            "image-understanding": { providerId: "openai", modelId: "gpt-4o" },
          },
        },
      });

      await deleteProviderConfig({ providerId: "openai" });

      const savedConfig = mockWriteConfigFile.mock.calls[0][0];
      expect(savedConfig.modelCapability.capabilities.text).toBeUndefined();
      expect(savedConfig.modelCapability.capabilities["image-understanding"]).toBeUndefined();
    });

    it("删除 Provider 不应影响其他 Provider 的 capability 绑定", async () => {
      mockLoadConfig.mockResolvedValue({
        models: {
          providers: {
            openai: { apiKey: "sk-test-1234567890abcdef" },
            deepseek: { apiKey: "sk-deep-1234567890abcdef" },
          },
        },
        modelCapability: {
          capabilities: {
            text: { providerId: "openai", modelId: "gpt-4o" },
            embedding: { providerId: "deepseek", modelId: "deepseek-embed" },
          },
        },
      });

      await deleteProviderConfig({ providerId: "openai" });

      const savedConfig = mockWriteConfigFile.mock.calls[0][0];
      expect(savedConfig.modelCapability.capabilities.text).toBeUndefined();
      expect(savedConfig.modelCapability.capabilities.embedding).toEqual({
        providerId: "deepseek",
        modelId: "deepseek-embed",
      });
    });

    it("删除不存在的 Provider 也应返回成功", async () => {
      mockLoadConfig.mockResolvedValue({ models: { providers: {} } });

      const result = await deleteProviderConfig({ providerId: "nonexistent" });
      expect(result.success).toBe(true);
    });
  });

  // ==============================
  // MODEL_CONFIG_HANDLERS — Gateway 注册
  // ==============================
  describe("MODEL_CONFIG_HANDLERS", () => {
    it("应该注册所有 8 个 API handler", () => {
      const expectedMethods = [
        "modelConfig.capabilities.list",
        "modelConfig.capability.models",
        "modelConfig.capability.switchModel",
        "modelConfig.provider.detect",
        "modelConfig.providers.list",
        "modelConfig.providerGroups.list",
        "modelConfig.provider.getConfig",
        "modelConfig.provider.delete",
      ];

      for (const method of expectedMethods) {
        expect(MODEL_CONFIG_HANDLERS[method]).toBeDefined();
        expect(typeof MODEL_CONFIG_HANDLERS[method]).toBe("function");
      }
    });

    it("handler 应通过 respond 回调返回结果", async () => {
      const respond = vi.fn();

      await MODEL_CONFIG_HANDLERS["modelConfig.capabilities.list"]({
        params: {},
        respond,
      } as any);

      expect(respond).toHaveBeenCalledTimes(1);
      expect(respond.mock.calls[0][0]).toBe(true); // success
      expect(respond.mock.calls[0][1]).toHaveProperty("capabilities");
    });

    it("providerGroups.list 应直接返回 PROVIDER_GROUPS", async () => {
      const respond = vi.fn();

      await MODEL_CONFIG_HANDLERS["modelConfig.providerGroups.list"]({
        params: {},
        respond,
      } as any);

      expect(respond).toHaveBeenCalledWith(true, expect.objectContaining({
        groups: expect.any(Array),
      }), undefined);
    });
  });
});

/**
 * model-config Gateway API 测试
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getCapabilityModels,
  switchCapabilityModel,
  listProviders,
  getProviderConfig,
  deleteProviderConfig,
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
  withConfigWriteLock: async (fn: () => Promise<unknown>) => fn(),
}));

// Mock fetch — switchCapabilityModel 等函数内部可能触发 API 请求，测试中需要 stub
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
      expect(result.error).toContain("不支持");
      expect(result.error).toContain("能力");
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
              models: [{ id: "qwen-plus", name: "通义千问 Plus", input: ["text"] }],
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
});

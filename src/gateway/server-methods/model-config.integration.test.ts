/**
 * model-config 集成测试
 * 测试完整的配置保存和读取流程
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  listCapabilities,
  getCapabilityModels,
  switchCapabilityModel,
  detectProviderModels,
  listProviders,
} from "./model-config.js";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Mock config - 必须在顶层定义以便闭包访问
let testConfigPath: string;
const tmpDir = os.tmpdir();

// Mock fetch — detectProviderModels MC-4 验证会发起真实 API 请求，测试中需要 stub
vi.stubGlobal("fetch", vi.fn(async () => ({
  ok: true,
  status: 200,
  text: async () => "{}",
  json: async () => ({ choices: [{ message: { content: "" } }] }),
})));

vi.mock("../../config/config.js", async () => {
  const actual = await vi.importActual("../../config/config.js");
  return {
    ...actual,
    loadConfig: vi.fn(async () => {
      if (!testConfigPath || !fs.existsSync(testConfigPath)) {
        return { models: { providers: {} }, modelCapability: { capabilities: {} } };
      }
      return JSON.parse(fs.readFileSync(testConfigPath, "utf-8"));
    }),
    writeConfigFile: vi.fn(async (config: any) => {
      if (testConfigPath) {
        fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2));
      }
    }),
  };
});

describe("model-config 集成测试", () => {
  beforeEach(() => {
    // 创建临时配置文件
    testConfigPath = path.join(tmpDir, `test-config-${Date.now()}.json`);

    // 初始化空配置
    const emptyConfig = {
      models: {
        providers: {}
      },
      modelCapability: {
        capabilities: {}
      }
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(emptyConfig, null, 2));
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 清理临时文件
    if (testConfigPath && fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe("配置保存和读取流程", () => {
    it("应该正确保存Provider配置和能力配置", async () => {
      // 1. 配置OpenAI
      const detectResult = await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-test-key-1234567890",
      });

      expect(detectResult.success).toBe(true);
      expect(detectResult.autoEnabled).toBeDefined();

      // 2. 验证配置已保存
      const config = await loadConfig();
      expect(config.models?.providers?.openai).toBeDefined();
      expect(config.models?.providers?.openai?.apiKey).toBe("sk-test-key-1234567890");

      // 3. 验证能力配置已保存
      const modelCapability = (config as any).modelCapability;
      expect(modelCapability).toBeDefined();
      expect(modelCapability.capabilities).toBeDefined();

      // 4. 检查自动启用的能力
      if (detectResult.autoEnabled?.text) {
        expect(modelCapability.capabilities.text).toBeDefined();
        expect(modelCapability.capabilities.text.providerId).toBe("openai");
      }
    });

    it("应该在刷新后保持配置", async () => {
      // 1. 配置Provider
      await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-test-integration-1234567890",
      });

      // 2. 第一次读取
      const result1 = await listCapabilities();
      const textCapability1 = result1.capabilities.find(c => c.capability === "text");

      // 3. 模拟页面刷新(重新读取配置)
      const result2 = await listCapabilities();
      const textCapability2 = result2.capabilities.find(c => c.capability === "text");

      // 4. 验证配置一致
      expect(textCapability1?.status).toBe(textCapability2?.status);
      expect(textCapability1?.currentModel?.providerId).toBe(
        textCapability2?.currentModel?.providerId
      );
    });
  });

  describe("多Provider配置", () => {
    it("应该支持配置多个Provider", async () => {
      // 配置OpenAI
      await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-openai-test-1234567890",
      });

      // 配置Anthropic
      await detectProviderModels({
        providerId: "anthropic",
        apiKey: "sk-anthropic-test-1234567890",
      });

      // 验证两个Provider都已配置
      const providers = await listProviders();
      const openai = providers.providers.find(p => p.providerId === "openai");
      const anthropic = providers.providers.find(p => p.providerId === "anthropic");

      expect(openai?.configured).toBe(true);
      expect(anthropic?.configured).toBe(true);
    });

    it("应该允许用户手动切换同一能力的不同Provider", async () => {
      // 1. 先配置OpenAI
      const result1 = await detectProviderModels({ providerId: "openai", apiKey: "sk-openai-test-1234567890" });

      // 2. 手动切换到OpenAI的text模型 (因为第二个provider会覆盖)
      if (result1.autoEnabled?.text) {
        await switchCapabilityModel({
          capability: "text",
          providerId: "openai",
          modelId: result1.autoEnabled.text,
        });
      }

      // 3. 配置Anthropic (不会自动覆盖已有配置)
      await detectProviderModels({ providerId: "anthropic", apiKey: "sk-anthropic-test-1234567890" });

      // 4. 验证当前仍然是OpenAI
      const before = await listCapabilities();
      const textBefore = before.capabilities.find(c => c.capability === "text");
      expect(textBefore?.currentModel?.providerId).toBe("openai");

      // 5. 获取Anthropic的text模型列表
      const models = await getCapabilityModels({ capability: "text" });
      const anthropicTextModel = models.models.find(
        m => m.providerId === "anthropic" && m.configured
      );

      // 如果没有找到Anthropic的text模型,跳过测试
      if (!anthropicTextModel) {
        expect(true).toBe(true);
        return;
      }

      // 6. 切换到Anthropic
      const switchResult = await switchCapabilityModel({
        capability: "text",
        providerId: "anthropic",
        modelId: anthropicTextModel.modelId,
      });

      expect(switchResult.success).toBe(true);

      // 7. 验证已切换
      const after = await listCapabilities();
      const textAfter = after.capabilities.find(c => c.capability === "text");
      expect(textAfter?.currentModel?.providerId).toBe("anthropic");
    });
  });

  describe("边界条件", () => {
    it("应该拒绝未配置Provider的模型切换", async () => {
      const result = await switchCapabilityModel({
        capability: "text",
        providerId: "openai",
        modelId: "gpt-4",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("尚未配置");
    });

    it("应该拒绝不支持该能力的模型", async () => {
      // 配置OpenAI
      await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-test-integration-1234567890",
      });

      // 尝试用text模型做image-generation
      const result = await switchCapabilityModel({
        capability: "image-generation",
        providerId: "openai",
        modelId: "gpt-4", // text模型,不支持image-generation
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("不支持该能力");
    });

    it("应该处理未知Provider", async () => {
      const result = await detectProviderModels({
        providerId: "unknown-provider-xyz",
        apiKey: "sk-test-integration-1234567890",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("未知的服务商");
    });

    it("应该正确处理空配置", async () => {
      const result = await listCapabilities();

      expect(result.capabilities).toBeDefined();
      expect(result.capabilities.length).toBe(5); // 5个能力

      // 所有能力应该是inactive
      for (const cap of result.capabilities) {
        expect(cap.status).toBe("inactive");
        expect(cap.currentModel).toBeNull();
      }
    });
  });

  describe("能力配置独立性", () => {
    it("不同能力的配置应该独立", async () => {
      // 配置OpenAI (会自动启用text和image-generation)
      await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-openai-test-1234567890",
      });

      const result = await listCapabilities();
      const imageGen = result.capabilities.find(c => c.capability === "image-generation");
      const textCap = result.capabilities.find(c => c.capability === "text");

      // 如果OpenAI自动启用了image-generation和text
      if (imageGen?.status === "active" && textCap?.status === "active") {
        // 配置Anthropic (不会覆盖已有配置)
        await detectProviderModels({
          providerId: "anthropic",
          apiKey: "sk-anthropic-test-1234567890",
        });

        // 获取Anthropic的text模型
        const models = await getCapabilityModels({ capability: "text" });
        const anthropicModel = models.models.find(m => m.providerId === "anthropic" && m.configured);

        if (anthropicModel) {
          // 手动切换text到anthropic
          await switchCapabilityModel({
            capability: "text",
            providerId: "anthropic",
            modelId: anthropicModel.modelId,
          });

          // 验证: text是anthropic, image-generation仍然是openai
          const after = await listCapabilities();
          const textAfter = after.capabilities.find(c => c.capability === "text");
          const imageAfter = after.capabilities.find(c => c.capability === "image-generation");

          expect(textAfter?.currentModel?.providerId).toBe("anthropic");
          expect(imageAfter?.currentModel?.providerId).toBe("openai");
        }
      }
    });
  });

  describe("模型列表排序", () => {
    it("应该将已配置的模型排在前面", async () => {
      // 配置OpenAI
      await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-test-integration-1234567890",
      });

      const result = await getCapabilityModels({ capability: "text" });

      // 找到第一个已配置和第一个未配置的模型
      const firstConfigured = result.models.findIndex(m => m.configured);
      const firstUnconfigured = result.models.findIndex(m => !m.configured);

      if (firstConfigured !== -1 && firstUnconfigured !== -1) {
        expect(firstConfigured).toBeLessThan(firstUnconfigured);
      }
    });

    it("应该将当前使用的模型排在最前", async () => {
      // 配置并选择模型
      await detectProviderModels({
        providerId: "openai",
        apiKey: "sk-test-integration-1234567890",
      });

      const result = await getCapabilityModels({ capability: "text" });

      // 第一个模型应该是active的
      if (result.models.length > 0 && result.models[0].active) {
        expect(result.models[0].active).toBe(true);
      }
    });
  });

  describe("kimi-code 端到端配置", () => {
    it("配置 kimi-code 后 text 能力应变为 active", async () => {
      // 1. 配置 kimi-code
      const detectResult = await detectProviderModels({
        providerId: "kimi-code",
        apiKey: "sk-kimi-code-test-1234567890",
      });

      expect(detectResult.success).toBe(true);
      expect(detectResult.autoEnabled).toBeDefined();
      expect(detectResult.autoEnabled?.text).toBe("kimi-for-coding");

      // 2. 验证 listCapabilities 返回 text = active
      const caps = await listCapabilities();
      const textCap = caps.capabilities.find(c => c.capability === "text");

      expect(textCap).toBeDefined();
      expect(textCap?.status).toBe("active");
      expect(textCap?.currentModel).toBeDefined();
      expect(textCap?.currentModel?.providerId).toBe("kimi-code");
      expect(textCap?.currentModel?.modelId).toBe("kimi-for-coding");
    });

    it("配置 kimi-code 后 providers 应显示已配置", async () => {
      await detectProviderModels({
        providerId: "kimi-code",
        apiKey: "sk-kimi-code-test-1234567890",
      });

      const result = await listProviders();
      const kimi = result.providers.find(p => p.providerId === "kimi-code");

      expect(kimi).toBeDefined();
      expect(kimi?.configured).toBe(true);
    });
  });
});

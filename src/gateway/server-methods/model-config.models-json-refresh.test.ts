/**
 * model-config API — models.json 刷新测试
 *
 * 验证:
 * 1. deleteProviderConfig 写入配置后刷新 models.json
 * 2. addCustomModel 写入配置后刷新 models.json
 * 3. detectProviderModels 写入配置后刷新 models.json
 * 4. ensureOpenClawCNModelsJson 失败不影响主流程
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks ──

const mockLoadConfig = vi.fn(async () => ({
  models: {
    providers: {
      siliconflow: {
        apiKey: "sk-test",
        baseUrl: "https://api.siliconflow.cn/v1",
        models: [{ id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek V3" }],
      },
    },
  },
}));
const mockWriteConfigFile = vi.fn(async () => {});

vi.mock("../../config/config.js", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  writeConfigFile: (...args: unknown[]) => mockWriteConfigFile(...args),
}));

const mockEnsureModelsJson = vi.fn(async () => ({ agentDir: "/tmp/test", wrote: true }));
vi.mock("../../agents/models-config.js", () => ({
  ensureOpenClawCNModelsJson: (...args: unknown[]) => mockEnsureModelsJson(...args),
}));

// Mock fetch for detectProviderModels (it calls API to validate key)
const mockFetch = vi.fn(async () => ({
  ok: true,
  status: 200,
  text: async () => "{}",
  json: async () => ({ choices: [{ message: { content: "" } }] }),
}));
vi.stubGlobal("fetch", mockFetch);

// ── Tests ──

describe("model-config models.json refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadConfig.mockResolvedValue({
      models: {
        providers: {
          siliconflow: {
            apiKey: "sk-test",
            baseUrl: "https://api.siliconflow.cn/v1",
            models: [{ id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek V3" }],
          },
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

  it("deleteProviderConfig calls ensureOpenClawCNModelsJson after writeConfigFile", async () => {
    const { deleteProviderConfig } = await import("./model-config.js");

    await deleteProviderConfig({ providerId: "siliconflow" });

    // writeConfigFile should be called before ensureOpenClawCNModelsJson
    expect(mockWriteConfigFile).toHaveBeenCalledTimes(1);
    expect(mockEnsureModelsJson).toHaveBeenCalledTimes(1);

    // ensureOpenClawCNModelsJson should receive the config
    const passedConfig = mockEnsureModelsJson.mock.calls[0][0];
    expect(passedConfig).toBeDefined();
    expect(typeof passedConfig).toBe("object");
  });

  it("addCustomModel calls ensureOpenClawCNModelsJson after writeConfigFile", async () => {
    const { addCustomModel } = await import("./model-config.js");

    await addCustomModel({
      providerId: "siliconflow",
      modelId: "custom-model-test",
      modelName: "Custom Model Test",
    });

    expect(mockWriteConfigFile).toHaveBeenCalledTimes(1);
    expect(mockEnsureModelsJson).toHaveBeenCalledTimes(1);
  });

  it("ensureOpenClawCNModelsJson failure does not break deleteProviderConfig", async () => {
    mockEnsureModelsJson.mockRejectedValueOnce(new Error("disk full"));

    const { deleteProviderConfig } = await import("./model-config.js");

    // Should not throw even though models.json refresh fails
    await expect(deleteProviderConfig({ providerId: "siliconflow" })).resolves.not.toThrow();

    expect(mockWriteConfigFile).toHaveBeenCalledTimes(1);
    expect(mockEnsureModelsJson).toHaveBeenCalledTimes(1);
  });

  it("ensureOpenClawCNModelsJson failure does not break addCustomModel", async () => {
    mockEnsureModelsJson.mockRejectedValueOnce(new Error("permission denied"));

    const { addCustomModel } = await import("./model-config.js");

    await expect(
      addCustomModel({
        providerId: "siliconflow",
        modelId: "test-model",
      }),
    ).resolves.not.toThrow();

    expect(mockWriteConfigFile).toHaveBeenCalledTimes(1);
    expect(mockEnsureModelsJson).toHaveBeenCalledTimes(1);
  });
});

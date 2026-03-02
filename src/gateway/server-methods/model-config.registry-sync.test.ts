/**
 * model-config ↔ capability-registry 同步测试
 *
 * 验证 addCustomModel / deleteProviderConfig / detectProviderModels
 * 在写入配置后正确更新 capability registry 的内存状态。
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock: config I/O ──

const mockLoadConfig = vi.fn(async () => ({
  models: {
    providers: {
      siliconflow: {
        apiKey: "sk-sf-test-key",
        baseUrl: "https://api.siliconflow.cn/v1",
        models: [],
      },
    },
  },
}));
const mockWriteConfigFile = vi.fn(async () => {});

vi.mock("../../config/config.js", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  writeConfigFile: (...args: unknown[]) => mockWriteConfigFile(...args),
  withConfigWriteLock: async (fn: () => Promise<unknown>) => fn(),
}));

// ── Mock: models.json refresh (non-critical, stub out) ──

vi.mock("../../agents/models-config.js", () => ({
  ensureOpenClawCNModelsJson: vi.fn(async () => {}),
}));

// ── Mock: auth helpers (used by refreshProviderConfigured) ──

vi.mock("../../agents/auth-profiles/store.js", () => ({
  loadAuthProfileStore: vi.fn(() => ({ profiles: {} })),
}));
vi.mock("../../agents/model-auth.js", () => ({
  hasUserConfiguredProvider: vi.fn(() => false),
}));

// ── Mock: fetch (probeModel sends a real HTTP request) ──

const mockFetch = vi.fn(async () => ({
  ok: true,
  status: 200,
  text: async () => "{}",
  json: async () => ({ choices: [{ message: { content: "" } }] }),
}));
vi.stubGlobal("fetch", mockFetch);

// ── Spy on capability-registry (real module, observe calls) ──

import {
  initCapabilityRegistry,
  resetRegistryForTests,
  findCard,
  queryByCapability,
  getAllCards,
} from "../../dispatch/capability-registry.js";

// ── Import SUT ──

import { addCustomModel, deleteProviderConfig } from "./model-config.js";

// ── Setup ──

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  resetRegistryForTests();
  initCapabilityRegistry({
    isProviderConfigured: (p) => ["siliconflow", "volcengine-ark", "deepseek"].includes(p),
  });

  // Default config with siliconflow configured
  mockLoadConfig.mockResolvedValue({
    models: {
      providers: {
        siliconflow: {
          apiKey: "sk-sf-test-key",
          baseUrl: "https://api.siliconflow.cn/v1",
          models: [],
        },
      },
    },
  });
});

// ---------------------------------------------------------------------------
// addCustomModel → capability registry sync
// ---------------------------------------------------------------------------

describe("addCustomModel → capability registry sync", () => {
  it("injects a user card into the registry after successful add", async () => {
    const before = getAllCards().length;

    const result = await addCustomModel({
      providerId: "siliconflow",
      modelId: "Qwen/Qwen3-8B",
    });

    expect(result.success).toBe(true);
    expect(getAllCards().length).toBe(before + 1);
    expect(findCard("siliconflow", "Qwen/Qwen3-8B")).toBeDefined();
  });

  it("injected card has text and code capabilities", async () => {
    await addCustomModel({
      providerId: "siliconflow",
      modelId: "Qwen/Qwen3-8B",
    });

    const card = findCard("siliconflow", "Qwen/Qwen3-8B");
    expect(card).toBeDefined();
    expect(card!.capabilities.text).toBe(3);
    expect(card!.capabilities.code).toBe(2);
  });

  it("injected card includes vision when input has image", async () => {
    // Use a modelId that does NOT collide with builtin card aliases
    await addCustomModel({
      providerId: "siliconflow",
      modelId: "custom/my-vision-finetune-v1",
      input: ["text", "image"],
    });

    const card = findCard("siliconflow", "custom/my-vision-finetune-v1");
    expect(card).toBeDefined();
    expect(card!.capabilities.text).toBe(3);
    expect(card!.capabilities.code).toBe(2);
    expect(card!.capabilities.vision).toBe(2);
  });

  it("injected card is visible in queryByCapability('text')", async () => {
    await addCustomModel({
      providerId: "siliconflow",
      modelId: "custom/my-model",
    });

    const results = queryByCapability("text", { configuredOnly: true });
    const found = results.find((r) => r.modelId === "custom/my-model");
    expect(found).toBeDefined();
    expect(found!.runtime.configured).toBe(true);
  });

  it("injected card is visible in queryByCapability('code')", async () => {
    await addCustomModel({
      providerId: "siliconflow",
      modelId: "custom/my-model",
    });

    const results = queryByCapability("code", { configuredOnly: true });
    const found = results.find((r) => r.modelId === "custom/my-model");
    expect(found).toBeDefined();
  });

  it("sets region=domestic for CN provider", async () => {
    await addCustomModel({
      providerId: "siliconflow",
      modelId: "custom/cn-model",
    });

    const card = findCard("siliconflow", "custom/cn-model");
    expect(card!.region).toBe("domestic");
  });

  it("does not inject card when addCustomModel fails (no provider)", async () => {
    mockLoadConfig.mockResolvedValue({
      models: { providers: {} },
    });

    const before = getAllCards().length;
    await expect(addCustomModel({ providerId: "siliconflow", modelId: "test" })).rejects.toThrow();
    expect(getAllCards().length).toBe(before);
  });

  it("does not inject card when model already exists", async () => {
    mockLoadConfig.mockResolvedValue({
      models: {
        providers: {
          siliconflow: {
            apiKey: "sk-sf-test-key",
            models: [{ id: "existing-model" }],
          },
        },
      },
    });

    const before = getAllCards().length;
    await expect(
      addCustomModel({ providerId: "siliconflow", modelId: "existing-model" }),
    ).rejects.toThrow(/已存在/);
    expect(getAllCards().length).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// deleteProviderConfig → capability registry cleanup
// ---------------------------------------------------------------------------

describe("deleteProviderConfig → capability registry cleanup", () => {
  it("removes user cards for the deleted provider", async () => {
    // First add a custom model
    await addCustomModel({
      providerId: "siliconflow",
      modelId: "custom/to-delete",
    });
    expect(findCard("siliconflow", "custom/to-delete")).toBeDefined();

    // Now delete the provider
    const result = await deleteProviderConfig({ providerId: "siliconflow" });
    expect(result.success).toBe(true);

    // User card should be gone
    expect(findCard("siliconflow", "custom/to-delete")).toBeUndefined();
  });

  it("does not remove builtin cards for the same provider", async () => {
    // deepseek has builtin cards
    const builtinBefore = findCard("deepseek", "deepseek-chat");
    expect(builtinBefore).toBeDefined();

    // Add a custom card for deepseek
    mockLoadConfig.mockResolvedValue({
      models: {
        providers: {
          deepseek: {
            apiKey: "sk-ds-test",
            models: [],
          },
        },
      },
    });
    await addCustomModel({
      providerId: "deepseek",
      modelId: "deepseek-custom-ft",
    });

    // Delete provider
    await deleteProviderConfig({ providerId: "deepseek" });

    // Builtin card should survive, custom should be gone
    expect(findCard("deepseek", "deepseek-chat")).toBeDefined();
    expect(findCard("deepseek", "deepseek-custom-ft")).toBeUndefined();
  });

  it("does not affect other providers' user cards", async () => {
    // Add cards for two providers
    await addCustomModel({
      providerId: "siliconflow",
      modelId: "sf-model",
    });

    mockLoadConfig.mockResolvedValue({
      models: {
        providers: {
          volcengine: {
            apiKey: "ak-test",
            models: [],
          },
        },
      },
    });

    // Delete volcengine only
    await deleteProviderConfig({ providerId: "volcengine" });

    // siliconflow card should survive
    expect(findCard("siliconflow", "sf-model")).toBeDefined();
  });
});

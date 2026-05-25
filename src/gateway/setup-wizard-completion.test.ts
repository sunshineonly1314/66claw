/**
 * Setup Wizard 完成流程测试
 *
 * 验证 shouldShowSetupWizard 在不同配置状态下的行为：
 * - 全新安装 → 显示 setup
 * - 已配置 apiKey + workspace → 不显示
 * - 完整安装（有 setup.completedAt）→ 不显示
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config module - factory must not reference outer variables
vi.mock("../config/config.js", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    loadConfig: vi.fn(() => ({})),
    writeConfigFile: vi.fn(),
  };
});

vi.mock("../config/region-cn.js", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    detectChinaRegion: () => false,
  };
});

vi.mock("../commands/onboard-auth.js", () => ({
  setSiliconFlowApiKey: vi.fn(),
  setDeepSeekApiKey: vi.fn(),
  setGlmApiKey: vi.fn(),
  setAliyunBailianApiKey: vi.fn(),
  setVolcengineArkApiKey: vi.fn(),
  setTencentHunyuanApiKey: vi.fn(),
  setMinimaxApiKey: vi.fn(),
  setGeminiApiKey: vi.fn(),
  setOpenAiApiKey: vi.fn(),
  setAnthropicApiKey: vi.fn(),
  setNvidiaApiKey: vi.fn(),
  setMoonshotApiKey: vi.fn(),
  setModelscopeApiKey: vi.fn(),
  setKimiCodeApiKey: vi.fn(),
  setOllamaApiKey: vi.fn(),
}));

vi.mock("./setup-page.js", () => ({
  serveSetupPage: vi.fn(),
}));

vi.mock("../agents/siliconflow-models.js", () => ({
  discoverSiliconFlowModels: vi.fn(),
}));

vi.mock("../infra/restart.js", () => ({
  scheduleGatewaySigusr1Restart: vi.fn(),
}));

vi.mock("../agents/free-model-scheduler.js", () => ({
  FreeModelScheduler: class {
    static shared = { refreshConfig: vi.fn() };
  },
}));

vi.mock("../config/types.free-models.js", () => ({
  DEFAULT_FREE_MODELS_CONFIG: {},
}));

import { loadConfig } from "../config/config.js";
import { shouldShowSetupWizard } from "./setup-wizard.js";

const mockedLoadConfig = vi.mocked(loadConfig);

describe("shouldShowSetupWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("全新安装（空配置）→ 显示 setup", () => {
    mockedLoadConfig.mockReturnValue({});
    expect(shouldShowSetupWizard()).toBe(true);
  });

  it("只有 apiKey 没有 workspace → 显示 setup", () => {
    mockedLoadConfig.mockReturnValue({
      auth: { profiles: { default: { apiKey: "sk-xxx" } } },
    });
    expect(shouldShowSetupWizard()).toBe(true);
  });

  it("有 apiKey + workspace → 不显示 setup", () => {
    mockedLoadConfig.mockReturnValue({
      auth: { profiles: { default: { apiKey: "sk-xxx" } } },
      agents: { defaults: { workspace: "/home/user" } },
    });
    expect(shouldShowSetupWizard()).toBe(false);
  });

  it("legacy license 字段不影响 setup 判断", () => {
    mockedLoadConfig.mockReturnValue({
      license: { key: "clawd-xxx" },
    });
    expect(shouldShowSetupWizard()).toBe(true);
  });

  it("有 apiKey + workspace + setup.completedAt → 不显示 setup", () => {
    mockedLoadConfig.mockReturnValue({
      auth: { profiles: { default: { apiKey: "sk-xxx" } } },
      agents: { defaults: { workspace: "/home/user" } },
      setup: { completedAt: "2026-02-08T00:00:00.000Z" },
    });
    expect(shouldShowSetupWizard()).toBe(false);
  });

  it("有 setup.completedAt 但无 apiKey/workspace → 不显示 setup（显式完成标记优先）", () => {
    mockedLoadConfig.mockReturnValue({
      setup: { completedAt: "2026-02-08T00:00:00.000Z" },
    });
    expect(shouldShowSetupWizard()).toBe(false);
  });

});

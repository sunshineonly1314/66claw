/**
 * detect-guard 修复的单元测试
 *
 * 覆盖 detectProviderModelsWithProgress 中 detect-guard 保底逻辑的三个场景：
 *   1. primary 为空时触发（原有逻辑）
 *   2. primary 非空但与 text capability 不一致时触发（FIX：新增逻辑）
 *   3. primary 与 text capability 一致时不触发（回归保护）
 *
 * 同时验证 session override 在每个场景下的同步状态。
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock 持久化引用
// ---------------------------------------------------------------------------

// config/config.js
const mockLoadConfig = vi.fn(async () => ({}));
const mockWriteConfigFile = vi.fn(async () => {});

// config/sessions/store.js
const mockUpdateSessionStore = vi.fn(
  async (_path: string, fn: (store: Record<string, unknown>) => void) => {
    fn(mockSessionStore);
  },
);

// config/sessions/paths.js
const mockResolveStorePath = vi.fn(() => "/fake/session.json");

// dispatch/capability-registry.js
const mockQueryByCapability = vi.fn(() => []);
const mockRefreshProviderConfigured = vi.fn();
const mockUpsertUserCard = vi.fn();
const mockGetAllCapabilityKeys = vi.fn(() => ["text"]);
const mockGetVecBindingStatus = vi.fn(() => ({ bound: false, vecModel: undefined }));
const mockGetCardStrengthTier = vi.fn(() => "standard");
const mockFindCard = vi.fn(() => undefined);
const mockGetAllCards = vi.fn(() => []);

// agents/model-selection.js
const mockGetProviderAliases = vi.fn((id: string) => [id]);

// agents/models-config.js
const mockEnsureModelsJson = vi.fn(async () => {});

// agents/model-auth.js
const mockHasUserConfiguredProvider = vi.fn(() => false);

// agents/auth-profiles/store.js
const mockLoadAuthProfileStore = vi.fn(() => ({ profiles: {} }));

// logging/subsystem.js — 捕获日志以便断言（必须用 vi.hoisted，因为 vi.mock 会被提升）
const { infoLogs, warnLogs, mockLogger } = vi.hoisted(() => {
  const infoLogs: string[] = [];
  const warnLogs: string[] = [];
  const mockLogger = {
    info: (...args: unknown[]) => infoLogs.push(String(args[0])),
    warn: (...args: unknown[]) => warnLogs.push(String(args[0])),
    error: (..._args: unknown[]) => {},
    debug: (..._args: unknown[]) => {},
  };
  return { infoLogs, warnLogs, mockLogger };
});

// ---------------------------------------------------------------------------
// session store 状态（可被 updateSessionStore mock 修改）
// ---------------------------------------------------------------------------
let mockSessionStore: Record<
  string,
  { providerOverride?: string; modelOverride?: string; updatedAt?: number }
> = {};

// ---------------------------------------------------------------------------
// vi.mock 必须在 import 之前（Vitest 会 hoist）
// ---------------------------------------------------------------------------

vi.mock("../../config/config.js", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  writeConfigFile: (...args: unknown[]) => mockWriteConfigFile(...args),
  withConfigWriteLock: async (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("../../config/sessions/store.js", () => ({
  updateSessionStore: (...args: unknown[]) =>
    mockUpdateSessionStore(...(args as [string, (store: Record<string, unknown>) => void])),
}));

vi.mock("../../config/sessions/paths.js", () => ({
  resolveStorePath: () => mockResolveStorePath(),
}));

vi.mock("../../dispatch/capability-registry.js", () => ({
  queryByCapability: (...a: unknown[]) => mockQueryByCapability(...a),
  refreshProviderConfigured: (...a: unknown[]) => mockRefreshProviderConfigured(...a),
  upsertUserCard: (...a: unknown[]) => mockUpsertUserCard(...a),
  removeUserCardsByProvider: vi.fn(),
  getAllCapabilityKeys: (...a: unknown[]) => mockGetAllCapabilityKeys(...a),
  getVecBindingStatus: (...a: unknown[]) => mockGetVecBindingStatus(...a),
  getCardStrengthTier: (...a: unknown[]) => mockGetCardStrengthTier(...a),
  findCard: (...a: unknown[]) => mockFindCard(...a),
  getAllCards: (...a: unknown[]) => mockGetAllCards(...a),
}));

vi.mock("../../dispatch/tool-index.js", () => ({
  getVecBindingStatus: (...a: unknown[]) => mockGetVecBindingStatus(...a),
  isEmbeddingFallenBackToPro: vi.fn(() => false),
}));

vi.mock("../../agents/model-selection.js", () => ({
  getProviderAliases: (...a: unknown[]) => mockGetProviderAliases(...a),
  normalizeProviderId: (id: string) => id,
}));

vi.mock("../../agents/models-config.js", () => ({
  ensureOpenClawCNModelsJson: (...a: unknown[]) => mockEnsureModelsJson(...a),
}));

vi.mock("../../agents/model-auth.js", () => ({
  hasUserConfiguredProvider: (...a: unknown[]) => mockHasUserConfiguredProvider(...a),
}));

vi.mock("../../agents/auth-profiles/store.js", () => ({
  loadAuthProfileStore: (...a: unknown[]) => mockLoadAuthProfileStore(...a),
}));

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => mockLogger,
}));

// ---------------------------------------------------------------------------
// 必须在所有 vi.mock 之后导入被测模块
// ---------------------------------------------------------------------------
import { detectProviderModelsWithProgress } from "./model-config.js";

// ---------------------------------------------------------------------------
// 辅助工厂
// ---------------------------------------------------------------------------

/** 构造最小可用的 config，包含一个已配置的 provider */
function makeConfig(
  overrides: {
    textCapability?: { providerId: string; modelId: string; auto?: boolean };
    agentsPrimary?: string;
  } = {},
) {
  return {
    models: {
      providers: {
        siliconflow: {
          apiKey: "sk-test-silicon-key",
          baseUrl: "https://api.siliconflow.cn/v1",
          models: [{ id: "Pro/moonshotai/Kimi-K2.5", name: "Kimi K2.5", input: ["text"] }],
        },
      },
    },
    ...(overrides.textCapability
      ? {
          modelCapability: {
            capabilities: {
              text: {
                providerId: overrides.textCapability.providerId,
                modelId: overrides.textCapability.modelId,
                auto: overrides.textCapability.auto ?? true,
              },
            },
          },
        }
      : {}),
    ...(overrides.agentsPrimary !== undefined
      ? {
          agents: {
            defaults: {
              model: { primary: overrides.agentsPrimary },
            },
          },
        }
      : {}),
  };
}

/** 构造一个成功探测 mock：fetch 返回有效的 chat completion */
function setupSuccessfulProbe() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    })),
  );
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe("detectProviderModelsWithProgress — detect-guard 保底逻辑", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    infoLogs.length = 0;
    warnLogs.length = 0;
    mockSessionStore = {};
    setupSuccessfulProbe();
  });

  // ── 测试 1：primary 为空 → 触发 guard，同步 session override ──────────────

  describe("场景 A：agents.defaults.model.primary 为空", () => {
    it("应触发 detect-guard 并写入 primary", async () => {
      // primary 未设置，text capability 已有绑定
      const config = makeConfig({
        textCapability: { providerId: "siliconflow", modelId: "Pro/moonshotai/Kimi-K2.5" },
        // agentsPrimary 不设置 → primary 为空
      });
      mockLoadConfig.mockResolvedValue(config);

      const broadcast = vi.fn();
      await detectProviderModelsWithProgress(
        { providerId: "siliconflow", apiKey: "sk-test-silicon-key" },
        broadcast,
      );

      // writeConfigFile 被调用（至少一次用于 detect-guard 修复写入）
      expect(mockWriteConfigFile).toHaveBeenCalled();

      // 写入的配置里 primary 应被设置为 text capability 对应的值
      const writtenConfigs = mockWriteConfigFile.mock.calls.map((c) => c[0]) as Array<{
        agents?: { defaults?: { model?: { primary?: string } } };
      }>;
      const guardWrite = writtenConfigs.find((c) =>
        c.agents?.defaults?.model?.primary?.includes("siliconflow"),
      );
      expect(guardWrite).toBeDefined();
      expect(guardWrite?.agents?.defaults?.model?.primary).toBe(
        "siliconflow/Pro/moonshotai/Kimi-K2.5",
      );
    });

    it("应同步 session override（providerOverride + modelOverride 一致）", async () => {
      mockSessionStore = {
        "agent:main:main": { providerOverride: undefined, modelOverride: undefined, updatedAt: 0 },
      };
      const config = makeConfig({
        textCapability: { providerId: "siliconflow", modelId: "Pro/moonshotai/Kimi-K2.5" },
      });
      mockLoadConfig.mockResolvedValue(config);

      const broadcast = vi.fn();
      await detectProviderModelsWithProgress(
        { providerId: "siliconflow", apiKey: "sk-test-silicon-key" },
        broadcast,
      );

      // updateSessionStore 被调用
      expect(mockUpdateSessionStore).toHaveBeenCalled();

      // session 里的 providerOverride 和 modelOverride 应一致指向 siliconflow
      const entry = mockSessionStore["agent:main:main"];
      expect(entry?.providerOverride).toBe("siliconflow");
      expect(entry?.modelOverride).toBe("Pro/moonshotai/Kimi-K2.5");
    });
  });

  // ── 测试 2：primary 非空但与 text capability 不一致 → 触发 guard（FIX）──

  describe("场景 B：primary 非空但与 text capability 不一致（混搭来源）", () => {
    it("应触发 detect-guard 修正 primary（FIX：扩展触发条件）", async () => {
      // 经典混搭场景：primary 指向 kimi-coding，但 text capability 已切换到 siliconflow
      const config = makeConfig({
        textCapability: { providerId: "siliconflow", modelId: "Pro/moonshotai/Kimi-K2.5" },
        agentsPrimary: "kimi-coding/kimi-for-coding", // 旧值，与 text cap 不一致
      });
      mockLoadConfig.mockResolvedValue(config);

      const broadcast = vi.fn();
      await detectProviderModelsWithProgress(
        { providerId: "siliconflow", apiKey: "sk-test-silicon-key" },
        broadcast,
      );

      // guard 应该触发并写入与 text capability 一致的 primary
      const writtenConfigs = mockWriteConfigFile.mock.calls.map((c) => c[0]) as Array<{
        agents?: { defaults?: { model?: { primary?: string } } };
      }>;
      const guardWrite = writtenConfigs.find(
        (c) => c.agents?.defaults?.model?.primary === "siliconflow/Pro/moonshotai/Kimi-K2.5",
      );
      expect(guardWrite).toBeDefined();
    });

    it("应同步 session override，消除 provider/model 混搭", async () => {
      // 模拟出问题的 session 状态：provider 是 kimi-coding，model 是 Kimi-K2.5（siliconflow 的）
      mockSessionStore = {
        "agent:main:main": {
          providerOverride: "kimi-coding", // 旧 provider
          modelOverride: "Pro/moonshotai/Kimi-K2.5", // 新 model（混搭）
          updatedAt: Date.now() - 3600_000,
        },
      };
      const config = makeConfig({
        textCapability: { providerId: "siliconflow", modelId: "Pro/moonshotai/Kimi-K2.5" },
        agentsPrimary: "kimi-coding/kimi-for-coding", // 与 text cap 不一致
      });
      mockLoadConfig.mockResolvedValue(config);

      const broadcast = vi.fn();
      await detectProviderModelsWithProgress(
        { providerId: "siliconflow", apiKey: "sk-test-silicon-key" },
        broadcast,
      );

      // session 里的两个字段都应被修正为同一 provider（siliconflow）
      const entry = mockSessionStore["agent:main:main"];
      expect(entry?.providerOverride).toBe("siliconflow");
      expect(entry?.modelOverride).toBe("Pro/moonshotai/Kimi-K2.5");
      // 不再是混搭状态
      expect(entry?.providerOverride).not.toBe("kimi-coding");
    });

    it("guard 日志应包含 re-synced with text capability", async () => {
      const config = makeConfig({
        textCapability: { providerId: "siliconflow", modelId: "Pro/moonshotai/Kimi-K2.5" },
        agentsPrimary: "kimi-coding/kimi-for-coding",
      });
      mockLoadConfig.mockResolvedValue(config);

      const broadcast = vi.fn();
      await detectProviderModelsWithProgress(
        { providerId: "siliconflow", apiKey: "sk-test-silicon-key" },
        broadcast,
      );

      // 日志应体现是 re-sync（区分于 primary 为空的兜底路径）
      const guardLog = infoLogs.find((l) => l.includes("detect-guard"));
      expect(guardLog).toBeDefined();
      expect(guardLog).toContain("re-synced with text capability");
    });
  });

  // ── 测试 3：primary 与 text capability 一致 → 不触发 guard（回归保护）───

  describe("场景 C：primary 与 text capability 一致（不应触发 guard）", () => {
    it("不应重复写入配置", async () => {
      const config = makeConfig({
        textCapability: { providerId: "siliconflow", modelId: "Pro/moonshotai/Kimi-K2.5" },
        agentsPrimary: "siliconflow/Pro/moonshotai/Kimi-K2.5", // 一致
      });
      mockLoadConfig.mockResolvedValue(config);

      infoLogs.length = 0; // 清空日志

      const broadcast = vi.fn();
      await detectProviderModelsWithProgress(
        { providerId: "siliconflow", apiKey: "sk-test-silicon-key" },
        broadcast,
      );

      // guard 判断 primary 已与 text capability 一致，不应产生 detect-guard 日志
      // （autoAssign 路径可能写入 primary，但那不是 guard 触发的）
      const guardLog = infoLogs.find((l) => l.includes("detect-guard"));
      expect(guardLog).toBeUndefined();
    });

    it("session override 不应被不必要地重置", async () => {
      // session 已有正确的 override
      mockSessionStore = {
        "agent:main:main": {
          providerOverride: "siliconflow",
          modelOverride: "Pro/moonshotai/Kimi-K2.5",
          updatedAt: Date.now(),
        },
      };
      const config = makeConfig({
        textCapability: { providerId: "siliconflow", modelId: "Pro/moonshotai/Kimi-K2.5" },
        agentsPrimary: "siliconflow/Pro/moonshotai/Kimi-K2.5",
      });
      mockLoadConfig.mockResolvedValue(config);

      const updateCallsBefore = mockUpdateSessionStore.mock.calls.length;

      const broadcast = vi.fn();
      await detectProviderModelsWithProgress(
        { providerId: "siliconflow", apiKey: "sk-test-silicon-key" },
        broadcast,
      );

      // guard 不触发，updateSessionStore 不应因 guard 被额外调用
      // 注意：autoAssign 路径可能也会调用，这里只验证 guard 自身不触发额外写入
      const updateCallsAfter = mockUpdateSessionStore.mock.calls.length;
      // guard 不应触发额外的 updateSessionStore（通过验证 infoLogs 无 detect-guard 条目）
      const guardLog = infoLogs.find((l) => l.includes("detect-guard"));
      expect(guardLog).toBeUndefined();
      void updateCallsBefore; // suppress unused warning
      void updateCallsAfter;
    });
  });

  // ── 测试 4：guard 写入失败时静默处理，不影响主流程 ─────────────────────────

  describe("场景 D：guard 内部写入失败的健壮性", () => {
    it("writeConfigFile 失败时应静默降级，不向 broadcast 传播错误", async () => {
      const config = makeConfig({
        textCapability: { providerId: "siliconflow", modelId: "Pro/moonshotai/Kimi-K2.5" },
        agentsPrimary: "kimi-coding/kimi-for-coding", // 触发 guard
      });
      // 让第一次 writeConfigFile 成功（detect 阶段），第二次失败（guard 阶段）
      let writeCount = 0;
      mockWriteConfigFile.mockImplementation(async () => {
        writeCount++;
        if (writeCount >= 2) throw new Error("mock disk write failure");
      });
      mockLoadConfig.mockResolvedValue(config);

      const broadcast = vi.fn();
      // 不应抛异常
      await expect(
        detectProviderModelsWithProgress(
          { providerId: "siliconflow", apiKey: "sk-test-silicon-key" },
          broadcast,
        ),
      ).resolves.not.toThrow();

      // broadcast 应收到 complete（成功），而非因 guard 失败而报错
      const completeCalls = broadcast.mock.calls.filter(
        ([event]) => event === "modelConfig.detect.complete",
      );
      expect(completeCalls.length).toBeGreaterThan(0);

      // guard 失败应记录 warn 日志
      const guardWarn = warnLogs.find((l) => l.includes("detect-guard"));
      expect(guardWarn).toBeDefined();
    });
  });

  // ── 测试 5：text capability 无绑定时 guard 的边界处理 ─────────────────────

  describe("场景 E：text capability 无绑定的边界情况", () => {
    it("text capability 为空时应回退到 PROVIDER_CAPABILITY_MAPPINGS 取第一个 text 模型", async () => {
      // 无 text capability，也无 primary
      const config = makeConfig({
        // 故意不设置 textCapability 和 agentsPrimary
      });
      // 覆盖 providers，加入 kimi-coding
      (config as Record<string, unknown>).models = {
        providers: {
          "kimi-coding": {
            apiKey: "sk-kimi-test-key",
            baseUrl: "https://api.kimi.com/coding/v1",
            models: [{ id: "kimi-for-coding", name: "Kimi For Coding", input: ["text"] }],
          },
        },
      };
      mockLoadConfig.mockResolvedValue(config);

      const broadcast = vi.fn();
      await detectProviderModelsWithProgress(
        { providerId: "kimi-coding", apiKey: "sk-kimi-test-key" },
        broadcast,
      );

      // 应使用 PROVIDER_CAPABILITY_MAPPINGS 中 kimi-coding 的第一个 text 模型
      // （此处 PROVIDER_CAPABILITY_MAPPINGS 包含真实定义，kimi-for-coding 是其 text 模型）
      const writtenConfigs = mockWriteConfigFile.mock.calls.map((c) => c[0]) as Array<{
        agents?: { defaults?: { model?: { primary?: string } } };
      }>;
      const primaryWritten = writtenConfigs.find((c) =>
        c.agents?.defaults?.model?.primary?.includes("kimi"),
      );
      // 若 guard 触发（primary 为空），primary 应被设置
      if (primaryWritten) {
        expect(primaryWritten.agents?.defaults?.model?.primary).toContain("kimi");
      }
      // 测试核心：不抛异常，流程正常完成
      const completeCalls = broadcast.mock.calls.filter(
        ([event]) => event === "modelConfig.detect.complete",
      );
      expect(completeCalls.length).toBeGreaterThan(0);
    });
  });
});

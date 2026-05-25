/**
 * Setup Wizard — models.json 刷新测试
 *
 * 验证:
 * 1. handleConfigureProvider (custom) 写入配置后刷新 models.json
 * 2. handleConfigureProvider (known provider) 写入配置后刷新 models.json 并注入 authStore
 * 3. handleComplete 写入配置后刷新 models.json
 * 4. models.json 刷新失败不影响主流程（HTTP 200 仍然返回）
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";

// ── Mocks ──

const mockLoadConfig = vi.fn(() => ({}));
const mockWriteConfigFile = vi.fn(async () => {});

vi.mock("../config/config.js", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
    writeConfigFile: (...args: unknown[]) => mockWriteConfigFile(...args),
  };
});

const mockEnsureModelsJson = vi.fn(async () => ({ agentDir: "/tmp/test", wrote: true }));
vi.mock("../agents/models-config.js", () => ({
  ensureOpenClawCNModelsJson: (...args: unknown[]) => mockEnsureModelsJson(...args),
}));

const mockEnsureAuthProfileStore = vi.fn(() => ({
  version: 1,
  profiles: {},
}));
vi.mock("../agents/auth-profiles/store.js", () => ({
  ensureAuthProfileStore: (...args: unknown[]) => mockEnsureAuthProfileStore(...args),
}));

vi.mock("../config/region-cn.js", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    detectChinaRegion: () => false,
    CN_PROVIDERS: {
      siliconflow: {
        name: "SiliconFlow",
        models: [{ id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek V3" }],
      },
    },
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
  setZaiApiKey: vi.fn(),
  setAnthropicApiKey: vi.fn(),
  setMoonshotApiKey: vi.fn(),
  setKimiCodingApiKey: vi.fn(),
  setModelscopeApiKey: vi.fn(),
  setOpenrouterApiKey: vi.fn(),
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

vi.mock("../config/free-model-providers.js", () => ({
  getAllFreeModelProviders: () => [],
  getFreeModelProvider: () => null,
}));

vi.mock("../agents/model-selection.js", () => ({
  normalizeProviderId: (id: string) => {
    if (id === "kimi-code") return "kimi-coding";
    return id;
  },
}));


// ── Helpers ──

function createMockRequest(body: unknown): IncomingMessage {
  const chunks = [Buffer.from(JSON.stringify(body))];
  const req = {
    method: "POST",
    url: "/api/setup/configure-provider",
    headers: { "content-type": "application/json" },
    on: vi.fn((event: string, cb: (data?: Buffer) => void) => {
      if (event === "data") {
        for (const chunk of chunks) cb(chunk);
      }
      if (event === "end") cb();
      return req;
    }),
    removeListener: vi.fn(() => req),
  } as unknown as IncomingMessage;
  return req;
}

function createMockResponse(): ServerResponse & { _status: number; _body: unknown } {
  const res = {
    _status: 0,
    _body: null as unknown,
    _headers: {} as Record<string, string>,
    statusCode: 0,
    writeHead: vi.fn(function (this: typeof res, code: number) {
      this._status = code;
      this.statusCode = code;
      return this;
    }),
    setHeader: vi.fn(function (this: typeof res, key: string, val: string) {
      this._headers[key] = val;
      return this;
    }),
    end: vi.fn(function (this: typeof res, body?: string) {
      if (body) {
        try {
          this._body = JSON.parse(body);
        } catch {
          this._body = body;
        }
      }
      this._status = this.statusCode;
    }),
  } as unknown as ServerResponse & { _status: number; _body: unknown; statusCode: number };
  return res;
}

// ── Tests ──

describe("setup-wizard models.json refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadConfig.mockReturnValue({});
  });

  describe("handleConfigureProvider - custom provider", () => {
    it("calls ensureOpenClawCNModelsJson after writeConfigFile for custom provider", async () => {
      const { handleConfigureProvider } = await import("./setup-wizard-handlers.js");

      const req = createMockRequest({
        provider: "custom",
        apiKey: "sk-custom-test",
        endpoint: "http://custom.api/v1",
        model: "my-model",
      });
      const res = createMockResponse();

      await handleConfigureProvider(req, res);

      // writeConfigFile is called twice: once for provider config, once for
      // updateSetupState checkpoint.  We only care that it was called.
      expect(mockWriteConfigFile).toHaveBeenCalled();
      expect(mockEnsureModelsJson).toHaveBeenCalledTimes(1);

      // Custom provider does NOT pass authStore (apiKey inline in config)
      const args = mockEnsureModelsJson.mock.calls[0];
      const passedConfig = args[0];
      expect(passedConfig.models?.providers?.["custom-openai"]).toBeDefined();
      expect(passedConfig.models?.providers?.["custom-openai"]?.apiKey).toBe("sk-custom-test");
    });
  });

  describe("handleConfigureProvider - known provider", () => {
    it("calls ensureOpenClawCNModelsJson with authStore for known provider", async () => {
      const { handleConfigureProvider } = await import("./setup-wizard-handlers.js");

      const req = createMockRequest({
        provider: "siliconflow",
        apiKey: "sk-sf-test",
      });
      const res = createMockResponse();

      await handleConfigureProvider(req, res);

      expect(mockWriteConfigFile).toHaveBeenCalled();
      expect(mockEnsureModelsJson).toHaveBeenCalledTimes(1);

      // Known provider DOES pass authStore to avoid encrypted race
      const args = mockEnsureModelsJson.mock.calls[0];
      expect(args.length).toBeGreaterThanOrEqual(3);
      const passedAuthStore = args[2];
      expect(passedAuthStore).toBeDefined();
      // The auth store should have the just-written credential injected
      expect(passedAuthStore.profiles["siliconflow:default"]).toBeDefined();
    });

    it("injects credential into authStore when not present from disk", async () => {
      // Simulate encrypted mode: ensureAuthProfileStore returns stale (empty) store
      mockEnsureAuthProfileStore.mockReturnValue({
        version: 1,
        profiles: {},
      });

      const { handleConfigureProvider } = await import("./setup-wizard-handlers.js");

      const req = createMockRequest({
        provider: "siliconflow",
        apiKey: "sk-sf-encrypted-test",
      });
      const res = createMockResponse();

      await handleConfigureProvider(req, res);

      const args = mockEnsureModelsJson.mock.calls[0];
      const passedAuthStore = args[2];
      // Even though disk was empty, the credential should be injected
      expect(passedAuthStore.profiles["siliconflow:default"]).toEqual({
        type: "api_key",
        provider: "siliconflow",
        key: "sk-sf-encrypted-test",
      });
    });

    it("does not overwrite existing profile in authStore", async () => {
      // Simulate plaintext mode: ensureAuthProfileStore returns fresh store with credential
      mockEnsureAuthProfileStore.mockReturnValue({
        version: 1,
        profiles: {
          "siliconflow:default": {
            type: "api_key",
            provider: "siliconflow",
            key: "sk-sf-from-disk",
          },
        },
      });

      const { handleConfigureProvider } = await import("./setup-wizard-handlers.js");

      const req = createMockRequest({
        provider: "siliconflow",
        apiKey: "sk-sf-new",
      });
      const res = createMockResponse();

      await handleConfigureProvider(req, res);

      const args = mockEnsureModelsJson.mock.calls[0];
      const passedAuthStore = args[2];
      // Should keep the disk version (not overwrite)
      expect(passedAuthStore.profiles["siliconflow:default"].key).toBe("sk-sf-from-disk");
    });
  });

  describe("handleComplete", () => {
    it("calls ensureOpenClawCNModelsJson on setup completion", async () => {
      const { handleComplete } = await import("./setup-wizard-handlers.js");

      const req = createMockRequest({});
      const res = createMockResponse();

      await handleComplete(req, res);

      expect(mockWriteConfigFile).toHaveBeenCalledTimes(1);
      expect(mockEnsureModelsJson).toHaveBeenCalledTimes(1);

      // handleComplete does NOT pass authStore
      const args = mockEnsureModelsJson.mock.calls[0];
      // Only config is passed (no authStore)
      expect(args[0]).toBeDefined(); // config
    });
  });

  describe("models.json refresh failure resilience", () => {
    it("returns HTTP 200 even when models.json refresh fails for custom provider", async () => {
      mockEnsureModelsJson.mockRejectedValueOnce(new Error("disk full"));

      const { handleConfigureProvider } = await import("./setup-wizard-handlers.js");

      const req = createMockRequest({
        provider: "custom",
        apiKey: "sk-test",
        endpoint: "http://api.test/v1",
        model: "test-model",
      });
      const res = createMockResponse();

      await handleConfigureProvider(req, res);

      expect(res._status).toBe(200);
      expect((res._body as { ok: boolean }).ok).toBe(true);
    });

    it("returns HTTP 200 even when models.json refresh fails for known provider", async () => {
      mockEnsureModelsJson.mockRejectedValueOnce(new Error("permission denied"));

      const { handleConfigureProvider } = await import("./setup-wizard-handlers.js");

      const req = createMockRequest({
        provider: "siliconflow",
        apiKey: "sk-test",
      });
      const res = createMockResponse();

      await handleConfigureProvider(req, res);

      expect(res._status).toBe(200);
      expect((res._body as { ok: boolean }).ok).toBe(true);
    });
  });
});

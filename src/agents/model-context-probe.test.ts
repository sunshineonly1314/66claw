/**
 * model-context-probe 单元测试
 *
 * 覆盖：
 *   - shouldSkipProbe 名字预过滤
 *   - parseContextWindowFromJson / parseContextWindowFromText 解析器
 *   - probeOllamaModel /api/show 探测
 *   - probeModelSelfReport / probeModelSelfReportSimple URL 归一化 + 请求
 *   - probeProviderModels 并发编排 + 缓存逻辑
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Mock logger — 必须在 import 被测模块前定义
vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock fetch — re-stub in beforeEach because vitest `unstubGlobals: true` resets between tests
const mockFetch = vi.fn();

import {
  shouldSkipProbe,
  probeOllamaModel,
  probeModelSelfReport,
  probeModelSelfReportSimple,
  probeProviderModels,
  type ProbeResult,
} from "./model-context-probe.js";

// Re-apply the global fetch stub before every test to survive unstubGlobals
beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

// ══════════════════════════════════════════════════════════════════════
// shouldSkipProbe — 名字预过滤
// ══════════════════════════════════════════════════════════════════════

describe("shouldSkipProbe", () => {
  it("应该跳过小模型 (0.5B-3B)", () => {
    expect(shouldSkipProbe("qwen2.5-0.5b")).toBe(true);
    expect(shouldSkipProbe("llama-1b")).toBe(true);
    expect(shouldSkipProbe("phi-2b")).toBe(true);
    expect(shouldSkipProbe("gemma-3b")).toBe(true);
  });

  it("不应跳过较大的模型 (7B+)", () => {
    expect(shouldSkipProbe("qwen2.5-7b")).toBe(false);
    expect(shouldSkipProbe("llama-70b")).toBe(false);
    expect(shouldSkipProbe("deepseek-v3")).toBe(false);
  });

  it("应该跳过 tiny/nano 模型", () => {
    expect(shouldSkipProbe("phi-tiny")).toBe(true);
    expect(shouldSkipProbe("llama-nano")).toBe(true);
  });

  it("应该跳过 embedding 和 rerank 模型", () => {
    expect(shouldSkipProbe("bge-embed-v2")).toBe(true);
    expect(shouldSkipProbe("embedding-3")).toBe(true);
    expect(shouldSkipProbe("bge-reranker-v2")).toBe(true);
  });

  it("应该跳过语音/图片模型", () => {
    expect(shouldSkipProbe("whisper-large")).toBe(true);
    expect(shouldSkipProbe("sensevoice-small")).toBe(true);
    expect(shouldSkipProbe("tts-1")).toBe(true);
    expect(shouldSkipProbe("stable-diffusion-xl")).toBe(true);
    expect(shouldSkipProbe("flux-dev")).toBe(true);
  });

  it("白名单：minimax 不跳过（虽然含 mini）", () => {
    expect(shouldSkipProbe("minimax-01")).toBe(false);
    expect(shouldSkipProbe("MiniMax-Text-01")).toBe(false);
  });

  it("白名单：gpt-4o-mini 不跳过", () => {
    expect(shouldSkipProbe("gpt-4o-mini")).toBe(false);
  });

  it("普通聊天模型不应跳过", () => {
    expect(shouldSkipProbe("deepseek-chat")).toBe(false);
    expect(shouldSkipProbe("gpt-4o")).toBe(false);
    expect(shouldSkipProbe("kimi-for-coding")).toBe(false);
    expect(shouldSkipProbe("claude-3-sonnet")).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// parseContextWindowFromJson — 内部函数通过 probeModelSelfReport 间接测试
// 使用 probeModelSelfReport 搭配 mock fetch 来测试解析逻辑
// ══════════════════════════════════════════════════════════════════════

describe("parseContextWindowFromJson (via probeModelSelfReport)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  /** 辅助函数：mock fetch 返回指定 content */
  function mockSelfReportResponse(content: string) {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content } }],
      }),
    });
  }

  const baseParams = {
    baseUrl: "https://api.example.com/v1",
    apiKey: "test-key",
    modelId: "test-model",
  };

  it("应该解析标准 JSON 响应", async () => {
    mockSelfReportResponse('{"context_window": 128000}');
    const result = await probeModelSelfReport(baseParams);
    expect(result).toBe(128000);
  });

  it("应该解析带逗号分隔的数字", async () => {
    mockSelfReportResponse('{"context_window": 128,000}');
    const result = await probeModelSelfReport(baseParams);
    expect(result).toBe(128000);
  });

  it("应该解析带下划线分隔的数字", async () => {
    mockSelfReportResponse('{"context_window": 128_000}');
    const result = await probeModelSelfReport(baseParams);
    expect(result).toBe(128000);
  });

  it("应该解析科学计数法 1e6", async () => {
    mockSelfReportResponse('{"context_window": 1e6}');
    const result = await probeModelSelfReport(baseParams);
    expect(result).toBe(1000000);
  });

  it("应该解析科学计数法 1.28e5", async () => {
    mockSelfReportResponse('{"context_window": 1.28e5}');
    const result = await probeModelSelfReport(baseParams);
    expect(result).toBe(128000);
  });

  it("应该拒绝太小的值 (< 1000)", async () => {
    mockSelfReportResponse('{"context_window": 512}');
    const result = await probeModelSelfReport(baseParams);
    expect(result).toBeNull();
  });

  it("应该拒绝太大的值 (> 10M)", async () => {
    mockSelfReportResponse('{"context_window": 999999999}');
    const result = await probeModelSelfReport(baseParams);
    expect(result).toBeNull();
  });

  it("应该拒绝非 JSON 响应", async () => {
    mockSelfReportResponse("I don't know my context window.");
    const result = await probeModelSelfReport(baseParams);
    expect(result).toBeNull();
  });

  it("应该拒绝空响应", async () => {
    mockSelfReportResponse("");
    const result = await probeModelSelfReport(baseParams);
    expect(result).toBeNull();
  });

  it("fetch 返回非 ok 时应返回 null", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const result = await probeModelSelfReport(baseParams);
    expect(result).toBeNull();
  });

  it("fetch 异常时应返回 null", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));
    const result = await probeModelSelfReport(baseParams);
    expect(result).toBeNull();
  });

  it("应该处理 JSON 中有额外字段的响应", async () => {
    mockSelfReportResponse('{"context_window": 65536, "model": "test"}');
    const result = await probeModelSelfReport(baseParams);
    expect(result).toBe(65536);
  });
});

// ══════════════════════════════════════════════════════════════════════
// parseContextWindowFromText (via probeModelSelfReportSimple)
// ══════════════════════════════════════════════════════════════════════

describe("parseContextWindowFromText (via probeModelSelfReportSimple)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  function mockSimpleResponse(content: string) {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content } }],
      }),
    });
  }

  const baseParams = {
    baseUrl: "https://api.example.com/v1",
    apiKey: "test-key",
    modelId: "test-model",
  };

  it("应该解析纯数字响应", async () => {
    mockSimpleResponse("128000");
    const result = await probeModelSelfReportSimple(baseParams);
    expect(result).toBe(128000);
  });

  it("应该解析带逗号的数字", async () => {
    mockSimpleResponse("128,000");
    const result = await probeModelSelfReportSimple(baseParams);
    expect(result).toBe(128000);
  });

  it("应该从文字中提取数字", async () => {
    mockSimpleResponse("My context window is 131072 tokens.");
    const result = await probeModelSelfReportSimple(baseParams);
    expect(result).toBe(131072);
  });

  it("应该拒绝太小的数字", async () => {
    mockSimpleResponse("42");
    const result = await probeModelSelfReportSimple(baseParams);
    expect(result).toBeNull();
  });

  it("应该拒绝无数字的文本", async () => {
    mockSimpleResponse("I don't know.");
    const result = await probeModelSelfReportSimple(baseParams);
    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════
// URL 归一化 (CRIT-4)
// ══════════════════════════════════════════════════════════════════════

describe("URL 归一化 (CRIT-4)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"context_window": 128000}' } }],
      }),
    });
  });

  it("bare URL 应该自动追加 /v1", async () => {
    await probeModelSelfReport({
      baseUrl: "http://localhost:11434",
      apiKey: "key",
      modelId: "test",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:11434/v1/chat/completions",
      expect.any(Object),
    );
  });

  it("已有 /v1 的 URL 不应重复追加", async () => {
    await probeModelSelfReport({
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "key",
      modelId: "test",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.deepseek.com/v1/chat/completions",
      expect.any(Object),
    );
  });

  it("已有 /v2 等版本号的 URL 不应追加 /v1", async () => {
    await probeModelSelfReport({
      baseUrl: "https://api.example.com/v2",
      apiKey: "key",
      modelId: "test",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/v2/chat/completions",
      expect.any(Object),
    );
  });

  it("尾部斜杠应被清理", async () => {
    await probeModelSelfReport({
      baseUrl: "https://api.example.com/v1/",
      apiKey: "key",
      modelId: "test",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.any(Object),
    );
  });

  it("probeModelSelfReportSimple 也应正确归一化", async () => {
    await probeModelSelfReportSimple({
      baseUrl: "http://192.168.1.100:8080",
      apiKey: "key",
      modelId: "test",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.1.100:8080/v1/chat/completions",
      expect.any(Object),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════
// probeOllamaModel — /api/show 探测
// ══════════════════════════════════════════════════════════════════════

describe("probeOllamaModel", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("应该从 model_info 中提取 context_length", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        model_info: {
          "general.context_length": 131072,
          "general.architecture": "llama",
        },
      }),
    });

    const result = await probeOllamaModel("http://localhost:11434", "llama3:latest");
    expect(result).toBe(131072);
  });

  it("应该从 parameters 字符串中提取 num_ctx", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        parameters: "num_ctx 4096\nnum_batch 512",
      }),
    });

    const result = await probeOllamaModel("http://localhost:11434", "old-model");
    expect(result).toBe(4096);
  });

  it("model_info 优先于 parameters", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        model_info: { "general.context_length": 131072 },
        parameters: "num_ctx 4096",
      }),
    });

    const result = await probeOllamaModel("http://localhost:11434", "mixed");
    expect(result).toBe(131072);
  });

  it("带 /v1 的 baseUrl 应被正确剥离", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        model_info: { "general.context_length": 8192 },
      }),
    });

    await probeOllamaModel("http://localhost:11434/v1", "test");

    // 应该调用 /api/show 而非 /v1/api/show
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:11434/api/show", expect.any(Object));
  });

  it("HTTP 错误应返回 null", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const result = await probeOllamaModel("http://localhost:11434", "nonexistent");
    expect(result).toBeNull();
  });

  it("网络错误应返回 null", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await probeOllamaModel("http://localhost:11434", "unreachable");
    expect(result).toBeNull();
  });

  it("无 model_info 也无 parameters 应返回 null", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const result = await probeOllamaModel("http://localhost:11434", "empty");
    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════
// probeProviderModels — 并发编排 + 缓存
// ══════════════════════════════════════════════════════════════════════

describe("probeProviderModels", () => {
  let tmpDir: string;

  beforeEach(async () => {
    mockFetch.mockReset();
    tmpDir = path.join(
      os.tmpdir(),
      `probe-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("应该对所有模型返回结果", async () => {
    // Mock: 所有 fetch 都失败
    mockFetch.mockRejectedValue(new Error("not reachable"));

    const results = await probeProviderModels({
      providerType: "openai-compat",
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      models: [
        { id: "model-a", contextWindow: 32768 },
        { id: "model-b", contextWindow: 32768 },
      ],
      concurrency: 2,
    });

    expect(results).toHaveLength(2);
    expect(results[0].modelId).toBe("model-a");
    expect(results[1].modelId).toBe("model-b");
  });

  it("应该跳过 shouldSkipProbe 匹配的模型", async () => {
    mockFetch.mockRejectedValue(new Error("should not be called"));

    const results = await probeProviderModels({
      providerType: "openai-compat",
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      models: [
        { id: "bge-embed-v2" }, // embed → skip
        { id: "whisper-large" }, // whisper → skip
      ],
      concurrency: 1,
    });

    // 跳过的模型仍然返回结果（source = "failed", contextWindow = null）
    expect(results).toHaveLength(2);
    // fetch 不应被调用（因为都被 skip 了）
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("Ollama 类型应先尝试 /api/show 再回退到 self-report", async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes("/api/show")) {
        return {
          ok: true,
          json: async () => ({
            model_info: { "general.context_length": 131072 },
          }),
        };
      }
      // self-report 不应被调用
      return { ok: false, status: 500 };
    });

    const results = await probeProviderModels({
      providerType: "ollama",
      baseUrl: "http://localhost:11434",
      apiKey: "ollama",
      models: [{ id: "llama3:latest" }],
      concurrency: 1,
    });

    expect(results[0].contextWindow).toBe(131072);
    expect(results[0].source).toBe("ollama-show");
  });

  it("应该正确写入和读取缓存", async () => {
    // 第一次调用：mock 返回 self-report 结果
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"context_window": 65536}' } }],
      }),
    });

    await probeProviderModels({
      providerType: "openai-compat",
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      models: [{ id: "cached-model" }],
      concurrency: 1,
      cacheDir: tmpDir,
    });

    // 验证缓存文件存在
    const cacheFile = path.join(tmpDir, "model-probe-cache.json");
    const cacheContent = await fs.readFile(cacheFile, "utf-8");
    const cache = JSON.parse(cacheContent);
    const cacheKeys = Object.keys(cache);
    expect(cacheKeys.length).toBe(1);
    expect(cacheKeys[0]).toContain("openai-compat:");
    expect(cacheKeys[0]).toContain(":cached-model");

    // 第二次调用：应命中缓存，不发网络请求
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error("should not be called"));

    const results2 = await probeProviderModels({
      providerType: "openai-compat",
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      models: [{ id: "cached-model" }],
      concurrency: 1,
      cacheDir: tmpDir,
    });

    expect(results2[0].contextWindow).toBe(65536);
    expect(results2[0].source).toBe("self-report");
    // fetch 不应被调用
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("缓存应该基于 baseUrl hash 区分不同实例", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"context_window": 32000}' } }],
      }),
    });

    // 用 baseUrl-A 探测
    await probeProviderModels({
      providerType: "openai-compat",
      baseUrl: "http://server-a:8080/v1",
      apiKey: "key",
      models: [{ id: "same-model" }],
      cacheDir: tmpDir,
    });

    // 改用 baseUrl-B 探测同一个 modelId — 应该重新探测
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"context_window": 64000}' } }],
      }),
    });

    const results = await probeProviderModels({
      providerType: "openai-compat",
      baseUrl: "http://server-b:8080/v1",
      apiKey: "key",
      models: [{ id: "same-model" }],
      cacheDir: tmpDir,
    });

    // 应该得到 64000 而非缓存的 32000
    expect(results[0].contextWindow).toBe(64000);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("缓存应该剪裁过期条目 (CRIT-7)", async () => {
    // 手动写入过期缓存
    const cacheFile = path.join(tmpDir, "model-probe-cache.json");
    const expiredCache = {
      "openai-compat:abcdef12:old-model": {
        contextWindow: 4096,
        probedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 天前，超过 7 天 TTL
        source: "self-report",
      },
      "openai-compat:abcdef12:new-model": {
        contextWindow: 128000,
        probedAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 天前，未过期
        source: "self-report",
      },
    };
    await fs.writeFile(cacheFile, JSON.stringify(expiredCache));

    // 探测一个新模型，触发 saveProbeCache 清理
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"context_window": 65536}' } }],
      }),
    });

    await probeProviderModels({
      providerType: "openai-compat",
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      models: [{ id: "fresh-model" }],
      cacheDir: tmpDir,
    });

    // 读取缓存：old-model 应被清理，new-model 和 fresh-model 应保留
    const saved = JSON.parse(await fs.readFile(cacheFile, "utf-8"));
    const keys = Object.keys(saved);
    expect(keys.some((k) => k.includes("old-model"))).toBe(false);
    expect(keys.some((k) => k.includes("new-model"))).toBe(true);
    expect(keys.some((k) => k.includes("fresh-model"))).toBe(true);
  });

  it("无 cacheDir 时不写缓存文件", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"context_window": 32768}' } }],
      }),
    });

    await probeProviderModels({
      providerType: "openai-compat",
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      models: [{ id: "no-cache-model" }],
      // 不传 cacheDir
    });

    // tmpDir 下不应有缓存文件
    const files = await fs.readdir(tmpDir);
    expect(files).not.toContain("model-probe-cache.json");
  });
});

// ══════════════════════════════════════════════════════════════════════
// probeModelSelfReport — headers 透传
// ══════════════════════════════════════════════════════════════════════

describe("probeModelSelfReport headers 透传", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"context_window": 128000}' } }],
      }),
    });
  });

  it("自定义 headers 应传入 fetch", async () => {
    await probeModelSelfReport({
      baseUrl: "https://api.example.com/v1",
      apiKey: "key",
      modelId: "test",
      headers: { "User-Agent": "KimiCLI/0.77" },
    });

    const fetchCall = mockFetch.mock.calls[0];
    const opts = fetchCall[1] as { headers: Record<string, string> };
    expect(opts.headers["User-Agent"]).toBe("KimiCLI/0.77");
    expect(opts.headers["Authorization"]).toBe("Bearer key");
  });

  it("promptOverride 应替换默认 prompt", async () => {
    await probeModelSelfReport({
      baseUrl: "https://api.example.com/v1",
      apiKey: "key",
      modelId: "test",
      promptOverride: "自定义 prompt",
    });

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse((fetchCall[1] as { body: string }).body);
    expect(body.messages[0].content).toBe("自定义 prompt");
  });
});

// ══════════════════════════════════════════════════════════════════════
// probeProviderModels — 并发限制
// ══════════════════════════════════════════════════════════════════════

describe("probeProviderModels 并发限制", () => {
  it("concurrency=1 时应顺序探测", async () => {
    const callOrder: string[] = [];

    mockFetch.mockImplementation(async (url: string, opts: { body: string }) => {
      const body = JSON.parse(opts.body);
      const modelId = body.model || "unknown";
      callOrder.push(modelId);
      // 模拟小延迟
      await new Promise((r) => setTimeout(r, 10));
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"context_window": 32768}' } }],
        }),
      };
    });

    await probeProviderModels({
      providerType: "openai-compat",
      baseUrl: "https://api.test.com/v1",
      apiKey: "key",
      models: [{ id: "model-1" }, { id: "model-2" }, { id: "model-3" }],
      concurrency: 1,
    });

    // 所有模型都应该被探测到（每个模型可能会有多次 fetch 调用: EN + ZH + simple）
    expect(callOrder.length).toBeGreaterThanOrEqual(3);
  });
});

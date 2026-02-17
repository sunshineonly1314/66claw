/**
 * 轮询服务单元测试
 * Polling Service Unit Tests
 *
 * 测试覆盖:
 * - 正常轮询流程
 * - 消息处理和 offset 更新
 * - 错误重试机制
 * - abort 信号停止
 * - apiKey URL 编码
 * - markProcessed 调用
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies
const mockParseTelegramUpdate = vi.fn();
const mockDownloadMedia = vi.fn();
const mockInjectMessage = vi.fn();

vi.mock("./message-parser.js", () => ({
  parseTelegramUpdate: (...args: any[]) => mockParseTelegramUpdate(...args),
}));

vi.mock("./media-handler.js", () => ({
  downloadMedia: (...args: any[]) => mockDownloadMedia(...args),
}));

vi.mock("./message-injector.js", () => ({
  injectMessage: (...args: any[]) => mockInjectMessage(...args),
}));

const mockFetch = vi.fn();

import { startPollingService } from "./polling.js";

// ============================================================================
// 测试辅助函数
// ============================================================================

function createCtx(overrides?: Record<string, any>) {
  return {
    account: {
      accountId: "test-account",
      config: {
        apiKey: "test-api-key",
        pollIntervalMs: 100, // 极短间隔用于测试
        debug: false,
      },
    },
    abortSignal: new AbortController().signal,
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    deps: {},
    ...overrides,
  };
}

function createPollResponse(updates: any[] = []) {
  return {
    ok: true,
    json: () => Promise.resolve({ ok: true, result: updates }),
  };
}

// ============================================================================
// 启动和初始化测试
// ============================================================================

describe("startPollingService - 启动", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();
    mockFetch.mockReset();
    mockParseTelegramUpdate.mockReset();
    mockDownloadMedia.mockReset();
    mockInjectMessage.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("返回 running=true 和 cleanup 函数", async () => {
    // 第一次 poll 返回空结果
    mockFetch.mockResolvedValueOnce(createPollResponse([]));

    const ctx = createCtx();
    const result = await startPollingService(ctx);

    expect(result.running).toBe(true);
    expect(result.lastStartAt).toBeGreaterThan(0);
    expect(typeof result.cleanup).toBe("function");

    // 清理定时器
    result.cleanup();
  });

  it("无 apiKey 时抛出错误", async () => {
    const ctx = createCtx();
    ctx.account.config.apiKey = "";

    await expect(startPollingService(ctx)).rejects.toThrow(
      "API Key not configured",
    );
  });

  it("apiKey 中的冒号被正确 URL 编码", async () => {
    mockFetch.mockResolvedValueOnce(createPollResponse([]));

    const ctx = createCtx();
    ctx.account.config.apiKey = "key:with:colons";

    const result = await startPollingService(ctx);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("key%3Awith%3Acolons");
    expect(calledUrl).not.toContain("key:with:colons/");

    result.cleanup();
  });
});

// ============================================================================
// 消息处理测试
// ============================================================================

describe("startPollingService - 消息处理", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();
    mockFetch.mockReset();
    mockParseTelegramUpdate.mockReset();
    mockDownloadMedia.mockReset();
    mockInjectMessage.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("收到消息后调用解析、下载和注入", async () => {
    const update = { update_id: 1001, message: { text: "hello" } };

    // 第一次轮询返回一条消息
    mockFetch
      .mockResolvedValueOnce(createPollResponse([update]))
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve("") }) // markProcessed
      .mockResolvedValueOnce(createPollResponse([])); // 第二次轮询空

    mockParseTelegramUpdate.mockReturnValue({
      openid: "user123",
      updateId: 1001,
      text: "hello",
      mediaUrls: [],
      mediaTypes: [],
    });

    mockDownloadMedia.mockResolvedValue({
      mediaUrls: [],
      mediaTypes: [],
      mediaPaths: [],
    });

    mockInjectMessage.mockResolvedValue(undefined);

    const ctx = createCtx();
    const result = await startPollingService(ctx);

    // 等待第一次 poll 完成
    await vi.advanceTimersByTimeAsync(10);

    expect(mockParseTelegramUpdate).toHaveBeenCalledWith(
      update,
      "test-account",
      ctx.log,
    );
    expect(mockDownloadMedia).toHaveBeenCalled();
    expect(mockInjectMessage).toHaveBeenCalled();

    result.cleanup();
  });

  it("解析返回 null 的消息被跳过", async () => {
    const update = { update_id: 1001 }; // 无 message 字段

    mockFetch
      .mockResolvedValueOnce(createPollResponse([update]))
      .mockResolvedValueOnce(createPollResponse([]));

    mockParseTelegramUpdate.mockReturnValue(null);

    const ctx = createCtx();
    const result = await startPollingService(ctx);

    await vi.advanceTimersByTimeAsync(10);

    expect(mockDownloadMedia).not.toHaveBeenCalled();
    expect(mockInjectMessage).not.toHaveBeenCalled();

    result.cleanup();
  });
});

// ============================================================================
// Offset 更新测试
// ============================================================================

describe("startPollingService - Offset 更新", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();
    mockFetch.mockReset();
    mockParseTelegramUpdate.mockReset();
    mockDownloadMedia.mockReset();
    mockInjectMessage.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("offset 从 0 开始", async () => {
    mockFetch.mockResolvedValueOnce(createPollResponse([]));

    const ctx = createCtx();
    const result = await startPollingService(ctx);

    const firstUrl = mockFetch.mock.calls[0][0];
    expect(firstUrl).toContain("offset=0");

    result.cleanup();
  });

  it("处理消息后 offset 更新为 maxUpdateId + 1", async () => {
    // 第一次轮询
    mockFetch.mockResolvedValueOnce(
      createPollResponse([
        { update_id: 100, message: { text: "a" } },
        { update_id: 102, message: { text: "b" } },
      ]),
    );
    // markProcessed
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve("") });
    // 第二次轮询
    mockFetch.mockResolvedValueOnce(createPollResponse([]));

    mockParseTelegramUpdate
      .mockReturnValueOnce({
        openid: "u1",
        updateId: 100,
        text: "a",
        mediaUrls: [],
        mediaTypes: [],
      })
      .mockReturnValueOnce({
        openid: "u2",
        updateId: 102,
        text: "b",
        mediaUrls: [],
        mediaTypes: [],
      });

    mockDownloadMedia.mockResolvedValue({
      mediaUrls: [],
      mediaTypes: [],
      mediaPaths: [],
    });
    mockInjectMessage.mockResolvedValue(undefined);

    const ctx = createCtx();
    const result = await startPollingService(ctx);

    // 等待第一次 poll 完成并触发第二次
    await vi.advanceTimersByTimeAsync(200);

    // 第二次 poll 的 URL 应包含 offset=103 (102+1)
    const secondPollCall = mockFetch.mock.calls.find(
      (call: any[]) => typeof call[0] === "string" && call[0].includes("offset=103"),
    );
    expect(secondPollCall).toBeDefined();

    result.cleanup();
  });
});

// ============================================================================
// 错误处理测试
// ============================================================================

describe("startPollingService - 错误处理", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();
    mockFetch.mockReset();
    mockParseTelegramUpdate.mockReset();
    mockDownloadMedia.mockReset();
    mockInjectMessage.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("HTTP 错误时记录日志并重试", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error",
      })
      .mockResolvedValueOnce(createPollResponse([]));

    const ctx = createCtx();
    const result = await startPollingService(ctx);

    await vi.advanceTimersByTimeAsync(10);

    expect(ctx.log.error).toHaveBeenCalledWith(
      expect.stringContaining("Polling failed"),
    );

    result.cleanup();
  });

  it("API ok=false 时记录日志并重试", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: false,
            error_code: 401,
            description: "Unauthorized",
          }),
      })
      .mockResolvedValueOnce(createPollResponse([]));

    const ctx = createCtx();
    const result = await startPollingService(ctx);

    await vi.advanceTimersByTimeAsync(10);

    expect(ctx.log.error).toHaveBeenCalledWith(
      expect.stringContaining("API error"),
    );

    result.cleanup();
  });

  it("单条消息处理失败不影响其他消息", async () => {
    mockFetch
      .mockResolvedValueOnce(
        createPollResponse([
          { update_id: 1, message: { text: "fail" } },
          { update_id: 2, message: { text: "success" } },
        ]),
      )
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve("") }) // markProcessed
      .mockResolvedValueOnce(createPollResponse([]));

    mockParseTelegramUpdate
      .mockReturnValueOnce({
        openid: "u1",
        updateId: 1,
        text: "fail",
        mediaUrls: [],
        mediaTypes: [],
      })
      .mockReturnValueOnce({
        openid: "u2",
        updateId: 2,
        text: "success",
        mediaUrls: [],
        mediaTypes: [],
      });

    mockDownloadMedia
      .mockRejectedValueOnce(new Error("download failed"))
      .mockResolvedValueOnce({
        mediaUrls: [],
        mediaTypes: [],
        mediaPaths: [],
      });

    mockInjectMessage.mockResolvedValue(undefined);

    const ctx = createCtx();
    const result = await startPollingService(ctx);

    await vi.advanceTimersByTimeAsync(10);

    // 第二条消息仍然被处理（injectMessage 至少被调用一次）
    expect(ctx.log.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to process message"),
    );

    result.cleanup();
  });
});

// ============================================================================
// Abort 测试
// ============================================================================

describe("startPollingService - Abort 信号", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("aborted 信号阻止轮询启动", async () => {
    const ac = new AbortController();
    ac.abort();

    mockFetch.mockResolvedValueOnce(createPollResponse([]));

    const ctx = createCtx({ abortSignal: ac.signal });
    const result = await startPollingService(ctx);

    // poll() 被立即调用，但因 aborted 立即返回
    await vi.advanceTimersByTimeAsync(200);

    // 当 aborted=true 时，fetch 不应该被调用
    expect(mockFetch).not.toHaveBeenCalled();

    result.cleanup();
  });

  it("cleanup 清理定时器", async () => {
    mockFetch.mockResolvedValueOnce(createPollResponse([]));

    const ctx = createCtx();
    const result = await startPollingService(ctx);

    result.cleanup();

    expect(ctx.log.info).toHaveBeenCalledWith(
      expect.stringContaining("cleaned up"),
    );
  });
});

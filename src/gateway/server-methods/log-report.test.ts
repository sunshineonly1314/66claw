/**
 * 日志上报运维中心 - Gateway handler 单元测试
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── vi.hoisted + vi.mock ──────────────────────────────

const mocks = vi.hoisted(() => ({
  getDeviceId: vi.fn(async () => "test-device-001"),
  resolveStateDir: vi.fn(() => "/tmp/test-state"),
  mkdir: vi.fn(async () => undefined),
  appendFile: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  readFile: vi.fn(async () => {
    throw new Error("ENOENT");
  }),
  fetch: vi.fn(),
}));

vi.mock("../../license/device-id.js", () => ({
  getDeviceId: mocks.getDeviceId,
}));

vi.mock("../../config/paths.js", () => ({
  resolveStateDir: mocks.resolveStateDir,
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    mkdir: mocks.mkdir,
    appendFile: mocks.appendFile,
    writeFile: mocks.writeFile,
    readFile: mocks.readFile,
  };
});

vi.stubGlobal("fetch", mocks.fetch);

// ── 被测模块（在 mock 之后导入） ──────────────────────

import { logReportHandlers } from "./log-report.js";
import type { GatewayRequestHandlerOptions } from "./types.js";

// ── 测试辅助 ──────────────────────────────────────────

const noop = () => false;

function makeContext(): GatewayRequestHandlerOptions["context"] {
  return {
    logGateway: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  } as unknown as GatewayRequestHandlerOptions["context"];
}

function callHandler(method: string, params: Record<string, unknown>) {
  const respond = vi.fn();
  const promise = logReportHandlers[method]({
    params,
    respond,
    context: makeContext(),
    client: null,
    req: { id: "req-1", type: "req" as const, method },
    isWebchatConnect: noop,
  });
  return { respond, promise };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    description: "测试问题描述，模型无法响应，需要运维分析",
    attachments: [],
    logEntries: ['{"ts":"2026-02-21T12:00:00Z","level":"info","msg":"test"}'],
    context: {
      version: "1.1.10",
      platform: "win32",
      timestamp: "2026-02-21T12:00:00.000Z",
    },
    ...overrides,
  };
}

// ── 测试用例 ──────────────────────────────────────────

describe("log_report.submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重新注册 fetch stub（unstubGlobals 会在每个测试后还原）
    vi.stubGlobal("fetch", mocks.fetch);
    // 默认: readFile 抛 ENOENT（无频次记录 → 首次提交）
    mocks.readFile.mockRejectedValue(new Error("ENOENT"));
    // 默认: getDeviceId 返回固定设备 ID
    mocks.getDeviceId.mockResolvedValue("test-device-001");
    // 默认: 远程同步成功
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        reportId: "rpt-test",
        ticketCode: "AB12CD",
        message: "ok",
      }),
    });
  });

  // ── 参数验证 ────────────────────────────────

  it("rejects empty description", async () => {
    const { respond, promise } = callHandler("log_report.submit", { description: "" });
    await promise;
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ code: "INVALID_REQUEST", message: "请填写问题描述" }),
    );
  });

  it("rejects undefined description", async () => {
    const { respond, promise } = callHandler("log_report.submit", {});
    await promise;
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ code: "INVALID_REQUEST" }),
    );
  });

  it("rejects description shorter than 5 chars", async () => {
    const { respond, promise } = callHandler("log_report.submit", { description: "短问题" });
    await promise;
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "问题描述至少需要5个字符" }),
    );
  });

  it("rejects description longer than 2000 chars", async () => {
    const { respond, promise } = callHandler("log_report.submit", {
      description: "x".repeat(2001),
    });
    await promise;
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("2000") }),
    );
  });

  it("rejects more than 3 attachments", async () => {
    const { respond, promise } = callHandler("log_report.submit", {
      description: "一个足够长的测试问题描述",
      attachments: ["a", "b", "c", "d"],
    });
    await promise;
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("3") }),
    );
  });

  // ── 正常提交 ────────────────────────────────

  it("submits successfully with ticket code", async () => {
    const { respond, promise } = callHandler("log_report.submit", validPayload());
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        synced: true,
        ticketCode: "AB12CD",
        remaining: 1,
      }),
      undefined,
    );
  });

  it("generates unique report id starting with rpt-", async () => {
    const { respond, promise } = callHandler("log_report.submit", validPayload());
    await promise;

    const payload = respond.mock.calls[0][1] as { id: string };
    expect(payload.id).toMatch(/^rpt-/);
  });

  it("saves report summary to local file", async () => {
    const { promise } = callHandler("log_report.submit", validPayload());
    await promise;

    expect(mocks.mkdir).toHaveBeenCalled();
    expect(mocks.appendFile).toHaveBeenCalled();

    // 本地存储应该是摘要（不含 base64 图片和日志原文）
    const savedLine = mocks.appendFile.mock.calls[0][1] as string;
    const saved = JSON.parse(savedLine.trim());
    expect(saved).toHaveProperty("id");
    expect(saved).toHaveProperty("deviceId", "test-device-001");
    expect(saved).toHaveProperty("attachmentCount");
    expect(saved).toHaveProperty("logEntryCount");
    expect(saved).not.toHaveProperty("attachments");
    expect(saved).not.toHaveProperty("logEntries");
  });

  it("sends correct payload to remote API", async () => {
    const payload = validPayload({ description: "远程同步测试描述内容" });
    const { promise } = callHandler("log_report.submit", payload);
    await promise;

    expect(mocks.fetch).toHaveBeenCalledOnce();
    const [url, opts] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/submit");
    expect(opts.method).toBe("POST");
    expect(opts.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
        "User-Agent": "OpenClawCN-Gateway/1.0",
      }),
    );

    const body = JSON.parse(opts.body as string);
    expect(body.description).toBe("远程同步测试描述内容");
    expect(body.deviceId).toBe("test-device-001");
  });

  it("truncates context fields", async () => {
    const { promise } = callHandler(
      "log_report.submit",
      validPayload({
        context: {
          version: "v".repeat(50), // 应被截断到 20
          platform: "p".repeat(100), // 应被截断到 50
          hostname: "h".repeat(100), // 应被截断到 50
        },
      }),
    );
    await promise;

    const body = JSON.parse((mocks.fetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.context.version.length).toBe(20);
    expect(body.context.platform.length).toBe(50);
    expect(body.context.hostname.length).toBe(50);
  });

  // ── 远程同步失败 ────────────────────────────

  it("handles network failure gracefully", async () => {
    mocks.fetch.mockRejectedValue(new Error("NetworkError"));

    const { respond, promise } = callHandler("log_report.submit", validPayload());
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        synced: false,
        ticketCode: null,
        message: expect.stringContaining("网络问题"),
      }),
      undefined,
    );
  });

  it("uses server error message for non-200 responses", async () => {
    mocks.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: "RATE_LIMITED",
        message: "每台设备每天最多提交2次日志报告",
      }),
    });

    const { respond, promise } = callHandler("log_report.submit", validPayload());
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        synced: false,
        message: "每台设备每天最多提交2次日志报告",
      }),
      undefined,
    );
  });

  // ── 频次限制 ────────────────────────────────

  it("allows first submission of the day", async () => {
    const { respond, promise } = callHandler("log_report.submit", validPayload());
    await promise;
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ remaining: 1 }),
      undefined,
    );
  });

  it("rejects when daily quota is exhausted", async () => {
    // 模拟已提交 2 次
    const today = (() => {
      const now = new Date();
      const cst = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      return cst.toISOString().slice(0, 10);
    })();
    mocks.readFile.mockResolvedValue(
      JSON.stringify({ "test-device-001": { date: today, count: 2 } }),
    );

    const { respond, promise } = callHandler("log_report.submit", validPayload());
    await promise;

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "UNAVAILABLE",
        message: expect.stringContaining("2次"),
      }),
    );
  });

  it("resets quota on new day", async () => {
    // 昨天的记录
    mocks.readFile.mockResolvedValue(
      JSON.stringify({ "test-device-001": { date: "2020-01-01", count: 2 } }),
    );

    const { respond, promise } = callHandler("log_report.submit", validPayload());
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ remaining: 1 }),
      undefined,
    );
  });

  it("limits log entries to 500", async () => {
    const manyEntries = Array.from({ length: 600 }, (_, i) => `log-entry-${i}`);
    const { promise } = callHandler("log_report.submit", validPayload({ logEntries: manyEntries }));
    await promise;

    const body = JSON.parse((mocks.fetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.logEntries.length).toBe(500);
  });

  it("fills placeholder when logEntries is empty", async () => {
    const { promise } = callHandler("log_report.submit", validPayload({ logEntries: [] }));
    await promise;

    const body = JSON.parse((mocks.fetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.logEntries).toEqual(["[no log entries available]"]);
  });

  it("fills placeholder when logEntries is undefined", async () => {
    const { promise } = callHandler("log_report.submit", validPayload({ logEntries: undefined }));
    await promise;

    const body = JSON.parse((mocks.fetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.logEntries).toEqual(["[no log entries available]"]);
  });

  it("provides default version and timestamp when context is missing", async () => {
    const { promise } = callHandler("log_report.submit", validPayload({ context: undefined }));
    await promise;

    const body = JSON.parse((mocks.fetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.context.version).toBe("unknown");
    expect(body.context.timestamp).toBeTruthy();
  });
});

describe("log_report.status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("rejects missing ticket code", async () => {
    const { respond, promise } = callHandler("log_report.status", {});
    await promise;
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "请输入6位工单号" }),
    );
  });

  it("rejects ticket code with wrong length", async () => {
    const { respond, promise } = callHandler("log_report.status", { ticketCode: "ABC" });
    await promise;
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "请输入6位工单号" }),
    );
  });

  it("converts ticket code to uppercase before querying", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        report: {
          ticketCode: "AB12CD",
          status: "pending",
          description: "test",
          createdAt: "2026-02-21T12:00:00.000Z",
          reply: null,
        },
      }),
    });

    const { promise } = callHandler("log_report.status", { ticketCode: "ab12cd" });
    await promise;

    const url = (mocks.fetch.mock.calls[0] as [string])[0];
    expect(url).toContain("ticketCode=AB12CD");
  });

  it("returns found report with reply", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        report: {
          ticketCode: "AB12CD",
          status: "replied",
          description: "测试问题",
          createdAt: "2026-02-21T12:00:00.000Z",
          reply: {
            content: "已解决",
            repliedAt: "2026-02-21T14:00:00.000Z",
          },
        },
      }),
    });

    const { respond, promise } = callHandler("log_report.status", { ticketCode: "AB12CD" });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        found: true,
        report: expect.objectContaining({
          status: "replied",
          reply: expect.objectContaining({ content: "已解决" }),
        }),
      }),
      undefined,
    );
  });

  it("handles network failure", async () => {
    mocks.fetch.mockRejectedValue(new Error("NetworkError"));

    const { respond, promise } = callHandler("log_report.status", { ticketCode: "AB12CD" });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        found: false,
        message: "无法连接运维中心，请稍后重试",
      }),
      undefined,
    );
  });

  it("handles not-found ticket", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        message: "未找到对应的报告",
      }),
    });

    const { respond, promise } = callHandler("log_report.status", { ticketCode: "XXXXXX" });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        found: false,
        message: "未找到对应的报告",
      }),
      undefined,
    );
  });

  it("handles 404 response with server message", async () => {
    mocks.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        message: "未找到对应的报告，请检查工单号是否正确",
        error: "NOT_FOUND",
      }),
    });

    const { respond, promise } = callHandler("log_report.status", { ticketCode: "ZZZZZZ" });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        found: false,
        message: "未找到对应的报告，请检查工单号是否正确",
      }),
      undefined,
    );
  });
});

describe("log_report.quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDeviceId.mockResolvedValue("test-device-001");
  });

  it("returns full quota when no prior submissions", async () => {
    mocks.readFile.mockRejectedValue(new Error("ENOENT"));

    const { respond, promise } = callHandler("log_report.quota", {});
    await promise;

    expect(respond).toHaveBeenCalledWith(true, { remaining: 2, maxPerDay: 2 }, undefined);
  });

  it("returns remaining quota after submissions", async () => {
    const today = (() => {
      const now = new Date();
      const cst = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      return cst.toISOString().slice(0, 10);
    })();
    mocks.readFile.mockResolvedValue(
      JSON.stringify({ "test-device-001": { date: today, count: 1 } }),
    );

    const { respond, promise } = callHandler("log_report.quota", {});
    await promise;

    expect(respond).toHaveBeenCalledWith(true, { remaining: 1, maxPerDay: 2 }, undefined);
  });

  it("returns 0 when quota exhausted", async () => {
    const today = (() => {
      const now = new Date();
      const cst = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      return cst.toISOString().slice(0, 10);
    })();
    mocks.readFile.mockResolvedValue(
      JSON.stringify({ "test-device-001": { date: today, count: 2 } }),
    );

    const { respond, promise } = callHandler("log_report.quota", {});
    await promise;

    expect(respond).toHaveBeenCalledWith(true, { remaining: 0, maxPerDay: 2 }, undefined);
  });
});

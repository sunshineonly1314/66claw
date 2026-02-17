/**
 * 回复发送模块单元测试
 * Reply Sender Unit Tests
 *
 * 测试覆盖:
 * - sendReply 文本消息发送
 * - sendReply 媒体消息发送（图片、视频、文档）
 * - 远程 URL vs 本地文件上传
 * - 错误处理
 * - apiKey URL 编码
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock runtime
const mockLoadWebMedia = vi.fn();
vi.mock("./runtime.js", () => ({
  getWechatMiniprogramRuntime: () => ({
    media: {
      loadWebMedia: mockLoadWebMedia,
    },
  }),
}));

// Mock media-handler
vi.mock("./media-handler.js", () => ({
  resolveMediaPath: (p: string) => `/resolved/${p}`,
}));

const mockFetch = vi.fn();

import { sendReply, type ReplyConfig } from "./reply-sender.js";
import { BRIDGE_URL } from "./constants.js";

// ============================================================================
// 测试辅助函数
// ============================================================================

function createReplyConfig(overrides?: Partial<ReplyConfig>): ReplyConfig {
  return {
    apiKey: "test-key",
    ...overrides,
  };
}

function mockSuccessResponse() {
  return {
    ok: true,
    json: () => Promise.resolve({ ok: true, result: { message_id: 1 } }),
    text: () => Promise.resolve(""),
  };
}

function mockErrorResponse(status = 500, statusText = "Server Error") {
  return {
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(`{"error":"internal"}`),
  };
}

// ============================================================================
// sendReply - 文本消息测试
// ============================================================================

describe("sendReply - 文本消息", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("纯文本消息（无媒体）正确发送", async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse());

    await sendReply(
      { text: "你好世界" },
      "user_openid",
      1001,
      createReplyConfig(),
      "default",
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/sendMessage");

    const body = JSON.parse(opts.body);
    expect(body.chat_id).toBe("user_openid");
    expect(body.text).toBe("你好世界");
    expect(body.reply_to_message_id).toBe(1001);
  });

  it("无 apiKey 时抛出错误", async () => {
    await expect(
      sendReply(
        { text: "test" },
        "user",
        undefined,
        createReplyConfig({ apiKey: "" }),
        "default",
      ),
    ).rejects.toThrow("API Key not configured");
  });

  it("apiKey 中的冒号被正确 URL 编码", async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse());

    await sendReply(
      { text: "test" },
      "user",
      undefined,
      createReplyConfig({ apiKey: "key:with:colons" }),
      "default",
    );

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("key%3Awith%3Acolons");
  });

  it("updateId 为 undefined 时不传 reply_to_message_id", async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse());

    await sendReply(
      { text: "no reply" },
      "user",
      undefined,
      createReplyConfig(),
      "default",
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.reply_to_message_id).toBeUndefined();
  });
});

// ============================================================================
// sendReply - 远程 URL 媒体测试
// ============================================================================

describe("sendReply - 远程 URL 媒体", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("远程图片 URL 使用 JSON 方式发送", async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse());

    await sendReply(
      {
        mediaUrls: ["https://example.com/photo.jpg"],
        mediaTypes: ["image/jpeg"],
        text: "看看这张图",
      },
      "user",
      1001,
      createReplyConfig({ uploadAPIURL: "https://bridge.com/sendPhoto" }),
      "default",
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://bridge.com/sendPhoto");

    const body = JSON.parse(opts.body);
    expect(body.photo).toBe("https://example.com/photo.jpg");
    expect(body.caption).toBe("看看这张图");
    expect(body.chat_id).toBe("user");
  });

  it("远程视频 URL 使用 sendVideo 端点", async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse());

    await sendReply(
      {
        mediaUrls: ["https://example.com/video.mp4"],
        mediaTypes: ["video/mp4"],
      },
      "user",
      undefined,
      createReplyConfig({ uploadVideoAPIURL: "https://bridge.com/sendVideo" }),
      "default",
    );

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://bridge.com/sendVideo");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.video).toBe("https://example.com/video.mp4");
  });

  it("远程文档 URL 使用 sendDocument 端点", async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse());

    await sendReply(
      {
        mediaUrls: ["https://example.com/doc.pdf"],
        mediaTypes: ["application/pdf"],
      },
      "user",
      undefined,
      createReplyConfig({
        uploadDocumentAPIURL: "https://bridge.com/sendDocument",
      }),
      "default",
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.document).toBe("https://example.com/doc.pdf");
  });

  it("多媒体文件依次发送，只有第一个带 caption", async () => {
    mockFetch
      .mockResolvedValueOnce(mockSuccessResponse())
      .mockResolvedValueOnce(mockSuccessResponse());

    await sendReply(
      {
        mediaUrls: [
          "https://example.com/photo1.jpg",
          "https://example.com/photo2.jpg",
        ],
        mediaTypes: ["image/jpeg", "image/jpeg"],
        text: "两张图",
      },
      "user",
      undefined,
      createReplyConfig(),
      "default",
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);

    const body1 = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body1.caption).toBe("两张图");

    const body2 = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body2.caption).toBeUndefined();
  });
});

// ============================================================================
// sendReply - 本地文件上传测试
// ============================================================================

describe("sendReply - 本地文件上传", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    mockLoadWebMedia.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("本地文件使用 multipart/form-data 上传", async () => {
    mockLoadWebMedia.mockResolvedValueOnce({
      buffer: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      contentType: "image/png",
    });
    mockFetch.mockResolvedValueOnce(mockSuccessResponse());

    await sendReply(
      {
        mediaUrls: ["/local/path/image.png"],
        mediaTypes: ["image/png"],
        text: "本地图片",
      },
      "user",
      undefined,
      createReplyConfig(),
      "default",
    );

    expect(mockLoadWebMedia).toHaveBeenCalledWith("/resolved//local/path/image.png");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [_url, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["Content-Type"]).toContain("multipart/form-data");
    // Body 应该是 Uint8Array
    expect(opts.body).toBeInstanceOf(Uint8Array);
  });
});

// ============================================================================
// sendReply - 错误处理测试
// ============================================================================

describe("sendReply - 错误处理", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("HTTP 错误时抛出异常", async () => {
    mockFetch.mockResolvedValueOnce(mockErrorResponse(500, "Server Error"));

    await expect(
      sendReply(
        { text: "test" },
        "user",
        undefined,
        createReplyConfig(),
        "default",
        { error: vi.fn() },
      ),
    ).rejects.toThrow("Failed to send message");
  });

  it("API 返回 ok=false 时抛出异常", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ ok: false, description: "chat not found" }),
    });

    await expect(
      sendReply(
        { text: "test" },
        "user",
        undefined,
        createReplyConfig(),
        "default",
        { error: vi.fn() },
      ),
    ).rejects.toThrow("chat not found");
  });

  it("媒体发送失败时传播错误", async () => {
    mockFetch.mockResolvedValueOnce(
      mockErrorResponse(400, "Bad Request"),
    );

    const mockLog = { error: vi.fn() };

    await expect(
      sendReply(
        {
          mediaUrls: ["https://example.com/photo.jpg"],
          mediaTypes: ["image/jpeg"],
        },
        "user",
        undefined,
        createReplyConfig(),
        "default",
        mockLog,
      ),
    ).rejects.toThrow();

    expect(mockLog.error).toHaveBeenCalled();
  });
});

// ============================================================================
// sendReply - 文本长度阈值测试
// ============================================================================

describe("sendReply - 文本长度逻辑", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("有媒体且文本 <= 1024 时只发媒体（含 caption）", async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse());

    await sendReply(
      {
        mediaUrls: ["https://example.com/photo.jpg"],
        mediaTypes: ["image/jpeg"],
        text: "短文本",
      },
      "user",
      undefined,
      createReplyConfig(),
      "default",
    );

    // 只有一次 fetch 调用（发媒体）
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("有媒体且文本 > 1024 时额外发一次文本", async () => {
    mockFetch
      .mockResolvedValueOnce(mockSuccessResponse()) // 媒体
      .mockResolvedValueOnce(mockSuccessResponse()); // 文本

    const longText = "a".repeat(1025);

    await sendReply(
      {
        mediaUrls: ["https://example.com/photo.jpg"],
        mediaTypes: ["image/jpeg"],
        text: longText,
      },
      "user",
      undefined,
      createReplyConfig(),
      "default",
    );

    // 两次 fetch：一次媒体，一次文本
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("无媒体时只发文本", async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse());

    await sendReply(
      { text: "纯文本消息" },
      "user",
      undefined,
      createReplyConfig(),
      "default",
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("/sendMessage");
  });

  it("无文本无媒体时不发送任何内容", async () => {
    await sendReply(
      { text: "" },
      "user",
      undefined,
      createReplyConfig(),
      "default",
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
